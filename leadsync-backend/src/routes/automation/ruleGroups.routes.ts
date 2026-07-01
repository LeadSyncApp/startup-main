/**
 * Rule Groups API Routes
 * 
 * CRUD endpoints for managing automation flow groups.
 * Each group is a named collection of conversational rules.
 */

import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { authMiddleware } from "../../middleware/auth.middleware";

const router = Router();

// ==========================================
// VALIDATION SCHEMAS
// ==========================================

const createGroupSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  type: z.enum(["AI_INSTRUCTION", "EVENT_FLOW"]).default("AI_INSTRUCTION"),
});

const updateGroupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
});

// ==========================================
// ROUTES
// ==========================================

/**
 * POST /api/automation/rule-groups
 * Create a new rule group (automation flow)
 */
router.post("/", authMiddleware as any, async (req: any, res: any) => {
  try {
    const data = createGroupSchema.parse(req.body);

    const group = await prisma.ruleGroup.create({
      data: {
        companyId: data.companyId,
        name: data.name,
        description: data.description || null,
        type: data.type,
      },
    });

    res.status(201).json({
      success: true,
      group,
    });
  } catch (err: any) {
    console.error("[RuleGroups] create error:", err);
    res.status(400).json({
      error: err.message || "Failed to create rule group",
    });
  }
});

/**
 * GET /api/automation/rule-groups/:companyId
 * List all rule groups for a company
 */
router.get("/:companyId", authMiddleware as any, async (req: any, res: any) => {
  try {
    const { companyId } = req.params;
    const { type } = req.query;

    const where: any = { companyId };
    if (type) {
      where.type = type;
    }

    const groups = await prisma.ruleGroup.findMany({
      where,
      include: {
        _count: {
          select: { rules: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      success: true,
      groups,
    });
  } catch (err: any) {
    console.error("[RuleGroups] list error:", err);
    res.status(500).json({
      error: "Failed to fetch rule groups",
    });
  }
});

/**
 * GET /api/automation/rule-groups/detail/:id
 * Get a single rule group with its rules
 */
router.get("/detail/:id", authMiddleware as any, async (req: any, res: any) => {
  try {
    const { id } = req.params;

    const group = await prisma.ruleGroup.findUnique({
      where: { id },
      include: {
        rules: {
          orderBy: { createdAt: "desc" },
        },
        _count: {
          select: { rules: true },
        },
      },
    });

    if (!group) {
      return res.status(404).json({ error: "Rule group not found" });
    }

    res.json({
      success: true,
      group,
    });
  } catch (err: any) {
    console.error("[RuleGroups] get error:", err);
    res.status(500).json({
      error: "Failed to fetch rule group",
    });
  }
});

/**
 * PUT /api/automation/rule-groups/:id
 * Update a rule group
 */
router.put("/:id", authMiddleware as any, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const data = updateGroupSchema.parse(req.body);

    const existing = await prisma.ruleGroup.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: "Rule group not found" });
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;

    const group = await prisma.ruleGroup.update({
      where: { id },
      data: updateData,
    });

    res.json({
      success: true,
      group,
    });
  } catch (err: any) {
    console.error("[RuleGroups] update error:", err);
    res.status(400).json({
      error: err.message || "Failed to update rule group",
    });
  }
});

/**
 * DELETE /api/automation/rule-groups/:id
 * Delete a rule group and its associated rules
 */
router.delete("/:id", authMiddleware as any, async (req: any, res: any) => {
  try {
    const { id } = req.params;

    const existing = await prisma.ruleGroup.findUnique({
      where: { id },
      select: { companyId: true },
    });

    if (!existing) {
      return res.status(404).json({ error: "Rule group not found" });
    }

    // Delete all rules in the group first, then the group
    await prisma.conversationalRule.deleteMany({
      where: { groupId: id },
    });

    await prisma.ruleGroup.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: "Rule group deleted successfully",
    });
  } catch (err: any) {
    console.error("[RuleGroups] delete error:", err);
    res.status(500).json({
      error: "Failed to delete rule group",
    });
  }
});

export default router;