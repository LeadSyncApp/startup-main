import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { authMiddleware, AuthRequest } from "../../middleware/auth.middleware";

const router = Router();

const OWNER_ADMIN = ["OWNER", "ADMIN"];

/* GET /api/automation — list rules for company */
router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { companyId } = req.user!;
    const rules = await (prisma.automationRule as any).findMany({
      where: { companyId },
      orderBy: { createdAt: "asc" },
      include: {
        _count: { select: { logs: true } },
      },
    });
    res.json(rules);
  } catch (e) {
    res.status(500).json({ message: "Failed to fetch rules" });
  }
});

/* POST /api/automation — create rule */
router.post("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { companyId, role } = req.user!;
    if (!OWNER_ADMIN.includes(role)) return res.status(403).json({ message: "Forbidden" });

    const { name, trigger, triggerDelayMinutes = 1440, action, actionPayload } = req.body;
    if (!name?.trim() || !trigger || !action)
      return res.status(400).json({ message: "name, trigger, action are required" });

    const rule = await (prisma.automationRule as any).create({
      data: { companyId, name, trigger, triggerDelayMinutes, action, actionPayload },
    });
    res.status(201).json(rule);
  } catch (e) {
    res.status(500).json({ message: "Failed to create rule" });
  }
});

/* PATCH /api/automation/:id — update or toggle */
router.patch("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { companyId, role } = req.user!;
    if (!OWNER_ADMIN.includes(role)) return res.status(403).json({ message: "Forbidden" });

    const existing = await (prisma.automationRule as any).findFirst({
      where: { id: req.params.id, companyId },
    });
    if (!existing) return res.status(404).json({ message: "Not found" });

    const { name, trigger, triggerDelayMinutes, action, actionPayload, isActive } = req.body;
    const updated = await (prisma.automationRule as any).update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(trigger !== undefined && { trigger }),
        ...(triggerDelayMinutes !== undefined && { triggerDelayMinutes }),
        ...(action !== undefined && { action }),
        ...(actionPayload !== undefined && { actionPayload }),
        ...(isActive !== undefined && { isActive }),
      },
      include: { _count: { select: { logs: true } } },
    });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ message: "Failed to update rule" });
  }
});

/* DELETE /api/automation/:id */
router.delete("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { companyId, role } = req.user!;
    if (!OWNER_ADMIN.includes(role)) return res.status(403).json({ message: "Forbidden" });

    const existing = await (prisma.automationRule as any).findFirst({
      where: { id: req.params.id, companyId },
    });
    if (!existing) return res.status(404).json({ message: "Not found" });

    await (prisma.automationRule as any).delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: "Failed to delete rule" });
  }
});

/* GET /api/automation/:id/logs — recent execution logs */
router.get("/:id/logs", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { companyId } = req.user!;
    const rule = await (prisma.automationRule as any).findFirst({
      where: { id: req.params.id, companyId },
    });
    if (!rule) return res.status(404).json({ message: "Not found" });

    const logs = await (prisma.automationLog as any).findMany({
      where: { ruleId: req.params.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json(logs);
  } catch (e) {
    res.status(500).json({ message: "Failed to fetch logs" });
  }
});

export default router;
