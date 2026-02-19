"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const generative_ai_1 = require("@google/generative-ai");
const groq_sdk_1 = __importDefault(require("groq-sdk"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, "../.env") });
const apiKey = (process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY || "").trim();
const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
const groq = new groq_sdk_1.default({ apiKey: process.env.GROQ_API_KEY || "dummy" });
async function diagnostic() {
    // Gemini Testing
    console.log("🔍 DIAGNOSTIC: Testing Native Gemini Connectivity...");
    console.log(`🔑 Key Present: ${!!apiKey}`);
    console.log(`🔑 Key Prefix: ${apiKey.substring(0, 7)}`);
    const geminiTestModels = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-flash-8b"];
    for (const modelId of geminiTestModels) {
        console.log(`\n📡 Testing Gemini Model: ${modelId}`);
        const start = Date.now();
        try {
            const model = genAI.getGenerativeModel({ model: modelId });
            const result = await model.generateContent("Say 'CONNECTED'");
            console.log(`✅ SUCCESS [${Date.now() - start}ms]: ${result.response.text()}`);
        }
        catch (err) {
            console.error(`❌ FAILURE [${Date.now() - start}ms]: ${err.message}`);
        }
    }
    console.log("\n---"); // Separator
    // Groq Testing
    console.log("🔍 DIAGNOSTIC: Testing Groq Connectivity...");
    console.log(`🔑 Groq Key Present: ${!!process.env.GROQ_API_KEY}`);
    const groqTestModels = ["llama-3.1-8b-instant", "llama-3.3-70b-versatile"];
    for (const modelId of groqTestModels) {
        console.log(`\n📡 Testing Groq Model: ${modelId}`);
        const start = Date.now();
        try {
            const completion = await groq.chat.completions.create({
                messages: [{ role: "user", content: "Say 'GROQ CONNECTED'" }],
                model: modelId,
            });
            console.log(`✅ SUCCESS [${Date.now() - start}ms]: ${completion.choices[0]?.message?.content}`);
        }
        catch (err) {
            console.error(`❌ FAILURE [${Date.now() - start}ms]: ${err.message}`);
        }
    }
}
diagnostic();
