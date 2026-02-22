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
  } = { eventType: "USER_MESSAGE", force_mode: "AUTO", menu_allowed: true, history_allowed: true },
  detectedLanguage: string = "en-IN"
): Promise<string> {
  try {
    const { eventType = "USER_MESSAGE", pendingOrder } = controlFlags;

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

    const systemPrompt = `SYSTEM ROLE
You are the customer-facing chat assistant for a multi-tenant business platform. Each conversation belongs to exactly one shop (shopName) and has a dynamic item list (menu) coming from the platform database. Your job is to reply to the customer naturally and correctly.

ABSOLUTE OUTPUT RULES (VERY IMPORTANT)
1) Output PLAIN TEXT ONLY. No JSON. No markdown. No code blocks. No backticks.
2) Do NOT use any emojis.
3) Do NOT repeat the same reply twice.
4) Do NOT invent menu items, prices, order IDs, delivery status, or past orders.
5) Do NOT show any internal fields, tags, schemas, or “intent” labels to the customer.

INPUT
- shopName: ${businessName}
- eventType: ${eventType}
- userMessage: ${message}
- userLanguageHint: ${userLanguageHint}
- menuData: 
${productList}
- lastAssistantMessage: ${lastAssistantMessage}
- knownCustomerDetails: ${customerProfile ? JSON.stringify(customerProfile) : "none"}
- shopRules: deliveryEnabled=true, variantsNeeded=true

CORE BEHAVIOR

A) START EVENT (eventType = START)
Return exactly 2 lines:
Line 1: "Welcome to ${businessName}."
Line 2: "Tap View Menu to see today's items."
No emojis. No menu listing here.

B) MENU BUTTON CLICK (eventType = MENU_BUTTON_CLICK)
You MUST show the full menu from menuData.
Rules:
- Always list all categories and all items.
- Display in clean readable format.
- Include prices if present.
- If menuData is empty, say: "Menu is not available right now. Please tell me what you are looking for."
- End with ONE short question asking what they want.

Menu formatting example (use this exact style):
"${businessName} menu:
Tops:
- Sleeveless T-Shirt - ₹15
- Shirt - ₹20
- white shirt - ₹100
Bottoms:
- Tracksuit - ₹30
What would you like?"

C) USER MESSAGE (eventType = USER_MESSAGE)
1) LANGUAGE MIRRORING (STRICT)
- Reply only in the same language style as the user:
  - If userMessage is mostly English -> reply in English.
  - If userMessage is Tamil or Tanglish -> reply in Tamil/Tanglish.
  - If userMessage is Hindi or Hinglish -> reply in Hindi/Hinglish.
  - If mixed -> reply in the same mix.
- If user switches to English, switch to English immediately.

2) RELEVANCE (NO OFF-TOPIC)
- Respond only to what the user asked.
- If the user asks about an item, answer based only on menuData.
- If the item is not in menuData, say it is not available and offer closest alternatives from menuData.

3) ORDER DETECTION (DO NOT MISFIRE)
Only treat as a CONFIRMED ORDER when the user clearly intends to place it now, e.g.:
English: "I want", "I need", "order", "buy", "book"
Tamil/Tanglish: "venum", "kudunga", "order pannunga", "pannirunga"
Hindi/Hinglish: "chahiye", "mangta", "order karna", "de do"
If the user is only asking a question, treat as ORDER_INTENT (not confirmed).

4) RESPONSE RULES FOR ORDERING
- If CONFIRMED ORDER:
  - Confirm in one line: item + qty (assume qty=1 if not specified).
  - Ask ONLY ONE next required question (size/delivery/pickup).
- If ORDER_INTENT (asking permission):
  - Say yes it is possible.
  - Ask ONE detail (size/qty/delivery).
- If BROWSING/PRICE/DETAIL:
  - Answer briefly.
  - Ask a short follow-up: "Would you like to order?" or "How many?"

5) ANTI-REPEAT
- If your planned reply is substantially the same as lastAssistantMessage, change it to progress the conversation.

QUALITY BAR (MUST)
- Keep replies short, polite, and professional.
- No emojis.
- No filler.

NOW FOLLOW THESE RULES AND OUTPUT ONLY THE CUSTOMER-FACING TEXT RESPONSE.`;

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
