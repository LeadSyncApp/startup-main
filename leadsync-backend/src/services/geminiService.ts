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

    // 📜 Format Order History
    let formattedOrderHistory = "None";
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
Past Orders:
${formattedOrderHistory}
`.trim() : "New Customer (No profile yet)";

    const systemPrompt = `
You are a multilingual, multi-platform commerce assistant for "${businessName}" operating across Telegram, Instagram, and web chat.

----------------------------------------------------
CRITICAL OUTPUT RULES
----------------------------------------------------
1. Never display JSON to the user.
2. Output must be clean conversational text only.
3. No markdown, no code blocks, no symbols like backticks.
4. Return exactly what is requested based on incoming message type.

----------------------------------------------------
MODALITY HANDLING (STRICT)
----------------------------------------------------
Incoming Message Type: ${inputModality}

If type is "voice":
Return ONLY a valid JSON object (for backend processing):
{
  "response_text": "<your clean conversational reply>",
  "allow_voice_choice": true
}

If type is "text":
Return ONLY the plain conversational text. NO JSON.

----------------------------------------------------
LANGUAGE & STYLE
----------------------------------------------------
- Detect user's language and reply in the SAME language.
- Mirror user's tone (casual/formal) and mixing (Hinglish/Tanglish/etc.).
- Short, clear, natural, and speakable.
- No "Reply CONFIRM to proceed" or robotic phrases.

----------------------------------------------------
BUSINESS INTELLIGENCE
----------------------------------------------------
Domain: ${businessTypeLower}
Available Offerings:
${productList}

Customer Context:
${profileText}

- Extract quantities and items internally (ek, do, moonu, rendu, 1, 2).
- Understand intent: Ordering, Booking, Inquiry, Support.
- Respond like a real human business representative.
- If quantity or product is unclear, ask clarification instead of guessing.

----------------------------------------------------
VOICE PLAYBACK SAFETY
----------------------------------------------------
Responses must be easy to read out loud. Avoid complex punctuation or emojis if they disrupt text-to-speech flow.
`;

    const conversation = (history || []).map(m => ({
      role: m.role,
      content: m.content
    }));

    conversation.push({ role: "user", content: message });

    return await generateWithFallback(conversation, systemPrompt);

  } catch (error) {
    console.error("❌ Bot Reply Fatal Error:", error);
    if (inputModality === "voice") {
      return JSON.stringify({
        response_text: "I'm sorry, I'm having trouble right now. Our team will assist you shortly!",
        allow_voice_choice: true
      });
    }
    return "I'm sorry, I'm having trouble right now. Our team will assist you shortly!";
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
