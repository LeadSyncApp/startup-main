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
  systemPrompt: string,
  isJson: boolean = false
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
            max_tokens: 400,
            response_format: isJson ? { type: "json_object" } : undefined
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

/* ──────────────────────────────────────────────────────────────
   AGENT ASSIST: suggest a human-like reply given recent context
   ────────────────────────────────────────────────────────────── */
export async function generateAgentSuggestion(
  recentMessages: { sender: string; content: string }[],
  businessName: string,
  language: string = "English"
): Promise<string> {
  const history = recentMessages
    .slice(-10) // last 10 messages
    .map(m => ({
      role: m.sender === "CLIENT" ? "user" as const : "assistant" as const,
      content: m.content,
    }));

  const systemPrompt = `You are a helpful customer support agent for "${businessName}".
Your task: write ONE short, warm, professional reply to the customer's last message.
Language: ${language}.
Rules:
- Maximum 2 sentences. Be friendly and helpful.
- Do NOT use markdown, emojis, or bullet points.
- Do NOT repeat what the customer said.
- Reply in plain text only.
Return ONLY the reply text. No preamble, no labels.`;

  return generateWithFallback(history, systemPrompt, false);
}

/* ──────────────────────────────────────────────────────────────
   CONVERSATION SUMMARY: 2–3 sentence TL;DR of a conversation
   ────────────────────────────────────────────────────────────── */
export async function generateConversationSummary(
  messages: { sender: string; content: string }[],
  businessName: string
): Promise<string> {
  if (messages.length < 3) return "";
  const transcript = messages
    .slice(-30) // last 30 messages
    .map(m => `${m.sender === "CLIENT" ? "Customer" : "Agent"}: ${m.content}`)
    .join("\n");

  const systemPrompt = `You are a CRM assistant for "${businessName}". 
Summarize the following conversation in 2–3 short sentences for an agent who is reading it for the first time.
Focus on: what the customer wanted, what was resolved or pending, and any important details (product, amount, issue).
Be concise and factual. Plain text only. No markdown.`;

  return generateWithFallback(
    [{ role: "user" as const, content: transcript }],
    systemPrompt,
    false
  );
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
  modality?: "text" | "voice";
}): Promise<{
  replyText: string;
  stateUpdates: any;
  orderFinalized?: boolean;
  cartCleared?: boolean;
}> {
  try {
    const systemPrompt = `You are a shop assistant for a specific merchant (multi-tenant). HARD RULES:
1) Use ONLY the provided shop data: retrieved_items, learned_knowledge_text, menu_snapshot, shop_policies, and order_status.
2) Never invent items or details. If information is missing, ask or offer alternatives from the menu.
3) Use session_state to interpret follow-ups.
4) LANGUAGE MIRRORING (CRITICAL): You are a polyglot assistant. Strictly match the user's language and script.
   - If detected_language is 'ta-IN' OR the user speaks in Tamil (even Tanglish):
     - If the user uses Tamil script (e.g., "வணக்கம்"), reply in Tamil script.
     - If the user uses Tanglish (Tamil in English script, e.g., "Yennaku oru dosa"), reply in EITHER Tanglish or Tamil script.
     - YOUR ENTIRE "reply" MUST be in the user's language. NEVER reply in English to a Tamil/Tanglish query.
   - If detected_language is 'hi-IN' OR the user speaks in Hindi (even Hinglish):
     - If the user uses Devanagari script, reply in Hindi.
     - If the user uses Hinglish, reply in Hinglish or Hindi.
     - YOUR ENTIRE "reply" MUST be in Hindi/Hinglish.
   - If detected_language is 'en-IN', reply in English.
   - NEVER CLAIM YOU ONLY SPEAK ENGLISH.
5) MODALITY: If input.modality is 'voice', keep your "reply" concise and natural for speech. Use native script (Tamil/Hindi) for best TTS quality.
6) POLICY GROUNDING (DISTANCE/LOCATION): If shop_policies contains a 'delivery_area' or 'ask_for_location: true':
   - Acknowledge the rule in the same language as the user.
   - DO NOT confirm eligibility until user provides a location.
   - Reply like: "Our delivery area is within 5km of our store. If you share your area, I can check!"
6) CART MANAGEMENT:
   - If user wants to order/buy items, FIRST validate that ALL items exist in the provided menu_snapshot.
   - ONLY add items to cart if they are found in the menu. If an item is not in the menu, do not add it.
   - If user wants to order/buy items, update the 'cart' in state_updates using input.session_state.cart as base.
   - If user says "remove [item]" or "clear cart", update the cart state accordingly.
   - Calculate subtotal (item price * quantity) and grand total.
   - Confirm added items in your reply text and provide a current cart summary (Items - Qty - Subtotal) if the cart has items. Ensure the summary is in the user's language.
7) ITEM SPECIFICITY: If an item in the menu has specific attributes (like a "Large" vs "Regular" size, or "Red" vs "Blue") and the user didn't specify, set needs_clarification: true and ask the user to specify.
8) If the user says "Yeah confirm" or "confirm", and the cart is not empty, acknowledge the order confirmation, summarize their final cart, tell them an agent will process it, and set order_finalized: true.
9) If the user says "clear cart", set cart_cleared: true.
10) Output MUST be valid JSON ONLY. No markdown, no extra text.`;

    const userPrompt = `
Input Payload:
${JSON.stringify(input, null, 2)}

Return VALID JSON ONLY in this schema:
{
  "reply": "string (MUST BE IN ${input.detected_language === 'ta-IN' ? 'TAMIL' : input.detected_language === 'hi-IN' ? 'HINDI' : 'USER LANGUAGE'})",
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
    },
    "cart": {
      "items": [
        { 
          "name": "string", 
          "price": "number", 
          "quantity": "number", 
          "subtotal": "number",
          "color": "string|null",
          "size": "string|null"
        }
      ],
      "total": "number"
    }
  },
  "order_finalized": "boolean",
  "cart_cleared": "boolean",
  "needs_clarification": "boolean",
  "clarifying_question": "string|null (MUST BE IN USER LANGUAGE)"
}`;

    const messages = [{ role: "user" as const, content: userPrompt }];
    const rawOutput = await generateWithFallback(messages, systemPrompt, true);
    console.log(`📡 [AI] Raw Output: ${rawOutput.slice(0, 150)}...`);

    // SAFE PARSE GUARD
    const parsed = safeJsonParse(rawOutput, {
      reply: "I'm sorry, I'm having trouble processing that. How can I help you with our menu?",
      state_updates: input.session_state
    });

    return {
      replyText: sanitizeReply(parsed.reply || parsed.clarifying_question || "How can I help you?"),
      stateUpdates: parsed.state_updates || input.session_state,
      orderFinalized: !!parsed.order_finalized,
      cartCleared: !!parsed.cart_cleared
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
      let prompt = `You are a Commerce AI Normalizer. Take the following raw text from a merchant and extract a structured JSON menu.
      
Rules:
1. Group items into logical 'categories' (e.g., Beverages, Appetizers, Clothing).
2. Extract 'name' (string) and 'price' (number). Use INR as default currency.
3. If price is missing, set it to 0.
4. Normalize names: Title Case, remove extra symbols.
5. If current items are provided, merge them logically, preferring the new raw input data.
6. Return ONLY a valid JSON object.

Format:
{
  "categories": [
    {
      "name": "Category Name",
      "items": [
        { "name": "Item Name", "price": 100 }
      ]
    }
  ]
}

Raw Input: "${description}"`;

      if (existingMenu) {
        prompt += `\nExisting Menu to merge/update: ${JSON.stringify(existingMenu)}`;
      }

      const completion = await groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama-3.3-70b-versatile",
        temperature: 0.1,
        response_format: { type: "json_object" }
      });
      return JSON.parse(completion.choices[0]?.message?.content || "{}");
    } catch (e) {
      console.error("Groq Normalizer failed:", e);
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
    const prompt = `Extract order from: "${text}".
Menu: ${menuContext}.

CRITICAL RULE: Only extract items that EXACTLY match items in the provided menu. If an item is not found in the menu, DO NOT include it in the result.

Return JSON { "items": [{ "name": "N", "quantity": 1, "price": 10 }] }. ONLY JSON.`;
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
      response_format: { type: "json_object" }
    });
    const result = JSON.parse(completion.choices[0]?.message?.content || "{}");
    
    // Additional validation: Ensure all extracted items exist in the menu
    if (menu?.categories && result.items) {
      const menuItems = menu.categories.flatMap((c: any) => c.items);
      const validItems = result.items.filter((item: any) => {
        const foundInMenu = menuItems.some((menuItem: any) => 
          menuItem.name.toLowerCase().includes(item.name.toLowerCase()) ||
          item.name.toLowerCase().includes(menuItem.name.toLowerCase())
        );
        if (!foundInMenu) {
          console.log(`🚫 [AI] Item "${item.name}" not found in menu. Filtering out.`);
        }
        return foundInMenu;
      });
      result.items = validItems;
    }
    
    return result;
  } catch (e) {
    return { items: [] };
  }
}
