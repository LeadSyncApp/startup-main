/**
 * AI Personality Integration Types
 * Grok (xAI) + Sarvam AI for Indian language support
 */

export type BrandVoice = "formal" | "casual" | "friendly" | "salesy";

export type TargetLanguage = "en" | "hi" | "ta" | "te" | "bn";

export type SentimentScore = "positive" | "neutral" | "negative";

export interface AIPersonalityConfig {
  companyId: string;
  enabled: boolean;
  brandVoice: BrandVoice;
  targetLanguage: TargetLanguage;
  useAI: boolean;
  grokApiKey?: string;
  sarvamApiKey?: string;
}

export interface AIGenerationContext {
  eventKey: string;
  customerName?: string;
  orderId?: string;
  brandName: string;
  channel: string;
  originalTemplate: string;
  sentiment?: SentimentScore;
  customerHistory?: {
    orderCount: number;
    totalSpend: number;
    segment: string;
  };
}

export interface AIGeneratedMessage {
  message: string;
  language: TargetLanguage;
  usedAI: boolean;
}

export const BRAND_VOICE_PROMPTS: Record<BrandVoice, string> = {
  formal: "You are a professional business assistant. Use formal, respectful language. Address customers with respect (e.g., 'Dear {name}', 'Kindly', 'We would like to inform you').",
  casual: "You are a friendly shop assistant. Use casual, relaxed language. Use contractions (e.g., 'Hey {name}!', 'We've got', 'Just wanted to let you know').",
  friendly: "You are a warm, enthusiastic shop owner. Use emojis and exclamation points. Be personal and heartfelt (e.g., 'Hey {name}! 😊', 'We're so excited!').",
  salesy: "You are a persuasive sales agent. Use urgency and excitement. Include calls-to-action (e.g., 'Don't miss out!', 'Limited time offer!', 'Grab yours now!').",
};

export const LANGUAGE_NAMES: Record<TargetLanguage, string> = {
  en: "English",
  hi: "Hindi",
  ta: "Tamil",
  te: "Telugu",
  bn: "Bengali",
};