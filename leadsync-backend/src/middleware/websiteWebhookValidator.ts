import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { prisma } from "../lib/prisma";

export type WebhookPlatform = "custom" | "shopify" | "woocommerce";

declare global {
  namespace Express {
    interface Request {
      detectedPlatform?: WebhookPlatform;
    }
  }
}

function getRawBodyBuffer(req: Request): Buffer {
  if ((req as any).rawBody) {
    const rb = (req as any).rawBody;
    return typeof rb === "string" ? Buffer.from(rb) : rb;
  }
  if (req.body) {
    if (Buffer.isBuffer(req.body)) return req.body;
    return Buffer.from(typeof req.body === "string" ? req.body : JSON.stringify(req.body));
  }
  return Buffer.alloc(0);
}

async function logRejection(
  companyId: string,
  platform: WebhookPlatform,
  statusCode: number,
  reason: string,
  rawPayload?: string,
  rawHeaders?: string
) {
  try {
    await prisma.webhookDeliveryLog.create({
      data: { companyId, platform, outcome: "rejected", statusCode, reason, rawPayload, rawHeaders },
    });
  } catch (err: any) {
    console.error("[WebhookDeliveryLog] Rejection log write failed:", err.message);
  }
}

function timingSafeCompare(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Unified HMAC-SHA256 validation for three webhook platforms:
 *
 *   Shopify:     Header X-Shopify-Hmac-SHA256, base64-encoded HMAC, secret = shopifyWebhookSecret
 *   WooCommerce: Header X-WC-Webhook-Signature, base64-encoded HMAC, secret = wooCommerceWebhookSecret
 *   Custom:      Header X-Webhook-Signature: sha256=<hex>,           secret = websiteWebhookSecret
 *
 * The middleware detects which header is present, loads the matching
 * secret from the Company record, and rejects the request if none match.
 *
 * On success, req.detectedPlatform is set so downstream handlers can
 * pick the right parser without re-checking headers.
 */
export async function validateWebsiteWebhookSignature(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const companyId = req.params.companyId;

  const shopifySig = req.header("X-Shopify-Hmac-SHA256") || req.header("x-shopify-hmac-sha256");
  const wooSig = req.header("X-WC-Webhook-Signature") || req.header("x-wc-webhook-signature");
  const customSig = req.header("X-Webhook-Signature") || req.header("x-webhook-signature");

  if (!shopifySig && !wooSig && !customSig) {
    console.warn("[WebsiteWebhookAuth] No recognized signature header. Rejecting request.");
    res.status(401).json({ error: "Unauthorized: Missing signature header." });
    return;
  }

  if (!companyId) {
    res.status(400).json({ error: "Missing companyId for signature verification." });
    return;
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      shopifyWebhookSecret: true,
      wooCommerceWebhookSecret: true,
      websiteWebhookSecret: true,
    },
  });

  if (!company) {
    res.status(404).json({ error: "Company not found for the provided companyId." });
    return;
  }

  const rawBody = getRawBodyBuffer(req);
  const rawHeaders = JSON.stringify({
    "x-shopify-hmac-sha256": shopifySig ? "[present]" : undefined,
    "x-wc-webhook-signature": wooSig ? "[present]" : undefined,
    "x-webhook-signature": customSig ? "[present]" : undefined,
  });
  const payloadSnippet = rawBody.toString("utf-8").slice(0, 4000);

  if (shopifySig) {
    if (!company.shopifyWebhookSecret) {
      console.warn(`[WebsiteWebhookAuth] Company ${companyId} has no shopifyWebhookSecret. Rejecting Shopify webhook.`);
      await logRejection(companyId, "shopify", 401, "Shopify secret not configured", payloadSnippet, rawHeaders);
      res.status(401).json({ error: "Unauthorized: Shopify webhook secret not configured." });
      return;
    }
    const expected = crypto.createHmac("sha256", company.shopifyWebhookSecret).update(rawBody).digest("base64");
    if (!timingSafeCompare(Buffer.from(shopifySig, "utf-8"), Buffer.from(expected, "utf-8"))) {
      console.warn(`[WebsiteWebhookAuth] Shopify HMAC mismatch for company ${companyId}.`);
      await logRejection(companyId, "shopify", 401, "Invalid Shopify signature", payloadSnippet, rawHeaders);
      res.status(401).json({ error: "Unauthorized: Invalid Shopify signature." });
      return;
    }
    console.log(`[WebsiteWebhookAuth] Shopify signature verified for company ${companyId}.`);
    req.detectedPlatform = "shopify";
    return next();
  }

  if (wooSig) {
    if (!company.wooCommerceWebhookSecret) {
      console.warn(`[WebsiteWebhookAuth] Company ${companyId} has no wooCommerceWebhookSecret. Rejecting WooCommerce webhook.`);
      await logRejection(companyId, "woocommerce", 401, "WooCommerce secret not configured", payloadSnippet, rawHeaders);
      res.status(401).json({ error: "Unauthorized: WooCommerce webhook secret not configured." });
      return;
    }
    const expected = crypto.createHmac("sha256", company.wooCommerceWebhookSecret).update(rawBody).digest("base64");
    if (!timingSafeCompare(Buffer.from(wooSig, "utf-8"), Buffer.from(expected, "utf-8"))) {
      console.warn(`[WebsiteWebhookAuth] WooCommerce HMAC mismatch for company ${companyId}.`);
      await logRejection(companyId, "woocommerce", 401, "Invalid WooCommerce signature", payloadSnippet, rawHeaders);
      res.status(401).json({ error: "Unauthorized: Invalid WooCommerce signature." });
      return;
    }
    console.log(`[WebsiteWebhookAuth] WooCommerce signature verified for company ${companyId}.`);
    req.detectedPlatform = "woocommerce";
    return next();
  }

  if (customSig) {
    const parts = customSig.split("=");
    if (parts.length !== 2 || parts[0].toLowerCase() !== "sha256") {
      console.warn("[WebsiteWebhookAuth] Invalid custom signature format. Expected sha256=<hex>.");
      await logRejection(companyId, "custom", 401, "Invalid signature format", payloadSnippet, rawHeaders);
      res.status(401).json({ error: "Unauthorized: Invalid signature format." });
      return;
    }
    if (!company.websiteWebhookSecret) {
      console.warn(`[WebsiteWebhookAuth] Company ${companyId} has no websiteWebhookSecret. Rejecting custom webhook.`);
      await logRejection(companyId, "custom", 401, "Custom secret not configured", payloadSnippet, rawHeaders);
      res.status(401).json({ error: "Unauthorized: Webhook secret not configured for this company." });
      return;
    }
    const signatureBuffer = Buffer.from(parts[1], "hex");
    const hmac = crypto.createHmac("sha256", company.websiteWebhookSecret);
    hmac.update(rawBody);
    const computedBuffer = hmac.digest();

    if (!timingSafeCompare(computedBuffer, signatureBuffer)) {
      console.warn(`[WebsiteWebhookAuth] Custom HMAC mismatch for company ${companyId}.`);
      await logRejection(companyId, "custom", 401, "Invalid signature", payloadSnippet, rawHeaders);
      res.status(401).json({ error: "Unauthorized: Invalid signature." });
      return;
    }
    console.log(`[WebsiteWebhookAuth] Custom signature verified for company ${companyId}.`);
    req.detectedPlatform = "custom";
    return next();
  }

  res.status(401).json({ error: "Unauthorized: Missing signature header." });
}
