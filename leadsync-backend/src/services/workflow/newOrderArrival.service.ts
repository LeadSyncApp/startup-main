import { prisma } from "../../lib/prisma";
import { Prisma, 
    OrderStatus, 
    OrderPriority, 
    OrderSource, 
    PendingOrderState,
    LeadStatus,
    ConversationStatus
} from "@prisma/client";
import { emitToCompany, emitToCompanyAdmin, emitToAgent, safeEmitConversationUpdate } from "../../lib/socket";
import { notificationService } from "../../services/infrastructure/notification.service";
import { recalculateLeadCRM } from "../integrations/crm.service";

/**
 * Unified New Order Arrival Service
 * 
 * This service implements the universal new order intake rule:
 * - ALL fresh incoming orders must first enter New Order Arrivals
 * - No bypassing based on existing customer/lead state
 * - Claim-first workflow for all orders
 * - Historical context preservation without workflow bypass
 */

export interface NewOrderArrivalData {
    companyId: string;
    conversationId: string;
    leadId: string;
    summary: string;
    amount: number;
    items?: any[];
    source?: OrderSource;
    priority?: OrderPriority;
    detectedLanguage?: string;
    status?: OrderStatus;
}

export interface CustomerHistory {
    isExistingCustomer: boolean;
    previousOrderCount: number;
    previousSpend: number;
    previousAgent?: { id: string; name: string };
    recentOrders: Array<{
        id: string;
        amount: number;
        createdAt: Date;
        processedBy?: string;
    }>;
    wasDeleted: boolean;
    wasClosed: boolean;
}

export class NewOrderArrivalService {

    /**
     * Main entry point for all new orders
     * Implements universal intake rule
     */
    async processNewOrderArrival(data: NewOrderArrivalData): Promise<any> {
        const { companyId, conversationId, leadId, summary, amount, items, source, priority, status } = data;

        console.log(`🆕 [NewOrderArrival] Processing new order arrival for lead ${leadId}`);

        // 1. Get customer history for context
        const customerHistory = await this.getCustomerHistory(companyId, leadId);

        const initialStatus = status || OrderStatus.NEW;

        // Find if conversation is assigned to active agent
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            select: { assignedToId: true }
        });
        let assignedToId = conversation?.assignedToId || null;

        // Try auto-assignment if unclaimed & strategy is active
        if (!assignedToId) {
            try {
                const { assignmentService } = await import("./assignment.service.js");
                const autoAssignedId = await assignmentService.autoAssignConversation(companyId, conversationId);
                if (autoAssignedId) {
                    assignedToId = autoAssignedId;
                }
            } catch (err) {
                console.error("[AUTO-ASSIGN-ERROR] processNewOrderArrival auto assign failed:", err);
            }
        }

        // 2. Create the order
        const order = await prisma.order.create({
            data: {
                companyId,
                conversationId,
                leadId,
                summary,
                amount,
                items: items ?? undefined,
                status: initialStatus,
                source: source || OrderSource.BOT_DETECTED,
                priority: priority || (amount > 0 ? OrderPriority.URGENT : OrderPriority.NORMAL),
                priorityScore: this.calculatePriorityScore(amount, customerHistory),
                predictedValue: amount,
                isUrgent: amount > 0,
                processedById: assignedToId,
            },
            include: {
                conversation: {
                    include: { lead: true }
                },
                lead: true
            }
        });

        // 3. Update lead with pending order state (only for confirmed orders)
        if (initialStatus !== OrderStatus.BOT_CREATED_ORDER) {
            await this.updateLeadWithPendingOrder(leadId, order, customerHistory);
        }

        // 4. Create New Order Arrival notification and socket events (only for confirmed orders)
        if (initialStatus !== OrderStatus.BOT_CREATED_ORDER) {
            await this.notifyNewOrderArrival(companyId, order, customerHistory);
        }

        // 5. Log the arrival for audit
        await this.logOrderArrival(order.id, customerHistory);

        console.log(`✅ [NewOrderArrival] Order ${order.id} processed - Status: ${initialStatus} - Customer: ${customerHistory.isExistingCustomer ? 'Existing' : 'New'}`);

        return {
            order,
            customerHistory,
            requiresClaim: initialStatus !== OrderStatus.BOT_CREATED_ORDER && !assignedToId
        };
    }

    /**
     * Get comprehensive customer histories in batch to avoid N+1 query overhead and prevent connection leaks
     */
    async getCustomerHistoryBatch(companyId: string, leadIds: string[]): Promise<Record<string, CustomerHistory>> {
        if (!leadIds || leadIds.length === 0) {
            return {};
        }

        const uniqueLeadIds = Array.from(new Set(leadIds));

        // 1. Fetch all leads in batch
        const leads = await prisma.lead.findMany({
            where: { id: { in: uniqueLeadIds } },
            select: {
                id: true,
                totalSpend: true,
                orderCount: true,
                status: true,
                deletedAt: true
            }
        });

        // 2. Fetch all previous orders in batch
        const allPreviousOrders = await prisma.order.findMany({
            where: {
                companyId,
                leadId: { in: uniqueLeadIds },
                isDeleted: false,
                status: { notIn: ["BOT_CREATED_ORDER", "REJECTED", "CANCELLED"] }
            },
            include: {
                processedBy: { select: { id: true, name: true } }
            },
            orderBy: { createdAt: "desc" }
        });

        // 3. Fetch all last processed orders in batch
        const allLastProcessedOrders = await prisma.order.findMany({
            where: {
                companyId,
                leadId: { in: uniqueLeadIds },
                isDeleted: false,
                processedById: { not: null }
            },
            include: {
                processedBy: { select: { id: true, name: true } }
            },
            orderBy: { createdAt: "desc" }
        });

        const leadMap = new Map(leads.map(l => [l.id, l]));
        
        // Group previous orders by leadId
        const previousOrdersMap = new Map<string, typeof allPreviousOrders>();
        allPreviousOrders.forEach(o => {
            if (!previousOrdersMap.has(o.leadId)) {
                previousOrdersMap.set(o.leadId, []);
            }
            previousOrdersMap.get(o.leadId)!.push(o);
        });

        // Group last processed orders by leadId
        const lastProcessedMap = new Map<string, typeof allLastProcessedOrders[0]>();
        allLastProcessedOrders.forEach(o => {
            if (!lastProcessedMap.has(o.leadId)) {
                lastProcessedMap.set(o.leadId, o);
            }
        });

        const result: Record<string, CustomerHistory> = {};

        for (const leadId of uniqueLeadIds) {
            const lead = leadMap.get(leadId);
            const prevOrders = previousOrdersMap.get(leadId) || [];
            const lastProc = lastProcessedMap.get(leadId);

            const isExistingCustomer = (lead?.orderCount || 0) > 0;
            const wasDeleted = !!lead?.deletedAt;
            const wasClosed = lead?.status === LeadStatus.ARCHIVED;

            result[leadId] = {
                isExistingCustomer,
                previousOrderCount: lead?.orderCount || 0,
                previousSpend: lead?.totalSpend || 0,
                previousAgent: lastProc?.processedBy || undefined,
                recentOrders: prevOrders.slice(0, 3).map(o => ({
                    id: o.id,
                    amount: o.amount,
                    createdAt: o.createdAt,
                    processedBy: o.processedBy?.name
                })),
                wasDeleted,
                wasClosed
            };
        }

        return result;
    }

    /**
     * Get comprehensive customer history
     */
    async getCustomerHistory(companyId: string, leadId: string): Promise<CustomerHistory> {
        const [lead, previousOrders, lastProcessedOrder] = await Promise.all([
            prisma.lead.findUnique({
                where: { id: leadId },
                select: { 
                    totalSpend: true, 
                    orderCount: true, 
                    status: true,
                    deletedAt: true // Check if lead was deleted
                }
            }),
            prisma.order.findMany({
                where: { 
                    leadId, 
                    companyId,
                    isDeleted: false,
                    status: { notIn: ["BOT_CREATED_ORDER", "REJECTED", "CANCELLED"] }
                },
                include: {
                    processedBy: { select: { id: true, name: true } }
                },
                orderBy: { createdAt: "desc" },
                take: 5
            }),
            prisma.order.findFirst({
                where: { 
                    leadId, 
                    companyId,
                    isDeleted: false,
                    processedById: { not: null }
                },
                include: {
                    processedBy: { select: { id: true, name: true } }
                },
                orderBy: { createdAt: "desc" }
            })
        ]);

        const isExistingCustomer = (lead?.orderCount || 0) > 0;
        const wasDeleted = !!lead?.deletedAt;
        const wasClosed = lead?.status === LeadStatus.ARCHIVED;

        return {
            isExistingCustomer,
            previousOrderCount: lead?.orderCount || 0,
            previousSpend: lead?.totalSpend || 0,
            previousAgent: lastProcessedOrder?.processedBy || undefined,
            recentOrders: previousOrders.slice(0, 3).map(o => ({
                id: o.id,
                amount: o.amount,
                createdAt: o.createdAt,
                processedBy: o.processedBy?.name
            })),
            wasDeleted,
            wasClosed
        };
    }

    /**
     * Calculate priority score based on order value and customer history
     */
    private calculatePriorityScore(amount: number, history: CustomerHistory): number {
        let score = 50; // Base score

        // Order value component
        if (amount > 5000) score += 30;
        else if (amount > 1000) score += 20;
        else if (amount > 0) score += 10;

        // Customer history component
        if (history.isExistingCustomer) {
            if (history.previousSpend > 10000) score += 20; // VIP
            else if (history.previousSpend > 3000) score += 10; // Regular
        }

        // Returning customer bonus
        if (history.wasDeleted || history.wasClosed) {
            score += 15; // Win-back priority
        }

        return Math.min(score, 100); // Cap at 100
    }

    /**
     * Update lead with pending order information
     */
    private async updateLeadWithPendingOrder(
        leadId: string, 
        order: any, 
        history: CustomerHistory
    ): Promise<void> {
        // Find if conversation is assigned
        const conversation = await prisma.conversation.findUnique({
            where: { id: order.conversationId },
            select: { assignedToId: true }
        });
        const assignedToId = conversation?.assignedToId || null;

        await prisma.lead.update({
            where: { id: leadId },
            data: {
                pendingOrderState: assignedToId ? PendingOrderState.CLAIMED_FOR_APPROVAL : PendingOrderState.PENDING_APPROVAL,
                pendingOrderId: order.id,
                pendingOrderSummary: order.summary,
                pendingOrderAmount: order.amount,
                pendingOrderClaimedById: assignedToId,
                pendingOrderClaimedAt: assignedToId ? new Date() : null,
                // Update lead status if it was archived/deleted
                status: LeadStatus.NEW,
                lastActiveAt: new Date()
            }
        });

        // Dynamic CRM metrics recalculation
        await recalculateLeadCRM(leadId, order.companyId);
    }

    /**
     * Notify all eligible users about new order arrival
     */
    async notifyNewOrderArrival(
        companyId: string, 
        order: any, 
        history: CustomerHistory
    ): Promise<void> {
        // Find if conversation is assigned
        const conversation = await prisma.conversation.findUnique({
            where: { id: order.conversationId },
            select: { assignedToId: true }
        });
        const assignedToId = conversation?.assignedToId || null;

        // 1. Socket events for real-time updates
        if (assignedToId) {
            // Minimize websocket broadcasts: emit ONLY to the assigned agent!
            emitToAgent(assignedToId, "new_order_arrival", {
                orderId: order.id,
                leadId: order.leadId,
                conversationId: order.conversationId,
                summary: order.summary,
                amount: order.amount,
                priorityScore: order.priorityScore,
                customerHistory: {
                    isExistingCustomer: history.isExistingCustomer,
                    previousOrderCount: history.previousOrderCount,
                    previousSpend: history.previousSpend,
                    previousAgent: history.previousAgent,
                    wasDeleted: history.wasDeleted,
                    wasClosed: history.wasClosed
                },
                createdAt: order.createdAt
            });
        } else {
            // Only broadcast to everyone if still unassigned
            emitToCompany(companyId, "new_order_arrival", {
                orderId: order.id,
                leadId: order.leadId,
                conversationId: order.conversationId,
                summary: order.summary,
                amount: order.amount,
                priorityScore: order.priorityScore,
                customerHistory: {
                    isExistingCustomer: history.isExistingCustomer,
                    previousOrderCount: history.previousOrderCount,
                    previousSpend: history.previousSpend,
                    previousAgent: history.previousAgent,
                    wasDeleted: history.wasDeleted,
                    wasClosed: history.wasClosed
                },
                createdAt: order.createdAt
            });
        }

        const updatedLead = await prisma.lead.findUnique({
            where: { id: order.leadId },
            select: { totalSpend: true, orderCount: true, segment: true }
        });

        // 2. Lead update event
        emitToCompany(companyId, "lead_updated", {
            leadId: order.leadId,
            companyId,
            hasPendingOrderApproval: true,
            pendingOrderState: assignedToId ? "CLAIMED_FOR_APPROVAL" : "PENDING_APPROVAL",
            pendingOrderId: order.id,
            pendingOrderSummary: order.summary,
            pendingOrderAmount: order.amount,
            customerHistory: history,
            totalSpend: updatedLead?.totalSpend,
            orderCount: updatedLead?.orderCount,
            segment: updatedLead?.segment,
            isExistingCustomer: (updatedLead?.orderCount || 0) > 0,
            previousOrderCount: updatedLead?.orderCount,
            previousSpend: updatedLead?.totalSpend
        });

        // 3. Notifications to all eligible roles (only needed if NOT assigned)
        const customerType = history.isExistingCustomer ? "Returning Customer" : "New Customer";
        const previousAgentInfo = history.previousAgent ? ` (Previously handled by ${history.previousAgent.name})` : "";
        
        const title = "New Order Arrival";
        const body = `${customerType}: ${order.summary} - ₹${order.amount}${previousAgentInfo}`;

        if (assignedToId) {
            await notificationService.notifyUser(assignedToId, title, body, "ORDER");
        } else {
            await notificationService.notifyCompany(companyId, title, body, "ORDER");
        }
    }

    /**
     * Log order arrival for audit trail
     */
    private async logOrderArrival(orderId: string, history: CustomerHistory): Promise<void> {
        // This could be expanded to a dedicated audit log table
        console.log(`📝 [NewOrderArrival] Order ${orderId} logged - Customer type: ${history.isExistingCustomer ? 'Existing' : 'New'}`);
    }

    /**
     * Claim a new order arrival
     * Called when an agent claims an order from the New Order Arrivals queue
     */
    async claimOrderArrival(
        orderId: string, 
        agentId: string, 
        agentName: string,
        agentRole: string
    ): Promise<any> {
        // 1. First, perform atomic update to reserve the order
        const result = await prisma.order.updateMany({
            where: {
                id: orderId,
                status: OrderStatus.NEW,
                processedById: null
            },
            data: {
                processedById: agentId,
                updatedAt: new Date()
            }
        });

        if (result.count === 0) {
            // Find if already claimed by this agent:
            const checkOrder = await prisma.order.findUnique({
                where: { id: orderId },
                include: {
                    conversation: { include: { lead: true } },
                    processedBy: { select: { id: true, name: true } },
                    lead: true
                }
            });
            if (checkOrder && checkOrder.processedById === agentId) {
                // Return existing order for idempotency
                return checkOrder;
            }
            throw new Error("Order not found or already claimed by another agent");
        }

        // Get fully loaded order since atomic update was successful
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                conversation: { include: { lead: true } },
                lead: true
            }
        });

        if (!order) {
            throw new Error("Order not found");
        }

        // 2. Get customer history for notifications
        const customerHistory = await this.getCustomerHistory(order.companyId, order.leadId);

        // 3. Update order with any additional details/status
        const updatedOrder = await prisma.order.update({
            where: { id: orderId },
            data: {
                status: OrderStatus.NEW, // Keep as NEW until agent manually confirms
                updatedAt: new Date()
            },
            include: {
                conversation: { include: { lead: true } },
                processedBy: { select: { id: true, name: true } },
                lead: true
            }
        });

        // 4. Update lead with claim information
        await prisma.lead.update({
            where: { id: order.leadId },
            data: {
                pendingOrderState: PendingOrderState.CLAIMED_FOR_APPROVAL,
                pendingOrderClaimedById: agentId,
                pendingOrderClaimedAt: new Date()
            }
        });

        // 5. Assign conversation to the claiming agent
        await prisma.conversation.update({
            where: { id: order.conversationId },
            data: {
                assignedToId: agentId,
                status: ConversationStatus.ASSIGNED
            }
        });

        // 6. Notify about the claim
        await this.notifyOrderClaimed(updatedOrder, agentId, agentName, customerHistory);

        console.log(`✅ [NewOrderArrival] Order ${orderId} claimed by ${agentName}`);

        return updatedOrder;
    }

    /**
     * Notify about order claim
     */
    private async notifyOrderClaimed(
        order: any, 
        agentId: string, 
        agentName: string,
        history: CustomerHistory
    ): Promise<void> {
        // 1. Remove from public queue
        emitToCompany(order.companyId, "order_arrival_claimed", {
            orderId: order.id,
            conversationId: order.conversationId,
            claimedBy: { id: agentId, name: agentName }
        });

        // 2. Add to claiming agent's conversation list
        emitToAgent(agentId, "conversation_added", {
            id: order.conversation.id,
            mode: order.conversation.mode,
            lead: order.conversation.lead,
            lastMessage: `Order claimed: ${order.summary}`,
            updatedAt: new Date(),
            assignedTo: { id: agentId, name: agentName }
        });

        // 3. Lead update
        emitToCompany(order.companyId, "lead_updated", {
            leadId: order.leadId,
            companyId: order.companyId,
            hasPendingOrderApproval: true,
            pendingOrderState: "CLAIMED_FOR_APPROVAL",
            pendingOrderClaimedById: agentId,
            pendingOrderClaimedAt: new Date(),
            agentAssigned: agentName,
            customerHistory: history
        });

        // 4. Notification to claiming agent
        await notificationService.notifyUser(
            agentId,
            "Order Claimed",
            `You have claimed order for ${order.lead.name || order.lead.contact}: ${order.summary}`,
            "ORDER"
        );
    }
}

export const newOrderArrivalService = new NewOrderArrivalService();
