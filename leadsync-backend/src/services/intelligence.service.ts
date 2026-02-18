import { prisma } from "../lib/prisma";
import { ConversationIntent, LeadSegment } from "@prisma/client";
import Groq from "groq-sdk";

// Initialize Groq
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "dummy" });

export class IntelligenceService {

    /**
     * Analyzes a new message to update Conversation context.
     * Runs in the background (fire-and-forget).
     */
    async analyzeMessage(
        companyId: string,
        leadId: string,
        conversationId: string,
        messageText: string
    ) {
        try {
            // Only analyze meaningful messages > 10 chars to save AI calls
            if (messageText.length < 5) return;

            // 1. AI Analysis (Sentiment & Intent) - Using Llama 8b (Fast)
            const analysis = await this.performAIAnalysis(messageText);

            // 2. Update Conversation & Lead
            await prisma.$transaction([
                // Update Conversation with new insights
                prisma.conversation.update({
                    where: { id: conversationId },
                    data: {
                        sentimentScore: { increment: analysis.sentimentDelta },
                        intent: analysis.intent as ConversationIntent,
                        updatedAt: new Date()
                    }
                }),
                // Update Lead Activity
                prisma.lead.update({
                    where: { id: leadId },
                    data: {
                        lastActiveAt: new Date(),
                    }
                })
            ]);

            console.log(`🧠 [Intelligence] Analyzed msg: ${analysis.intent} | Sentiment: ${analysis.sentimentDelta}`);

        } catch (error) {
            console.error("❌ Intelligence Analysis Failed:", error);
        }
    }

    private async performAIAnalysis(text: string): Promise<{ sentimentDelta: number, intent: string }> {
        try {
            if (!process.env.GROQ_API_KEY) return { sentimentDelta: 0, intent: "BROWSING" };

            const response = await groq.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: `Analyze the user message JSON.
Format: {"sentiment": number, "intent": string}
Context: CRM for a business.
- sentiment: -5 (Angry) to +5 (Happy). 0 is neutral.
- intent: "BROWSING", "ORDERING", "SUPPORT", "COMPLAINT"
`
                    },
                    { role: "user", content: text }
                ],
                model: "llama-3.1-8b-instant",
                temperature: 0,
                max_tokens: 50,
                response_format: { type: "json_object" }
            });

            const content = response.choices[0]?.message?.content || "{}";
            const result = JSON.parse(content);

            // Validate intent against enum values
            let safeIntent = result.intent?.toUpperCase();
            if (!["BROWSING", "ORDERING", "SUPPORT", "COMPLAINT"].includes(safeIntent)) {
                safeIntent = "BROWSING";
            }

            return {
                sentimentDelta: result.sentiment || 0,
                intent: safeIntent
            };

        } catch (e) {
            return { sentimentDelta: 0, intent: "BROWSING" };
        }
    }
}

export const intelligenceService = new IntelligenceService();
