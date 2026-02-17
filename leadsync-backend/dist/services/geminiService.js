"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateBotReply = generateBotReply;
exports.generateStructuredMenu = generateStructuredMenu;
const openai_1 = __importDefault(require("openai"));
const openai = new openai_1.default({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
});
async function generateBotReply(message, businessType, structuredMenu) {
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
                .map((cat) => `\n${cat.name}:\n` +
                cat.items
                    .map((i) => `- ${i.name} (₹${i.price})`)
                    .join("\n"))
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
        return (completion.choices?.[0]?.message?.content ||
            "Our team will assist you shortly.");
    }
    catch (error) {
        console.error("Bot Reply Error:", error);
        return "Our assistant is temporarily unavailable.";
    }
}
async function generateStructuredMenu(description, existingMenu) {
    try {
        let prompt = `
Generate a clean structured product menu with pricing.

Return ONLY valid JSON without markdown formatting:
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
        if (existingMenu) {
            prompt += `\n\nExisting Menu to Update/Reference:\n${JSON.stringify(existingMenu)}\n\nIMPORTANT: Maintain the same structure. Update prices or items if requested in the description, otherwise keep existing items.`;
        }
        const completion = await openai.chat.completions.create({
            model: "openai/gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.2,
        });
        let raw = completion.choices?.[0]?.message?.content || "{}";
        // Clean potential markdown code blocks
        raw = raw.replace(/```json/g, "").replace(/```/g, "").trim();
        return JSON.parse(raw);
    }
    catch (error) {
        console.error("Structured Menu Error:", error);
        return existingMenu || { categories: [] };
    }
}
