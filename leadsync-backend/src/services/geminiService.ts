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
  } = { force_mode: "AUTO", menu_allowed: true, history_allowed: true },
  detectedLanguage: string = "en-IN"
): Promise<string> {
  try {
    const businessTypeLower = (businessType || "business").toLowerCase();
    const { force_mode = "AUTO", menu_allowed = true, history_allowed = true, pendingOrder } = controlFlags;

    // Detect hard language code for enforcement
    let hardLanguageRule = "";
    if (detectedLanguage.startsWith("ta")) hardLanguageRule = "HARD RULE: You MUST reply in TAMIL/TANGLISH ONLY.";
    else if (detectedLanguage.startsWith("hi")) hardLanguageRule = "HARD RULE: You MUST reply in HINDI/HINGLISH ONLY.";
    else if (detectedLanguage.startsWith("en")) hardLanguageRule = "HARD RULE: You MUST reply in ENGLISH ONLY.";

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
You are LeadSync's local clerk for ${businessName}.

----------------------------------------------------
STRICT OPERATING MODES
----------------------------------------------------
MODE: ${force_mode}
${force_mode === "BROWSE_MENU" ? `CRITICAL: The user wants to see the MENU. You MUST list ALL products from the "Offerings" section below immediately. Do NOT mention past orders.` : ""}
${force_mode === "CONFIRM_ORDER" ? `CRITICAL: System detected: "${pendingOrder?.summary}". You MUST ask them to confirm this specifically: "${pendingOrder?.summary} for ₹${pendingOrder?.amount}".` : ""}

----------------------------------------------------
STRICT RESPONSE RULES
----------------------------------------------------
1) IGNORE HISTORY: If history_allowed=false, do NOT mention past orders or use "Welcome back".
2) NO GREETINGS: Do not say "Hello" or "How can I help" if they've already asked for something.
3) LISTINGS: When listing items, use a clean list: "Dosa - ₹30, Idly - ₹20".
4) NO JSON/MARKDOWN: Output plain text ONLY.

----------------------------------------------------
ABSOLUTE OUTPUT RULES
----------------------------------------------------
- input_modality="text": output EXACTLY ONE line: TEXT_REPLY: <response>
- input_modality="voice": output EXACTLY TWO lines:
  TEXT_REPLY: <natural with emojis>
  VOICE_TTS: <spoken text only, no emojis>

----------------------------------------------------
LANGUAGE (${detectedLanguage})
----------------------------------------------------
${hardLanguageRule}
- Mirror user's style (Tanglish / Hinglish / etc).

----------------------------------------------------
DATA
----------------------------------------------------
Business: ${businessName}
Offerings:
${menu_allowed ? productList : "HIDDEN"}

Past Orders:
${history_allowed ? formattedOrderHistory : "HIDDEN"}

LATEST CUSTOMER MESSAGE: 
"${message}"
`;

    const conversation = (history || []).map(m => ({
      role: m.role,
      content: m.content
    }));
    conversation.push({ role: "user", content: message });

    let aiOutput = await generateWithFallback(conversation, systemPrompt);

    // 🛡️ SANITIZATION LAYER: Ensure the prefixes are there even if AI forgot
    aiOutput = aiOutput.replace(/```[a-z]*\n?|```/gi, "").trim();

    if (inputModality === "text") {
      // Ensure only one line and starts with TEXT_REPLY:
      if (!aiOutput.startsWith("TEXT_REPLY:")) {
        aiOutput = "TEXT_REPLY: " + aiOutput.replace(/^TEXT_REPLY:|^VOICE_TTS:/gi, "").trim();
      }
      // If there are multiple lines, keep only the one starting with TEXT_REPLY
      const lines = aiOutput.split("\n");
      aiOutput = lines.find(l => l.startsWith("TEXT_REPLY:")) || lines[0];
    } else {
      // Input modality = voice
      let textReply = "";
      let voiceTts = "";

      const lines = aiOutput.split("\n").map(l => l.trim()).filter(l => l.length > 0);
      textReply = lines.find(l => l.startsWith("TEXT_REPLY:"))?.replace("TEXT_REPLY:", "").trim() || "";
      voiceTts = lines.find(l => l.startsWith("VOICE_TTS:"))?.replace("VOICE_TTS:", "").trim() || "";

      // Fallbacks if AI didn't follow the 2-line rule strictly
      if (!textReply && lines.length > 0) {
        textReply = lines[0].replace("TEXT_REPLY:", "").trim();
      }
      if (!voiceTts) {
        voiceTts = textReply.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, "").trim();
      }

      aiOutput = `TEXT_REPLY: ${textReply}\nVOICE_TTS: ${voiceTts}`;
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
