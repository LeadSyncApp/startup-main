// Re-export all services for convenient imports from ../services

// AI Services
export { aiPersonalityService } from "./ai/aiPersonality.service";

// Infrastructure Services
export { NotificationService, notificationService } from "./infrastructure/notification.service";
export {
  reapGhostConversations,
  reapGhostsForCompany,
  GHOST_REAPER_CONFIG,
} from "./infrastructure/ghostReaper.service";

// Integration Services
export { recalculateLeadCRM } from "./integrations/crm.service";
export { invoiceService } from "./integrations/invoice.service";
export { paymentService } from "./integrations/payment.service";
export { sendEmail, generatePasswordResetHtml, generateInviteEmailHtml } from "./integrations/email.service";
export { FileParserService, fileParserService, upload } from "./integrations/fileParser.service";

// Messaging Services
export { CustomerMessagingService, customerMessagingService } from "./messaging/customerMessaging.service";
export { createOrder } from "./messaging/telegram.service";
export { TelegramLeaseService, INSTANCE_ID, IS_LOCAL, MY_ROLE } from "./messaging/telegramSelector.service";

// Workflow Services
export { NewOrderArrivalService, newOrderArrivalService } from "./workflow/newOrderArrival.service";
export { OrderWorkflowService, orderWorkflowService } from "./workflow/orderWorkflow.service";
export { startAutomationRunner, stopAutomationRunner } from "./workflow/automation.service";
export { AssignmentService, assignmentService } from "./workflow/assignment.service";

// Automation Services (Auto-Reply)
export { AutoReplyService, autoReplyService, AUTO_REPLY_EVENTS } from "./automation/autoReply.service";
export { setupAutoReplyEventListeners, triggerLeadWelcome, triggerLeadFollowUp } from "./automation/autoReplyEventListeners";
