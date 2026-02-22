"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, "../.env") });
const intelligence_service_1 = require("./services/intelligence.service");
const geminiService_1 = require("./services/geminiService");
const orderParser_service_1 = require("./services/orderParser.service");
async function verify() {
    console.log("🚀 STARTING PRODUCTION RULE VERIFICATION\n");
    // 1. TEST INTENT PRIORITY (Intelligence Layer)
    console.log("--- 1. Testing Intent Priority (No more BROWSING for Orders) ---");
    const intentTests = [
        "Yennaku 4 dosa venum",
        "I want to book an appointment",
        "2 idly pack pannunga",
        "Just looking at the menu",
    ];
    for (const text of intentTests) {
        const result = await intelligence_service_1.intelligenceService.performAIAnalysis(text);
        console.log(`Input: "${text}" -> Intent: ${result.intent} (${result.intent === "ORDERING" ? "✅ PASS" : "❌ FAIL"})`);
    }
    console.log("\n");
    // 2. TEST OUTPUT FORMAT (Gemini Layer)
    console.log("--- 2. Testing Output Format (TEXT_REPLY / VOICE_TTS) ---");
    const formatTests = [
        ["text", "I need 4 dosa"],
        ["voice", "2 coffee please"],
    ];
    for (const [modality, msg] of formatTests) {
        console.log(`Testing Modality: ${modality}`);
        const reply = await (0, geminiService_1.generateBotReply)(msg, "Test Cafe", "Food", [], [], [], {}, modality);
        console.log(`Reply:\n${reply}`);
        const lines = reply.split("\n");
        const hasText = lines.some(l => l.startsWith("TEXT_REPLY:"));
        const hasVoice = lines.some(l => l.startsWith("VOICE_TTS:"));
        if (modality === "text") {
            console.log(hasText && lines.length === 1 ? "✅ PASS: Single line TEXT_REPLY" : "❌ FAIL: Invalid text format");
        }
        else {
            console.log(hasText && hasVoice ? "✅ PASS: Multiline TEXT + VOICE" : "❌ FAIL: Invalid voice format");
        }
        console.log("---");
    }
    // 3. TEST ORDER DETECTION (Parser Layer)
    console.log("--- 3. Testing Order Detection (Multilingual Keywords) ---");
    const detectionTests = [
        "4 dosa venum",
        "2 idly chahiye",
        "i want 3 coffees",
    ];
    for (const text of detectionTests) {
        const detected = orderParser_service_1.orderParserService.looksLikeOrder(text);
        console.log(`Input: "${text}" -> Detected: ${detected} (${detected ? "✅ PASS" : "❌ FAIL"})`);
    }
    console.log("\n✅ VERIFICATION COMPLETE");
    process.exit(0);
}
verify().catch(err => {
    console.error("❌ Verification Fatal Error:", err);
    process.exit(1);
});
