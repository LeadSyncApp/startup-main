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
import { telegramSurfaceAdapter } from "../../services/automation/telegramSurface.adapter";
import { MAX_SURFACED_RULES, KNOWN_EVENTS, ORDER_EVENT_PREFIX } from "../../services/automation/conversationalRule.constants";

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

const surfaceConfigSchema = z.object({
  enabled: z.boolean().optional(),
  showAsButton: z.boolean().default(false),
  showAsCommand: z.boolean().default(false),
  channel: z.literal("TELEGRAM").default("TELEGRAM"),
  buttonLabel: z.string().max(64).optional().default(""),
  command: z.string().max(32).optional().default(""),
  menuPosition: z.number().int().min(0).max(9999).default(0),
  parentRuleId: z.string().uuid().nullable().optional(),
}).nullable().optional()
  .refine((data) => {
    if (!data) return true;
    const showAsButton = data.showAsButton !== undefined ? data.showAsButton : !!data.enabled;
    const showAsCommand = data.showAsCommand !== undefined ? data.showAsCommand : !!data.enabled;
    
    if (showAsButton || showAsCommand) {
      if (!data.buttonLabel || data.buttonLabel.trim().length === 0) return false;
      if (!data.command || !/^\/[a-z0-9_]+$/.test(data.command)) return false;
    }
    return true;
  }, {
    message: "Button label and command (starting with '/' and lowercase letters/numbers/underscores) are required when surfacing is enabled.",
    path: ["buttonLabel"]
  });


const eventConfigSchema = z.object({
  // Restrict to the known-event catalog so a rule can never be persisted with an
  // event name that can't be matched (the matcher is exact/case-sensitive). The
  // frontend surfaces this as a dropdown, not a free-text field.
  eventName: z.enum(KNOWN_EVENTS.map((e) => e.value) as [string, ...string[]]),
  delayMinutes: z.number().int().min(0).optional(),
}).nullable().optional();

const createRuleSchema = z.object({
  companyId: z.string().uuid(),
  groupId: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(100),
  isEnabled: z.boolean().default(true),
  triggerKeywords: z.array(z.string()).min(1, "At least one keyword required"),
  triggerType: z.enum(["KEYWORD", "AI_DETECTED", "KEYWORD_AND_AI", "TEXT_MATCH", "EVENT"]).default("TEXT_MATCH"),
  surfaceConfig: surfaceConfigSchema,
  eventConfig: eventConfigSchema,
  conditions: z.object({
    segment: z.array(z.string()).optional(),
    timeRange: z.object({ start: z.number(), end: z.number() }).optional(),
    language: z.array(z.string()).optional(),
  }).nullable().optional(),
  templateBody: z.string().default(""),
  useAI: z.boolean().default(false),
  brandVoice: z.string().default("friendly"),
  targetLanguage: z.string().default("auto"),
  sourcePrompt: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

const updateRuleSchema = z.object({
  groupId: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(100).optional(),
  isEnabled: z.boolean().optional(),
  triggerKeywords: z.array(z.string()).optional(),
  triggerType: z.enum(["KEYWORD", "AI_DETECTED", "KEYWORD_AND_AI", "TEXT_MATCH", "EVENT"]).optional(),
  surfaceConfig: surfaceConfigSchema,
  eventConfig: eventConfigSchema,
  conditions: z.object({
    segment: z.array(z.string()).optional(),
    timeRange: z.object({ start: z.number(), end: z.number() }).optional(),
    language: z.array(z.string()).optional(),
  }).nullable().optional(),
  templateBody: z.string().optional(),
  useAI: z.boolean().optional(),
  brandVoice: z.string().optional(),
  targetLanguage: z.string().optional(),
  sourcePrompt: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

const testRuleSchema = z.object({
  ruleId: z.string().uuid(),
  sampleMessage: z.string().min(1),
});

/**
 * Count a company's currently enabled-surfaced rules under a specific parent level.
 * Excludes `excludeRuleId` so an in-place update of an already-surfaced rule
 * does not count itself.
 */
async function countEnabledSurfaced(companyId: string, parentRuleId: string | null | undefined, excludeRuleId?: string): Promise<number> {
  const rules = await prisma.conversationalRule.findMany({
    where: {
      companyId,
      isEnabled: true,
      surfaceConfig: { path: ["enabled"], equals: true },
    },
    select: { id: true, surfaceConfig: true },
  });

  const normalizedParentId = parentRuleId || null;
  const filtered = rules.filter(r => {
    if (excludeRuleId && r.id === excludeRuleId) return false;
    const pId = (r.surfaceConfig as any)?.parentRuleId || null;
    return pId === normalizedParentId;
  });

  return filtered.length;
}

/**
 * Helper to fetch a map of all surfaced rules for cycle/depth checks.
 */
async function fetchSurfacedRulesMap(companyId: string) {
  const rules = await prisma.conversationalRule.findMany({
    where: {
      companyId,
      isEnabled: true,
      surfaceConfig: { path: ["enabled"], equals: true },
    },
    select: {
      id: true,
      surfaceConfig: true,
    },
  });
  return new Map(rules.map((r) => [r.id, r]));
}

/**
 * Walks up the parent chain to detect cycles and compute depth of proposed parent.
 */
function getParentChain(
  rulesMap: Map<string, any>,
  startParentId: string | null | undefined,
  currentRuleId?: string
): { hasCycle: boolean; depth: number } {
  let depth = 0;
  let currentId = startParentId;
  const visited = new Set<string>();
  if (currentRuleId) {
    visited.add(currentRuleId);
  }

  while (currentId) {
    if (visited.has(currentId)) {
      return { hasCycle: true, depth };
    }
    visited.add(currentId);

    const parentRule = rulesMap.get(currentId);
    if (!parentRule) {
      break; // Parent is not found or not surfaced, treat as root-level
    }

    const config = parentRule.surfaceConfig as any;
    currentId = config?.parentRuleId;
    depth++;
  }

  return { hasCycle: false, depth };
}

/**
 * Computes the maximum height of the subtree rooted at a specific rule.
 */
function getSubtreeHeight(rulesMap: Map<string, any>, ruleId: string): number {
  let maxHeight = 0;
  for (const [id, r] of rulesMap.entries()) {
    const parentId = (r.surfaceConfig as any)?.parentRuleId;
    if (parentId === ruleId) {
      maxHeight = Math.max(maxHeight, 1 + getSubtreeHeight(rulesMap, id));
    }
  }
  return maxHeight;
}

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
        select: { name: true, businessType: true },
      }),
      (prisma.inventoryProduct as any).findMany({
        where: { companyId: input.companyId, isActive: true },
        select: { name: true },
        take: 20,
      }),
    ]);

    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    // Generate rule via AI (returns generated+validated rule, NOT saved yet)
    const generated = await ruleGeneratorService.generateFromPrompt({
      prompt: input.prompt,
      companyId: input.companyId,
      businessType: input.businessType || company.businessType || undefined,
      businessName: input.businessName || company.name || undefined,
      productCatalog: products.map((p: any) => p.name),
    });

    // Return the generated rule to the frontend for preview.
    // The frontend will call POST / (manual create) to persist on user confirmation.
    res.json({
      success: true,
      rule: generated,
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
    const validated = createRuleSchema.parse(req.body);
    // Normalize nullable optional fields so Prisma doesn't choke on null
    const data = {
      ...validated,
      groupId: validated.groupId ?? undefined,
      conditions: validated.conditions ?? undefined,
      surfaceConfig: validated.surfaceConfig ?? undefined,
      eventConfig: validated.eventConfig ?? undefined,
    };

    // Enforce Telegram command uniqueness per company (JSON field — application-level check)
    if (data.surfaceConfig?.enabled && data.surfaceConfig.command) {
      const clash = await prisma.conversationalRule.findFirst({
        where: {
          companyId: data.companyId,
          surfaceConfig: { path: ["command"], equals: data.surfaceConfig.command },
        },
      });
      if (clash) {
        return res.status(409).json({ error: `Command ${data.surfaceConfig.command} is already used by another rule` });
      }
    }

    // Enforce global per-bot surfaced-rule cap (write-time, not just render-time).
    // Only counts if THIS rule is itself enabled+surfaced; toggling an existing
    // surfaced rule off does not trip the cap.
    if (data.surfaceConfig?.enabled) {
      const parentRuleId = data.surfaceConfig.parentRuleId || null;
      const rulesMap = await fetchSurfacedRulesMap(data.companyId);

      if (parentRuleId) {
        const parentRule = rulesMap.get(parentRuleId);
        if (!parentRule) {
          return res.status(400).json({ error: "Selected parent menu is not enabled or surfaced." });
        }
        const parentConfig = parentRule.surfaceConfig as any;
        if (parentConfig?.parentRuleId) {
          return res.status(400).json({ error: "A nested leaf option cannot be selected as a parent menu." });
        }
      }

      const { hasCycle, depth: parentDepth } = getParentChain(rulesMap, parentRuleId);
      if (hasCycle) {
        return res.status(400).json({ error: "A cycle was detected in the menu hierarchy." });
      }

      if (parentDepth + 1 > 2) {
        return res.status(400).json({ error: "Menu nesting is too deep. Capped at 3 levels (Root → Category → Leaf). A rule at level 2 cannot have children (cannot be a parent)." });
      }

      const current = await countEnabledSurfaced(data.companyId, parentRuleId);
      if (current >= MAX_SURFACED_RULES) {
        return res.status(409).json({
          error: `Surfaced rule limit reached. A menu level can show at most ${MAX_SURFACED_RULES} inline buttons. Disable an existing rule in this menu level first.`,
          code: "SURFACED_LIMIT_REACHED",
          limit: MAX_SURFACED_RULES,
        });
      }
    }

    // Save-time validation: require a non-empty templateBody for active rules when useAI is false
    if (data.isEnabled && !data.useAI && (!data.templateBody || !data.templateBody.trim())) {
      return res.status(400).json({
        error: "Active rule without AI enhancement requires a non-empty response template (templateBody).",
      });
    }

    const rule = await prisma.conversationalRule.create({
      data: {
        companyId: data.companyId,
        name: data.name,
        isEnabled: data.isEnabled,
        triggerKeywords: data.triggerKeywords,
        triggerType: data.triggerType,
        surfaceConfig: data.surfaceConfig,
        eventConfig: data.eventConfig,
        conditions: data.conditions,
        templateBody: data.templateBody,
        useAI: data.useAI,
        brandVoice: data.brandVoice,
        targetLanguage: data.targetLanguage,
        groupId: data.groupId,
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

    // Sync Telegram command menu if this rule is surfaced
    telegramSurfaceAdapter.scheduleSync(data.companyId);
  } catch (err: any) {
    console.error("[ConversationalRules] create error:", err);
    res.status(400).json({
      error: err.message || "Failed to create rule",
    });
  }
});

/**
 * GET /api/automation/conversational-rules/constants
 * Exposes surfacing cap + known event catalog so the frontend rule editor can
 * render the surfaced-rule limit and a dropdown of valid event names without
 * hardcoding a duplicate copy (which would drift from the backend).
 */
router.get("/constants", authMiddleware as any, async (_req: any, res: any) => {
  res.json({
    success: true,
    maxSurfacedRules: MAX_SURFACED_RULES,
    orderEventPrefix: ORDER_EVENT_PREFIX,
    knownEvents: KNOWN_EVENTS,
  });
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

    // Enforce Telegram command uniqueness per company (JSON field — application-level check)
    if (data.surfaceConfig?.enabled && data.surfaceConfig.command) {
      const clash = await prisma.conversationalRule.findFirst({
        where: {
          companyId: existing.companyId,
          id: { not: id },
          surfaceConfig: { path: ["command"], equals: data.surfaceConfig.command },
        },
      });
      if (clash) {
        return res.status(409).json({ error: `Command ${data.surfaceConfig.command} is already used by another rule` });
      }
    }

    // Enforce global per-bot surfaced-rule cap (write-time).
    // Only trips if this update ENABLES surfacing on a rule that was not already
    // counted as enabled-surfaced (existing rule's own surfaceConfig was disabled).
    if (data.surfaceConfig?.enabled) {
      const parentRuleId = data.surfaceConfig.parentRuleId || null;
      const rulesMap = await fetchSurfacedRulesMap(existing.companyId);

      if (parentRuleId) {
        const parentRule = rulesMap.get(parentRuleId);
        if (!parentRule) {
          return res.status(400).json({ error: "Selected parent menu is not enabled or surfaced." });
        }
        const parentConfig = parentRule.surfaceConfig as any;
        if (parentConfig?.parentRuleId) {
          return res.status(400).json({ error: "A nested leaf option cannot be selected as a parent menu." });
        }
      }

      const { hasCycle, depth: parentDepth } = getParentChain(rulesMap, parentRuleId, id);
      if (hasCycle) {
        return res.status(400).json({ error: "A cycle was detected in the menu hierarchy." });
      }

      const subtreeHeight = getSubtreeHeight(rulesMap, id);
      if (parentDepth + 1 + subtreeHeight > 2) {
        return res.status(400).json({ error: "Menu nesting is too deep. Capped at 3 levels (Root → Category → Leaf). A rule at level 2 cannot have children (cannot be a parent)." });
      }

      const existingSurfaced =
        existing.isEnabled &&
        (existing.surfaceConfig as any)?.enabled === true &&
        ((existing.surfaceConfig as any)?.parentRuleId || null) === parentRuleId;

      if (!existingSurfaced) {
        const current = await countEnabledSurfaced(existing.companyId, parentRuleId, id);
        if (current >= MAX_SURFACED_RULES) {
          return res.status(409).json({
            error: `Surfaced rule limit reached. A menu level can show at most ${MAX_SURFACED_RULES} inline buttons. Disable an existing rule in this menu level first.`,
            code: "SURFACED_LIMIT_REACHED",
            limit: MAX_SURFACED_RULES,
          });
        }
      }
    }

    // Save-time validation: require non-empty templateBody ONLY when templateBody is explicitly being updated,
    // or when the rule is being newly enabled (false -> true). Do not block updates to unrelated fields (like surfaceConfig).
    const isUpdatingTemplate = data.templateBody !== undefined;
    const isEnablingRule = data.isEnabled === true && existing.isEnabled === false;

    if (isUpdatingTemplate || isEnablingRule) {
      const targetEnabled = data.isEnabled !== undefined ? data.isEnabled : existing.isEnabled;
      const targetUseAI = data.useAI !== undefined ? data.useAI : existing.useAI;
      const targetTemplate = data.templateBody !== undefined ? data.templateBody : existing.templateBody;

      if (targetEnabled && !targetUseAI && (!targetTemplate || !targetTemplate.trim())) {
        return res.status(400).json({
          error: "Active rule without AI enhancement requires a non-empty response template (templateBody).",
        });
      }
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.isEnabled !== undefined) updateData.isEnabled = data.isEnabled;
    if (data.triggerKeywords !== undefined) updateData.triggerKeywords = data.triggerKeywords;
    if (data.triggerType !== undefined) updateData.triggerType = data.triggerType;
    if (data.surfaceConfig !== undefined) updateData.surfaceConfig = data.surfaceConfig;
    if (data.eventConfig !== undefined) updateData.eventConfig = data.eventConfig;
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

    // Sync Telegram command menu if this rule is surfaced (or was)
    telegramSurfaceAdapter.scheduleSync(existing.companyId);
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

    // Re-sync Telegram command menu now that a rule is gone
    telegramSurfaceAdapter.scheduleSync(existing.companyId);
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
