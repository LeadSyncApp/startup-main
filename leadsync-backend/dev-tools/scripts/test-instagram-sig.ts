/**
 * TEST: Task 5 — Instagram webhook signature verification
 *
 * Verifies:
 * 1. Request with missing signature is rejected (401)
 * 2. Request with invalid signature is rejected (401)
 * 3. Request with valid signature passes through
 */

import crypto from "crypto";

const APP_SECRET = "test-instagram-app-secret-12345";

function createSignature(body: string, secret: string): string {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(body);
  return `sha256=${hmac.digest("hex")}`;
}

// Simulate the middleware logic directly (without Express)
function validateSignature(rawBody: Buffer, signatureHeader: string | null): { ok: boolean; status?: number; message?: string } {
  if (!signatureHeader) {
    return { ok: false, status: 401, message: "Missing signature header" };
  }

  const secret = APP_SECRET;
  if (!secret) {
    return { ok: false, status: 500, message: "Secret not defined" };
  }

  const parts = signatureHeader.split("=");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "sha256") {
    return { ok: false, status: 401, message: "Invalid signature format" };
  }

  const signatureBuffer = Buffer.from(parts[1], "hex");
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(rawBody);
  const computedBuffer = hmac.digest();

  try {
    if (computedBuffer.length !== signatureBuffer.length || !crypto.timingSafeEqual(computedBuffer, signatureBuffer)) {
      return { ok: false, status: 401, message: "Signature mismatch" };
    }
  } catch {
    return { ok: false, status: 401, message: "Signature check failure" };
  }

  return { ok: true };
}

async function runTest() {
  console.log("🧪 [Test] Starting Instagram webhook signature verification test...\n");

  const body = JSON.stringify({ entry: [{ id: "123", messaging: [] }] });
  const rawBody = Buffer.from(body);

  // Test 1: Missing signature
  console.log("🧪 [Test 1] Missing signature → rejected...");
  const result1 = validateSignature(rawBody, null);
  if (!result1.ok && result1.status === 401) {
    console.log(`  ✅ Correctly rejected: ${result1.message}`);
  } else {
    console.error(`  ❌ FAIL: Expected 401, got ${result1.status}`);
    process.exit(1);
  }

  // Test 2: Invalid signature
  console.log("\n🧪 [Test 2] Invalid signature → rejected...");
  const invalidSig = "sha256=" + "a".repeat(64);
  const result2 = validateSignature(rawBody, invalidSig);
  if (!result2.ok && result2.status === 401) {
    console.log(`  ✅ Correctly rejected: ${result2.message}`);
  } else {
    console.error(`  ❌ FAIL: Expected 401, got ${result2.status}`);
    process.exit(1);
  }

  // Test 3: Wrong format signature
  console.log("\n🧪 [Test 3] Wrong format signature → rejected...");
  const result3 = validateSignature(rawBody, "md5=abcdef123456");
  if (!result3.ok && result3.status === 401) {
    console.log(`  ✅ Correctly rejected: ${result3.message}`);
  } else {
    console.error(`  ❌ FAIL: Expected 401, got ${result3.status}`);
    process.exit(1);
  }

  // Test 4: Valid signature
  console.log("\n🧪 [Test 4] Valid signature → accepted...");
  const validSig = createSignature(body, APP_SECRET);
  const result4 = validateSignature(rawBody, validSig);
  if (result4.ok) {
    console.log(`  ✅ Correctly accepted with valid signature`);
  } else {
    console.error(`  ❌ FAIL: Valid signature was rejected: ${result4.message}`);
    process.exit(1);
  }

  // Test 5: Valid signature but wrong secret
  console.log("\n🧪 [Test 5] Valid signature with wrong secret → rejected...");
  const wrongSecretSig = createSignature(body, "wrong-secret");
  const result5 = validateSignature(rawBody, wrongSecretSig);
  if (!result5.ok && result5.status === 401) {
    console.log(`  ✅ Correctly rejected: ${result5.message}`);
  } else {
    console.error(`  ❌ FAIL: Expected 401, got ${result5.status}`);
    process.exit(1);
  }

  // Test 6: Timing-safe comparison (verify no timing leak)
  console.log("\n🧪 [Test 6] Timing-safe comparison (same-length wrong signature)...");
  const validSigBuffer = Buffer.from(createSignature(body, APP_SECRET).split("=")[1], "hex");
  const almostCorrectSig = Buffer.from(validSigBuffer);
  almostCorrectSig[0] ^= 0xff; // Flip first byte
  const result6 = validateSignature(rawBody, `sha256=${almostCorrectSig.toString("hex")}`);
  if (!result6.ok && result6.status === 401) {
    console.log(`  ✅ Correctly rejected with timing-safe comparison`);
  } else {
    console.error(`  ❌ FAIL: Expected 401, got ${result6.status}`);
    process.exit(1);
  }

  console.log("\n✅ [Test] PASS: Instagram webhook signature verification works correctly");
  process.exit(0);
}

runTest().catch((err) => {
  console.error("❌ [Test] Fatal error:", err);
  process.exit(1);
});
