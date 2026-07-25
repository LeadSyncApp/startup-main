import { motion, AnimatePresence } from "framer-motion";
import { Mic, Square, Loader2, Sparkles, AlertCircle } from "lucide-react";
import { useVoiceRecorder, VoiceIntakeResponse } from "../hooks/useVoiceRecorder";

interface VoiceMicButtonProps {
  companyId?: string;
  language?: string;
  onExtractionComplete: (result: VoiceIntakeResponse) => void;
  buttonText?: string;
  compact?: boolean;
}

export function VoiceMicButton({
  companyId,
  language,
  onExtractionComplete,
  buttonText = "Fill with voice",
  compact = false,
}: VoiceMicButtonProps) {
  const {
    isRecording,
    isTranscribing,
    recordingTime,
    error,
    result,
    startRecording,
    stopRecording,
  } = useVoiceRecorder({
    companyId,
    language,
    onSuccess: (res) => {
      onExtractionComplete(res);
    },
  });

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex items-center gap-2">
        {/* IDLE STATE */}
        {!isRecording && !isTranscribing && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={startRecording}
            className={`inline-flex items-center gap-2 font-bold rounded-xl shadow-sm transition-all cursor-pointer border ${
              compact
                ? "px-3 py-1.5 text-xs"
                : "px-4 py-2 text-xs sm:text-sm"
            }`}
            style={{
              backgroundColor: "rgba(211, 107, 70, 0.08)",
              borderColor: "var(--brand-saffron)",
              color: "var(--brand-saffron)",
            }}
          >
            <Mic className={`${compact ? "h-3.5 w-3.5" : "h-4 w-4"} text-brand-saffron`} />
            <span>{buttonText}</span>
          </motion.button>
        )}

        {/* RECORDING STATE */}
        {isRecording && (
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 animate-pulse">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
              </span>
              <span className="font-mono font-bold text-xs">
                {formatTime(recordingTime)} / Listening...
              </span>
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={stopRecording}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg inline-flex items-center gap-1 cursor-pointer shadow-sm"
            >
              <Square className="h-3 w-3 fill-current" />
              <span>Done</span>
            </motion.button>
          </div>
        )}

        {/* TRANSCRIBING STATE */}
        {isTranscribing && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 text-xs font-bold">
            <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
            <span>Transcribing (Sarvam saaras:v3) & extracting fields (Groq)...</span>
          </div>
        )}
      </div>

      {/* ERROR FEEDBACK */}
      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/20">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* TRANSCRIPT PREVIEW BADGE */}
      {result && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-xs p-2.5 rounded-lg border w-full space-y-1"
            style={{
              backgroundColor: "var(--app-bg)",
              borderColor: "var(--app-border)",
              color: "var(--app-text)",
            }}
          >
            <div className="flex items-center gap-1 font-bold text-brand-saffron">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Voice Transcript Captured:</span>
            </div>
            <p className="italic font-medium" style={{ color: "var(--app-text-muted)" }}>
              "{result.transcript}"
            </p>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
