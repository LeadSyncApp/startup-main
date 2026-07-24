import { Router, Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import { pgBossService } from "../../services/infrastructure/pgboss/pgboss.service";
import { Channel, StandardMessageFrame } from "../../interfaces/messaging.interface";
import { validateWebsiteWebhookSignature, WebhookPlatform } from "../../middleware/websiteWebhookValidator";

const router = Router();

async function logDelivery(
  companyId: string,
  platform: WebhookPlatform,
  outcome: string,
  statusCode: number,
  reason?: string,
  rawPayload?: string,
  rawHeaders?: string
) {
  try {
    await prisma.webhookDeliveryLog.create({
      data: { companyId, platform, outcome, statusCode, reason, rawPayload, rawHeaders },
    });
  } catch (err: any) {
    console.error("[WebhookDeliveryLog] Write failed:", err.message);
  }
}

/**
 * Country Dial Code Registry for automatic normalization of international checkout numbers
 */
const COUNTRY_DIAL_CODES: Record<string, string> = {
  IN: "91",
  US: "1",
  CA: "1",
  GB: "44",
  UK: "44",
  AU: "61",
  SG: "65",
  AE: "971",
  SA: "966",
  NZ: "64",
};

/**
 * Normalizes dynamic phone formats and prepends the correct country dial code if missing.
 * Defaults to Indian "91" if no country code can be matched or resolved.
 */
function normalizePhoneNumber(phone: string, countryCode?: string): string {
  const trimmedPhone = (phone || "").trim();
  
  // 1️⃣ Check if the customer explicitly entered a fully qualified international format (+ or 00)
  const isExplicitlyInternational = trimmedPhone.startsWith("+") || trimmedPhone.startsWith("00");
  
  // Extract only digits
  let digits = trimmedPhone.replace(/[^0-9]/g, "");
  
  if (isExplicitlyInternational) {
    if (digits.startsWith("00")) {
      // Map '00' or '+00' to the canonical international representation (strip the '00' prefix)
      digits = digits.substring(2);
    }
    // Return digits directly since user explicitly fully-qualified it
    if (digits.length >= 7) {
      return digits;
    }
  }

  const cleanCountry = (countryCode || "IN").trim().toUpperCase();
  const dialCode = COUNTRY_DIAL_CODES[cleanCountry] || "91"; // Fallback to 91 (India)

  // 2️⃣ If the digits already start with the resolved country's dial code, and length is valid
  if (digits.startsWith(dialCode) && digits.length > dialCode.length + 6) {
    return digits;
  }

  // 3️⃣ Normalize local numbers based on resolved country
  if (cleanCountry === "IN") {
    // Standard 10-digit mobile number inside India
    if (digits.length === 10) {
      return `91${digits}`;
    }
    // Strip leading 0 if present on an 11-digit entry in India
    if (digits.length === 11 && digits.startsWith("0")) {
      return `91${digits.substring(1)}`;
    }
  } else {
    // For general international formatting: if digits starts with leading '0', strip it before prepending dialCode
    if (digits.startsWith("0")) {
      digits = digits.substring(1);
    }
    // Prepend dialCode to typical local lengths (e.g., 5 to 11 digits)
    if (digits.length >= 5 && digits.length <= 11) {
      return `${dialCode}${digits}`;
    }
  }

  return digits; // Return raw digits if completely atypical
}

/**
 * 💻 WEBSITES WEBHOOK GATEWAY (Shopify, WooCommerce, Custom Storefronts)
 * Normalizes e-commerce transactional updates into cCommerce interaction streams.
 */
router.post("/:companyId", validateWebsiteWebhookSignature, async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.params;
  const body = req.body;
  const rawPayload = JSON.stringify(body).slice(0, 4000);
  const rawHeaders = JSON.stringify({
    "x-shopify-hmac-sha256": req.header("X-Shopify-Hmac-SHA256") ? "[present]" : undefined,
    "x-wc-webhook-signature": req.header("X-WC-Webhook-Signature") ? "[present]" : undefined,
    "x-webhook-signature": req.header("X-Webhook-Signature") ? "[present]" : undefined,
  });

  if (!companyId) {
    return res.status(400).json({ error: "Missing required route parameter companyId" });
  }

  const platform: WebhookPlatform = req.detectedPlatform || "custom";

  try {
    let customerName = "Website Customer";
    let contactPhone = "";
    let orderDetails = "";
    let totalAmount = 0;
    let rawAddress = "";
    let countryCode = "IN";

    // Platform detection is driven by which signature header the validator confirmed.
    // When platform is explicitly known, use ONLY that parser — never cross-match on shape.
    // Shape-based detection only runs as a fallback when no platform header was present
    // (should not happen after middleware, but kept as safety net).

    if (platform === "shopify") {
      // ── Shopify parser ──────────────────────────────────────────────────
      customerName = `${body.customer.first_name || ""} ${body.customer.last_name || ""}`.trim() || "Shopify Customer";
      contactPhone = body.customer.phone || body.billing_address?.phone || body.shipping_address?.phone || "";
      totalAmount = parseFloat(body.total_price);
      
      const items = body.line_items || [];
      const itemDescriptions = items.map((i: any) => `${i.quantity}x ${i.title}`).join(", ");
      orderDetails = `ordered ${itemDescriptions} (Total: ₹${totalAmount})`;
      
      const sa = body.shipping_address || {};
      rawAddress = [sa.address1, sa.address2, sa.city, sa.province, sa.zip, sa.country || "India"].filter(Boolean).join(", ");
      countryCode = sa.country_code || body.billing_address?.country_code || "IN";

    } else if (platform === "woocommerce") {
      // ── WooCommerce parser ──────────────────────────────────────────────
      customerName = `${body.billing.first_name || ""} ${body.billing.last_name || ""}`.trim() || "WooCommerce Customer";
      contactPhone = body.billing.phone || "";
      totalAmount = parseFloat(body.total);

      const items = body.line_items || [];
      const itemDescriptions = items.map((i: any) => `${i.quantity}x ${i.name}`).join(", ");
      orderDetails = `ordered ${itemDescriptions} (Total: ₹${totalAmount})`;

      const sa = body.shipping || {};
      rawAddress = [sa.address_1, sa.address_2, sa.city, sa.state, sa.postcode, sa.country || "India"].filter(Boolean).join(", ");
      countryCode = sa.country || body.billing.country || "IN";

    } else if (platform === "custom") {
      // ── Custom parser (header-confirmed, shape-independent) ──────────────
      customerName = body.customer?.name || body.name || "Store Shopper";
      contactPhone = body.customer?.phone || body.phone || "";
      totalAmount = parseFloat(body.total || body.amount || "0");
      
      const items = body.items || [];
      const itemDescriptions = items.map((i: any) => `${i.quantity || 1}x ${i.name || i.title}`).join(", ");
      orderDetails = itemDescriptions ? `ordered ${itemDescriptions} (Total: ₹${totalAmount})` : `placed an order (Total: ₹${totalAmount})`;
      
      rawAddress = body.shipping_address || body.address || "";
      countryCode = body.customer?.country_code || body.country_code || "IN";

    } else {
      // ── Shape-based fallback (should not normally be reached) ───────────
      if (body.total_price && body.customer) {
        customerName = `${body.customer.first_name || ""} ${body.customer.last_name || ""}`.trim() || "Shopify Customer";
        contactPhone = body.customer.phone || body.billing_address?.phone || body.shipping_address?.phone || "";
        totalAmount = parseFloat(body.total_price);
        const items = body.line_items || [];
        orderDetails = `ordered ${items.map((i: any) => `${i.quantity}x ${i.title}`).join(", ")} (Total: ₹${totalAmount})`;
        const sa = body.shipping_address || {};
        rawAddress = [sa.address1, sa.address2, sa.city, sa.province, sa.zip, sa.country || "India"].filter(Boolean).join(", ");
        countryCode = sa.country_code || body.billing_address?.country_code || "IN";
      } else if (body.billing && body.line_items && body.total) {
        customerName = `${body.billing.first_name || ""} ${body.billing.last_name || ""}`.trim() || "WooCommerce Customer";
        contactPhone = body.billing.phone || "";
        totalAmount = parseFloat(body.total);
        const items = body.line_items || [];
        orderDetails = `ordered ${items.map((i: any) => `${i.quantity}x ${i.name}`).join(", ")} (Total: ₹${totalAmount})`;
        const sa = body.shipping || {};
        rawAddress = [sa.address_1, sa.address_2, sa.city, sa.state, sa.postcode, sa.country || "India"].filter(Boolean).join(", ");
        countryCode = sa.country || body.billing.country || "IN";
      } else {
        customerName = body.customer?.name || body.name || "Store Shopper";
        contactPhone = body.customer?.phone || body.phone || "";
        totalAmount = parseFloat(body.total || body.amount || "0");
        const items = body.items || [];
        const itemDescriptions = items.map((i: any) => `${i.quantity || 1}x ${i.name || i.title}`).join(", ");
        orderDetails = itemDescriptions ? `ordered ${itemDescriptions} (Total: ₹${totalAmount})` : `placed an order (Total: ₹${totalAmount})`;
        rawAddress = body.shipping_address || body.address || "";
        countryCode = body.customer?.country_code || body.country_code || "IN";
      }
    }

    // Clean and validate phone contact footprint with extracted countryCode metadata mapping
    const sanitizedPhone = normalizePhoneNumber(contactPhone, countryCode);

    // Guard: website frames require at least a valid contact phone number to sync leads
    if (!sanitizedPhone || sanitizedPhone.length < 10) {
      console.warn(`⚠️ [Website Sink] Dropped order from ${customerName}: Missing or invalid contact phone number [${contactPhone}] for CRM sync.`);
      await logDelivery(companyId, platform, "ignored", 200, "Missing phone", rawPayload, rawHeaders);
      return res.status(200).json({ status: "ignored", reason: "Missing phone contact details" });
    }

    // Structure a conversational intent message simulating the transaction checkout request
    const mockIntentText = `I want to order: ${orderDetails}. My details: name: ${customerName}, phone: ${sanitizedPhone}, address: ${rawAddress}`;

    const standardizedFrame: StandardMessageFrame = {
      channel: Channel.WEBSITE,
      externalChatId: sanitizedPhone,
      text: mockIntentText,
      contactName: customerName,
      isCallback: false,
      companyId: companyId
    };

    // Enqueue the parsed frame straight into pg-boss with isolated fault protection
    try {
      const boss = pgBossService.getBoss();
      await boss.send("webhook.process", standardizedFrame);
    } catch (queueError) {
      console.error("🚨 [Queue Broker Injection Failure] Unable to enqueue frame to pg-boss:", queueError);
      await logDelivery(companyId, platform, "error", 500, "Queue failure", rawPayload, rawHeaders);
      return res.status(500).json({ 
        status: "error", 
        message: "Failed to enqueue webhook payload. Please retry." 
      });
    }

    await logDelivery(companyId, platform, "accepted", 202, undefined, rawPayload, rawHeaders);
    return res.status(202).json({ status: "accepted", message: "Normalized website payload enqueued" });
  } catch (error: any) {
    console.error("❌ [Website Sink Fatal Crash] Failed to normalize website webhook:", error);
    await logDelivery(companyId, platform, "error", 500, error.message?.slice(0, 500), rawPayload, rawHeaders);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
