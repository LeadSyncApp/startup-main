import { createTenantRepository } from "../../lib/tenantDb";
import { prisma } from "../../lib/prisma";
import { OrderStatus, OrderApprovalStatus } from "@prisma/client";
import { safeEmitConversationUpdate, emitToCompany } from "../../lib/socket";
import { notificationService } from "../infrastructure/notification.service";
import { customerMessagingService } from "../messaging/customerMessaging.service";
import { cacheService } from "../infrastructure/cache.service";
import { recalculateLeadCRM } from "../integrations/crm.service";
import { eventBus, Events } from "../../services/infrastructure/eventBus";
import { conversationalAutoReplyService } from "../automation/conversationalAutoReply.service";
import { ORDER_EVENT_PREFIX } from "../automation/conversationalRule.constants";

/**
 * Strict Rank for Forward-Only Lifecycle
 */
const STATUS_RANK: Record<OrderStatus, number> = {
    [OrderStatus.BOT_CREATED_ORDER]: 0,
    [OrderStatus.USER_CONFIRMED_PENDING_AGENT]: 1,
    [OrderStatus.PENDING]: 2,
    [OrderStatus.NEW]: 2,
    [OrderStatus.CONFIRMED]: 3,
    [OrderStatus.PAID]: 4,
    [OrderStatus.PROCESSING]: 5,
    [OrderStatus.PREPARING]: 6,
    [OrderStatus.READY]: 7,
    [OrderStatus.SHIPPED]: 8,
    [OrderStatus.DELIVERED]: 9,
    [OrderStatus.COMPLETED]: 10,
    [OrderStatus.CANCELLED]: 11,
    [OrderStatus.REJECTED]: 11,
    [OrderStatus.ARCHIVED]: 12,
};

/**
 * Strict State Machine for Order Processing
 */
export class OrderWorkflowService {

    /**
     * Attempts to transition an order to a new status.
     * Enforces strict workflow rules and audit logging.
     * Uses Optimistic Locking (version check) to prevent race conditions.
     */
    async transitionStatus(
        companyId: string,
        orderId: string,
        newStatus: OrderStatus,
        actor: { id: string; name: string; role: string },
        expectedVersion?: number // CRITICAL: This must come from the UI's current state
    ) {
        const tenantDb = createTenantRepository(companyId);

        // 1. Fetch Current State (Fresh from DB)
        const order = await tenantDb.order.findUnique({
            where: { id: orderId },
            include: { conversation: true, lead: true }
        }) as any;

        if (!order) throw new Error("Order not found");

        const oldStatus = order.status;

        // 2. STRICTOR VALIDATION
        // a) Skip if no change (Prevent repetitive notifications)
        if (newStatus === oldStatus) {
            return { order, log: null };
        }

        // b) Prevent Regression (Ranking check)
        if (STATUS_RANK[newStatus as OrderStatus] < STATUS_RANK[oldStatus as OrderStatus]) {
            throw new Error(`STATE_REGRESSION: Cannot move order from ${oldStatus} back to ${newStatus}. Transition rejected.`);
        }

        // b) Business Logic Transition check
        this.validateTransition(oldStatus, newStatus, actor.role);

        // c) SME Fulfillment Optimization: No automatic jump, Frontend handles UI grouping
        
        // 3. Perform Update with Optimistic Locking
        // If version is provided, we check it. If not, we just update (force).
        // For critical "Accept" actions, version MUST be provided.
        const whereClause: any = { id: orderId };
        if (expectedVersion) {
            whereClause.version = expectedVersion;
        }

        const nextVersion = order.version + 1;

        // Transaction: Update Order + Create Log
        // Note: Prisma interactive transactions ($transaction) are run through tenantDb.$transaction
        try {
            console.log(`[OrderWorkflow] Attempting transition from ${oldStatus} to ${newStatus} for order ${orderId} in company ${companyId}`);
            
            const [updatedOrderResult, log] = await tenantDb.$transaction(async (txDb) => {
                const updated = await txDb.order.update({
                    where: whereClause,
                    data: {
                        status: newStatus,
                        version: nextVersion,
                        processedById: (actor.id === 'SYSTEM' || actor.role === 'SYSTEM') ? null : actor.id,
                        completedAt: ['DELIVERED', 'COMPLETED', 'CANCELLED', 'REJECTED', 'SHIPPED'].includes(newStatus)
                            ? new Date()
                            : (oldStatus === OrderStatus.BOT_CREATED_ORDER ? null : order.completedAt),
                        approvalStatus: newStatus === OrderStatus.CONFIRMED ? OrderApprovalStatus.APPROVED
                            : newStatus === OrderStatus.REJECTED ? OrderApprovalStatus.REJECTED
                                : order.approvalStatus
                    }
                });

                const createdLog = await txDb.orderLog.create({
                    data: {
                        orderId,
                        actorId: actor.id,
                        actorName: actor.name,
                        actorRole: actor.role,
                        action: "STATUS_CHANGE",
                        metadata: { from: oldStatus, to: newStatus, version: nextVersion },
                    }
                });

                return [updated, createdLog];
            });
            
            console.log(`[OrderWorkflow] Successfully transitioned order ${orderId} to ${newStatus}`);

            const isNoLongerPending = [
                OrderStatus.PROCESSING,
                OrderStatus.CONFIRMED,
                OrderStatus.PAID,
                OrderStatus.CANCELLED,
                OrderStatus.REJECTED,
                OrderStatus.COMPLETED,
                OrderStatus.DELIVERED
            ].includes(newStatus as any);

            if (isNoLongerPending) {
                const currentLead = await tenantDb.lead.findFirst({
                    where: { id: order.leadId, deletedAt: null },
                    select: { pendingOrderId: true }
                });
                if (currentLead && currentLead.pendingOrderId === orderId) {
                    await tenantDb.lead.update({
                        where: { id: order.leadId },
                        data: {
                            pendingOrderState: "NONE",
                            pendingOrderId: null,
                            pendingOrderClaimedById: null,
                            pendingOrderClaimedAt: null,
                            pendingOrderSummary: null,
                            pendingOrderAmount: null
                        }
                    });
                    console.log(`🧹 [OrderWorkflow] Cleared pending order state on lead ${order.leadId} because order ${orderId} transitioned to ${newStatus}`);
                }
            }

            // Central recalculation of Lead CRM metrics on status transitions
            await recalculateLeadCRM(order.leadId, order.companyId);

            // ⛔ CLEAR ORDERING INTENT and SESSION STATE for completed orders
            if (['DELIVERED', 'COMPLETED', 'CANCELLED', 'REJECTED'].includes(newStatus)) {
                
                // Invalidate KPI Cache
                await tenantDb.company.findUnique({ where: { id: order.companyId }, select: { id: true } })
                    .then(async (company: any) => {
                        if (company) {
                            await cacheService.delete(`dashboard_kpis_${company.id}`);
                        }
                    });

                await tenantDb.conversation.update({
                    where: { id: order.conversationId },
                    data: { 
                        intent: null,
                        sessionState: undefined // Clear AI cart session state
                    }
                });
                console.log(`🧹 [OrderWorkflow] Cleared intent and session state for completed order in Conv ${order.conversationId}`);
            }

            // ⛔ STRICT PERSISTENCE: Re-fetch fresh state to ensure no race conditions
            const updatedOrder = await tenantDb.order.findUnique({
                where: { id: orderId },
                include: {
                    conversation: { include: { lead: true } },
                    lead: true,
                    processedBy: { select: { id: true, firstName: true, lastName: true } },
                    invoice: { select: { id: true, invoiceNumber: true, pdfUrl: true } }
                }
            });

            if (!updatedOrder) throw new Error("Order lost after update");

            // 4. Emit Events & Notifications
            this.handlePostTransition(companyId, updatedOrder, oldStatus, newStatus, actor);

            return { order: updatedOrder, log };

        } catch (error: any) {
            if (error.code === 'P2025' || error.message.includes('Record to update not found')) {
                throw new Error("CONCURRENCY_CONFLICT: Order was modified by another agent. Please refresh.");
            }
            throw error;
        }
    }

    /**
     * Validates if a transition is allowed based on the current state.
     */
    private validateTransition(current: OrderStatus, next: OrderStatus, role: string) {
        const validTransitions: Record<string, OrderStatus[]> = {
            [OrderStatus.PENDING]: [OrderStatus.PROCESSING, OrderStatus.READY, OrderStatus.CANCELLED, OrderStatus.PAID],
            [OrderStatus.PROCESSING]: [OrderStatus.READY, OrderStatus.COMPLETED, OrderStatus.CANCELLED, OrderStatus.PAID],

            // Legacy support mapping to avoid breaking existing orders in other states
            [OrderStatus.BOT_CREATED_ORDER]: [OrderStatus.PENDING, OrderStatus.PROCESSING, OrderStatus.READY, OrderStatus.CANCELLED, OrderStatus.PAID],
            [OrderStatus.USER_CONFIRMED_PENDING_AGENT]: [OrderStatus.PENDING, OrderStatus.PROCESSING, OrderStatus.READY, OrderStatus.CANCELLED, OrderStatus.PAID],
            [OrderStatus.NEW]: [OrderStatus.PENDING, OrderStatus.PROCESSING, OrderStatus.READY, OrderStatus.CANCELLED, OrderStatus.PAID],
            [OrderStatus.CONFIRMED]: [OrderStatus.READY, OrderStatus.PROCESSING, OrderStatus.COMPLETED, OrderStatus.CANCELLED, OrderStatus.PAID],
            [OrderStatus.PAID]: [OrderStatus.READY, OrderStatus.PROCESSING, OrderStatus.COMPLETED, OrderStatus.CANCELLED],
            [OrderStatus.PREPARING]: [OrderStatus.READY, OrderStatus.COMPLETED, OrderStatus.CANCELLED],
            [OrderStatus.READY]: [OrderStatus.SHIPPED, OrderStatus.COMPLETED, OrderStatus.CANCELLED],
            [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED, OrderStatus.COMPLETED, OrderStatus.CANCELLED],
            [OrderStatus.DELIVERED]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
        };

        const allowed = validTransitions[current] || [];
        if (!allowed.includes(next)) {
            // Owner/Admin/System overrides as final safeguard
            if (role === 'OWNER' || role === 'ADMIN' || role === 'SYSTEM') return true;
            throw new Error(`Invalid transition from ${current} to ${next}`);
        }
    }

    /**
     * Handles side effects (Notifications, Socket Events)
     */
    private async handlePostTransition(companyId: string, order: any, old: string, next: string, actor: any) {

        // 1. Emit to Socket (UI Update)
        emitToCompany(companyId, "order_updated", order);

        // Conversation Update (Chat View)
        safeEmitConversationUpdate(order.conversation, "order_updated", order);

        const isNoLongerPending = [
            OrderStatus.PROCESSING,
            OrderStatus.CONFIRMED,
            OrderStatus.PAID,
            OrderStatus.CANCELLED,
            OrderStatus.REJECTED,
            OrderStatus.COMPLETED,
            OrderStatus.DELIVERED
        ].includes(next as any);

        if (isNoLongerPending) {
            emitToCompany(companyId, "lead_updated", {
                leadId: order.leadId,
                companyId,
                hasPendingOrderApproval: false,
                pendingOrderState: "NONE",
                pendingOrderId: null,
                pendingOrderClaimedById: null,
                pendingOrderClaimedAt: null,
                pendingOrderSummary: null,
                pendingOrderAmount: null
            });
        }

        // 2. Notify ALL Company Users (Admins + Agents)
        if (next === OrderStatus.PENDING || next === OrderStatus.NEW) {
            await notificationService.notifyCompany(
                companyId,
                "New Order detected",
                `Value: ${order.amount} - ${order.summary}`,
                "ORDER"
            );
        }

        // 3. Emit ORDER_STATUS_CHANGED (kept for external consumers)
        eventBus.emit(Events.ORDER_STATUS_CHANGED, order.id, companyId);

        // Fire EVENT-type ConversationalRules whose eventConfig.eventName matches.
        // eventName mirrors the old AutoReplyRule event keys, using the shared
        // ORDER_EVENT_PREFIX so emit + matcher catalog can never drift.
        const eventName = `${ORDER_EVENT_PREFIX}${String(next).toLowerCase()}`;
        const conv = order.conversation;
        if (conv?.leadId) {
          const lead = await prisma.lead.findFirst({ where: { id: conv.leadId, deletedAt: null } });
          if (lead) {
            conversationalAutoReplyService.fireEventRules(eventName, {
              companyId,
              conversationId: conv.id,
              leadId: lead.id,
              messageText: "",
              customerName: lead.name || undefined,
              customerSegment: lead.segment,
              customerLanguage: lead.preferredLanguage || undefined,
              channel: conv.channel as any,
              contact: lead.contact,
              orderId: order.id.slice(0, 8),
            }).catch((err) => console.error(`[OrderWorkflow] EVENT rule fire failed:`, err.message));
          }
        }
    }
}

export const orderWorkflowService = new OrderWorkflowService();
