import { Router, Request, Response } from "express";
import rateLimit, { MemoryStore } from "express-rate-limit";
import { prisma } from "../../lib/prisma";
import { pgBossService } from "../../services/infrastructure/pgboss/pgboss.service";
import { Channel, StandardMessageFrame } from "../../interfaces/messaging.interface";
import { emitToVisitor } from "../../lib/socket";

const router = Router();

// Country dial code lookup helper
const COUNTRY_DIAL_CODES: Record<string, string> = {
  IN: "91", US: "1", CA: "1", GB: "44", UK: "44", AU: "61", SG: "65", AE: "971", SA: "966", NZ: "64",
};

function normalizePhoneNumber(phone: string, countryCode: string = "IN"): string {
  const trimmedPhone = (phone || "").trim();
  const isExplicitlyInternational = trimmedPhone.startsWith("+") || trimmedPhone.startsWith("00");
  let digits = trimmedPhone.replace(/[^0-9]/g, "");

  if (isExplicitlyInternational) {
    if (digits.startsWith("00")) digits = digits.substring(2);
    if (digits.length >= 7) return digits;
  }

  const cleanCountry = countryCode.trim().toUpperCase();
  const dialCode = COUNTRY_DIAL_CODES[cleanCountry] || "91";

  if (digits.startsWith(dialCode) && digits.length > dialCode.length + 6) {
    return digits;
  }

  if (cleanCountry === "IN") {
    if (digits.length === 10) return `91${digits}`;
    if (digits.length === 11 && digits.startsWith("0")) return `91${digits.substring(1)}`;
  } else {
    if (digits.startsWith("0")) digits = digits.substring(1);
    if (digits.length >= 5 && digits.length <= 11) return `${dialCode}${digits}`;
  }

  return digits;
}

// ── Rate Limiters for Widget Ingestion ──────────────────────────────
const widgetPostLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 15, // max 15 submissions per min per IP
  standardHeaders: true,
  legacyHeaders: false,
  store: new MemoryStore(),
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      status: "rate_limited",
      message: "You are sending messages too quickly. Please wait 15 seconds.",
      retryAfter: 15
    });
  }
});

// ── Per-Company Rate Limiter for Widget Message Ingestion ──────────────────────
const companyWidgetPostLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // max 60 submissions per min per company
  keyGenerator: (req: Request) => {
    return req.body?.companyId ? `company_${req.body.companyId}` : (req.ip || "unknown");
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: new MemoryStore(),
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      status: "rate_limited",
      message: "Store messaging rate limit exceeded. Please wait a minute.",
      retryAfter: 60
    });
  }
});

const widgetGetLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60, // max 60 polls/fetches per min per IP
  standardHeaders: true,
  legacyHeaders: false,
  store: new MemoryStore(),
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      status: "rate_limited",
      message: "Polling rate limit exceeded. Please wait a moment.",
      retryAfter: 10
    });
  }
});

/**
 * 💬 POST /api/widget/message
 * Public intake endpoint for visitor messages originating from embeddable website widget.
 */
router.post("/message", widgetPostLimiter, companyWidgetPostLimiter, async (req: Request, res: Response): Promise<Response> => {
  const { companyId, visitorToken, name, phone, message } = req.body;

  if (!companyId || typeof companyId !== "string") {
    return res.status(400).json({ error: "Missing required field: companyId" });
  }

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Message content cannot be empty" });
  }

  try {
    // 1️⃣ Validate company exists and is active
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, isArchived: true }
    });

    if (!company || company.isArchived) {
      return res.status(404).json({ error: "Target store workspace not found or inactive" });
    }

    // 2️⃣ Sanitize visitor contact information
    const rawPhone = phone || visitorToken || `visitor-${Date.now()}`;
    const sanitizedPhone = normalizePhoneNumber(rawPhone);
    const visitorName = (name || "").trim() || "Website Visitor";

    // 3️⃣ Construct StandardMessageFrame for pg-boss
    const standardizedFrame: StandardMessageFrame = {
      channel: Channel.WEBSITE,
      externalChatId: sanitizedPhone,
      text: message.trim().slice(0, 2000), // Max 2000 chars safety cap
      contactName: visitorName,
      isCallback: false,
      companyId: companyId
    };

    // 4️⃣ Enqueue to pg-boss
    const boss = pgBossService.getBoss();
    await boss.send("webhook.process", standardizedFrame);

    // If visitorToken exists, emit socket event acknowledging receipt
    if (visitorToken) {
      emitToVisitor(visitorToken, "visitor_message_received", {
        text: message.trim(),
        sender: visitorName,
        createdAt: new Date().toISOString()
      });
    }

    // Find existing conversation ID if available for socket room joining
    const existingLead = await prisma.lead.findFirst({
      where: { companyId, contact: sanitizedPhone, channel: Channel.WEBSITE },
      select: { conversations: { where: { companyId, deletedAt: null }, select: { id: true }, orderBy: { updatedAt: "desc" }, take: 1 } }
    });
    const conversationId = existingLead?.conversations?.[0]?.id || null;

    return res.status(202).json({
      status: "accepted",
      message: "Message received",
      sanitizedPhone,
      visitorToken,
      conversationId
    });
  } catch (error: any) {
    console.error("❌ [Widget Endpoint Error]:", error);
    return res.status(500).json({ error: error.message || "Failed to process widget message" });
  }
});

/**
 * 💬 GET /api/widget/messages
 * Retrieves message history for visitor matching visitorToken or phone number.
 */
router.get("/messages", widgetGetLimiter, async (req: Request, res: Response): Promise<Response> => {
  const { companyId, visitorToken, phone } = req.query;

  if (!companyId || typeof companyId !== "string") {
    return res.status(400).json({ error: "Missing required parameter: companyId" });
  }

  if (!visitorToken && !phone) {
    return res.status(400).json({ error: "Provide visitorToken or phone number to retrieve history" });
  }

  try {
    const searchPhone = phone ? normalizePhoneNumber(phone as string) : "";
    const searchContact = searchPhone || (visitorToken as string);

    // Find lead matching phone or visitorToken under WEBSITE channel
    const lead = await prisma.lead.findFirst({
      where: {
        companyId: companyId as string,
        channel: Channel.WEBSITE,
        contact: searchContact
      },
      include: {
        conversations: {
          where: { companyId: companyId as string, deletedAt: null },
          orderBy: { updatedAt: "desc" },
          take: 1,
          include: {
            messages: {
              orderBy: { createdAt: "asc" },
              take: 50
            }
          }
        }
      }
    });

    if (!lead || !lead.conversations || lead.conversations.length === 0) {
      return res.json({ messages: [], leadName: lead?.name || null });
    }

    const activeConv = lead.conversations[0];
    const formattedMessages = activeConv.messages.map((m: any) => ({
      id: m.id,
      text: m.content,
      direction: m.sender === "CLIENT" ? "INBOUND" : "OUTBOUND",
      createdAt: m.createdAt,
      senderName: m.sender === "CLIENT" ? lead.name : (m.senderName || "Shop Support")
    }));

    return res.json({
      messages: formattedMessages,
      leadName: lead.name,
      phone: lead.contact
    });
  } catch (error: any) {
    console.error("❌ [Widget History Error]:", error);
    return res.status(500).json({ error: error.message || "Failed to fetch widget history" });
  }
});

export default router;
