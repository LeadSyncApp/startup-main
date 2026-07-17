import { prisma } from "../../lib/prisma";
import { IntegrationCredentialsMissingError } from "../../interfaces/outbound.interface";
import axios, { AxiosError } from "axios";

interface TelegramSendMessagePayload {
  chat_id: string | number;
  text: string;
}

interface TelegramApiResponse {
  ok: boolean;
  result?: {
    message_id: number;
    text?: string;
  };
  description?: string;
}

/**
 * Executes a POST request with strict 4 seconds timeout and exponential backoff.
 */
async function postWithRetry<R>(
  url: string,
  data: unknown,
  headers?: Record<string, string>,
  maxRetries = 3,
  initialDelay = 500
): Promise<R> {
  let attempt = 0;
  while (attempt < maxRetries) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // Strict timebox boundary of 4 seconds

    try {
      const response = await axios.post<R>(url, data, {
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response.data;
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      
      let isTransient = false;
      let status: number | undefined;

      if (axios.isAxiosError(error)) {
        const err = error as AxiosError;
        status = err.response?.status;
        
        // Target transient HTTP codes specifically (429 Too Many Requests, 5xx Server Error)
        if (status === 429 || (status !== undefined && status >= 500 && status < 600)) {
          isTransient = true;
        }
        
        if (err.name === "CanceledError" || err.code === "ECONNABORTED") {
          // Timeout boundary triggered
          if (attempt < maxRetries - 1) {
            isTransient = true;
          } else {
            throw new Error(`Outbound dispatch to Telegram timed out after 4000ms on attempt ${attempt + 1}`);
          }
        }
      } else if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
        if (attempt < maxRetries - 1) {
          isTransient = true;
        } else {
          throw new Error(`Outbound dispatch to Telegram timed out after 4000ms on attempt ${attempt + 1}`);
        }
      }

      if (isTransient && attempt < maxRetries - 1) {
        attempt++;
        const delay = initialDelay * Math.pow(2, attempt);
        console.warn(`[TelegramAdapter Retry] Attempt ${attempt} failed on status ${status || "Timeout"}. Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  throw new Error("Outbound Telegram dispatch maximum retries exceeded");
}

export class TelegramAdapter {
  /**
   * Sends an outbound text message to a specific Telegram Chat ID on behalf of a tenant.
   * Resolves the Telegram Token dynamically and securely from the database.
   */
  public async sendMessage(companyId: string, toChatId: string, content: string): Promise<void> {
    // 1. Strict Input Verification
    if (!companyId || typeof companyId !== "string" || companyId.trim() === "") {
      throw new Error("TelegramAdapter.sendMessage: Invalid or missing companyId");
    }
    if (!toChatId || typeof toChatId !== "string" || toChatId.trim() === "") {
      throw new Error("TelegramAdapter.sendMessage: Invalid or missing toChatId (recipient)");
    }
    if (!content || typeof content !== "string" || content.trim() === "") {
      throw new Error("TelegramAdapter.sendMessage: Invalid or missing message content");
    }

    // 2. Tenant Token Sandboxing - Dynamic Database lookup
    const company = await prisma.company.findUnique({
      where: { id: companyId }
    });

    if (!company) {
      throw new Error(`Company not found with ID: "${companyId}"`);
    }

    const token = company.telegramBotToken;
    if (!token || token.trim() === "") {
      console.error(`[TelegramAdapter] Integration credentials missing for companyId: "${companyId}"`);
      throw new IntegrationCredentialsMissingError(companyId, "TELEGRAM");
    }

    // 3. Resilient Outbound Transport Delivery
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const payload: TelegramSendMessagePayload = {
      chat_id: toChatId,
      text: content
    };

    try {
      console.log(`📡 [TelegramAdapter] Dispatching message to chat: "${toChatId}" for company: "${companyId}"`);
      const response = await postWithRetry<TelegramApiResponse>(url, payload);
      
      if (!response.ok) {
        throw new Error(`Telegram API responded with unhealthy status: ${response.description || "Unknown Error"}`);
      }
      console.log(`✅ [TelegramAdapter] Message successfully dispatched to chat: "${toChatId}"`);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`❌ [TelegramAdapter] Transport failure sending to chat: "${toChatId}". Error: ${errMsg}`);
      throw err;
    }
  }
}

export const telegramAdapterService = new TelegramAdapter();
