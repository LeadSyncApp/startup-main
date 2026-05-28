import { prisma } from "../../lib/prisma";
import { OrderStatus, OrderApprovalStatus, OrderLog } from "@prisma/client";
import { safeEmitConversationUpdate, emitToCompany, emitToCompanyAdmin } from "../../lib/socket";
import { notificationService } from "../infrastructure/notification.service";
import { customerMessagingService } from "../messaging/customerMessaging.service";
import { cacheService } from "../infrastructure/cache.service";
import { recalculateLeadCRM } from "../integrations/crm.service";

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
        orderId: string,
        newStatus: OrderStatus,
        actor: { id: string; name: string; role: string },
        expectedVersion?: number // CRITICAL: This must come from the UI's current state
    ) {
        // 1. Fetch Current State (Fresh from DB)
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { conversation: true, lead: true }
        });

        if (!order) throw new Error("Order not found");

        const oldStatus = order.status;

        // 2. STRICTOR VALIDATION
        // a) Skip if no change (Prevent repetitive notifications)
        if (newStatus === oldStatus) {
            return { order, log: null };
        }

        // b) Prevent Regression (Ranking check)
        if (STATUS_RANK[newStatus] < STATUS_RANK[oldStatus]) {
            throw new Error(`STATE_REGRESSION: Cannot move order from ${oldStatus} back to ${newStatus}. Transition rejected.`);
        }

        // b) Business Logic Transition check
        this.validateTransition(oldStatus, newStatus, actor.role);

        // 3. Perform Update with Optimistic Locking
        // If version is provided, we check it. If not, we just update (force).
        // For critical "Accept" actions, version MUST be provided.
        const whereClause: any = { id: orderId };
        if (expectedVersion) {
            whereClause.version = expectedVersion;
        }

        const nextVersion = order.version + 1;

        // Transaction: Update Order + Create Log
        // Note: Prisma interactive transactions ($transaction) are best here.
        try {
            console.log(`[OrderWorkflow] Attempting transition from ${oldStatus} to ${newStatus} for order ${orderId}`);
            
            const [_, log] = await prisma.$transaction([
                // Update Order
                prisma.order.update({
                    where: whereClause,
                    data: {
                        status: newStatus,
                        version: nextVersion,
                        processedById: actor.id,
                        completedAt: ['DELIVERED', 'COMPLETED', 'CANCELLED', 'REJECTED', 'SHIPPED'].includes(newStatus)
                            ? new Date()
                            : (oldStatus === OrderStatus.BOT_CREATED_ORDER ? null : order.completedAt),
                        approvalStatus: newStatus === OrderStatus.CONFIRMED ? OrderApprovalStatus.APPROVED
                            : newStatus === OrderStatus.REJECTED ? OrderApprovalStatus.REJECTED
                                : order.approvalStatus
                    }
                }),
                // Create Audit Log
                prisma.orderLog.create({
                    data: {
                        orderId,
                        actorId: actor.id,
                        actorName: actor.name,
                        actorRole: actor.role,
                        action: "STATUS_CHANGE",
                        metadata: { from: oldStatus, to: newStatus, version: nextVersion },
                    }
                })
            ]);
            
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
                const currentLead = await prisma.lead.findUnique({
                    where: { id: order.leadId },
                    select: { pendingOrderId: true }
                });
                if (currentLead && currentLead.pendingOrderId === orderId) {
                    await prisma.lead.update({
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

            // Central recalculation of Lead CRM metrics on status transitions (confirmed, paid, completed, cancelled, rejected)
            await recalculateLeadCRM(order.leadId, order.companyId);

            // ⛔ CLEAR ORDERING INTENT and SESSION STATE for completed orders
            if (['DELIVERED', 'COMPLETED', 'CANCELLED', 'REJECTED'].includes(newStatus)) {
                
                // Invalidate KPI Cache
                await prisma.company.findUnique({ where: { id: order.companyId }, select: { id: true } })
                    .then(company => {
                        if (company) {
                            cacheService.delete(`dashboard_kpis_${company.id}`);
                        }
                    });

                await prisma.conversation.update({
                    where: { id: order.conversationId },
                    data: { 
                        intent: null,
                        sessionState: undefined // Clear AI cart session state
                    }
                });
                console.log(`🧹 [OrderWorkflow] Cleared intent and session state for completed order in Conv ${order.conversationId}`);
            }

            // ⛔ STRICT PERSISTENCE: Re-fetch fresh state to ensure no race conditions
            const updatedOrder = await prisma.order.findUnique({
                where: { id: orderId },
                include: {
                    conversation: { include: { lead: true } },
                    lead: true,
                    processedBy: { select: { id: true, name: true } },
                    invoice: { select: { id: true, invoiceNumber: true, pdfUrl: true } }
                }
            });

            if (!updatedOrder) throw new Error("Order lost after update");

            // 4. Emit Events & Notifications
            this.handlePostTransition(updatedOrder, oldStatus, newStatus, actor);

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
        // Enforce simplified SME-friendly workflow transitions
        // Valid transitions:
        // PENDING -> PROCESSING, PENDING -> CANCELLED
        // PROCESSING -> COMPLETED, PROCESSING -> CANCELLED
        const validTransitions: Record<string, OrderStatus[]> = {
            [OrderStatus.PENDING]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
            [OrderStatus.PROCESSING]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],

            // Legacy support mapping to avoid breaking existing orders in other states
            [OrderStatus.BOT_CREATED_ORDER]: [OrderStatus.PENDING, OrderStatus.PROCESSING, OrderStatus.CANCELLED],
            [OrderStatus.USER_CONFIRMED_PENDING_AGENT]: [OrderStatus.PENDING, OrderStatus.PROCESSING, OrderStatus.CANCELLED],
            [OrderStatus.NEW]: [OrderStatus.PENDING, OrderStatus.PROCESSING, OrderStatus.CANCELLED],
            [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.COMPLETED, OrderStatus.CANCELLED],
            [OrderStatus.PAID]: [OrderStatus.PROCESSING, OrderStatus.COMPLETED, OrderStatus.CANCELLED],
            [OrderStatus.PREPARING]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
            [OrderStatus.READY]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
            [OrderStatus.SHIPPED]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
            [OrderStatus.DELIVERED]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
        };

        const allowed = validTransitions[current] || [];
        if (!allowed.includes(next)) {
            // Owner/Admin overrides as final safeguard
            if (role === 'OWNER' || role === 'ADMIN') return true;
            throw new Error(`Invalid transition from ${current} to ${next}`);
        }
    }

    /**
     * Handles side effects (Notifications, Socket Events)
     */
    private async handlePostTransition(order: any, old: string, next: string, actor: any) {

        // 1. Emit to Socket (UI Update)
        // Global Company Room
        emitToCompany(order.companyId, "order_updated", order);

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
            emitToCompany(order.companyId, "lead_updated", {
                leadId: order.leadId,
                companyId: order.companyId,
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
                order.companyId,
                "New Order detected",
                `Value: ${order.amount} - ${order.summary}`,
                "ORDER"
            );
        }

        // 3. Notify Customer (Auto-Reply)
        await customerMessagingService.sendStatusUpdate(order);
    }
}

export const orderWorkflowService = new OrderWorkflowService();
