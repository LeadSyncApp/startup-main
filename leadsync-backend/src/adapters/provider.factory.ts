import { ProviderAdapter } from "../interfaces/provider.adapter";
import { Channel, StandardMessageFrame } from "../interfaces/messaging.interface";
import { InstagramAdapter } from "../adapters/instagram.adapter";
import { WhatsAppAdapter } from "./whatsapp.adapter";

class TelegramAdapter implements ProviderAdapter {
  normalizePayload(body: any): StandardMessageFrame | null {
    const msg = body.message || body.callback_query?.message;
    if (!msg) return null;
    return {
      channel: Channel.TELEGRAM,
      externalChatId: String(msg.chat.id),
      text: body.callback_query ? String(body.callback_query.data) : (msg.text || ""),
      isCallback: !!body.callback_query,
      companyId: ""
    };
  }
}

export class ProviderAdapterFactory {
  private static adapters: Record<string, ProviderAdapter> = {
    telegram: new TelegramAdapter(),
    whatsapp: new WhatsAppAdapter(),
    instagram: new InstagramAdapter()
  };

  public static getAdapter(provider: string): ProviderAdapter {
    const adapter = this.adapters[provider.toLowerCase()];
    if (!adapter) {
      throw new Error(`Routing Error: Messaging vendor platform [${provider}] is unsupported.`);
    }
    return adapter;
  }
}
