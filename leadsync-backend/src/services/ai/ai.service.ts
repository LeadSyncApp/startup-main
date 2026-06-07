import axios from "axios";
import Groq from "groq-sdk";
import { GoogleGenAI } from "@google/genai";
import { safeJsonParse, sanitizeReply, getMenuSnapshot, calculateRetrieval } from "../../utils/shop-ai.utils";

// Initialize Groq
let groqClient: Groq | null = null;
function getGroqClient(): Groq {
  if (!groqClient) {
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groqClient;
}

// Initialize Gemini
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!geminiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (key) {
      geminiClient = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    }
  }
  return geminiClient;
}

// Model Hierarchy: Groq for Speed (Primary) - Sarvam only for STT/TTS/Lang Detection
const MODELS = [
  { provider: "groq", id: "llama-3.3-70b-versatile" },
  { provider: "groq", id: "llama-3.1-8b-instant" }, // 🔥 Faster Fallback
  { provider: "gemini", id: "gemini-2.5-flash" } // 🌟 Robust Gemini Grounding Fallback
];

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutId: any;
  const timeout = new Promise<T>((_, reject) =>
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
  );
  try {
    const result = await Promise.race([promise, timeout]);
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function generateWithFallback(
  messages: any[],
  systemPrompt: string,
  options: { isJson?: boolean; tools?: any[] } = {}
): Promise<{ content: string; toolCalls?: any[] }> {
  let lastError;
  const useGroq = !!process.env.GROQ_API_KEY;

  for (const model of MODELS) {
    if (model.provider === "groq" && !useGroq) continue;

    try {
      console.log(`🤖 [AI] Attempting ${model.provider.toUpperCase()}: ${model.id}...${options.tools ? ' (with tools)' : ''}`);

      const timeoutMs = 20000;

      if (model.provider === "groq") {
        const groqApi = getGroqClient();
        const completion: any = await withTimeout(
          groqApi.chat.completions.create({
            messages: [
              { role: "system", content: systemPrompt },
              ...messages.filter(m => m.content && m.content.trim())
            ],
            model: model.id,
            max_tokens: 600,
            response_format: options.isJson ? { type: "json_object" } : undefined,
            tools: options.tools,
            tool_choice: options.tools ? "auto" : undefined
          }),
          timeoutMs,
          `Groq ${model.id}`
        );
        const choice = completion.choices[0]?.message;
        if (choice) {
          console.log(`✅ [AI] Success with ${model.id}`);
          
          let content = choice.content || "";
          let toolCalls = choice.tool_calls || [];

          // Handle Llama 3 on Groq sporadically outputting tool calls as <function=NAME>ARGS</function> or <tool_call>...
          const functionRegex = /<(?:function|tool_call)=?(\w+)?>([\s\S]*?)<\/(?:function|tool_call)>/g;
          let match;
          while ((match = functionRegex.exec(content)) !== null) {
            const funcName = match[1] || 'update_cart'; // default to update_cart if not captured in tool_call pattern
            const funcArgs = match[2];
            toolCalls.push({
              function: {
                name: funcName,
                arguments: funcArgs
              }
            });
          }
          // Strip the function tags from the visible content
          content = content.replace(/<(?:function|tool_call)[^>]*>[\s\S]*?<\/(?:function|tool_call)>/g, "").trim();

          return {
            content,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined
          };
        }
      } else if (model.provider === "gemini") {
        const client = getGeminiClient();
        if (client) {
          const mappedContents = messages
            .filter(m => m.content && m.content.trim())
            .map(m => ({
              role: m.role === "assistant" || m.role === "model" ? "model" : "user",
              parts: [{ text: m.content }]
            }));
            
          // In basic fallback map Gemini tools if provided
          let geminiTools: any[] | undefined = undefined;
          if (options.tools) {
            geminiTools = options.tools.map((t: any) => ({
              functionDeclarations: [{
                name: t.function.name,
                description: t.function.description,
                parameters: t.function.parameters
              }]
            }));
          }

          const response: any = await withTimeout(
            client.models.generateContent({
              model: model.id,
              contents: mappedContents,
              config: {
                systemInstruction: systemPrompt,
                tools: geminiTools,
                responseMimeType: options.isJson ? "application/json" : undefined,
              }
            }),
            timeoutMs,
            `Gemini ${model.id}`
          );
          
          let toolCalls = undefined;
          if (response.functionCalls && response.functionCalls.length > 0) {
            toolCalls = response.functionCalls.map((fc: any) => ({
              function: {
                name: fc.name,
                arguments: JSON.stringify(fc.args)
              }
            }));
          }

          if (response.text || toolCalls) {
            console.log(`✅ [AI] Success with ${model.id}`);
            return {
              content: response.text || "",
              toolCalls
            };
          }
        } else {
          console.log("⚠️ Gemini Client not initialized (missing GEMINI_API_KEY)");
          if (!lastError) lastError = new Error("Gemini Client not initialized - missing API Key.");
        }
      }
    } catch (err: any) {
      console.error(`⚠️ [AI] ${model.id} failed:`, err.message || err);
      if (model.provider !== "gemini" || !lastError) {
        lastError = err;
      }
    }
  }
  throw lastError || new Error("All AI models failed");
}

/* ──────────────────────────────────────────────────────────────
   AGENT ASSIST: suggest a human-like reply given recent context
   ────────────────────────────────────────────────────────────── */
export async function generateAgentSuggestion(
  recentMessages: { sender: string; content: string }[],
  businessName: string,
  language: string = "English"
): Promise<string> {
  const history = recentMessages
    .slice(-10) // last 10 messages
    .map(m => ({
      role: m.sender === "CLIENT" ? "user" as const : "assistant" as const,
      content: m.content,
    }));

  const systemPrompt = `You are a helpful customer support agent for "${businessName}".
Your task: write ONE short, warm, professional reply to the customer's last message.
Language: ${language}.
Rules:
- Maximum 2 sentences. Be friendly and helpful.
- Do NOT use markdown, emojis, or bullet points.
- Do NOT repeat what the customer said.
- Reply in plain text only.
Return ONLY the reply text. No preamble, no labels.`;

  const result = await generateWithFallback(history, systemPrompt, { isJson: false });
  return result.content || "";
}

/* ──────────────────────────────────────────────────────────────
   CONVERSATION SUMMARY: 2–3 sentence TL;DR of a conversation
   ────────────────────────────────────────────────────────────── */
export async function generateConversationSummary(
  messages: { sender: string; content: string }[],
  businessName: string
): Promise<string> {
  if (messages.length < 3) return "";
  const transcript = messages
    .slice(-30) // last 30 messages
    .map(m => `${m.sender === "CLIENT" ? "Customer" : "Agent"}: ${m.content}`)
    .join("\n");

  const systemPrompt = `You are a CRM assistant for "${businessName}". 
Summarize the following conversation in 2–3 short sentences for an agent who is reading it for the first time.
Focus on: what the customer wanted, what was resolved or pending, and any important details (product, amount, issue).
Be concise and factual. Plain text only. No markdown.`;

  const result = await generateWithFallback(
    [{ role: "user" as const, content: transcript }],
    systemPrompt,
    { isJson: false }
  );
  return result.content || "";
}

export async function generateLearnedContext(
  knowledgeBase: string
): Promise<string> {
  if (!process.env.GROQ_API_KEY) return knowledgeBase;
  try {
    const prompt = `You are a knowledge extraction AI.
The user provided these notes/descriptions about their shop items:
"${knowledgeBase}"

Your task:
1. Extract key characteristics, selling points, or specific details for the items mentioned.
2. Structure it as a concise, bulleted guide that a shop assistant can use to answer customer questions.
3. Keep it plain text. No markdown formatting.
4. If there are suggestions (e.g., "suggest X for Y"), include them.

OUTPUT ONLY THE SUMMARY. NO PREAMBLE.`;

    const groqApi = getGroqClient();
    const completion = await groqApi.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
    });
    return completion.choices[0]?.message?.content || "";
  } catch (e) {
    console.error("Knowledge extraction failed:", e);
    return knowledgeBase;
  }
}


export async function generateCustomCommandReply(
  baseReply: string,
  ownerInstruction: string,
  customerName: string,
  businessName: string,
  language: string
): Promise<string> {
  const prompt = `You are an AI generating dynamic Telegram bot command outputs.
A shop owner ('${businessName}') wishes to modify the standard bot response for a command.

STARTING SKETCH (The current version of the response):
"""
${baseReply}
"""

THE OWNER'S NEW INSTRUCTION:
"${ownerInstruction}"

Your task is to take the STARTING SKETCH and apply the NEW INSTRUCTION to it.

CRITICAL STATEFUL RULES:
1. ADDITIVE MODIFICATION: Treat the STARTING SKETCH as the current production version. Your instructions MUST be applied AS AN UPDATE to this sketch. 
   - If the sketch has buttons [A, B] and the instruction is "add button C", the result MUST be [A, B, C].
   - If the instruction is "remove button A", then and only then should A be removed.
   - NEVER drop a custom button (like "Shop Info" or "View Catalog") just because it isn't mentioned in the new instruction.
2. MANDATORY PRESERVATION: Foundations (View Menu, Select Language) are usually permanent. Preserve them unless explicitly told to "remove all buttons".
3. PLACEHOLDER RULE: Use "{name}" for the customer's name.
4. BUTTON MAPPINGS: 
   - Catalog/Menu -> CALLBACK: VIEW_MENU
   - Human Support -> CALLBACK: CUSTOM_HANDOFF
   - Custom info/discounts -> Descriptive lowercase slug (e.g., today_discount)

Format:
MESSAGE: <text>
BUTTON: <label>
CALLBACK: <trigger>

OUTPUT ONLY THE RESULT. No code blocks. No explanations. Output in ${language === 'ta-IN' ? 'Tamil' : language === 'hi-IN' ? 'Hindi' : 'English'}.`;

  try {
    const aiResult = await generateWithFallback([{ role: "user", content: prompt }], "", { isJson: false });
    if (aiResult && aiResult.content && aiResult.content.trim()) {
      return aiResult.content.trim();
    }
    return baseReply;
  } catch (error) {
    console.error("❌ generateCustomCommandReply failed:", error);
    // Graceful fallback to avoid leaving the bot typing on failure:
    // Append the custom instruction text to baseReply
    return `${baseReply}\n\n(Note: ${ownerInstruction})`;
  }
}

export async function generateShopReply(input: {
  tenant_id: string;
  user_message: string;
  detected_language: string;
  session_state: any;
  retrieved_items: any[];
  learned_knowledge_text: string;
  learned_knowledge_structured?: any;
  menu_snapshot: any;
  shop_policies?: string;
  order_history?: any[];
  latest_order_status?: string | null;
  modality?: "text" | "voice";
  bot_commands?: any[];
  active_order?: any;
}): Promise<{
  replyText: string;
  stateUpdates: any;
  orderFinalized?: boolean;
  cartCleared?: boolean;
  humanHandoffRequested?: boolean;
}> {
  try {
    let commandsProfile = "";
    if (input.bot_commands && input.bot_commands.length > 0) {
      commandsProfile = `\n\n# CURRENT BOT SLASH COMMANDS PROFILE
The merchant has registered the following custom slash commands and custom reply templates for the Telegram bot:
${input.bot_commands.map((c: any) => `- Command: /${c.command}\n  Description: ${c.description}\n  Target Action: ${c.action || "none"}${c.customReplyText ? `\n  Defined Merchant Reply Context: "${c.customReplyText}"` : ""}`).join("\n")}
Ensure your chat replies respect these customized command replies and rules.`;
    }

    const systemPrompt = `You are an AI Shop Assistant for a merchant (multi-tenant). Your role is to converse naturally and manage the customer's intent using function calls.
HARD RULES:
1) Use ONLY provided shop data: retrieved_items, learned_knowledge_text, menu_snapshot, shop_policies. ${commandsProfile}
2) Never invent items or details. 
3) LANGUAGE MIRRORING (CRITICAL): Exactly match the user's language (Tamil, Hindi, English).
4) CART MANAGEMENT (CRITICAL):
   - ONLY add items to cart if they exist in the menu_snapshot.
   - You MUST call the 'update_cart' tool when the customer adds, removes, or modifies items they want to buy.
   - If the customer seeks to change, add, or remove items from their Active/Pending Order, base your modifications on the items in that Active/Pending Order and call 'update_cart' with the updated complete list of items they want to buy.
   - If they ask to clear cart, call 'clear_cart'.
   - If they confirm the order/say checkout, call 'confirm_checkout'.
   - If they explicitly ask for a human or to talk to an agent, call 'request_human_agent'.
5) Output conversational text for the customer. If you call a tool, your text should explain what you did (e.g., "I've added the items to your cart.").`;

    const userPrompt = `
Input Payload:
Message: "${input.user_message}"
Current Cart: ${JSON.stringify(input.session_state.cart || {items: [], total: 0})}
Menu Retrieved Context (Top Queries Matches): ${JSON.stringify(input.retrieved_items)}
Full Menu Snapshot (All Available Merchant Items): ${JSON.stringify(input.menu_snapshot)}
Knowledge Base: ${input.learned_knowledge_text}
Policies: ${input.shop_policies}
${input.active_order ? `Active/Pending Order: ${JSON.stringify({ id: input.active_order.id, items: input.active_order.items || [], status: input.active_order.status })}` : ""}
`;

    const tools = [
      {
        type: "function",
        function: {
          name: "update_cart",
          description: "Update the customer's cart. Always provide the full list of ALL items they currently intend to purchase.",
          parameters: {
            type: "object",
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string", description: "Exact name from the menu" },
                    quantity: { type: "number", description: "Quantity" },
                    price: { type: "number", description: "Item unit price (provide the post-discount/promotional unit price if any special offer, discount, or custom command rule applies to this item)" }
                  },
                  required: ["name", "quantity", "price"]
                }
              }
            },
            required: ["items"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "clear_cart",
          description: "Empty the customer's cart.",
          parameters: { type: "object", properties: {} }
        }
      },
      {
        type: "function",
        function: {
          name: "confirm_checkout",
          description: "Customer confirms they want to place the order with current cart items.",
          parameters: { type: "object", properties: {} }
        }
      },
      {
        type: "function",
        function: {
          name: "request_human_agent",
          description: "Customer explicitly asks to talk to a human.",
          parameters: { type: "object", properties: {} }
        }
      }
    ];

    const messages = [{ role: "user" as const, content: userPrompt }];
    const result = await generateWithFallback(messages, systemPrompt, { isJson: false, tools });
    
    let orderFinalized = false;
    let cartCleared = false;
    let humanHandoffRequested = false;
    let stateUpdates = JSON.parse(JSON.stringify(input.session_state));
    let replyText = sanitizeReply(result.content || "How can I help you today?");

    // Process Tool Calls
    if (result.toolCalls && result.toolCalls.length > 0) {
      console.log(`📡 [AI] Tool Calls detected:`, JSON.stringify(result.toolCalls));
      for (const call of result.toolCalls) {
        if (call.function.name === 'update_cart') {
          try {
            const args = JSON.parse(call.function.arguments);
            if (args.items) {
              // Map of normalized menu names to prices to prevent AI price hallucinating/lowering
              const menuPrices = new Map<string, number>();
              if (input.menu_snapshot && Array.isArray(input.menu_snapshot.categories)) {
                input.menu_snapshot.categories.forEach((cat: any) => {
                  if (Array.isArray(cat.items)) {
                    cat.items.forEach((item: any) => {
                      if (item.name) {
                        menuPrices.set(item.name.toLowerCase().trim(), item.price);
                      }
                    });
                  }
                });
              }

              let total = 0;
              const updatedItems = args.items
                .filter((i: any) => typeof i.quantity === 'number' && i.quantity > 0)
                .map((i: any) => {
                  const normalizedName = i.name ? i.name.toLowerCase().trim() : "";
                  
                  // Find original menu price for validation
                  let menuPrice = menuPrices.get(normalizedName) ?? null;
                  if (menuPrice === null) {
                    // Fuzzy match
                    for (const [menuName, price] of menuPrices.entries()) {
                      if (normalizedName.includes(menuName) || menuName.includes(normalizedName)) {
                        menuPrice = price;
                        break;
                      }
                    }
                  }

                  let actualPrice = i.price; // fallback if not found
                  
                  // If menu price is found, validate the AI-supplied price
                  if (menuPrice !== null) {
                    // Check if AI's supplied price is a valid price (positive and <= original menu price, allowing for legitimate promotions)
                    if (typeof i.price !== 'number' || i.price <= 0 || i.price > menuPrice) {
                      actualPrice = menuPrice;
                    }
                  }

                  const sub = i.quantity * actualPrice;
                  total += sub;
                  return { 
                    ...i, 
                    price: actualPrice,
                    subtotal: sub 
                  };
                });
              stateUpdates.cart = { items: updatedItems, total };
            }
          } catch (err) {
            console.error("❌ Failed to parse update_cart args:", err);
          }
        } else if (call.function.name === 'clear_cart') {
          cartCleared = true;
          stateUpdates.cart = { items: [], total: 0 };
        } else if (call.function.name === 'confirm_checkout') {
          orderFinalized = true;
        } else if (call.function.name === 'request_human_agent') {
           humanHandoffRequested = true;
        }
      }
    }

    return {
      replyText: replyText,
      stateUpdates: stateUpdates,
      orderFinalized,
      cartCleared,
      humanHandoffRequested
    };

  } catch (error) {
    console.error("❌ generateShopReply error:", error);
    return {
      replyText: "I'm sorry, I encountered an error linking to our system. Please try again.",
      stateUpdates: input.session_state
    };
  }
}

/**
 * @deprecated Use generateShopReply for Phase 1
 */
export async function generateBotReply(
  message: string,
  businessName: string,
  businessType: string,
  structuredMenu?: any,
  history?: any[],
  orderHistory?: any[],
  customerProfile?: any,
  inputModality: "text" | "voice" = "text",
  controlFlags: any = {},
  detectedLanguage: string = "en-IN"
): Promise<string> {
  // Simple wrapper for compatibility during migration
  // Simple wrapper for compatibility during migration

  // We don't have tenant_id/chat_id here easily without changing signature drastically
  // but for Phase 1, the handleBotMessage will call generateShopReply directly.
  // This is kept for any other parts of code that might still call it.

  const menuSnapshot = getMenuSnapshot(structuredMenu);
  const retrieved = calculateRetrieval(message, menuSnapshot);

  const result = await generateShopReply({
    tenant_id: "default",
    user_message: message,
    detected_language: detectedLanguage,
    session_state: { last_category: null, last_item_names: [], preferences: {} },
    retrieved_items: retrieved,
    learned_knowledge_text: controlFlags.botLearnedContext || "",
    menu_snapshot: menuSnapshot,
  });

  return result.replyText;
}

export async function generateStructuredMenu(
  description: string,
  existingMenu?: any
): Promise<any> {
  if (process.env.GROQ_API_KEY) {
    try {
      let prompt = `You are a Commerce AI Normalizer. Take the following raw text from a merchant and extract a structured JSON menu.
      
Rules:
1. Group items into logical, specific and type-correct 'categories' (e.g., "Pizza", "Beverages", "Appetizers" or "Clothing"). Avoid lazy/generic category names like "Food" if a more specific category like "Pizza" or "Biryani" is indicated by the product names.
2. Extract 'name' (string) and 'price' (number). Use INR as default currency.
3. If price is missing, set it to 0.
4. Normalize names: Title Case, remove extra symbols.
5. Optionally extract 'stock' (number) if specified in the text (e.g., "Veg Pizza - 200 (Qty: 25)" or "Burger - 150 [Stock: 50]"). If no stock is specified in the text, default to 999.
6. If current items are provided, merge them logically, preferring the new raw input data.
7. Return ONLY a valid JSON object.

Format:
{
  "categories": [
    {
      "name": "Category Name",
      "items": [
        { "name": "Item Name", "price": 100, "stock": 50 }
      ]
    }
  ]
}

Raw Input: "${description}"`;

      if (existingMenu) {
        prompt += `\nExisting Menu to merge/update: ${JSON.stringify(existingMenu)}`;
      }

      const groqApi = getGroqClient();
      const completion = await groqApi.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama-3.3-70b-versatile",
        temperature: 0.1,
        response_format: { type: "json_object" }
      });
      return JSON.parse(completion.choices[0]?.message?.content || "{}");
    } catch (e) {
      console.error("Groq Normalizer failed:", e);
    }
  }
  return existingMenu || { categories: [] };
}

export async function generateStructuredOrder(
  text: string,
  menu: any,
  products?: any[]
): Promise<{ items: { name: string; quantity: number; price?: number }[] }> {
  if (!process.env.GROQ_API_KEY) return { items: [] };
  try {
    const productsContext = products && products.length > 0 
      ? products.map(p => `- ID: ${p.id} | Name: ${p.name} | Price: ${p.price}`).join("\n")
      : JSON.stringify(menu?.categories || []);

    const prompt = `Extract order from customer message: "${text}".
    
CRITICAL: You are a "Strict Compliance" Order Extraction AI. You MUST ONLY extract items that are EXACTLY or logically equivalent to items in the Master Catalog below.

MASTER CATALOG:
${productsContext}

RULES FOR DISAMBIGUATION:
1. AMBIGUITY (CRITICAL): If a customer requests a generic item (e.g., "Pizza") and multiple items in the catalog match (e.g., "Veg Pizza", "Chicken Pizza"), DO NOT extract any item. Return an empty "items" array.
2. NO GUESSING: Never pick a specific item if the user was generic. 
3. EXCLUSIVITY: If an item is NOT in the Master Catalog (e.g. "Samosa" when not listed), IGNORE IT COMPLETELY.
4. Return a JSON object with an "items" array.
5. Each item must have: "name" (EXACT name from the catalog), "quantity" (number), and "price" (from the catalog).

Return ONLY valid JSON: { "items": [{ "name": "Exact Product Name", "quantity": 1, "price": 10 }] }. If the input is ambiguous or contains no catalog items, return { "items": [] }.`;

    const groqApi = getGroqClient();
    const completion = await groqApi.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      temperature: 0, // Set to 0 for maximum strictness
      response_format: { type: "json_object" }
    });
    
    const result = JSON.parse(completion.choices[0]?.message?.content || "{}");
    
    // Additional validation: Double-check AI output against actual products
    if (products && products.length > 0 && result.items) {
      const validItems = result.items.filter((item: any) => {
        const found = products.find(p => p.name.toLowerCase() === item.name.toLowerCase());
        if (!found) {
            console.log(`🚫 [AI-GUARD] AI Hallucinated item "${item.name}". Skipping.`);
        }
        return !!found;
      });
      result.items = validItems;
    }
    
    return result;
  } catch (e) {
    console.error("❌ generateStructuredOrder failed:", e);
    return { items: [] };
  }
}

export async function generateSuggestedBotCommands(
  businessDescription: string,
  businessName: string
): Promise<{ commands: any[]; optimizedDescription?: string }> {
  const prompt = `You are a Commerce AI Expert setting up Telegram Bots for new boutique merchants.
The merchant owns a shop called "${businessName}" and described their business as follows:
"${businessDescription}"

Your tasks:
1. OPTIMIZE the business description: Rewrite their raw shop description into an elegant, clear, professional elevator pitch/profile that summarizes exactly what they do, their key offerings, and special notes. Keep it concise (2-3 sentences max).
2. GENERATE a set of 3 to 5 customized Telegram Bot Commands tailored perfectly to this business.
   Each command should have:
   - "command": (lowercase, alphanumeric, underscores allowed only, 1-32 chars max, e.g. "start", "menu", "hours", "specials", "support")
   - "description": (clear, highly descriptive human menu description, e.g. "Discover our freshly baked dessert selections")
   - "action": Must be exactly one of: "start", "view_menu", "transfer_human", "clear_cart", or "none".
   - "customReplyText": (the customized prompt instructions for the AI bot when a customer triggers this command. Explain what the bot should focus on, the promotional tone, and button triggers relevant to this specific command and shop. Maximum 1-2 powerful sentences).
   - "behaviorMode": Either "append" (keep default logic and append custom text) or "override" (replaces default logic and outputs custom text). Defaults/preferred to "append" for standard commands.

You MUST follow these action mappings strictly matching the business context:
- The command "start" must have action: "start". The customReplyText should welcome them with appropriate industry greeting.
- Any menu/catalog command (e.g. "menu" or "catalog") must have action: "view_menu".
- Any help/support/human support commands (e.g. "support" or "help") must have action: "transfer_human".
- Any other custom commands (e.g. "specials", "hours", "delivery") must have action: "none", behaving as custom smart replies.

Provide your response in VALID JSON only. Do not wrap in markdown blocks, do not explain.

Expected JSON output format:
{
  "optimizedDescription": "Professional updated elevator pitch profile",
  "commands": [
    {
      "command": "start",
      "description": "Start Le Petit Assistant",
      "action": "start",
      "customReplyText": "Welcome guest to Le Petit with warm French hospitality! Mention that our croissants are baked fresh daily, and suggest using '/menu' or button below.",
      "behaviorMode": "append"
    }
  ]
}`;

  try {
    const raw = await generateWithFallback([], prompt, { isJson: true });
    // Strip markdown code fences if any returned from fallback
    const cleanRaw = raw.content.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleanRaw);
    return {
      optimizedDescription: parsed.optimizedDescription,
      commands: Array.isArray(parsed.commands) ? parsed.commands : []
    };
  } catch (error) {
    console.error("Failed to parse suggested commands:", error);
    return {
      optimizedDescription: businessDescription,
      commands: [
        { command: "start", description: "Start the bot", action: "start", customReplyText: `Welcome to ${businessName}! How can we assist you today?`, behaviorMode: "append" },
        { command: "menu", description: "Explore our menu catalog", action: "view_menu", customReplyText: "Check out our latest categories and catalog offerings!", behaviorMode: "append" },
        { command: "help", description: "Talk to a human representative", action: "transfer_human", customReplyText: "An agent has been requested. We will respond shortly.", behaviorMode: "append" }
      ]
    };
  }
}

