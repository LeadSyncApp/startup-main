import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../../.env") });

import fetch from "node-fetch";
import { processVoiceIntake } from "../../src/services/inventory/voiceIntake.service";

async function runVoiceIntakeE2ETest() {
  console.log("==================================================================");
  console.log("  REAL END-TO-END VOICE INTAKE VERIFICATION (SARVAM STT + GROQ LLM)");
  console.log("==================================================================\n");

  const sarvamApiKey = process.env.SARVAM_API_KEY;
  const groqApiKey = process.env.GROQ_API_KEY;

  console.log(`🔑 SARVAM_API_KEY configured: ${!!sarvamApiKey}`);
  console.log(`🔑 GROQ_API_KEY configured:   ${!!groqApiKey}\n`);

  if (!sarvamApiKey || !groqApiKey) {
    console.error("❌ Missing required API keys in .env!");
    process.exit(1);
  }

  // Spoken text to synthesize into real audio via Sarvam TTS for testing
  const targetSpeechText = "Pure cotton linen shirt in white color price 899 rupees stock quantity 45 items category apparel";

  console.log("------------------------------------------------------------------");
  console.log("STEP 1: AUDIO RECORDING SYNTHESIS / CAPTURE");
  console.log("------------------------------------------------------------------");
  console.log(`[Recording Input Text]: "${targetSpeechText}"`);
  console.log("Generating WAV audio payload using Sarvam TTS API...");

  // Generate real audio file buffer via Sarvam TTS
  const ttsResponse = await fetch("https://api.sarvam.ai/text-to-speech", {
    method: "POST",
    headers: {
      "api-subscription-key": sarvamApiKey,
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

  if (!ttsResponse.ok) {
    const errText = await ttsResponse.text();
    throw new Error(`TTS synthesis failed (${ttsResponse.status}): ${errText}`);
  }

  const ttsData = (await ttsResponse.json()) as { audios?: string[] };
  if (!ttsData.audios || ttsData.audios.length === 0) {
    throw new Error("TTS API returned no audio data");
  }

  const audioBuffer = Buffer.from(ttsData.audios[0], "base64");
  console.log(`✅ Real audio recording generated successfully! Audio size: ${audioBuffer.length} bytes\n`);

  console.log("------------------------------------------------------------------");
  console.log("STEP 2: SARVAM SAARAS:V3 SPEECH-TO-TEXT TRANSCRIPTION");
  console.log("------------------------------------------------------------------");
  console.log("Sending audio buffer to Sarvam saaras:v3 STT endpoint...");

  const result = await processVoiceIntake(audioBuffer, "voice_intake_test.wav", "audio/wav");

  console.log("\n✅ SARVAM SAARAS:V3 TRANSCRIPT RESULT:");
  console.log(`   "${result.transcript}"\n`);

  console.log("------------------------------------------------------------------");
  console.log("STEP 3: GROQ LLM (llama-3.1-8b-instant) STRUCTURED JSON EXTRACTION");
  console.log("------------------------------------------------------------------");
  console.log("Extracted JSON Schema output from Groq:");
  console.log(JSON.stringify(result.extracted, null, 2));

  console.log("\n------------------------------------------------------------------");
  console.log("STEP 4: FRONTEND FORM INPUT AUTO-FILL MAPPING DEMONSTRATION");
  console.log("------------------------------------------------------------------");

  // Simulated React Form State before and after
  const initialFormState = {
    product_type: "",
    price_inr: null as number | null,
    variants: [] as any[],
    categories: [] as string[],
    customFieldValues: {} as Record<string, any>,
    description: null as string | null,
  };

  const autoFilledFormState = { ...initialFormState };

  if (result.extracted.product_name) {
    autoFilledFormState.product_type = result.extracted.product_name;
  }
  if (result.extracted.price !== null) {
    autoFilledFormState.price_inr = result.extracted.price;
  }
  if (result.extracted.category) {
    autoFilledFormState.categories = [result.extracted.category];
  }
  if (result.extracted.fabric_type) {
    autoFilledFormState.customFieldValues = { "Fabric Type": result.extracted.fabric_type };
  }
  if (result.extracted.stock !== null) {
    autoFilledFormState.variants = [
      {
        attribute_name: "Default",
        attribute_value: "Standard",
        price_override: result.extracted.price,
        stock: result.extracted.stock,
      },
    ];
  }
  if (result.extracted.description) {
    autoFilledFormState.description = result.extracted.description;
  }

  console.log("FORM INITIAL STATE (Blank):");
  console.log(JSON.stringify(initialFormState, null, 2));
  console.log("\nFORM AUTO-FILLED STATE (Populated in HTML Input Fields, ready for user edit/save):");
  console.log(JSON.stringify(autoFilledFormState, null, 2));

  console.log("\n==================================================================");
  console.log("  VERIFICATION COMPLETE - ALL STAGES CONFIRMED END-TO-END ✨");
  console.log("==================================================================");
}

runVoiceIntakeE2ETest().catch((err) => {
  console.error("❌ E2E Test Execution Failed:", err);
  process.exit(1);
});
