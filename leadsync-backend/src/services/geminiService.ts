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
    let systemPrompt = `You are a helpful assistant for a ${businessType}. 
STRICT RULES:
1. You ONLY know the menu items listed below.
2. You DO NOT have access to other customers' orders or sales data. 
3. If the user asks for "orders" (e.g., "what are your orders"), they mean "MENU". List the available menu items.
4. NEVER make up fake orders or say "we have these orders" unless referring to the CURRENT user's confirmed items in the conversation history.
5. Be concise and professional. Keep responses under 2 sentences unless listing the menu.`;

    if (structuredMenu?.categories?.length > 0) {
      const formattedMenu = structuredMenu.categories
        .map(
          (cat: any) =>
            `${cat.name}:\n` +
            cat.items
              .map((i: any) => `- ${i.name} (₹${i.price})`)
              .join("\n")
        )
        .join("\n");

      systemPrompt += `\n\nOFFICIAL MENU:\n${formattedMenu}\n\nUse ONLY this menu. Do not hallucinate items.`;
    } else {
      systemPrompt += `\n\n(No menu is currently available. Apologize if asked for food items.)`;
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
