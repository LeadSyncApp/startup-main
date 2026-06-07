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

interface SarvamSTTResponse {
    transcript: string;
    language_code: string;
}

interface SarvamTTSResponse {
    audios: string[];
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
    async speechToText(audioBuffer: Buffer, filename: string = "voice.ogg"): Promise<{ transcript: string, languageCode: string } | null> {
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

            const response = await axios.post<SarvamSTTResponse>(
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

            const transcript = (response.data as any)?.transcript || "";
            const languageCode = (response.data as any)?.language_code || "en-IN";
            console.log(`✅ STT Result: "${transcript}" | Lang: ${languageCode}`);

            return { transcript: transcript.trim(), languageCode };

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
            const response = await axios.post<SarvamTTSResponse>(
                "https://api.sarvam.ai/text-to-speech",
                {
                    inputs: [text.slice(0, 500)], // Sarvam TTS char limit
                    target_language_code: languageCode,
                    speaker: "anushka",              // Valid Indian female voice
                    pitch: 0,
                    pace: 1.0,
                    loudness: 1.5,
                    speech_sample_rate: 22050,       // Better quality for Telegram
                    enable_preprocessing: true,
                    model: "bulbul:v2",              // Latest stable Sarvam TTS model
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
            const base64Audio = (response.data as any)?.audios?.[0];
            if (!base64Audio) return null;

            console.log(`🔊 TTS Generated for: "${text.slice(0, 40)}..."`);
            return Buffer.from(base64Audio, "base64");

        } catch (err: any) {
            console.error("❌ Sarvam TTS Error:", err?.response?.data || err.message);
            return null;
        }
    }

    /**
     * FALLBACK: Detects the language of a given text.
     * This is strictly a fallback mechanism used only if the user hasn't explicitly set their language via the bot menu.
     */
    async detectLanguage(text: string): Promise<string> {
        // 1. Script-based detection (Strongest signal)
        if (/[\u0B80-\u0BFF]/.test(text)) return "ta-IN"; // Tamil script
        if (/[\u0900-\u097F]/.test(text)) return "hi-IN"; // Hindi/Devanagari script

        // Default to English for safety
        return "en-IN";
    }
}

export const sarvamService = new SarvamService();
