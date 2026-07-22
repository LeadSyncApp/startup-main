import "dotenv/config";
import Groq from "groq-sdk";

async function testGroqApi() {
  console.log("==========================================================================================");
  console.log("GROQ API CONNECTIVITY TEST");
  console.log("==========================================================================================\n");

  const apiKey = process.env.GROQ_API_KEY;
  console.log(`GROQ_API_KEY present: ${!!apiKey}`);
  console.log(`GROQ_API_KEY prefix:  ${apiKey ? apiKey.substring(0, 20) + "..." : "MISSING"}\n`);

  if (!apiKey) {
    console.error("❌ FATAL: GROQ_API_KEY is not set in .env");
    process.exit(1);
  }

  const groq = new Groq({ apiKey });

  const models = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];

  for (const model of models) {
    console.log(`\n📡 Testing model: ${model}`);
    const start = Date.now();
    try {
      const result = await groq.chat.completions.create({
        messages: [
          { role: "system", content: "You are a helpful assistant. Reply in one short sentence." },
          { role: "user", content: "Say hello and confirm you are working." }
        ],
        model,
        temperature: 0.3,
        max_tokens: 100,
      });

      const elapsed = Date.now() - start;
      const reply = result.choices[0]?.message?.content?.trim();
      const finishReason = result.choices[0]?.finish_reason;
      const usage = result.usage;

      console.log(`   ✅ SUCCESS (${elapsed}ms)`);
      console.log(`   Reply: "${reply}"`);
      console.log(`   Finish reason: ${finishReason}`);
      console.log(`   Tokens: prompt=${usage?.prompt_tokens}, completion=${usage?.completion_tokens}, total=${usage?.total_tokens}`);
    } catch (err: any) {
      const elapsed = Date.now() - start;
      console.error(`   ❌ FAILED (${elapsed}ms)`);
      console.error(`   Error: ${err.message}`);
      if (err.status) console.error(`   HTTP Status: ${err.status}`);
      if (err.error) console.error(`   Error Body:`, JSON.stringify(err.error, null, 2));
    }
  }

  // Test with the exact prompt structure used by generateShopReply
  console.log("\n\n📡 Testing with real orchestrator-style prompt (llama-3.3-70b-versatile)...");
  const start2 = Date.now();
  try {
    const result = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are a shop assistant AI. The customer has sent a message. Reply helpfully. Output valid JSON with keys: intent_type, replyText, thread_summary.`
        },
        {
          role: "user",
          content: `Customer message: "Do you have any brands?"\nConversation history: []\nProduct context: None available.`
        }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.4,
      max_tokens: 500,
      response_format: { type: "json_object" },
    });

    const elapsed2 = Date.now() - start2;
    const reply2 = result.choices[0]?.message?.content?.trim();
    console.log(`   ✅ SUCCESS (${elapsed2}ms)`);
    console.log(`   Reply: ${reply2}`);
  } catch (err: any) {
    const elapsed2 = Date.now() - start2;
    console.error(`   ❌ FAILED (${elapsed2}ms)`);
    console.error(`   Error: ${err.message}`);
    if (err.status) console.error(`   HTTP Status: ${err.status}`);
    if (err.error) console.error(`   Error Body:`, JSON.stringify(err.error, null, 2));
  }

  console.log("\n==========================================================================================");
  console.log("GROQ API TEST COMPLETE");
  console.log("==========================================================================================");
}

testGroqApi().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
