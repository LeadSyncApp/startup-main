import { ProviderAdapter } from "../interfaces/provider.adapter";
import { Channel, StandardMessageFrame } from "../interfaces/messaging.interface";

export class InstagramAdapter implements ProviderAdapter {
  /**
   * Pure Stateless Normalization.
   * Zero database calls, zero local state side-effects.
   */
  public static normalizePayload(body: any): StandardMessageFrame | null {
    const entry = body.entry?.[0];
    const messaging = entry?.messaging?.[0];
    
    if (!messaging || !messaging.sender?.id) return null;

    return {
      channel: Channel.INSTAGRAM,
      externalChatId: String(messaging.sender.id),
      text: messaging.message?.text || "",
      isCallback: false,
      companyId: ""
    };
  }

  normalizePayload(body: any): StandardMessageFrame | null {
    return InstagramAdapter.normalizePayload(body);
  }
}
