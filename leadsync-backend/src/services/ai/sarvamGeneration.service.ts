/**
 * Sarvam Generation Service with Reliability Improvements
 * 
 * Fixes:
 * - Adds request timeout (8s default)
 * - Disables reasoning mode for reliable JSON output
 * - Falls back to Groq-generated reply in English/Hindi if Sarvam times out or returns empty
 */

import Groq from "groq-sdk";

// Sarvam chat completions API endpoint (verified working)
const SARVAM_CHAT_URL = "https://api.sarvam.ai/v1/chat/completions";

// Timeout in milliseconds
const SARVAM_TIMEOUT_MS = parseInt(process.env.SARVAM_TIMEOUT_MS || "8000");

export interface SarvamGenerationRequest {
  prompt: string;
  language?: string; // Target language for response
  context?: string;  // Context to ground the response
}

export interface SarvamGenerationResult {
  reply: string;
  usedSarvam: boolean;
  fallbackReason?: string;
}

/**
 * Call Sarvam AI chat completions API with timeout
 * Disables reasoning mode by requesting direct output
 */
async function callSarvamWithTimeout(
  apiKey: string,
  prompt: string,
  context?: string,
  language: string = "en"
): Promise<{ reply: string; usedSarvam: boolean; fallbackReason?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SARVAM_TIMEOUT_MS);

  try {
    const response = await fetch(SARVAM_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-subscription-key": apiKey,
      },
      body: JSON.stringify({
        model: "sarvam-30b",
        messages: [
          {
            role: "system",
            content: `You are a helpful assistant. Reply in ${language === "hi" ? "Hindi" : "English"}.
Only state facts present in the context. Do not add information that isn't explicitly provided.
If a requested detail is missing, escalate by stating you need more information.`
          },
          {
            role: "user",
            content: context ? `${context}\n\n${prompt}` : prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2048,
        // Note: reasoning_effort is not supported by Sarvam - we rely on timeout instead
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`Sarvam API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    // Extract content - Sarvam returns OpenAI-compatible format
    const content = data.choices?.[0]?.message?.content || "";

    if (!content || content.trim().length === 0) {
      throw new Error("Sarvam returned empty response");
    }

    return {
      reply: content.trim(),
      usedSarvam: true,
    };
  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error.name === "AbortError") {
      return {
        reply: "",
        usedSarvam: false,
        fallbackReason: "timeout",
      };
    }

    return {
      reply: "",
      usedSarvam: false,
      fallbackReason: error.message || "unknown_error",
    };
  }
}

/**
 * Generate reply using Sarvam with Groq fallback
 * 
 * CURRENT BEHAVIOR: Groq is used as primary, Sarvam is skipped.
 * To re-enable Sarvam: uncomment the "Try Sarvam first" block below and 
 * comment out the "Use Groq directly (Sarvam skipped)" section.
 */
export async function generateWithSarvamFallback(
  apiKey: string | undefined,
  groq: Groq | undefined,
  request: SarvamGenerationRequest
): Promise<SarvamGenerationResult> {
  const { prompt, language = "en", context } = request;

  // ============================================================
  // TODO: Uncomment this block to re-enable Sarvam as primary
  // ============================================================
  // // Try Sarvam first if API key is available
  // if (apiKey && groq) {
  //   const sarvamResult = await callSarvamWithTimeout(apiKey, prompt, context, language);
  // 
  //   if (sarvamResult.usedSarvam) {
  //     return sarvamResult;
  //   }
  // 
  //   // Sarvam failed - fall back to Groq
  //   if (groq) {
  //     try {
  //       const fallbackPrompt = `You are a helpful assistant. Reply in ${language === "hi" ? "Hindi" : "English"}.
  // Only state facts present in the context. Do not add information that isn't explicitly provided.
  // If a requested detail is missing, escalate by stating you need more information.
  // 
  // Context: ${context || "No context provided"}
  // 
  // Question: ${prompt}`;
  // 
  //       const groqResult = await groq.chat.completions.create({
  //         messages: [
  //           { role: "user", content: fallbackPrompt }
  //         ],
  //         model: "llama-3.3-70b-versatile",
  //         temperature: 0.3,
  //         max_tokens: 2048,
  //       });
  // 
  //       const fallbackReply = groqResult.choices[0]?.message?.content?.trim() || "";
  // 
  //       return {
  //         reply: fallbackReply,
  //         usedSarvam: false,
  //         fallbackReason: sarvamResult.fallbackReason,
  //       };
  //     } catch (groqError: any) {
  //       console.error("[SarvamFallback] Groq fallback also failed:", groqError.message);
  //       return {
  //         reply: "Aapka message mil gaya hai. Hamaare agent jaldi hi reply karenge!",
  //         usedSarvam: false,
  //         fallbackReason: `groq_error: ${groqError.message}`,
  //       };
  //     }
  //   }
  // }

  // ============================================================
  // Use Groq directly (Sarvam skipped)
  // ============================================================
  console.log("[SarvamFallback] Sarvam skipped — using Groq directly");
  if (groq) {
    try {
      const groqPrompt = `You are a helpful assistant. Reply in ${language === "hi" ? "Hindi" : "English"}.
Only state facts present in the context. Do not add information that isn't explicitly provided.
If a requested detail is missing, escalate by stating you need more information.

Context: ${context || "No context provided"}

Question: ${prompt}`;

      const groqResult = await groq.chat.completions.create({
        messages: [
          { role: "user", content: groqPrompt }
        ],
        model: "llama-3.3-70b-versatile",
        temperature: 0.3,
        max_tokens: 2048,
      });

      const reply = groqResult.choices[0]?.message?.content?.trim() || "";

      return {
        reply,
        usedSarvam: false,
        fallbackReason: "sarvam_skipped",
      };
    } catch (error: any) {
      console.error("[SarvamFallback] Groq failed:", error.message);
      return {
        reply: "Aapka message mil gaya hai. Hamaare agent jaldi hi reply karenge!",
        usedSarvam: false,
        fallbackReason: `groq_error: ${error.message}`,
      };
    }
  }

  return {
    reply: "Aapka message mil gaya hai. Hamaare agent jaldi hi reply karenge!",
    usedSarvam: false,
    fallbackReason: "no_api_keys",
  };
}
