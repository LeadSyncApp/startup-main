import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { authMiddleware } from "../../middleware/auth.middleware";
import { can } from "../../services/auth/permissions.service";
import { autoReplyService, detectLanguageFromText, AUTO_REPLY_EVENTS } from "../../services/automation/autoReply.service";
import { aiPersonalityService } from "../../services/ai/aiPersonality.service";
import { getGroq } from "../../services/ai/ai.service";

const router = Router();

/**
 * GET /api/auto-reply/rules
 * Get all auto-reply rules for the current company
 */
router.get("/rules", authMiddleware as any, async (req: any, res: any) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    let rules = await autoReplyService.getRules(companyId);
    
    // Auto-seed if no rules exist yet (first time user)
    if (rules.length === 0) {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { name: true },
      });
      await autoReplyService.seedDefaults(companyId, company?.name || "our store");
      rules = await autoReplyService.getRules(companyId);
    }

    res.json({ rules });
  } catch (error: any) {
    console.error("[AutoReply] Failed to fetch rules:", error);
    res.status(500).json({ message: "Failed to fetch auto-reply rules" });
  }
});

/**
 * PUT /api/auto-reply/rules/batch-toggle
 * Enable or disable multiple rules at once (batch operation)
 * 🛑 FIX: Must be registered BEFORE /rules/:ruleId to avoid "batch-toggle" being captured as ruleId
 */
router.put("/rules/batch-toggle", authMiddleware as any, async (req: any, res: any) => {
  try {
    const companyId = req.user?.companyId;
    const userRole = req.user?.role;
    const { ruleIds, isEnabled } = req.body;

    if (!companyId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!can(userRole, "automation.manage")) {
      return res.status(403).json({ message: "Only admins can modify auto-reply rules" });
    }

    if (!Array.isArray(ruleIds) || ruleIds.length === 0) {
      return res.status(400).json({ message: "ruleIds must be a non-empty array" });
    }

    const updated = await prisma.autoReplyRule.updateMany({
      where: {
        id: { in: ruleIds },
        companyId,
      },
      data: { isEnabled },
    });

    // Fetch the updated rules to return
    const rules = await autoReplyService.getRules(companyId);
    res.json({ rules, modifiedCount: updated.count });
  } catch (error: any) {
    console.error("[AutoReply] Failed to batch toggle rules:", error);
    res.status(500).json({ message: "Failed to batch toggle rules" });
  }
});

/**
 * PUT /api/auto-reply/rules/:ruleId
 * Update a single auto-reply rule
 */
router.put("/rules/:ruleId", authMiddleware as any, async (req: any, res: any) => {
  try {
    const companyId = req.user?.companyId;
    const userRole = req.user?.role;
    const { ruleId } = req.params;

    if (!companyId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Only OWNER or MANAGER can edit auto-reply rules
    if (!can(userRole, "automation.manage")) {
      return res.status(403).json({ message: "Only admins can modify auto-reply rules" });
    }

    const { isEnabled, messageBody, delayMinutes, useAI, brandVoice, targetLanguage } = req.body;

    const updated = await autoReplyService.updateRule(ruleId, companyId, {
      isEnabled,
      messageBody,
      delayMinutes,
      useAI,
      brandVoice,
      targetLanguage,
    });

    res.json({ rule: updated });
  } catch (error: any) {
    console.error("[AutoReply] Failed to update rule:", error);
    res.status(500).json({ message: "Failed to update auto-reply rule" });
  }
});


/**
 * POST /api/auto-reply/seed
 * Seed default auto-reply rules for the current company
 * Useful when first connecting a channel
 */
router.post("/seed", authMiddleware as any, async (req: any, res: any) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true },
    });

    await autoReplyService.seedDefaults(companyId, company?.name || "our store");

    const rules = await autoReplyService.getRules(companyId);
    res.json({ rules });
  } catch (error: any) {
    console.error("[AutoReply] Failed to seed rules:", error);
    res.status(500).json({ message: "Failed to seed auto-reply rules" });
  }
});

/**
 * GET /api/auto-reply/logs
 * Get auto-reply logs for the current company
 */
router.get("/logs", authMiddleware as any, async (req: any, res: any) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const logs = await prisma.autoReplyLog.findMany({
      where: { companyId },
      orderBy: { sentAt: "desc" },
      take: 50,
    });

    res.json({ logs });
  } catch (error: any) {
    console.error("[AutoReply] Failed to fetch logs:", error);
    res.status(500).json({ message: "Failed to fetch auto-reply logs" });
  }
});

/**
 * POST /api/auto-reply/generate-from-description
 * Generate auto-reply templates from a business description using AI
 */
router.post("/generate-from-description", authMiddleware as any, async (req: any, res: any) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { description, language } = req.body;
    if (!description || !description.trim()) {
      return res.status(400).json({ message: "Business description is required" });
    }
    
    // 🛑 FIX: If language is "auto", detect from the description text
    const effectiveLanguage = language === "auto" 
      ? detectLanguageFromText(description) 
      : (language || "English");

    // 🛑 FIX: Ensure rules exist before trying to generate from them
    let rules = await autoReplyService.getRules(companyId);
    if (rules.length === 0) {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { name: true },
      });
      await autoReplyService.seedDefaults(companyId, company?.name || "our store");
      rules = await autoReplyService.getRules(companyId);
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true },
    });
    const brandName = company?.name || "our store";

    const updatedRules = [];
    for (const rule of rules) {
      const eventConfig = AUTO_REPLY_EVENTS?.[rule.eventKey as keyof typeof AUTO_REPLY_EVENTS];
      if (!eventConfig) continue;

      // 🛑 FIX: Only overwrite rules that are already enabled.
      // Disabled rules likely contain user's custom messages — preserve them.
      if (!rule.isEnabled) {
        updatedRules.push(rule);
        continue;
      }

      const prompt = `You are a bot message writer for "${brandName}". 
Business description: ${description}
Target language: ${effectiveLanguage}

Write a ${eventConfig.label} message for when ${eventConfig.description}.
Use a natural, friendly tone matching the business description.
Use placeholders: {name} for customer name, {orderId} for order ID, {brand} for store name.

Write ONLY the message, no explanations, no markdown formatting, no quotes.`;

      try {
        const aiResult = await aiPersonalityService.generateMessage({
          eventKey: rule.eventKey,
          customerName: "Customer",
          orderId: "12345",
          brandName,
          channel: "TELEGRAM",
          originalTemplate: rule.messageBody,
        }, companyId, prompt);

        const newMessage = typeof aiResult === 'string' ? aiResult : (aiResult.message || rule.messageBody);
        
        const updated = await autoReplyService.updateRule(rule.id, companyId, {
          messageBody: newMessage,
          useAI: true,
        });
        updatedRules.push(updated);
      } catch (err) {
        console.error(`[AutoReply] Failed to generate for ${rule.eventKey}:`, err);
        updatedRules.push(rule);
      }
    }

    res.json({ rules: updatedRules });
  } catch (error: any) {
    console.error("[AutoReply] Failed to generate from description:", error);
    res.status(500).json({ message: "Failed to generate auto-reply messages" });
  }
});

/**
 * POST /api/auto-reply/test-instruction
 * Test an AI instruction with a custom message to see how the bot responds
 */
router.post("/test-instruction", authMiddleware as any, async (req: any, res: any) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { instruction, testMessage } = req.body;
    if (!instruction || !instruction.trim()) {
      return res.status(400).json({ message: "Instruction is required" });
    }
    if (!testMessage || !testMessage.trim()) {
      return res.status(400).json({ message: "Test message is required" });
    }

    // Get company info for context
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, businessType: true },
    });

    const brandName = company?.name || "our store";
    const businessType = company?.businessType || "Retail";

    // Use Groq to generate a response based on the instruction
    const groq = getGroq();
    
    const prompt = `You are a helpful AI assistant for "${brandName}" (${businessType} business).

# YOUR INSTRUCTION
${instruction}

# CUSTOMER MESSAGE
"${testMessage}"

# YOUR TASK
Follow the instruction above and respond to the customer message naturally and helpfully.
- Match the language the customer used
- Be friendly and professional
- Follow the instruction exactly as specified
- Keep responses concise and natural (under 50 words)

# OUTPUT
Return ONLY your response to the customer. No explanations, no markdown, no quotes.`;

    const result = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
      max_tokens: 150,
    });

    const response = result.choices[0]?.message?.content?.trim() || "I'm here to help! How can I assist you today?";

    res.json({ response });
  } catch (error: any) {
    console.error("[AutoReply] Failed to test instruction:", error);
    res.status(500).json({ message: "Failed to test instruction", error: error.message });
  }
});

/**
 * POST /api/auto-reply/generate-example
 * Generate an example conversation for an instruction
 */
router.post("/generate-example", authMiddleware as any, async (req: any, res: any) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { instruction } = req.body;
    if (!instruction || !instruction.trim()) {
      return res.status(400).json({ message: "Instruction is required" });
    }

    // Get company info for context
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, businessType: true },
    });

    const brandName = company?.name || "our store";
    const businessType = company?.businessType || "Retail";

    // Use Groq to generate an example conversation
    const groq = getGroq();
    
    const prompt = `You are a helpful AI assistant for "${brandName}" (${businessType} business).

# YOUR INSTRUCTION
${instruction}

# YOUR TASK
Generate a realistic example conversation showing how you would respond to a customer.
Create:
1. A natural customer message that would trigger this instruction
2. Your response following the instruction

Make it realistic and natural. The example should clearly demonstrate the instruction in action.

# OUTPUT
Return ONLY the conversation in this exact format (no markdown, no quotes):
CUSTOMER: [customer message here]
BOT: [your response here]`;

    const result = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.5,
      max_tokens: 200,
    });

    const conversationText = result.choices[0]?.message?.content?.trim() || "";
    
    // Parse the conversation
    const customerMatch = conversationText.match(/CUSTOMER:\s*(.+?)(?:\n|$)/i);
    const botMatch = conversationText.match(/BOT:\s*(.+?)(?:\n|$)/i);
    
    const customerMessage = customerMatch?.[1]?.trim() || "Hello, I have a question";
    const botResponse = botMatch?.[1]?.trim() || "I'm here to help! How can I assist you today?";

    res.json({ customerMessage, botResponse });
  } catch (error: any) {
    console.error("[AutoReply] Failed to generate example:", error);
    res.status(500).json({ message: "Failed to generate example", error: error.message });
  }
});

export default router;
