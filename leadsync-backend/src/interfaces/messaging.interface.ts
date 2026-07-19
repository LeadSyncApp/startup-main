export enum Channel {
  WEBSITE = "WEBSITE",
  TELEGRAM = "TELEGRAM",
  WHATSAPP = "WHATSAPP",
  INSTAGRAM = "INSTAGRAM"
}

export interface StandardMessageFrame {
  channel: Channel;
  externalChatId: string;
  text: string;
  contactName?: string;
  isCallback: boolean;
  callbackData?: string;
  callbackQueryId?: string;
  callbackMessageId?: string;
  companyId: string;
}
