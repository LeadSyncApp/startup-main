import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

/* =====================================================
   GENERATE AI BOT REPLY (SMART + GROUNDED)
===================================================== */
export async function generateBotReply(
  message: string,
  businessType: string,
  structuredMenu?: any
): Promise<string> {
  try {
    let systemPrompt = `
You are a professional AI assistant working for a ${businessType} company.

Your responsibilities:
- Answer professionally and clearly
- Stay within business context
- Be friendly but concise
- Guide customers properly

If the user sends an image or unclear message,
respond politely and guide them.
`;

    if (structuredMenu && structuredMenu.categories?.length > 0) {
      systemPrompt += `
OFFICIAL BUSINESS MENU (STRICT SOURCE OF TRUTH):
${JSON.stringify(structuredMenu, null, 2)}

CRITICAL RULES:
- Only recommend items that exist in the menu.
- Do NOT invent products.
- If item is unavailable, politely inform the user.
- Help navigate categories.
`;
    }

    const completion = await openai.chat.completions.create({
      model: "openai/gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
      temperature: 0.4,
    });

    return (
      completion.choices?.[0]?.message?.content ||
      "I'm here to help you! 😊"
    );
  } catch (error: any) {
    console.error("🔥 Bot Reply Error:", error?.response?.data || error);
    return "Sorry, our assistant is temporarily unavailable.";
  }
}

/* =====================================================
   GENERATE OR EDIT STRUCTURED MENU
===================================================== */
export async function generateStructuredMenu(
  description: string,
  existingMenu?: any
): Promise<any> {
  try {
    let prompt = `
You are a business analyst AI.

Your task:
Understand the business description carefully.
Extract categories and items professionally.

Return ONLY valid JSON in this exact format:

{
  "categories": [
    {
      "name": "Category Name",
      "items": ["Item 1", "Item 2"]
    }
  ]
}

Rules:
- No explanation
- No markdown
- No extra text
- Only JSON
`;

    if (existingMenu && existingMenu.categories?.length > 0) {
      prompt += `

IMPORTANT:
An existing menu already exists:

${JSON.stringify(existingMenu, null, 2)}

You must intelligently MODIFY the existing menu.

Rules for modification:
- Add new categories if mentioned
- Add new items if mentioned
- Do NOT remove existing items
- Do NOT duplicate items
- Preserve previous structure
`;
    }

    prompt += `

Business Description:
${description}
`;

    const completion = await openai.chat.completions.create({
      model: "openai/gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    });

    let raw = completion.choices?.[0]?.message?.content || "{}";

    console.log("🧠 RAW MENU RESPONSE:", raw);

    raw = raw.replace(/```json/g, "").replace(/```/g, "").trim();

    const jsonMatch = raw.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error("No valid JSON found");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (!parsed.categories || !Array.isArray(parsed.categories)) {
      throw new Error("Invalid JSON structure");
    }

    return parsed;
  } catch (error) {
    console.error("🔥 Structured Menu Error:", error);
    return existingMenu || { categories: [] };
  }
}
