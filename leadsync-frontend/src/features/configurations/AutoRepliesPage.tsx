import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Sparkles, RefreshCw, Play, StopCircle,
  Trash2, Plus, Save, Command as CommandIcon, AlertTriangle,
  ChevronDown, ChevronUp
} from "lucide-react";
import { toast } from "react-hot-toast";
import { generateSmartRules, listSmartRules, updateSmartRule, deleteSmartRule, createRuleGroup, listRuleGroups, deleteRuleGroup, updateRuleGroup, createSmartRule, getRuleConstants, testConversationalRule, getCompanyId } from "../../api/client";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { VoiceMicButton } from "../inventory/components/VoiceMicButton";
import { VoiceLanguageSelect } from "../inventory/components/VoiceLanguageSelect";

/* ──────────────────────────────────────────────────────────────
   Types
   ────────────────────────────────────────────────────────────── */

interface SurfaceConfig {
  enabled: boolean;
  showAsButton?: boolean;
  showAsCommand?: boolean;
  channel: "TELEGRAM";
  buttonLabel: string;
  command: string;
  menuPosition: number;
  parentRuleId?: string | null;
}

interface ConversationalRule {
  id: string;
  name: string;
  sourcePrompt?: string;
  triggerKeywords?: string[];
  triggerType?: string;
  isEnabled: boolean;
  surfaceConfig?: SurfaceConfig | null;
  eventConfig?: { eventName?: string } | null;
  templateBody?: string;
  useAI?: boolean;
  brandVoice?: string;
}

interface RuleConstants {
  maxSurfacedRules: number;
  orderEventPrefix: string;
  knownEvents: { value: string; label: string }[];
}

type ViewType = "ai-list" | "ai-detail";

/* ──────────────────────────────────────────────────────────────
   Main Component
   ────────────────────────────────────────────────────────────── */

export function AutoRepliesPage() {
  const companyId = getCompanyId();

  // Testing state
  const [testInputs, setTestInputs] = useState<Record<string, string>>({});
  const [testResults, setTestResults] = useState<Record<string, { matched: boolean; matchedKeywords: string[]; response: string } | null>>({});
  const [testingRuleId, setTestingRuleId] = useState<string | null>(null);

  const handleTestRule = async (ruleId: string) => {
    const sample = testInputs[ruleId];
    if (!sample?.trim()) return;
    setTestingRuleId(ruleId);
    try {
      const res = await testConversationalRule(ruleId, sample);
      if (res.success) {
        setTestResults(prev => ({ ...prev, [ruleId]: res.data }));
      }
    } catch {
      toast.error("Failed to test instruction");
    } finally {
      setTestingRuleId(null);
    }
  };
  // Navigation
  const [currentView, setCurrentView] = useState<ViewType>("ai-list");

  // AI Instructions state
  const [instructions, setInstructions] = useState<ConversationalRule[]>([]);
  const [instructionsLoading, setInstructionsLoading] = useState(true);
  const [instructionInput, setInstructionInput] = useState("");
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);
  const [voiceLanguage, setVoiceLanguage] = useState("English");

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createFlowName, setCreateFlowName] = useState("");
  const [flowToDelete, setFlowToDelete] = useState<{ id: string; name: string } | null>(null);

  // New flow description (AI generate)
  const [flowDescription, setFlowDescription] = useState("");
  const [showDescriptionPrompt, setShowDescriptionPrompt] = useState(false);
  const [isFirstTimeSetup, setIsFirstTimeSetup] = useState(false);
  const [selectedAiProfile, setSelectedAiProfile] = useState<{ name: string; desc: string } | null>(null);

  // Server-backed rule groups (automation flows)
  const [ruleGroups, setRuleGroups] = useState<any[]>([]);
  const [ruleGroupsLoading, setRuleGroupsLoading] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // Surface editor state (per-rule, keyed by rule id)
  const [surfaceEditId, setSurfaceEditId] = useState<string | null>(null);
  const [surfaceDraft, setSurfaceDraft] = useState<SurfaceConfig>({
    enabled: false, channel: "TELEGRAM", buttonLabel: "", command: "", menuPosition: 0,
  });
  const [draftUseAI, setDraftUseAI] = useState(false);
  const [draftTemplateBody, setDraftTemplateBody] = useState("");
  const [saving, setSaving] = useState(false);

  // Preview-before-confirm state
  const [previewRule, setPreviewRule] = useState<any>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Constants from backend (surfacing cap + known events)
  const [constants, setConstants] = useState<RuleConstants>({
    maxSurfacedRules: 6,
    orderEventPrefix: "order.",
    knownEvents: [],
  });

  // Fetch on mount
  useEffect(() => {
    fetchInstructions();
    fetchRuleGroups();
    fetchConstants();
  }, []);

  // ── API: constants ──
  const fetchConstants = async () => {
    try {
      const data = await getRuleConstants();
      setConstants({
        maxSurfacedRules: data.maxSurfacedRules ?? 6,
        orderEventPrefix: data.orderEventPrefix ?? "order.",
        knownEvents: data.knownEvents ?? [],
      });
    } catch {
      // keep defaults
    }
  };

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

  const surfacedCount = instructions.filter(
    (r) => r.surfaceConfig?.enabled && r.surfaceConfig.command
  ).length;

  const addInstruction = async () => {
    if (!instructionInput.trim()) {
      toast.error("Please type an instruction");
      return;
    }
    try {
      const data = await generateSmartRules(instructionInput, selectedGroupId || undefined);
      if (data.rule) {
        const _groupSource = selectedGroupId || undefined;
        setPreviewRule({ ...data.rule, _groupSource });
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

  const toggleFlow = async (groupId: string, currentEnabled: boolean) => {
    try {
      const data = await updateRuleGroup(groupId, { isEnabled: !currentEnabled });
      const updated = data?.group || { id: groupId, isEnabled: !currentEnabled };
      setRuleGroups(prev => prev.map(g => g.id === groupId ? { ...g, isEnabled: updated.isEnabled } : g));
      toast.success(currentEnabled ? "Flow disabled" : "Flow enabled");
    } catch {
      toast.error("Failed to update flow");
    }
  };

  const triggerDeleteFlow = async () => {
    if (!flowToDelete) return;
    const { id, name } = flowToDelete;
    try {
      await deleteRuleGroup(id);
      await fetchRuleGroups();
      await fetchInstructions();
      toast.success(`Flow "${name}" deleted`);
    } catch {
      toast.error("Failed to delete flow");
    } finally {
      setFlowToDelete(null);
    }
  };

  // ── Surface editor ──

  const openSurfaceEditor = (rule: ConversationalRule) => {
    const sc = rule.surfaceConfig;
    const showAsButton = sc?.showAsButton ?? (sc?.enabled ? true : false);
    const showAsCommand = sc?.showAsCommand ?? (sc?.enabled ? true : false);
    setSurfaceDraft({
      enabled: sc?.enabled ?? false,
      showAsButton,
      showAsCommand,
      channel: "TELEGRAM",
      buttonLabel: sc?.buttonLabel ?? "",
      command: sc?.command ?? "",
      menuPosition: sc?.menuPosition ?? 0,
      parentRuleId: sc?.parentRuleId ?? null,
    });
    setDraftUseAI(rule.useAI ?? false);
    setDraftTemplateBody(rule.templateBody ?? "");
    setSurfaceEditId(rule.id);
  };

  const commandSeemsValid = (cmd: string) => /^\/[a-z0-9_]+$/.test(cmd);

  const atCap = (ruleId: string, parentRuleId: string | null | undefined) => {
    const targetParentId = parentRuleId || null;
    const existingRule = instructions.find(r => r.id === ruleId);
    
    const existingSc = existingRule?.surfaceConfig;
    const wasSurfacedButton = existingSc ? (existingSc.showAsButton !== undefined ? !!existingSc.showAsButton : !!existingSc.enabled) : false;
    const wasSurfacedUnderThisParent =
      wasSurfacedButton &&
      (existingSc?.parentRuleId || null) === targetParentId;
    if (wasSurfacedUnderThisParent) return false;

    const currentCount = instructions.filter(
      (r) => {
        const sc = r.surfaceConfig;
        if (!sc) return false;
        const activeBtn = sc.showAsButton !== undefined ? !!sc.showAsButton : !!sc.enabled;
        return activeBtn && (sc.parentRuleId || null) === targetParentId;
      }
    ).length;
    return currentCount >= constants.maxSurfacedRules;
  };

  const saveSurface = async (ruleId: string) => {
    const draft = { ...surfaceDraft };
    const showAsButton = !!draft.showAsButton;
    const showAsCommand = !!draft.showAsCommand;

    if (showAsButton && !draft.buttonLabel.trim()) {
      toast.error("Button label is required when 'Show as inline button' is checked.");
      return;
    }
    if (showAsCommand && !commandSeemsValid(draft.command)) {
      toast.error("Command must start with '/' and use lowercase letters, numbers, or underscores (no spaces)");
      return;
    }
    if (showAsButton && atCap(ruleId, draft.parentRuleId)) {
      toast.error(`Surfaced rule button limit reached (${constants.maxSurfacedRules}). Disable another surfaced button in this menu first.`);
      return;
    }

    if (!draftUseAI && !draftTemplateBody.trim()) {
      toast.error("A Fixed Reply is required when AI Behavior is disabled.");
      return;
    }

    setSaving(true);
    try {
      const data = await updateSmartRule(ruleId, {
        useAI: draftUseAI,
        templateBody: draftTemplateBody.trim(),
        surfaceConfig: {
          showAsButton,
          showAsCommand,
          enabled: showAsButton || showAsCommand,
          channel: "TELEGRAM",
          buttonLabel: showAsButton || showAsCommand ? draft.buttonLabel.trim() : "",
          command: showAsButton || showAsCommand ? draft.command.trim() : "",
          menuPosition: Number(draft.menuPosition) || 0,
          parentRuleId: draft.parentRuleId || null,
        },
      });
      if (data.rule) {
        setInstructions(prev => prev.map(r => r.id === ruleId ? data.rule : r));
      } else {
        await fetchInstructions();
      }
      setSurfaceEditId(null);
      toast.success("Rule settings updated successfully");
    } catch (err: any) {
      const serverMsg = err?.response?.data?.error || err?.message;
      if (err?.response?.status === 409 || err?.message?.includes("SURFACED_LIMIT_REACHED")) {
        toast.error(serverMsg || `Surfaced rule limit reached (${constants.maxSurfacedRules}). Disable another surfaced rule in this menu first.`);
      } else if (serverMsg) {
        toast.error(serverMsg);
      } else {
        toast.error("Failed to save rule settings");
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Create Flow ──

  const openCreateModal = () => {
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

  // ── Confirm Save (Preview → Persist) ──

  const confirmSavePreview = async () => {
    if (!previewRule) return;
    const { needsReview, clarificationHint, _groupSource, ...ruleFields } = previewRule;
    const targetGroupId = selectedGroupId || _groupSource || null;
    if (!targetGroupId) {
      toast.error("Please open a flow first, then add your instruction.");
      return;
    }
    try {
      setSaving(true);
      const payload = {
        ...ruleFields,
        groupId: targetGroupId,
        isEnabled: !previewRule.needsReview,
        sourcePrompt: previewRule.sourcePrompt || "",
      };
      const result = await createSmartRule(payload);
      if (result.rule) {
        setShowPreviewModal(false);
        setPreviewRule(null);
        if (instructionInput) setInstructionInput("");
        if (flowDescription) { setFlowDescription(""); setShowDescriptionPrompt(false); setIsFirstTimeSetup(false); }
        await fetchInstructions(targetGroupId);
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
    if (view === "ai-list") {
      fetchInstructions();
      fetchRuleGroups();
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

      {/* Surfaced-rule counter */}
      <div className="flex items-center justify-between bg-white rounded-2xl border-2 border-slate-200 px-4 py-3" data-tour="slot-counter">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <CommandIcon className="w-4 h-4 text-purple-600" />
          Telegram buttons / commands
        </div>
        <span className={`text-xs font-bold px-3 py-1 rounded-full ${surfacedCount >= constants.maxSurfacedRules ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
          {surfacedCount}/{constants.maxSurfacedRules} slots used
        </span>
      </div>

      <div className="flex flex-col gap-3" data-tour="flow-list">
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

        {ruleGroups.map((group) => {
          const _flowEnabled = group.isEnabled !== false;
          return (
          <div
            key={group.id}
            className="bg-white rounded-2xl border-2 border-slate-200 p-4 flex items-center gap-4 hover:border-purple-300 transition-all cursor-pointer"
            onClick={() => {              setSelectedGroupId(group.id);
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
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${_flowEnabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                  {_flowEnabled ? "Active" : "Disabled"}
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
                await toggleFlow(group.id, _flowEnabled);
              }}
              className={`relative w-11 h-6 rounded-full transition-all cursor-pointer shrink-0 ${_flowEnabled ? "bg-green-500" : "bg-slate-300"}`}
              title={_flowEnabled ? "Flow is active — click to disable" : "Flow is disabled — click to enable"}
              data-tour="flow-toggle"
            >
              <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${_flowEnabled ? "translate-x-5" : ""}`} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setFlowToDelete({ id: group.id, name: group.name });
              }}
              className="p-2 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          );
        })}

        {!instructionsLoading && instructions.filter((inst: any) => !inst.groupId).length > 0 && (
          <div className="pt-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">
              Ungrouped Instructions
            </p>
          </div>
        )}

        {!instructionsLoading && instructions.filter((inst: any) => !inst.groupId).map((inst) => (
          <div
            key={inst.id}
            className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-4 flex items-center gap-4 hover:border-slate-300 transition-all cursor-pointer"
            onClick={() => {
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
                <SurfacedBadge rule={inst} />
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
        onClick={openCreateModal}
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
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight" style={{ color: 'var(--app-text)' }}>
            {selectedAiProfile?.name || "AI Instructions"}
          </h1>
          {selectedGroupId && (() => {
            const _group = ruleGroups.find((g: any) => g.id === selectedGroupId);
            if (!_group) return null;
            const _enabled = _group.isEnabled !== false;
            return (
              <button
                onClick={() => toggleFlow(selectedGroupId as string, _enabled)}
                className={`relative w-12 h-7 rounded-full transition-all cursor-pointer shrink-0 mt-1 ${_enabled ? "bg-green-500" : "bg-slate-300"}`}
                title={_enabled ? "Flow is active — click to disable" : "Flow is disabled — click to enable"}
              >
                <span className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-sm transition-all ${_enabled ? "translate-x-5" : ""}`} />
              </button>
            );
          })()}
        </div>
        <p className="font-medium text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {selectedAiProfile?.desc || "Manage your instruction rules"}
        </p>
        {selectedGroupId && (() => {
          const _group = ruleGroups.find((g: any) => g.id === selectedGroupId);
          if (!_group) return null;
          const _enabled = _group.isEnabled !== false;
          return (
            <span className={`inline-block mt-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${_enabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
              {_enabled ? "Active" : "Disabled"}
            </span>
          );
        })()}
      </div>

      {isFirstTimeSetup ? (
        <div className="bg-white rounded-3xl border-2 border-purple-200 p-5 md:p-6 space-y-4" data-tour="describe-flow">
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
          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <VoiceLanguageSelect value={voiceLanguage} onChange={setVoiceLanguage} compact />
              <VoiceMicButton
                companyId={companyId || undefined}
                language={voiceLanguage}
                onExtractionComplete={(res) => {
                  if (res?.transcript) {
                    setFlowDescription(res.transcript);
                  }
                }}
                buttonText="Dictate Flow"
                compact
              />
            </div>
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
          <div className="bg-white rounded-3xl border-2 border-purple-200 p-5 md:p-6 space-y-4" data-tour="describe-flow">
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
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-2">
                      <VoiceLanguageSelect value={voiceLanguage} onChange={setVoiceLanguage} compact />
                      <VoiceMicButton
                        companyId={companyId || undefined}
                        language={voiceLanguage}
                        onExtractionComplete={(res) => {
                          if (res?.transcript) {
                            setFlowDescription(res.transcript);
                          }
                        }}
                        buttonText="Dictate Flow"
                        compact
                      />
                    </div>
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
                <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-slate-200 text-slate-800 shadow-sm">List</span>
              </div>
            </div>

            <div className="flex gap-2 items-center flex-wrap sm:flex-nowrap">
              <input
                type="text"
                value={instructionInput}
                onChange={e => setInstructionInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addInstruction()}
                className="flex-1 min-w-[200px] bg-slate-50 border-2 border-purple-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-purple-500 transition-all font-medium"
                placeholder="Type an instruction... e.g. Always reply in customer's language"
              />
              <VoiceLanguageSelect value={voiceLanguage} onChange={setVoiceLanguage} compact />
              <VoiceMicButton
                companyId={companyId || undefined}
                language={voiceLanguage}
                onExtractionComplete={(res) => {
                  if (res?.transcript) {
                    setInstructionInput(res.transcript);
                  }
                }}
                buttonText="Dictate"
                compact
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

            {instructions.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                <div className="text-2xl mb-2">🧠</div>
                <p className="text-xs text-slate-400 font-medium">
                  No instructions yet. Type one above to tell the bot how to behave.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4" data-tour="instruction-cards">
                {(() => {
                  const _flowEnabled = !selectedGroupId || (ruleGroups.find((g: any) => g.id === selectedGroupId)?.isEnabled !== false);
                  return instructions.map((inst) => {
                    const _effectiveActive = inst.isEnabled && _flowEnabled;
                    const isExpanded = expandedRuleId === inst.id;
                    return (
                    <div key={inst.id} className={`bg-white rounded-2xl border-2 transition-all ${_effectiveActive ? 'border-purple-200 shadow-sm' : 'border-slate-100 opacity-70'}`}>

                      {/* Header: Instruction info + Toggle/Delete */}
                      <div
                        onClick={() => setExpandedRuleId(isExpanded ? null : inst.id)}
                        className="p-4 sm:p-5 flex items-start justify-between cursor-pointer hover:bg-slate-50/50 rounded-2xl transition-colors"
                      >
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${_effectiveActive ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-500'}`}>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 0 1 2 -2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <div className="text-[10px] font-black uppercase tracking-[0.1em] px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                                Instruction
                              </div>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${_effectiveActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                {_effectiveActive ? 'Active' : 'Disabled'}
                              </span>
                              <SurfacedBadge rule={inst} />
                              {!_flowEnabled && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-700" title="This flow is disabled, so this instruction is not followed">
                                  Flow off
                                </span>
                              )}
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
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleInstruction(inst.id, inst.isEnabled);
                            }}
                            className={`relative w-11 h-6 rounded-full transition-all cursor-pointer ${inst.isEnabled ? "bg-green-500" : "bg-slate-300"}`}
                          >
                            <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${inst.isEnabled ? "translate-x-5" : ""}`} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteInstruction(inst.id);
                            }}
                            className="p-2 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-all cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <div className="p-1 text-slate-400 hover:text-purple-600 transition-colors">
                            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                          </div>
                        </div>
                      </div>

                      {/* Expanded Details Body */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden px-5 pb-5 border-t border-slate-100 pt-3"
                          >
                            {(() => {
                              const sc = inst.surfaceConfig;
                              const showAsButton = sc ? (sc.showAsButton !== undefined ? !!sc.showAsButton : !!sc.enabled) : false;
                              const showAsCommand = sc ? (sc.showAsCommand !== undefined ? !!sc.showAsCommand : !!sc.enabled) : false;
                              const needsTemplate = !inst.useAI || showAsButton || showAsCommand;
                              const noTemplate = !inst.templateBody || !inst.templateBody.trim();
                              
                              if (_effectiveActive && needsTemplate && noTemplate) {
                                return (
                                  <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200/80 rounded-xl text-xs font-semibold text-amber-800 flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                                    <span>
                                      Warning: No response text configured. 
                                      {!inst.useAI ? " This is required for free-text matching." : ""}
                                      {showAsButton || showAsCommand ? " This is required for button/command taps." : ""}
                                    </span>
                                  </div>
                                );
                              }
                              return null;
                            })()}

                            {/* Surface editor toggle + panel */}
                            <div className="pt-1">
                              <button
                                onClick={() => surfaceEditId === inst.id ? setSurfaceEditId(null) : openSurfaceEditor(inst)}
                                className="flex items-center gap-2 text-xs font-bold text-purple-600 hover:text-purple-800 transition-all cursor-pointer"
                              >
                                <CommandIcon className="w-3.5 h-3.5" />
                                Configure reply & surfacing
                                <span className="text-slate-300">›</span>
                              </button>

                              <AnimatePresence>
                                {surfaceEditId === inst.id && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="overflow-hidden"
                                  >
                                    <SurfaceEditor
                                      draft={surfaceDraft}
                                      setDraft={setSurfaceDraft}
                                      draftUseAI={draftUseAI}
                                      setDraftUseAI={setDraftUseAI}
                                      draftTemplateBody={draftTemplateBody}
                                      setDraftTemplateBody={setDraftTemplateBody}
                                      rule={inst}
                                      allRules={instructions}
                                      constants={constants}
                                      atCap={atCap(inst.id, surfaceDraft.parentRuleId)}
                                      commandValid={commandSeemsValid(surfaceDraft.command)}
                                      surfacedCount={instructions.filter(
                                        (r) => {
                                          const sc = r.surfaceConfig;
                                          if (!sc) return false;
                                          const activeBtn = sc.showAsButton !== undefined ? !!sc.showAsButton : !!sc.enabled;
                                          return activeBtn && (sc.parentRuleId || null) === (surfaceDraft.parentRuleId || null) && r.id !== inst.id;
                                        }
                                      ).length}
                                      saving={saving}
                                      onCancel={() => setSurfaceEditId(null)}
                                      onSave={() => saveSurface(inst.id)}
                                    />
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>

                            {/* Side-by-Side 2-Panel Layout: Example Conversation (Left) & Test With Your Inputs (Right) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100">
                              {/* LEFT PANEL: Example Conversation */}
                              <div className="bg-slate-50/70 rounded-2xl p-4 border border-slate-200/80 space-y-3" data-tour="example-conversation">
                                <div className="flex items-center justify-between">
                                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                    <Brain className="w-3.5 h-3.5 text-purple-600" />
                                    Example Conversation
                                  </label>
                                  <span className="text-[10px] text-slate-400 font-medium">Static Preview</span>
                                </div>

                                <div className="space-y-2.5 bg-white p-3 rounded-xl border border-slate-200/60 shadow-xs">
                                  {/* User Simulated Message */}
                                  <div className="flex items-start gap-2 max-w-[90%]">
                                    <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs shrink-0 font-bold text-slate-600">
                                      👤
                                    </div>
                                    <div className="bg-slate-100 text-slate-800 rounded-2xl px-3 py-2 text-xs font-medium leading-relaxed">
                                      {inst.triggerKeywords?.[0]
                                        ? `Do you have ${inst.triggerKeywords[0]}?`
                                        : `Can you tell me about ${inst.name}?`}
                                    </div>
                                  </div>

                                  {/* Bot Simulated Response */}
                                  {(() => {
                                    const children = instructions.filter(r => r.surfaceConfig?.enabled && r.surfaceConfig.parentRuleId === inst.id);
                                    const isCategory = children.length > 0;
                                    const hasBody = inst.templateBody && inst.templateBody.trim();
                                    const displayText = hasBody ? inst.templateBody : (isCategory ? `Select an option under ${inst.name}:` : null);

                                    return (
                                      <div className="space-y-2">
                                        <div className="flex items-start gap-2 max-w-[90%] ml-auto flex-row-reverse">
                                          <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-xs shrink-0 text-white shadow-sm">
                                            🤖
                                          </div>
                                          {displayText ? (
                                            <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-2xl px-3 py-2 text-xs font-medium leading-relaxed shadow-sm">
                                              {displayText}
                                            </div>
                                          ) : (
                                            <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl px-3 py-2 text-xs font-semibold leading-relaxed">
                                              ⚠️ No bot response text configured.
                                            </div>
                                          )}
                                        </div>

                                        {/* Submenu button previews */}
                                        {isCategory && (
                                          <div className="flex flex-col gap-1.5 pl-8 max-w-[90%] ml-auto">
                                            <div className="grid grid-cols-2 gap-1">
                                              {children.map(child => (
                                                <div key={child.id} className="bg-purple-50 text-purple-700 border border-purple-200 rounded-lg px-2 py-1 text-[10px] font-bold text-center">
                                                  {child.surfaceConfig?.buttonLabel || child.name}
                                                </div>
                                              ))}
                                            </div>
                                            <div className="bg-slate-100 border border-slate-200 text-slate-600 rounded-lg px-2 py-1 text-[10px] font-bold text-center">
                                              ⬅️ Back
                                            </div>
                                          </div>
                                        )}
                                        {!isCategory && inst.surfaceConfig?.enabled && (
                                          <div className="flex gap-1.5 pl-8 max-w-[90%] ml-auto">
                                            {inst.surfaceConfig.parentRuleId ? (
                                              <>
                                                <div className="flex-1 bg-slate-100 border border-slate-200 text-slate-600 rounded-lg px-2 py-1 text-[10px] font-bold text-center">
                                                  ⬅️ Back
                                                </div>
                                                <div className="flex-1 bg-slate-100 border border-slate-200 text-slate-600 rounded-lg px-2 py-1 text-[10px] font-bold text-center">
                                                  🏠 Main Menu
                                                </div>
                                              </>
                                            ) : (
                                              <div className="flex-1 bg-slate-100 border border-slate-200 text-slate-600 rounded-lg px-2 py-1 text-[10px] font-bold text-center">
                                                🏠 Main Menu
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>

                              {/* RIGHT PANEL: Test With Your Inputs */}
                              <div className="bg-slate-50/70 rounded-2xl p-4 border border-slate-200/80 space-y-3" data-tour="test-panel">
                                <div className="flex items-center justify-between">
                                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                                    Test With Your Inputs
                                  </label>
                                  <span className="text-[10px] text-slate-400 font-medium">Live Simulator</span>
                                </div>

                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={testInputs[inst.id] || ""}
                                    onChange={e => setTestInputs({ ...testInputs, [inst.id]: e.target.value })}
                                    onKeyDown={e => e.key === "Enter" && handleTestRule(inst.id)}
                                    placeholder="Type a custom message e.g. 'How much is briyani?'"
                                    className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-purple-500 font-medium shadow-xs"
                                  />
                                  <button
                                    onClick={() => handleTestRule(inst.id)}
                                    disabled={testingRuleId === inst.id || !testInputs[inst.id]?.trim()}
                                    className="px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 shrink-0 cursor-pointer shadow-sm"
                                  >
                                    {testingRuleId === inst.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Run Test"}
                                  </button>
                                </div>

                                {testResults[inst.id] ? (
                                  <div className="space-y-2 bg-white p-3 rounded-xl border border-slate-200/60 shadow-xs">
                                    {/* User Live Input Message */}
                                    <div className="flex items-start gap-2 max-w-[90%]">
                                      <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs shrink-0 font-bold text-slate-600">
                                        👤
                                      </div>
                                      <div className="bg-slate-100 text-slate-800 rounded-2xl px-3 py-2 text-xs font-medium leading-relaxed">
                                        {testInputs[inst.id]}
                                      </div>
                                    </div>

                                    {/* Bot Live Response Bubble */}
                                    {testResults[inst.id]?.matched ? (
                                      <div className="flex items-start gap-2 max-w-[90%] ml-auto flex-row-reverse">
                                        <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-xs shrink-0 text-white shadow-sm">
                                          🤖
                                        </div>
                                        <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-2xl px-3 py-2 text-xs font-medium leading-relaxed shadow-sm">
                                          {testResults[inst.id]?.response}
                                          {testResults[inst.id]?.matchedKeywords?.length ? (
                                            <div className="pt-1 flex items-center justify-end gap-1">
                                              <span className="text-[9px] text-green-700 bg-green-100 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                                                Matched: {testResults[inst.id]?.matchedKeywords.join(", ")}
                                              </span>
                                            </div>
                                          ) : null}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold">
                                        ❌ No Match — This message did not trigger this instruction rule.
                                      </div>
                                    )}
                            </div>
                          ) : (
                            <div className="text-center py-4 text-[11px] text-slate-400 font-medium bg-white rounded-xl border border-slate-100 border-dashed">
                              Enter a message above and click "Run Test" to simulate the bot's response.
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              );
                  });
                })()}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );

  /* ═══════════════════════════════════════════════════════
      RENDER: Root Layout
      ═══════════════════════════════════════════════════════ */
  return (
    <>
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
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0 max-w-4xl">
          {currentView === "ai-list" && renderAiList()}
          {currentView === "ai-detail" && renderAiDetail()}
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
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:border-purple-500 transition-all font-medium mb-2"
                  placeholder="e.g. Language & Communication"
                  autoFocus
                />
                <div className="flex gap-3 justify-end mt-4">
                  <button onClick={() => setShowCreateModal(false)} className="px-5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-bold text-xs transition-all border border-slate-200 cursor-pointer">Cancel</button>
                  <button onClick={handleCreateFlow} disabled={!createFlowName.trim()} className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs transition-all disabled:opacity-50 cursor-pointer">Next →</button>
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

                <div className="mb-4">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Rule Name</label>
                  <p className="text-sm font-bold text-slate-800">{previewRule.name}</p>
                </div>

                <div className="mb-4">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Trigger Keywords</label>
                  <div className="flex flex-wrap gap-1.5">
                    {(previewRule.triggerKeywords || []).map((kw: string, i: number) => (
                      <span key={i} className="text-[11px] bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-lg font-semibold">{kw}</span>
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Bot Response</label>
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-sm text-slate-700 leading-relaxed">
                    {previewRule.templateBody}
                  </div>
                </div>

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
        <ConfirmDialog
          isOpen={!!flowToDelete}
          onClose={() => setFlowToDelete(null)}
          onConfirm={triggerDeleteFlow}
          title="Delete Flow"
          message={`Are you sure you want to delete flow "${flowToDelete?.name}" and all its instructions? This cannot be undone.`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          isDestructive={true}
        />
      </div>
    </>
  );
}

/* ──────────────────────────────────────────────────────────────
   Surface badge — shown next to a rule when it's surfaced
   ────────────────────────────────────────────────────────────── */
function SurfacedBadge({ rule }: { rule: ConversationalRule }) {
  const sc = rule.surfaceConfig;
  if (!sc) return null;

  const showAsButton = sc.showAsButton !== undefined ? !!sc.showAsButton : !!sc.enabled;
  const showAsCommand = sc.showAsCommand !== undefined ? !!sc.showAsCommand : !!sc.enabled;

  if (!showAsButton && !showAsCommand) return null;

  let label = "";
  if (showAsButton && showAsCommand) label = `Button & Command: ${sc.command || ""}`;
  else if (showAsButton) label = "Inline Button Only";
  else if (showAsCommand) label = `Command Only: ${sc.command || ""}`;

  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200"
      title="Surfacing configured in Telegram"
    >
      <CommandIcon className="w-3 h-3" />
      {label}
    </span>
  );
}

/* ──────────────────────────────────────────────────────────────
   Surface editor — "Show as Button / Command" section
   ────────────────────────────────────────────────────────────── */
interface SurfaceEditorProps {
  draft: SurfaceConfig;
  setDraft: (d: SurfaceConfig) => void;
  draftUseAI: boolean;
  setDraftUseAI: (val: boolean) => void;
  draftTemplateBody: string;
  setDraftTemplateBody: (val: string) => void;
  rule: ConversationalRule;
  allRules: ConversationalRule[];
  constants: RuleConstants;
  atCap: boolean;
  commandValid: boolean;
  surfacedCount: number;
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
}

function SurfaceEditor({
  draft,
  setDraft,
  draftUseAI,
  setDraftUseAI,
  draftTemplateBody,
  setDraftTemplateBody,
  rule,
  allRules,
  constants,
  atCap,
  commandValid,
  surfacedCount,
  saving,
  onCancel,
  onSave
}: SurfaceEditorProps) {
  const isEventRule = rule.triggerType === "EVENT";
  const capBlocked = draft.showAsButton && atCap;

  const getParentChain = (
    rules: ConversationalRule[],
    startParentId: string | null | undefined,
    currentRuleId?: string
  ): { hasCycle: boolean; depth: number } => {
    let depth = 0;
    let currentId = startParentId;
    const visited = new Set<string>();
    if (currentRuleId) visited.add(currentRuleId);

    while (currentId) {
      if (visited.has(currentId)) return { hasCycle: true, depth };
      visited.add(currentId);

      const parentRule = rules.find((r) => r.id === currentId);
      if (!parentRule) break;

      const config = parentRule.surfaceConfig;
      currentId = config?.parentRuleId;
      depth++;
    }
    return { hasCycle: false, depth };
  };

  const getSubtreeHeight = (rules: ConversationalRule[], ruleId: string): number => {
    let maxHeight = 0;
    for (const r of rules) {
      const parentId = r.surfaceConfig?.parentRuleId;
      if (parentId === ruleId) {
        maxHeight = Math.max(maxHeight, 1 + getSubtreeHeight(rules, r.id));
      }
    }
    return maxHeight;
  };

  const parentCandidates = allRules.filter(
    (r) => {
      const sc = r.surfaceConfig;
      if (!sc) return false;
      const activeBtn = sc.showAsButton !== undefined ? !!sc.showAsButton : !!sc.enabled;
      return activeBtn && !sc.parentRuleId && r.id !== rule.id;
    }
  );

  const isSurfaced = !!(draft.showAsButton || draft.showAsCommand);

  return (
    <div className="mt-3 pt-3 border-t border-slate-100 space-y-4 bg-slate-50/60 rounded-xl p-4" data-tour="instruction-editor">
      {/* 1. AI Behavior Section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="text-sm">🧠</span>
          <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">AI Behavior (Free-Text Matches)</h3>
        </div>
        <p className="text-[10px] text-slate-400">Configures how the bot responds when a customer types a message related to this instruction.</p>
        
        {rule.triggerKeywords && rule.triggerKeywords.length > 0 && (
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Keywords Driving Match</label>
            <div className="flex flex-wrap gap-1.5">
              {rule.triggerKeywords.map((kw, idx) => (
                <span key={idx} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">{kw}</span>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <div>
            <p className="text-xs font-bold text-slate-700">Enable dynamic AI elaboration</p>
            <p className="text-[10px] text-slate-400">If enabled, matches are answered dynamically by the AI using your shop context and live product inventory.</p>
          </div>
          <button
            onClick={() => setDraftUseAI(!draftUseAI)}
            className={`relative w-11 h-6 rounded-full transition-all cursor-pointer shrink-0 ${draftUseAI ? "bg-purple-600" : "bg-slate-300"}`}
          >
            <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${draftUseAI ? "translate-x-5" : ""}`} />
          </button>
        </div>

        {draftUseAI && (
          <div className="bg-purple-50/50 border border-purple-100 rounded-xl p-3 text-[11px] space-y-1.5 text-purple-800">
            <p className="font-bold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              Available Shop Context Data Sources for AI:
            </p>
            <ul className="list-disc pl-4 space-y-0.5 text-purple-700 font-medium">
              <li>📦 <strong>Live Product Catalog & Variants</strong> (Stock count, categories, and item prices)</li>
              <li>ℹ️ <strong>Shop Profile</strong> (Welcome messages, custom guidelines, and storefront configurations)</li>
              <li>💬 <strong>Conversation Context</strong> (Customer's segment, language, and recent message thread history)</li>
            </ul>
          </div>
        )}
      </div>

      {/* 2. Fixed Reply & Surfacing Section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="text-sm">💬</span>
          <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">Fixed Reply & Surfacing</h3>
        </div>
        <p className="text-[10px] text-slate-400">Configures the canned response sent when a button is tapped or a command is typed.</p>

        <div>
          <label className="text-[11px] font-bold text-slate-600 mb-1 block">
            Fixed Reply Message {!draftUseAI && <span className="text-red-500">*</span>}
          </label>
          <textarea
            value={draftTemplateBody}
            onChange={e => setDraftTemplateBody(e.target.value)}
            rows={2}
            placeholder="Enter the fixed response message..."
            className="w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-purple-500 transition-all font-medium resize-none"
          />
          <p className="text-[9px] text-slate-400 mt-1">Always sent exactly as written when tapped or typed. Supported variables: <code className="bg-slate-100 px-1 rounded font-mono">{`{customerName}`}</code> <code className="bg-slate-100 px-1 rounded font-mono">{`{shopName}`}</code> <code className="bg-slate-100 px-1 rounded font-mono">{`{brand}`}</code> <code className="bg-slate-100 px-1 rounded font-mono">{`{name}`}</code>. All variables are case-insensitive.</p>
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-600 mb-1.5 block">Surfacing Options</label>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={!!draft.showAsButton}
                onChange={e => setDraft({ ...draft, showAsButton: e.target.checked })}
                className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300"
              />
              Show as inline button
            </label>
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={!!draft.showAsCommand}
                onChange={e => setDraft({ ...draft, showAsCommand: e.target.checked })}
                className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300"
              />
              Show as typed command
            </label>
          </div>
        </div>

        {capBlocked && (
          <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] font-bold text-amber-700">
            Limit reached ({surfacedCount}/{constants.maxSurfacedRules} slots used in this menu level). Disable another button in this menu first.
          </div>
        )}

        {isSurfaced && (
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1 block">Button Label {draft.showAsButton && <span className="text-red-500">*</span>}</label>
                <input
                  type="text"
                  value={draft.buttonLabel}
                  maxLength={64}
                  onChange={e => setDraft({ ...draft, buttonLabel: e.target.value })}
                  placeholder="e.g. 🍛 View Menu"
                  className="w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-purple-500 transition-all font-medium"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1 block">Command {draft.showAsCommand && <span className="text-red-500">*</span>}</label>
                <input
                  type="text"
                  value={draft.command}
                  maxLength={32}
                  onChange={e => setDraft({ ...draft, command: e.target.value })}
                  placeholder="/menu"
                  className={`w-full bg-white border-2 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none transition-all font-mono ${commandValid ? 'border-slate-200 focus:border-purple-500' : 'border-red-300 focus:border-red-500'}`}
                />
                {!commandValid && draft.command && (
                  <p className="text-[10px] text-red-500 mt-1 font-medium">Must start with / and use lowercase letters, numbers, or underscores.</p>
                )}
                {commandValid && draft.command && (
                  <p className="text-[10px] text-slate-400 mt-1 font-medium">Customers type this in Telegram to trigger the rule.</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1 block">Parent Menu Level</label>
                <select
                  value={draft.parentRuleId || ""}
                  onChange={(e) => setDraft({ ...draft, parentRuleId: e.target.value || null })}
                  className="w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-purple-500 transition-all font-medium"
                >
                  <option value="">Root / Main Menu (/start)</option>
                  {parentCandidates.map((p) => {
                    const { hasCycle, depth: parentDepth } = getParentChain(allRules, p.id, rule.id);
                    const subtreeHeight = getSubtreeHeight(allRules, rule.id);
                    const isTooDeep = parentDepth + 1 + subtreeHeight > 2;

                    const isDisabled = hasCycle || isTooDeep;
                    let labelSuffix = "";
                    if (hasCycle) labelSuffix = " ⚠️ (Disabled: would create cycle)";
                    else if (isTooDeep) labelSuffix = " ⚠️ (Disabled: would exceed depth limit)";

                    return (
                      <option key={p.id} value={p.id} disabled={isDisabled}>
                        {p.surfaceConfig?.buttonLabel || p.name} ({p.surfaceConfig?.command}){labelSuffix}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1 block">Menu Position (order shown, 0 = first)</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDraft({ ...draft, menuPosition: Math.max(0, draft.menuPosition - 1) })}
                    className="w-8 h-8 rounded-lg bg-white border-2 border-slate-200 text-slate-600 font-bold hover:border-purple-400 transition-all cursor-pointer"
                  >−</button>
                  <span className="w-10 text-center text-sm font-bold text-slate-800">{draft.menuPosition}</span>
                  <button
                    onClick={() => setDraft({ ...draft, menuPosition: draft.menuPosition + 1 })}
                    className="w-8 h-8 rounded-lg bg-white border-2 border-slate-200 text-slate-600 font-bold hover:border-purple-400 transition-all cursor-pointer"
                  >+</button>
                </div>
              </div>
            </div>

            {/* Event config: only relevant for EVENT rules */}
            {isEventRule && (
              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1 block">Trigger Event</label>
                <select
                  value={rule.eventConfig?.eventName || ""}
                  onChange={() => {/* eventName managed at create time; read-only here */}}
                  className="w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-purple-500 transition-all font-medium"
                  disabled
                >
                  {(constants.knownEvents || []).map(ev => (
                    <option key={ev.value} value={ev.value}>{ev.label}</option>
                  ))}
                  {rule.eventConfig?.eventName && !(constants.knownEvents || []).some(ev => ev.value === rule.eventConfig!.eventName) && (
                    <option value={rule.eventConfig.eventName}>{rule.eventConfig.eventName}</option>
                  )}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">Event name is set when the rule is created and matches a known event.</p>
              </div>
            )}

            {/* Live preview */}
            <div className="bg-white rounded-xl border border-slate-200 p-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Live preview</p>
              <div className="flex items-center gap-2 flex-wrap">
                {draft.showAsButton && (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-bold shadow-sm">
                    {draft.buttonLabel || "Button Label"}
                  </span>
                )}
                {draft.showAsCommand && (
                  <code className="px-2 py-1 rounded bg-slate-100 text-slate-600 text-xs font-mono">{commandValid && draft.command ? draft.command : "/command"}</code>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-bold text-xs transition-all border border-slate-200 cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={saving || capBlocked}
          className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
        >
          {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Save Settings
        </button>
      </div>
    </div>
  );
}
