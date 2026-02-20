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

        // 1. Local Keyword Pre-check (Save API calls)
        const orderKeywords = ["buy", "order", "price", "want", "khareedna", "chahiye", "book"];
        const hasKeyword = orderKeywords.some(k => text.toLowerCase().includes(k));

        if (!hasKeyword) {
            return { intent: "OTHER", entities: {}, confidence: 1.0 };
        }

        // 2. Call AI API (Only if keyword matches)
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
                            content: `You are an intent extraction agent for an Indian e-commerce CRM. 
Analyze the user message and extract order details in JSON format.
Identify if the user wants to buy something.
Languages: English, Hindi, and Hinglish.

Return ONLY a JSON object:
{
  "intent": "ORDER" | "INQUIRY" | "COMPLAINT" | "OTHER",
  "entities": {
    "product": "name of product",
    "quantity": number
  },
  "confidence": number (0 to 1)
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
