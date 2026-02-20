import axios from "axios";

interface SarvamResponse {
    intent: "ORDER" | "INQUIRY" | "COMPLAINT" | "OTHER";
    entities: {
        product?: string;
        quantity?: number;
        metrics?: string;
    };
    confidence: number;
}

export class SarvamService {
    private readonly apiKey: string;
    private readonly apiUrl = "https://api.sarvam.ai/v1/intent-extraction"; // Hypothetical Endpoint

    constructor() {
        this.apiKey = process.env.SARVAM_API_KEY || "";
    }

    /**
     * Converts a voice message audio buffer (OGG/MP3) to text using Sarvam STT.
     * Returns transcribed text or null on failure.
     * Sarvam API: https://api.sarvam.ai/speech-to-text
     * Model: saaras:v3 (supports 23 Indian languages + English, auto-detect)
     */
    async speechToText(audioBuffer: Buffer, filename: string = "voice.ogg"): Promise<string | null> {
        if (!this.apiKey) {
            console.warn("⚠️ Sarvam API Key missing, cannot transcribe voice.");
            return null;
        }

        try {
            const FormData = require("form-data");
            const form = new FormData();

            // 'file' is the required field name per Sarvam API docs
            form.append("file", audioBuffer, {
                filename,
                contentType: "audio/ogg", // Telegram voice files are OGG/Opus
            });
            form.append("model", "saaras:v3");       // Latest recommended model
            form.append("language_code", "unknown"); // Auto-detect language
            form.append("mode", "transcribe");       // Standard transcription mode

            console.log(`🎙️ STT: Sending ${audioBuffer.length} bytes to Sarvam...`);

            const response = await axios.post(
                "https://api.sarvam.ai/speech-to-text",
                form,
                {
                    headers: {
                        ...form.getHeaders(),
                        "api-subscription-key": this.apiKey,
                    },
                    timeout: 20000,
                }
            );

            const transcript = response.data?.transcript || "";
            console.log(`✅ STT Result: "${transcript}" | Lang: ${response.data?.language_code}`);
            return transcript.trim() || null;

        } catch (err: any) {
            // Log the full error body for debugging on Railway
            const errBody = err?.response?.data ?? err.message;
            console.error("❌ Sarvam STT Error:", JSON.stringify(errBody));
            return null;
        }
    }

    /**
     * Converts text to a voice audio buffer using Sarvam TTS.
     * Returns a Buffer of the audio or null on failure.
     */
    async textToSpeech(text: string, languageCode: string = "en-IN"): Promise<Buffer | null> {
        if (!this.apiKey) {
            console.warn("⚠️ Sarvam API Key missing, cannot generate voice reply.");
            return null;
        }

        try {
            const response = await axios.post(
                "https://api.sarvam.ai/text-to-speech",
                {
                    inputs: [text.slice(0, 500)], // Sarvam TTS limit
                    target_language_code: languageCode,
                    speaker: "meera",                // Natural Indian female voice
                    pitch: 0,
                    pace: 1.0,
                    loudness: 1.5,
                    speech_sample_rate: 8000,
                    enable_preprocessing: true,
                    model: "bulbul:v1",
                },
                {
                    headers: {
                        "api-subscription-key": this.apiKey,
                        "Content-Type": "application/json",
                    },
                    timeout: 15000,
                }
            );

            // Response is base64 encoded audio
            const base64Audio = response.data?.audios?.[0];
            if (!base64Audio) return null;

            console.log(`🔊 TTS Generated for: "${text.slice(0, 40)}..."`);
            return Buffer.from(base64Audio, "base64");

        } catch (err: any) {
            console.error("❌ Sarvam TTS Error:", err?.response?.data || err.message);
            return null;
        }
    }

    /**
     * Analyzes text for order intent using Sarvam.ai (or similar).
     * Free-tier friendly: Checks specific keywords first to avoid unnecessary API calls.
     */
    async analyzeIntent(text: string): Promise<SarvamResponse | null> {

        if (!text) return null;

        // 1. Local Keyword Pre-check (Optimized for Indian Languages & Hinglish)
        const orderKeywords = [
            // Standard
            "buy", "order", "price", "want", "book", "cash",
            // Hindi / North (Hinglish)
            "khareedna", "chahiye", "mangwana", "lene", "daam",
            // Tamil
            "vendum", "kodu", "venum", "vaanganum", "vilai",
            // Telugu
            "kavali", "konali", "ivvandi", "dhara",
            // Kannada
            "beku", "idiyalla", "kodona", "bele"
        ];
        const hasKeyword = orderKeywords.some(k => text.toLowerCase().includes(k));

        if (!hasKeyword && !text.match(/\d+/)) { // Also check if numbers are present (counts)
            return { intent: "OTHER", entities: {}, confidence: 1.0 };
        }

        // 2. Call AI API (Only if keyword or quantity present)
        if (!this.apiKey) {
            console.warn("Sarvam API Key missing, skipping AI.");
            return null;
        }

        try {
            const response = await axios.post(
                "https://api.sarvam.ai/v1/chat/completions",
                {
                    model: "sarvam-m",
                    messages: [
                        {
                            role: "system",
                            content: `You are a professional sales intelligence agent for a corporate CRM.
Analyze the Indian user message to extract order intent and entities.
Supported Languages: English, Hindi, Tamil, Telugu, Malayalam, Kannada, Hinglish.

Extraction Rules:
1. Detect Intent: ORDER (wants to buy), INQUIRY (asking price/detail), COMPLAINT, or OTHER.
2. Extract Product Name & Quantity.
3. Language Detection: Identify the dominant language.
4. Tone: The extracted data must support a formal business response.

Return ONLY valid JSON:
{
  "intent": "ORDER" | "INQUIRY" | "COMPLAINT" | "OTHER",
  "entities": {
    "product": "string",
    "quantity": number
  },
  "language": "string",
  "confidence": number
}`
                        },
                        { role: "user", content: text }
                    ]
                },
                {
                    headers: {
                        "api-subscription-key": this.apiKey,
                        "Content-Type": "application/json"
                    }
                }
            );

            const aiResult = response.data?.choices?.[0]?.message?.content;
            if (!aiResult) return null;

            // Parse JSON from response
            try {
                const parsed = JSON.parse(aiResult.replace(/```json|```/g, "").trim());
                return parsed as SarvamResponse;
            } catch (e) {
                console.error("Failed to parse Sarvam JSON:", aiResult);
                return null;
            }

        } catch (error: any) {
            console.error("Sarvam AI Error:", error?.response?.data || error.message);
            return null; // Fail safe
        }
    }
}

export const sarvamService = new SarvamService();
