import { prisma } from "../../lib/prisma";
import { emitToAgent, emitToCompanyAdmin } from "../../lib/socket";

type NotificationType = "ORDER" | "MESSAGE" | "ALERT" | "SYSTEM";

export class NotificationService {

    /**
     * Check if a user has a preference enabled for a given notification type.
     * Returns true (enabled) if no preference row exists yet (safe default).
     */
    private async isTypeEnabled(userId: string, type: NotificationType): Promise<boolean> {
        const pref = await prisma.notificationPreference.findUnique({
            where: { userId },
            select: { [type]: true }
        });
        // No preference row yet → default all ON
        if (!pref) return true;
        return pref[type];
    }

    /**
     * Bulk-check which user IDs from a list have a given type enabled.
     * Single query, returns a Set of enabled user IDs.
     */
    private async getEnabledUserIds(companyId: string, userIds: string[], type: NotificationType): Promise<Set<string>> {
        if (userIds.length === 0) return new Set();

        const prefs = await prisma.notificationPreference.findMany({
            where: { companyId, userId: { in: userIds } },
            select: { userId: true, [type]: true }
        });

        // Build map of userId → preference value
        const prefMap = new Map<string, boolean>();
        for (const p of prefs) {
            prefMap.set(p.userId, (p as any)[type]);
        }

        // Users with no preference row default to enabled
        return new Set(
            userIds.filter(id => prefMap.get(id) ?? true)
        );
    }

    /**
     * Creates a notification for a specific user and emits a socket event.
     * Skips if the user has disabled this notification type.
     */
    async notifyUser(
        userId: string,
        title: string,
        body: string,
        type: NotificationType
    ) {
        try {
            // Check preference — skip if disabled
            const enabled = await this.isTypeEnabled(userId, type);
            if (!enabled) return null;

            // Get user's companyId
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { companyId: true }
            });

            if (!user) return null;

            // 1. Create DB Record
            const notification = await prisma.notification.create({
                data: {
                    userId,
                    companyId: user.companyId,
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
     * Creates a notification for all company admins and emits socket events with IDs.
     * Filters out admins who have disabled this notification type.
     */
    async notifyCompanyAdmins(
        companyId: string,
        title: string,
        body: string,
        type: NotificationType
    ) {
        try {
            // 1. Find all admins/owners
            const admins = await prisma.user.findMany({
                where: {
                    companyId,
                    role: { in: ["MANAGER", "OWNER"] },
                    isActive: true
                },
                select: { id: true }
            });

            if (admins.length === 0) return;

            // 2. Filter by preference (single query)
            const adminIds = admins.map(a => a.id);
            const enabledIds = await this.getEnabledUserIds(companyId, adminIds, type);

            // 3. Create and Emit only for enabled users
            await Promise.all(
                adminIds
                    .filter(id => enabledIds.has(id))
                    .map(id => this.notifyUser(id, title, body, type))
            );

        } catch (error) {
            console.error(`❌ Failed to notify admins of company ${companyId}:`, error);
        }
    }

    /**
     * Creates a notification for ALL active users in a company.
     * Filters out users who have disabled this notification type.
     */
    async notifyCompany(
        companyId: string,
        title: string,
        body: string,
        type: NotificationType
    ) {
        try {
            const users = await prisma.user.findMany({
                where: { companyId, isActive: true },
                select: { id: true }
            });

            if (users.length === 0) return;

            // Filter by preference (single query)
            const userIds = users.map(u => u.id);
            const enabledIds = await this.getEnabledUserIds(companyId, userIds, type);

            await Promise.all(
                userIds
                    .filter(id => enabledIds.has(id))
                    .map(id => this.notifyUser(id, title, body, type))
            );
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
