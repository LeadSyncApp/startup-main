import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

export interface SignatureVerifiedRequest extends Request {
    rawBody?: Buffer;
}

/**
 * Express middleware to validate structural X-Hub-Signature-256 headers from Meta platforms.
 * Uses a cryptographically timing-safe equality check to block timing attacks.
 */
export function validateMetaWebhookSignature(req: SignatureVerifiedRequest, res: Response, next: NextFunction) {
    const signatureHeader = req.header("X-Hub-Signature-256") || req.header("x-hub-signature-256");
    if (!signatureHeader) {
        console.warn("🚨 [Signature Verification] Missing X-Hub-Signature-256 header. Rejecting webhook request.");
        return res.status(401).json({ error: "Unauthorized: Missing signature header." });
    }

    const appSecret = process.env.WHATSAPP_APP_SECRET;
    if (!appSecret) {
        console.error("🚨 [Signature Verification] Server Error: WHATSAPP_APP_SECRET environment variable is not defined.");
        return res.status(500).json({ error: "Internal Server Error: Secret verification key missing." });
    }

    // Split the format "sha256=signature"
    const parts = signatureHeader.split("=");
    if (parts.length !== 2 || parts[0].toLowerCase() !== "sha256") {
        console.warn("🚨 [Signature Verification] Invalid signature header format. Rejecting webhook request.");
        return res.status(401).json({ error: "Unauthorized: Invalid signature format prefix." });
    }

    const signatureHex = parts[1];
    const signatureBuffer = Buffer.from(signatureHex, "hex");

    // Fetch the raw request body buffer captured during Body Parsing
    const rawBodyBuffer = req.rawBody || (req.body ? Buffer.from(typeof req.body === "string" ? req.body : JSON.stringify(req.body)) : Buffer.alloc(0));

    // Calculate the HMAC using SHA-256 and the app secret
    const hmac = crypto.createHmac("sha256", appSecret);
    hmac.update(rawBodyBuffer);
    const computedBuffer = hmac.digest();

    // Use cryptographically secure timingSafeEqual comparison to mitigate timing attacks
    try {
        if (computedBuffer.length !== signatureBuffer.length || !crypto.timingSafeEqual(computedBuffer, signatureBuffer)) {
            console.warn("🚨 [Signature Verification] Digital signature mismatch. Rejecting webhook request.");
            return res.status(401).json({ error: "Unauthorized: Invalid digital signature mismatch." });
        }
    } catch (err: any) {
        console.error("🚨 [Signature Verification] Error performing secure signature verification comparison:", err.message);
        return res.status(401).json({ error: "Unauthorized: Signature check failure comparison." });
    }

    console.log("✅ [Signature Verification] Meta webhook payload validated successfully. Request passed to routing queue.");
    return next();
}
