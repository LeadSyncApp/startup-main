import OpenAI from "openai";

const apiKey = (process.env.OPENROUTER_API_KEY || "").trim();

const openai = new OpenAI({
  apiKey,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": "https://leadsync.vercel.app", // Required for some free models
    "X-Title": "LeadSync AI",
  }
});

// Cache for system prompts to avoid string rebuilding if possible (basic version)
const promptCache = new Map<string, string>();

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (retries === 0) throw err;
    await new Promise((resolve) => setTimeout(resolve, delay));
    return retryWithBackoff(fn, retries - 1, delay * 2);
  }
}

const MODELS = [
  "google/gemini-2.0-flash-lite-preview-02-05:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "mistralai/mistral-7b-instruct:free",
  "qwen/qwen-2.5-72b-instruct:free",
];

async function generateWithFallback(
  messages: any[],
  systemPrompt: string
): Promise<string> {
  let lastError;

  for (const model of MODELS) {
    try {
      console.log(`🤖 [AI] Attempting ${model}...`);

      const completion = await openai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.filter(m => m.content && m.content.trim()) // Sanitize
        ],
        temperature: 0.3,
        max_tokens: 150,
      }, { timeout: 7000 }); // 7s timeout per model

      const content = completion.choices?.[0]?.message?.content;
      if (content) {
        console.log(`✅ [AI] Success with ${model}`);
        return content;
      }
    } catch (err: any) {
      const status = err.status || err.response?.status;
      console.error(`⚠️ [AI] Model ${model} failed (Status: ${status}):`, err.message);
      lastError = err;
    }
  }
  throw lastError || new Error("All models failed");
}

export async function generateBotReply(
  message: string,
  businessType: string,
  structuredMenu?: any,
  history?: any[]
): Promise<string> {
  try {
    let systemPrompt = `Role: Assistant for ${businessType}. strictly professional. Keep it short.`;

    if (structuredMenu?.categories?.length > 0) {
      const formattedMenu = structuredMenu.categories
        .map(
          (cat: any) =>
            `${cat.name}:\n` +
            cat.items
              .map((i: any) => `- ${i.name} (${i.price})`)
              .join("\n")
        )
        .join("\n");

      systemPrompt += `\nMenu:\n${formattedMenu}\nRules: Suggest menu items if relevant.`;
    }

    const conversation = [
      ...(history || []),
      { role: "user", content: message }
    ];

    return await generateWithFallback(conversation, systemPrompt);

  } catch (error) {
    console.error("❌ Bot Reply Fatal Error:", error);
    return "I apologize, but I'm having trouble connecting right now. Please try again in a moment.";
  }
}

export async function generateStructuredMenu(
  description: string,
  existingMenu?: any
): Promise<any> {
  try {
    let prompt = `Generate a JSON menu for: ${description}.
Format: {"categories": [{"name": "C", "items": [{"name": "I", "price": 10}]}]}
NO markdown. ONLY JSON.`;

    if (existingMenu) {
      prompt += `\nUpdate: ${JSON.stringify(existingMenu)}`;
    }

    const completion = await retryWithBackoff(() =>
      openai.chat.completions.create({
        model: "openai/gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      })
    );

    let raw = completion.choices?.[0]?.message?.content || "{}";
    raw = raw.replace(/```json/g, "").replace(/```/g, "").trim();

    return JSON.parse(raw);
  } catch (error) {
    console.error("Structured Menu Error:", error);
    return existingMenu || { categories: [] };
  }
}
