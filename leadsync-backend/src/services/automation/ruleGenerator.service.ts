/**
 * Rule Generator Service
 * 
 * Converts a shop owner's plain-text prompt (e.g. "When customer asks about biryani, offer 50% discount")
 * into a structured ConversationalRule with trigger keywords, conditions, and response template.
 * Uses the same Groq AI infrastructure as aiPersonality.service.ts.
 */

import { prisma } from "../../lib/prisma";

// Minimum character length for the AI-generated templateBody (response text).
// Initial estimate — tune post-launch based on observed AI output quality.
const MIN_TEMPLATE_LENGTH = 15;

export interface RuleGenerationInput {
  prompt: string;                    // Plain-text prompt from the shop owner
  companyId: string;
  businessType?: string;             // e.g. "restaurant", "home_bakery", "retail"
  businessName?: string;
  productCatalog?: string[];         // List of product names for context
}

export interface GeneratedRuleData {
  name: string;
  triggerKeywords: string[];
  triggerType: "KEYWORD" | "AI_DETECTED" | "KEYWORD_AND_AI";
  templateBody: string;
  useAI: boolean;
  brandVoice: string;
  targetLanguage: string;
  conditions: {
    segment?: string[];
    timeRange?: { start: number; end: number };
    language?: string[];
  } | null;
  sourcePrompt: string;
  needsReview: boolean;
  clarificationHint?: string;
}

export class RuleGeneratorService {
  private grokEndpoint = "https://api.groq.com/openai/v1/chat/completions";

  /**
   * Generate a structured rule from a plain-text prompt
   */
  async generateFromPrompt(input: RuleGenerationInput): Promise<GeneratedRuleData> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("GROQ_API_KEY not configured");
    }

    const systemPrompt = this.buildSystemPrompt(input);
    const userPrompt = this.buildUserPrompt(input);

    const response = await fetch(this.grokEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        max_tokens: 700,
        temperature: 0.3, // Lower temperature for structured output
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Groq API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error("Groq returned empty message");
    }

    // Parse the JSON response
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (err: any) {
      throw new Error(`Failed to parse AI response as JSON: ${err.message}. Raw: ${content.substring(0, 200)}`);
    }

    // Read AI's self-reported confidence
    const confidence: string = parsed.confidence || "clear";
    const clarificationHint: string =
      parsed.clarificationHint && typeof parsed.clarificationHint === "string"
        ? parsed.clarificationHint.trim()
        : "";

    // ------------------------------------------------------------------
    // Structured validation — independent fallback even when AI reports "clear"
    // ------------------------------------------------------------------

    // 1. triggerKeywords must be a non-empty array with at least one real keyword
    if (!parsed.triggerKeywords || !Array.isArray(parsed.triggerKeywords) || parsed.triggerKeywords.length === 0) {
      throw new Error(
        clarificationHint || "AI could not extract any trigger keywords from your input. Please write a clearer instruction."
      );
    }
    const validKeywords = parsed.triggerKeywords.filter((k: any) => typeof k === "string" && k.trim().length > 0);
    if (validKeywords.length === 0) {
      throw new Error(
        clarificationHint || "AI response contained only empty trigger keywords. Try rephrasing your instruction."
      );
    }

    // 2. name must be non-empty
    const cleanName = parsed.name && typeof parsed.name === "string" ? parsed.name.trim() : "";
    if (!cleanName) {
      throw new Error("AI response missing required 'name' field");
    }

    // 3. templateBody must be long enough to be useful
    const cleanTemplate = parsed.templateBody && typeof parsed.templateBody === "string" ? parsed.templateBody.trim() : "";
    if (cleanTemplate.length < MIN_TEMPLATE_LENGTH) {
      throw new Error(
        clarificationHint || `Generated response template is too short (${cleanTemplate.length} chars). Please provide more detail in your instruction.`
      );
    }

    // 4. Reject verbatim echo of the prompt
    if (cleanTemplate.toLowerCase() === input.prompt.trim().toLowerCase()) {
      throw new Error("The AI echoed your input back verbatim instead of generating a response. Please rephrase your instruction.");
    }

    // 5. If the AI itself says the input is unintelligible, reject
    if (confidence === "unintelligible") {
      throw new Error(
        clarificationHint || "We couldn't understand your instruction. Please describe what behavior you want the bot to have."
      );
    }

    // 6. Determine needsReview — true when AI is unsure
    const needsReview = confidence === "vague";

    const generated: GeneratedRuleData = {
      name: cleanName,
      triggerKeywords: validKeywords,
      triggerType: parsed.triggerType || "KEYWORD",
      templateBody: cleanTemplate,
      useAI: parsed.useAI !== undefined ? parsed.useAI : false,
      brandVoice: parsed.brandVoice || "friendly",
      targetLanguage: parsed.targetLanguage || "auto",
      conditions: parsed.conditions || null,
      sourcePrompt: input.prompt,
      needsReview,
      clarificationHint: needsReview ? clarificationHint : undefined,
    };

    return generated;
  }

  /**
   * Build the system prompt that instructs the AI on how to generate rules
   */
  private buildSystemPrompt(input: RuleGenerationInput): string {
    return `You are a smart rule generator for an e-commerce chatbot called LeadSync. 
Your job is to convert a shop owner's plain-text instruction into a structured JSON rule that the chatbot can execute.

The rule will be used to automatically respond to customer messages based on keywords and conditions.

OUTPUT FORMAT - Return ONLY valid JSON with these fields:
{
  "name": "A short, descriptive name for this rule (max 50 chars)",
  "triggerKeywords": ["array", "of", "keywords", "to", "match", "in", "customer", "messages"],
  "triggerType": "KEYWORD" | "AI_DETECTED" | "KEYWORD_AND_AI",
  "templateBody": "The response template. Use {{customerName}} for customer's name, {{shopName}} for shop name. Keep conversational.",
  "useAI": false,
  "brandVoice": "friendly" | "casual" | "formal" | "salesy",
  "targetLanguage": "auto" | "en" | "hi" | "ta" | "te" | "bn",
  "conditions": {
    "segment": ["NEW", "REGULAR", "VIP", "CHURN_RISK"],
    "timeRange": { "start": 8, "end": 22 },
    "language": ["en", "hi"]
  },
  "confidence": "clear" | "vague" | "unintelligible",
  "clarificationHint": "Only provide a hint string if confidence is vague or unintelligible, explaining what was unclear. Leave as empty string if confidence is clear."
}

RULES:
1. Extract 3-8 most relevant trigger keywords from the prompt - use both English and relevant Indian language transliterations
2. For triggerType: use "KEYWORD" for simple keyword matching, "KEYWORD_AND_AI" when understanding nuance matters
3. Template should be natural and conversational, not salesy unless specified
4. Include Indian language keyword variants (Hindi, Tamil, Telugu, etc.) based on context
5. If the prompt mentions timing or segments, reflect in conditions
6. If the prompt is about a special offer/discount, set brandVoice to "salesy"
7. Keep templateBody under 200 characters
8. confidence must be "clear" if you fully understood the instruction and can generate meaningful keywords and template; "vague" if parts are unclear but you can still produce a partial rule; "unintelligible" if the input is gibberish, random characters, or nonsensical
9. When confidence is "vague" or "unintelligible", populate clarificationHint with a specific question about what the user meant (e.g. "I couldn't understand your request. Please describe what behavior you want the bot to have.")`;
  }

  /**
   * Build the user prompt with the shop owner's instruction + context
   */
  private buildUserPrompt(input: RuleGenerationInput): string {
    const contextParts: string[] = [];

    if (input.businessName) {
      contextParts.push(`Shop name: ${input.businessName}`);
    }
    if (input.businessType) {
      contextParts.push(`Business type: ${input.businessType}`);
    }
    if (input.productCatalog && input.productCatalog.length > 0) {
      contextParts.push(`Products available: ${input.productCatalog.join(", ")}`);
    }

    const contextStr = contextParts.length > 0
      ? `\n\nSHOP CONTEXT:\n${contextParts.join("\n")}`
      : "";

    return `Generate a conversational rule based on this shop owner's instruction:

"${input.prompt}"${contextStr}

Return the JSON rule object as specified.`;
  }

  /**
   * Suggest improvements or variations for an existing rule
   */
  async suggestVariations(
    existingRule: { name: string; triggerKeywords: string[]; templateBody: string },
    companyId: string
  ): Promise<{ suggestions: string[]; additionalKeywords: string[] }> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return { suggestions: [], additionalKeywords: [] };
    }

    const prompt = `Given this chatbot rule:
- Name: ${existingRule.name}
- Keywords: ${existingRule.triggerKeywords.join(", ")}
- Template: ${existingRule.templateBody}

Suggest 3 improvements or variations to make the rule more effective for customer engagement. Also suggest 3-5 additional trigger keywords that could be added.
Return as JSON: { "suggestions": ["suggestion1", "suggestion2", "suggestion3"], "additionalKeywords": ["kw1", "kw2", "kw3"] }`;

    const response = await fetch(this.grokEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "You are a chatbot strategy expert. Return JSON only." },
          { role: "user", content: prompt },
        ],
        max_tokens: 300,
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      return { suggestions: [], additionalKeywords: [] };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return { suggestions: [], additionalKeywords: [] };

    try {
      return JSON.parse(content);
    } catch {
      return { suggestions: [], additionalKeywords: [] };
    }
  }
}

export const ruleGeneratorService = new RuleGeneratorService();