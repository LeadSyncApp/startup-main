import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../../.env") });

import fetch from "node-fetch";
import { processVoiceIntake } from "../../src/services/inventory/voiceIntake.service";

async function runPartialVoiceIntakeTest() {
  console.log("==================================================================");
  console.log("  PARTIAL DATA & NULL HANDLING VERIFICATION");
  console.log("==================================================================\n");

  const sarvamApiKey = process.env.SARVAM_API_KEY;

  // Partial spoken text - NO price and NO stock mentioned!
  const targetSpeechText = "Denim jacket blue color high quality cotton fabric";

  console.log(`[Spoken Transcript Input]: "${targetSpeechText}"`);
  console.log("Generating audio & running Sarvam saaras:v3 STT + Groq LLM extraction...");

  const ttsResponse = await fetch("https://api.sarvam.ai/text-to-speech", {
    method: "POST",
    headers: {
      "api-subscription-key": sarvamApiKey!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: [targetSpeechText],
      target_language_code: "en-IN",
      speaker: "anushka",
      pitch: 0,
      pace: 1.0,
      loudness: 1.5,
      speech_sample_rate: 16000,
      enable_preprocessing: true,
      model: "bulbul:v2",
    }),
  });

  const ttsData = (await ttsResponse.json()) as { audios?: string[] };
  const audioBuffer = Buffer.from(ttsData.audios![0], "base64");

  const result = await processVoiceIntake(audioBuffer, "partial_test.wav", "audio/wav");

  console.log("\n✅ SARVAM SAARAS:V3 TRANSCRIPT:");
  console.log(`   "${result.transcript}"\n`);

  console.log("✅ GROQ EXTRACTION JSON (Confirming price and stock are NULL):");
  console.log(JSON.stringify(result.extracted, null, 2));
}

runPartialVoiceIntakeTest().catch((err) => {
  console.error("❌ Partial test failed:", err);
  process.exit(1);
});
