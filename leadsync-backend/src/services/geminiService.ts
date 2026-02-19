import Groq from "groq-sdk";

// Initialize Groq (Primary)
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "dummy" });

// Model Hierarchy: Fast (Only Groq)
const MODELS = [
  { provider: "groq", id: "llama-3.1-8b-instant" },     // ⚡ ~0.3s latency
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

  for (const model of MODELS) {
    if (model.provider === "groq" && !useGroq) continue;

    try {
      console.log(`🤖 [AI] Attempting ${model.provider.toUpperCase()}: ${model.id}...`);

      let content = "";
      const timeoutMs = 8000; // 8s timeout per model

      if (model.provider === "groq") {
        const completion = await withTimeout(
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
1. DOMAIN LOCK: You are ONLY allowed to discuss ${outputFocus}.
   - IF asked about food in a shoe store -> Polite refusal.
   - IF asked about math/code -> Polite refusal.
   - REFUSAL TEMPLATE: "I can only assist you with our ${catalogTerm} and orders."

2. SOURCE OF TRUTH: The ${catalogTerm} below is your ONLY knowledge base. 
   - DO NOT hallucinate items not listed.
   - DO NOT invent prices.

3. INTENT MAPPING:
   - "Show menu/orders/options" -> Output the ${catalogTerm}.
   - "What do you have?" -> Summarize the ${catalogTerm}.

4. TONE & FORMAT:
   - Be concise (< 40 words) unless listing items.
   - Use emojis relevant to: ${businessType}.

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
