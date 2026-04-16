import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../.env") });

const apiKey = (process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY || "").trim();
const genAI = new GoogleGenerativeAI(apiKey);

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "dummy" });

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
        } catch (err: any) {
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
        } catch (err: any) {
            console.error(`❌ FAILURE [${Date.now() - start}ms]: ${err.message}`);
        }
    }
}

diagnostic();
