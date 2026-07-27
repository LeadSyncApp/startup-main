import { notificationService } from "./notification.service";

export const LOW_STOCK_THRESHOLD = 5;

export class BusinessNotificationService {
  /**
   * 1. New Customer Inquiry / Human Handoff Notification (type: MESSAGE)
   * Notifies assigned agent if assigned, otherwise notifies all company users.
   */
  async notifyCustomerInquiry(params: {
    companyId: string;
    leadNameOrContact: string;
    messageText: string;
    assignedToId?: string | null;
  }) {
    const { companyId, leadNameOrContact, messageText, assignedToId } = params;
    const preview = messageText ? messageText.slice(0, 100) : "New message received";
    const title = "New Customer Inquiry";
    const body = `${leadNameOrContact}: "${preview}${messageText.length > 100 ? "..." : ""}"`;

    if (assignedToId) {
      await notificationService.notifyUser(assignedToId, title, body, "MESSAGE");
    } else {
      await notificationService.notifyCompany(companyId, title, body, "MESSAGE");
    }
  }

  /**
   * 2. Missed Reply SLA Timeout Notification (type: ALERT)
   * Notifies assigned agent if assigned, otherwise notifies all company users.
   */
  async notifySlaTimeout(params: {
    companyId: string;
    leadNameOrContact: string;
    messageText: string;
    assignedToId?: string | null;
    hoursUnanswered?: number;
  }) {
    const { companyId, leadNameOrContact, messageText, assignedToId, hoursUnanswered = 2 } = params;
    const preview = messageText ? messageText.slice(0, 80) : "Unanswered message";
    const title = "⏰ SLA Alert: Unanswered Customer";
    const body = `"${leadNameOrContact}" has been waiting for over ${hoursUnanswered} hours: "${preview}${messageText.length > 80 ? "..." : ""}"`;

    if (assignedToId) {
      await notificationService.notifyUser(assignedToId, title, body, "ALERT");
    } else {
      await notificationService.notifyCompany(companyId, title, body, "ALERT");
    }
  }

  /**
   * 3. Low Stock / Out of Stock Transition Notification (type: ALERT)
   * Only fires when crossing stock threshold to avoid duplicate spam on subsequent updates.
   */
  async notifyStockLevelChange(params: {
    companyId: string;
    productName: string;
    sku?: string | null;
    currentStock: number;
    newStock: number;
  }) {
    const { companyId, productName, sku, currentStock, newStock } = params;
    const skuLabel = sku ? ` (SKU: ${sku})` : "";

    // 1. Transition to OUT OF STOCK
    if (newStock === 0 && currentStock > 0) {
      const title = "🚨 Product Out of Stock";
      const body = `"${productName}"${skuLabel} is now OUT OF STOCK (0 units remaining).`;
      await notificationService.notifyCompanyAdmins(companyId, title, body, "ALERT");
      return;
    }

    // 2. Transition to LOW STOCK (was above LOW_STOCK_THRESHOLD, now at or below)
    if (currentStock > LOW_STOCK_THRESHOLD && newStock <= LOW_STOCK_THRESHOLD && newStock > 0) {
      const title = "⚠️ Low Stock Alert";
      const body = `"${productName}"${skuLabel} stock is low (${newStock} units remaining).`;
      await notificationService.notifyCompanyAdmins(companyId, title, body, "ALERT");
      return;
    }
  }

  /**
   * 4. Payment Received / Payment Failed Notification (type: ALERT)
   * Notifies company admins on payment success or failure.
   */
  async notifyPaymentStatus(params: {
    companyId: string;
    orderId: string;
    customerName?: string | null;
    amount: number;
    isSuccess: boolean;
    reason?: string;
  }) {
    const { companyId, orderId, customerName, amount, isSuccess, reason } = params;
    const formattedAmount = amount ? amount.toFixed(2) : "0.00";
    const shortOrderId = orderId ? orderId.slice(0, 8) : "";
    const customerLabel = customerName ? ` (${customerName})` : "";

    if (isSuccess) {
      const title = "💰 Payment Received";
      const body = `Payment of ₹${formattedAmount} received for Order #${shortOrderId}${customerLabel}.`;
      await notificationService.notifyCompanyAdmins(companyId, title, body, "ALERT");
    } else {
      const title = "❌ Payment Failed";
      const body = `Payment attempt of ₹${formattedAmount} failed for Order #${shortOrderId}${customerLabel}${reason ? `: ${reason}` : "."}`;
      await notificationService.notifyCompanyAdmins(companyId, title, body, "ALERT");
    }
  }
}

export const businessNotificationService = new BusinessNotificationService();
