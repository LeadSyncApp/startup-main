/**
 * Provider audit: exercises Groq and Sarvam exactly as they run in production.
 *
 * Paths tested:
 *   1) Rule generation  → Groq llama-3.3-70b-versatile  (ruleGenerator.service.ts)
 *   2) AI chat reply     → Groq llama-3.3-70b-versatile  (ai.service.ts generateShopReply)
 *   3) Language detection → Sarvam LID + Unicode fallback (languageDetection.service.ts)
 *   4) Translation       → Sarvam Translate              (translation.service.ts)
 *
 * Logs provider, response time, usable? (yes/no), and any errors for every test.
 */
import { RuleGeneratorService } from "../../src/services/automation/ruleGenerator.service";
import { generateShopReply } from "../../src/services/ai/ai.service";
import { detectLanguage } from "../../src/services/ai/languageDetection.service";
import { callSarvamTranslate } from "../../src/services/ai/translation.service";
import { prisma } from "../../src/lib/prisma";
import { tenantContextStorage, resolveTenantContext } from "../../src/services/context/tenantContext.provider";
import { withTestCompany } from "./testCompanyFactory";

const ruleGen = new RuleGeneratorService();

// ------------------------------------------------------------------------
// TEST SET 1: Shop-owner rule-generation prompts
// ------------------------------------------------------------------------
const RULE_PROMPTS = [
  // --- Clear English ---
  { label: "CLEAR-1: biryani offer",       prompt: "When a customer asks about chicken biryani, tell them we have special chicken biryani at Rs.199", lang: "en" },
  { label: "CLEAR-2: delivery time",        prompt: "If someone asks about delivery time, tell them delivery takes 30-40 minutes", lang: "en" },
  { label: "CLEAR-3: menu request",         prompt: "When customer says 'menu', send them our full menu card", lang: "en" },
  { label: "CLEAR-4: payment methods",      prompt: "If customer asks about payment methods, tell them we accept UPI, cash, and card", lang: "en" },
  { label: "CLEAR-5: opening hours",        prompt: "When someone asks about opening hours, tell them we are open 10 AM to 10 PM every day", lang: "en" },
  // --- Vague/ambiguous ---
  { label: "VAGUE-1: generic food",         prompt: "Handle customer inquiries about food", lang: "en" },
  { label: "VAGUE-2: generic reply",        prompt: "Reply to customers who ask questions", lang: "en" },
  { label: "VAGUE-3: order questions",      prompt: "Deal with order-related questions", lang: "en" },
  { label: "VAGUE-4: respond nicely",       prompt: "When people message us, respond nicely", lang: "en" },
  { label: "VAGUE-5: complaints",           prompt: "Handle complaints", lang: "en" },
  // --- Regional language ---
  { label: "HINDI-1: biryani prompt",       prompt: "जब कोई ग्राहक चिकन बिरयानी के बारे में पूछे तो बताएं कि हमारे पास चिकन बिरयानी ₹199 में उपलब्ध है", lang: "hi" },
  { label: "TAMIL-1: biryani prompt",       prompt: "ஒரு வாடிக்கையாளர் சிக்கன் பிரியாணி பற்றி கேட்டால், எங்களிடம் சிறப்பு சிக்கன் பிரியாணி ₹199க்கு உள்ளது என்று சொல்லுங்கள்", lang: "ta" },
  { label: "TELUGU-1: biryani prompt",      prompt: "గ్రాహకుడు చికెన్ బిర్యానీ గురించి అడిగితే, మా వద్ద ప్రత్యేక చికెన్ బిర్యానీ ₹199కు ఉందని చెప్పండి", lang: "te" },
  // --- Mixed English + regional ---
  { label: "MIXED-1: Hinglish",             prompt: "When customer asks about बिरयानी, tell them price", lang: "en" },
  // --- Edge cases ---
  { label: "EDGE-1: too short",             prompt: "hi", lang: "en" },
  { label: "EDGE-2: too vague",             prompt: "something", lang: "en" },
  { label: "EDGE-3: contradictory",         prompt: "When customer asks about price, tell them price is not available and also tell them the price is ₹500", lang: "en" },
  { label: "EDGE-4: very long",             prompt: "When a customer asks about any of our menu items, first check if they have asked about a specific category like biryani, pizza, or curry. If they ask about biryani, tell them we have chicken biryani (Rs.199), mutton biryani (Rs.299), and egg biryani (Rs.149). If they ask about pizza, tell them we have margherita (Rs.199), farmhouse (Rs.299), and pepperoni (Rs.349). If they ask about curry, tell them we have butter chicken (Rs.249), paneer butter masala (Rs.199), and dal makhani (Rs.149). If they ask about something we don't have, tell them we don't have that item and suggest alternatives.", lang: "en" },
];

// ------------------------------------------------------------------------
// TEST SET 2: Customer chat messages (AI fallback path)
// ------------------------------------------------------------------------
const CHAT_MESSAGES = [
  // --- Simple English ---
  { label: "CHAT-EN-1: biryani inquiry",   text: "Do you have chicken biryani?" },
  { label: "CHAT-EN-2: delivery time",     text: "What's the delivery time?" },
  { label: "CHAT-EN-3: order intent",      text: "I want to order a pizza" },
  { label: "CHAT-EN-4: payment question",  text: "How can I pay?" },
  { label: "CHAT-EN-5: offers query",      text: "What offers do you have today?" },
  // --- Ambiguous ---
  { label: "CHAT-AMB-1: how much",         text: "How much?" },
  { label: "CHAT-AMB-2: send it",          text: "Send it" },
  { label: "CHAT-AMB-3: okay",             text: "Okay" },
  { label: "CHAT-AMB-4: about it",         text: "What about it?" },
  { label: "CHAT-AMB-5: need help",        text: "I need help" },
  // --- Regional language ---
  { label: "CHAT-HI-1: biryani price",     text: "चिकन बिरयानी कितने की है?" },
  { label: "CHAT-TA-1: biryani available", text: "பிரியாணி இருக்கா?" },
  { label: "CHAT-TE-1: chicken biryani",   text: "చికెన్ బిర్యానీ ఎంత?" },
  { label: "CHAT-HI-2: delivery time",     text: "डिलीवरी में कितना समय लगता है?" },
  { label: "CHAT-TA-2: want to order",     text: "ஆர்டர் செய்ய வேண்டும்" },
  // --- Code-mixed ---
  { label: "CHAT-HINGLISH: biryani price", text: "बिरयानी price क्या है?" },
  { label: "CHAT-TANGLISH: available",     text: "பிரியாணி available ah?" },
  // --- Edge cases ---
  { label: "CHAT-EDGE-1: angry",           text: "THIS IS ANGRY CUSTOMER WHY IS MY ORDER LATE???" },
  { label: "CHAT-EDGE-2: emoji only",      text: "🍕" },
  { label: "CHAT-EDGE-3: single char",     text: "a" },
];

// ------------------------------------------------------------------------
// TEST SET 3: Language detection (Sarvam LID + Unicode fallback)
// ------------------------------------------------------------------------
const LANG_DETECT_TEXTS = [
  { label: "EN-1: English",       text: "Hello, I would like to order chicken biryani please" },
  { label: "HI-1: Hindi",         text: "मुझे चिकन बिरयानी चाहिए" },
  { label: "TA-1: Tamil",         text: "எனக்கு சிக்கன் பிரியாணி வேண்டும்" },
  { label: "TE-1: Telugu",        text: "నాకు చికెన్ బిర్యానీ కావాలి" },
  { label: "BN-1: Bengali",       text: "আমি চিকেন বিরিয়ানি চাই" },
  { label: "GU-1: Gujarati",      text: "મને ચિકન બિરયાની જોઈએ છે" },
  { label: "KN-1: Kannada",       text: "ನನಗೆ ಚಿಕನ್ ಬಿರಿಯಾನಿ ಬೇಕು" },
  { label: "ML-1: Malayalam",     text: "എനിക്ക് ചിക്കൻ ബിരിയാണി വേണം" },
  { label: "MR-1: Marathi",       text: "मला चिकन बिरयानी हवी आहे" },
  { label: "PA-1: Punjabi",       text: "ਮੈਨੂੰ ਚਿਕਨ ਬਿਰਯਾਨੀ ਚਾਹੀਦੀ ਹੈ" },
  { label: "UR-1: Urdu",          text: "مجھے چکن بریانی چاہیے" },
  { label: "HINGLISH: mixed",     text: "बिरयानी price kya hai?" },
  { label: "TANGLISH: mixed",     text: "biriyani available ah?" },
  { label: "SHORT-1: one word",   text: "Hello" },
  { label: "EMPTY: empty string", text: "" },
];

// ------------------------------------------------------------------------
// TEST SET 4: Translation (Sarvam Translate)
// ------------------------------------------------------------------------
const TRANSLATION_TESTS = [
  { label: "EN→HI-1: greeting",    text: "Hello! How can I help you today?",            target: "hi" as const },
  { label: "EN→HI-2: biryani",     text: "We have chicken biryani at Rs.199",           target: "hi" as const },
  { label: "EN→TA-1: greeting",    text: "Welcome to our restaurant!",                   target: "ta" as const },
  { label: "EN→TA-2: delivery",    text: "Your order will be delivered in 30 minutes",   target: "ta" as const },
  { label: "EN→TE-1: greeting",    text: "Thank you for your order!",                    target: "te" as const },
  { label: "EN→BN-1: offer",       text: "Today's special: 20% off on all biryanis",     target: "bn" as const },
  { label: "EN→KN-1: price",       text: "The total amount is Rs.499",                   target: "kn" as const },
  { label: "LONG-1: long text",    text: "Dear customer, we are pleased to inform you that your order has been confirmed and will be delivered to your address within 45 minutes. Please keep your phone handy for any updates from our delivery partner. Thank you for choosing our service!", target: "hi" as const },
];

// ------------------------------------------------------------------------
// Helper: grade the rule generation result
// ------------------------------------------------------------------------
function gradeRuleResult(label: string, result: any, elapsed: number): { usable: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!result) return { usable: false, issues: ["No result returned"] };
  if (!result.triggerKeywords || result.triggerKeywords.length === 0) issues.push("No trigger keywords");
  if (!result.templateBody || result.templateBody.length < 15) issues.push("Template too short");
  if (!result.name) issues.push("No rule name");
  if (elapsed > 10000) issues.push(`Slow: ${Math.round(elapsed)}ms`);
  return { usable: issues.length === 0, issues };
}

function gradeChatResult(label: string, result: any, elapsed: number): { usable: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!result) return { usable: false, issues: ["No result returned"] };
  if (!result.replyText || result.replyText.length < 5) issues.push("No or very short replyText");
  if (result.replyText && result.replyText.length > 1000) issues.push(`Very long reply (${result.replyText.length} chars)`);
  // Check if reply matches language of query
  const hasHindi = /[\u0900-\u097F]/.test(result.replyText || "");
  const hasTamil = /[\u0B80-\u0BFF]/.test(result.replyText || "");
  const hasTelugu = /[\u0C00-\u0C7F]/.test(result.replyText || "");
  const queryHasHindi = /[\u0900-\u097F]/.test(label);
  const queryHasTamil = /[\u0B80-\u0BFF]/.test(label);
  const queryHasTelugu = /[\u0C00-\u0C7F]/.test(label);
  if (queryHasHindi && !hasHindi) issues.push("Query in Hindi but reply is not in Hindi");
  if (queryHasTamil && !hasTamil) issues.push("Query in Tamil but reply is not in Tamil");
  if (queryHasTelugu && !hasTelugu) issues.push("Query in Telugu but reply is not in Telugu");
  if (elapsed > 10000) issues.push(`Slow: ${Math.round(elapsed)}ms`);
  return { usable: issues.length === 0, issues };
}

function gradeLangDetect(label: string, result: any, elapsed: number): { usable: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!result) return { usable: false, issues: ["No result"] };
  if (!result.language) issues.push("No language returned");
  if (result.confidence < 0.3) issues.push(`Low confidence: ${result.confidence}`);
  if (elapsed > 3000) issues.push(`Slow: ${Math.round(elapsed)}ms`);
  return { usable: issues.length === 0, issues };
}

function gradeTranslation(label: string, result: string | null, elapsed: number): { usable: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!result) return { usable: false, issues: ["No result (error or fallback)"] };
  if (result.length < 5) issues.push("Result too short");
  if (elapsed > 5000) issues.push(`Slow: ${Math.round(elapsed)}ms`);
  return { usable: issues.length === 0, issues };
}

// ------------------------------------------------------------------------
// Main test runner
// ------------------------------------------------------------------------
async function main() {
  const sarvamKey = process.env.SARVAM_API_KEY || "";

  console.log("=".repeat(80));
  console.log("PROVIDER AUDIT — Groq + Sarvam current usage");
  console.log("=".repeat(80));
  console.log("");

  // 1) RULE GENERATION — Groq
  console.log("-".repeat(80));
  console.log("PART 1: RULE GENERATION (Groq llama-3.3-70b-versatile)");
  console.log("-".repeat(80));
  let ruleOk = 0, ruleFail = 0;
  for (const tp of RULE_PROMPTS) {
    // Pacing: avoid Groq rate-limit (30 req/min for llama-3.3-70b-versatile on free tier)
    await new Promise(r => setTimeout(r, 2500));
    const start = Date.now();
    let result: any = null;
    let error: string | null = null;
    try {
      result = await ruleGen.generateFromPrompt({
        prompt: tp.prompt,
        companyId: "test-audit",
        businessType: "restaurant",
        businessName: "Test Restaurant",
      });
    } catch (e: any) {
      error = e.message;
    }
    const elapsed = Date.now() - start;
    const grade = error ? { usable: false, issues: [error] } : gradeRuleResult(tp.label, result, elapsed);
    if (grade.usable) ruleOk++; else ruleFail++;
    console.log(`  [${grade.usable ? "OK" : "XX"}] ${tp.label} (${tp.lang})`);
    console.log(`       Provider: Groq | Model: llama-3.3-70b-versatile | ${elapsed}ms`);
    if (result) console.log(`       Keywords: ${JSON.stringify(result.triggerKeywords?.slice(0, 3))} | Template: "${(result.templateBody || "").substring(0, 60)}..."`);
    if (error) console.log(`       ERROR: ${error.substring(0, 120)}`);
    if (!grade.usable && !error) console.log(`       Issues: ${grade.issues.join("; ")}`);
    console.log("");
  }
  console.log(`  Rule gen summary: ${ruleOk} usable, ${ruleFail} failed\n`);

  // 2) CHAT REPLY — Groq
  console.log("-".repeat(80));
  console.log("PART 2: AI CHAT REPLY (Groq llama-3.3-70b-versatile via generateShopReply)");
  console.log("-".repeat(80));
  let chatOk = 0, chatFail = 0;
  // We need a real company for tenant context
  await withTestCompany("AUDIT-CHAT", async (testCompany) => {
    const companyId = testCompany.id;
    const contextStore = await resolveTenantContext(companyId);

    // Create a simple inventory product so the AI has context
    await prisma.inventoryProduct.create({
      data: { companyId, name: "Chicken Biryani", basePrice: 199, isActive: true },
    });

    await tenantContextStorage.run(contextStore, async () => {
      for (const cm of CHAT_MESSAGES) {
        await new Promise(r => setTimeout(r, 2500));
        const start = Date.now();
        let result: any = null;
        let error: string | null = null;
        try {
          result = await generateShopReply({
            user_message: cm.text,
            conversation_history: [],
            menu_snapshot: "Chicken Biryani - Rs.199, Mutton Biryani - Rs.299, Egg Biryani - Rs.149, Butter Chicken - Rs.249, Naan - Rs.30",
            detected_language: "en",
            activeRules: "No custom rules active.",
          });
        } catch (e: any) {
          error = e.message;
        }
        const elapsed = Date.now() - start;
        const grade = error ? { usable: false, issues: [error] } : gradeChatResult(cm.label, result, elapsed);
        if (grade.usable) chatOk++; else chatFail++;
        console.log(`  [${grade.usable ? "OK" : "XX"}] ${cm.label}`);
        console.log(`       Provider: Groq | Model: llama-3.3-70b-versatile | ${elapsed}ms`);
        if (result) {
          const reply = result.replyText || "(no replyText)";
          console.log(`       Reply: "${reply.substring(0, 100)}"`);
          console.log(`       Intent: ${result.intent_type || "N/A"} | Language: ${result.detected_meta?.language || "N/A"}`);
        }
        if (error) console.log(`       ERROR: ${error.substring(0, 120)}`);
        if (!grade.usable && !error) console.log(`       Issues: ${grade.issues.join("; ")}`);
        console.log("");
      }
    });
  });
  console.log(`  Chat reply summary: ${chatOk} usable, ${chatFail} failed\n`);

  // 3) LANGUAGE DETECTION — Sarvam + Unicode fallback
  console.log("-".repeat(80));
  console.log("PART 3: LANGUAGE DETECTION (Sarvam LID + Unicode fallback)");
  console.log("-".repeat(80));
  let langOk = 0, langFail = 0;
  for (const lt of LANG_DETECT_TEXTS) {
    const start = Date.now();
    let result: any = null;
    let error: string | null = null;
    try {
      result = await detectLanguage(lt.text, sarvamKey || undefined);
    } catch (e: any) {
      error = e.message;
    }
    const elapsed = Date.now() - start;
    const grade = error ? { usable: false, issues: [error] } : gradeLangDetect(lt.label, result, elapsed);
    if (grade.usable) langOk++; else langFail++;
    const usedProvider = sarvamKey && !error && elapsed < 2000 ? "Sarvam LID" : "Unicode fallback";
    console.log(`  [${grade.usable ? "OK" : "XX"}] ${lt.label}`);
    console.log(`       Provider: ${usedProvider} | ${elapsed}ms`);
    if (result) console.log(`       Detected: ${result.language} (confidence: ${result.confidence})`);
    if (error) console.log(`       ERROR: ${error.substring(0, 120)}`);
    if (!grade.usable && !error) console.log(`       Issues: ${grade.issues.join("; ")}`);
    console.log("");
  }
  console.log(`  Lang detection summary: ${langOk} usable, ${langFail} failed\n`);

  // 4) TRANSLATION — Sarvam
  console.log("-".repeat(80));
  console.log("PART 4: TRANSLATION (Sarvam Translate API)");
  console.log("-".repeat(80));
  let transOk = 0, transFail = 0;
  if (sarvamKey) {
    for (const tt of TRANSLATION_TESTS) {
      const start = Date.now();
      let result: string | null = null;
      let error: string | null = null;
      try {
        result = await callSarvamTranslate(tt.text, tt.target, sarvamKey);
      } catch (e: any) {
        error = e.message;
      }
      const elapsed = Date.now() - start;
      const grade = error ? { usable: false, issues: [error] } : gradeTranslation(tt.label, result, elapsed);
      if (grade.usable) transOk++; else transFail++;
      console.log(`  [${grade.usable ? "OK" : "XX"}] ${tt.label}`);
      console.log(`       Provider: Sarvam Translate | ${elapsed}ms`);
      if (result) console.log(`       Result: "${result.substring(0, 100)}"`);
      if (error) console.log(`       ERROR: ${error.substring(0, 120)}`);
      if (!grade.usable && !error) console.log(`       Issues: ${grade.issues.join("; ")}`);
      console.log("");
    }
  } else {
    console.log("  SARVAM_API_KEY not set — skipping translation tests\n");
  }
  console.log(`  Translation summary: ${transOk} usable, ${transFail} failed\n`);

  // FINAL SUMMARY
  console.log("=".repeat(80));
  console.log("OVERALL SUMMARY");
  console.log("=".repeat(80));
  console.log(`  Rule generation:     ${ruleOk}/${RULE_PROMPTS.length} usable  (Groq llama-3.3-70b-versatile)`);
  console.log(`  Chat reply:          ${chatOk}/${CHAT_MESSAGES.length} usable  (Groq llama-3.3-70b-versatile)`);
  console.log(`  Language detection:  ${langOk}/${LANG_DETECT_TEXTS.length} usable  (Sarvam LID / Unicode fallback)`);
  console.log(`  Translation:         ${transOk}/${TRANSLATION_TESTS.length} usable  (Sarvam Translate)`);
  console.log("");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
