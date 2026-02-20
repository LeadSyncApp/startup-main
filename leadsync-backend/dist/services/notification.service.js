"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationService = exports.NotificationService = void 0;
const prisma_1 = require("../lib/prisma");
const socket_1 = require("../lib/socket");
class NotificationService {
    /**
     * Creates a notification for a specific user and emits a socket event.
     */
    async notifyUser(userId, title, body, type) {
        try {
            // 1. Create DB Record
            const notification = await prisma_1.prisma.notification.create({
                data: {
                    userId,
                    title,
                    body,
                    type,
                    isRead: false
                }
            });
            // 2. Emit Real-time Event
            (0, socket_1.emitToAgent)(userId, "notification_new", notification);
            return notification;
        }
        catch (error) {
            console.error(`❌ Failed to notify user ${userId}:`, error);
        }
    }
    /**
     * Creates a notification for all company admins and emits socket events.
     */
    /**
     * Creates a notification for all company admins and emits socket events with IDs.
     */
    async notifyCompanyAdmins(companyId, title, body, type) {
        try {
            // 1. Find all admins/owners
            const admins = await prisma_1.prisma.user.findMany({
                where: {
                    companyId,
                    role: { in: ["ADMIN", "OWNER"] },
                    isActive: true
                },
                select: { id: true }
            });
            if (admins.length === 0)
                return;
            // 2. Create and Emit Individually
            await Promise.all(admins.map(async (admin) => this.notifyUser(admin.id, title, body, type)));
        }
        catch (error) {
            console.error(`❌ Failed to notify admins of company ${companyId}:`, error);
        }
    }
    /**
     * Creates a notification for ALL active users in a company.
     */
    async notifyCompany(companyId, title, body, type) {
        try {
            const users = await prisma_1.prisma.user.findMany({
                where: { companyId, isActive: true },
                select: { id: true }
            });
            await Promise.all(users.map(u => this.notifyUser(u.id, title, body, type)));
        }
        catch (error) {
            console.error(`❌ Failed to notify company ${companyId}:`, error);
        }
    }
    /**
     * Marks a notification as read.
     */
    async markAsRead(notificationId) {
        return await prisma_1.prisma.notification.update({
            where: { id: notificationId },
            data: { isRead: true }
        });
    }
    /**
     * Marks all notifications as read for a user.
     */
    async markAllAsRead(userId) {
        return await prisma_1.prisma.notification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true }
        });
    }
}
exports.NotificationService = NotificationService;
exports.notificationService = new NotificationService();
