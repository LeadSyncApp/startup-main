import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
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

export async function generateBotReply(
  message: string,
  businessType: string,
  structuredMenu?: any
): Promise<string> {
  try {
    let systemPrompt = `Role: Assistant for ${businessType}. strictly professional. Keep it short.`;

    if (structuredMenu?.categories?.length > 0) {
      // Create a cache key based on businessType + stricture hash/length to simple detect changes
      // For now, we rebuild. Optimization: Generate a compact menu representation.
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

    const completion = await retryWithBackoff(() =>
      openai.chat.completions.create({
        model: "google/gemini-2.0-flash-lite-preview-02-05:free",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        temperature: 0.3,
        max_tokens: 100, // Reduced as requested
      }, { timeout: 10000 }) // 10s timeout
    );

    return (
      completion.choices?.[0]?.message?.content ||
      "Our team will assist you shortly."
    );
  } catch (error) {
    console.error("Bot Reply Error:", error);
    // Fail gracefully
    return "Our assistant is temporarily unavailable.";
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
