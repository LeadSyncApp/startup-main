/**
 * AI Personality Service
 * Uses Grok (xAI) to generate personalized messages + Sarvam AI for Indian language translation
 * Falls back to static templates if AI is unavailable or disabled.
 */

import { EventEmitter } from "events";
import {
  AIPersonalityConfig,
  AIGenerationContext,
  AIGeneratedMessage,
  BRAND_VOICE_PROMPTS,
  TargetLanguage,
} from "./aiPersonality.types";
import { prisma } from "../../lib/prisma";

// In-memory cache for AI configs (avoids DB hit on every message)
const configCache = new Map<string, AIPersonalityConfig>();

export class AIPersonalityService extends EventEmitter {
  private grokEndpoint = "https://api.groq.com/openai/v1/chat/completions";
  private sarvamEndpoint = "https://api.sarvam.ai/translate";

  /**
   * Get AI config for a company (cached)
   */
  async getConfig(companyId: string): Promise<AIPersonalityConfig> {
    if (configCache.has(companyId)) {
      return configCache.get(companyId)!;
    }

    const hasApiKey = !!process.env.GROQ_API_KEY;

    // Load company-specific config from DB if available
    let dbConfig: any = {};
    try {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        include: { botConfiguration: true }
      });
      if (company) {
        dbConfig = (company.botConfiguration as any) || {};
      }
    } catch (err) {
      console.warn("[AIPersonality] Failed to load company config from DB, using defaults:", err);
    }

    const config: AIPersonalityConfig = {
      companyId,
      enabled: hasApiKey,
      brandVoice: dbConfig.ai_brand_voice || dbConfig.brandVoice || "friendly",
      targetLanguage: dbConfig.ai_target_language || dbConfig.targetLanguage || "en",
      useAI: hasApiKey,
      grokApiKey: process.env.GROQ_API_KEY,
      sarvamApiKey: process.env.SARVAM_API_KEY,
    };

    configCache.set(companyId, config);
    return config;
  }

  /**
   * Core: Generate or translate a message based on AI config
   */
  async generateMessage(
    context: AIGenerationContext,
    companyId: string,
    customPrompt?: string
  ): Promise<AIGeneratedMessage> {
    const config = await this.getConfig(companyId);

    // If a custom prompt is provided, ALWAYS use it (regardless of AI enabled/disabled status)
    // This is used by features like "Quick Automation" and "Generate from Description"
    if (customPrompt) {
      try {
        const generated = await this.callGrokWithPrompt(customPrompt, context, config);
        return {
          message: generated,
          language: "en",
          usedAI: true,
        };
      } catch (err: any) {
        // If custom prompt generation fails, fall through to normal flow
        console.warn(`[AIPersonality] Custom prompt generation failed: ${err.message}. Falling back to normal flow.`);
      }
    }

    // If AI is disabled or no API keys, return original template
    if (!config.enabled || !config.useAI) {
      return {
        message: context.originalTemplate,
        language: "en",
        usedAI: false,
      };
    }

    try {
      // Step 1: Generate personalized message with Grok
      const generated = await this.callGrok(context, config);

      // Step 2: If target language is not English, translate with Sarvam
      if (config.targetLanguage !== "en" && config.sarvamApiKey) {
        const translated = await this.callSarvamTranslate(
          generated,
          config.targetLanguage,
          config
        );
        return {
          message: translated,
          language: config.targetLanguage,
          usedAI: true,
        };
      }

      return {
        message: generated,
        language: "en",
        usedAI: true,
      };
    } catch (error: any) {
      console.error("[AIPersonality] Generation failed, falling back to template:", error.message);
      return {
        message: context.originalTemplate,
        language: "en",
        usedAI: false,
      };
    }
  }

  /**
   * Call Grok with a custom prompt (bypasses normal template flow)
   */
  private async callGrokWithPrompt(
    customPrompt: string,
    context: AIGenerationContext,
    config: AIPersonalityConfig
  ): Promise<string> {
    const apiKey = config.grokApiKey;
    if (!apiKey) {
      throw new Error("Grok API key not configured");
    }

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
            content: "You are a helpful message writer. Write only the message, no explanations.",
          },
          {
            role: "user",
            content: customPrompt,
          },
        ],
        max_tokens: 200,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Grok API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message?.content?.trim();
    if (!message) {
      throw new Error("Grok returned empty message");
    }

    return message;
  }

  /**
   * Call Grok (xAI) to generate a personalized message
   */
  private async callGrok(
    context: AIGenerationContext,
    config: AIPersonalityConfig
  ): Promise<string> {
    const apiKey = config.grokApiKey;
    if (!apiKey) {
      throw new Error("Grok API key not configured");
    }

    const voicePrompt = BRAND_VOICE_PROMPTS[config.brandVoice];
    const customerInfo = context.customerName
      ? `Customer name: ${context.customerName}`
      : "Customer";
    const orderInfo = context.orderId ? `Order #${context.orderId}` : "their order";
    const historyInfo = context.customerHistory
      ? `\nCustomer history: ${context.customerHistory.orderCount} previous orders, ₹${context.customerHistory.totalSpend} total spend, segment: ${context.customerHistory.segment}`
      : "";

    const userPrompt = `${voicePrompt}

Generate a short, natural-sounding notification message for this event:
- Event: ${context.eventKey}
- ${customerInfo}
- ${orderInfo}
- Brand: ${context.brandName}
- Channel: ${context.channel}${historyInfo}

Original template: "${context.originalTemplate}"

Rules:
- Keep it SHORT (under 100 characters for WhatsApp/Telegram)
- Match the brand voice tone
- Include the customer name naturally
- Make it sound human, not robotic
- Do NOT include the original template literally — rewrite it

Return ONLY the message text, nothing else.`;

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
            content: voicePrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        max_tokens: 150,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Grok API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message?.content?.trim();
    if (!message) {
      throw new Error("Grok returned empty message");
    }

    return message;
  }

  /**
   * Call Sarvam AI to translate text to an Indian language
   */
  private async callSarvamTranslate(
    text: string,
    targetLang: TargetLanguage,
    config: AIPersonalityConfig
  ): Promise<string> {
    const apiKey = config.sarvamApiKey;
    if (!apiKey) {
      return text; // No key — skip translation
    }

    const response = await fetch(this.sarvamEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-subscription-key": apiKey,
      },
      body: JSON.stringify({
        input: text,
        source_language_code: "en-IN",
        target_language_code: `${targetLang}-IN`,
        mode: "formal",
        enable_preprocessing: true,
        enable_postprocessing: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Sarvam API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const translated = data.translated_text?.trim();
    if (!translated) {
      throw new Error("Sarvam returned empty translation");
    }

    return translated;
  }

  /**
   * Clear cache (call when company updates their config)
   */
  invalidateCache(companyId: string) {
    configCache.delete(companyId);
  }
}

export const aiPersonalityService = new AIPersonalityService();