import { useState } from "react";
import { authedFetch } from "../../api/client";

interface AiSuggestionPanelProps {
  leadId: string;
  onUseAndEdit: (suggestion: string) => void;
  latestMessageId?: string;
}

export function AiSuggestionPanel({ leadId, onUseAndEdit, latestMessageId }: AiSuggestionPanelProps) {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [rationale, setRationale] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggestionForMessageId, setSuggestionForMessageId] = useState<string | null>(null);

  const generateSuggestion = async () => {
    if (!leadId) return;
    setLoading(true);
    setError(null);
    setSuggestion(null);
    setRationale(null);

    try {
      const res = await authedFetch(`/api/leads/${leadId}/ai-suggest`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to generate suggestion");
      }
      const data = await res.json();
      setSuggestion(data.suggestion);
      setRationale(data.rationale);
      setSuggestionForMessageId(latestMessageId ?? null);
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (suggestion) {
      await navigator.clipboard.writeText(suggestion);
    }
  };

  const handleUseAndEdit = () => {
    if (suggestion) {
      onUseAndEdit(suggestion);
    }
  };

  return (
    <div className="p-3">
      {!suggestion && !loading && !error && (
        <button
          onClick={generateSuggestion}
          disabled={loading}
          className="px-3 py-1.5 bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 rounded text-xs font-black transition cursor-pointer"
        >
          Generate suggestion
        </button>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <div className="w-3 h-3 border border-teal-400/30 border-t-teal-400 rounded-full animate-spin" />
          Generating...
        </div>
      )}

      {error && (
        <div className="text-xs text-rose-400">
          {error}
          <button
            onClick={generateSuggestion}
            disabled={loading}
            className="ml-2 underline cursor-pointer"
          >
            retry
          </button>
        </div>
      )}

      {suggestion && (
        <div className="space-y-2">
          {suggestion && latestMessageId && latestMessageId !== suggestionForMessageId && (
            <p className="text-[10px] text-amber-400/80 italic font-mono">
              New message — this suggestion may be outdated
            </p>
          )}
          {rationale && (
            <p className="text-[10px] text-slate-500 italic font-mono">
              {rationale}
            </p>
          )}
          <div className="p-3 border border-slate-700 rounded-xl bg-slate-800/30">
            <p className="text-sm text-slate-200">{suggestion}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="px-2 py-1 text-[10px] font-black text-slate-400 hover:text-slate-300 border border-slate-700 rounded cursor-pointer transition"
            >
              Copy
            </button>
            <button
              onClick={handleUseAndEdit}
              className="px-2 py-1 text-[10px] font-black text-amber-300 hover:text-amber-200 border border-amber-500/30 rounded cursor-pointer transition"
            >
              Use and edit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AiSuggestionPanel;