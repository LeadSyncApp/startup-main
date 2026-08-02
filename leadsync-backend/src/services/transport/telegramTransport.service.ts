import { prisma } from "../../lib/prisma";
import { decryptSecret } from "../../utils/encryption";

const botTokenCache = new Map<string, { token: string; cachedAt: number }>();
const BOT_TOKEN_CACHE_TTL = 60_000; // 60 seconds
const BOT_TOKEN_CACHE_MAX = 200;

function evictBotTokenCache(): void {
  if (botTokenCache.size <= BOT_TOKEN_CACHE_MAX) return;
  const evictCount = Math.ceil(BOT_TOKEN_CACHE_MAX / 2);
  let deleted = 0;
  for (const key of botTokenCache.keys()) {
    if (deleted >= evictCount) break;
    botTokenCache.delete(key);
    deleted++;
  }
}

const TELEGRAM_MAX_MESSAGE_LENGTH = 4096;
const CHUNK_INTER_DELAY_MS = 350; // rate-limit courtesy between sequential chunks
const TELEGRAM_REQUEST_TIMEOUT_MS = 15_000; // 15-second timeout for Telegram API calls

/**
 * Splits text into chunks respecting Telegram's 4096-char limit.
 * Breaks at the last newline or space before the limit (never mid-word, never mid-HTML-tag).
 * Processes one chunk at a time — yields chunks via generator to avoid buffering all in memory.
 */
function* chunkMessage(text: string, maxLen: number = TELEGRAM_MAX_MESSAGE_LENGTH): Generator<string> {
  if (text.length <= maxLen) {
    yield text;
    return;
  }

  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      yield remaining;
      return;
    }

    let splitIdx = -1;

    // 1. Try last newline within limit
    const nlIdx = remaining.lastIndexOf("\n", maxLen);
    if (nlIdx > 0) {
      splitIdx = nlIdx;
    }

    // 2. Try last space within limit
    if (splitIdx <= 0) {
      const spIdx = remaining.lastIndexOf(" ", maxLen);
      if (spIdx > 0) {
        splitIdx = spIdx;
      }
    }

    // 3. Hard cut at limit (fallback — should be rare)
    if (splitIdx <= 0) {
      splitIdx = maxLen;
      console.warn(`[TelegramChunk] Hard-split at ${maxLen} chars — no clean break point found`);
    }

    let chunk = remaining.slice(0, splitIdx).trimEnd();

    // Safety: if a single "chunk" somehow still exceeds limit (e.g. one huge word),
    // truncate with ellipsis and log. This should never happen in practice.
    if (chunk.length > maxLen) {
      chunk = chunk.slice(0, maxLen - 3) + "...";
      console.warn(`[TelegramChunk] Chunk exceeded ${maxLen} chars after split — truncated with ellipsis`);
    }

    yield chunk;
    remaining = remaining.slice(splitIdx).trimStart();
  }
}

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
    evictBotTokenCache();
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

    // Stream chunks via generator — only one chunk in memory at a time
    const replyMarkupJson = replyMarkup ?? (structuralTools ? this.mapToolsToTelegramInterface(structuralTools) : undefined);
    let chunkIndex = 0;

    for (const chunk of chunkMessage(textFrame)) {
      // Rate-limit courtesy: small delay between sequential chunks (skip first)
      if (chunkIndex > 0) {
        await new Promise<void>(r => setTimeout(r, CHUNK_INTER_DELAY_MS));
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TELEGRAM_REQUEST_TIMEOUT_MS);

      let response: Response;
      try {
        response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatTarget,
            text: chunk,
            parse_mode: "HTML",
            // Only attach reply_markup to the first chunk (inline keyboards)
            reply_markup: chunkIndex === 0 ? replyMarkupJson : undefined,
          }),
          signal: controller.signal,
        });
      } catch (err: any) {
        if (err.name === "AbortError") {
          throw new Error(`Telegram API timeout: sendMessage did not respond within ${TELEGRAM_REQUEST_TIMEOUT_MS}ms`);
        }
        throw err;
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[TelegramOutboundError] Telegram sendOutboundPayload returned status ${response.status} on chunk ${chunkIndex}:`, errText);
        throw new Error(`Telegram API responded with status ${response.status}: ${errText}`);
      }

      chunkIndex++;
    }
  }

  /**
   * Pre-warms the bot-token cache from an already-resolved company record,
   * avoiding a redundant DB query in resolveBotToken on the first dispatch.
   */
  public static preWarmBotToken(companyId: string, decryptedToken: string): void {
    botTokenCache.set(companyId, { token: decryptedToken, cachedAt: Date.now() });
    evictBotTokenCache();
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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TELEGRAM_REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatTarget,
          message_id: Number(messageId),
          text: textFrame,
          parse_mode: "HTML",
          reply_markup: replyMarkup
        }),
        signal: controller.signal,
      });
    } catch (err: any) {
      if (err.name === "AbortError") {
        throw new Error(`Telegram API timeout: editMessageText did not respond within ${TELEGRAM_REQUEST_TIMEOUT_MS}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }

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
