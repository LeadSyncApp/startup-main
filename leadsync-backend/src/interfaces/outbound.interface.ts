export type ChannelType = "TELEGRAM" | "WHATSAPP" | "INSTAGRAM" | "WEBSITE";

export interface MessageContent {
  text: string;
}

export interface OutboundPayload {
  companyId: string;
  conversationId: string;
  leadId?: string; // Optional lead ID for tracking
  to: string; // Recipient contact or chat identifier
  channel: ChannelType;
  content: MessageContent;
  sender?: "AGENT" | "SYSTEM" | "BOT";
  senderName?: string; // Display name of the sender (e.g. agent's name)
  senderId?: string; // User ID of the sender (e.g. agent's user id)
  clientMessageId?: string; // Client-generated idempotency key (reused on retry)
  replyMarkup?: any; // Channel-native reply markup (e.g. Telegram inline_keyboard)
}

/**
 * Custom error thrown when tenant integration credentials (e.g. Tokens)
 * are missing in the database.
 */
export class IntegrationCredentialsMissingError extends Error {
  public companyId: string;
  public channel: string;

  constructor(companyId: string, channel: string) {
    super(`Integration credentials missing for companyId "${companyId}" on channel "${channel}".`);
    this.name = "IntegrationCredentialsMissingError";
    this.companyId = companyId;
    this.channel = channel;
    Object.setPrototypeOf(this, IntegrationCredentialsMissingError.prototype);
  }
}
