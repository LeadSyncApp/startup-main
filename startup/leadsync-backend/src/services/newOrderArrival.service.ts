import { prisma } from "../lib/prisma";
import { Prisma, 
    OrderStatus, 
    OrderPriority, 
    OrderSource, 
    PendingOrderState,
    LeadStatus,
    ConversationStatus
} from "@prisma/client";
import { emitToCompany, emitToCompanyAdmin, emitToAgent, safeEmitConversationUpdate } from "../lib/socket";
import { notificationService } from "./notification.service";

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
        const { companyId, conversationId, leadId, summary, amount, items, source, priority } = data;

        console.log(`🆕 [NewOrderArrival] Processing new order arrival for lead ${leadId}`);

        // 1. Get customer history for context
        const customerHistory = await this.getCustomerHistory(companyId, leadId);

        // 2. Create the order in NEW state (not BOT_CREATED_ORDER)
        const order = await prisma.order.create({
            data: {
                companyId,
                conversationId,
                leadId,
                summary,
                amount,
                items: items ?? undefined,
                status: OrderStatus.NEW, // Start as NEW for intake queue
                source: source || OrderSource.BOT_DETECTED,
                priority: priority || (amount > 0 ? OrderPriority.URGENT : OrderPriority.NORMAL),
                priorityScore: this.calculatePriorityScore(amount, customerHistory),
                predictedValue: amount,
                isUrgent: amount > 0,
            },
            include: {
                conversation: {
                    include: { lead: true }
                },
                lead: true
            }
        });

        // 3. Update lead with pending order state
        await this.updateLeadWithPendingOrder(leadId, order, customerHistory);

        // 4. Create New Order Arrival notification and socket events
        await this.notifyNewOrderArrival(companyId, order, customerHistory);

        // 5. Log the arrival for audit
        await this.logOrderArrival(order.id, customerHistory);

        console.log(`✅ [NewOrderArrival] Order ${order.id} queued for claim - Customer: ${customerHistory.isExistingCustomer ? 'Existing' : 'New'}`);

        return {
            order,
            customerHistory,
            requiresClaim: true
        };
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
        await prisma.lead.update({
            where: { id: leadId },
            data: {
                pendingOrderState: PendingOrderState.PENDING_APPROVAL,
                pendingOrderId: order.id,
                pendingOrderSummary: order.summary,
                pendingOrderAmount: order.amount,
                // Don't auto-assign - keep unclaimed for intake queue
                pendingOrderClaimedById: null,
                pendingOrderClaimedAt: null,
                // Update lead status if it was archived/deleted
                status: LeadStatus.NEW,
                lastActiveAt: new Date()
            }
        });
    }

    /**
     * Notify all eligible users about new order arrival
     */
    private async notifyNewOrderArrival(
        companyId: string, 
        order: any, 
        history: CustomerHistory
    ): Promise<void> {
        // 1. Socket events for real-time updates
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

        // 2. Lead update event
        emitToCompany(companyId, "lead_updated", {
            leadId: order.leadId,
            companyId,
            hasPendingOrderApproval: true,
            pendingOrderState: "PENDING_APPROVAL",
            pendingOrderId: order.id,
            pendingOrderSummary: order.summary,
            pendingOrderAmount: order.amount,
            customerHistory: history
        });

        // 3. Notifications to all eligible roles
        const customerType = history.isExistingCustomer ? "Returning Customer" : "New Customer";
        const previousAgentInfo = history.previousAgent ? ` (Previously handled by ${history.previousAgent.name})` : "";
        
        const title = "New Order Arrival";
        const body = `${customerType}: ${order.summary} - ₹${order.amount}${previousAgentInfo}`;

        await notificationService.notifyCompany(companyId, title, body, "ORDER");
        await notificationService.notifyCompanyAdmins(companyId, title, body, "ORDER");
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
        // 1. Get the order and verify it's claimable
        const order = await prisma.order.findFirst({
            where: {
                id: orderId,
                status: OrderStatus.NEW, // Only NEW orders can be claimed
                processedById: null // Must be unclaimed
            },
            include: {
                conversation: { include: { lead: true } },
                lead: true
            }
        });

        if (!order) {
            throw new Error("Order not found or already claimed");
        }

        // 2. Get customer history for notifications
        const customerHistory = await this.getCustomerHistory(order.companyId, order.leadId);

        // 3. Update order with claim information
        const updatedOrder = await prisma.order.update({
            where: { id: orderId },
            data: {
                processedById: agentId,
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
