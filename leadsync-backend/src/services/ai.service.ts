import axios from "axios";
import Groq from "groq-sdk";
import { safeJsonParse, sanitizeReply, getMenuSnapshot, calculateRetrieval } from "../utils/shop-ai.utils";

// Initialize Groq
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "dummy" });

// Model Hierarchy: Groq for Speed (Primary) - Sarvam only for STT/TTS/Lang Detection
const MODELS = [
  { provider: "groq", id: "llama-3.3-70b-versatile" },
  { provider: "groq", id: "llama-3.1-8b-instant" }, // 🔥 Faster Fallback
];

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutId: any;
  const timeout = new Promise<T>((_, reject) =>
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
  );
  try {
    const result = await Promise.race([promise, timeout]);
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function generateWithFallback(
  messages: any[],
  systemPrompt: string
): Promise<string> {
  let lastError;
  const useGroq = !!process.env.GROQ_API_KEY;

  for (const model of MODELS) {
    if (model.provider === "groq" && !useGroq) continue;

    try {
      console.log(`🤖 [AI] Attempting ${model.provider.toUpperCase()}: ${model.id}...`);

      let content = "";
      const timeoutMs = 8000; // 8s timeout per model

      if (model.provider === "groq") {
        const completion: any = await withTimeout(
          groq.chat.completions.create({
            messages: [
              { role: "system", content: systemPrompt },
              ...messages.filter(m => m.content && m.content.trim())
            ],
            model: model.id,
            max_tokens: 400
          }),
          timeoutMs,
          `Groq ${model.id}`
        );
        content = completion.choices[0]?.message?.content || "";
      }

      if (content.trim()) {
        console.log(`✅ [AI] Success with ${model.id}`);
        return content.trim();
      }
    } catch (err: any) {
      console.error(`⚠️ [AI] ${model.id} failed: ${err.message}`);
      lastError = err;
    }
  }
  throw lastError || new Error("All AI models failed");
}

export async function generateLearnedContext(
  knowledgeBase: string
): Promise<string> {
  if (!process.env.GROQ_API_KEY) return knowledgeBase;
  try {
    const prompt = `You are a knowledge extraction AI.
The user provided these notes/descriptions about their shop items:
"${knowledgeBase}"

Your task:
1. Extract key characteristics, selling points, or specific details for the items mentioned.
2. Structure it as a concise, bulleted guide that a shop assistant can use to answer customer questions.
3. Keep it plain text. No markdown formatting.
4. If there are suggestions (e.g., "suggest X for Y"), include them.

OUTPUT ONLY THE SUMMARY. NO PREAMBLE.`;

    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
    });
    return completion.choices[0]?.message?.content || "";
  } catch (e) {
    console.error("Knowledge extraction failed:", e);
    return knowledgeBase;
  }
}


export async function generateShopReply(input: {
  tenant_id: string;
  user_message: string;
  detected_language: string;
  session_state: any;
  retrieved_items: any[];
  learned_knowledge_text: string;
  learned_knowledge_structured?: any;
  menu_snapshot: any;
  shop_policies?: string;
  order_history?: any[];
  latest_order_status?: string | null;
}): Promise<{ replyText: string; stateUpdates: any }> {
  try {
    const systemPrompt = `You are a shop assistant for a specific merchant (multi-tenant). HARD RULES:
1) Use ONLY the provided shop data: retrieved_items, learned_knowledge_text, menu_snapshot, shop_policies, and order_status.
2) Never invent items or details. If information is missing, ask or offer alternatives from the menu.
3) Use session_state to interpret follow-ups.
4) LANGUAGE MIRRORING: Strictly match the user's detected_language. If they speak English, reply ONLY in English. If they speak Tamil, reply in Tamil. If they speak Mixed/Hinglish/Tanglish, mirror that mix. Never switch to Tamil if the user is speaking English.
5) If the user says "Yeah confirm" or "confirm", acknowledge the order confirmation simply (e.g., "Got it! Your order is being processed.") instead of giving product recommendations.
6) Output MUST be valid JSON ONLY. No markdown, no extra text.`;

    const userPrompt = `
Input Payload:
${JSON.stringify(input, null, 2)}

Return VALID JSON ONLY in this schema:
{
  "reply": "string",
  "intent": "PRICE_QUERY|AVAILABILITY_QUERY|RECOMMENDATION|COMPARE|VIEW_MENU|ORDER_INTENT|POLICY_QUERY|OTHER",
  "detected_language": "ta|en|mixed|other",
  "slots": {
    "item_name": "string|null",
    "category": "string|null",
    "quantity": "number|null",
    "unit": "kg|piece|pack|ml|service|hour|null",
    "color": "string|null",
    "size": "string|null",
    "budget_max": "number|null",
    "purpose": "string|null"
  },
  "state_updates": {
    "last_category": "string|null",
    "last_item_names": ["string"],
    "preferences": {
      "color": "string|null",
      "size": "string|null",
      "budget_max": "number|null",
      "purpose": "string|null"
    }
  },
  "needs_clarification": "boolean",
  "clarifying_question": "string|null"
}`;

    const messages = [{ role: "user" as const, content: userPrompt }];
    const rawOutput = await generateWithFallback(messages, systemPrompt);

    // SAFE PARSE GUARD
    const parsed = safeJsonParse(rawOutput, {
      reply: "I'm sorry, I'm having trouble processing that. How can I help you with our menu?",
      state_updates: input.session_state
    });

    return {
      replyText: sanitizeReply(parsed.reply || parsed.clarifying_question || "How can I help you?"),
      stateUpdates: parsed.state_updates || input.session_state
    };
  } catch (error) {
    console.error("❌ generateShopReply error:", error);
    return {
      replyText: "I'm sorry, I encountered an error. Please try again or ask for an agent.",
      stateUpdates: input.session_state
    };
  }
}

/**
 * @deprecated Use generateShopReply for Phase 1
 */
export async function generateBotReply(
  message: string,
  businessName: string,
  businessType: string,
  structuredMenu?: any,
  history?: any[],
  orderHistory?: any[],
  customerProfile?: any,
  inputModality: "text" | "voice" = "text",
  controlFlags: any = {},
  detectedLanguage: string = "en-IN"
): Promise<string> {
  // Simple wrapper for compatibility during migration
  // Simple wrapper for compatibility during migration

  // We don't have tenant_id/chat_id here easily without changing signature drastically
  // but for Phase 1, the handleBotMessage will call generateShopReply directly.
  // This is kept for any other parts of code that might still call it.

  const menuSnapshot = getMenuSnapshot(structuredMenu);
  const retrieved = calculateRetrieval(message, menuSnapshot);

  const result = await generateShopReply({
    tenant_id: "default",
    user_message: message,
    detected_language: detectedLanguage,
    session_state: { last_category: null, last_item_names: [], preferences: {} },
    retrieved_items: retrieved,
    learned_knowledge_text: controlFlags.botLearnedContext || "",
    menu_snapshot: menuSnapshot,
  });

  return result.replyText;
}

export async function generateStructuredMenu(
  description: string,
  existingMenu?: any
): Promise<any> {
  if (process.env.GROQ_API_KEY) {
    try {
      let prompt = `Generate a JSON menu for: ${description}.
    Format: { "categories": [{ "name": "C", "items": [{ "name": "I", "price": 10 }] }] }
ONLY JSON.No markdown.`;
      if (existingMenu) prompt += `\nUpdate: ${JSON.stringify(existingMenu)} `;

      const completion = await groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama-3.3-70b-versatile",
        temperature: 0.2,
        response_format: { type: "json_object" }
      });
      return JSON.parse(completion.choices[0]?.message?.content || "{}");
    } catch (e) {
      console.error("Groq JSON generation failed");
    }
  }
  return existingMenu || { categories: [] };
}

export async function generateStructuredOrder(
  text: string,
  menu: any
): Promise<{ items: { name: string; quantity: number; price?: number }[] }> {
  if (!process.env.GROQ_API_KEY) return { items: [] };
  try {
    const menuContext = JSON.stringify(menu?.categories || []);
    const prompt = `Extract order from: "${text}".Menu: ${menuContext}. Return JSON { "items": [{ "name": "N", "quantity": 1, "price": 10 }] }. ONLY JSON.`;
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
      response_format: { type: "json_object" }
    });
    return JSON.parse(completion.choices[0]?.message?.content || "{}");
  } catch (e) {
    return { items: [] };
  }
}
