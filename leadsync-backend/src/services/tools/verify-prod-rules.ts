import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../.env") });

import { generateShopReply } from "../ai/ai.service";

async function verify() {
    console.log("🚀 STARTING PRODUCTION RULE VERIFICATION\n");

    // 1. TEST INTENT PRIORITY (Removed, handled by Omni-Prompt semantic intent classification)
    console.log("--- 1. Testing Intent Priority (Handled by Omni-Prompt semantic intent classification) ---");
    console.log("Skipping local intelligence service checks as classification is now semantic-only.");
    console.log("\n");

    // 2. TEST OUTPUT FORMAT (Gemini Layer)
    console.log("--- 2. Testing Output Format (TEXT_REPLY / VOICE_TTS) ---");
    const formatTests: Array<["text" | "voice", string]> = [
        ["text", "I need 4 dosa"],
        ["voice", "2 coffee please"],
    ];

    for (const [modality, msg] of formatTests) {
        console.log(`Testing Modality: ${modality}`);
        const result = await generateShopReply({
            tenant_id: "test",
            user_message: msg,
            session_state: {},
            retrieved_items: [],
             learned_knowledge_text: "",
             menu_snapshot: {},
             shop_policies: "",
             order_history: [],
             latest_order_status: null,
             modality: modality,
             bot_commands: [],
             active_order: null
        });
        const reply = result.replyText;
        console.log(`Reply:\n${reply}`);

        const lines = reply.split("\n");
        const hasMessage = lines.some((l: string) => l.startsWith("MESSAGE:"));

        if (modality === "text") {
            console.log(hasMessage && lines.length === 1 ? "✅ PASS: Single line MESSAGE" : "❌ FAIL: Invalid text format");
        } else {
            console.log(hasMessage ? "✅ PASS: Multi-line MESSAGE (Voice processed via parsing)" : "❌ FAIL: Invalid format");
        }
        console.log("---");
    }

    console.log("\n✅ VERIFICATION COMPLETE");
    process.exit(0);
}

verify().catch(err => {
    console.error("❌ Verification Fatal Error:", err);
    process.exit(1);
});
