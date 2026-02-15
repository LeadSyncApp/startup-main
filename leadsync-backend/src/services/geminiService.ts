import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

/* =====================================================
   GENERATE AI BOT REPLY (WITH ORDER DETECTION)
===================================================== */
export async function generateBotReply(
  message: string,
  businessType: string,
  structuredMenu?: any
): Promise<string> {
  try {
    let systemPrompt = `
You are a professional AI assistant working for a ${businessType} company.

You must follow STRICT rules.

GENERAL BEHAVIOR:
- Answer professionally and clearly
- Stay within business context
- Be friendly but concise
- Guide customers properly

ORDER DETECTION RULES:
If the user clearly wants to BUY, ORDER, PURCHASE or CONFIRM items from the menu,
you MUST return ONLY valid JSON in this EXACT format:

{
  "items": [
    { "name": "Exact Menu Item Name", "quantity": 1 }
  ]
}

STRICT JSON RULES:
- No explanation
- No markdown
- No extra text
- No comments
- Only JSON
- Item names must EXACTLY match the official menu
- If item not found, respond normally (not JSON)
`;

    if (structuredMenu && structuredMenu.categories?.length > 0) {
      systemPrompt += `
OFFICIAL BUSINESS MENU (SOURCE OF TRUTH):
${JSON.stringify(structuredMenu, null, 2)}

CRITICAL:
- Never invent products.
- Only use items from this menu.
- If item does not exist, respond normally.
`;
    }

    const completion = await openai.chat.completions.create({
      model: "openai/gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
      temperature: 0.2,
    });

    let reply =
      completion.choices?.[0]?.message?.content ||
      "I'm here to help you! 😊";

    reply = reply.replace(/```json/g, "").replace(/```/g, "").trim();

    return reply;

  } catch (error: any) {
    console.error("🔥 Bot Reply Error:", error?.response?.data || error);
    return "Sorry, our assistant is temporarily unavailable.";
  }
}

/* =====================================================
   GENERATE OR EDIT STRUCTURED MENU (WITH PRICES)
===================================================== */
export async function generateStructuredMenu(
  description: string,
  existingMenu?: any
): Promise<any> {
  try {
    let prompt = `
You are a business analyst AI.

Return ONLY valid JSON in this EXACT format:

{
  "categories": [
    {
      "name": "Category Name",
      "items": [
        { "name": "Item Name", "price": 100 }
      ]
    }
  ]
}

Rules:
- No explanation
- No markdown
- No extra text
- Only JSON
- Price must be a number
`;

    if (existingMenu && existingMenu.categories?.length > 0) {
      prompt += `

IMPORTANT:
Existing menu:

${JSON.stringify(existingMenu, null, 2)}

Rules:
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
      temperature: 0.2,
    });

    let raw = completion.choices?.[0]?.message?.content || "{}";

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
