/**
 * Translation Service
 * Provides Sarvam AI translation for Indian languages
 */

export type TargetLanguage = "en" | "hi" | "ta" | "te" | "bn" | "gu" | "kn" | "ml" | "mr" | "pa" | "ur";

export async function callSarvamTranslate(
  text: string,
  targetLang: TargetLanguage,
  apiKey: string
): Promise<string> {
  if (!apiKey) {
    return text;
  }

  const response = await fetch("https://api.sarvam.ai/translate", {
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

export async function translateIfNeeded(
  text: string,
  targetLang: TargetLanguage,
  apiKey: string
): Promise<string> {
  if (targetLang === "en" || !apiKey) {
    return text;
  }

  try {
    return await callSarvamTranslate(text, targetLang, apiKey);
  } catch (error: any) {
    console.error("[TranslationService] Translation failed, returning original text:", error.message);
    return text;
  }
}
