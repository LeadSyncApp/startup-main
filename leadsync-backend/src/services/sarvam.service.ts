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
            // Mocking the call structure for Railway free tier safety
            // In production, use axios.post(this.apiUrl, { text }, { headers: ... })

            // Simulating a response for now to demonstrate structure
            return {
                intent: "ORDER",
                entities: {
                    product: "Unknown Product", // AI would extract this
                    quantity: 1
                },
                confidence: 0.85
            };

        } catch (error) {
            console.error("Sarvam AI Error:", error);
            return null; // Fail safe
        }
    }
}

export const sarvamService = new SarvamService();
