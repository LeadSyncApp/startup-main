import { useState, useRef, useCallback } from "react";

export interface ExtractedProductFields {
  product_name: string | null;
  price: number | null;
  stock: number | null;
  fabric_type: string | null;
  category: string | null;
  description: string | null;
}

export interface VoiceIntakeResponse {
  transcript: string;
  extracted: ExtractedProductFields;
}

interface UseVoiceRecorderProps {
  companyId?: string;
  language?: string;
  onSuccess?: (data: VoiceIntakeResponse) => void;
  onError?: (errMessage: string) => void;
}

export interface SpeechAnalysisResult {
  containsSpeech: boolean;
  peak: number;
  rms: number;
  duration: number;
  errorReason?: string;
}

/**
 * Perform client-side audio volume & 50ms frame energy analysis using Web Audio API to detect silence / ambient noise / mic pops.
 * Logs computed metrics explicitly for debug verification.
 */
async function checkAudioContainsSpeech(blob: Blob): Promise<SpeechAnalysisResult> {
  console.log(`[VOICE_DEBUG] Beginning audio analysis. Blob size: ${blob.size} bytes, type: ${blob.type}`);

  if (blob.size === 0) {
    console.log(`[VOICE_DEBUG] ABORT: Blob size is 0 bytes.`);
    return { containsSpeech: false, peak: 0, rms: 0, duration: 0, errorReason: "Blob size 0" };
  }

  try {
    const arrayBuffer = await blob.arrayBuffer();
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) {
      console.warn(`[VOICE_DEBUG] Web Audio API (AudioContext) unavailable in browser context.`);
      return { containsSpeech: true, peak: -1, rms: -1, duration: -1, errorReason: "AudioContext unavailable" };
    }

    const audioCtx = new AudioCtx();
    let audioBuffer: AudioBuffer | null = null;

    try {
      audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    } catch (decodeErr: any) {
      console.error(`[VOICE_DEBUG] decodeAudioData failed:`, decodeErr);
      audioCtx.close();
      return {
        containsSpeech: true,
        peak: -1,
        rms: -1,
        duration: -1,
        errorReason: `Decode failed: ${decodeErr?.message || String(decodeErr)}`,
      };
    }

    if (!audioBuffer) {
      console.warn(`[VOICE_DEBUG] decodeAudioData returned null audioBuffer.`);
      audioCtx.close();
      return { containsSpeech: true, peak: -1, rms: -1, duration: -1, errorReason: "Null audioBuffer" };
    }

    const duration = audioBuffer.duration;
    let maxPeak = 0;
    let totalSquare = 0;
    let sampleCount = 0;

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const pcm = audioBuffer.getChannelData(channel);
      for (let i = 0; i < pcm.length; i++) {
        const absVal = Math.abs(pcm[i]);
        if (absVal > maxPeak) maxPeak = absVal;
        totalSquare += pcm[i] * pcm[i];
        sampleCount++;
      }
    }

    const rms = sampleCount > 0 ? Math.sqrt(totalSquare / sampleCount) : 0;

    // 50ms frame analysis (at 48,000 samples/sec = 2,400 samples/frame)
    const sampleRate = audioBuffer.sampleRate || 48000;
    const frameSize = Math.floor(sampleRate * 0.05); // 50ms per frame
    const pcmData = audioBuffer.getChannelData(0);

    let activeSpeechFrames = 0;
    // Human vocalization energy threshold per 50ms frame (unamplified speech >= 0.065)
    const frameRmsThreshold = 0.065;
    const totalFrames = Math.floor(pcmData.length / frameSize);

    for (let f = 0; f < totalFrames; f++) {
      let frameSquareSum = 0;
      const offset = f * frameSize;
      for (let i = 0; i < frameSize; i++) {
        const sample = pcmData[offset + i];
        frameSquareSum += sample * sample;
      }
      const frameRms = Math.sqrt(frameSquareSum / frameSize);
      if (frameRms >= frameRmsThreshold) {
        activeSpeechFrames++;
      }
    }

    const activeRatio = totalFrames > 0 ? activeSpeechFrames / totalFrames : 0;
    audioCtx.close();

    console.log(
      `[VOICE_DEBUG] Computed audio metrics -> Duration: ${duration.toFixed(
        3
      )}s | Peak Amplitude: ${maxPeak.toFixed(5)} | Overall RMS: ${rms.toFixed(
        5
      )} | Total Samples: ${sampleCount}`
    );
    console.log(
      `[VOICE_DEBUG] Frame Analysis (50ms chunks) -> Total Frames: ${totalFrames} | Active Speech Frames (RMS >= ${frameRmsThreshold}): ${activeSpeechFrames} (${(
        activeRatio * 100
      ).toFixed(1)}%)`
    );

    if (duration < 0.4) {
      console.log(`[VOICE_DEBUG] DECISION: REJECT (Duration ${duration.toFixed(3)}s < 0.4s min requirement)`);
      return { containsSpeech: false, peak: maxPeak, rms, duration, errorReason: "Duration < 0.4s" };
    }

    // Speech energy rules (with AGC disabled & noise suppression on):
    // Requires sustained vocalization energy across at least 4 x 50ms frames (200ms total)
    // AND peak amplitude >= 0.22 AND overall RMS >= 0.02
    const isNoiseOrSilence =
      activeSpeechFrames < 4 ||
      maxPeak < 0.22 ||
      rms < 0.020 ||
      activeRatio < 0.15;

    if (isNoiseOrSilence) {
      console.log(
        `[VOICE_DEBUG] DECISION: REJECT NOISE/SILENCE (Active Frames: ${activeSpeechFrames} < 4 || Peak: ${maxPeak.toFixed(
          5
        )} < 0.22 || RMS: ${rms.toFixed(5)} < 0.020 || Active Ratio: ${(activeRatio * 100).toFixed(1)}% < 15%)`
      );
      return {
        containsSpeech: false,
        peak: maxPeak,
        rms,
        duration,
        errorReason: `Ambient noise/mic click (Active Frames: ${activeSpeechFrames}, Peak: ${maxPeak.toFixed(
          5
        )}, RMS: ${rms.toFixed(5)}, Ratio: ${(activeRatio * 100).toFixed(1)}%)`,
      };
    }

    console.log(
      `[VOICE_DEBUG] DECISION: SPEECH DETECTED (Active Speech Frames: ${activeSpeechFrames}, Peak: ${maxPeak.toFixed(
        5
      )}, RMS: ${rms.toFixed(5)})`
    );
    return { containsSpeech: true, peak: maxPeak, rms, duration };
  } catch (e: any) {
    console.error("[VOICE_DEBUG] Exception in speech analysis:", e);
    return { containsSpeech: true, peak: -1, rms: -1, duration: -1, errorReason: e.message };
  }
}

export function useVoiceRecorder({ companyId, language, onSuccess, onError }: UseVoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VoiceIntakeResponse | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = useCallback(async () => {
    console.log("[VOICE_DEBUG] startRecording invoked.");
    setError(null);
    setResult(null);
    setRecordingTime(0);
    audioChunksRef.current = [];

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const msg = "Audio recording is not supported in this browser.";
      console.error("[VOICE_DEBUG]", msg);
      setError(msg);
      onError?.(msg);
      return;
    }

    try {
      // Disable AGC (autoGainControl) to prevent AGC from boosting ambient room noise to 0.30 Peak during silent periods!
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
        },
      });

      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "";

      console.log(`[VOICE_DEBUG] Microphone stream acquired (AGC disabled, noiseSuppression enabled). Using mimeType: "${mimeType}"`);

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log(`[VOICE_DEBUG] Chunk received: ${event.data.size} bytes. Total chunks: ${audioChunksRef.current.length}`);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log("[VOICE_DEBUG] mediaRecorder.onstop triggered.");
        // Stop all audio stream tracks
        stream.getTracks().forEach((track) => track.stop());

        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType || "audio/webm",
        });

        console.log(`[VOICE_DEBUG] Combined Blob size: ${audioBlob.size} bytes, mimeType: ${audioBlob.type}`);

        if (audioBlob.size === 0) {
          const msg = "No audio recorded.";
          console.log("[VOICE_DEBUG] ABORT: Empty blob.");
          setError(msg);
          onError?.(msg);
          setIsTranscribing(false);
          return;
        }

        // Client-side silence / noise detection check with explicit logging
        const analysis = await checkAudioContainsSpeech(audioBlob);
        console.log("[VOICE_DEBUG] Speech Analysis Result:", analysis);

        if (!analysis.containsSpeech) {
          const msg = "No speech detected, please try again.";
          console.warn(`[VOICE_DEBUG] STT UPLOAD ABORTED. Reason: ${analysis.errorReason}`);
          setError(msg);
          onError?.(msg);
          setIsTranscribing(false);
          return;
        }

        console.log("[VOICE_DEBUG] Speech verified. Proceeding with STT backend upload...");
        await uploadAudio(audioBlob, companyId, language);
      };

      mediaRecorder.start(250); // collect chunks every 250ms
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error("[VOICE_DEBUG] Failed to start voice recording:", err);
      const msg = err.message || "Microphone access denied or error starting recording.";
      setError(msg);
      onError?.(msg);
    }
  }, [companyId, language, onError]);

  const stopRecording = useCallback(() => {
    console.log("[VOICE_DEBUG] stopRecording invoked.");
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      setIsRecording(false);
      setIsTranscribing(true);
      mediaRecorderRef.current.stop();
    }
  }, []);

  const uploadAudio = async (blob: Blob, compId?: string, selectedLang?: string) => {
    if (!compId) {
      const msg = "Company ID missing for voice intake.";
      console.error("[VOICE_DEBUG]", msg);
      setError(msg);
      onError?.(msg);
      setIsTranscribing(false);
      return;
    }

    try {
      const formData = new FormData();
      const filename = blob.type.includes("mp4") ? "recording.mp4" : "recording.webm";
      formData.append("audio", blob, filename);
      if (selectedLang) {
        formData.append("language", selectedLang);
      }

      console.log(`[VOICE_DEBUG] POSTing to /api/companies/${compId}/inventory/voice-intake (lang: ${selectedLang || "English"})...`);

      const token = localStorage.getItem("token") || localStorage.getItem("access_token");
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`/api/companies/${compId}/inventory/voice-intake`, {
        method: "POST",
        headers,
        body: formData,
      });

      console.log(`[VOICE_DEBUG] Backend response status: ${response.status}`);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || errData.details || "Voice processing failed");
      }

      const data: VoiceIntakeResponse = await response.json();
      console.log("[VOICE_DEBUG] Voice Intake Success:", data);
      setResult(data);
      onSuccess?.(data);
    } catch (err: any) {
      console.error("[VOICE_DEBUG] Error uploading audio for voice intake:", err);
      const msg = err.message || "Failed to process voice intake.";
      setError(msg);
      onError?.(msg);
    } finally {
      setIsTranscribing(false);
    }
  };

  const reset = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
    setIsTranscribing(false);
    setRecordingTime(0);
    setError(null);
    setResult(null);
  }, []);

  return {
    isRecording,
    isTranscribing,
    recordingTime,
    error,
    result,
    startRecording,
    stopRecording,
    reset,
  };
}
