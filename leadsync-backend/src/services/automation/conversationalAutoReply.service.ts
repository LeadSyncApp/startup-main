/**
 * Conversational Auto-Reply Service
 * 
 * Evaluates every inbound customer message against the shop's active ConversationalRules.
 * If a rule matches (keyword overlap, AI detection, or both), it generates a response
 * and sends it via the outbound dispatcher.
 * 
 * Flow:
 * 1. Load all active rules for the company
 * 2. Check each rule's trigger keywords against the inbound message text
 * 3. If matched, check conditions (segment, time, language)
 * 4. Generate response (template or AI-enhanced)
 * 5. Log and send
 */

import { prisma } from "../../lib/prisma";
import { OutboundDispatcher } from "../outbound.dispatcher";
import { aiPersonalityService } from "../ai/aiPersonality.service";
import { ChannelType } from "../../interfaces/outbound.interface";

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
}

interface RuleMatchResult {
  matched: boolean;
  ruleId?: string;
  ruleName?: string;
  matchedKeywords?: string[];
  response?: string;
  responseAlreadySent: boolean;
}

export class ConversationalAutoReplyService {
  // Cache active rules per company (refreshed every 60s)
  private rulesCache = new Map<string, { rules: any[]; cachedAt: number }>();
  private readonly CACHE_TTL = 60_000; // 60 seconds

  /**
   * Evaluate an inbound message against all active rules for the company
   */
  async evaluateMessage(context: InboundMessageContext): Promise<RuleMatchResult> {
    const { companyId, messageText } = context;
    const lowerText = messageText.toLowerCase();

    // Load active rules
    const activeRules = await this.getActiveRules(companyId);
    if (activeRules.length === 0) {
      return { matched: false, responseAlreadySent: false };
    }

    // Track the best match (if multiple rules match, pick the one with most keyword hits)
    let bestMatch: { rule: any; matchedKeywords: string[]; score: number } | null = null;

    for (const rule of activeRules) {
      const keywords = rule.triggerKeywords as string[];
      if (!keywords || keywords.length === 0) continue;

      // Check time-based conditions
      if (!this.checkTimeCondition(rule.conditions)) continue;

      // Check segment-based conditions
      if (!this.checkSegmentCondition(rule.conditions, context.customerSegment)) continue;

      // Check language conditions
      if (!this.checkLanguageCondition(rule.conditions, context.customerLanguage)) continue;

      // Keyword matching
      const matchedKeywords = this.matchKeywords(lowerText, keywords);
      let keywordScore = matchedKeywords.length;

      // If triggerType is AI_DETECTED, bypass keyword matching (AI handles it downstream)
      if (rule.triggerType === "AI_DETECTED") {
        keywordScore = 1; // Assume match, let AI decide
      }

      // For KEYWORD_AND_AI, require at least 1 keyword match
      if (rule.triggerType === "KEYWORD_AND_AI" && keywordScore === 0) continue;
      // For KEYWORD, require at least 1 keyword match
      if (rule.triggerType === "KEYWORD" && keywordScore === 0) continue;

      // Score is based on matched keyword count relative to total keywords
      const score = keywordScore / keywords.length;

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { rule, matchedKeywords, score };
      }
    }

    if (!bestMatch) {
      return { matched: false, responseAlreadySent: false };
    }

    // Generate response
    const response = await this.generateResponse(bestMatch.rule, context);

    // Log the match
    await this.logRuleMatch({
      companyId,
      ruleId: bestMatch.rule.id,
      conversationId: context.conversationId,
      leadId: context.leadId,
      inboundText: context.messageText,
      responseSent: response,
      matchedKeyword: bestMatch.matchedKeywords[0] || null,
      aiGenerated: bestMatch.rule.useAI,
    });

    // Send the response via outbound dispatcher
    await this.sendResponse(context, response);

    // Increment trigger count
    await prisma.conversationalRule.update({
      where: { id: bestMatch.rule.id },
      data: {
        triggerCount: { increment: 1 },
        lastTriggeredAt: new Date(),
      },
    });

    return {
      matched: true,
      ruleId: bestMatch.rule.id,
      ruleName: bestMatch.rule.name,
      matchedKeywords: bestMatch.matchedKeywords,
      response,
      responseAlreadySent: true,
    };
  }

  /**
   * Check if current time falls within the rule's allowed time range
   */
  private checkTimeCondition(conditions: any): boolean {
    if (!conditions?.timeRange) return true;

    const now = new Date();
    const currentHour = now.getHours();
    const { start, end } = conditions.timeRange;

    return currentHour >= start && currentHour <= end;
  }

  /**
   * Check if customer segment matches the rule's conditions
   */
  private checkSegmentCondition(conditions: any, customerSegment?: string): boolean {
    if (!conditions?.segment || !customerSegment) return true;
    return conditions.segment.includes(customerSegment);
  }

  /**
   * Check if customer language matches the rule's conditions
   */
  private checkLanguageCondition(conditions: any, customerLanguage?: string): boolean {
    if (!conditions?.language || !customerLanguage) return true;
    return conditions.language.includes(customerLanguage);
  }

  /**
   * Match message text against rule keywords (fuzzy matching with basic stemming)
   */
  private matchKeywords(text: string, keywords: string[]): string[] {
    const matched: string[] = [];
    const words = text.split(/\s+/);

    for (const keyword of keywords) {
      const lowerKeyword = keyword.toLowerCase().trim();

      // Exact match in the full text
      if (text.includes(lowerKeyword)) {
        matched.push(keyword);
        continue;
      }

      // Check individual words for close match (contained within a word)
      for (const word of words) {
        if (word.includes(lowerKeyword) || lowerKeyword.includes(word)) {
          if (word.length > 2 || lowerKeyword.length > 2) {
            matched.push(keyword);
            break;
          }
        }
      }
    }

    return [...new Set(matched)]; // Deduplicate
  }

  /**
   * Generate response using the rule's template or AI
   */
  private async generateResponse(rule: any, context: InboundMessageContext): Promise<string> {
    let response = rule.templateBody || "";

    // Replace template variables - support both {{var}} and {var} variants
    response = response
      .replace(/\{\{customerName\}\}/g, context.customerName || "there")
      .replace(/\{\{shopName\}\}/g, "")
      .replace(/\{\{brand\}\}/g, "")
      // Also handle single-brace variants (case-insensitive)
      .replace(/\{customerName\}/gi, context.customerName || "there")
      .replace(/\{shopname\}/gi, "")
      .replace(/\{shopName\}/g, "")
      .replace(/\{brand\}/gi, "")
      .replace(/\{name\}/gi, context.customerName || "there");

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
        sender: "AGENT",
      });
    } catch (err: any) {
      console.error(`[ConversationalAutoReply] Failed to send response: ${err.message}`);
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
   */
  private async getActiveRules(companyId: string): Promise<any[]> {
    const cached = this.rulesCache.get(companyId);
    if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL) {
      return cached.rules;
    }

    const rules = await prisma.conversationalRule.findMany({
      where: {
        companyId,
        isEnabled: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: new Date() } },
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
    const matchedKeywords = this.matchKeywords(sampleMessage.toLowerCase(), keywords);
    const matched = matchedKeywords.length > 0;

    let response = rule.templateBody || "";
    // Replace template variables - support both {{var}} and {var} variants
    response = response
      .replace(/\{\{customerName\}\}/g, "Test Customer")
      .replace(/\{\{shopName\}\}/g, "")
      .replace(/\{\{brand\}\}/g, "")
      // Also handle single-brace variants (case-insensitive)
      .replace(/\{customerName\}/gi, "Test Customer")
      .replace(/\{shopname\}/gi, "")
      .replace(/\{shopName\}/g, "")
      .replace(/\{brand\}/gi, "")
      .replace(/\{name\}/gi, "Test Customer");

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
}

export const conversationalAutoReplyService = new ConversationalAutoReplyService();