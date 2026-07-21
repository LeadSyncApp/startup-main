/**
 * Provider audit — Part 3b: Language detection + Translation only.
 * These use Sarvam API (not Groq), so they're not affected by Groq rate limits.
 */
import { detectLanguage } from "../../src/services/ai/languageDetection.service";
import { callSarvamTranslate } from "../../src/services/ai/translation.service";
import { prisma } from "../../src/lib/prisma";

const sarvamKey = process.env.SARVAM_API_KEY || "";

async function main() {
  console.log("=".repeat(80));
  console.log("LANGUAGE DETECTION (Sarvam LID + Unicode fallback)");
  console.log("=".repeat(80));

  const tests = [
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
    { label: "SHORT: one word",     text: "Hello" },
    { label: "EMPTY: empty",        text: "" },
  ];

  for (const t of tests) {
    const start = Date.now();
    let result: any = null;
    let error: string | null = null;
    try {
      result = await detectLanguage(t.text, sarvamKey || undefined);
    } catch (e: any) {
      error = e.message;
    }
    const elapsed = Date.now() - start;
    const usedSarvam = sarvamKey && !error && elapsed < 2000;
    console.log(`  ${t.label}`);
    console.log(`       Text: "${t.text.substring(0, 50)}"`);
    console.log(`       Provider: ${usedSarvam ? "Sarvam LID API" : "Unicode fallback"} | ${elapsed}ms`);
    if (result) console.log(`       Detected: ${result.language} (confidence: ${result.confidence})`);
    if (error) console.log(`       ERROR: ${error.substring(0, 120)}`);
    console.log("");
  }

  console.log("=".repeat(80));
  console.log("TRANSLATION (Sarvam Translate API)");
  console.log("=".repeat(80));

  const transTests = [
    { label: "EN->HI: greeting",    text: "Hello! How can I help you today?",                            target: "hi" as const },
    { label: "EN->HI: biryani",     text: "We have chicken biryani at Rs.199",                           target: "hi" as const },
    { label: "EN->TA: welcome",     text: "Welcome to our restaurant!",                                  target: "ta" as const },
    { label: "EN->TA: delivery",    text: "Your order will be delivered in 30 minutes",                  target: "ta" as const },
    { label: "EN->TE: thanks",      text: "Thank you for your order!",                                   target: "te" as const },
    { label: "EN->BN: offer",       text: "Today's special: 20% off on all biryanis",                    target: "bn" as const },
    { label: "EN->KN: price",       text: "The total amount is Rs.499",                                  target: "kn" as const },
    { label: "EN->HI: long text",   text: "Dear customer, we are pleased to inform you that your order has been confirmed and will be delivered to your address within 45 minutes.", target: "hi" as const },
    { label: "EN->PA: greeting",    text: "Good evening! Your order is on the way.",                      target: "pa" as const },
    { label: "EN->MR: farewell",    text: "Thank you for visiting. Have a great day!",                    target: "mr" as const },
    { label: "EN->GU: promo",       text: "Flash sale: 30% off on all items today only!",                target: "gu" as const },
    { label: "EN->ML: confirm",     text: "Your payment of Rs.599 has been received successfully.",      target: "ml" as const },
  ];

  if (!sarvamKey) {
    console.log("  SARVAM_API_KEY not set — skipping\n");
  } else {
    for (const tt of transTests) {
      const start = Date.now();
      let result: string | null = null;
      let error: string | null = null;
      try {
        result = await callSarvamTranslate(tt.text, tt.target, sarvamKey);
      } catch (e: any) {
        error = e.message;
      }
      const elapsed = Date.now() - start;
      console.log(`  ${tt.label}`);
      console.log(`       Provider: Sarvam Translate | ${elapsed}ms`);
      console.log(`       Input:  "${tt.text.substring(0, 60)}"`);
      if (result) console.log(`       Output: "${result.substring(0, 80)}"`);
      if (error) console.log(`       ERROR: ${error.substring(0, 120)}`);
      console.log("");
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
