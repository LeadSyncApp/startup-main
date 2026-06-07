import { Box } from "lucide-react";

interface AdvancedTuningSectionProps {
  botKnowledgeBase: string;
  setBotKnowledgeBase: (kb: string) => void;
  botLearnedContext: string;
  setBotLearnedContext: (context: string) => void;
  isTraining: boolean;
  handleTrainAI: () => void;
  handleSaveKnowledge: () => void;
  botPolicies: string;
  setBotPolicies: (policies: string) => void;
  onSyncFromCatalog?: () => void;
}

export function AdvancedTuningSection({
  botKnowledgeBase,
  setBotKnowledgeBase,
  botLearnedContext,
  setBotLearnedContext,
  isTraining,
  handleTrainAI,
  handleSaveKnowledge,
  botPolicies,
  setBotPolicies,
  onSyncFromCatalog,
}: AdvancedTuningSectionProps) {
  return (
    <>
      {/* AI KNOWLEDGE BASE & LEARNING */}
      <div className="bg-app-surface p-6 rounded-2xl shadow border space-y-4" id="advanced-tuning-knowledge-section">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span>🧠</span> AI Shop Knowledge (Advanced Tuning)
            </h2>
            <p className="text-sm text-slate-500">
              Enter detailed descriptions, suggestions, or "facts" about your products here.
            </p>
          </div>
          {onSyncFromCatalog && (
            <button
               onClick={onSyncFromCatalog}
               className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition"
            >
              <Box className="w-3.5 h-3.5" /> Pull from Catalog
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              1. Raw Item Descriptions / Notes
            </label>
            <textarea
              placeholder="Ex: 'Our Tracksuits are 100% cotton and perfect for gym. Suggest them if customers ask for breathable fabric.'"
              value={botKnowledgeBase}
              onChange={(e) => setBotKnowledgeBase(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 h-48 text-sm font-mono"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              2. What the AI Learnt (Editable)
            </label>
            <textarea
              placeholder="AI summary will appear here..."
              value={botLearnedContext}
              onChange={(e) => setBotLearnedContext(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 h-48 text-sm bg-app-bg italic"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            id="btn-train-ai-now"
            onClick={handleTrainAI}
            disabled={isTraining}
            className={`bg-indigo-600 text-white px-5 py-2 rounded-lg transition shadow-sm ${isTraining ? "opacity-50 cursor-not-allowed" : "hover:bg-indigo-700"
              }`}
          >
            {isTraining ? "AI is Learning..." : "Train AI Now 🚀"}
          </button>

          <button
            id="btn-save-knowledge-manual"
            onClick={handleSaveKnowledge}
            className="border border-app text-app-muted px-5 py-2 rounded-lg hover:bg-app-bg transition"
          >
            Save Knowledge Manually
          </button>
        </div>
      </div>

      {/* SHOP POLICIES */}
      <div className="bg-app-surface p-6 rounded-2xl shadow border space-y-4" id="shop-policies-section">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <span>📜</span> Shop Policies (Grounded Rules)
        </h2>
        <p className="text-sm text-slate-500">
          Define your delivery times, return policies, or store rules. The AI will use these to answer customer queries.
        </p>

        <textarea
          placeholder="Ex: 'Delivery takes 2 days. No returns on food items. Open from 9 AM to 9 PM.'"
          value={botPolicies}
          onChange={(e) => setBotPolicies(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 h-32 text-sm font-mono"
        />

        <div className="flex justify-end">
          <button
            id="btn-save-policies"
            onClick={handleSaveKnowledge}
            className="bg-slate-800 text-white px-5 py-2 rounded-lg hover:bg-slate-900 transition shadow-sm"
          >
            Save Policies
          </button>
        </div>
      </div>
    </>
  );
}
