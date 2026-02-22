"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateBotReply = generateBotReply;
exports.generateStructuredMenu = generateStructuredMenu;
exports.generateStructuredOrder = generateStructuredOrder;
const axios_1 = __importDefault(require("axios"));
const groq_sdk_1 = __importDefault(require("groq-sdk"));
// Initialize Groq
const groq = new groq_sdk_1.default({ apiKey: process.env.GROQ_API_KEY || "dummy" });
// Model Hierarchy: Sarvam for Multilingual, Groq for Speed
const MODELS = [
    { provider: "sarvam", id: "sarvam-m" }, // 🇮🇳 Best for Indian Languages
    { provider: "groq", id: "llama-3.3-70b-versatile" }, // 🔥 State-of-the-art fallback
];
async function withTimeout(promise, ms, label) {
    let timeoutId;
    const timeout = new Promise((_, reject) => timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms));
    try {
        const result = await Promise.race([promise, timeout]);
        clearTimeout(timeoutId);
        return result;
    }
    catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}
async function generateWithFallback(messages, systemPrompt) {
    let lastError;
    const useGroq = !!process.env.GROQ_API_KEY;
    const useSarvam = !!process.env.SARVAM_API_KEY;
    for (const model of MODELS) {
        if (model.provider === "groq" && !useGroq)
            continue;
        if (model.provider === "sarvam" && !useSarvam)
            continue;
        try {
            console.log(`🤖 [AI] Attempting ${model.provider.toUpperCase()}: ${model.id}...`);
            let content = "";
            const timeoutMs = 8000; // 8s timeout per model
            if (model.provider === "sarvam") {
                // Sarvam.ai is extremely strict: No "system" role, and roles MUST alternate (User -> Assistant -> User).
                const rawHistory = messages.filter(m => m.content && typeof m.content === 'string' && m.content.trim());
                const chatMessages = [];
                // Instruction
                const instructionPrefix = `[INSTRUCTION: ${systemPrompt}]\n\n`;
                for (let i = 0; i < rawHistory.length; i++) {
                    const m = rawHistory[i];
                    const role = (m.role === "assistant" || m.role === "bot") ? "assistant" : "user";
                    // Sarvam requires the first message to be from 'user'
                    if (chatMessages.length === 0 && role === "assistant")
                        continue;
                    // Safety: Only add if it alternates
                    if (chatMessages.length > 0 && chatMessages[chatMessages.length - 1].role === role) {
                        chatMessages[chatMessages.length - 1].content += "\n" + m.content.trim();
                    }
                    else {
                        const isLastUserMsg = i === rawHistory.length - 1 && role === "user";
                        chatMessages.push({
                            role,
                            content: isLastUserMsg ? instructionPrefix + m.content.trim() : m.content.trim()
                        });
                    }
                }
                // Final safety: If still empty (unlikely) or ends with assistant, ensure it's valid for chat completion
                if (chatMessages.length === 0) {
                    chatMessages.push({ role: "user", content: instructionPrefix + "Hello" });
                }
                else if (chatMessages[chatMessages.length - 1].role === "assistant") {
                    chatMessages.push({ role: "user", content: "Please continue according to the instructions." });
                }
                try {
                    const response = await withTimeout(axios_1.default.post("https://api.sarvam.ai/v1/chat/completions", {
                        model: model.id,
                        messages: chatMessages,
                        temperature: 0.1
                    }, {
                        headers: {
                            "api-subscription-key": process.env.SARVAM_API_KEY,
                            "Content-Type": "application/json"
                        }
                    }), timeoutMs, `Sarvam ${model.id}`);
                    content = response.data?.choices?.[0]?.message?.content || "";
                }
                catch (axiosError) {
                    const detail = axiosError.response?.data?.error?.message || axiosError.response?.data || axiosError.message;
                    console.error(`❌ Sarvam API Error Detail:`, detail);
                    throw axiosError;
                }
            }
            else if (model.provider === "groq") {
                const completion = await withTimeout(groq.chat.completions.create({
                    messages: [
                        { role: "system", content: systemPrompt },
                        ...messages.filter(m => m.content && m.content.trim())
                    ],
                    model: model.id,
                    max_tokens: 400 // Increased for large content
                }), timeoutMs, `Groq ${model.id}`);
                content = completion.choices[0]?.message?.content || "";
            }
            if (content.trim()) {
                console.log(`✅ [AI] Success with ${model.id}`);
                return content.trim();
            }
        }
        catch (err) {
            console.error(`⚠️ [AI] ${model.id} failed: ${err.message}`);
            lastError = err;
        }
    }
    throw lastError || new Error("All AI models failed");
}
async function generateBotReply(message, businessName, businessType, structuredMenu, history, orderHistory, customerProfile, inputModality = "text", controlFlags = { force_mode: "AUTO", menu_allowed: true, history_allowed: true }, detectedLanguage = "en-IN") {
    try {
        const businessTypeLower = (businessType || "business").toLowerCase();
        const { force_mode = "AUTO", menu_allowed = true, history_allowed = true, pendingOrder } = controlFlags;
        // Detect hard language code for enforcement
        let hardLanguageRule = "";
        if (detectedLanguage.startsWith("ta"))
            hardLanguageRule = "STYLE: The user is using TAMIL/TANGLISH. You MUST reply in TANGLISH (Tamil written in English letters). Mix Tamil and English naturally.";
        else if (detectedLanguage.startsWith("hi"))
            hardLanguageRule = "STYLE: The user is using HINDI/HINGLISH. You MUST reply in HINGLISH. Mix Hindi and English naturally.";
        else if (detectedLanguage.startsWith("en"))
            hardLanguageRule = "STYLE: You MUST reply in friendly, professional ENGLISH.";
        // 🏷️ Format Product List
        let productList = "NO PRODUCTS LISTED";
        if (structuredMenu?.categories?.length > 0) {
            productList = structuredMenu.categories
                .map((cat) => `--- ${cat.name.toUpperCase()} ---\n` +
                cat.items.map((i) => `- ${i.name}: ₹${i.price}${i.description ? ' (' + i.description + ')' : ''}`).join("\n"))
                .join("\n\n");
        }
        // 📜 Format Order History
        let formattedOrderHistory = "No previous order history.";
        if (orderHistory && orderHistory.length > 0) {
            formattedOrderHistory = orderHistory
                .map(o => `- ${o.summary} (Total: ₹${o.amount}) on ${new Date(o.createdAt).toLocaleDateString()}`)
                .join("\n");
        }
        // 👤 Format Customer Profile
        const profileText = customerProfile ? `
Name: ${customerProfile.name || "Unknown"}
Phone: ${customerProfile.contact || "Unknown"}
Address: ${customerProfile.address || "Not provided"}
Tags: ${customerProfile.tags || "None"}
`.trim() : "New Customer";
        // 🛒 Current Draft Order
        const currentDraft = pendingOrder
            ? `CURRENT DRAFT: ${pendingOrder.summary} (Total: ₹${pendingOrder.amount}).`
            : "No items currently being ordered.";
        const systemPrompt = `[INVENTORY]
${productList}

====================================
ABSOLUTE OUTPUT FORMAT
====================================
Return PLAIN TEXT ONLY. NO MARKDOWN (**bold**, etc). NO JSON.
Format MUST be:
MESSAGE: <reply text>
BUTTON: <label text (optional)>
CALLBACK: <payload (optional)>

====================================
1. START FLOW (/start command)
====================================
If command="/start" or latest_user_message="/start":
OUTPUT ONLY THIS:
MESSAGE: 👋 Welcome to ${businessName}! I can help you browse items, check prices, and place an order. Tap below to see what we have today.
BUTTON: 🛍 View today’s items from ${businessName}
CALLBACK: MENU

CRITICAL: DO NOT show items from [INVENTORY] here.

====================================
2. MENU FLOW (/menu or MENU button)
====================================
If command="/menu" or latest_user_message="/menu" or callback_payload="MENU" or user asks for items:
MESSAGE: Here is what we have today:
${productList}
Edhu venum? (or match user language)

====================================
3. ORDERING & CHAT
====================================
- ORDER_CONFIRMED (e.g., "venum", "pack it"): Confirm briefly + ask ONE missing detail (size/qty).
- ORDER_INTENT (e.g., "available?", "can I order?"): Say yes + ask ONE detail.
- BROWSING: Answer natural (+ "Order place pannikidava?").
- LANGUAGE: Mirror user (Tamil/Hinglish/Tanglish).
- Concise: 1-2 lines. No repetition. Move forward.
`;
        const conversation = (history || []).map(m => ({
            role: m.role,
            content: m.content
        }));
        conversation.push({ role: "user", content: message });
        let aiOutput = await generateWithFallback(conversation, systemPrompt);
        // 🛡️ SANITIZATION LAYER: Ensure we return the raw output for the adapter to parse
        aiOutput = aiOutput.replace(/```[a-z]*\n?|```/gi, "").trim();
        // Strip common markdown bold/italic markers that AI often adds despite rules
        aiOutput = aiOutput.replace(/\*\*|\*/g, "");
        // Since the format is now MESSAGE: / BUTTON: / CALLBACK:, we return it as is.
        // However, if the AI output doesn't start with MESSAGE:, we wrap it for safety.
        if (!aiOutput.includes("MESSAGE:")) {
            aiOutput = "MESSAGE: " + aiOutput;
        }
        return aiOutput;
    }
    catch (error) {
        console.error("❌ Bot Reply Fatal Error:", error);
        if (inputModality === "text") {
            return "I'm sorry, I'm having trouble right now. Our team will help you soon!";
        }
        return JSON.stringify({
            response_text: "I am sorry, I am having trouble right now. Our team will help you soon.",
            allow_voice_choice: true
        });
    }
}
async function generateStructuredMenu(description, existingMenu) {
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
        }
        catch (e) {
            console.error("Groq JSON generation failed, falling back...");
        }
    }
    // Fallback logic for original simple object return
    return existingMenu || { categories: [] };
}
async function generateStructuredOrder(text, menu) {
    if (!process.env.GROQ_API_KEY)
        return { items: [] };
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
    }
    catch (e) {
        console.error("❌ AI Order Extraction Failed:", e);
        return { items: [] };
    }
}
