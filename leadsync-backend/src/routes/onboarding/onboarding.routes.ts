import { Router, Response } from "express";
import { prisma } from "../../lib/prisma";
import { authMiddleware, AuthRequest } from "../../middleware/auth.middleware";
import { generateFastReply } from "../../services/ai/ai.service";

const router = Router();

/**
 * POST /api/onboarding/demo-reply
 * Lightweight AI reply for the onboarding "Try it live" demo chat.
 * Zero-dependency: no InventoryProduct reads, no tenantContextStorage,
 * no DB writes — only reads the company name for the prompt.
 */
router.post("/demo-reply", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const companyId = req.user?.companyId;
    if (!userId || !companyId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { user_message } = req.body;
    if (!user_message || typeof user_message !== "string" || !user_message.trim()) {
      return res.status(400).json({ message: "user_message is required" });
    }

    // Read-only: fetch company name only
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true },
    });

    const businessName = company?.name || "this business";

    const result = await generateFastReply({
      user_message: user_message.trim(),
      detected_language: "en",
      business_name: businessName,
    });

    res.json(result);
  } catch (err: any) {
    console.error("[Onboarding Demo Reply] Error:", err?.message || String(err));
    res.status(500).json({
      replyText: "Hello! How can I help you today?",
      intent_type: "Query",
    });
  }
});

export default router;
