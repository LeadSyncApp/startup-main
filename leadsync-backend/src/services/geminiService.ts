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

    const systemPrompt = `You are LeadSync’s production Telegram assistant for multi-tenant businesses (${businessType}).
This is a real customer-facing chat for ${businessName}.

${hardLanguageRule}

[INVENTORY]
${productList}

[CONTEXT]
Detected Language: ${detectedLanguage}
Command: ${controlFlags.command || "none"}
Trigger Source: ${controlFlags.trigger_source || "normal_message"}

=============================
STRICT PRODUCTION RULES (MANDATORY)
=============================
1. MIRROR LANGUAGE:
   - Always reply in the user's detected language/style.
   - If User speaks English -> Reply English.
   - If User speaks Tanglish/Tamil -> Reply Tanglish.
   - If User speaks Hinglish/Hindi -> Reply Hinglish.
   - Switch language IMMEDIATELY when the user switches.

2. ORDER HANDLING:
   - CONFIRM any order clearly.
   - Ask for the NEXT required detail only (e.g., size, address, payment preference).
   - NEVER hallucinate order IDs or delivery status.
   - Use the [INVENTORY] to ground prices and items.

3. ANTI-REPETITION:
   - NEVER repeat your previous response or the same information twice.
   - If the user already knows the price, don't repeat it.
   - Keep conversation moving forward.

4. NO BUSINESS LOGIC GENERATION:
   - Do not make up company policies. 
   - Stick to the provided [INVENTORY] and customer context.

5. OUTPUT FORMAT:
   - Return PLAIN TEXT ONLY.
   - No JSON. No markdown (except bold for emphasis). No backticks.
   - Start with "MESSAGE: " header.

[CONVERSATIONAL POLISH]
- Be friendly, professional, and concise.
- End with a short, helpful question if the order is not complete.`;

    const conversation = (history || [])
      .slice(-6) // STICK TO LATEST 6 MESSAGES AS REQUESTED
      .map(m => ({
        role: (m.role === "assistant" || m.role === "bot") ? "assistant" : "user",
        content: m.content
      }));

    // Add the current message
    conversation.push({ role: "user", content: message });

    let aiOutput = await generateWithFallback(conversation, systemPrompt);

    // 🛡️ SANITIZATION LAYER: Improved to prevent hallucinated headers when empty
    aiOutput = aiOutput.replace(/```[a-z]*\n?|```/gi, "").trim();
    aiOutput = aiOutput.replace(/\*\*|\*/g, "");

    // If AI hallucinates a list header but inventory is empty, or if it says "Today's items at ...:" with nothing
    if ((productList === "NO PRODUCTS LISTED" || productList.length < 5) &&
      (aiOutput.includes("items:") || aiOutput.includes("options:")) &&
      aiOutput.length < 100) {
      aiOutput = "MESSAGE: Edhu venum? Ippo items edhuvum available illa. Check back later! 😊";
    }

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
