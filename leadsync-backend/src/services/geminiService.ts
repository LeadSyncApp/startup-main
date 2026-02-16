import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

export async function generateBotReply(
  message: string,
  businessType: string,
  structuredMenu?: any
): Promise<string> {
  try {
    let systemPrompt = `
You are a professional assistant for a ${businessType} business.

Rules:
- Reply clearly and professionally.
- Never output JSON.
- Never show raw menu JSON.
- Format menu nicely if asked.
- Keep replies short and clean.
`;

    if (structuredMenu?.categories?.length > 0) {
      const formattedMenu = structuredMenu.categories
        .map(
          (cat: any) =>
            `\n${cat.name}:\n` +
            cat.items
              .map((i: any) => `- ${i.name} (₹${i.price})`)
              .join("\n")
        )
        .join("\n");

      systemPrompt += `\nMenu:\n${formattedMenu}\n`;
    }

    const completion = await openai.chat.completions.create({
      model: "openai/gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
      temperature: 0.3,
      max_tokens: 300,
    });

    return (
      completion.choices?.[0]?.message?.content ||
      "Our team will assist you shortly."
    );
  } catch (error) {
    console.error("Bot Reply Error:", error);
    return "Our assistant is temporarily unavailable.";
  }
}

export async function generateStructuredMenu(
  description: string,
  existingMenu?: any
): Promise<any> {
  try {
    const prompt = `
Generate a clean structured product menu with pricing.

Return ONLY valid JSON:
{
  "categories": [
    {
      "name": "Category",
      "items": [
        { "name": "Item", "price": 100 }
      ]
    }
  ]
}

Business Description:
${description}
`;

    const completion = await openai.chat.completions.create({
      model: "openai/gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    });

    const raw =
      completion.choices?.[0]?.message?.content || "{}";

    return JSON.parse(raw);
  } catch (error) {
    console.error("Structured Menu Error:", error);
    return existingMenu || { categories: [] };
  }
}
