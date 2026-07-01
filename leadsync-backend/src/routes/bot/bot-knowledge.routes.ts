import { Router, Response } from "express";
import { prisma } from "../../lib/prisma";
import { authMiddleware, AuthRequest } from "../../middleware/auth.middleware";

const router = Router();

/* GET /api/bot-knowledge — list all for company */
router.get("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { companyId } = req.user!;
    const items = await (prisma.botKnowledge as any).findMany({
      where: { 
        companyId,
        type: { not: "TELEGRAM_CONSUMER_LEASE" }
      },
      orderBy: { createdAt: "asc" },
    });
    res.json(items);
  } catch (e) {
    res.status(500).json({ message: "Failed to fetch knowledge items" });
  }
});

/* POST /api/bot-knowledge — create */
router.post("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { companyId, role } = req.user!;
    if (role === "STAFF") return res.status(403).json({ message: "Forbidden" });

    const { type = "FAQ", title, content } = req.body;
    if (!title?.trim() || !content?.trim())
      return res.status(400).json({ message: "title and content are required" });

    const item = await (prisma.botKnowledge as any).create({
      data: { companyId, type, title: title.trim(), content: content.trim() },
    });
    res.status(201).json(item);
  } catch (e) {
    res.status(500).json({ message: "Failed to create knowledge item" });
  }
});

/* PATCH /api/bot-knowledge/:id — update or toggle */
router.patch("/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { companyId, role } = req.user!;
    if (role === "STAFF") return res.status(403).json({ message: "Forbidden" });

    const existing = await (prisma.botKnowledge as any).findFirst({
      where: { id: req.params.id, companyId },
    });
    if (!existing) return res.status(404).json({ message: "Not found" });

    const { type, title, content, isActive } = req.body;
    const updated = await (prisma.botKnowledge as any).update({
      where: { id: req.params.id },
      data: {
        ...(type !== undefined && { type }),
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
        ...(isActive !== undefined && { isActive }),
      },
    });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ message: "Failed to update knowledge item" });
  }
});

/* DELETE /api/bot-knowledge/:id */
router.delete("/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { companyId, role } = req.user!;
    if (role === "STAFF") return res.status(403).json({ message: "Forbidden" });

    const existing = await (prisma.botKnowledge as any).findFirst({
      where: { id: req.params.id, companyId },
    });
    if (!existing) return res.status(404).json({ message: "Not found" });

    await (prisma.botKnowledge as any).delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: "Failed to delete knowledge item" });
  }
});

export default router;
