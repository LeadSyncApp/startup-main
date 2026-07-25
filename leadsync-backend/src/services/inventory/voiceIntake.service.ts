import FormData from "form-data";
import fetch from "node-fetch";
import Groq from "groq-sdk";

export interface ExtractedProductFields {
  product_name: string | null;
  price: number | null;
  stock: number | null;
  fabric_type: string | null;
  category: string | null;
  description: string | null;
}

export interface VoiceIntakeResult {
  transcript: string;
  extracted: ExtractedProductFields;
}

const LANGUAGE_CODE_MAP: Record<string, string> = {
  English: "en-IN",
  Hindi: "hi-IN",
  Tamil: "ta-IN",
  Telugu: "te-IN",
  Kannada: "kn-IN",
  Malayalam: "ml-IN",
  Bengali: "bn-IN",
  Marathi: "mr-IN",
  Gujarati: "gu-IN",
};

/**
 * Server-side anti-hallucination check: Filter noise/silence STT artifacts
 */
function isHallucinatedTranscript(transcript: string): boolean {
  const clean = transcript.trim();
  if (!clean) return true;

  // Single or repeated punctuation/symbols
  if (/^[.\s\-?,!:]+$/.test(clean)) return true;

  // Common STT silence/noise hallucination phrases (English & regional languages)
  const lower = clean.toLowerCase();
  const hallucinations = [
    "thank you for watching",
    "subtitles by",
    "amara.org",
    "subscribe to my channel",
    "thanks for watching",
    "bye bye",
    "like and subscribe",
    "naanu enna confirm",
    "enna confirm",
    "naanu enna",
  ];
  if (hallucinations.some((h) => lower.includes(h))) return true;

  // Single word noise hallucinations when standing alone (e.g. "hello", "hi", "hey", "hello hello")
  const standaloneHallucinations = [
    "hello",
    "hi",
    "hey",
    "hello?",
    "hello hello",
    "hi hi",
    "test",
    "testing",
    "thank you",
    "thanks",
  ];
  if (standaloneHallucinations.includes(lower.replace(/[.!?]/g, ""))) return true;

  // Single word under 2 chars containing only punctuation/symbols
  if (clean.length < 2 && !/[a-zA-Z0-9\u0900-\u0D7F]/.test(clean)) return true;

  return false;
}

/**
 * Transcribe audio buffer using Sarvam saaras:v3 speech-to-text API
 */
export async function transcribeAudioWithSarvam(
  audioBuffer: Buffer,
  filename: string = "audio.webm",
  mimeType: string = "audio/webm",
  language: string = "English"
): Promise<string> {
  console.log(`[BACKEND_VOICE_DEBUG] Received audio buffer size: ${audioBuffer?.length || 0} bytes, filename: "${filename}", language: "${language}"`);

  // Buffer size sanity check
  if (!audioBuffer || audioBuffer.length < 500) {
    console.warn("[BACKEND_VOICE_DEBUG] REJECT: Buffer size < 500 bytes.");
    throw new Error("No speech detected, please try again.");
  }

  const sarvamApiKey = process.env.SARVAM_API_KEY;
  if (!sarvamApiKey) {
    throw new Error("SARVAM_API_KEY environment variable is not configured");
  }

  const formData = new FormData();
  formData.append("file", audioBuffer, {
    filename,
    contentType: mimeType,
  });
  formData.append("model", "saaras:v3");

  const langCode = LANGUAGE_CODE_MAP[language] || "en-IN";
  formData.append("language_code", langCode);
  console.log(`[BACKEND_VOICE_DEBUG] Sending request to Sarvam STT (model: saaras:v3, language_code: ${langCode})...`);

  const response = await fetch("https://api.sarvam.ai/speech-to-text", {
    method: "POST",
    headers: {
      "api-subscription-key": sarvamApiKey,
      ...formData.getHeaders(),
    },
    body: formData as any,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error(`[BACKEND_VOICE_DEBUG] Sarvam STT error (${response.status}):`, errorText);
    throw new Error(`Sarvam STT API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as { transcript?: string };
  const rawTranscript = data.transcript ? data.transcript.trim() : "";
  console.log(`[BACKEND_VOICE_DEBUG] Sarvam raw transcript output: "${rawTranscript}"`);

  if (isHallucinatedTranscript(rawTranscript)) {
    console.warn(`[BACKEND_VOICE_DEBUG] REJECT HALLUCINATION: "${rawTranscript}" matched hallucination filter.`);
    throw new Error("No speech detected, please try again.");
  }

  return rawTranscript;
}

/**
 * Extract structured product fields from spoken raw transcript using Groq llama-3.1-8b-instant
 */
export async function extractProductFieldsWithGroq(
  transcript: string
): Promise<ExtractedProductFields> {
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    throw new Error("GROQ_API_KEY environment variable is not configured");
  }

  const groq = new Groq({ apiKey: groqApiKey });

  const systemPrompt = `You are a precise inventory data extraction assistant.
Analyze the spoken transcript describing a product or service, and extract structured product fields according to the following JSON schema:

{
  "product_name": string or null,
  "price": number or null,
  "stock": number or null,
  "fabric_type": string or null,
  "category": string or null,
  "description": string or null
}

Strict Rules:
- product_name: The name or title of the item (e.g. "Cotton Shirt", "Haircut 30min", "Margherita Pizza").
- price: Numerical base price in INR (e.g., 599, 1200, 450). Null if not mentioned.
- stock: Quantity/stock count as an integer number (e.g., 25, 100). Null if not mentioned.
- fabric_type: Fabric or material description if mentioned (e.g. "Cotton", "Silk", "Linen", "Denim", "Polyester", "Wool"). Null if not mentioned.
- category: High-level classification (e.g. "Apparel", "Footwear", "Services", "Food", "Electronics"). Null if not mentioned.
- description: Brief extra details or notes mentioned (e.g. "Navy blue color, full sleeve"). Null if none.

CRITICAL REQUIREMENT:
- If a field is not explicitly mentioned or clearly stated in the transcript, you MUST set its value to null.
- Do NOT guess, fabricate, hallucinate, or invent default prices or stock values under any circumstances.

Output JSON only.`;

  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Spoken Transcript: "${transcript}"` },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Groq returned empty extraction response");
  }

  try {
    const parsed = JSON.parse(content);
    return {
      product_name: typeof parsed.product_name === "string" ? parsed.product_name : null,
      price: typeof parsed.price === "number" ? parsed.price : null,
      stock: typeof parsed.stock === "number" ? parsed.stock : null,
      fabric_type: typeof parsed.fabric_type === "string" ? parsed.fabric_type : null,
      category: typeof parsed.category === "string" ? parsed.category : null,
      description: typeof parsed.description === "string" ? parsed.description : null,
    };
  } catch (err: any) {
    console.error("[VoiceIntakeService] JSON parse error:", err, content);
    throw new Error(`Failed to parse Groq extraction output: ${err.message}`);
  }
}

/**
 * Full voice intake processing pipeline: Audio -> Sarvam saaras:v3 STT -> Groq llama-3.1-8b-instant LLM -> Extracted JSON
 */
export async function processVoiceIntake(
  audioBuffer: Buffer,
  filename: string = "audio.webm",
  mimeType: string = "audio/webm",
  language: string = "English"
): Promise<VoiceIntakeResult> {
  // Step 1: Speech to text using Sarvam saaras:v3 with language_code parameter
  const transcript = await transcribeAudioWithSarvam(audioBuffer, filename, mimeType, language);

  // Step 2: Field extraction using Groq llama-3.1-8b-instant
  const extracted = await extractProductFieldsWithGroq(transcript);

  return {
    transcript,
    extracted,
  };
}
