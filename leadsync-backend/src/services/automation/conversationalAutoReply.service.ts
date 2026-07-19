/**
 * Conversational Auto-Reply Service
 * 
 * Evaluates every inbound customer message against the shop's active ConversationalRules.
 * Uses similarity-based matching via retrieveSimilarChunks (RAG) instead of keyword matching.
 * If a rule confidently matches (gap >= threshold), it sends the rule's template reply.
 * Otherwise, the message falls through to the AI for intent classification and potential escalation.
 */

import { prisma } from "../../lib/prisma";
import { OutboundDispatcher } from "../outbound.dispatcher";
import { retrieveSimilarChunks, RetrievedChunk } from "../knowledge/knowledgeRetriever.service";
import { aiPersonalityService } from "../ai/aiPersonality.service";
import { ChannelType } from "../../interfaces/outbound.interface";
import { telegramSurfaceAdapter } from "./telegramSurface.adapter";

const outboundDispatcher = new OutboundDispatcher();

interface InboundMessageContext {
  companyId: string;
  conversationId: string;
  leadId: string;
  messageText: string;
  customerName?: string;
  customerSegment?: string;
  customerLanguage?: string;
  channel: ChannelType;
  contact: string;
  isCallback?: boolean;
  callbackQueryId?: string;
  callbackMessageId?: string;
}

interface RuleMatchResult {
  matched: boolean;
  ruleId?: string;
  ruleName?: string;
  matchedKeywords?: string[];
  response?: string;
  responseAlreadySent: boolean;
}

// BlockedReason values for non-confident-match paths
type BlockedReason = "ineligible_time" | "ineligible_language" | "ineligible_segment" | "gap_below_threshold" | "rule_not_found";

// Valid pathTaken values including escalation
type PathTaken = "confident_match" | "ai_fallback" | "escalation";

export class ConversationalAutoReplyService {
  // Cache active rules per company (refreshed every 60s)
  private rulesCache = new Map<string, { rules: any[]; cachedAt: number }>();
  private readonly CACHE_TTL = 60_000; // 60 seconds
  // Threshold for confident rule match (configurable via env)
  private readonly CONFIDENCE_GAP_THRESHOLD = parseFloat(process.env.CONFIDENCE_GAP_THRESHOLD || "0.04");
  private readonly SINGLE_RULE_MIN_SCORE = parseFloat(process.env.SINGLE_RULE_MIN_SCORE || "0.70");
  // Rule type constants (same as orchestrator for consistency)
  private readonly RULE_TYPE_CANNED_REPLY = 1;
  private readonly RULE_TYPE_OTTO_QUERY = 2;
  private readonly RULE_TYPE_PRODUCT_QUERY = 3;

  /**
   * Log decision to RuleDecisionLog table for observability
   */
  private async logDecision(params: {
    companyId: string;
    conversationId?: string;
    messageText: string;
    topScore?: number;
    secondScore?: number;
    gap?: number;
    pathTaken: PathTaken;
    matchedRuleId?: string | null;
    blockedReason?: BlockedReason;
  }): Promise<void> {
    try {
      await prisma.ruleDecisionLog.create({
        data: {
          companyId: params.companyId,
          conversationId: params.conversationId,
          messageText: params.messageText.substring(0, 1000),
          topScore: params.topScore,
          secondScore: params.secondScore,
          gap: params.gap,
          pathTaken: params.pathTaken,
          matchedRuleId: params.matchedRuleId,
          blockedReason: params.blockedReason,
        },
      });
    } catch (err: any) {
      console.warn(`[ConversationalAutoReply] Failed to log decision: ${err.message}`);
    }
  }

  /**
   * Check if current hour falls within the rule's allowed hour range
   * hourRange: {start, end} - hour-of-day (0-23)
   */
  private checkHourCondition(rule: any): boolean {
    const hourRange = rule.hourRange || (rule.conditions && rule.conditions.hourRange);
    if (!hourRange) return true;

    const now = new Date();
    const currentHour = now.getHours();
    const { start, end } = hourRange;

    return currentHour >= start && currentHour <= end;
  }

  /**
   * Check if current day-of-month falls within the rule's allowed date range
   * dateRange: {start, end} - day-of-month (1-31)
   */
  private checkDateCondition(rule: any): boolean {
    const dateRange = rule.dateRange || (rule.conditions && rule.conditions.dateRange);
    if (!dateRange) return true;

    const now = new Date();
    const currentDay = now.getDate();
    const { start, end } = dateRange;

    return currentDay >= start && currentDay <= end;
  }

  /**
   * Check if customer segment matches the rule's conditions
   */
  private checkSegmentCondition(rule: any, customerSegment?: string): boolean {
    const segment = rule.segment || (rule.conditions && rule.conditions.segment);
    if (!segment || !customerSegment) return true;
    return segment.includes(customerSegment);
  }

  /**
   * Check if customer language matches the rule's conditions
   */
  private checkLanguageCondition(rule: any, customerLanguage?: string): boolean {
    const language = rule.language || (rule.conditions && rule.conditions.language);
    if (!language || !customerLanguage) return true;
    return language.includes(customerLanguage);
  }

  /**
   * Check all eligibility conditions (time, segment, language) for a rule
   * Returns { eligible: boolean, blockedReason?: BlockedReason }
   */
  private checkRuleEligibility(rule: any, context: InboundMessageContext): { eligible: boolean; blockedReason?: BlockedReason } {
    // Check hour condition (hour-of-day)
    const hourRange = rule.hourRange || (rule.conditions && rule.conditions.hourRange);
    if (hourRange) {
      const now = new Date();
      const currentHour = now.getHours();
      const { start, end } = hourRange;
      if (!(currentHour >= start && currentHour <= end)) {
        return { eligible: false, blockedReason: "ineligible_time" };
      }
    }

    // Check date condition (day-of-month) - for Christmas Offer
    const dateRange = rule.dateRange || (rule.conditions && rule.conditions.dateRange);
    if (dateRange) {
      const now = new Date();
      const currentDay = now.getDate();
      const { start, end } = dateRange;
      if (!(currentDay >= start && currentDay <= end)) {
        return { eligible: false, blockedReason: "ineligible_time" };
      }
    }

    // Check segment condition
    const segment = rule.segment || (rule.conditions && rule.conditions.segment);
    if (segment && context.customerSegment && !segment.includes(context.customerSegment)) {
      return { eligible: false, blockedReason: "ineligible_segment" };
    }

    // Check language condition
    const language = rule.language || (rule.conditions && rule.conditions.language);
    if (language && context.customerLanguage && !language.includes(context.customerLanguage)) {
      return { eligible: false, blockedReason: "ineligible_language" };
    }

    return { eligible: true };
  }

  /**
   * Evaluate similarity-based match using retrieveSimilarChunks
   * Only considers rules that pass eligibility checks
   * Returns null if no confident match found.
   */
  private async evaluateSimilarityMatch(
    companyId: string,
    messageText: string,
    eligibleRules: any[]
  ): Promise<{ rule: any; topScore: number; secondScore?: number; gap?: number } | null> {
    // Filter sourceIds to only eligible rules
    const eligibleRuleIds = eligibleRules.map(r => r.id);

    // Get similar chunks (rules are embedded as KnowledgeChunks with sourceType='RULE')
    const chunks = await retrieveSimilarChunks(companyId, messageText, 2, "RULE");
    
    // Filter chunks to only those matching eligible rules
    const eligibleChunks = chunks.filter(chunk => eligibleRuleIds.includes(chunk.sourceId));
    
    if (eligibleChunks.length === 0) {
      return null;
    }
    
    const topScore = eligibleChunks[0].similarity;
    const secondScore = eligibleChunks.length >= 2 ? eligibleChunks[1].similarity : undefined;
    
    // Compute gap for decision
    let isConfident: boolean;
    let gap: number | undefined;
    
    if (eligibleChunks.length >= 2) {
      gap = topScore - secondScore!;
      isConfident = gap >= this.CONFIDENCE_GAP_THRESHOLD;
    } else {
      // Single-rule case: always route to AI (no confident path)
      isConfident = false;
      gap = undefined;
    }
    
    if (!isConfident) {
      return null;
    }
    
    // Find the matching rule by sourceId
    const matchedRuleId = eligibleChunks[0].sourceId;
    const rule = eligibleRules.find(r => r.id === matchedRuleId);
    
    if (!rule) {
      return null;
    }
    
    return { rule, topScore, secondScore, gap };
  }

  /**
   * Evaluate an inbound message against all active rules for the company
   * Pipeline: fetch active rules → filter to eligible rules → run similarity check
   */
  async evaluateMessage(context: InboundMessageContext): Promise<RuleMatchResult> {
    const { companyId, messageText, conversationId } = context;
    
    // Load active rules
    const activeRules = await this.getActiveRules(companyId);
    if (activeRules.length === 0) {
      return { matched: false, responseAlreadySent: false };
    }

    // Task 1: Filter to only eligible rules BEFORE similarity check
    const eligibleRules: any[] = [];

    for (const rule of activeRules) {
      const eligibility = this.checkRuleEligibility(rule, context);
      if (eligibility.eligible) {
        eligibleRules.push(rule);
      }
    }

    // Get ALL chunks first (both eligible and ineligible rules) for proper blockedReason analysis
    const allChunks = await retrieveSimilarChunks(companyId, messageText, 10, "RULE");
    
    // Find the best-scoring rule overall (regardless of eligibility)
    if (allChunks.length > 0) {
      const bestOverallChunk = allChunks[0];
      const bestOverallRule = activeRules.find(r => r.id === bestOverallChunk.sourceId);
      
      if (bestOverallRule) {
        const bestRuleEligibility = this.checkRuleEligibility(bestOverallRule, context);
        
        // If the best-scoring rule is ineligible, check if it would have been a confident match on its own
        if (!bestRuleEligibility.eligible) {
          // Check if there's only one result or if gap meets threshold
          const topScore = bestOverallChunk.similarity;
          const secondScore = allChunks.length >= 2 ? allChunks[1].similarity : undefined;
          const gap = secondScore !== undefined ? topScore - secondScore : 0;
          
          // If this would have been a confident match (gap >= threshold), log with ineligible_* reason
          const wouldBeConfident = gap >= this.CONFIDENCE_GAP_THRESHOLD;
          
          if (wouldBeConfident) {
            // The best rule is ineligible - log and return with specific blockedReason
            await this.logDecision({
              companyId,
              conversationId,
              messageText,
              topScore,
              secondScore,
              gap,
              pathTaken: "ai_fallback",
              matchedRuleId: null,
              blockedReason: bestRuleEligibility.blockedReason,
            });
            return { matched: false, responseAlreadySent: false };
          }
        }
      }
    }

    // If no rules are eligible, log and return (will fall through to AI)
    if (eligibleRules.length === 0) {
      const topScore = allChunks.length >= 1 ? allChunks[0].similarity : undefined;
      const secondScore = allChunks.length >= 2 ? allChunks[1].similarity : undefined;
      const gap = allChunks.length >= 2 ? topScore! - secondScore! : undefined;

      await this.logDecision({
        companyId,
        conversationId,
        messageText,
        topScore,
        secondScore,
        gap,
        pathTaken: "ai_fallback",
        matchedRuleId: null,
        blockedReason: "rule_not_found",
      });
      return { matched: false, responseAlreadySent: false };
    }

    // Try similarity-based match on ELIGIBLE rules only
    const simMatch = await this.evaluateSimilarityMatch(companyId, messageText, eligibleRules);

    if (!simMatch) {
      // No confident match - log and return (will fall through to AI)
      const eligibleChunks = allChunks.filter(chunk => eligibleRules.some(r => r.id === chunk.sourceId));
      
      const topScore = eligibleChunks.length >= 1 ? eligibleChunks[0].similarity : undefined;
      const secondScore = eligibleChunks.length >= 2 ? eligibleChunks[1].similarity : undefined;
      const gap = eligibleChunks.length >= 2 ? topScore! - secondScore! : undefined;

      await this.logDecision({
        companyId,
        conversationId,
        messageText,
        topScore,
        secondScore,
        gap,
        pathTaken: "ai_fallback",
        matchedRuleId: null,
        blockedReason: gap !== undefined ? "gap_below_threshold" : "rule_not_found",
      });
      return { matched: false, responseAlreadySent: false };
    }

    // Confident match - conditions already checked during eligibility filtering
    const { rule, topScore, secondScore, gap } = simMatch;

    // For Type 2/3 (RAG) rules, don't send response - let orchestrator handle it
    // These rules use PRODUCT KnowledgeChunks for context + Sarvam/Groq for response
    const isRagRule = rule.ruleType === this.RULE_TYPE_OTTO_QUERY || rule.ruleType === this.RULE_TYPE_PRODUCT_QUERY;

    let response = "";
    if (!isRagRule) {
      // Generate response using the rule's template for Type 1 (canned reply) rules
      response = await this.generateResponse(rule, context);

      // Send the response via outbound dispatcher
      await this.sendResponse(context, response);
    }

    // Log the match
    await this.logRuleMatch({
      companyId,
      ruleId: rule.id,
      conversationId: context.conversationId,
      leadId: context.leadId,
      inboundText: context.messageText,
      responseSent: response,
      matchedKeyword: null,
      aiGenerated: rule.useAI,
    });

    // Log the decision
    await this.logDecision({
      companyId,
      conversationId,
      messageText,
      topScore,
      secondScore,
      gap,
      pathTaken: "confident_match",
      matchedRuleId: rule.id,
    });

    // Increment trigger count
    await prisma.conversationalRule.update({
      where: { id: rule.id },
      data: {
        triggerCount: { increment: 1 },
        lastTriggeredAt: new Date(),
      },
    });

    return {
      matched: true,
      ruleId: rule.id,
      ruleName: rule.name,
      matchedKeywords: [],
      response,
      responseAlreadySent: !isRagRule,
    };
  }

  /**
   * Generate response using the rule's template or AI enhancement
   */
  private async generateResponse(rule: any, context: InboundMessageContext): Promise<string> {
    let response = rule.templateBody || "";

    // Replace template variables - support both {{var}} and {var} variants
    response = response
      .replace(/\{\{customerName\}\}/g, context.customerName || "there")
      .replace(/\{\{shopName\}\}/g, "")
      .replace(/\{\{brand\}\}/g, "")
      .replace(/\{customerName\}/gi, context.customerName || "there")
      .replace(/\{shopname\}/gi, "")
      .replace(/\{shopName\}/g, "")
      .replace(/\{brand\}/gi, "")
      .replace(/\{name\}/gi, context.customerName || "there")
      .replace(/\{\{(\d+)\}\}/g, "Rs. $1");

    // If useAI is enabled, enhance the response with AI
    if (rule.useAI) {
      try {
        const aiResult = await aiPersonalityService.generateMessage(
          {
            eventKey: `conversational_rule_${rule.id}`,
            originalTemplate: response,
            customerName: context.customerName,
            brandName: "",
            channel: context.channel,
            customerHistory: undefined,
          },
          context.companyId,
          `Generate a friendly response based on this template: "${response}". Customer said: "${context.messageText}". Keep it short and natural.`
        );
        if (aiResult.usedAI && aiResult.message) {
          return aiResult.message;
        }
      } catch (err) {
        console.warn(`[ConversationalAutoReply] AI enhancement failed for rule ${rule.id}, using template`);
      }
    }

    return response;
  }

  /**
   * Send response via outbound dispatcher
   */
  private async sendResponse(context: InboundMessageContext, response: string): Promise<void> {
    try {
      await outboundDispatcher.dispatch({
        companyId: context.companyId,
        conversationId: context.conversationId,
        leadId: context.leadId,
        to: context.contact,
        channel: context.channel,
        content: { text: response },
        sender: "BOT",
      });
    } catch (err: any) {
      console.error(`[ConversationalAutoReply] Failed to send response: ${err instanceof Error ? err.message : JSON.stringify(err)}`);
      throw err;
    }
  }

  /**
   * Log the rule match to ConversationalRuleLog
   */
  private async logRuleMatch(params: {
    companyId: string;
    ruleId: string;
    conversationId: string;
    leadId: string;
    inboundText: string;
    responseSent: string;
    matchedKeyword: string | null;
    aiGenerated: boolean;
  }): Promise<void> {
    try {
      await prisma.conversationalRuleLog.create({
        data: {
          companyId: params.companyId,
          ruleId: params.ruleId,
          conversationId: params.conversationId,
          leadId: params.leadId,
          inboundText: params.inboundText.substring(0, 1000),
          responseSent: params.responseSent.substring(0, 1000),
          matchedKeyword: params.matchedKeyword,
          aiGenerated: params.aiGenerated,
          status: "SENT",
        },
      });
    } catch (err: any) {
      console.warn(`[ConversationalAutoReply] Failed to log rule match: ${err.message}`);
    }
  }

  /**
   * Load active rules for a company (with caching)
   * Includes hourRange and dateRange in selection
   */
  async getActiveRules(companyId: string): Promise<any[]> {
    const cached = this.rulesCache.get(companyId);
    if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL) {
      return cached.rules;
    }

    const rules = await prisma.conversationalRule.findMany({
      where: {
        companyId,
        isEnabled: true,
        AND: [
          {
            OR: [
              { expiresAt: null },
              { expiresAt: { gte: new Date() } },
            ],
          },
          {
            // Cascading disable: a rule is only active if its flow (RuleGroup)
            // is enabled. Rules with no flow (orphans) are unaffected.
            OR: [
              { groupId: null },
              { group: { isEnabled: true } },
            ],
          },
        ],
      },
      select: {
        id: true,
        name: true,
        triggerKeywords: true,
        triggerType: true,
        conditions: true,
        templateBody: true,
        useAI: true,
        brandVoice: true,
        targetLanguage: true,
        hourRange: true,
        dateRange: true,
        ruleType: true,
      },
    });

    this.rulesCache.set(companyId, { rules, cachedAt: Date.now() });
    return rules;
  }

  /**
   * Invalidate cache when rules are updated
   */
  invalidateCache(companyId: string): void {
    this.rulesCache.delete(companyId);
  }

  /**
   * Resolve a surfaced rule by its Telegram command string (e.g. "/biryani").
   */
  async resolveByCommand(companyId: string, command: string): Promise<string | null> {
    const normalized = command.startsWith("/") ? command : `/${command}`;
    const cleanCmd = normalized.split("@")[0].trim().toLowerCase();

    const rules = await prisma.conversationalRule.findMany({
      where: {
        companyId,
        isEnabled: true,
      },
      select: { id: true, surfaceConfig: true },
    });

    const matched = rules.find((r) => {
      const config = r.surfaceConfig as any;
      if (!config || typeof config !== "object" || !config.enabled) return false;
      const cmd = (config.command || "").trim().toLowerCase();
      return cmd === cleanCmd;
    });

    return matched?.id || null;
  }

  /**
   * Fire all active EVENT-type rules whose eventConfig.eventName matches.
   * Replaces the deleted AutoReplyRule event pipeline (order/lead events).
   *
   * TODO(v2): eventConfig.delayMinutes is currently NOT honored — events fire
   * synchronously. When delay support is added, schedule via setTimeout and at
   * FIRE TIME re-fetch the rule to confirm it still exists and isEnabled === true
   * (a rule toggled off / deleted during the delay window must not fire). Also
   * re-validate eventConfig.eventName still matches. Do NOT trust the in-memory
   * `rule` snapshot captured at schedule time.
   */
  async fireEventRules(
    eventName: string,
    context: InboundMessageContext & { orderId?: string; brandName?: string }
  ): Promise<number> {
    const rules = await prisma.conversationalRule.findMany({
      where: {
        companyId: context.companyId,
        isEnabled: true,
        triggerType: "EVENT",
        eventConfig: { path: ["eventName"], equals: eventName },
      },
    });

    let fired = 0;
    for (const rule of rules) {
      const response = await this.generateResponse(rule, context);
      if (!response) continue;
      await this.sendResponse(context, response);
      await this.logRuleMatch({
        companyId: context.companyId,
        ruleId: rule.id,
        conversationId: context.conversationId,
        leadId: context.leadId,
        inboundText: `event:${eventName}`,
        responseSent: response,
        matchedKeyword: null,
        aiGenerated: !!rule.useAI,
      });
      await prisma.conversationalRule.update({
        where: { id: rule.id },
        data: { triggerCount: { increment: 1 }, lastTriggeredAt: new Date() },
      });
      fired++;
    }
    return fired;
  }

  /**
   * Execute a single rule directly (used when a customer taps an inline button
   * or types its Telegram command). Skips keyword/RAG matching entirely.
   * Returns true if the rule was found + a reply was sent.
   */
  async executeRuleById(
    ruleId: string,
    context: InboundMessageContext
  ): Promise<boolean> {
    const rule = await prisma.conversationalRule.findUnique({ where: { id: ruleId } });
    if (!rule || !rule.isEnabled) return false;

    // Check if Category or Leaf by looking for active children
    const children = await telegramSurfaceAdapter.getActiveSurfacedRules(context.companyId, ruleId);
    const isCategory = children.length > 0;

    let responseText = await this.generateResponse(rule, context);
    if (isCategory && (!responseText || !responseText.trim())) {
      responseText = `Please select an option under ${rule.name}:`;
    }

    if (!responseText) return false;

    let replyMarkup: any = undefined;
    if (context.channel === "TELEGRAM") {
      if (isCategory) {
        const grandparentRuleId = (rule.surfaceConfig as any)?.parentRuleId || null;
        replyMarkup = telegramSurfaceAdapter.buildInlineKeyboard(children, ruleId, grandparentRuleId);
      } else {
        if (context.isCallback) {
          const parentRuleId = (rule.surfaceConfig as any)?.parentRuleId || null;
          replyMarkup = telegramSurfaceAdapter.buildLeafKeyboard(parentRuleId);
        }
      }
    }

    if (context.isCallback && context.callbackMessageId && context.channel === "TELEGRAM") {
      // Edit the existing message in place
      await outboundDispatcher.editMessageFrame(
        context.channel,
        context.contact,
        context.callbackMessageId,
        { bodyText: responseText, replyMarkup }
      );
    } else {
      // Send a new message
      await outboundDispatcher.sendMessageFrame(
        context.channel,
        context.contact,
        context.conversationId,
        { bodyText: responseText, interactivePayload: null, replyMarkup },
        "BOT"
      );
    }

    await this.logRuleMatch({
      companyId: context.companyId,
      ruleId: rule.id,
      conversationId: context.conversationId,
      leadId: context.leadId,
      inboundText: context.messageText,
      responseSent: responseText,
      matchedKeyword: null,
      aiGenerated: !!rule.useAI,
    });

    await prisma.conversationalRule.update({
      where: { id: rule.id },
      data: { triggerCount: { increment: 1 }, lastTriggeredAt: new Date() },
    });

    return true;
  }

  /**
   * Test a rule against a sample message (for the frontend simulator)
   */
  async testRule(ruleId: string, sampleMessage: string): Promise<{
    matched: boolean;
    matchedKeywords: string[];
    response: string;
  }> {
    const rule = await prisma.conversationalRule.findUnique({
      where: { id: ruleId },
    });

    if (!rule) {
      throw new Error("Rule not found");
    }

    const keywords = rule.triggerKeywords as string[];
    const matchedKeywords = this.matchKeywordsForTest(sampleMessage.toLowerCase(), keywords);
    const matched = matchedKeywords.length > 0;

    let response = rule.templateBody || "";
    response = response
      .replace(/\{\{customerName\}\}/g, "Test Customer")
      .replace(/\{\{shopName\}\}/g, "")
      .replace(/\{\{brand\}\}/g, "")
      .replace(/\{customerName\}/gi, "Test Customer")
      .replace(/\{shopname\}/gi, "")
      .replace(/\{shopName\}/g, "")
      .replace(/\{brand\}/gi, "")
      .replace(/\{name\}/gi, "Test Customer")
      .replace(/\{\{(\d+)\}\}/g, "Rs. $1");

    if (rule.useAI) {
      try {
        const aiResult = await aiPersonalityService.generateMessage(
          {
            eventKey: `test_rule_${rule.id}`,
            originalTemplate: response,
            customerName: "Test Customer",
            brandName: "",
            channel: "TELEGRAM",
            customerHistory: undefined,
          },
          rule.companyId,
          `Generate a response based on template: "${response}". Test message: "${sampleMessage}".`
        );
        if (aiResult.usedAI && aiResult.message) {
          response = aiResult.message;
        }
      } catch {
        // Fall through to template response
      }
    }

    return { matched, matchedKeywords, response };
  }

  private matchKeywordsForTest(text: string, keywords: string[]): string[] {
    const matched: string[] = [];
    const words = text.split(/\s+/);

    for (const keyword of keywords) {
      const lowerKeyword = keyword.toLowerCase().trim();

      if (text.includes(lowerKeyword)) {
        matched.push(keyword);
        continue;
      }

      for (const word of words) {
        if (word.includes(lowerKeyword) || lowerKeyword.includes(word)) {
          if (word.length > 2 || lowerKeyword.length > 2) {
            matched.push(keyword);
            break;
          }
        }
      }
    }

    return [...new Set(matched)];
  }
}

export const conversationalAutoReplyService = new ConversationalAutoReplyService();