"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderWorkflowService = exports.OrderWorkflowService = void 0;
const prisma_1 = require("../lib/prisma");
const client_1 = require("@prisma/client");
const socket_1 = require("../lib/socket");
const notification_service_1 = require("./notification.service");
const customerMessaging_service_1 = require("./customerMessaging.service");
/**
 * Strict Rank for Forward-Only Lifecycle
 */
const STATUS_RANK = {
    [client_1.OrderStatus.BOT_CREATED_ORDER]: 0,
    [client_1.OrderStatus.PENDING]: 1,
    [client_1.OrderStatus.NEW]: 1,
    [client_1.OrderStatus.CONFIRMED]: 2,
    [client_1.OrderStatus.PROCESSING]: 3,
    [client_1.OrderStatus.PREPARING]: 4,
    [client_1.OrderStatus.READY]: 5,
    [client_1.OrderStatus.SHIPPED]: 6,
    [client_1.OrderStatus.DELIVERED]: 7,
    [client_1.OrderStatus.COMPLETED]: 8,
    [client_1.OrderStatus.CANCELLED]: 9,
    [client_1.OrderStatus.REJECTED]: 9,
    [client_1.OrderStatus.ARCHIVED]: 10,
};
/**
 * Strict State Machine for Order Processing
 */
class OrderWorkflowService {
    /**
     * Attempts to transition an order to a new status.
     * Enforces strict workflow rules and audit logging.
     * Uses Optimistic Locking (version check) to prevent race conditions.
     */
    async transitionStatus(orderId, newStatus, actor, expectedVersion // CRITICAL: This must come from the UI's current state
    ) {
        // 1. Fetch Current State (Fresh from DB)
        const order = await prisma_1.prisma.order.findUnique({
            where: { id: orderId },
            include: { conversation: true, lead: true }
        });
        if (!order)
            throw new Error("Order not found");
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
        const whereClause = { id: orderId };
        if (expectedVersion) {
            whereClause.version = expectedVersion;
        }
        const nextVersion = order.version + 1;
        // Transaction: Update Order + Create Log
        // Note: Prisma interactive transactions ($transaction) are best here.
        try {
            const [_, log] = await prisma_1.prisma.$transaction([
                // Update Order
                prisma_1.prisma.order.update({
                    where: whereClause,
                    data: {
                        status: newStatus,
                        version: nextVersion,
                        processedById: actor.id,
                        completedAt: ['DELIVERED', 'COMPLETED', 'CANCELLED', 'REJECTED', 'SHIPPED'].includes(newStatus)
                            ? new Date()
                            : (oldStatus === client_1.OrderStatus.BOT_CREATED_ORDER ? null : order.completedAt),
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
            // ⛔ STRICT PERSISTENCE: Re-fetch fresh state to ensure no race conditions
            const updatedOrder = await prisma_1.prisma.order.findUnique({
                where: { id: orderId },
                include: {
                    conversation: { include: { lead: true } },
                    lead: true,
                    processedBy: { select: { id: true, name: true } }
                }
            });
            if (!updatedOrder)
                throw new Error("Order lost after update");
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
            [client_1.OrderStatus.BOT_CREATED_ORDER]: [client_1.OrderStatus.PROCESSING, client_1.OrderStatus.CANCELLED, client_1.OrderStatus.REJECTED],
            [client_1.OrderStatus.PROCESSING]: [client_1.OrderStatus.PREPARING, client_1.OrderStatus.READY, client_1.OrderStatus.SHIPPED, client_1.OrderStatus.CANCELLED, client_1.OrderStatus.REJECTED],
            [client_1.OrderStatus.PREPARING]: [client_1.OrderStatus.READY, client_1.OrderStatus.SHIPPED, client_1.OrderStatus.CANCELLED, client_1.OrderStatus.REJECTED],
            [client_1.OrderStatus.READY]: [client_1.OrderStatus.SHIPPED, client_1.OrderStatus.DELIVERED, client_1.OrderStatus.CANCELLED, client_1.OrderStatus.REJECTED],
            [client_1.OrderStatus.SHIPPED]: [client_1.OrderStatus.DELIVERED, client_1.OrderStatus.CANCELLED, client_1.OrderStatus.REJECTED],
            [client_1.OrderStatus.DELIVERED]: [client_1.OrderStatus.COMPLETED, client_1.OrderStatus.ARCHIVED],
            // Legacy Support
            [client_1.OrderStatus.PENDING]: [client_1.OrderStatus.CONFIRMED, client_1.OrderStatus.REJECTED],
            [client_1.OrderStatus.CONFIRMED]: [client_1.OrderStatus.PROCESSING, client_1.OrderStatus.PREPARING, client_1.OrderStatus.CANCELLED],
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
        // 3. Notify Customer (Auto-Reply)
        await customerMessaging_service_1.customerMessagingService.sendStatusUpdate(order);
    }
}
exports.OrderWorkflowService = OrderWorkflowService;
exports.orderWorkflowService = new OrderWorkflowService();
