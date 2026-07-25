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
  onSuccess?: (data: VoiceIntakeResponse) => void;
  onError?: (errMessage: string) => void;
}

export function useVoiceRecorder({ companyId, onSuccess, onError }: UseVoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VoiceIntakeResponse | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = useCallback(async () => {
    setError(null);
    setResult(null);
    setRecordingTime(0);
    audioChunksRef.current = [];

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const msg = "Audio recording is not supported in this browser.";
      setError(msg);
      onError?.(msg);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "";

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all audio stream tracks
        stream.getTracks().forEach((track) => track.stop());

        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType || "audio/webm",
        });

        if (audioBlob.size === 0) {
          const msg = "No audio recorded.";
          setError(msg);
          onError?.(msg);
          setIsTranscribing(false);
          return;
        }

        await uploadAudio(audioBlob, companyId);
      };

      mediaRecorder.start(250); // collect chunks every 250ms
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error("Failed to start voice recording:", err);
      const msg = err.message || "Microphone access denied or error starting recording.";
      setError(msg);
      onError?.(msg);
    }
  }, [companyId, onError]);

  const stopRecording = useCallback(() => {
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

  const uploadAudio = async (blob: Blob, compId?: string) => {
    if (!compId) {
      const msg = "Company ID missing for voice intake.";
      setError(msg);
      onError?.(msg);
      setIsTranscribing(false);
      return;
    }

    try {
      const formData = new FormData();
      const filename = blob.type.includes("mp4") ? "recording.mp4" : "recording.webm";
      formData.append("audio", blob, filename);

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

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || errData.details || "Voice processing failed");
      }

      const data: VoiceIntakeResponse = await response.json();
      setResult(data);
      onSuccess?.(data);
    } catch (err: any) {
      console.error("Error uploading audio for voice intake:", err);
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
