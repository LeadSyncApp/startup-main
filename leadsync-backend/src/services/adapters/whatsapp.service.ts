import { metaAdapterService } from "./meta.adapter";
import axios from "axios";

export interface WhatsAppButton {
  type: "reply";
  reply: {
    id: string;
    title: string;
  };
}

export class WhatsAppService {
  /**
   * Delegates plain-text outbound messages directly to the resilient MetaAdapter transport layer.
   */
  public async sendTextMessage(companyId: string, toPhoneNumber: string, text: string): Promise<void> {
    await metaAdapterService.sendWhatsAppMessage(companyId, toPhoneNumber, text);
  }

  /**
   * Dispatches high-response quick reply options (optimized with injected multi-tenant configuration blocks).
   */
  public async sendInteractiveButtons(
    toPhoneNumber: string,
    contentText: string,
    buttons: WhatsAppButton[],
    credentials: { systemToken: string; phoneNumberId: string }
  ): Promise<void> {
    if (!credentials?.systemToken || !credentials?.phoneNumberId) {
      throw new Error(`Inbound call context missing target WhatsApp Authorization Parameters.`);
    }

    const url = `https://graph.facebook.com/v19.0/${credentials.phoneNumberId}/messages`;
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toPhoneNumber,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: contentText },
        action: {
          buttons: buttons.slice(0, 3) // Meta strict limit constraint
        }
      }
    };

    try {
      await axios.post(url, payload, {
        headers: {
          "Authorization": `Bearer ${credentials.systemToken}`,
          "Content-Type": "application/json"
        }
      });
    } catch (err: any) {
      console.error(`❌ [Meta API Send Button Error]: ${err.response?.data?.error?.message || err.message}`);
      throw err;
    }
  }

  /**
   * Instantly notifies a consumer about high-intent catalog status or invoice confirmations.
   */
  public async sendTemplateNotification(
    toPhoneNumber: string,
    templateName: string,
    credentials: { systemToken: string; phoneNumberId: string },
    languageCode: string = "en_US",
    components: any[] = []
  ): Promise<void> {
    if (!credentials?.systemToken || !credentials?.phoneNumberId) {
      throw new Error(`Inbound call context missing target WhatsApp Authorization Parameters.`);
    }

    const url = `https://graph.facebook.com/v19.0/${credentials.phoneNumberId}/messages`;
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toPhoneNumber,
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
        components
      }
    };

    try {
      await axios.post(url, payload, {
        headers: {
          "Authorization": `Bearer ${credentials.systemToken}`,
          "Content-Type": "application/json"
        }
      });
    } catch (err: any) {
      console.error(`❌ [Meta API Send Template Error]: ${err.response?.data?.error?.message || err.message}`);
      throw err;
    }
  }
}

export const whatsAppService = new WhatsAppService();

