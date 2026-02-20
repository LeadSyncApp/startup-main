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
