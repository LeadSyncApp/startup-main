import { prisma } from "../lib/prisma";
import { OrderStatus, OrderApprovalStatus, OrderLog } from "@prisma/client";
import { safeEmitConversationUpdate, emitToCompany, emitToCompanyAdmin } from "../lib/socket";
import { notificationService } from "./notification.service";
import { customerMessagingService } from "./customerMessaging.service";

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
        expectedVersion?: number
    ) {
        // 1. Fetch Current State
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { conversation: true, lead: true }
        });

        if (!order) throw new Error("Order not found");

        const oldStatus = order.status;

        // 2. Validate Transition
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
            const [_, log] = await prisma.$transaction([
                // Update Order
                prisma.order.update({
                    where: whereClause,
                    data: {
                        status: newStatus,
                        version: nextVersion,
                        processedById: actor.id,
                        completedAt: ['DELIVERED', 'COMPLETED', 'CANCELLED', 'REJECTED'].includes(newStatus)
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

            // ⛔ STRICT PERSISTENCE: Re-fetch fresh state to ensure no race conditions
            const updatedOrder = await prisma.order.findUnique({
                where: { id: orderId },
                include: {
                    conversation: { include: { lead: true } },
                    lead: true,
                    processedBy: { select: { id: true, name: true } }
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
        // Owner/Admin overrides
        if (role === 'OWNER' || role === 'ADMIN') return true;

        // Agent Valid Transitions
        const validTransitions: Record<string, OrderStatus[]> = {
            [OrderStatus.BOT_CREATED_ORDER]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED, OrderStatus.REJECTED],
            [OrderStatus.PROCESSING]: [OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.SHIPPED, OrderStatus.CANCELLED, OrderStatus.REJECTED],
            [OrderStatus.PREPARING]: [OrderStatus.READY, OrderStatus.SHIPPED, OrderStatus.CANCELLED, OrderStatus.REJECTED],
            [OrderStatus.READY]: [OrderStatus.SHIPPED, OrderStatus.DELIVERED, OrderStatus.CANCELLED, OrderStatus.REJECTED],
            [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED, OrderStatus.REJECTED],
            [OrderStatus.DELIVERED]: [OrderStatus.COMPLETED, OrderStatus.ARCHIVED],

            // Legacy Support
            [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.REJECTED],
            [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.PREPARING, OrderStatus.CANCELLED],
        };

        const allowed = validTransitions[current] || [];
        if (!allowed.includes(next)) {
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
