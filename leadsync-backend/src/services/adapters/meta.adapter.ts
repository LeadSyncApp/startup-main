import { prisma } from "../../lib/prisma";
import { IntegrationCredentialsMissingError } from "../../interfaces/outbound.interface";
import axios, { AxiosError } from "axios";

interface WhatsAppTextPayload {
  messaging_product: "whatsapp";
  recipient_type: "individual";
  to: string;
  type: "text";
  text: {
    preview_url: boolean;
    body: string;
  };
}

interface MetaApiContact {
  input: string;
  wa_id: string;
}

interface MetaApiMessage {
  id: string;
}

interface MetaApiOuterError {
  message: string;
  type: string;
  code: number;
  error_data?: {
    messaging_product: string;
    details: string;
  };
  fbtrace_id: string;
}

interface MetaApiResponse {
  messaging_product?: string;
  contacts?: MetaApiContact[];
  messages?: MetaApiMessage[];
  error?: MetaApiOuterError;
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
            throw new Error(`Outbound dispatch to Meta/WhatsApp timed out after 4000ms on attempt ${attempt + 1}`);
          }
        }
      } else if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
        if (attempt < maxRetries - 1) {
          isTransient = true;
        } else {
          throw new Error(`Outbound dispatch to Meta/WhatsApp timed out after 4000ms on attempt ${attempt + 1}`);
        }
      }

      if (isTransient && attempt < maxRetries - 1) {
        attempt++;
        const delay = initialDelay * Math.pow(2, attempt);
        console.warn(`[MetaAdapter Retry] Attempt ${attempt} failed on status ${status || "Timeout"}. Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  throw new Error("Outbound Meta/WhatsApp dispatch maximum retries exceeded");
}

export class MetaAdapter {
  /**
   * Sends an outbound text message to WhatsApp Cloud API on behalf of a tenant.
   * Resolves WhatsApp credentials dynamically and securely from the database.
   */
  public async sendWhatsAppMessage(companyId: string, toPhoneNumber: string, content: string): Promise<void> {
    // 1. Strict Input Verification
    if (!companyId || typeof companyId !== "string" || companyId.trim() === "") {
      throw new Error("MetaAdapter.sendWhatsAppMessage: Invalid or missing companyId");
    }
    if (!toPhoneNumber || typeof toPhoneNumber !== "string" || toPhoneNumber.trim() === "") {
      throw new Error("MetaAdapter.sendWhatsAppMessage: Invalid or missing toPhoneNumber (recipient)");
    }
    if (!content || typeof content !== "string" || content.trim() === "") {
      throw new Error("MetaAdapter.sendWhatsAppMessage: Invalid or missing message content");
    }

    // 2. Tenant Token Sandboxing - Dynamic Database lookup
    const company = await prisma.company.findUnique({
      where: { id: companyId }
    });

    if (!company) {
      throw new Error(`Company not found with ID: "${companyId}"`);
    }

    const systemToken = company.whatsAppSystemToken;
    const phoneNumberId = company.whatsAppPhoneNumberId;

    if (!systemToken || systemToken.trim() === "" || !phoneNumberId || phoneNumberId.trim() === "") {
      console.error(`[MetaAdapter] Integration credentials missing for companyId: "${companyId}"`);
      throw new IntegrationCredentialsMissingError(companyId, "WHATSAPP");
    }

    // 3. Resilient Outbound Transport Delivery
    const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;
    const headers = {
      "Authorization": `Bearer ${systemToken}`,
      "Content-Type": "application/json"
    };

    const payload: WhatsAppTextPayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toPhoneNumber,
      type: "text",
      text: {
        preview_url: false,
        body: content
      }
    };

    try {
      console.log(`📡 [MetaAdapter] Dispatching WhatsApp message to: "${toPhoneNumber}" for company: "${companyId}"`);
      const response = await postWithRetry<MetaApiResponse>(url, payload, headers);
      
      if (response.error) {
        throw new Error(`Meta API error response: ${response.error.message} (Code: ${response.error.code})`);
      }
      
      console.log(`✅ [MetaAdapter] WhatsApp message successfully dispatched to: "${toPhoneNumber}"`);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`❌ [MetaAdapter] Transport failure sending WhatsApp to: "${toPhoneNumber}". Error: ${errMsg}`);
      throw err;
    }
  }

  /**
   * Sends an outbound text message to Instagram via Meta Graph API on behalf of a tenant.
   */
  public async sendInstagramMessage(companyId: string, toUserId: string, content: string): Promise<void> {
    // 1. Strict Input Verification
    if (!companyId || typeof companyId !== "string" || companyId.trim() === "") {
      throw new Error("MetaAdapter.sendInstagramMessage: Invalid or missing companyId");
    }
    if (!toUserId || typeof toUserId !== "string" || toUserId.trim() === "") {
      throw new Error("MetaAdapter.sendInstagramMessage: Invalid or missing toUserId (recipient)");
    }
    if (!content || typeof content !== "string" || content.trim() === "") {
      throw new Error("MetaAdapter.sendInstagramMessage: Invalid or missing message content");
    }

    // 2. Tenant Token Sandboxing - Dynamic Database lookup
    const company = await prisma.company.findUnique({
      where: { id: companyId }
    });

    if (!company) {
      throw new Error(`Company not found with ID: "${companyId}"`);
    }

    const pageAccessToken = company.instagramPageAccessToken;
    if (!pageAccessToken || pageAccessToken.trim() === "") {
      console.error(`[MetaAdapter] Instagram credentials missing for companyId: "${companyId}"`);
      throw new IntegrationCredentialsMissingError(companyId, "INSTAGRAM");
    }

    // 3. Resilient Outbound Transport Delivery
    const url = `https://graph.facebook.com/v19.0/me/messages`;
    const headers = {
      "Authorization": `Bearer ${pageAccessToken}`,
      "Content-Type": "application/json"
    };

    const payload = {
      messaging_product: "instagram",
      recipient: { id: toUserId },
      message: { text: content }
    };

    try {
      console.log(`📡 [MetaAdapter] Dispatching Instagram message to: "${toUserId}" for company: "${companyId}"`);
      const response = await postWithRetry<MetaApiResponse>(url, payload, headers);

      if (response.error) {
        throw new Error(`Meta API error response: ${response.error.message} (Code: ${response.error.code})`);
      }

      console.log(`✅ [MetaAdapter] Instagram message successfully dispatched to: "${toUserId}"`);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`❌ [MetaAdapter] Transport failure sending Instagram to: "${toUserId}". Error: ${errMsg}`);
      throw err;
    }
  }
}

export const metaAdapterService = new MetaAdapter();
