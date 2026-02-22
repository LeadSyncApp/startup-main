import axios from "axios";
import Groq from "groq-sdk";

// Initialize Groq
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "dummy" });

// Model Hierarchy: Groq for Speed (Primary) - Sarvam only for STT/TTS/Lang Detection
const MODELS = [
  { provider: "groq", id: "llama-3.3-70b-versatile" }, // 🔥 State-of-the-art
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

export async function generateBotReply(
  message: string,
  businessName: string,
  businessType: string,
  structuredMenu?: any,
  history?: any[],
  orderHistory?: any[],
  customerProfile?: any,
  inputModality: "text" | "voice" = "text",
  controlFlags: {
    eventType?: "START" | "MENU_BUTTON_CLICK" | "USER_MESSAGE";
    force_mode?: "AUTO" | "CONFIRM_ORDER" | "BROWSE_MENU" | "SUPPORT_ONLY";
    menu_allowed?: boolean;
    history_allowed?: boolean;
    pendingOrder?: { summary: string; amount: number };
    command?: string;
    trigger_source?: "typed_command" | "button_click" | "normal_message";
    callback_payload?: string;
    latest_order?: { status: string; summary: string } | null;
    resolvedScope?: "ALL" | "CATEGORY" | "NONE";
    resolvedCategoryName?: string;
  } = { eventType: "USER_MESSAGE", force_mode: "AUTO", menu_allowed: true, history_allowed: true, resolvedScope: "NONE", resolvedCategoryName: "" },
  detectedLanguage: string = "en-IN"
): Promise<string> {
  try {
    const { eventType = "USER_MESSAGE", resolvedScope = "NONE", resolvedCategoryName = "" } = controlFlags;

    // 🏷️ Format Product List for the AI
    let productList = "NO PRODUCTS LISTED";
    if (structuredMenu?.categories?.length > 0) {
      productList = structuredMenu.categories
        .map((cat: any) =>
          `Category: "${cat.name}"\n` +
          cat.items.map((i: any) => `  - { name: "${i.name}", price: ${i.price} }`).join("\n")
        )
        .join("\n");
    }

    const lastAssistantMessage = (history || []).filter(h => h.role === "assistant").pop()?.content || "";

    const userLanguageHint = detectedLanguage.split("-")[0]; // en, ta, hi

    const systemPrompt = `You are a professional, industry-agnostic shop assistant for ${businessName}. Use ONLY the menuData provided. Do not invent items.

STRICT OUTPUT:
- Plain text only.
- No emojis.
- No JSON / markdown / code.
- Do not repeat the user message.
- Never say generic error lines like "I am having trouble". If unsure, ask one clarification.

LANGUAGE MIRROR:
Reply in the same language style as the user message (English / Tamil-Tanglish / Hindi-Hinglish / mixed). Switch immediately if the user switches.

SYSTEM CONTEXT:
resolvedScope = ${resolvedScope}  (one of: ALL, CATEGORY, NONE)
resolvedCategoryName = ${resolvedCategoryName} (string or empty)
menuData (source of truth):
${productList}

RESPONSE RULES:
1) If resolvedScope = ALL:
- Summarize by listing each category and 2–3 items per category with prices.
- Ask ONE question: "Which category would you like?" (in the user’s language).

2) If resolvedScope = CATEGORY:
- Recommend 1–3 items ONLY from that category:
  - include price
  - give a brief reason (value/comfort/formal/popular) without exaggeration
- Ask EXACTLY ONE follow-up question (purpose OR budget). Not both.

3) If resolvedScope = NONE:
- Ask ONE clarification question to identify the category or say "type show all".

Now respond to the user:
${message}`;

    const conversation = (history || [])
      .slice(-6)
      .map(m => ({
        role: m.role || "user",
        content: m.content
      }));

    let aiOutput = await generateWithFallback(conversation, systemPrompt);

    // Sanitization
    aiOutput = aiOutput.replace(/```[a-z]*\n?|```/gi, "").trim();
    aiOutput = aiOutput.replace(/\*\*|\*/g, "");

    // Final check for emojis (safety layer)
    aiOutput = aiOutput.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "");

    return aiOutput;

  } catch (error) {
    console.error("❌ Bot Reply Fatal Error:", error);
    return "I am sorry, I am having trouble right now. Our team will help you soon.";
  }
}

export async function generateStructuredMenu(
  description: string,
  existingMenu?: any
): Promise<any> {
  if (process.env.GROQ_API_KEY) {
    try {
      let prompt = `Generate a JSON menu for: ${description}.
    Format: { "categories": [{ "name": "C", "items": [{ "name": "I", "price": 10 }] }] }
ONLY JSON. No markdown.`;
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
    const prompt = `Extract order from: "${text}". Menu: ${menuContext}. Return JSON { "items": [{ "name": "N", "quantity": 1, "price": 10 }] }. ONLY JSON.`;
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
