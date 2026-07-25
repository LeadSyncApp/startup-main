
export interface VoiceLanguageOption {
  label: string;
  code: string;
}

export const SUPPORTED_VOICE_LANGUAGES: VoiceLanguageOption[] = [
  { label: "English", code: "en-IN" },
  { label: "Hindi", code: "hi-IN" },
  { label: "Tamil", code: "ta-IN" },
  { label: "Telugu", code: "te-IN" },
  { label: "Kannada", code: "kn-IN" },
  { label: "Malayalam", code: "ml-IN" },
  { label: "Bengali", code: "bn-IN" },
  { label: "Marathi", code: "mr-IN" },
  { label: "Gujarati", code: "gu-IN" },
];

interface VoiceLanguageSelectProps {
  value: string;
  onChange: (languageLabel: string) => void;
  compact?: boolean;
}

export function VoiceLanguageSelect({
  value,
  onChange,
  compact = false,
}: VoiceLanguageSelectProps) {
  return (
    <div className="inline-flex items-center gap-1.5 text-xs">
      <label
        htmlFor="voice-language-select"
        className="font-bold text-slate-500 text-[11px] uppercase tracking-wider shrink-0"
      >
        Lang:
      </label>
      <select
        id="voice-language-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`rounded-xl border font-bold text-xs cursor-pointer transition-all focus:outline-none focus:border-purple-500 bg-white border-purple-200 text-purple-900 shadow-sm ${
          compact ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-xs"
        }`}
      >
        {SUPPORTED_VOICE_LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.label}>
            {lang.label}
          </option>
        ))}
      </select>
    </div>
  );
}
