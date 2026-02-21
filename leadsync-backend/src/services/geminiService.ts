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
  const timeout = new Promise<T>((_, reject) =>
    setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
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

        // Combine Instruction with first message if possible
        const firstMsg = rawHistory[0];
        const instructionPrefix = `[INSTRUCTION: ${systemPrompt}]\n\n`;

        if (firstMsg && (firstMsg.role === "user" || firstMsg.role === "customer")) {
          // Merge instruction into first user message
          chatMessages.push({ role: "user", content: instructionPrefix + firstMsg.content.trim() });

          // Add the rest, matching roles
          for (let i = 1; i < rawHistory.length; i++) {
            const m = rawHistory[i];
            const role = (m.role === "assistant" || m.role === "bot") ? "assistant" : "user";

            // Safety: Only add if it alternates
            if (chatMessages.length > 0 && chatMessages[chatMessages.length - 1].role === role) {
              chatMessages[chatMessages.length - 1].content += "\n" + m.content.trim();
            } else {
              chatMessages.push({ role, content: m.content.trim() });
            }
          }
        } else {
          // Fallback: Just start with instruction
          chatMessages.push({ role: "user", content: instructionPrefix + "Please respond to the user based on the context above." });
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
            temperature: 0.1, // Lower temperature for JSON accuracy
            max_tokens: 400,  // Increased for large JSON blocks
            response_format: { type: "json_object" }
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
  inputModality: "text" | "voice" = "text"
): Promise<string> {
  try {
    const businessTypeLower = (businessType || "business").toLowerCase();

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

    // 📜 Format Order History (PRIVACY: Hidden from user, shown to AI)
    let formattedOrderHistory = "No past orders.";
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
Past Orders (DON'T REVEAL UNLESS ASKED):
${formattedOrderHistory}
`.trim() : "New Customer";

    const systemPrompt = `
You are LeadSync’s AI Customer Interaction Assistant for "${businessName}".
Business Type: ${businessTypeLower}

----------------------------------------------------
TOP PRIORITY RULE
----------------------------------------------------
- Respond to the customer’s LAST message first.
- If it's an order/booking (e.g. "I want X", "ek idly chahiye"), CONFIRM IMMEDIATELY in one short line.
- Ask ONLY the next required question (delivery/pickup, time, or address if missing).
- Do NOT repeat the catalog/menu if they have already decided on an item.

----------------------------------------------------
PAST ORDER PRIVACY + RELEVANCE
----------------------------------------------------
- NEVER reveal past order details (items, dates, totals) unless explicitly asked ("repeat my last order").
- Use past data SILENTLY to reduce questions (e.g., "Same address as last time?").

----------------------------------------------------
LANGUAGE & TONE
----------------------------------------------------
- Mirror the user's language (English/Hindi/Tamil/Mixed) and tone EXACTLY.
- Keep replies short (1-2 lines).
- Don't repeat greetings if conversation is ongoing.

----------------------------------------------------
AVAILABLE OFFERINGS
----------------------------------------------------
${productList}

----------------------------------------------------
CUSTOMER CONTEXT
----------------------------------------------------
${profileText}
Input Modality: ${inputModality}

----------------------------------------------------
STRICT JSON OUTPUT (INTERNAL ONLY)
----------------------------------------------------
Return VALID JSON ONLY. No markdown. No extra text.

{
  "language": "en|hi|ta|hinglish|mixed",
  "intent": "ORDERING|BOOKING|BROWSING|COMPLAINT|SUPPORT|GENERAL",
  "text_reply": "Short conversational reply (with emojis if casual)",
  "voice_reply_text": "Spoken version (no emojis, no symbols, natural)",
  "needs_followup": boolean,
  "followup_question": "string or empty",
  "extracted": {
    "items_or_services": [{"name":"string","qty":number,"variant":"string"}],
    "datetime": "string",
    "delivery_or_mode": "string",
    "address_needed": boolean,
    "phone_needed": boolean
  }
}

EXTRACTION: Normalize names (idli -> Idly). Detect numbers in all languages (ek, do, rendu, onnu).
`;

    const conversation = (history || []).map(m => ({
      role: m.role,
      content: m.content
    }));

    conversation.push({ role: "user", content: message });

    return await generateWithFallback(conversation, systemPrompt);

  } catch (error) {
    console.error("❌ Bot Reply Fatal Error:", error);
    return JSON.stringify({
      language: "en",
      intent: "GENERAL",
      text_reply: "I'm sorry, I'm having trouble right now. Our team will help you soon!",
      voice_reply_text: "I am sorry, I am having trouble right now. Our team will help you soon.",
      needs_followup: false,
      followup_question: "",
      extracted: { items_or_services: [] }
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
