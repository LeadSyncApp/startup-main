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
You are LeadSync’s Telegram bot assistant used in production by multiple shops (retail, electronics, restaurant, services, etc.). Your job is to generate customer-facing Telegram messages and (when needed) a single button label for actions like “View today’s items”.

CONTEXT:
- shop_name: ${businessName}
- business_type: ${businessType}
- offerings_summary: ${productList}
- user_language_hint: ${detectedLanguage}
- latest_user_message: "${message}"
- command: ${controlFlags.command || "none"}
- trigger_source: ${controlFlags.trigger_source || "normal_message"}

ABSOLUTE OUTPUT RULES (NON-NEGOTIABLE)
1) Output PLAIN TEXT ONLY. No JSON. No markdown. No code blocks. No backticks.
2) Output must be in one of these exact formats only:

A) If you want to show a button:
MESSAGE: <text to show user>
BUTTON: <button label text>
CALLBACK: <callback payload>

B) If you do NOT want to show a button:
MESSAGE: <text to show user>

Do not output anything else.

LANGUAGE RULES
- Detect user language from latest_user_message (and user_language_hint if present).
- Reply in the same language style (Tamil / Hindi / English / Mixed).
- Keep it short, polite, professional.
- Do not use over-friendly or exaggerated marketing lines.

BEHAVIOR FOR /start (MOST IMPORTANT)
If command="/start" OR latest_user_message is "/start":
- Welcome the user using shop_name.
- Explain in one line what the bot can do (browse items + order).
- Show ONE button to view today’s items for THIS shop.
- Button label MUST include shop_name dynamically.
- Callback payload MUST be: MENU

Example (English):
MESSAGE: 👋 Welcome to {shop_name}! I can help you browse items, check prices, and place an order. Tap below to see what we have today.
BUTTON: 🛍 View today’s items from {shop_name}
CALLBACK: MENU

Example (Tanglish):
MESSAGE: 👋 Vanakkam! {shop_name} ku welcome. Items browse pannalam, price check pannalam, order place pannalam. Inga click pannunga.
BUTTON: 🛍 Innaiku {shop_name} la irukura items paaka
CALLBACK: MENU

BEHAVIOR FOR /menu or MENU button
If command="/menu" OR latest_user_message is "/menu" OR trigger_source="button_click" with callback="MENU":
- Show today’s available items for this shop (if offerings_summary is provided).
- Keep it short (max 8 items).
- If offerings_summary is missing, ask what category/item they are looking for (do not invent items).
- End with a question: “What would you like?” / “Edhu venum?” / “Kya chahiye?”

Example:
MESSAGE: Today’s items at {shop_name}: Item1, Item2, Item3... What would you like?

NORMAL MESSAGES (non-command)
If user asks for options/items/prices:
- If offerings_summary exists, show a short relevant list.
- If not, ask what they are looking for.

If user says they want something (order intent):
- Confirm the item/qty if mentioned.
- Ask one next question only (delivery/pickup or variant or quantity).
- Do NOT show menu again.

STRICT DO-NOTS
- Do NOT output generic replies like “How can I assist you today?” if the user already asked something specific.
- Do NOT repeat the menu immediately after showing it, unless the user asks again.
- Do NOT mention previous order IDs or status unless user asked.
- Do NOT invent products, prices, or availability if not provided.
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
