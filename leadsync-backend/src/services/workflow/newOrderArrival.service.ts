import { createTenantRepository } from "../../lib/tenantDb";
import { 
    OrderStatus, 
    OrderPriority, 
    OrderSource, 
    LeadStatus,
} from "@prisma/client";
import { emitToCompany, emitToCompanyAdmin, emitToAgent, safeEmitConversationUpdate } from "../../lib/socket";
import { notificationService } from "../../services/infrastructure/notification.service";
import { eventBus, Events } from "../../services/infrastructure/eventBus";
import { recalculateLeadCRM } from "../integrations/crm.service";
import { AnalyticsRollupService } from "../analytics/analyticsRollup.service";

/**
 * Unified New Order Intake / Allocation Service
 */

export interface NewOrderArrivalData {
    companyId: string;
    conversationId: string;
    leadId: string;
    summary: string;
    amount: number;
    totalCogs?: number;
    netProfit?: number;
    items?: any[];
    source?: OrderSource;
    priority?: OrderPriority;
    status?: OrderStatus;
}

export interface CustomerHistory {
    isExistingCustomer: boolean;
    previousOrderCount: number;
    previousSpend: number;
    previousAgent?: { id: string; firstName: string; lastName?: string };
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
        const { companyId, conversationId, leadId, summary, amount, totalCogs = 0, netProfit = 0, items, source, priority, status } = data;

        console.log(`🆕 [NewOrderArrival] Processing new order arrival for lead ${leadId} in tenant ${companyId}`);

        const tenantDb = createTenantRepository(companyId);

        // 1. Get customer history for context
        const customerHistory = await this.getCustomerHistory(companyId, leadId);

        const initialStatus = status || OrderStatus.NEW;

        // NOTE (2026-06-30): The stale dynamic import of workflow/assignment.service.ts
        // was removed (see that file's deprecation header). That service always
        // returned null in production because Company.assignmentStrategy never
        // existed in the DB, so this removal does not change any runtime behaviour.
        // Live auto-assignment is handled by ai.orchestrator.worker.ts via
        // src/services/assignment.service.ts writing claimedById / claimedByName.
        const conversation = await tenantDb.conversation.findUnique({
            where: { id: conversationId },
            select: { claimedById: true }
        });
        const assignedToId = conversation?.claimedById || null;

        // 2. Create the order and items in a transaction using tenantDb.$transaction
        const order = await tenantDb.$transaction(async (txDb) => {
            const newOrder = await txDb.order.create({
                data: {
                    conversationId,
                    leadId,
                    summary,
                    amount,
                    totalCogs,
                    netProfit,
                    orderItems: items && items.length > 0 ? {
                        create: items.map((item: any) => ({
                            companyId,
                            name: item.name || "Unknown Item",
                            quantity: item.quantity || 1,
                            price: item.price || 0,
                            sku: item.sku || null,
                            productId: item.productId || null
                        }))
                    } : undefined,
                    status: initialStatus,
                    source: source || OrderSource.BOT_DETECTED,
                    priority: priority || (amount > 0 ? OrderPriority.URGENT : OrderPriority.NORMAL),
                    priorityScore: await this.calculatePriorityScore(amount, companyId, customerHistory),
                    predictedValue: amount,
                    isUrgent: amount > 0,
                    processedById: assignedToId,
                },
                include: {
                    lead: true
                }
            });

            // Create relational Order Items (The "Master Catalog" link)
            if (items && Array.isArray(items)) {
                const itemRecords = items.map(item => ({
                    orderId: newOrder.id,
                    companyId: companyId,
                    productId: item.productId || null,
                    sku: item.sku || null,
                    name: item.name,
                    quantity: Number(item.quantity) || 1,
                    price: Number(item.price) || 0,
                    cogs: item.cogs !== undefined && item.cogs !== null ? Number(item.cogs) : null,
                }));

                await txDb.orderItem.createMany({
                    data: itemRecords
                });
            }

            return newOrder;
        });

        // 3. Update lead with pending order state (only for confirmed orders)
        // pendingOrder fields removed from schema - skip this step
        // 4. Create New Order Arrival notification and socket events (only for confirmed orders)
        if (initialStatus !== OrderStatus.BOT_CREATED_ORDER) {
            await this.notifyNewOrderArrival(companyId, order, customerHistory);
        }

        // 5. Log the arrival for audit
        await this.logOrderArrival(order.id, customerHistory);

        // 6. Out-of-band Analytics offloading
        // This shields the core transactional system from computing analytics math inline
        AnalyticsRollupService.incrementMerchantKPIs(companyId, {
            revenueDelta: amount,
            orderDelta: 1,
            leadDelta: customerHistory && customerHistory.isExistingCustomer ? 0 : 1
        }).catch(err => console.error("💥 [AnalyticsRollup] Failed to increment metrics:", err));

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
        const tenantDb = createTenantRepository(companyId);

        // 1. Fetch all leads in batch
        const leads = await tenantDb.lead.findMany({
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
        const allPreviousOrders = await tenantDb.order.findMany({
            where: {
                leadId: { in: uniqueLeadIds },
                isDeleted: false,
                status: { notIn: ["BOT_CREATED_ORDER", "REJECTED", "CANCELLED"] }
            },
            include: {
                processedBy: { select: { id: true, firstName: true, lastName: true } }
            },
            orderBy: { createdAt: "desc" }
        });

        // 3. Fetch all last processed orders in batch
        const allLastProcessedOrders = await tenantDb.order.findMany({
            where: {
                leadId: { in: uniqueLeadIds },
                isDeleted: false,
                processedById: { not: null }
            },
            include: {
                processedBy: { select: { id: true, firstName: true, lastName: true } }
            },
            orderBy: { createdAt: "desc" }
        });

        const leadMap = new Map(leads.map((l: any) => [l.id, l]));
        
        // Group previous orders by leadId
        const previousOrdersMap = new Map<string, typeof allPreviousOrders>();
        allPreviousOrders.forEach((o: any) => {
            if (!previousOrdersMap.has(o.leadId)) {
                previousOrdersMap.set(o.leadId, []);
            }
            previousOrdersMap.get(o.leadId)!.push(o);
        });

        // Group last processed orders by leadId
        const lastProcessedMap = new Map<string, typeof allLastProcessedOrders[0]>();
        allLastProcessedOrders.forEach((o: any) => {
            if (!lastProcessedMap.has(o.leadId)) {
                lastProcessedMap.set(o.leadId, o);
            }
        });

        const result: Record<string, CustomerHistory> = {};

        for (const leadId of uniqueLeadIds) {
            const lead: any = leadMap.get(leadId);
            const prevOrders = previousOrdersMap.get(leadId) || [];
            const lastProc: any = lastProcessedMap.get(leadId);

            const isExistingCustomer = (lead?.orderCount || 0) > 0;
            const wasDeleted = !!lead?.deletedAt;
            const wasClosed = lead?.status === LeadStatus.ARCHIVED;

            result[leadId] = {
                isExistingCustomer,
                previousOrderCount: lead?.orderCount || 0,
                previousSpend: lead?.totalSpend || 0,
                previousAgent: lastProc?.processedBy || undefined,
                recentOrders: prevOrders.slice(0, 3).map((o: any) => ({
                    id: o.id,
                    amount: o.amount,
                    createdAt: o.createdAt,
                    processedBy: o.processedBy ? `${o.processedBy.firstName} ${o.processedBy.lastName || ""}`.trim() : undefined
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
        const tenantDb = createTenantRepository(companyId);

        const [lead, previousOrders, lastProcessedOrder] = await Promise.all([
            tenantDb.lead.findUnique({
                where: { id: leadId },
                select: { 
                    totalSpend: true, 
                    orderCount: true, 
                    status: true,
                    deletedAt: true
                }
            }),
            tenantDb.order.findMany({
                where: { 
                    leadId, 
                    isDeleted: false,
                    status: { notIn: ["BOT_CREATED_ORDER", "REJECTED", "CANCELLED"] }
                },
                include: {
                    processedBy: { select: { id: true, firstName: true, lastName: true } }
                },
                orderBy: { createdAt: "desc" },
                take: 5
            }),
            tenantDb.order.findFirst({
                where: { 
                    leadId, 
                    isDeleted: false,
                    processedById: { not: null }
                },
                include: {
                    processedBy: { select: { id: true, firstName: true, lastName: true } }
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
            recentOrders: previousOrders.slice(0, 3).map((o: any) => ({
                id: o.id,
                amount: o.amount,
                createdAt: o.createdAt,
                processedBy: o.processedBy ? `${o.processedBy.firstName} ${o.processedBy.lastName || ""}`.trim() : undefined
            })),
            wasDeleted,
            wasClosed
        };
    }

    /**
     * Calculate priority score based on order value and customer history
     * Phase 3 Formula: (Order Amount * 0.5) + (Customer Lifetime Value * 0.3) + (Urgency Multiplier)
     */
    private async calculatePriorityScore(amount: number, companyId: string, history: CustomerHistory): Promise<number> {
        // We apply a scaling factor (e.g. 0.01) to order amounts to normalize rupees into a 0-100 score
        const scaledAmount = amount * 0.01;
        const scaledLtv = history.previousSpend * 0.01;
        
        let score = (scaledAmount * 0.5) + (scaledLtv * 0.3);

        const tenantDb = createTenantRepository(companyId);
        const company = await tenantDb.company.findUnique({
            where: { id: companyId },
            include: { botConfiguration: true }
        });

        // Urgency Multiplier - e.g., Returning or VIP gets an instant urgency bump
        let urgencyMultiplier = 0;
        if (history.wasDeleted || history.wasClosed) {
            urgencyMultiplier = 15; // Win-back urgency
        } else if (history.isExistingCustomer) {
            urgencyMultiplier = 10; // VIP urgency
        } else if (amount > 1000) {
            urgencyMultiplier = 20; // High Value New Customer
        } else if (amount > 0) {
             urgencyMultiplier = 5;
        }

        score += urgencyMultiplier;

        // Ensure minimum base score of 10 and max of 100
        return Math.max(10, Math.min(Math.round(score), 100)); // Cap at 100
    }

    /**
     * Update lead with pending order information
     * Note: pendingOrder fields removed from schema - this method is no longer called
     */
    private async updateLeadWithPendingOrder(
        companyId: string,
        leadId: string, 
        order: any, 
        history: CustomerHistory
    ): Promise<void> {
        const tenantDb = createTenantRepository(companyId);

        // Find if conversation is assigned
        const conversation = await tenantDb.conversation.findUnique({
            where: { id: order.conversationId },
            select: { claimedById: true }
        });

        await tenantDb.lead.update({
            where: { id: leadId },
            data: {
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
        const tenantDb = createTenantRepository(companyId);

        // Find if conversation is assigned
        const conversation = await tenantDb.conversation.findUnique({
            where: { id: order.conversationId },
            select: { claimedById: true }
        });
        const assignedToId = conversation?.claimedById || null;

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

        const updatedLead = await tenantDb.lead.findUnique({
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
        const previousAgentInfo = history.previousAgent ? ` (Previously handled by ${history.previousAgent.firstName} ${history.previousAgent.lastName || ""})`.trim() : "";
        
        const companyData = await tenantDb.company.findUnique({
            where: { id: companyId },
            select: { currencySymbol: true } as any
        });
        const currency = (companyData as any)?.currencySymbol || "$";

        const title = "New Order Arrival";
        const body = `${customerType}: ${order.summary} - ${currency}${order.amount}${previousAgentInfo}`;

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
        console.log(`📝 [NewOrderArrival] Order ${orderId} logged - Customer type: ${history.isExistingCustomer ? 'Existing' : 'New'}`);
    }

    /**
     * Claim a new order arrival
     * Called when an agent claims an order from the New Order Arrivals queue
     */
    async claimOrderArrival(
        companyId: string,
        orderId: string, 
        agentId: string, 
        agentName: string,
        agentRole: string
    ): Promise<any> {
        const tenantDb = createTenantRepository(companyId);

        // 1. First, perform atomic update to reserve the order
        const result = await tenantDb.order.updateMany({
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
            const checkOrder = await tenantDb.order.findUnique({
                where: { id: orderId },
                include: {
                    processedBy: { select: { id: true, firstName: true, lastName: true } },
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
        const order = await tenantDb.order.findUnique({
            where: { id: orderId },
            include: {
                lead: true
            }
        });

        if (!order) {
            throw new Error("Order not found");
        }

        // 2. Get customer history for notifications
        const customerHistory = await this.getCustomerHistory(order.companyId, order.leadId);

        // 3. Update order with any additional details/status
        const updatedOrder = await tenantDb.order.update({
            where: { id: orderId },
            data: {
                status: OrderStatus.NEW, // Keep as NEW until agent manually confirms
                updatedAt: new Date()
            },
            include: {
                processedBy: { select: { id: true, firstName: true, lastName: true } },
                lead: true
            }
        });

        // 4. Update lead with claim information (pendingOrder fields removed from schema)
        await tenantDb.lead.update({
            where: { id: order.leadId },
            data: {
                lastActiveAt: new Date()
            }
        });

        // 5. Assign conversation to the claiming agent
        await tenantDb.conversation.update({
            where: { id: order.conversationId },
            data: {
                claimedById: agentId,
                status: "open"
            }
        });

        // 6. Notify about the claim
        await this.notifyOrderClaimed(companyId, updatedOrder, agentId, agentName, customerHistory);

        // 🚀 FIRE IMMUTABLE EVENT TO MICROSERVICES (Now that it's claimed/confirmed)
        eventBus.emit(Events.ORDER_CREATED, updatedOrder.id, updatedOrder.companyId);

        console.log(`✅ [NewOrderArrival] Order ${orderId} claimed by ${agentName}`);

        return updatedOrder;
    }

    /**
     * Notify about order claim
     */
    private async notifyOrderClaimed(
        companyId: string,
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