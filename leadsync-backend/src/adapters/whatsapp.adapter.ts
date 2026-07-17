import { ProviderAdapter } from "../interfaces/provider.adapter";
import { Channel, StandardMessageFrame } from "../interfaces/messaging.interface";
import { prisma } from "../lib/prisma";

export class WhatsAppAdapter implements ProviderAdapter {
  /**
   * Safe and stateless conversion of incoming Facebook Graph API / WhatsApp Cloud API webhook data 
   * into a unified cCommerce standard message frame.
   */
  public async normalizePayloadWithContext(body: any): Promise<StandardMessageFrame | null> {
    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    
    // Check if it's a message event
    const message = value?.messages?.[0];
    if (!message) return null;

    const phoneNumberId = value?.metadata?.phone_number_id;
    let determinedCompanyId = "";

    // Resolve tenant context via indexed unique field mapping
    if (phoneNumberId) {
      try {
        const cacheMatched = await prisma.company.findFirst({
          where: { whatsAppPhoneNumberId: phoneNumberId },
          select: { id: true }
        });
        if (cacheMatched) {
          determinedCompanyId = cacheMatched.id;
        }
      } catch (dbErr) {
        console.error("❌ [WhatsApp Adapter Context Resolution Error]:", dbErr);
      }
    }

    const contact = value?.contacts?.[0];
    const contactName = contact?.profile?.name || "Customer";

    // Handle interactive reply values (like buttons, lists, or quick replies)
    let messageText = "";
    if (message.type === "text") {
      messageText = message.text?.body || "";
    } else if (message.type === "interactive") {
      const interactive = message.interactive;
      if (interactive.type === "button_reply") {
        messageText = interactive.button_reply?.title || "";
      } else if (interactive.type === "list_reply") {
        messageText = interactive.list_reply?.title || interactive.list_reply?.id || "";
      }
    } else if (message.type === "button") {
      messageText = message.button?.text || "";
    }

    return {
      channel: Channel.WHATSAPP,
      externalChatId: String(message.from),
      text: messageText,
      contactName: contactName,
      isCallback: message.type === "interactive" || message.type === "button",
      callbackData: message.interactive?.list_reply?.id || message.interactive?.button_reply?.id || undefined,
      companyId: determinedCompanyId
    };
  }

  // Preserve legacy contract interface fallback compliance
  public normalizePayload(body: any): StandardMessageFrame | null {
    throw new Error("Use async normalizePayloadWithContext to prevent cross-tenant message leakage.");
  }
}

