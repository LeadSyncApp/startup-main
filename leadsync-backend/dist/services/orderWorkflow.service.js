"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderWorkflowService = exports.OrderWorkflowService = void 0;
const prisma_1 = require("../lib/prisma");
const client_1 = require("@prisma/client");
const socket_1 = require("../lib/socket");
const notification_service_1 = require("./notification.service");
/**
 * Strict State Machine for Order Processing
 */
class OrderWorkflowService {
    /**
     * Attempts to transition an order to a new status.
     * Enforces strict workflow rules and audit logging.
     * Uses Optimistic Locking (version check) to prevent race conditions.
     */
    async transitionStatus(orderId, newStatus, actor, expectedVersion) {
        // 1. Fetch Current State
        const order = await prisma_1.prisma.order.findUnique({
            where: { id: orderId },
            include: { conversation: true, lead: true }
        });
        if (!order)
            throw new Error("Order not found");
        const oldStatus = order.status;
        // 2. Validate Transition
        this.validateTransition(oldStatus, newStatus, actor.role);
        // 3. Perform Update with Optimistic Locking
        // If version is provided, we check it. If not, we just update (force).
        // For critical "Accept" actions, version MUST be provided.
        const whereClause = { id: orderId };
        if (expectedVersion) {
            whereClause.version = expectedVersion;
        }
        const nextVersion = order.version + 1;
        // Transaction: Update Order + Create Log
        // Note: Prisma interactive transactions ($transaction) are best here.
        try {
            const [updatedOrder, log] = await prisma_1.prisma.$transaction([
                // Update Order
                prisma_1.prisma.order.update({
                    where: whereClause,
                    data: {
                        status: newStatus,
                        version: nextVersion,
                        // If moving to CONFIRMED, set processedBy
                        processedById: (newStatus === client_1.OrderStatus.CONFIRMED || newStatus === client_1.OrderStatus.PREPARING)
                            ? actor.id
                            : undefined,
                        // If moving to completed states
                        completedAt: ['DELIVERED', 'COMPLETED', 'CANCELLED', 'REJECTED'].includes(newStatus)
                            ? new Date()
                            : null,
                        // If Accepted/Rejected, update approval
                        approvalStatus: newStatus === client_1.OrderStatus.CONFIRMED ? client_1.OrderApprovalStatus.APPROVED
                            : newStatus === client_1.OrderStatus.REJECTED ? client_1.OrderApprovalStatus.REJECTED
                                : order.approvalStatus
                    }
                }),
                // Create Audit Log
                prisma_1.prisma.orderLog.create({
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
            // 4. Emit Events & Notifications
            this.handlePostTransition(updatedOrder, oldStatus, newStatus, actor);
            return { order: updatedOrder, log };
        }
        catch (error) {
            if (error.code === 'P2025' || error.message.includes('Record to update not found')) {
                throw new Error("CONCURRENCY_CONFLICT: Order was modified by another agent. Please refresh.");
            }
            throw error;
        }
    }
    /**
     * Validates if a transition is allowed based on the current state.
     */
    validateTransition(current, next, role) {
        // Owner/Admin overrides
        if (role === 'OWNER' || role === 'ADMIN')
            return true;
        // Agent Valid Transitions
        const validTransitions = {
            [client_1.OrderStatus.BOT_DETECTED]: [client_1.OrderStatus.PENDING], // Internal move
            [client_1.OrderStatus.PENDING]: [client_1.OrderStatus.CONFIRMED, client_1.OrderStatus.REJECTED, client_1.OrderStatus.CANCELLED],
            [client_1.OrderStatus.NEW]: [client_1.OrderStatus.CONFIRMED, client_1.OrderStatus.REJECTED, client_1.OrderStatus.CANCELLED], // Legacy Support
            [client_1.OrderStatus.CONFIRMED]: [client_1.OrderStatus.PREPARING, client_1.OrderStatus.CANCELLED],
            [client_1.OrderStatus.PREPARING]: [client_1.OrderStatus.READY, client_1.OrderStatus.CANCELLED],
            [client_1.OrderStatus.READY]: [client_1.OrderStatus.DELIVERED, client_1.OrderStatus.SHIPPED, client_1.OrderStatus.CANCELLED],
            [client_1.OrderStatus.SHIPPED]: [client_1.OrderStatus.DELIVERED, client_1.OrderStatus.CANCELLED],
        };
        const allowed = validTransitions[current] || [];
        if (!allowed.includes(next)) {
            throw new Error(`Invalid transition from ${current} to ${next}`);
        }
    }
    /**
     * Handles side effects (Notifications, Socket Events)
     */
    async handlePostTransition(order, old, next, actor) {
        // 1. Emit to Socket (UI Update)
        // Global Company Room
        (0, socket_1.emitToCompany)(order.companyId, "order_updated", order);
        // Conversation Update (Chat View)
        (0, socket_1.safeEmitConversationUpdate)(order.conversation, "order_updated", order);
        // 2. Notify ALL Company Users (Admins + Agents)
        if (next === client_1.OrderStatus.PENDING || next === client_1.OrderStatus.NEW) {
            await notification_service_1.notificationService.notifyCompany(order.companyId, "New Order detected", `Value: ${order.amount} - ${order.summary}`, "ORDER");
        }
        // 3. Notify Agent if assigned and checked by someone else (Concurrency Alert)
        // Skipping for now, UI handles optimistic lock error.
    }
}
exports.OrderWorkflowService = OrderWorkflowService;
exports.orderWorkflowService = new OrderWorkflowService();
