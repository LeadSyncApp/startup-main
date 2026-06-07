import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, ToggleLeft, ToggleRight, Zap, Clock, Play } from "lucide-react";
import { api } from "../../lib/api";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";

interface AutomationRule {
  id: string;
  name: string;
  isActive: boolean;
  trigger: string;
  triggerDelayMinutes: number;
  action: string;
  actionPayload?: { message?: string; segment?: string };
  runCount: number;
  lastRunAt?: string;
  createdAt: string;
  _count?: { logs: number };
}

const TRIGGER_LABELS: Record<string, string> = {
  LEAD_COLD: "Lead goes cold",
  ORDER_PENDING: "Order stuck pending",
  NEW_LEAD: "New lead arrives",
};

const ACTION_LABELS: Record<string, string> = {
  SEND_MESSAGE: "Send Message",
  CHANGE_SEGMENT: "Change Segment",
};

const TRIGGER_COLOR: Record<string, string> = {
  LEAD_COLD: "bg-blue-50 text-blue-700 border-blue-200",
  ORDER_PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  NEW_LEAD: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const ACTION_COLOR: Record<string, string> = {
  SEND_MESSAGE: "bg-indigo-50 text-indigo-700 border-indigo-200",
  CHANGE_SEGMENT: "bg-violet-50 text-violet-700 border-violet-200",
};

const TEMPLATES = [
  {
    name: "Re-engage cold leads",
    trigger: "LEAD_COLD",
    triggerDelayMinutes: 5760, // 4 days
    action: "SEND_MESSAGE",
    actionPayload: { message: "Hi {name}! We haven't heard from you in a while. Is there anything we can help you with? 😊" },
  },
  {
    name: "Welcome new leads",
    trigger: "NEW_LEAD",
    triggerDelayMinutes: 5,
    action: "SEND_MESSAGE",
    actionPayload: { message: "Hey {name}! Welcome 👋 We're excited to have you. Feel free to ask us anything!" },
  },
  {
    name: "Escalate stuck orders",
    trigger: "ORDER_PENDING",
    triggerDelayMinutes: 1440, // 24h
    action: "SEND_MESSAGE",
    actionPayload: { message: "Hi {name}, just checking in on your order. Our team will update you shortly. Sorry for the wait!" },
  },
];

export function AutomationManager() {
  const { user } = useAuth();
  const canEdit = user?.role === "OWNER" || user?.role === "ADMIN";

  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newName, setNewName] = useState("");
  const [newTrigger, setNewTrigger] = useState<string>("LEAD_COLD");
  const [newDelayHours, setNewDelayHours] = useState(72);
  const [newAction, setNewAction] = useState<string>("SEND_MESSAGE");
  const [newMessage, setNewMessage] = useState("");
  const [newSegment, setNewSegment] = useState("VIP");

  const fetchRules = async () => {
    try {
      const data = await api.get("/automation");
      setRules(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Failed to load automation rules");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRules(); }, []);

  const handleAdd = async () => {
    if (!newName.trim()) { toast.error("Rule name is required"); return; }
    if (newAction === "SEND_MESSAGE" && !newMessage.trim()) { toast.error("Message is required"); return; }
    setSaving(true);
    try {
      const payload: any = {
        name: newName.trim(),
        trigger: newTrigger,
        triggerDelayMinutes: newDelayHours * 60,
        action: newAction,
        actionPayload: newAction === "SEND_MESSAGE"
          ? { message: newMessage.trim() }
          : { segment: newSegment },
      };
      const rule = await api.post("/automation", payload);
      setRules(prev => [rule, ...prev]);
      setNewName(""); setNewMessage(""); setShowForm(false);
      toast.success("Rule created");
    } catch {
      toast.error("Failed to create rule");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (rule: AutomationRule) => {
    try {
      const updated = await api.patch(`/automation/${rule.id}`, { isActive: !rule.isActive });
      setRules(prev => prev.map(r => r.id === rule.id ? { ...r, isActive: updated.isActive } : r));
    } catch {
      toast.error("Failed to update");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this automation rule? This cannot be undone.")) return;
    try {
      await api.delete(`/automation/${id}`);
      setRules(prev => prev.filter(r => r.id !== id));
      toast.success("Rule deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  const applyTemplate = (t: typeof TEMPLATES[0]) => {
    setNewName(t.name);
    setNewTrigger(t.trigger);
    setNewDelayHours(Math.round(t.triggerDelayMinutes / 60));
    setNewAction(t.action);
    if (t.actionPayload.message) setNewMessage(t.actionPayload.message);
    setShowForm(true);
    toast.success(`Template loaded: ${t.name}`);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap size={18} className="text-amber-500" />
          <h2 className="text-lg font-bold text-app-text">Automation Rules</h2>
          <span className="text-xs bg-amber-50 text-amber-600 font-bold px-2 py-0.5 rounded-full border border-amber-100">
            {rules.filter(r => r.isActive).length} active
          </span>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold px-3 py-1.5 rounded-lg transition active:scale-95"
          >
            <Plus size={14} />
            New Rule
          </button>
        )}
      </div>

      <p className="text-xs text-slate-500 mb-4">
        Automation runs every 15 minutes. Rules trigger on conditions and send messages or update lead segments automatically.
      </p>

      {/* Templates */}
      {canEdit && rules.length === 0 && !showForm && (
        <div className="mb-5">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Quick Templates</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {TEMPLATES.map(t => (
              <button
                key={t.name}
                onClick={() => applyTemplate(t)}
                className="text-left bg-app-bg hover:bg-indigo-50 border border-app hover:border-indigo-200 rounded-xl p-3 transition group"
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Play size={11} className="text-indigo-400 group-hover:text-indigo-600" />
                  <span className="text-xs font-bold text-slate-700 group-hover:text-indigo-700">{t.name}</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed line-clamp-2">
                  Trigger: <strong>{TRIGGER_LABELS[t.trigger]}</strong> after {Math.round(t.triggerDelayMinutes / 60)}h
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 space-y-3">
              <input
                type="text"
                placeholder="Rule name — e.g. 'Re-engage cold leads'"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="w-full border border-app rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-app-surface"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Trigger</label>
                  <select
                    value={newTrigger}
                    onChange={e => setNewTrigger(e.target.value)}
                    className="w-full border border-app rounded-lg px-3 py-2 text-sm bg-app-surface focus:outline-none focus:ring-2 focus:ring-amber-300"
                  >
                    {Object.entries(TRIGGER_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Delay (hours)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={720}
                    value={newDelayHours}
                    onChange={e => setNewDelayHours(Number(e.target.value))}
                    className="w-full border border-app rounded-lg px-3 py-2 text-sm bg-app-surface focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Action</label>
                  <select
                    value={newAction}
                    onChange={e => setNewAction(e.target.value)}
                    className="w-full border border-app rounded-lg px-3 py-2 text-sm bg-app-surface focus:outline-none focus:ring-2 focus:ring-amber-300"
                  >
                    {Object.entries(ACTION_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                {newAction === "CHANGE_SEGMENT" && (
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Segment</label>
                    <select
                      value={newSegment}
                      onChange={e => setNewSegment(e.target.value)}
                      className="w-full border border-app rounded-lg px-3 py-2 text-sm bg-app-surface focus:outline-none focus:ring-2 focus:ring-amber-300"
                    >
                      {["NEW","REGULAR","VIP","CHURN_RISK"].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                )}
              </div>
              {newAction === "SEND_MESSAGE" && (
                <div>
                  <textarea
                    placeholder="Message to send — use {name} for the customer's name"
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    rows={3}
                    maxLength={500}
                    className="w-full border border-app rounded-lg px-3 py-2 text-sm bg-app-surface focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none"
                  />
                  <div className="text-right text-[10px] text-slate-400 -mt-1">{newMessage.length}/500</div>
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowForm(false)} className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5">Cancel</button>
                <button
                  onClick={handleAdd}
                  disabled={saving}
                  className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-bold px-4 py-1.5 rounded-lg transition"
                >
                  {saving ? "Creating..." : "Create Rule"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rules list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : rules.length === 0 && !showForm ? (
        <div className="text-center py-8 text-slate-400">
          <Zap size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No automation rules yet.</p>
          <p className="text-xs">Use a template above or create a custom rule.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {rules.map(rule => (
              <motion.div
                key={rule.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className={`border rounded-xl p-3.5 transition-all ${rule.isActive ? "bg-app-surface border-app" : "bg-app-bg border-app opacity-60"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 mb-1.5">{rule.name}</p>
                    <div className="flex flex-wrap gap-1.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${TRIGGER_COLOR[rule.trigger] ?? "bg-slate-100 text-app-muted border-app"}`}>
                        {TRIGGER_LABELS[rule.trigger] ?? rule.trigger}
                      </span>
                      <span className="text-[10px] text-slate-400 flex items-center gap-0.5 bg-app-bg border border-app px-2 py-0.5 rounded">
                        <Clock size={9} />
                        {rule.triggerDelayMinutes >= 60 ? `${Math.round(rule.triggerDelayMinutes / 60)}h` : `${rule.triggerDelayMinutes}m`}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${ACTION_COLOR[rule.action] ?? "bg-slate-100 text-app-muted border-app"}`}>
                        {ACTION_LABELS[rule.action] ?? rule.action}
                      </span>
                      {rule.runCount > 0 && (
                        <span className="text-[10px] text-slate-400 bg-app-bg border border-app px-2 py-0.5 rounded">
                          ran {rule.runCount}×
                        </span>
                      )}
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleToggle(rule)}
                        className="text-slate-400 hover:text-amber-600 transition"
                        title={rule.isActive ? "Pause" : "Activate"}
                      >
                        {rule.isActive
                          ? <ToggleRight size={20} className="text-amber-500" />
                          : <ToggleLeft size={20} />
                        }
                      </button>
                      <button
                        onClick={() => handleDelete(rule.id)}
                        className="text-slate-300 hover:text-red-500 transition"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
