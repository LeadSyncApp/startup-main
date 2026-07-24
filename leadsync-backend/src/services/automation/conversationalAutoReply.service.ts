/**
 * Conversational Auto-Reply Service
 *
 * Evaluates every inbound customer message against the shop's active ConversationalRules.
 * Uses similarity-based matching via retrieveSimilarChunks (RAG) combined with keyword
 * specificity scoring. If a rule confidently matches (adjusted gap >= threshold), it sends
 * the rule's template reply. When two rules are similarly scored (ambiguous), the message
 * falls through to the AI orchestrator for context-aware handling.
 *
 * Scoring formula: finalScore = baseSimilarity + keywordSpecificityBonus
 * Keyword specificity rewards longer/exact-phrase trigger keyword matches.
 */

import { prisma } from "../../lib/prisma";
import { OutboundDispatcher } from "../outbound.dispatcher";
import { retrieveSimilarChunks } from "../knowledge/knowledgeRetriever.service";
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
type BlockedReason = "ineligible_time" | "ineligible_language" | "ineligible_segment" | "gap_below_threshold" | "rule_not_found" | "ambiguous";

// Valid pathTaken values including escalation
type PathTaken = "confident_match" | "ai_fallback" | "escalation";

// Candidate rule info for ambiguity logging
interface CandidateInfo {
  ruleId: string;
  ruleName: string;
  triggerKeywords: string[];
  matchedKeywords: string[];
  baseSimilarity: number;
  specificityBonus: number;
  finalScore: number;
}

export class ConversationalAutoReplyService {
  // Cache active rules per company (refreshed every 60s)
  private rulesCache = new Map<string, { rules: any[]; cachedAt: number }>();
  private readonly CACHE_TTL = 60_000; // 60 seconds

  // Per-conversation rate limiter: suppresses rapid re-triggers within the cooldown window
  private lastTriggerTimestamps = new Map<string, number>();
  private readonly RATE_LIMIT_COOLDOWN_MS = parseInt(process.env.AUTO_REPLY_COOLDOWN_MS || "3000", 10);

  // Threshold for confident rule match (configurable via env)
  private readonly CONFIDENCE_GAP_THRESHOLD = parseFloat(process.env.CONFIDENCE_GAP_THRESHOLD || "0.04");
  private readonly SINGLE_RULE_MIN_SCORE = parseFloat(process.env.SINGLE_RULE_MIN_SCORE || "0.70");
  // Rule type constants (same as orchestrator for consistency)
  private readonly RULE_TYPE_CANNED_REPLY = 1;
  private readonly RULE_TYPE_OTTO_QUERY = 2;
  private readonly RULE_TYPE_PRODUCT_QUERY = 3;

  // Keyword specificity scoring weights
  // These bonuses are added to the base vector-similarity score to reward
  // rules whose triggerKeywords more closely match the incoming message.
  private readonly KEYWORD_EXACT_PHRASE_BONUS = 0.15;  // keyword appears as exact contiguous phrase
  private readonly KEYWORD_ALL_WORDS_BONUS = 0.10;      // all words present but not contiguous
  private readonly KEYWORD_PARTIAL_BONUS = 0.05;         // partial word overlap
  private readonly KEYWORD_LENGTH_WEIGHT = 0.008;        // per-character bonus scaled by keyword length
  private readonly KEYWORD_LENGTH_CAP = 0.10;            // max length bonus per keyword

  // How many candidate rules to surface for ambiguity logging
  private readonly AMBIGUITY_LOG_TOP_N = 3;

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
   * Log ambiguous match details for later review.
   *
   * Outputs a structured JSON line to stdout so shop owners or engineers can
   * grep / aggregate to see which messages were ambiguous between which rules.
   *
   * Example log line:
   *   [ConversationalAutoReply] AMBIGUITY {...}
   *
   * In v1 this is a console.log; a dedicated DB table or analytics sink can
   * replace it later if needed.
   */
  private logAmbiguity(params: {
    companyId: string;
    conversationId?: string;
    messageText: string;
    topCandidate: CandidateInfo;
    runnerUp: CandidateInfo;
    gap: number;
  }): void {
    try {
      const payload = {
        event: "AMBIGUITY",
        timestamp: new Date().toISOString(),
        companyId: params.companyId,
        conversationId: params.conversationId,
        messageText: params.messageText.substring(0, 500),
        topCandidate: {
          ruleId: params.topCandidate.ruleId,
          ruleName: params.topCandidate.ruleName,
          triggerKeywords: params.topCandidate.triggerKeywords,
          matchedKeywords: params.topCandidate.matchedKeywords,
          baseSimilarity: params.topCandidate.baseSimilarity,
          specificityBonus: params.topCandidate.specificityBonus,
          finalScore: params.topCandidate.finalScore,
        },
        runnerUp: {
          ruleId: params.runnerUp.ruleId,
          ruleName: params.runnerUp.ruleName,
          triggerKeywords: params.runnerUp.triggerKeywords,
          matchedKeywords: params.runnerUp.matchedKeywords,
          baseSimilarity: params.runnerUp.baseSimilarity,
          specificityBonus: params.runnerUp.specificityBonus,
          finalScore: params.runnerUp.finalScore,
        },
        gap: params.gap,
        threshold: this.CONFIDENCE_GAP_THRESHOLD,
        action: "fallback_to_ai",
      };
      console.log(`[ConversationalAutoReply] AMBIGUITY ${JSON.stringify(payload)}`);
    } catch {
      // Logging should never throw
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
   * Calculate keyword specificity bonus for a rule against the incoming message.
   *
   * Scoring rationale:
   * - Exact phrase match ("briyani offer" in "do you have briyani offer?") → highest bonus
   *   because the customer typed the specific phrase the rule targets.
   * - All-words match ("briyani offer" words both present but not contiguous) → mid bonus.
   * - Partial word overlap → small bonus.
   * - Longer keywords get an additional length bonus (capped) to reward specificity
   *   over short generic terms.
   *
   * Returns { bonus: number, matchedKeywords: string[] }
   */
  private calculateKeywordSpecificity(
    messageText: string,
    triggerKeywords: string[]
  ): { bonus: number; matchedKeywords: string[] } {
    if (!triggerKeywords || triggerKeywords.length === 0) {
      return { bonus: 0, matchedKeywords: [] };
    }

    const normalisedMessage = messageText.toLowerCase().trim();
    const messageWords = normalisedMessage.split(/\s+/);
    let bestBonus = 0;
    const matchedKeywords: string[] = [];

    for (const rawKeyword of triggerKeywords) {
      const keyword = rawKeyword.toLowerCase().trim();
      if (!keyword) continue;

      let keywordBonus = 0;

      // 1. Exact phrase match — the keyword appears as a contiguous substring
      if (normalisedMessage.includes(keyword)) {
        keywordBonus = this.KEYWORD_EXACT_PHRASE_BONUS;
        matchedKeywords.push(rawKeyword);
      } else {
        // 2. All individual words of the keyword appear in the message (order-independent)
        const keywordWords = keyword.split(/\s+/);
        const allWordsPresent = keywordWords.every(kw => messageWords.includes(kw));

        if (allWordsPresent && keywordWords.length > 1) {
          keywordBonus = this.KEYWORD_ALL_WORDS_BONUS;
          matchedKeywords.push(rawKeyword);
        } else {
          // 3. Partial word overlap — any word of the keyword is a substring of a message word or vice versa
          const hasPartialOverlap = keywordWords.some(kw =>
            messageWords.some(mw => mw.includes(kw) || kw.includes(mw))
          );
          if (hasPartialOverlap) {
            keywordBonus = this.KEYWORD_PARTIAL_BONUS;
            matchedKeywords.push(rawKeyword);
          }
        }
      }

      // Length bonus: longer keywords are more specific (capped)
      const lengthBonus = Math.min(
        keyword.length * this.KEYWORD_LENGTH_WEIGHT,
        this.KEYWORD_LENGTH_CAP
      );
      keywordBonus += lengthBonus;

      if (keywordBonus > bestBonus) {
        bestBonus = keywordBonus;
      }
    }

    return { bonus: bestBonus, matchedKeywords: [...new Set(matchedKeywords)] };
  }

  /**
   * Evaluate similarity-based match using retrieveSimilarChunks + keyword specificity.
   *
   * Scoring approach:
   *   finalScore = baseSimilarity + keywordSpecificityBonus
   *
   * This ensures that when two rules have close vector-similarity scores (e.g. "briyani"
   * vs "briyani offer"), the rule whose triggerKeywords more precisely match the message
   * text wins. If the gap between top and second-best final scores is still too narrow
   * (below CONFIDENCE_GAP_THRESHOLD), we return null to trigger AI fallback — we don't
   * silently guess between two close matches.
   *
   * Only considers rules that pass eligibility checks.
   * Returns null if no confident match found.
   */
  private async evaluateSimilarityMatch(
    companyId: string,
    messageText: string,
    eligibleRules: any[],
    prefetchedChunks?: any[]
  ): Promise<{
    rule: any;
    topScore: number;
    secondScore?: number;
    gap?: number;
    candidates: CandidateInfo[];
  } | null> {
    // Filter sourceIds to only eligible rules
    const eligibleRuleIds = eligibleRules.map(r => r.id);

    // Get similar chunks (rules are embedded as KnowledgeChunks with sourceType='RULE')
    // Retrieve top 10 to have a wider pool for specificity comparison
    // Use prefetched chunks if available (avoids duplicate RAG call from evaluateMessage)
    const chunks = prefetchedChunks ?? await retrieveSimilarChunks(companyId, messageText, 10, "RULE");

    // Filter chunks to only those matching eligible rules
    const eligibleChunks = chunks.filter(chunk => eligibleRuleIds.includes(chunk.sourceId));

    if (eligibleChunks.length === 0) {
      return null;
    }

    // Build scored candidates: baseSimilarity + keyword specificity bonus
    const candidates: CandidateInfo[] = eligibleChunks.map(chunk => {
      const rule = eligibleRules.find(r => r.id === chunk.sourceId);
      if (!rule) return null;

      const triggerKeywords = (rule.triggerKeywords as string[]) || [];
      const { bonus: specificityBonus, matchedKeywords } = this.calculateKeywordSpecificity(messageText, triggerKeywords);
      const finalScore = chunk.similarity + specificityBonus; // no cap — used for relative ranking only

      return {
        ruleId: rule.id,
        ruleName: rule.name,
        triggerKeywords,
        matchedKeywords,
        baseSimilarity: chunk.similarity,
        specificityBonus,
        finalScore,
      };
    }).filter((c): c is CandidateInfo => c !== null);

    if (candidates.length === 0) return null;

    // Sort by finalScore descending (primary), then by baseSimilarity (tiebreaker)
    candidates.sort((a, b) => b.finalScore - a.finalScore || b.baseSimilarity - a.baseSimilarity);

    const topCandidate = candidates[0];
    const secondCandidate = candidates.length >= 2 ? candidates[1] : undefined;

    const topScore = topCandidate.finalScore;
    const secondScore = secondCandidate?.finalScore;

    // Compute gap for decision
    let isConfident: boolean;
    let gap: number | undefined;

    if (candidates.length >= 2) {
      gap = topScore - secondScore!;
      isConfident = gap >= this.CONFIDENCE_GAP_THRESHOLD;
    } else {
      // Single candidate: fire if its score meets the minimum threshold.
      // SINGLE_RULE_MIN_SCORE is configurable via env (default 0.70).
      isConfident = topScore >= this.SINGLE_RULE_MIN_SCORE;
      gap = undefined;
    }

    if (!isConfident) {
      return null;
    }

    // Find the matching rule by sourceId
    const rule = eligibleRules.find(r => r.id === topCandidate.ruleId);

    if (!rule) {
      return null;
    }

    return {
      rule,
      topScore,
      secondScore,
      gap,
      candidates: candidates.slice(0, this.AMBIGUITY_LOG_TOP_N),
    };
  }

  /**
   * Evaluate an inbound message against all active rules for the company
   * Pipeline: fetch active rules → filter to eligible rules → run similarity check
   */
  async evaluateMessage(context: InboundMessageContext): Promise<RuleMatchResult> {
    const { companyId, messageText, conversationId } = context;

    // Per-conversation rate limiter: suppress rapid re-triggers from the same conversation
    const rateLimitKey = `${companyId}:${conversationId}`;
    const lastTrigger = this.lastTriggerTimestamps.get(rateLimitKey);
    if (lastTrigger && Date.now() - lastTrigger < this.RATE_LIMIT_COOLDOWN_MS) {
      return { matched: false, responseAlreadySent: false };
    }
    this.lastTriggerTimestamps.set(rateLimitKey, Date.now());

    // Load active rules
    const activeRules = await this.getActiveRules(companyId);
    if (activeRules.length === 0) {
      return { matched: false, responseAlreadySent: false };
    }

    // Task 1: Filter to only eligible rules BEFORE similarity check
    const eligibleRules: any[] = [];

    for (const rule of activeRules) {
      if (rule.useAI) continue; // AI rules are handled dynamically in Phase 2b (main AI)
      const eligibility = this.checkRuleEligibility(rule, context);
      if (eligibility.eligible) {
        eligibleRules.push(rule);
      }
    }

    // Get chunks for eligible rules with 500ms timeout guard
    let allChunks: any[] = [];
    if (eligibleRules.length > 0) {
      allChunks = await Promise.race([
        retrieveSimilarChunks(companyId, messageText, 5, "RULE"),
        new Promise<any[]>((resolve) => setTimeout(() => resolve([]), 500))
      ]);
    }
    
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

    // Try similarity-based match on ELIGIBLE rules only (with keyword specificity scoring)
    // Pass allChunks to avoid duplicate retrieveSimilarChunks call inside evaluateSimilarityMatch
    const simMatch = await this.evaluateSimilarityMatch(companyId, messageText, eligibleRules, allChunks);

    if (!simMatch) {
      // No confident match - log and return (will fall through to AI)
      // Retrieve scored candidates for ambiguity logging even when below threshold
      const eligibleRuleIds = eligibleRules.map(r => r.id);
      const allEligibleChunks = allChunks.filter(chunk => eligibleRuleIds.includes(chunk.sourceId));

      if (allEligibleChunks.length >= 2) {
        // Build scored candidates to find the ambiguous pair
        const scoredCandidates: CandidateInfo[] = allEligibleChunks.map(chunk => {
          const rule = eligibleRules.find(r => r.id === chunk.sourceId);
          if (!rule) return null;
          const triggerKeywords = (rule.triggerKeywords as string[]) || [];
          const { bonus: specificityBonus, matchedKeywords } = this.calculateKeywordSpecificity(messageText, triggerKeywords);
          const finalScore = chunk.similarity + specificityBonus; // no cap — used for relative ranking only
          return {
            ruleId: rule.id,
            ruleName: rule.name,
            triggerKeywords,
            matchedKeywords,
            baseSimilarity: chunk.similarity,
            specificityBonus,
            finalScore,
          };
        }).filter((c): c is CandidateInfo => c !== null);

        scoredCandidates.sort((a, b) => b.finalScore - a.finalScore || b.baseSimilarity - a.baseSimilarity);

        if (scoredCandidates.length >= 2) {
          const gap = scoredCandidates[0].finalScore - scoredCandidates[1].finalScore;

          // Log ambiguity so shop owners can review and refine keywords
          this.logAmbiguity({
            companyId,
            conversationId,
            messageText,
            topCandidate: scoredCandidates[0],
            runnerUp: scoredCandidates[1],
            gap,
          });

          await this.logDecision({
            companyId,
            conversationId,
            messageText,
            topScore: scoredCandidates[0].finalScore,
            secondScore: scoredCandidates[1].finalScore,
            gap,
            pathTaken: "ai_fallback",
            matchedRuleId: null,
            blockedReason: "ambiguous",
          });

          return { matched: false, responseAlreadySent: false };
        }
      }

      // Either no eligible chunks at all, or only one (handled by SINGLE_RULE_MIN_SCORE above)
      const topScore = allEligibleChunks.length >= 1 ? allEligibleChunks[0].similarity : undefined;
      const secondScore = allEligibleChunks.length >= 2 ? allEligibleChunks[1].similarity : undefined;
      const gap = allEligibleChunks.length >= 2 ? topScore! - secondScore! : undefined;

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
    const { rule, topScore, secondScore, gap, candidates } = simMatch;

    // Idempotency check: Skip dispatch if a ConversationalRuleLog already exists for this inbound message within the last 5 minutes (dedupes webhook retries without blocking future messages)
    const DUP_LOOKBACK_MS = 5 * 60 * 1000;
    const existingLog = await prisma.conversationalRuleLog.findFirst({
      where: {
        companyId,
        conversationId: context.conversationId,
        inboundText: context.messageText.substring(0, 1000),
        createdAt: { gte: new Date(Date.now() - DUP_LOOKBACK_MS) },
      },
    });

    if (existingLog) {
      return {
        matched: true,
        ruleId: rule.id,
        ruleName: rule.name,
        matchedKeywords: candidates[0]?.matchedKeywords || [],
        response: existingLog.responseSent || "",
        responseAlreadySent: true,
      };
    }

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
    const topCandidate = candidates[0];
    await this.logRuleMatch({
      companyId,
      ruleId: rule.id,
      conversationId: context.conversationId,
      leadId: context.leadId,
      inboundText: context.messageText,
      responseSent: response,
      matchedKeyword: topCandidate?.matchedKeywords?.[0] || null,
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
      matchedKeywords: topCandidate?.matchedKeywords || [],
      response,
      responseAlreadySent: !isRagRule,
    };
  }

  /**
   * Generate response using the rule's template or AI enhancement
   */
  private async generateResponse(rule: any, context: InboundMessageContext, skipAI = false): Promise<string> {
    let response = rule.templateBody || "";

    // Replace template variables - case-insensitive matching for all variants
    // Supported variables: customerName, shopName, brand, name
    // Both {var} and {{var}} syntaxes are supported
    response = response
      .replace(/\{\{customerName\}\}/gi, context.customerName || "there")
      .replace(/\{customerName\}/gi, context.customerName || "there")
      .replace(/\{\{shopName\}\}/gi, "")
      .replace(/\{shopName\}/gi, "")
      .replace(/\{\{brand\}\}/gi, "")
      .replace(/\{brand\}/gi, "")
      .replace(/\{name\}/gi, context.customerName || "there")
      .replace(/\{\{(\d+)\}\}/g, "Rs. $1");

    // If useAI is enabled, enhance the response with AI
    if (rule.useAI && !skipAI) {
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
   * Invalidate cache when rules are updated, then warm it immediately
   * so the next message evaluation does not pay a cold-start cost.
   */
  invalidateCache(companyId: string): void {
    this.rulesCache.delete(companyId);
    // Fire-and-forget warmup
    this.getActiveRules(companyId).catch((err) =>
      console.warn(`[ConversationalAutoReply] Cache warmup failed for ${companyId}: ${err.message}`)
    );
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
   * Events fire synchronously (delayMinutes is not supported).
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
    if (!rule || !rule.isEnabled) {
      if (context.isCallback && context.callbackQueryId) {
        await telegramSurfaceAdapter.answerCallbackQuery(
          context.companyId,
          context.callbackQueryId,
          rule ? "This option is currently disabled." : "This option is no longer available."
        ).catch(() => {});
      }
      return false;
    }

    // Check if Category or Leaf by looking for active children
    const children = await telegramSurfaceAdapter.getActiveSurfacedRules(context.companyId, ruleId, "BUTTON");
    const isCategory = children.length > 0;

    let responseText = await this.generateResponse(rule, context, true); // skipAI = true (canned only)
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
      aiGenerated: false, // Bypass paths are never AI-generated
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

    // Build a mock context matching the production pipeline
    const context: InboundMessageContext = {
      companyId: rule.companyId,
      conversationId: "test-conversation",
      leadId: "test-lead",
      messageText: sampleMessage,
      customerName: "Test Customer",
      channel: "TELEGRAM",
      contact: "test-contact",
    };

    // Fetch active rules (same as production pipeline)
    const activeRules = await this.getActiveRules(rule.companyId);
    const testedRule = activeRules.find(r => r.id === ruleId);

    let matched = false;
    let matchedKeywords: string[] = [];

    if (testedRule) {
      // Check eligibility as production does
      const eligibility = this.checkRuleEligibility(testedRule, context);
      if (eligibility.eligible && !testedRule.useAI) {
        // Build eligible rules the same way evaluateMessage does
        const eligibleRules = activeRules.filter(r => {
          if (r.useAI) return false;
          return this.checkRuleEligibility(r, context).eligible;
        });

        // Run the real RAG + keyword specificity pipeline
        const simMatch = await this.evaluateSimilarityMatch(
          rule.companyId,
          sampleMessage,
          eligibleRules
        );

        if (simMatch && simMatch.rule.id === ruleId) {
          matched = true;
          matchedKeywords = simMatch.candidates[0]?.matchedKeywords || [];
        }
      }
    }

    // Generate response using the real generateResponse method
    let response = await this.generateResponse(rule, context);

    // Apply AI enhancement if configured (same as production)
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