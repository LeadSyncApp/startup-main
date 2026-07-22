import { prisma } from "../../lib/prisma";
import { decryptSecret } from "../../utils/encryption";

const botTokenCache = new Map<string, { token: string; cachedAt: number }>();
const BOT_TOKEN_CACHE_TTL = 60_000; // 60 seconds

/**
 * Pure, isolated transport layer completely segregated from normalization rules.
 */
export class TelegramTransportService {
  private static async resolveBotToken(botTokenOrCompanyId: string): Promise<string> {
    // Fast path: already a bot token
    if (botTokenOrCompanyId.startsWith("bot") || botTokenOrCompanyId.includes(":")) {
      return botTokenOrCompanyId;
    }

    // Check cache (keyed by company ID)
    const cached = botTokenCache.get(botTokenOrCompanyId);
    if (cached && Date.now() - cached.cachedAt < BOT_TOKEN_CACHE_TTL) {
      return cached.token;
    }

    // Resolve via DB
    const company = await prisma.company.findUnique({
      where: { id: botTokenOrCompanyId },
      select: { telegramBotToken: true }
    });
    const decrypted = company?.telegramBotToken ? decryptSecret(company.telegramBotToken) : null;
    if (!decrypted) {
      throw new Error(`TelegramTransportService: Could not resolve bot token for Company: ${botTokenOrCompanyId}`);
    }

    // Cache and return
    botTokenCache.set(botTokenOrCompanyId, { token: decrypted, cachedAt: Date.now() });
    return decrypted;
  }

  public static async sendOutboundPayload(
    botTokenOrCompanyId: string, 
    chatTarget: string, 
    textFrame: string, 
    structuralTools?: any,
    replyMarkup?: any
  ): Promise<void> {
    const botToken = await this.resolveBotToken(botTokenOrCompanyId);
    const cleanedToken = botToken.startsWith("bot") ? botToken.slice(3) : botToken;
    const endpoint = `https://api.telegram.org/bot${cleanedToken}/sendMessage`;
    
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatTarget,
        text: textFrame,
        parse_mode: "HTML",
        reply_markup: replyMarkup ?? (structuralTools ? this.mapToolsToTelegramInterface(structuralTools) : undefined)
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[TelegramOutboundError] Telegram sendOutboundPayload returned status ${response.status}:`, errText);
      throw new Error(`Telegram API responded with status ${response.status}: ${errText}`);
    }
  }

  /**
   * Pre-warms the bot-token cache from an already-resolved company record,
   * avoiding a redundant DB query in resolveBotToken on the first dispatch.
   */
  public static preWarmBotToken(companyId: string, decryptedToken: string): void {
    botTokenCache.set(companyId, { token: decryptedToken, cachedAt: Date.now() });
  }

  public static async editMessageText(
    botTokenOrCompanyId: string,
    chatTarget: string,
    messageId: string,
    textFrame: string,
    replyMarkup?: any
  ): Promise<void> {
    const botToken = await this.resolveBotToken(botTokenOrCompanyId);
    const cleanedToken = botToken.startsWith("bot") ? botToken.slice(3) : botToken;
    const endpoint = `https://api.telegram.org/bot${cleanedToken}/editMessageText`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatTarget,
        message_id: Number(messageId),
        text: textFrame,
        parse_mode: "HTML",
        reply_markup: replyMarkup
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[TelegramEditError] Telegram editMessageText returned status ${response.status}:`, errText);
      throw new Error(`Telegram API responded with status ${response.status}: ${errText}`);
    }
  }

  private static mapToolsToTelegramInterface(tools: any) {
    // Maps your Zod-validated JSON frame directly into Telegram quick-replies natively
    if (tools.options && Array.isArray(tools.options)) {
      return { 
        inline_keyboard: tools.options.map((opt: string) => [{ text: opt, callback_data: opt }]) 
      };
    }
    return undefined;
  }
}
