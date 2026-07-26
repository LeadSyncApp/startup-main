/**
 * Language Detection Service
 * Uses Sarvam AI's language detection API for Indian languages
 * Falls back to Unicode range detection if Sarvam API is unavailable
 */

export type DetectedLanguage = "en" | "hi" | "ta" | "te" | "bn" | "gu" | "kn" | "ml" | "mr" | "pa" | "ur" | "unknown";

export interface LanguageDetectionResult {
  language: DetectedLanguage;
  confidence: number;
}

/**
 * Detect language using Sarvam AI API with Unicode fallback
 */
let sarvamCooldownUntil = 0;
const SARVAM_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes after failure

export async function detectLanguage(
  text: string,
  apiKey?: string
): Promise<LanguageDetectionResult> {
  if (!text || text.trim().length === 0) {
    return { language: "en", confidence: 0 };
  }

  // Try Sarvam AI API first if not in cooldown
  if (apiKey && Date.now() > sarvamCooldownUntil) {
    try {
      return await sarvamLanguageDetect(text, apiKey);
    } catch (error: any) {
      sarvamCooldownUntil = Date.now() + SARVAM_COOLDOWN_MS;
      console.warn(`[LanguageDetection] Sarvam API failed (${error.message}). Cooldown for 5 minutes, falling back to Unicode detection.`);
    }
  }

  // Fallback: Unicode range detection
  return quickUnicodeDetect(text);
}

/**
 * Call Sarvam AI language detection API
 */
async function sarvamLanguageDetect(text: string, apiKey: string): Promise<LanguageDetectionResult> {
  const response = await fetch("https://api.sarvam.ai/text-lid", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-subscription-key": apiKey,
    },
    body: JSON.stringify({
      input: text.substring(0, 500), // Limit input length
    }),
    signal: AbortSignal.timeout(1500), // 1.5s timeout (Sarvam healthy response ~770ms)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Sarvam language detection API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  
  // Sarvam returns: { request_id: "...", language_code: "ta-IN", script_code: "Taml" }
  const langCode = data.language_code?.split("-")[0]?.toLowerCase() || "en";
  const confidence = data.confidence !== undefined ? data.confidence : 1.0;
  
  const validLanguages: DetectedLanguage[] = ["en", "hi", "ta", "te", "bn", "gu", "kn", "ml", "mr", "pa", "ur"];
  const language = validLanguages.includes(langCode as DetectedLanguage) 
    ? (langCode as DetectedLanguage) 
    : "en";

  return { language, confidence };
}

/**
 * Zero-dependency fallback: Detect language via Unicode character ranges
 * Handles the most common Indian languages without any API call
 */
function quickUnicodeDetect(text: string): LanguageDetectionResult {
  const scripts: Record<string, RegExp> = {
    ta: /[\u0B80-\u0BFF]/,  // Tamil
    hi: /[\u0900-\u097F]/,  // Devanagari (Hindi, Marathi, Sanskrit)
    te: /[\u0C00-\u0C7F]/,  // Telugu
    bn: /[\u0980-\u09FF]/,  // Bengali
    gu: /[\u0A80-\u0AFF]/,  // Gujarati
    kn: /[\u0C80-\u0CFF]/,  // Kannada
    ml: /[\u0D00-\u0D7F]/,  // Malayalam
    pa: /[\u0A00-\u0A7F]/,  // Gurmukhi (Punjabi)
    ur: /[\u0600-\u06FF]/,  // Urdu (Arabic script)
  };

  // Count script character matches
  const scriptCounts: Record<string, number> = {};
  for (const [lang, regex] of Object.entries(scripts)) {
    const matches = text.match(regex);
    if (matches) {
      scriptCounts[lang] = matches.length;
    }
  }

  // Find the script with the most matches
  let bestLang: DetectedLanguage = "en";
  let bestCount = 0;
  for (const [lang, count] of Object.entries(scriptCounts)) {
    if (count > bestCount) {
      bestCount = count;
      bestLang = lang as DetectedLanguage;
    }
  }

  // Only return non-English if we found enough script characters
  if (bestCount > 0) {
    return { language: bestLang, confidence: 0.7 };
  }

  return { language: "en", confidence: 0.5 };
}