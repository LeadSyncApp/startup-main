import { Router, Request, Response } from "express";
import { pgBossService } from "../../services/infrastructure/pgboss/pgboss.service";
import { Channel, StandardMessageFrame } from "../../interfaces/messaging.interface";

const router = Router();

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
router.post("/:companyId", async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.params;
  const body = req.body;

  if (!companyId) {
    return res.status(400).json({ error: "Missing required route parameter companyId" });
  }

  try {
    let customerName = "Website Customer";
    let contactPhone = "";
    let orderDetails = "";
    let totalAmount = 0;
    let rawAddress = "";
    let countryCode = "IN";

    // 1️⃣ Normalize Shopify payloads
    if (body.total_price && body.customer) {
      customerName = `${body.customer.first_name || ""} ${body.customer.last_name || ""}`.trim() || "Shopify Customer";
      contactPhone = body.customer.phone || body.billing_address?.phone || body.shipping_address?.phone || "";
      totalAmount = parseFloat(body.total_price);
      
      const items = body.line_items || [];
      const itemDescriptions = items.map((i: any) => `${i.quantity}x ${i.title}`).join(", ");
      orderDetails = `ordered ${itemDescriptions} (Total: ₹${totalAmount})`;
      
      const sa = body.shipping_address || {};
      rawAddress = [sa.address1, sa.address2, sa.city, sa.province, sa.zip, sa.country || "India"].filter(Boolean).join(", ");
      countryCode = sa.country_code || body.billing_address?.country_code || "IN";
    } 
    // 2️⃣ Normalize WooCommerce payloads
    else if (body.billing && body.line_items && body.total) {
      customerName = `${body.billing.first_name || ""} ${body.billing.last_name || ""}`.trim() || "WooCommerce Customer";
      contactPhone = body.billing.phone || "";
      totalAmount = parseFloat(body.total);

      const items = body.line_items || [];
      const itemDescriptions = items.map((i: any) => `${i.quantity}x ${i.name}`).join(", ");
      orderDetails = `ordered ${itemDescriptions} (Total: ₹${totalAmount})`;

      const sa = body.shipping || {};
      rawAddress = [sa.address_1, sa.address_2, sa.city, sa.state, sa.postcode, sa.country || "India"].filter(Boolean).join(", ");
      countryCode = sa.country || body.billing.country || "IN";
    }
    // 3️⃣ Normalize Custom Webhooks
    else {
      customerName = body.customer?.name || body.name || "Store Shopper";
      contactPhone = body.customer?.phone || body.phone || "";
      totalAmount = parseFloat(body.total || body.amount || "0");
      
      const items = body.items || [];
      const itemDescriptions = items.map((i: any) => `${i.quantity || 1}x ${i.name || i.title}`).join(", ");
      orderDetails = itemDescriptions ? `ordered ${itemDescriptions} (Total: ₹${totalAmount})` : `placed an order (Total: ₹${totalAmount})`;
      
      rawAddress = body.shipping_address || body.address || "";
      countryCode = body.customer?.country_code || body.country_code || "IN";
    }

    // Clean and validate phone contact footprint with extracted countryCode metadata mapping
    const sanitizedPhone = normalizePhoneNumber(contactPhone, countryCode);

    // Guard: website frames require at least a valid contact phone number to sync leads
    if (!sanitizedPhone || sanitizedPhone.length < 10) {
      console.warn(`⚠️ [Website Sink] Dropped order from ${customerName}: Missing or invalid contact phone number [${contactPhone}] for CRM sync.`);
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
      // Log error heavily, but return an HTTP 202 to protect external platform webhook registration
      console.error("🚨 [Queue Broker Injection Failure] Unable to enqueue frame to pg-boss natively:", queueError);
      return res.status(202).json({ 
        status: "accepted", 
        message: "Payload received, pending asynchronous broker synchronization catch-up." 
      });
    }

    return res.status(202).json({ status: "accepted", message: "Normalized website payload enqueued" });
  } catch (error: any) {
    console.error("❌ [Website Sink Fatal Crash] Failed to normalize website webhook:", error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
