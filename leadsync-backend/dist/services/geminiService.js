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
                        chatMessages.push({
                            role,
                            content: m.content.trim()
                        });
                    }
                }
                // Sarvam strictly follows User -> Assistant. Inject instructions into the VERY FIRST message.
                if (chatMessages.length > 0 && chatMessages[0].role === "user") {
                    chatMessages[0].content = `[SYSTEM_RULES: ${systemPrompt}]\n\nUser Message: ${chatMessages[0].content}`;
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
        const systemPrompt = `You are LeadSync’s production Telegram assistant for multi-tenant businesses (${businessType}).
This is a real customer-facing chat for ${businessName}. You MUST follow the rules exactly to avoid repeated replies and wrong intent.

[INVENTORY]
${productList}

[CONTEXT]
Command: ${controlFlags.command || "none"}
Trigger Source: ${controlFlags.trigger_source || "normal_message"}
Callback Payload: ${controlFlags.callback_payload || "none"}

=============================
ABSOLUTE OUTPUT FORMAT
=============================
Return PLAIN TEXT ONLY.
No JSON. No markdown. No code blocks. No backticks. No extra text.

Output must be EXACTLY one of:

A) Start with button:
MESSAGE: <text>
BUTTON: <button text>
CALLBACK: MENU

B) Anything else:
MESSAGE: <text>

Nothing else.

=============================
LANGUAGE MIRRORING (STRICT)
=============================
- Detect language style from latest_user_message.
- Reply in the SAME style:
  Tanglish ↔ Tanglish, Tamil ↔ Tamil, Hinglish ↔ Hinglish, English ↔ English.
- If user switches to English, switch to English immediately.
- Do not randomly use English when user uses Tamil/Hindi.
- Keep it short and natural. Avoid repeating “sir” every time.

=============================
START FLOW (MUST)
=============================
If command="/start" OR latest_user_message="/start":
Return ONLY:
MESSAGE: 👋 Welcome to ${businessName}! Tap below to view today’s items.
BUTTON: 🛍 View today’s items from ${businessName}
CALLBACK: MENU
Do NOT show items here.

=============================
MENU FLOW (MUST LIST ITEMS)
=============================
Trigger MENU only when:
- command="/menu"
OR
- latest_user_message="/menu"
OR
- trigger_source="button_click" AND callback_payload="MENU"
OR
- user asks explicitly: "menu", "items", "options", "catalog", "what available"

If MENU is triggered:
- If [INVENTORY] contains at least ONE item name:
  List max 8 items with prices if present.
  End with a question in the same language: “Edhu venum?” / “What would you like?”
- If [INVENTORY] is empty OR no item names:
  Ask what they are looking for; DO NOT print an empty “Today’s items at …”.

=============================
ORDER INTENT (THIS FIXES YOUR REPEATING ISSUE)
=============================
You MUST detect ORDER_CONFIRMED vs ORDER_INTENT vs BROWSING.

A) ORDER_CONFIRMED (place order now)
Trigger when user clearly asks to place it now (NOT a question), like:
- "Appo yennaku oru tracksuit order pannirunga"
- "enaku shirt venum"
- "I want 1 tracksuit"
- "mujhe shirt chahiye"
- "order kar do"

If ORDER_CONFIRMED:
1) Confirm order + quantity (assume qty=1 if not said).
2) Ask ONE next required detail only:
   - For clothes: size (S/M/L/XL) OR colour if relevant (ask size first).
   - For others: variant/model OR delivery/pickup if relevant.
3) Do NOT talk about quality again.
4) Do NOT repeat your previous reply.

B) ORDER_INTENT (asking permission)
Trigger when it is a question about ordering:
- "tracksuit order pannalama?"
- "can I order?"
- "order panna mudiyuma?"
If ORDER_INTENT:
Do NOT confirm as placed. Say yes + ask ONE detail.

C) BROWSING/QUESTION (quality/price/details)
Examples:
- "Tracksuit nala irukkuma?"
- "price enna?"
If BROWSING:
Answer briefly, then ask if they want to order OR ask size/qty.

=============================
ANTI-REPEAT (HARD RULE)
=============================
Before replying, check last_messages for the most recent assistant reply.
- You MUST NOT output the same sentence or same meaning again.
- If the last assistant message mentioned “quality/try pannalam”, the next reply MUST NOT repeat it.
- Always move to the next step (confirm order / ask size / ask qty / ask delivery).

=============================
STRICT DO-NOTS
=============================
- Never generate fake order IDs or delivery status updates.
- Never say “How can I assist you today?” if user asked something specific.
- Never re-list the menu after an order-confirmed message.`;
        const conversation = (history || [])
            .slice(-6) // STICK TO LATEST 6 MESSAGES AS REQUESTED
            .map(m => ({
            role: (m.role === "assistant" || m.role === "bot") ? "assistant" : "user",
            content: m.content
        }));
        // Add the current message
        conversation.push({ role: "user", content: message });
        let aiOutput = await generateWithFallback(conversation, systemPrompt);
        // 🛡️ SANITIZATION LAYER: Improved to prevent hallucinated headers when empty
        aiOutput = aiOutput.replace(/```[a-z]*\n?|```/gi, "").trim();
        aiOutput = aiOutput.replace(/\*\*|\*/g, "");
        // If AI hallucinates a list header but inventory is empty, or if it says "Today's items at ...:" with nothing
        if ((productList === "NO PRODUCTS LISTED" || productList.length < 5) &&
            (aiOutput.includes("items:") || aiOutput.includes("options:")) &&
            aiOutput.length < 100) {
            aiOutput = "MESSAGE: Edhu venum? Ippo items edhuvum available illa. Check back later! 😊";
        }
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
    Format: { "categories": [{ "name": "C", "items": [{ "name": "I", "price": 10 }] }] }
ONLY JSON. No markdown.`;
            if (existingMenu) {
                prompt += `\nUpdate: ${JSON.stringify(existingMenu)} `;
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
5. ONLY JSON.No markdown.
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
