import axios from "axios";
import Groq from "groq-sdk";

// Initialize Groq
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "dummy" });

// Model Hierarchy: Sarvam for Multilingual, Groq for Speed
const MODELS = [
  { provider: "sarvam", id: "sarvam-m" },              // 🇮🇳 Best for Indian Languages
  { provider: "groq", id: "llama-3.1-8b-instant" },     // ⚡ ~0.3s latency fallback
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
        // Sarvam.ai expects strictly {role, content}. Extra fields cause 400 errors.
        const chatMessages = [
          { role: "user", content: `System Instruction: ${systemPrompt}` },
          ...messages
            .filter(m => m.content && m.content.trim())
            .map(m => ({
              role: m.role === "system" ? "user" : m.role,
              content: m.content
            }))
        ];

        const response: any = await withTimeout(
          axios.post(
            "https://api.sarvam.ai/v1/chat/completions",
            {
              model: model.id,
              messages: chatMessages
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
      }
      else if (model.provider === "groq") {
        const completion: any = await withTimeout(
          groq.chat.completions.create({
            messages: [
              { role: "system", content: systemPrompt },
              ...messages.filter(m => m.content && m.content.trim())
            ],
            model: model.id,
            temperature: 0.3,
            max_tokens: 150,
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
  message: string, // Unused but kept for signature compatibility if needed, though conversation includes it
  businessType: string,
  structuredMenu?: any,
  history?: any[]
): Promise<string> {
  try {
    const businessTypeLower = businessType.toLowerCase();

    // 🏭 DYNAMIC INDUSTRY DETECTION
    const isFood = businessTypeLower.match(/(restaurant|food|cafe|bakery|kitchen|dining|bistro|grill|pizza|burger)/);
    const isRetail = businessTypeLower.match(/(retail|clothing|fashion|boutique|wear|store|shop|mart|apparel)/);
    const isElectronics = businessTypeLower.match(/(electronics|mobile|tech|gadgets|computer|laptop|devices)/);
    const isService = businessTypeLower.match(/(service|consulting|agency|salon|spa|repair|gym|fitness)/);

    // 🏷️ DYNAMIC TERMINOLOGY
    let catalogTerm = "CATALOG";
    let outputFocus = "products and features";

    if (isFood) {
      catalogTerm = "MENU";
      outputFocus = "dishes, ingredients, and taste";
    } else if (isRetail) {
      catalogTerm = "COLLECTION";
      outputFocus = "styles, sizes, colors, and material";
    } else if (isElectronics) {
      catalogTerm = "INVENTORY";
      outputFocus = "specs, warranty, battery life, and compatibility";
    } else if (isService) {
      catalogTerm = "SERVICES LIST";
      outputFocus = "service details, duration, and pricing";
    }

    let systemPrompt = `You are a helpful, professional AI assistant for "${businessType}" (${catalogTerm} based).
STRICT OPERATING RULES:
1. DOMAIN EXPERT: You are a friendly expert in ${outputFocus}. 
   - Feel free to recommend items based on the user's preferences.
   - You can describe tastes, features, and help the user decide.
   - IF asked about completely unrelated topics (like math/code/politics) -> Polite refusal.
   - REFUSAL TEMPLATE: "I can only assist you with our ${catalogTerm} and orders."

2. SOURCE OF TRUTH: The ${catalogTerm} below is your ONLY knowledge base for pricing and availability. 
   - DO NOT hallucinate items not listed.
   - DO NOT invent prices.

3. LANGUAGE & TONE:
   - Identify the user's language (Tamil, Hindi, Hinglish, English, etc.).
   - ALWAYS respond in the SAME language/script the user is using.
   - Example: If the user asks in Tamil Roman ("Yevlo price?"), respond in Tamil Roman or Script.
   - Be concise (< 50 words) but helpful. Use emojis!

4. INTENT MAPPING:
   - "Show menu/orders/options" -> Output the ${catalogTerm}.
   - "What do you have?" -> Summarize the ${catalogTerm}.

OFFICIAL ${catalogTerm} DATA:
`;

    if (structuredMenu?.categories?.length > 0) {
      const formattedMenu = structuredMenu.categories
        .map(
          (cat: any) =>
            `${cat.name.toUpperCase()}:\n` +
            cat.items
              .map((i: any) => `- ${i.name} (${i.price ? '₹' + i.price : 'Contact for Price'})${i.description ? ': ' + i.description : ''}`)
              .join("\n")
        )
        .join("\n\n");

      systemPrompt += `${formattedMenu}\n\n[END OF ${catalogTerm}]`;
    } else {
      systemPrompt += `(Empty ${catalogTerm}. Politely ask the user what they are looking for so you can check manually.)`;
    }

    // Ensure conversation struct is valid
    const conversation = (history || []).map(m => ({
      role: m.role,
      content: m.content
    }));

    // Add current user message to conversation if not already there? 
    // Wait, the adapter appends it. No, adapter passes `historyContext` which EXCLUDES the current message?
    // Let's check `TelegramAdapter.ts`: `const historyContext = history.reverse().map(...)`
    // Then `generateBotReply(text, ...)`
    // But `generateBotReply` logic (old) was:
    // const conversation = [ ...(history || []), { role: "user", content: message } ];
    // So YES, we must append the current message here.

    conversation.push({ role: "user", content: message });

    return await generateWithFallback(conversation, systemPrompt);

  } catch (error) {
    console.error("❌ Bot Reply Fatal Error:", error);
    return "Thank you for reaching out! Our team will assist you shortly.";
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
