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
            // 2. Batch Create Notifications
            await prisma_1.prisma.notification.createMany({
                data: admins.map(admin => ({
                    userId: admin.id,
                    title,
                    body,
                    type,
                    isRead: false
                }))
            });
            // 3. Emit Real-time Events (Bulk Emit not supported by simple socket function, loop for now)
            // Ideally should use a room `company:{id}:admin` but persistent notifications are per user.
            // We can emit to room "company:{id}:admin" with a generic payload, 
            // but the client needs the specific notification ID to mark as read.
            // So we emit "notification_sync" signal to prompt fetch, OR just push data.
            // For simplicity and to match `emitToCompanyAdmin` wrapper:
            // We just fetch the latest for each admin? No, too heavy.
            // Let's just emit the event payload to the admin room.
            // The client will receive it. If they want to mark as read, they'll need the ID.
            // But `createMany` doesn't return IDs easily in all DBs.
            // So for now, we'll iterate and create individually to get IDs if needed, 
            // OR we accept that the socket event is for "Toast" and the DB is for "History".
            // Actually, `emitToCompanyAdmin` broadcasts to room `company:${companyId}:admin`.
            // So we can send one event.
            // But the *DB records* are individual.
            // Let's just create records and then emit one event.
            (0, socket_1.emitToCompanyAdmin)(companyId, "notification_new", { title, body, type, createdAt: new Date() });
        }
        catch (error) {
            console.error(`❌ Failed to notify admins of company ${companyId}:`, error);
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
