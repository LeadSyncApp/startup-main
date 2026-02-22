import axios from "axios";
import Groq from "groq-sdk";

// Initialize Groq
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "dummy" });

// Model Hierarchy: Sarvam for Multilingual, Groq for Speed
const MODELS = [
  { provider: "sarvam", id: "sarvam-m" },              // 🇮🇳 Best for Indian Languages
  { provider: "groq", id: "llama-3.3-70b-versatile" }, // 🔥 State-of-the-art fallback
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
  const useSarvam = !!process.env.SARVAM_API_KEY;

  for (const model of MODELS) {
    if (model.provider === "groq" && !useGroq) continue;
    if (model.provider === "sarvam" && !useSarvam) continue;

    try {
      console.log(`🤖 [AI] Attempting ${model.provider.toUpperCase()}: ${model.id}...`);

      let content = "";
      const timeoutMs = 8000; // 8s timeout per model

      if (model.provider === "sarvam") {
        // Sarvam.ai is extremely strict: No "system" role, and roles MUST alternate (User -> Assistant -> User).
        const rawHistory = messages.filter(m => m.content && typeof m.content === 'string' && m.content.trim());

        const chatMessages: { role: "user" | "assistant"; content: string }[] = [];

        // Instruction
        const instructionPrefix = `[INSTRUCTION: ${systemPrompt}]\n\n`;

        for (let i = 0; i < rawHistory.length; i++) {
          const m = rawHistory[i];
          const role = (m.role === "assistant" || m.role === "bot") ? "assistant" : "user";
          const isLastUserMsg = i === rawHistory.length - 1 && role === "user";

          // Safety: Only add if it alternates
          if (chatMessages.length > 0 && chatMessages[chatMessages.length - 1].role === role) {
            chatMessages[chatMessages.length - 1].content += "\n" + m.content.trim();
          } else {
            chatMessages.push({
              role,
              content: isLastUserMsg ? instructionPrefix + m.content.trim() : m.content.trim()
            });
          }
        }

        // If history was empty OR last message was assistant, ensure we end with an instruction
        if (chatMessages.length === 0 || chatMessages[chatMessages.length - 1].role === "assistant") {
          chatMessages.push({ role: "user", content: instructionPrefix + "Please respond to the latest request." });
        }

        try {
          const response: any = await withTimeout(
            axios.post(
              "https://api.sarvam.ai/v1/chat/completions",
              {
                model: model.id,
                messages: chatMessages,
                temperature: 0.1
              },
              {
                headers: {
                  "api-subscription-key": process.env.SARVAM_API_KEY,
                  "Content-Type": "application/json"
                }
              }
            ),
            timeoutMs,
            `Sarvam ${model.id}`
          );
          content = response.data?.choices?.[0]?.message?.content || "";
        } catch (axiosError: any) {
          const detail = axiosError.response?.data?.error?.message || axiosError.response?.data || axiosError.message;
          console.error(`❌ Sarvam API Error Detail:`, detail);
          throw axiosError;
        }
      }
      else if (model.provider === "groq") {
        const completion: any = await withTimeout(
          groq.chat.completions.create({
            messages: [
              { role: "system", content: systemPrompt },
              ...messages.filter(m => m.content && m.content.trim())
            ],
            model: model.id,
            max_tokens: 400  // Increased for large content
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
    force_mode?: "AUTO" | "CONFIRM_ORDER" | "BROWSE_MENU" | "SUPPORT_ONLY";
    menu_allowed?: boolean;
    history_allowed?: boolean;
    pendingOrder?: { summary: string; amount: number };
    command?: string;
    trigger_source?: "typed_command" | "button_click" | "normal_message";
    callback_payload?: string;
    latest_order?: { status: string; summary: string } | null;
  } = { force_mode: "AUTO", menu_allowed: true, history_allowed: true },
  detectedLanguage: string = "en-IN"
): Promise<string> {
  try {
    const businessTypeLower = (businessType || "business").toLowerCase();
    const { force_mode = "AUTO", menu_allowed = true, history_allowed = true, pendingOrder } = controlFlags;

    // Detect hard language code for enforcement
    let hardLanguageRule = "";
    if (detectedLanguage.startsWith("ta")) hardLanguageRule = "STYLE: The user is using TAMIL/TANGLISH. You MUST reply in TANGLISH (Tamil written in English letters). Mix Tamil and English naturally.";
    else if (detectedLanguage.startsWith("hi")) hardLanguageRule = "STYLE: The user is using HINDI/HINGLISH. You MUST reply in HINGLISH. Mix Hindi and English naturally.";
    else if (detectedLanguage.startsWith("en")) hardLanguageRule = "STYLE: You MUST reply in friendly, professional ENGLISH.";

    // 🏷️ Format Product List
    let productList = "NO PRODUCTS LISTED";
    if (structuredMenu?.categories?.length > 0) {
      productList = structuredMenu.categories
        .map((cat: any) =>
          `--- ${cat.name.toUpperCase()} ---\n` +
          cat.items.map((i: any) => `- ${i.name}: ₹${i.price}${i.description ? ' (' + i.description + ')' : ''}`).join("\n")
        )
        .join("\n\n");
    }

    // 📜 Format Order History
    let formattedOrderHistory = "No previous order history.";
    if (orderHistory && orderHistory.length > 0) {
      formattedOrderHistory = orderHistory
        .map(o => `- ${o.summary} (Total: ₹${o.amount}) on ${new Date(o.createdAt).toLocaleDateString()}`)
        .join("\n");
    }

    // 👤 Format Customer Profile
    const profileText = customerProfile ? `
Name: ${customerProfile.name || "Unknown"}
Phone: ${customerProfile.contact || "Unknown"}
Address: ${customerProfile.address || "Not provided"}
Tags: ${customerProfile.tags || "None"}
`.trim() : "New Customer";

    // 🛒 Current Draft Order
    const currentDraft = pendingOrder
      ? `CURRENT DRAFT: ${pendingOrder.summary} (Total: ₹${pendingOrder.amount}).`
      : "No items currently being ordered.";

    const systemPrompt = `
You are LeadSync’s Telegram bot assistant used in production by many shops (retail, electronics, restaurant, services, etc.). Your job is to generate customer-facing messages and, when needed, a single button for actions like “View today’s items”.

CONTEXT:
- shop_name: ${businessName}
- business_type: ${businessType}
- offerings_summary: ${productList}
- customer_profile: ${JSON.stringify(customerProfile || {})}
- user_language_hint: ${detectedLanguage}
- latest_user_message: "${message}"
- command: ${controlFlags.command || "none"}
- trigger_source: ${controlFlags.trigger_source || "normal_message"}
- callback_payload: ${controlFlags.callback_payload || "none"}
- latest_order_status: ${controlFlags.latest_order?.status || "n/a"}
- latest_order_summary: ${controlFlags.latest_order?.summary || "n/a"}

========================
ABSOLUTE OUTPUT RULES
========================
1) Output PLAIN TEXT ONLY. No JSON. No markdown. No code blocks. No backticks. No extra commentary.
2) Output must be in EXACTLY one of these formats only:

A) With a button:
MESSAGE: <text>
BUTTON: <button label>
CALLBACK: <payload>

B) Without a button:
MESSAGE: <text>

Do not output anything else.

========================
LANGUAGE + TONE (STRICT)
========================
- Detect the user’s language style from latest_user_message and mirror it:
  English / Hindi / Tamil / Hinglish / Tanglish / Mixed.
- Keep replies short (1–2 lines usually), polite, natural, and professional.
- Avoid repeating “sir” in every message (use occasionally only).
- Do NOT use generic filler like “How can I assist you today?” if the user asked something specific.

========================
ANTI-REPEAT (CRITICAL)
========================
- Never repeat your previous assistant reply.
- Always move the conversation forward to the next step.
- If user repeats the same request, acknowledge briefly and proceed.

========================
STRICT DO-NOTS (PRODUCTION)
========================
- Do NOT invent products, prices, or stock if offerings_summary is missing.
- Do NOT repeat menu/options immediately after already sending them, unless the user explicitly asks again.
- Do NOT generate fake order status updates (ready/out-for-delivery/delivered) unless the system explicitly provided an order_status update AND the user asked for status.
- Do NOT reveal past order details unless the user explicitly asks “same as last time / repeat last order / previous order”.

========================
COMMAND FLOW (TELEGRAM UX)
========================

/START
If command="/start" OR latest_user_message="/start":
- Send a welcome message using shop_name.
- Explain in one line what the bot can do (browse items, check prices, place order).
- Show ONE button to view today’s items for THIS shop.
- Callback payload must be exactly: MENU

/MENU (typed) or MENU (button)
If command="/menu" OR latest_user_message="/menu" OR (trigger_source="button_click" AND callback_payload="MENU"):
- If offerings_summary exists:
  Show today’s items in a short list (max 8 items).
  End with a question: “What would you like?” / “Edhu venum?” / “Kya chahiye?”
- If offerings_summary is missing:
  Ask what category/item they are looking for (do not invent items).

========================
ORDER DETECTION LEVELS (CRITICAL)
========================
You must distinguish between:

1) ORDER_CONFIRMED (Place the order now)
Trigger when the message clearly means “go ahead and place it now”, NOT a question.
Examples:
- English: "I want X", "I need X", "place order", "confirm", "book it"
- Tanglish/Tamil: "venum", "pannirunga", "book pannunga", "kudunga", "vaanganum"
- Hinglish/Hindi: "chahiye" (not as a question), "order kar do", "mangta hai"

2) ORDER_INTENT (Asking permission/possibility)
Trigger when the message is a QUESTION about ordering.
Examples:
- English: "can I order?", "is it available to order?"
- Tanglish/Tamil: "order pannalama?", "order panna mudiyuma?", "vaangalama?", "venuma?"
- Hinglish/Hindi: "order kar sakte?", "milega?", "chahiye kya?" (question form)

QUESTION-TONE HEURISTIC (IMPORTANT)
If the message contains "?" OR ends with sounds like:
"aa?", "uma?", "lama?", "mudiyuma?", "sakta?", "milega?"
treat it as ORDER_INTENT, not ORDER_CONFIRMED.

3) BROWSING (Not ordering yet)
Examples:
- "price enna?", "nalla irukuma?", "details?", "options?", "available?"

========================
HOW TO RESPOND BY INTENT
========================

A) If ORDER_CONFIRMED:
- Confirm the order in one line (item + quantity if known).
- Ask ONLY ONE next required question:
  - size/variant/color? (for apparel/electronics)
  - delivery or pickup? (if relevant)
  - address ONLY if delivery is confirmed and address is unknown
- Do NOT talk about quality again.
- Do NOT re-list menu.
Examples:
- MESSAGE: ✅ Seri! 1 Tracksuit order note panniten. Size enna venum (S/M/L/XL)? ❓
- MESSAGE: ✅ Noted: 4 dosa. Delivery-aa pickup-aa? ❓
- MESSAGE: ✅ 1 laptop noted. Which model/variant do you prefer? ❓

B) If ORDER_INTENT:
- Do NOT confirm as placed.
- Say yes/possible politely.
- Ask ONE detail needed to proceed (size/qty/variant/delivery).
Examples:
- MESSAGE: Aama pannalam 😊 Size enna venum (S/M/L/XL)? ❓
- MESSAGE: Haan ji, order kar sakte hain. Kitna quantity chahiye? ❓
- MESSAGE: Yes, you can order. Which variant/quantity would you like? ❓

C) If BROWSING/QUESTION:
- Answer briefly using offerings_summary if available.
- Then ask a helpful next step:
  “Order place pannava?” / “Would you like to order?” / “Quantity evlo venum?”
- Do NOT repeat long lists.

D) If SUPPORT/STATUS:
- Answer directly.
- Ask one missing identifier only if needed.

E) If GENERAL (greeting only):
- Short greeting once.
- Suggest they tap MENU button or type /menu.

========================
FINAL INSTRUCTION
========================
Always follow the output format exactly.
`;

    const conversation = (history || []).map(m => ({
      role: m.role,
      content: m.content
    }));
    conversation.push({ role: "user", content: message });

    let aiOutput = await generateWithFallback(conversation, systemPrompt);

    // 🛡️ SANITIZATION LAYER: Ensure we return the raw output for the adapter to parse
    aiOutput = aiOutput.replace(/```[a-z]*\n?|```/gi, "").trim();

    // Since the format is now MESSAGE: / BUTTON: / CALLBACK:, we return it as is.
    // However, if the AI output doesn't start with MESSAGE:, we wrap it for safety.
    if (!aiOutput.includes("MESSAGE:")) {
      aiOutput = "MESSAGE: " + aiOutput;
    }

    return aiOutput;

  } catch (error) {
    console.error("❌ Bot Reply Fatal Error:", error);
    if (inputModality === "text") {
      return "I'm sorry, I'm having trouble right now. Our team will help you soon!";
    }
    return JSON.stringify({
      response_text: "I am sorry, I am having trouble right now. Our team will help you soon.",
      allow_voice_choice: true
    });
  }
}



export async function generateStructuredMenu(
  description: string,
  existingMenu?: any
): Promise<any> {

  // Use Groq for structured JSON generation if available
  if (process.env.GROQ_API_KEY) {
    try {
      console.log("🤖 [AI] Generating Structured Menu (Groq)...");
      let prompt = `Generate a JSON menu for: ${description}.
Format: {"categories": [{"name": "C", "items": [{"name": "I", "price": 10}]}]}
ONLY JSON. No markdown.`;

      if (existingMenu) {
        prompt += `\nUpdate: ${JSON.stringify(existingMenu)}`;
      }

      const completion = await groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama-3.3-70b-versatile", // Use smarter model for JSON
        temperature: 0.2,
        response_format: { type: "json_object" }
      });

      return JSON.parse(completion.choices[0]?.message?.content || "{}");
    } catch (e) {
      console.error("Groq JSON generation failed, falling back...");
    }
  }

  // Fallback logic for original simple object return 
  return existingMenu || { categories: [] };
}

export async function generateStructuredOrder(
  text: string,
  menu: any
): Promise<{ items: { name: string; quantity: number; price?: number }[] }> {
  if (!process.env.GROQ_API_KEY) return { items: [] };

  try {
    console.log("🤖 [AI] Analyzing Structured Order...");
    const menuContext = JSON.stringify(menu?.categories || []);

    const prompt = `
Context: A customer sent this message: "${text}".
Task: Extract order items based strictly on the menu below.
Menu: ${menuContext}

Rules:
1. Return JSON: { "items": [{ "name": "Item Name", "quantity": 1, "price": 100 }] }
2. If exact price is unknown, estimate from menu or leave 0.
3. If no items found, return { "items": [] }.
4. Handle flexible inputs like "2 of the chicken ones".
5. ONLY JSON. No markdown.
`;

    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(completion.choices[0]?.message?.content || "{}");
    return result.items ? result : { items: [] };

  } catch (e) {
    console.error("❌ AI Order Extraction Failed:", e);
    return { items: [] };
  }
}
