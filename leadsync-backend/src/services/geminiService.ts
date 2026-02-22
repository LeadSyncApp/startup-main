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

          // Sarvam requires the first message to be from 'user'
          if (chatMessages.length === 0 && role === "assistant") continue;

          // Safety: Only add if it alternates
          if (chatMessages.length > 0 && chatMessages[chatMessages.length - 1].role === role) {
            chatMessages[chatMessages.length - 1].content += "\n" + m.content.trim();
          } else {
            const isLastUserMsg = i === rawHistory.length - 1 && role === "user";
            chatMessages.push({
              role,
              content: isLastUserMsg ? instructionPrefix + m.content.trim() : m.content.trim()
            });
          }
        }

        // Final safety: If still empty (unlikely) or ends with assistant, ensure it's valid for chat completion
        if (chatMessages.length === 0) {
          chatMessages.push({ role: "user", content: instructionPrefix + "Hello" });
        } else if (chatMessages[chatMessages.length - 1].role === "assistant") {
          chatMessages.push({ role: "user", content: "Please continue according to the instructions." });
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

    const systemPrompt = `[INVENTORY]
${productList}

=============================
ABSOLUTE OUTPUT (STRICT)
=============================
Return PLAIN TEXT ONLY.
No JSON. No markdown. No code blocks. No backticks. No extra lines.

Output must be EXACTLY one of:

A) Welcome with button:
MESSAGE: <text>
BUTTON: <button text>
CALLBACK: MENU

B) Anything else:
MESSAGE: <text>

Nothing else is allowed. Do not output anything else. No internal instructions.

=============================
LANGUAGE MIRRORING (CRITICAL)
=============================
- Detect the user’s language from latest_user_message.
- If user is Tamil/Tanglish → reply in Tamil/Tanglish.
- If user is Hindi/Hinglish → reply in Hindi/Hinglish.
- If user is English → reply in English.
- If user switches to English mid-chat → immediately switch to English.
- Do NOT randomly use English when user is using Tamil/Hindi.
- Keep tone friendly and professional, short.

=============================
START FLOW (MUST)
=============================
If command="/start" OR latest_user_message="/start":
Return ONLY:
MESSAGE: 👋 Welcome to ${businessName}! Tap below to view today’s items.
BUTTON: 🛍 View today’s items from ${businessName}
CALLBACK: MENU

Do NOT show items from [INVENTORY] here.

=============================
MENU FLOW (MUST SHOW ITEMS)
=============================
You must show items ONLY when:
- command="/menu"
OR
- latest_user_message="/menu"
OR
- trigger_source="button_click" AND callback_payload="MENU"
OR
- user explicitly asks for: "menu", "items", "options", "catalog", "what available"

When MENU FLOW is triggered:
1) If [INVENTORY] contains at least 1 item name:
   - You MUST list items (max 8) with prices if present.
   - If categories exist, include category headings briefly.
   - End with a short question: “Edhu venum?” / “What would you like?” / “Kya chahiye?”
   - Do NOT reply with a generic sentence without listing items.
2) If [INVENTORY] is empty OR has no item names:
   - Do NOT print “Today’s items at …” with nothing.
   - Instead ask what they are looking for (category/item).

Example (Tanglish):
MESSAGE: Innaiku ${businessName} la irukura items: Sleeveless T-Shirt (₹15), Shirt (₹20), Tracksuit (₹30). Edhu venum?

=============================
ORDER DETECTION (DO NOT BREAK MENU)
=============================
- If user message includes confirmed buying phrases (venum / pannirunga / I want / I need / order kar do / chahiye) and is NOT a question:
  Confirm order + ask ONE next detail (size/qty/delivery). Do NOT show menu again.
- If user asks permission (order pannalama? / can I order? / venuma? with question):
  Do NOT confirm as placed; say yes + ask ONE detail.

=============================
ANTI-REPEAT / DO-NOTS
=============================
- Never repeat your previous reply. Move to the next step.
- Never invent items not in [INVENTORY].
- Never generate fake order IDs or delivery status updates.
- Never say “How can I assist you today?” if user asked something specific.
`;

    const conversation = (history || []).map(m => ({
      role: m.role,
      content: m.content
    }));
    conversation.push({ role: "user", content: message });

    let aiOutput = await generateWithFallback(conversation, systemPrompt);

    // 🛡️ SANITIZATION LAYER: Ensure we return the raw output for the adapter to parse
    aiOutput = aiOutput.replace(/```[a-z]*\n?|```/gi, "").trim();
    // Strip common markdown bold/italic markers that AI often adds despite rules
    aiOutput = aiOutput.replace(/\*\*|\*/g, "");

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
    Format: { "categories": [{ "name": "C", "items": [{ "name": "I", "price": 10 }] }] }
ONLY JSON. No markdown.`;

      if (existingMenu) {
        prompt += `\nUpdate: ${JSON.stringify(existingMenu)} `;
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
5. ONLY JSON.No markdown.
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
