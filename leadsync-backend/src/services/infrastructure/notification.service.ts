import { prisma } from "../../lib/prisma";
import { emitToAgent, emitToCompanyAdmin } from "../../lib/socket";

export class NotificationService {

    /**
     * Creates a notification for a specific user and emits a socket event.
     */
    async notifyUser(
        userId: string,
        title: string,
        body: string,
        type: "ORDER" | "MESSAGE" | "ALERT" | "SYSTEM"
    ) {
        try {
            // 1. Create DB Record
            const notification = await prisma.notification.create({
                data: {
                    userId,
                    title,
                    body,
                    type,
                    isRead: false
                }
            });

            // 2. Emit Real-time Event
            emitToAgent(userId, "notification_new", notification);

            return notification;
        } catch (error) {
            console.error(`❌ Failed to notify user ${userId}:`, error);
        }
    }

    /**
     * Creates a notification for all company admins and emits socket events.
     */
    /**
     * Creates a notification for all company admins and emits socket events with IDs.
     */
    async notifyCompanyAdmins(
        companyId: string,
        title: string,
        body: string,
        type: "ORDER" | "MESSAGE" | "ALERT" | "SYSTEM"
    ) {
        try {
            // 1. Find all admins/owners
            const admins = await prisma.user.findMany({
                where: {
                    companyId,
                    role: { in: ["ADMIN", "OWNER"] },
                    isActive: true
                },
                select: { id: true }
            });

            if (admins.length === 0) return;

            // 2. Create and Emit Individually
            await Promise.all(admins.map(async (admin: any) => this.notifyUser(admin.id, title, body, type)));

        } catch (error) {
            console.error(`❌ Failed to notify admins of company ${companyId}:`, error);
        }
    }

    /**
     * Creates a notification for ALL active users in a company.
     */
    async notifyCompany(
        companyId: string,
        title: string,
        body: string,
        type: "ORDER" | "MESSAGE" | "ALERT" | "SYSTEM"
    ) {
        try {
            const users = await prisma.user.findMany({
                where: { companyId, isActive: true },
                select: { id: true }
            });

            await Promise.all(users.map((u: any) => this.notifyUser(u.id, title, body, type)));
        } catch (error) {
            console.error(`❌ Failed to notify company ${companyId}:`, error);
        }
    }

    /**
     * Marks a notification as read.
     */
    async markAsRead(notificationId: string) {
        return await prisma.notification.update({
            where: { id: notificationId },
            data: { isRead: true }
        });
    }

    /**
     * Marks all notifications as read for a user.
     */
    async markAllAsRead(userId: string) {
        return await prisma.notification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true }
        });
    }
}

export const notificationService = new NotificationService();
