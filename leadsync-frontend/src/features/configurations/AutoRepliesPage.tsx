import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Sparkles, Zap, RefreshCw, Play, StopCircle,
  Trash2, Plus, Edit3, Clock, Save, Globe
} from "lucide-react";
import { toast } from "react-hot-toast";
import { authedFetch, generateSmartRules, listSmartRules, updateSmartRule, deleteSmartRule, createRuleGroup, listRuleGroups, deleteRuleGroup, testInstruction, generateExample, createSmartRule } from "../../api/client";

/* ──────────────────────────────────────────────────────────────
   Types
   ────────────────────────────────────────────────────────────── */

interface AutoReplyRule {
  id: string;
  eventKey: string;
  isEnabled: boolean;
  messageBody: string;
  delayMinutes: number;
  useAI: boolean;
}

interface AutoReplyEventMeta {
  label: string;
  description: string;
  icon: string;
  category: "order" | "lead";
}

const EVENT_METADATA: Record<string, AutoReplyEventMeta> = {
  "order.placed":    { label: "New Order Placed",    description: "Customer places a new order",                 icon: "🛒", category: "order" },
  "order.confirmed": { label: "Order Confirmed",     description: "You confirm the customer's order",           icon: "✅", category: "order" },
  "order.preparing": { label: "Preparing Order",     description: "You start preparing the order",               icon: "👨‍🍳", category: "order" },
  "order.ready":     { label: "Order Ready",         description: "Order ready for pickup/delivery",              icon: "📦", category: "order" },
  "order.delivered": { label: "Order Delivered",     description: "After successful delivery",                   icon: "🎉", category: "order" },
  "lead.welcome":    { label: "Welcome Message",     description: "New customer messages you first time",         icon: "👋", category: "lead" },
  "lead.followup":   { label: "Follow-Up",           description: "Customer hasn't replied in a while",          icon: "⏰", category: "lead" },
  "lead.cold_recovery": { label: "Cold Lead Recovery", description: "Re-engage customers who went cold",         icon: "🧊", category: "lead" },
};

const FLOW_ORDER_EVENTS = ["order.placed", "order.confirmed", "order.preparing", "order.ready", "order.delivered"];
const FLOW_LEAD_EVENTS = ["lead.welcome", "lead.followup", "lead.cold_recovery"];

const SUPPORTED_LANGUAGES = [
  { code: "ta", label: "தமிழ்", flag: "🇮🇳" },
  { code: "hi", label: "हिंदी", flag: "🇮🇳" },
  { code: "te", label: "తెలుగు", flag: "🇮🇳" },
  { code: "bn", label: "বাংলা", flag: "🇮🇳" },
  { code: "en", label: "English", flag: "🇬🇧" },
];

type ViewType = "ai-list" | "ai-detail" | "events-list" | "events-detail";

/* ──────────────────────────────────────────────────────────────
   Main Component
   ────────────────────────────────────────────────────────────── */

export function AutoRepliesPage() {
  // Navigation
  const [currentView, setCurrentView] = useState<ViewType>("ai-list");

  // AI Instructions state
  const [instructions, setInstructions] = useState<any[]>([]);
  const [instructionsLoading, setInstructionsLoading] = useState(true);
  const [instructionInput, setInstructionInput] = useState("");

  // Event Auto-Replies state
  const [rules, setRules] = useState<AutoReplyRule[]>([]);
  const [activeFlow, setActiveFlow] = useState<"order" | "lead">("order");

  // Generate zone
  const [quickInput, setQuickInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewMessages, setPreviewMessages] = useState<{ eventKey: string; message: string }[]>([]);

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createFlowName, setCreateFlowName] = useState("");

  // New flow description (AI generate)
  const [flowDescription, setFlowDescription] = useState("");
  const [showDescriptionPrompt, setShowDescriptionPrompt] = useState(false);
  const [isFirstTimeSetup, setIsFirstTimeSetup] = useState(false);
  const [selectedAiProfile, setSelectedAiProfile] = useState<{ name: string; desc: string } | null>(null);
  const [selectedEventProfile, setSelectedEventProfile] = useState<{ name: string; desc: string } | null>(null);

  // Server-backed rule groups (automation flows)
  const [ruleGroups, setRuleGroups] = useState<any[]>([]);
  const [ruleGroupsLoading, setRuleGroupsLoading] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // Inline editing state (for event detail view)
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editMessage, setEditMessage] = useState("");
  const [editDelay, setEditDelay] = useState(0);
  const [editUseAI, setEditUseAI] = useState(false);
  const [editBrandVoice, setEditBrandVoice] = useState<"formal" | "casual" | "friendly" | "salesy">("friendly");
  const [editLanguage, setEditLanguage] = useState<"en" | "hi" | "ta" | "te" | "bn">("en");
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'gallery'>('list');

  // Preview-before-confirm state
  const [previewRule, setPreviewRule] = useState<any>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Fetch on mount
  useEffect(() => {
    fetchInstructions();
    fetchRules();
    fetchRuleGroups();
  }, []);

  // ── API: AI Instructions ──

  const fetchInstructions = async (groupId?: string) => {
    try {
      setInstructionsLoading(true);
      const data = await listSmartRules(groupId);
      setInstructions(data.rules || []);
    } catch {
      setInstructions([]);
    } finally {
      setInstructionsLoading(false);
    }
  };

  const addInstruction = async () => {
    if (!instructionInput.trim()) {
      toast.error("Please type an instruction");
      return;
    }
    if (!isValidInstructionInput(instructionInput)) {
      toast.error("Please write a full sentence describing the instruction");
      return;
    }
    try {
      const data = await generateSmartRules(instructionInput, selectedGroupId || undefined);
      if (data.rule) {
        setPreviewRule({ ...data.rule, _groupSource: selectedGroupId || undefined });
        setShowPreviewModal(true);
      } else {
        toast.error("Could not create instruction. Try again.");
      }
    } catch {
      toast.error("Failed to save instruction");
    }
  };

  const deleteInstruction = async (ruleId: string) => {
    try {
      await deleteSmartRule(ruleId);
      setInstructions(prev => prev.filter(r => r.id !== ruleId));
      toast.success("Instruction removed");
    } catch {
      toast.error("Failed to remove instruction");
    }
  };

  const toggleInstruction = async (ruleId: string, currentEnabled: boolean) => {
    try {
      const data = await updateSmartRule(ruleId, { isEnabled: !currentEnabled });
      if (data.rule) {
        setInstructions(prev => prev.map(r => r.id === ruleId ? data.rule : r));
      } else {
        await fetchInstructions();
      }
      toast.success(currentEnabled ? "Instruction disabled" : "Instruction enabled");
    } catch {
      toast.error("Failed to update instruction");
    }
  };

  // ── API: Event Auto-Replies ──

  const fetchRules = async () => {
    try {
      const res = await authedFetch("/api/auto-reply/rules");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setRules(data.rules || []);
    } catch {
      toast.error("Could not load auto-reply settings");
    }
  };

  const toggleRule = async (rule: AutoReplyRule) => {
    try {
      const res = await authedFetch(`/api/auto-reply/rules/${rule.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled: !rule.isEnabled }),
      });
      if (!res.ok) throw new Error("Failed to update");
      const data = await res.json();
      setRules(prev => prev.map(r => r.id === rule.id ? data.rule : r));
      toast.success(rule.isEnabled ? "Auto-reply turned OFF" : "Auto-reply turned ON");
    } catch {
      toast.error("Failed to toggle");
    }
  };

  const deleteRule = async (ruleId: string) => {
    try {
      const res = await authedFetch(`/api/auto-reply/rules/${ruleId}`, { method: "DELETE" });
      if (res.ok) {
        setRules(prev => prev.filter(r => r.id !== ruleId));
        toast.success("Rule deleted");
      } else {
        throw new Error("Failed to delete");
      }
    } catch {
      toast.error("Failed to delete rule");
    }
  };

  const saveInlineEdit = async (ruleId: string) => {
    try {
      setSaving(true);
      const res = await authedFetch(`/api/auto-reply/rules/${ruleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageBody: editMessage,
          delayMinutes: editDelay,
          useAI: editUseAI,
          brandVoice: editBrandVoice,
          targetLanguage: editLanguage,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      const data = await res.json();
      setRules(prev => prev.map(r => r.id === ruleId ? data.rule : r));
      setEditingRuleId(null);
      toast.success("Message updated! ✨");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const generateQuickAutomation = async () => {
    if (!quickInput.trim()) {
      toast.error("Please type your message or offer");
      return;
    }
    try {
      setGenerating(true);
      setShowPreview(false);
      const res = await authedFetch("/api/auto-reply/generate-from-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: quickInput, language: "auto" }),
      });
      if (!res.ok) throw new Error("Failed to generate");
      const data = await res.json();
      const genRules = data.rules || [];
      const previews = genRules
        .filter((r: AutoReplyRule) => r.messageBody && r.messageBody.length > 0)
        .slice(0, 3)
        .map((r: AutoReplyRule) => ({ eventKey: r.eventKey, message: r.messageBody }));
      setPreviewMessages(previews);
      setRules(genRules);
      if (previews.length === 0) {
        toast.error("Could not generate. Try again.");
      } else {
        toast.success("Preview ready!");
      }
      setShowPreview(true);
    } catch {
      toast.error("Failed to generate messages");
    } finally {
      setGenerating(false);
    }
  };

  const getRule = (eventKey: string) => rules.find(r => r.eventKey === eventKey);

  const formatDelay = (minutes: number) => {
    if (minutes === 0) return "Immediately";
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days} day${days > 1 ? "s" : ""}`;
    return `${hours} hour${hours > 1 ? "s" : ""}`;
  };

  // Test states for each instruction
  const [testStates, setTestStates] = useState<Record<string, { 
    input: string; 
    result: string | null; 
    testing: boolean;
    exampleLoaded: boolean;
    customerExample: string;
    botExample: string;
  }>>({});

  // Load example conversation when instruction changes
  const loadExampleConversation = async (instId: string, instruction: string) => {
    try {
      const data = await generateExample(instruction);
      setTestStates(prev => ({
        ...prev,
        [instId]: {
          ...prev[instId],
          customerExample: data.customerMessage,
          botExample: data.botResponse,
          exampleLoaded: true
        }
      }));
    } catch (error) {
      console.error("Failed to load example:", error);
    }
  };

  // Test instruction with real AI
  const handleTestInstruction = async (instId: string, instruction: string) => {
    const state = testStates[instId] || { 
      input: '', 
      result: null, 
      testing: false,
      exampleLoaded: false,
      customerExample: '',
      botExample: ''
    };
    
    if (!state.input.trim()) return;
    
    setTestStates(prev => ({
      ...prev,
      [instId]: { ...state, testing: true, result: null }
    }));
    
    try {
      const data = await testInstruction(instruction, state.input);
      setTestStates(prev => ({
        ...prev,
        [instId]: { ...state, testing: false, result: data.response }
      }));
    } catch (error) {
      console.error("Failed to test instruction:", error);
      setTestStates(prev => ({
        ...prev,
        [instId]: { ...state, testing: false, result: "Sorry, I couldn't process that. Please try again." }
      }));
    }
  };

  const updateTestInput = (instId: string, value: string) => {
    setTestStates(prev => ({
      ...prev,
      [instId]: {
        ...prev[instId],
        input: value,
        result: prev[instId]?.result || null,
        testing: prev[instId]?.testing || false
      }
    }));
  };

  // Initialize example when component mounts/updates
  useEffect(() => {
    instructions.forEach(inst => {
      const state = testStates[inst.id];
      if (!state?.exampleLoaded && inst.isEnabled) {
        loadExampleConversation(inst.id, inst.sourcePrompt || inst.name || '');
      }
    });
  }, [instructions, testStates]);

  const activeRulesCount = (flow: "order" | "lead") =>
    (flow === "order" ? FLOW_ORDER_EVENTS : FLOW_LEAD_EVENTS)
      .filter(e => getRule(e)?.isEnabled).length;

  const totalRulesCount = (flow: "order" | "lead") =>
    (flow === "order" ? FLOW_ORDER_EVENTS : FLOW_LEAD_EVENTS).length;

  // ── Virtual flow data (grouped from rules by eventKey category) ──

  const orderRules = rules.filter(r => EVENT_METADATA[r.eventKey]?.category === "order");
  const leadRules = rules.filter(r => EVENT_METADATA[r.eventKey]?.category === "lead");

  // ── Create Flow ──

  const openCreateModal = (_section: "ai" | "events") => {
    setCreateFlowName("");
    setShowCreateModal(true);
  };

  const fetchRuleGroups = async () => {
    try {
      setRuleGroupsLoading(true);
      const data = await listRuleGroups("AI_INSTRUCTION");
      setRuleGroups(data.groups || []);
    } catch {
      setRuleGroups([]);
    } finally {
      setRuleGroupsLoading(false);
    }
  };

  const handleCreateFlow = async () => {
    const name = createFlowName.trim();
    if (!name) {
      toast.error("Please enter a flow name");
      return;
    }
    setShowCreateModal(false);

    try {
      const data = await createRuleGroup(name, "", "AI_INSTRUCTION");
      const group = data.group;
      if (group) {
        await fetchRuleGroups();
        setSelectedGroupId(group.id);
        setSelectedAiProfile({ name: `✨ ${group.name}`, desc: "Describe what you want the bot to do" });
        setShowDescriptionPrompt(true);
        setIsFirstTimeSetup(true);
        setCurrentView("ai-detail");
        setFlowDescription("");
        setInstructions([]);
        toast.success(`Flow "${group.name}" created!`);
      }
    } catch {
      toast.error("Failed to create flow. Please try again.");
    }
  };

  const handleGenerateFlow = async () => {
    if (!flowDescription.trim()) {
      toast.error("Please describe your automation flow");
      return;
    }
    if (!isValidInstructionInput(flowDescription)) {
      toast.error("Please write a full sentence describing the instruction");
      return;
    }
    if (!selectedGroupId) {
      toast.error("No flow selected. Please create a flow first.");
      return;
    }
    try {
      const data = await generateSmartRules(flowDescription, selectedGroupId);
      if (data.rule) {
        setPreviewRule({ ...data.rule, _groupSource: selectedGroupId });
        setShowPreviewModal(true);
      } else {
        toast.error("Could not generate instructions. Try again.");
      }
    } catch {
      toast.error("Failed to generate flow. Check your AI API key.");
    }
  };

  // ── Input Validation Helpers ──

  const isValidInstructionInput = (text: string): boolean => {
    // Frontend only blocks empty/whitespace input.
    // Quality validation is now handled by the backend's AI-output confidence checks.
    return text.trim().length > 0;
  };

  // ── Confirm Save (Preview → Persist) ──

  const confirmSavePreview = async () => {
    if (!previewRule) return;
    const { needsReview, clarificationHint, _groupSource, ...ruleFields } = previewRule;
    try {
      setSaving(true);
      const payload = {
        ...ruleFields,
        groupId: _groupSource || selectedGroupId || null,
        isEnabled: !previewRule.needsReview,
        sourcePrompt: previewRule.sourcePrompt || "",
      };
      const result = await createSmartRule(payload);
      if (result.rule) {
        setShowPreviewModal(false);
        setPreviewRule(null);
        if (instructionInput) setInstructionInput("");
        if (flowDescription) { setFlowDescription(""); setShowDescriptionPrompt(false); setIsFirstTimeSetup(false); }
        await fetchInstructions(selectedGroupId || _groupSource || undefined);
        toast.success("✨ Instruction saved!");
      } else {
        toast.error("Could not save instruction. Try again.");
      }
    } catch {
      toast.error("Failed to save instruction");
    } finally {
      setSaving(false);
    }
  };

  const discardPreview = () => {
    setShowPreviewModal(false);
    setPreviewRule(null);
  };

  // ── Navigation ──

  const navigateTo = (view: ViewType) => {
    setShowDescriptionPrompt(false);
    setCurrentView(view);
    if (view !== "events-detail") {
      setEditingRuleId(null);
    }
    if (view === "ai-list") {
      fetchInstructions();
    }
  };

  /* ═══════════════════════════════════════════════════════
     RENDER: AI Instructions - List View
     ═══════════════════════════════════════════════════════ */
  const renderAiList = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight" style={{ color: 'var(--app-text)' }}>
          🧠 AI Instructions
        </h1>
        <p className="font-medium text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          Each flow is a collection of behavioral rules the bot follows in every conversation.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {ruleGroups.length === 0 && !ruleGroupsLoading && (
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center">
            <div className="text-3xl mb-3">🧠</div>
            <h3 className="text-base font-bold text-slate-600 mb-1">No automation flows yet</h3>
            <p className="text-xs text-slate-400 mb-4 max-w-xs mx-auto">
              Create a new automation flow to get started.
            </p>
          </div>
        )}

        {ruleGroupsLoading && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        )}

        {ruleGroups.map((group) => (
          <div
            key={group.id}
            className="bg-white rounded-2xl border-2 border-slate-200 p-4 flex items-center gap-4 hover:border-purple-300 transition-all cursor-pointer"
            onClick={() => {
              setSelectedGroupId(group.id);
              setSelectedAiProfile({ name: `✨ ${group.name}`, desc: "Describe what you want the bot to do" });
              setShowDescriptionPrompt(false);
              setCurrentView("ai-detail");
              setFlowDescription("");
              fetchInstructions(group.id);
            }}
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white text-lg shrink-0">
              <Brain className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <span className="font-bold text-sm text-slate-800">{group.name}</span>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-slate-100 text-slate-500">
                  {group._count?.rules || 0} rules
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 truncate">{group.description || "Automation flow"}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0 text-xs text-slate-400 font-medium">
              <span>✨ {group._count?.rules || 0} instructions</span>
            </div>
            <button
              onClick={async (e) => {
                e.stopPropagation();
                if (!confirm(`Delete flow "${group.name}" and all its instructions? This cannot be undone.`)) return;
                try {
                  await deleteRuleGroup(group.id);
                  await fetchRuleGroups();
                  await fetchInstructions();
                  toast.success(`Flow "${group.name}" deleted`);
                } catch {
                  toast.error("Failed to delete flow");
                }
              }}
              className="p-2 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        {!instructionsLoading && instructions.filter((inst: any) => !inst.groupId).map((inst) => (
          <div
            key={inst.id}
            className="bg-white rounded-2xl border-2 border-slate-200 p-4 flex items-center gap-4 hover:border-purple-300 transition-all cursor-pointer"
            onClick={() => {
              setSelectedGroupId(inst.groupId || null);
              setSelectedAiProfile({
                name: inst.sourcePrompt || inst.name || "AI Instruction",
                desc: "Manage your instruction rules"
              });
              setShowDescriptionPrompt(false);
              setCurrentView("ai-detail");
            }}
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white text-lg shrink-0">
              <Brain className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <span className="font-bold text-sm text-slate-800">
                  {inst.sourcePrompt || inst.name || "Instruction"}
                </span>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${inst.isEnabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                  {inst.isEnabled ? "Active" : "Draft"}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 truncate">
                {inst.triggerKeywords?.slice(0, 2).join(", ") || "Behavioral rule"}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={(e) => { e.stopPropagation(); toggleInstruction(inst.id, inst.isEnabled); }}
                className={`p-2 rounded-xl transition-all cursor-pointer ${inst.isEnabled ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
              >
                {inst.isEnabled ? <Play className="w-3.5 h-3.5" /> : <StopCircle className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); deleteInstruction(inst.id); }}
                className="p-2 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => openCreateModal("ai")}
        className="w-full flex items-center justify-center gap-3 p-5 border-2 border-dashed border-slate-200 rounded-2xl text-sm font-bold text-slate-400 hover:border-purple-400 hover:text-purple-600 hover:bg-purple-50/30 transition-all cursor-pointer"
      >
        <Plus className="w-5 h-5" />
        Create New Automation Flow
      </button>
    </div>
  );

  /* ═══════════════════════════════════════════════════════
     RENDER: AI Instructions - Detail View (with Timeline)
     ═══════════════════════════════════════════════════════ */
  const renderAiDetail = () => (
    <div className="space-y-6">
      <button
        onClick={() => navigateTo("ai-list")}
        className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:border-slate-400 transition-all cursor-pointer"
      >
        ← Back to AI Instructions
      </button>

      <div className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight" style={{ color: 'var(--app-text)' }}>
          {selectedAiProfile?.name || "AI Instructions"}
        </h1>
        <p className="font-medium text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {selectedAiProfile?.desc || "Manage your instruction rules"}
        </p>
      </div>

      {isFirstTimeSetup ? (
        <div className="bg-white rounded-3xl border-2 border-purple-200 p-5 md:p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white shadow-lg shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-black text-slate-800 text-lg">✨ Describe Your Flow</h2>
              <p className="text-xs text-slate-500">Just tell the AI what you want — it will build the flow for you</p>
            </div>
          </div>
          <textarea
            value={flowDescription}
            onChange={e => setFlowDescription(e.target.value)}
            rows={3}
            className="w-full bg-slate-50 border-2 border-purple-200 rounded-2xl px-5 py-4 text-base text-slate-800 focus:outline-none focus:border-purple-500 focus:bg-white transition-all resize-none font-medium placeholder:text-slate-400"
            placeholder="Describe what you want the bot to do...&#10;Example: I want the bot to always reply in the customer's language and be friendly with emojis"
          />
          <div className="flex justify-end">
            <button
              onClick={handleGenerateFlow}
              disabled={!flowDescription.trim()}
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-2xl font-bold text-sm transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-lg shadow-purple-500/20"
            >
              <Sparkles className="w-4 h-4" />
              Generate My Flow
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-3xl border-2 border-purple-200 p-5 md:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white shadow-lg shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-black text-slate-800 text-lg">✨ Describe Your Flow</h2>
                  <p className="text-xs text-slate-500">Generate new instructions with AI</p>
                </div>
              </div>
              <button
                onClick={() => setShowDescriptionPrompt(!showDescriptionPrompt)}
                className="px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-xs font-bold transition-all cursor-pointer border border-purple-200"
              >
                {showDescriptionPrompt ? 'Hide' : 'Show'}
              </button>
            </div>
            
            <AnimatePresence>
              {showDescriptionPrompt && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4"
                >
                  <textarea
                    value={flowDescription}
                    onChange={e => setFlowDescription(e.target.value)}
                    rows={3}
                    className="w-full bg-slate-50 border-2 border-purple-200 rounded-2xl px-5 py-4 text-base text-slate-800 focus:outline-none focus:border-purple-500 focus:bg-white transition-all resize-none font-medium placeholder:text-slate-400"
                    placeholder="Describe what you want the bot to do...&#10;Example: I want the bot to always reply in the customer's language and be friendly with emojis"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={handleGenerateFlow}
                      disabled={!flowDescription.trim()}
                      className="px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-2xl font-bold text-sm transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-lg shadow-purple-500/20"
                    >
                      <Sparkles className="w-4 h-4" />
                      Generate My Flow
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="bg-white rounded-3xl border-2 border-purple-200 p-5 md:p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white shadow-lg shrink-0">
                <Brain className="w-5 h-5" />
              </div>
            <div className="flex-1">
              <h2 className="font-black text-slate-800 text-lg">🧠 Your Instructions</h2>
              <p className="text-xs text-slate-500">The bot follows these rules automatically</p>
            </div>
            <div className="flex items-center bg-slate-100 rounded-xl p-0.5 shrink-0">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${viewMode === 'list' ? 'bg-white border border-slate-200 text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                List
              </button>
              <button
                onClick={() => setViewMode('gallery')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${viewMode === 'gallery' ? 'bg-white border border-slate-200 text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Gallery
              </button>
            </div>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={instructionInput}
                onChange={e => setInstructionInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addInstruction()}
                className="flex-1 bg-slate-50 border-2 border-purple-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-purple-500 transition-all font-medium"
                placeholder="Type an instruction... e.g. Always reply in customer's language"
              />
              <button
                onClick={addInstruction}
                disabled={!instructionInput.trim()}
                className="px-5 py-2.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-bold text-sm hover:from-purple-600 hover:to-purple-700 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2 shadow-lg shadow-purple-500/20"
              >
                <Sparkles className="w-4 h-4" />
                Add
              </button>
            </div>

            {viewMode === 'list' ? (
              <>
              {instructions.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                <div className="text-2xl mb-2">🧠</div>
                <p className="text-xs text-slate-400 font-medium">
                  No instructions yet. Type one above to tell the bot how to behave.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {instructions.map((inst) => (
                  <div key={inst.id} className={`bg-white rounded-2xl border-2 p-5 transition-all ${inst.isEnabled ? 'border-purple-200 shadow-sm' : 'border-slate-100 opacity-70'}`}>
                    
                    {/* Header: Instruction info + Toggle/Delete */}
                    <div className="flex items-start justify-between mb-4 pb-4 border-b border-slate-100">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${inst.isEnabled ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-500'}`}>
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="text-[10px] font-black uppercase tracking-[0.1em] px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                              Instruction
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${inst.isEnabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                              {inst.isEnabled ? 'Active' : 'Disabled'}
                            </span>
                          </div>
                          <p className="text-base font-bold text-slate-800 leading-snug">
                            {inst.sourcePrompt || inst.name || "Instruction"}
                          </p>
                          {inst.triggerKeywords && inst.triggerKeywords.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {inst.triggerKeywords.slice(0, 5).map((kw: string, i: number) => (
                                <span key={i} className="text-[10px] bg-purple-50 text-purple-600 border border-purple-100 px-1.5 py-0.5 rounded font-medium">{kw}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 shrink-0 ml-4">
                        <button
                          onClick={() => toggleInstruction(inst.id, inst.isEnabled)}
                          className={`relative w-11 h-6 rounded-full transition-all cursor-pointer ${inst.isEnabled ? "bg-green-500" : "bg-slate-300"}`}
                        >
                          <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${inst.isEnabled ? "translate-x-5" : ""}`} />
                        </button>
                        <button
                          onClick={() => deleteInstruction(inst.id)}
                          className="p-2 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Body: Example and Test */}
                    <div className="grid md:grid-cols-2 gap-4">
                      {/* Left Side: Example Conversation */}
                      <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-100">
                        {(() => {
                          const state = testStates[inst.id];
                          if (!state?.exampleLoaded) {
                            return (
                              <div>
                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                  <Sparkles className="w-3 h-3" />
                                  Example Conversation
                                </div>
                                <div className="text-center py-4">
                                  <RefreshCw className="w-4 h-4 animate-spin text-slate-400 mx-auto" />
                                </div>
                              </div>
                            );
                          }
                          return (
                            <div>
                              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                <Sparkles className="w-3 h-3" />
                                Example Conversation
                              </div>
                              <div className="space-y-3">
                                <div className="flex items-start gap-2">
                                  <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs shrink-0">👤</div>
                                  <div className="bg-white rounded-xl px-3 py-2 border border-slate-200 text-xs text-slate-700 shadow-sm flex-1">
                                    {state.customerExample}
                                  </div>
                                </div>
                                <div className="flex items-start gap-2">
                                  <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-xs shrink-0 text-white">🤖</div>
                                  <div className="bg-purple-600 text-white rounded-xl px-3 py-2 shadow-sm text-xs flex-1">
                                    {state.botExample}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Right Side: Interactive Test Box */}
                      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                        <div className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                          <Zap className="w-3 h-3" />
                          Test With Your Inputs
                        </div>
                        <p className="text-[10px] text-slate-500 mb-3">See how the bot responds to custom messages</p>
                        
                        <div className="space-y-2">
                          <textarea
                            value={testStates[inst.id]?.input || ''}
                            onChange={(e) => updateTestInput(inst.id, e.target.value)}
                            placeholder="Type a message... e.g. 'Hello'"
                            rows={2}
                            className="w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-purple-400 transition-all resize-none font-medium"
                          />
                          <button
                            onClick={() => handleTestInstruction(inst.id, inst.sourcePrompt || inst.name || '')}
                            disabled={!testStates[inst.id]?.input?.trim() || testStates[inst.id]?.testing}
                            className="w-full px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                          >
                            {testStates[inst.id]?.testing ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                Testing...
                              </>
                            ) : (
                              <>
                                <Play className="w-3.5 h-3.5 fill-current" />
                                Run Test
                              </>
                            )}
                          </button>
                          
                          {/* Test Result */}
                          {testStates[inst.id]?.result && (
                            <div className="mt-3 pt-3 border-t border-slate-200 space-y-3">
                              <div className="flex items-start gap-2">
                                <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs shrink-0">👤</div>
                                <div className="bg-white rounded-xl px-3 py-2 border border-slate-200 text-xs text-slate-700 shadow-sm flex-1">
                                  {testStates[inst.id].input}
                                </div>
                              </div>
                              <div className="flex items-start gap-2">
                                <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-xs shrink-0 text-white">🤖</div>
                                <div className="bg-purple-600 text-white rounded-xl px-3 py-2 shadow-sm text-xs flex-1">
                                  {testStates[inst.id].result}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
              </>
            ) : (
              <>
              {instructions.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                  <div className="text-2xl mb-2">🧠</div>
                  <p className="text-xs text-slate-400 font-medium">
                    No instructions yet. Type one above to tell the bot how to behave.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4">
                  {instructions.map((inst) => (
                    <div
                      key={inst.id}
                      onClick={() => setViewMode('list')}
                      className="bg-white rounded-2xl border-2 p-3 hover:border-purple-300 transition-all cursor-pointer"
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${inst.isEnabled ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-500'}`}>
                        <Brain className="w-4 h-4" />
                      </div>
                      <p className="text-xs font-bold text-slate-800 truncate">
                        {inst.sourcePrompt || inst.name || "Instruction"}
                      </p>
                      <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded mt-1.5 ${inst.isEnabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                        {inst.isEnabled ? 'Active' : 'Disabled'}
                      </span>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {inst.triggerKeywords?.length || 0} keywords
                      </p>
                    </div>
                  ))}
                </div>
              )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );

  /* ═══════════════════════════════════════════════════════
     RENDER: Event Auto-Replies - List View
     ═══════════════════════════════════════════════════════ */
  const renderEventList = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight" style={{ color: 'var(--app-text)' }}>
          ⚡ Event Auto-Replies
        </h1>
        <p className="font-medium text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          Each flow is a collection of event-driven messages. Click to see and edit each one.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div
          className="bg-white rounded-2xl border-2 border-slate-200 p-4 flex items-center gap-4 hover:border-teal-300 transition-all cursor-pointer"
          onClick={() => {
            setSelectedEventProfile({ name: "🛍️ Order Updates", desc: "Messages sent during the order lifecycle" });
            setShowDescriptionPrompt(false);
            setCurrentView("events-detail");
          }}
        >
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-lg shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <span className="font-bold text-sm text-slate-800">🛍️ Order Updates</span>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${orderRules.some(r => r.isEnabled) ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                {orderRules.some(r => r.isEnabled) ? "Active" : "Draft"}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 truncate">
              {orderRules.length} events · {orderRules.filter(r => r.isEnabled).length} active
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 text-xs text-slate-400 font-medium">
            <span>{orderRules.filter(r => r.isEnabled).length}/{orderRules.length}</span>
          </div>
        </div>

        <div
          className="bg-white rounded-2xl border-2 border-slate-200 p-4 flex items-center gap-4 hover:border-teal-300 transition-all cursor-pointer"
          onClick={() => {
            setSelectedEventProfile({ name: "💬 Customer Messages", desc: "Lead conversations, follow-ups, and re-engagement" });
            setShowDescriptionPrompt(false);
            setCurrentView("events-detail");
          }}
        >
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-lg shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <span className="font-bold text-sm text-slate-800">💬 Customer Messages</span>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${leadRules.some(r => r.isEnabled) ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                {leadRules.some(r => r.isEnabled) ? "Active" : "Draft"}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 truncate">
              {leadRules.length} events · {leadRules.filter(r => r.isEnabled).length} active
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 text-xs text-slate-400 font-medium">
            <span>{leadRules.filter(r => r.isEnabled).length}/{leadRules.length}</span>
          </div>
        </div>
      </div>

      <button
        onClick={() => openCreateModal("events")}
        className="w-full flex items-center justify-center gap-3 p-5 border-2 border-dashed border-slate-200 rounded-2xl text-sm font-bold text-slate-400 hover:border-teal-400 hover:text-teal-600 hover:bg-teal-50/30 transition-all cursor-pointer"
      >
        <Plus className="w-5 h-5" />
        Create New Event Flow
      </button>
    </div>
  );

  /* ═══════════════════════════════════════════════════════
     RENDER: Event Auto-Replies - Detail View (with Timeline)
     ═══════════════════════════════════════════════════════ */
  const renderEventDetail = () => {
    const flowEvents = activeFlow === "order" ? FLOW_ORDER_EVENTS : FLOW_LEAD_EVENTS;

    return (
      <div className="space-y-6">
        <button
          onClick={() => navigateTo("events-list")}
          className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:border-slate-400 transition-all cursor-pointer"
        >
          ← Back to Event Flows
        </button>

        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight" style={{ color: 'var(--app-text)' }}>
            {selectedEventProfile?.name || "⚡ Event Auto-Replies"}
          </h1>
          <p className="font-medium text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {selectedEventProfile?.desc || "Bot sends messages automatically when things happen"}
          </p>
        </div>

        <AnimatePresence>
          {showDescriptionPrompt && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-white rounded-3xl border-2 border-teal-200 p-5 md:p-6 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white shadow-lg shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-black text-slate-800 text-lg">✨ Describe Your Flow</h2>
                  <p className="text-xs text-slate-500">Just tell the AI what you want — it will build the flow for you</p>
                </div>
              </div>
              <textarea
                value={flowDescription}
                onChange={e => setFlowDescription(e.target.value)}
                rows={3}
                className="w-full bg-slate-50 border-2 border-teal-200 rounded-2xl px-5 py-4 text-base text-slate-800 focus:outline-none focus:border-teal-500 focus:bg-white transition-all resize-none font-medium placeholder:text-slate-400"
                placeholder="Describe what you want the bot to do...&#10;Example: I want the bot to automatically reply when customers place orders, confirm them, and send a thank you after delivery"
              />
              <div className="flex justify-end">
                <button
                  onClick={handleGenerateFlow}
                  disabled={!flowDescription.trim()}
                  className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl font-bold text-sm transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-lg shadow-teal-500/20"
                >
                  <Sparkles className="w-4 h-4" />
                  Generate My Flow
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="bg-white rounded-3xl border-2 border-teal-200 p-5 md:p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white shadow-lg shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-black text-slate-800 text-lg">🔄 Event Messages</h2>
              <p className="text-xs text-slate-500">Bot sends messages automatically when these events happen</p>
            </div>
          </div>

          <div>
            <textarea
              value={quickInput}
              onChange={e => setQuickInput(e.target.value)}
              rows={2}
              className="w-full bg-slate-50 border-2 border-teal-200 rounded-2xl px-5 py-4 text-base text-slate-800 focus:outline-none focus:border-teal-500 focus:bg-white transition-all resize-none font-medium placeholder:text-slate-400"
              placeholder="Describe your business or offer — AI writes all messages for you ✨"
            />
            <div className="flex items-center justify-between flex-wrap gap-3 mt-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-400">
                  <Globe className="w-3.5 h-3.5 inline mr-1" />
                  I understand:
                </span>
                {SUPPORTED_LANGUAGES.map(lang => (
                  <span key={lang.code} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 text-xs font-bold text-slate-600 border border-slate-200">
                    <span>{lang.flag}</span>
                    <span>{lang.label}</span>
                  </span>
                ))}
              </div>
              <button
                onClick={generateQuickAutomation}
                disabled={generating || !quickInput.trim()}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-bold text-sm transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-lg shadow-teal-500/20"
              >
                {generating ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {generating ? "Generating..." : "✨ Generate All Messages"}
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setActiveFlow("order")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs transition-all shrink-0 cursor-pointer border ${activeFlow === "order" ? 'bg-teal-50 border-teal-300 text-teal-700' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}
            >
              🛍️ Order Updates ({activeRulesCount("order")}/{totalRulesCount("order")})
            </button>
            <button
              onClick={() => setActiveFlow("lead")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs transition-all shrink-0 cursor-pointer border ${activeFlow === "lead" ? 'bg-teal-50 border-teal-300 text-teal-700' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}
            >
              💬 Customer Messages ({activeRulesCount("lead")}/{totalRulesCount("lead")})
            </button>
          </div>

          {/* Event Timeline - center-aligned alternating layout */}
          <div className="tl-container">
            {flowEvents.length === 0 && (
              <div className="text-center py-8 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                <div className="text-3xl mb-3">🤖</div>
                <h3 className="text-base font-bold text-slate-600 mb-1">No rules yet</h3>
                <p className="text-xs text-slate-400 mb-4 max-w-xs mx-auto">
                  Use the "Generate All Messages" button above to create your first auto-reply rules
                </p>
              </div>
            )}

            {flowEvents.map((eventKey) => {
              const meta = EVENT_METADATA[eventKey];
              const rule = getRule(eventKey);
              if (!meta) return null;

              return (
                <EventTimelinePair
                  key={eventKey}
                  meta={meta}
                  rule={rule}
                  formatDelay={formatDelay}
                  onToggle={toggleRule}
                  onDelete={deleteRule}
                  onEdit={(r) => {
                    setEditingRuleId(r.id);
                    setEditMessage(r.messageBody);
                    setEditDelay(r.delayMinutes);
                    setEditUseAI(r.useAI ?? false);
                    setEditBrandVoice("friendly");
                    setEditLanguage("en");
                  }}
                  isEditing={editingRuleId === rule?.id}
                  editMessage={editMessage}
                  editDelay={editDelay}
                  editUseAI={editUseAI}
                  editBrandVoice={editBrandVoice}
                  editLanguage={editLanguage}
                  saving={saving}
                  onEditMessageChange={setEditMessage}
                  onEditDelayChange={setEditDelay}
                  onEditUseAIToggle={() => setEditUseAI(!editUseAI)}
                  onEditBrandVoiceChange={setEditBrandVoice}
                  onEditLanguageChange={setEditLanguage}
                  onCancelEdit={() => setEditingRuleId(null)}
                  onSaveEdit={saveInlineEdit}
                />
              );
            })}
          </div>

          {/* Preview */}
          <AnimatePresence>
            {showPreview && previewMessages.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3 pt-2"
              >
                <div className="border-t border-slate-100 pt-4">
                  <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                    👁️ Preview — How your bot will reply
                  </h3>
                  <div className="space-y-3">
                    {previewMessages.map((pv) => {
                      const meta = EVENT_METADATA[pv.eventKey];
                      return (
                        <div key={pv.eventKey} className="flex items-start gap-3 bg-slate-50 rounded-2xl p-4 border border-slate-200">
                          <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-lg shadow-sm shrink-0 border border-slate-100">
                            {meta?.icon || "🤖"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-bold text-slate-600">{meta?.label || pv.eventKey}</span>
                              <span className="text-[10px] text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full font-medium">
                                {formatDelay(getRule(pv.eventKey)?.delayMinutes ?? 0)}
                              </span>
                            </div>
                            <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm max-w-[90%]">
                              <p className="text-sm text-slate-700 leading-relaxed">
                                {pv.message
                                  .replace(/{name}/g, "Priya")
                                  .replace(/{orderId}/g, "LS-1024")
                                  .replace(/{brand}/g, "Your Store")}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-100">
            <span>{activeRulesCount(activeFlow)} of {totalRulesCount(activeFlow)} active</span>
            <button onClick={fetchRules} className="flex items-center gap-1 text-slate-500 hover:text-slate-700 transition-all cursor-pointer">
              <RefreshCw className="w-3 h-3" />
              Refresh
            </button>
          </div>
        </div>
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════
     RENDER: Root Layout
     ═══════════════════════════════════════════════════════ */
  return (
    <>
      <style>{`
        .tl-container { position: relative; }
        .tl-container::before {
          content: '';
          position: absolute;
          left: 50%;
          top: 0; bottom: 0;
          width: 2px;
          background: linear-gradient(to bottom, #cbd5e1, #94a3b8);
          transform: translateX(-50%);
          z-index: 0;
        }
        .tl-pair { position: relative; }
        .tl-node { position: relative; display: flex; align-items: flex-start; padding: 8px 0; }
        .tl-card-left { width: calc(50% - 36px); margin-right: auto; padding-right: 40px; }
        .tl-card-right { width: calc(50% - 36px); margin-left: auto; padding-left: 40px; }
        .tl-dot {
          position: absolute; left: 50%; top: 24px;
          transform: translateX(-50%);
          width: 44px; height: 44px;
          border-radius: 50%;
          border: 4px solid #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2;
          font-size: 16px;
        }
        .tl-dot.trigger { background: #1e293b; color: #fff; }
        .tl-dot.action { background: #14b8a6; color: #fff; }
        .tl-dot.disabled { background: #94a3b8; color: #fff; }
        .tl-connector { position: relative; height: 20px; display: flex; align-items: center; justify-content: center; }
        .tl-connector::before { content: ''; position: absolute; left: 50%; top: 0; bottom: 0; width: 2px; background: #cbd5e1; transform: translateX(-50%); }
        .tl-connector-arrow { font-size: 10px; color: #94a3b8; position: relative; z-index: 1; background: #f1f5f9; padding: 0 8px; font-weight: 600; }
        @media (max-width: 900px) {
          .tl-card-left, .tl-card-right { width: 100%; padding: 0; }
          .tl-container::before { left: 22px; }
          .tl-dot { left: 22px; top: 20px; width: 36px; height: 36px; }
          .tl-card-left { margin-left: 50px; padding-right: 0; }
          .tl-card-right { margin-left: 50px; padding-left: 0; }
        }
      `}</style>
      <div className="flex gap-6 min-h-screen" style={{ backgroundColor: 'var(--app-bg)' }}>
        <div className="w-72 shrink-0 hidden md:block">
          <div className="bg-white rounded-3xl border-2 border-slate-200 p-5 sticky top-6">
            <div className="mb-4 px-1">
              <h2 className="text-sm font-black text-slate-800">Your Automation Flows</h2>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">Manage your bot's behavior</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <button
                onClick={() => navigateTo("ai-list")}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all w-full text-left cursor-pointer ${currentView === "ai-list" || currentView === "ai-detail" ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${currentView === "ai-list" || currentView === "ai-detail" ? 'bg-white/15' : 'bg-purple-100'}`}>🧠</div>
                <span>AI Instructions</span>
              </button>
              <button
                onClick={() => navigateTo("events-list")}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all w-full text-left cursor-pointer ${currentView === "events-list" || currentView === "events-detail" ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${currentView === "events-list" || currentView === "events-detail" ? 'bg-white/15' : 'bg-teal-100'}`}>⚡</div>
                <span>Event Auto-Replies</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0 max-w-4xl">
          {currentView === "ai-list" && renderAiList()}
          {currentView === "ai-detail" && renderAiDetail()}
          {currentView === "events-list" && renderEventList()}
          {currentView === "events-detail" && renderEventDetail()}
        </div>

        <AnimatePresence>
          {showCreateModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowCreateModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                <h3 className="text-lg font-black text-slate-800">✨ Create New Automation Flow</h3>
                <p className="text-xs text-slate-400 font-medium mt-1 mb-5">Give it a name so you can find it easily</p>
                <label className="text-[11px] font-bold text-slate-600 mb-1.5 block">Flow Name</label>
                <input
                  type="text"
                  value={createFlowName}
                  onChange={e => setCreateFlowName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleCreateFlow()}
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:border-teal-500 transition-all font-medium mb-2"
                  placeholder="e.g. Language & Communication"
                  autoFocus
                />
                <div className="flex gap-3 justify-end mt-4">
                  <button onClick={() => setShowCreateModal(false)} className="px-5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-bold text-xs transition-all border border-slate-200 cursor-pointer">Cancel</button>
                  <button onClick={handleCreateFlow} disabled={!createFlowName.trim()} className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-xs transition-all disabled:opacity-50 cursor-pointer">Next →</button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {showPreviewModal && previewRule && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={discardPreview}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-lg shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-500" />
                  Preview Generated Instruction
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-1 mb-5">
                  Review the instruction before saving
                </p>

                {previewRule.needsReview && (
                  <div className="flex items-center gap-2 mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-700">
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                    <span>Needs Review — {previewRule.clarificationHint || "AI was unsure about your input. Please review carefully before activating."}</span>
                  </div>
                )}

                {/* Rule name */}
                <div className="mb-4">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Rule Name</label>
                  <p className="text-sm font-bold text-slate-800">{previewRule.name}</p>
                </div>

                {/* Trigger keywords */}
                <div className="mb-4">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Trigger Keywords</label>
                  <div className="flex flex-wrap gap-1.5">
                    {(previewRule.triggerKeywords || []).map((kw: string, i: number) => (
                      <span key={i} className="text-[11px] bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-lg font-semibold">{kw}</span>
                    ))}
                  </div>
                </div>

                {/* Template body */}
                <div className="mb-4">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Bot Response</label>
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-sm text-slate-700 leading-relaxed">
                    {previewRule.templateBody}
                  </div>
                </div>

                {/* Metadata chips */}
                <div className="flex flex-wrap gap-2 mb-6">
                  <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full capitalize">
                    {previewRule.triggerType?.replace(/_/g, " ").toLowerCase()}
                  </span>
                  <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full capitalize">
                    {previewRule.brandVoice}
                  </span>
                  <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full uppercase">
                    {previewRule.targetLanguage}
                  </span>
                </div>

                <div className="flex gap-3 justify-end border-t border-slate-100 pt-4">
                  <button
                    onClick={discardPreview}
                    className="px-5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-bold text-xs transition-all border border-slate-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmSavePreview}
                    disabled={saving}
                    className="px-5 py-2.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-bold text-xs transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2 shadow-lg shadow-purple-500/20"
                  >
                    {saving ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    {previewRule.needsReview ? "Save as Draft" : "Confirm & Activate"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════
   Event Timeline Pair Component
   ═══════════════════════════════════════════════════════ */

interface EventTimelinePairProps {
  meta: AutoReplyEventMeta;
  rule?: AutoReplyRule;
  formatDelay: (minutes: number) => string;
  onToggle: (rule: AutoReplyRule) => void;
  onDelete: (ruleId: string) => void;
  onEdit: (rule: AutoReplyRule) => void;
  isEditing: boolean;
  editMessage: string;
  editDelay: number;
  editUseAI: boolean;
  editBrandVoice: string;
  editLanguage: string;
  saving: boolean;
  onEditMessageChange: (val: string) => void;
  onEditDelayChange: (val: number) => void;
  onEditUseAIToggle: () => void;
  onEditBrandVoiceChange: (val: any) => void;
  onEditLanguageChange: (val: any) => void;
  onCancelEdit: () => void;
  onSaveEdit: (ruleId: string) => void;
}

function EventTimelinePair({
  meta, rule, formatDelay, onToggle, onDelete, onEdit,
  isEditing, editMessage, editDelay, editUseAI, editBrandVoice, editLanguage,
  saving, onEditMessageChange, onEditDelayChange, onEditUseAIToggle,
  onEditBrandVoiceChange, onEditLanguageChange, onCancelEdit, onSaveEdit,
}: EventTimelinePairProps) {
  const isActive = rule?.isEnabled ?? false;

  return (
    <div className="tl-pair">
      {/* Trigger (left) */}
      <div className="tl-node">
        <div className="tl-card-left">
          <div className={`bg-white rounded-2xl border-2 p-4 transition-all ${isActive ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
            <div className="text-[9px] font-black uppercase tracking-[0.1em] px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 inline-block mb-2.5">
              Step 1 · Trigger
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-lg shrink-0">
                {meta.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800">{meta.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{meta.description}</p>
              </div>
            </div>
            {rule && (
              <div className="flex items-center gap-2 mt-2 ml-12">
                <button
                  onClick={() => onToggle(rule)}
                  className={`relative w-9 h-5 rounded-full transition-all cursor-pointer ${isActive ? "bg-teal-600" : "bg-slate-300"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${isActive ? "translate-x-4" : ""}`} />
                </button>
              </div>
            )}
          </div>
        </div>
        <div className={`tl-dot ${isActive ? 'trigger' : 'disabled'}`}>⚡</div>
      </div>

      {/* Connector */}
      <div className="tl-connector">
        <span className="tl-connector-arrow">▼ Trigger → Action</span>
      </div>

      {/* Action (right) */}
      <div className="tl-node">
        <div className="tl-card-right">
          {!rule ? (
            <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-4 opacity-60">
              <div className="text-[9px] font-black uppercase tracking-[0.1em] px-2.5 py-1 rounded-md bg-slate-100 text-slate-500 inline-block mb-2.5">
                Step 2 · Action
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg">💬</span>
                <span className="text-xs text-slate-500 font-medium">Generate messages above to create this rule</span>
              </div>
            </div>
          ) : (
            <div className={`bg-white rounded-2xl border-2 p-4 transition-all ${isActive ? 'border-teal-200 bg-teal-50/30' : 'border-slate-100 bg-slate-50/30 opacity-60'} ${isEditing ? 'border-teal-400 shadow-md' : ''}`}>
              <div className="text-[9px] font-black uppercase tracking-[0.1em] px-2.5 py-1 rounded-md bg-teal-100 text-teal-700 inline-block mb-2.5">
                Step 2 · Action
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">💬</span>
                <span className="text-sm font-bold text-slate-800">Send Auto-Reply</span>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-sm text-slate-700 leading-relaxed mb-2">
                {rule.messageBody || (
                  <span className="text-slate-400 italic">No message yet</span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                <span className="text-[10px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                  ⏱ {formatDelay(rule.delayMinutes)}
                </span>
                {rule.useAI && (
                  <span className="text-[10px] font-medium bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                    ✨ AI Enhanced
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onToggle(rule)}
                  className={`relative w-9 h-5 rounded-full transition-all cursor-pointer ${isActive ? "bg-teal-600" : "bg-slate-300"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${isActive ? "translate-x-4" : ""}`} />
                </button>
                <button
                  onClick={() => { if (isEditing) onCancelEdit(); else onEdit(rule); }}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${isEditing ? 'bg-teal-100 text-teal-700' : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'}`}
                >
                  <Edit3 className="w-3 h-3" />
                </button>
                <button
                  onClick={() => onDelete(rule.id)}
                  className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-all cursor-pointer border border-red-100"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>

              {/* Inline edit */}
              <AnimatePresence>
                {isEditing && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="border-t border-slate-100 mt-3 pt-3 space-y-3"
                  >
                    <div>
                      <label className="text-xs font-bold text-slate-700 mb-1.5 block">Message</label>
                      <p className="text-[10px] text-slate-400 mb-1.5 font-medium">
                        Use {'{name}'}, {'{orderId}'}, {'{brand}'} as placeholders
                      </p>
                      <textarea
                        value={editMessage}
                        onChange={e => onEditMessageChange(e.target.value)}
                        rows={3}
                        className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:border-teal-500 transition-all resize-none font-medium"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          Delay
                        </label>
                        <select
                          value={editDelay}
                          onChange={e => onEditDelayChange(Number(e.target.value))}
                          className="w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:border-teal-500 transition-all font-medium"
                        >
                          <option value={0}>Immediately</option>
                          <option value={5}>5 min</option>
                          <option value={15}>15 min</option>
                          <option value={30}>30 min</option>
                          <option value={60}>1 hour</option>
                          <option value={120}>2 hours</option>
                          <option value={360}>6 hours</option>
                          <option value={720}>12 hours</option>
                          <option value={1440}>24 hours</option>
                          <option value={2880}>2 days</option>
                          <option value={4320}>3 days</option>
                          <option value={10080}>7 days</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                          <Sparkles className="w-3 h-3 text-purple-600" />
                          AI Enhance
                        </label>
                        <div className="flex items-center gap-3 h-full">
                          <button
                            onClick={onEditUseAIToggle}
                            className={`relative w-10 h-6 rounded-full transition-all cursor-pointer ${editUseAI ? "bg-purple-600" : "bg-slate-300"}`}
                          >
                            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all ${editUseAI ? "translate-x-4" : ""}`} />
                          </button>
                          <span className="text-xs text-slate-500 font-medium">
                            {editUseAI ? "AI will personalize this message" : "Plain message"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {editUseAI && (
                      <div className="bg-purple-50/50 rounded-xl p-3 border border-purple-200/50 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-bold text-purple-700 mb-1 block uppercase tracking-wider">Brand Voice</label>
                            <select
                              value={editBrandVoice}
                              onChange={e => onEditBrandVoiceChange(e.target.value)}
                              className="w-full bg-white border border-purple-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-purple-500 transition-all font-medium"
                            >
                              <option value="formal">Formal</option>
                              <option value="casual">Casual</option>
                              <option value="friendly">Friendly</option>
                              <option value="salesy">Salesy</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-purple-700 mb-1 block uppercase tracking-wider">Language</label>
                            <select
                              value={editLanguage}
                              onChange={e => onEditLanguageChange(e.target.value)}
                              className="w-full bg-white border border-purple-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-purple-500 transition-all font-medium"
                            >
                              <option value="en">🇬🇧 English</option>
                              <option value="hi">🇮🇳 हिंदी</option>
                              <option value="ta">🇮🇳 தமிழ்</option>
                              <option value="te">🇮🇳 తెలుగు</option>
                              <option value="bn">🇮🇳 বাংলা</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={onCancelEdit}
                        className="flex-1 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-bold text-xs transition-all border border-slate-200 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => onSaveEdit(rule.id)}
                        disabled={saving || !editMessage.trim()}
                        className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                      >
                        {saving ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <Save className="w-3 h-3" />
                        )}
                        Save
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}