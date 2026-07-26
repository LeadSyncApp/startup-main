/**
 * Standalone test for Step 2: AI sanity-check gate.
 * Run with: npx ts-node src/services/automation/__tests__/sanity-check.test.ts
 *
 * Tests two scenarios:
 * 1. STS/vas shirts message → should be REJECTED (off-topic canned reply)
 * 2. Genuine "new offer" message → should PASS (relevant canned reply)
 */

import Groq from "groq-sdk";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../../../../.env") });

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });

async function sanityCheck(
  customerMessage: string,
  proposedReply: string,
  ruleName: string
): Promise<{ passes: boolean; reason: string }> {
  const result = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content:
          'You are a reply-quality gate. You receive a customer message and a proposed canned reply from a merchant\'s auto-reply rule. ' +
          "Determine whether the reply is a sensible, relevant response to what the customer asked. " +
          'Answer ONLY with a JSON object: { "passes": true/false, "reason": "short explanation" }. ' +
          "Be lenient — only reject if the reply is clearly off-topic, nonsensical,, or harmful.",
      },
      {
        role: "user",
        content: `Customer asked: "${customerMessage}"\nProposed canned reply (rule: ${ruleName}): "${proposedReply}"\n\nDoes this reply make sense as a response?`,
      },
    ],
    model: "llama-3.1-8b-instant",
    response_format: { type: "json_object" },
    temperature: 0.1,
    max_tokens: 100,
  });

  const text = result.choices[0]?.message?.content || '{"passes":true,"reason":"parse_error"}';
  const parsed = JSON.parse(text);
  return { passes: parsed.passes !== false, reason: parsed.reason || "no reason" };
}

async function runTests() {
  console.log("=== Step 2: AI Sanity-Check Gate Test ===\n");

  // Test 1: STS/vas shirts — off-topic canned reply should be REJECTED
  console.log("Test 1: STS/vas shirts message");
  const test1 = await sanityCheck(
    "do you have STS/vas shirts?",
    "🎉 New offer! Get 20% off on all products this weekend! Use code SAVE20 at checkout.",
    "New Offer Announcement"
  );
  console.log(`  Customer: "do you have STS/vas shirts?"`);
  console.log(`  Rule reply: "New offer! Get 20% off..."`);
  console.log(`  Result: passes=${test1.passes}, reason="${test1.reason}"`);
  console.log(`  Expected: passes=false`);
  console.log(`  ${test1.passes === false ? "✅ PASS (correctly rejected)" : "❌ FAIL (should have been rejected)"}\n`);

  // Test 2: Genuine new offer inquiry — relevant canned reply should PASS
  console.log("Test 2: Genuine new offer message");
  const test2 = await sanityCheck(
    "do you have any new offers?",
    "🎉 New offer! Get 20% off on all products this weekend! Use code SAVE20 at checkout.",
    "New Offer Announcement"
  );
  console.log(`  Customer: "do you have any new offers?"`);
  console.log(`  Rule reply: "New offer! Get 20% off..."`);
  console.log(`  Result: passes=${test2.passes}, reason="${test2.reason}"`);
  console.log(`  Expected: passes=true`);
  console.log(`  ${test2.passes === true ? "✅ PASS (correctly accepted)" : "❌ FAIL (should have been accepted)"}\n`);

  // Test 3: Shipping question — shipping reply should PASS
  console.log("Test 3: Shipping question with relevant reply");
  const test3 = await sanityCheck(
    "how long does shipping take?",
    "We offer free shipping on orders over ₹500. Standard delivery takes 3-5 business days. Express delivery (1-2 days) is available for ₹99.",
    "Shipping Policy"
  );
  console.log(`  Customer: "how long does shipping take?"`);
  console.log(`  Rule reply: "We offer free shipping..."`);
  console.log(`  Result: passes=${test3.passes}, reason="${test3.reason}"`);
  console.log(`  Expected: passes=true`);
  console.log(`  ${test3.passes === true ? "✅ PASS (correctly accepted)" : "❌ FAIL (should have been accepted)"}\n`);

  // Test 4: Return policy question — return reply should PASS
  console.log("Test 4: Return question with relevant reply");
  const test4 = await sanityCheck(
    "can I return this shirt?",
    "Our return policy allows returns within 7 days of delivery. Items must be unworn with tags attached. Refund will be processed within 3-5 business days.",
    "Return Policy"
  );
  console.log(`  Customer: "can I return this shirt?"`);
  console.log(`  Rule reply: "Our return policy..."`);
  console.log(`  Result: passes=${test4.passes}, reason="${test4.reason}"`);
  console.log(`  Expected: passes=true`);
  console.log(`  ${test4.passes === true ? "✅ PASS (correctly accepted)" : "❌ FAIL (should have been accepted)"}\n`);

  // Summary
  const allPassed =
    test1.passes === false &&
    test2.passes === true &&
    test3.passes === true &&
    test4.passes === true;

  console.log("=== Summary ===");
  console.log(`Test 1 (STS/vas shirts → reject): ${test1.passes === false ? "PASS" : "FAIL"}`);
  console.log(`Test 2 (new offer → accept):      ${test2.passes === true ? "PASS" : "FAIL"}`);
  console.log(`Test 3 (shipping → accept):        ${test3.passes === true ? "PASS" : "FAIL"}`);
  console.log(`Test 4 (return → accept):          ${test4.passes === true ? "PASS" : "FAIL"}`);
  console.log(`\nOverall: ${allPassed ? "✅ ALL TESTS PASSED" : "❌ SOME TESTS FAILED"}`);
}

runTests().catch(console.error);
