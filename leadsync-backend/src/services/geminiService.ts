import Groq from "groq-sdk";
import { GoogleGenAI } from "@google/genai";

// Initialize Groq (Primary)
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "dummy" });

// Initialize Gemini (Backup)
const geminiApiKey = (process.env.GEMINI_API_KEY || "").trim();
const genAI = new GoogleGenAI({ apiKey: geminiApiKey });

// Model Hierarchy: Fast -> Smart -> Backup
const MODELS = [
  { provider: "groq", id: "llama-3.1-8b-instant" },     // ⚡ ~0.3s latency
  { provider: "groq", id: "llama-3.3-70b-versatile" },  // 🧠 Smarter
  { provider: "gemini", id: "gemini-2.0-flash-lite" },  // 🛡️ Backup
];

async function generateWithFallback(
  messages: any[],
  systemPrompt: string
): Promise<string> {
  let lastError;
  const useGroq = !!process.env.GROQ_API_KEY;

  for (const model of MODELS) {
    if (model.provider === "groq" && !useGroq) continue;
    if (model.provider === "gemini" && !geminiApiKey) continue;

    try {
      console.log(`🤖 [AI] Attempting ${model.provider.toUpperCase()}: ${model.id}...`);

      let content = "";

      if (model.provider === "groq") {
        const completion = await groq.chat.completions.create({
          messages: [
            { role: "system", content: systemPrompt },
            ...messages.filter(m => m.content && m.content.trim())
          ],
          model: model.id,
          temperature: 0.3,
          max_tokens: 200,
        });
        content = completion.choices[0]?.message?.content || "";
      } else {
        // Gemini Fallback
        const contents = messages.map((m: any) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));
        const response = await genAI.models.generateContent({
          model: model.id,
          contents,
          config: { systemInstruction: systemPrompt },
        });
        content = response.text || "";
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
  businessType: string,
  structuredMenu?: any,
  history?: any[]
): Promise<string> {
  try {
    let systemPrompt = `You are a helpful assistant for a ${businessType}. Be concise and professional.`;

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

      systemPrompt += `\n\nMenu:\n${formattedMenu}\n\nIf the user asks about the menu or food, suggest relevant items.`;
    }

    const conversation = [
      ...(history || []),
      { role: "user", content: message }
    ];

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
