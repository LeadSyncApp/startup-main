/**
 * Conversational Rules API Routes
 * 
 * CRUD endpoints for managing AI-generated smart reply rules.
 * Frontend calls these from the "⚡ Smart Rules" tab in AutoRepliesPage.
 */

import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { authMiddleware } from "../../middleware/auth.middleware";
import { ruleGeneratorService } from "../../services/automation/ruleGenerator.service";
import { conversationalAutoReplyService } from "../../services/automation/conversationalAutoReply.service";
import { embedRuleToKnowledgeChunk } from "../../services/knowledge/ruleEmbedding.service";

const router = Router();

// ==========================================
// VALIDATION SCHEMAS
// ==========================================

const generateFromPromptSchema = z.object({
  prompt: z.string().min(5, "Prompt must be at least 5 characters"),
  companyId: z.string().uuid(),
  groupId: z.string().uuid().optional(),
  businessType: z.string().optional(),
  businessName: z.string().optional(),
  productCatalog: z.array(z.string()).optional(),
});

const createRuleSchema = z.object({
  companyId: z.string().uuid(),
  groupId: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  isEnabled: z.boolean().default(true),
  triggerKeywords: z.array(z.string()).min(1, "At least one keyword required"),
  triggerType: z.enum(["KEYWORD", "AI_DETECTED", "KEYWORD_AND_AI"]).default("KEYWORD"),
  conditions: z.object({
    segment: z.array(z.string()).optional(),
    timeRange: z.object({ start: z.number(), end: z.number() }).optional(),
    language: z.array(z.string()).optional(),
  }).optional(),
  templateBody: z.string().default(""),
  useAI: z.boolean().default(false),
  brandVoice: z.string().default("friendly"),
  targetLanguage: z.string().default("auto"),
  sourcePrompt: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

const updateRuleSchema = createRuleSchema.partial().omit({ companyId: true });

const testRuleSchema = z.object({
  ruleId: z.string().uuid(),
  sampleMessage: z.string().min(1),
});

// ==========================================
// ROUTES
// ==========================================

/**
 * POST /api/automation/conversational-rules/generate-from-prompt
 * Takes a plain-text prompt from the shop owner and uses AI to generate a structured rule
 */
router.post("/generate-from-prompt", authMiddleware as any, async (req: any, res: any) => {
  try {
    const input = generateFromPromptSchema.parse(req.body);

    // Fetch company + products for context
    const [company, products] = await Promise.all([
      prisma.company.findUnique({
        where: { id: input.companyId },
        select: { name: true, botBusinessType: true },
      }),
      prisma.product.findMany({
        where: { companyId: input.companyId, isActive: true },
        select: { name: true },
        take: 20,
      }),
    ]);

    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    // Generate rule via AI
    const generated = await ruleGeneratorService.generateFromPrompt({
      prompt: input.prompt,
      companyId: input.companyId,
      businessType: input.businessType || company.botBusinessType || undefined,
      businessName: input.businessName || company.name || undefined,
      productCatalog: products.map((p) => p.name),
    });

    // Persist the generated rule to the database, optionally scoped to a group
    const savedRule = await prisma.conversationalRule.create({
      data: {
        companyId: input.companyId,
        groupId: input.groupId || null,
        name: generated.name,
        isEnabled: true,
        triggerKeywords: generated.triggerKeywords,
        triggerType: generated.triggerType,
        conditions: generated.conditions || undefined,
        templateBody: generated.templateBody,
        useAI: generated.useAI,
        brandVoice: generated.brandVoice,
        targetLanguage: generated.targetLanguage,
        sourcePrompt: input.prompt,
      },
    });

    // Invalidate cache so the new rule is picked up immediately
    conversationalAutoReplyService.invalidateCache(input.companyId);

    // Embed the rule to KnowledgeChunk for RAG similarity search
    await embedRuleToKnowledgeChunk({
      id: savedRule.id,
      companyId: savedRule.companyId,
      name: savedRule.name,
      triggerKeywords: savedRule.triggerKeywords,
      templateBody: savedRule.templateBody,
    });

    // NOTE: Frontend expects top-level 'rule' key (not nested in data.rule)
    res.json({
      success: true,
      rule: savedRule,
    });
  } catch (err: any) {
    console.error("[ConversationalRules] generate-from-prompt error:", err);
    res.status(400).json({
      error: err.message || "Failed to generate rule from prompt",
    });
  }
});

/**
 * POST /api/automation/conversational-rules
 * Create a new rule manually
 */
router.post("/", authMiddleware as any, async (req: any, res: any) => {
  try {
    const data = createRuleSchema.parse(req.body);

    const rule = await prisma.conversationalRule.create({
      data: {
        companyId: data.companyId,
        name: data.name,
        isEnabled: data.isEnabled,
        triggerKeywords: data.triggerKeywords,
        triggerType: data.triggerType,
        conditions: data.conditions || undefined,
        templateBody: data.templateBody,
        useAI: data.useAI,
        brandVoice: data.brandVoice,
        targetLanguage: data.targetLanguage,
        sourcePrompt: data.sourcePrompt,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      },
    });

    // Invalidate cache
    conversationalAutoReplyService.invalidateCache(data.companyId);

    // Embed the rule to KnowledgeChunk for RAG similarity search
    await embedRuleToKnowledgeChunk({
      id: rule.id,
      companyId: rule.companyId,
      name: rule.name,
      triggerKeywords: rule.triggerKeywords,
      templateBody: rule.templateBody,
    });

    res.status(201).json({
      success: true,
      rule: rule,
    });
  } catch (err: any) {
    console.error("[ConversationalRules] create error:", err);
    res.status(400).json({
      error: err.message || "Failed to create rule",
    });
  }
});

/**
 * GET /api/automation/conversational-rules/:companyId
 * List all rules for a company, optionally filtered by groupId
 */
router.get("/:companyId", authMiddleware as any, async (req: any, res: any) => {
  try {
    const { companyId } = req.params;
    const { groupId } = req.query;

    const where: any = { companyId };
    if (groupId) {
      where.groupId = groupId;
    }

    const rules = await prisma.conversationalRule.findMany({
      where,
      include: {
        _count: {
          select: { logs: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // NOTE: Frontend expects top-level 'rules' key
    res.json({
      success: true,
      rules: rules,
    });
  } catch (err: any) {
    console.error("[ConversationalRules] list error:", err);
    res.status(500).json({
      error: "Failed to fetch rules",
    });
  }
});

/**
 * GET /api/automation/conversational-rules/detail/:id
 * Get a single rule by ID
 */
router.get("/detail/:id", authMiddleware as any, async (req: any, res: any) => {
  try {
    const { id } = req.params;

    const rule = await prisma.conversationalRule.findUnique({
      where: { id },
      include: {
        logs: {
          orderBy: { createdAt: "desc" },
          take: 50,
        },
      },
    });

    if (!rule) {
      return res.status(404).json({ error: "Rule not found" });
    }

    res.json({
      success: true,
      rule: rule,
    });
  } catch (err: any) {
    console.error("[ConversationalRules] get error:", err);
    res.status(500).json({
      error: "Failed to fetch rule",
    });
  }
});

/**
 * PUT /api/automation/conversational-rules/:id
 * Update a rule
 */
router.put("/:id", authMiddleware as any, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const data = updateRuleSchema.parse(req.body);

    const existing = await prisma.conversationalRule.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: "Rule not found" });
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.isEnabled !== undefined) updateData.isEnabled = data.isEnabled;
    if (data.triggerKeywords !== undefined) updateData.triggerKeywords = data.triggerKeywords;
    if (data.triggerType !== undefined) updateData.triggerType = data.triggerType;
    if (data.conditions !== undefined) updateData.conditions = data.conditions;
    if (data.templateBody !== undefined) updateData.templateBody = data.templateBody;
    if (data.useAI !== undefined) updateData.useAI = data.useAI;
    if (data.brandVoice !== undefined) updateData.brandVoice = data.brandVoice;
    if (data.targetLanguage !== undefined) updateData.targetLanguage = data.targetLanguage;
    if (data.sourcePrompt !== undefined) updateData.sourcePrompt = data.sourcePrompt;
    if (data.expiresAt !== undefined) updateData.expiresAt = new Date(data.expiresAt);

    const rule = await prisma.conversationalRule.update({
      where: { id },
      data: updateData,
    });

    // Invalidate cache
    conversationalAutoReplyService.invalidateCache(existing.companyId);

    // Embed the rule to KnowledgeChunk for RAG similarity search
    await embedRuleToKnowledgeChunk({
      id: rule.id,
      companyId: rule.companyId,
      name: rule.name,
      triggerKeywords: rule.triggerKeywords,
      templateBody: rule.templateBody,
    });

    res.json({
      success: true,
      rule: rule,
    });
  } catch (err: any) {
    console.error("[ConversationalRules] update error:", err);
    res.status(400).json({
      error: err.message || "Failed to update rule",
    });
  }
});

/**
 * DELETE /api/automation/conversational-rules/:id
 * Delete a rule
 */
router.delete("/:id", authMiddleware as any, async (req: any, res: any) => {
  try {
    const { id } = req.params;

    const existing = await prisma.conversationalRule.findUnique({
      where: { id },
      select: { companyId: true },
    });

    if (!existing) {
      return res.status(404).json({ error: "Rule not found" });
    }

    await prisma.conversationalRule.delete({
      where: { id },
    });

    // Invalidate cache
    conversationalAutoReplyService.invalidateCache(existing.companyId);

    // Clean up KnowledgeChunk for this rule (fire-and-forget, never break the response)
    try {
      await prisma.$executeRaw`
        DELETE FROM "KnowledgeChunk"
        WHERE "companyId" = ${existing.companyId}
          AND "sourceType" = 'RULE'::"KnowledgeSourceType"
          AND "sourceId" = ${id}
      `;
    } catch (kcErr: any) {
      console.error("[ConversationalRules] KnowledgeChunk cleanup failed:", kcErr.message);
    }

    res.json({
      success: true,
      message: "Rule deleted successfully",
    });
  } catch (err: any) {
    console.error("[ConversationalRules] delete error:", err);
    res.status(500).json({
      error: "Failed to delete rule",
    });
  }
});

/**
 * POST /api/automation/conversational-rules/test
 * Test a rule against a sample message (for the chat simulator)
 */
router.post("/test", authMiddleware as any, async (req: any, res: any) => {
  try {
    const { ruleId, sampleMessage } = testRuleSchema.parse(req.body);

    const result = await conversationalAutoReplyService.testRule(ruleId, sampleMessage);

    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    console.error("[ConversationalRules] test error:", err);
    res.status(400).json({
      error: err.message || "Failed to test rule",
    });
  }
});

/**
 * GET /api/automation/conversational-rules/logs/:companyId
 * Get rule execution logs for a company
 */
router.get("/logs/:companyId", authMiddleware as any, async (req: any, res: any) => {
  try {
    const { companyId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const [logs, total] = await Promise.all([
      prisma.conversationalRuleLog.findMany({
        where: { companyId },
        include: {
          rule: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: Number(limit),
        skip: Number(offset),
      }),
      prisma.conversationalRuleLog.count({
        where: { companyId },
      }),
    ]);

    res.json({
      success: true,
      rules: logs,
      total,
    });
  } catch (err: any) {
    console.error("[ConversationalRules] logs error:", err);
    res.status(500).json({
      error: "Failed to fetch logs",
    });
  }
});

export default router;