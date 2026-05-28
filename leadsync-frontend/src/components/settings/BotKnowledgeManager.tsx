import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, ToggleLeft, ToggleRight, Brain } from "lucide-react";
import { api } from "../../lib/api";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";

interface KnowledgeItem {
  id: string;
  type: "FAQ" | "RULE" | "PRODUCT";
  title: string;
  content: string;
  isActive: boolean;
  createdAt: string;
}

const TYPE_CONFIG = {
  FAQ: { label: "FAQ", color: "bg-blue-100 text-blue-700 border-blue-200" },
  RULE: { label: "Rule", color: "bg-amber-100 text-amber-700 border-amber-200" },
  PRODUCT: { label: "Product", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
};

const getTypeConfig = (type?: string) => {
  const t = (type || "").toUpperCase();
  if (t === "FAQ") return TYPE_CONFIG.FAQ;
  if (t === "RULE") return TYPE_CONFIG.RULE;
  if (t === "PRODUCT") return TYPE_CONFIG.PRODUCT;
  return { label: type || "FAQ", color: "bg-slate-100 text-slate-700 border-app" };
};

export function BotKnowledgeManager() {
  const { user } = useAuth();
  const isAgent = user?.role === "AGENT";

  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newType, setNewType] = useState<"FAQ" | "RULE" | "PRODUCT">("FAQ");
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");

  const fetchItems = async () => {
    try {
      const data = await api.get("/bot-knowledge");
      // Filter it locally as well just in case of any cached data
      const filtered = data.filter((item: any) => item.type !== "TELEGRAM_CONSUMER_LEASE");
      setItems(filtered);
    } catch {
      toast.error("Failed to load bot knowledge");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchItems(); }, []);

  const handleAdd = async () => {
    if (!newTitle.trim() || !newContent.trim()) {
      toast.error("Title and content are required");
      return;
    }
    setSaving(true);
    try {
      const item = await api.post("/bot-knowledge", { type: newType, title: newTitle.trim(), content: newContent.trim() });
      setItems(prev => [item, ...prev]);
      setNewTitle("");
      setNewContent("");
      setShowForm(false);
      toast.success("Knowledge item added");
    } catch {
      toast.error("Failed to add item");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (item: KnowledgeItem) => {
    try {
      const updated = await api.patch(`/bot-knowledge/${item.id}`, { isActive: !item.isActive });
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, isActive: updated.isActive } : i));
    } catch {
      toast.error("Failed to update");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this knowledge item?")) return;
    try {
      await api.delete(`/bot-knowledge/${id}`);
      setItems(prev => prev.filter(i => i.id !== id));
      toast.success("Deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain size={18} className="text-indigo-600" />
          <h2 className="text-lg font-bold text-app-text">Bot Knowledge Base</h2>
          <span className="text-xs bg-indigo-50 text-indigo-600 font-bold px-2 py-0.5 rounded-full border border-indigo-100">
            {items.filter(i => i.isActive).length} active
          </span>
        </div>
        {!isAgent && (
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-3 py-1.5 rounded-lg transition active:scale-95"
          >
            <Plus size={14} />
            Add Item
          </button>
        )}
      </div>

      <p className="text-xs text-slate-500 mb-4">
        Teach your AI bot specific FAQs, business rules, and product details. Active items are injected into every bot reply.
      </p>

      {/* Add form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-4 space-y-3">
              <div className="flex gap-2">
                {(["FAQ", "RULE", "PRODUCT"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setNewType(t)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold border transition ${newType === t ? TYPE_CONFIG[t].color + " shadow-sm" : "bg-app-surface border-app text-slate-500 hover:border-slate-300"}`}
                  >
                    {TYPE_CONFIG[t].label}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Title — e.g. 'What is the return policy?'"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                maxLength={120}
                className="w-full border border-app rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <div>
                <textarea
                  placeholder="Content — write the answer or description the bot should use..."
                  value={newContent}
                  onChange={e => setNewContent(e.target.value)}
                  rows={3}
                  maxLength={600}
                  className="w-full border border-app rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                />
                <div className="text-right text-[10px] text-slate-400 -mt-1">{newContent.length}/600</div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowForm(false)} className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5">Cancel</button>
                <button
                  onClick={handleAdd}
                  disabled={saving || !newTitle.trim() || !newContent.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold px-4 py-1.5 rounded-lg transition"
                >
                  {saving ? "Saving..." : "Add"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Items list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-10 text-slate-400">
          <Brain size={36} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No knowledge items yet.</p>
          <p className="text-xs">Add FAQs, rules, and product info to make your bot smarter.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {items.map(item => {
              const typeCfg = getTypeConfig(item?.type);
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className={`border rounded-xl p-3.5 transition-all ${item.isActive ? "bg-app-surface border-app" : "bg-app-bg border-app opacity-60"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${typeCfg.color}`}>
                          {typeCfg.label}
                        </span>
                        <span className="text-sm font-semibold text-slate-800 truncate">{item.title}</span>
                      </div>
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{item.content}</p>
                  </div>
                  {!isAgent && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleToggle(item)}
                        className="text-slate-400 hover:text-indigo-600 transition"
                        title={item.isActive ? "Deactivate" : "Activate"}
                      >
                        {item.isActive
                          ? <ToggleRight size={20} className="text-indigo-600" />
                          : <ToggleLeft size={20} />
                        }
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-slate-300 hover:text-red-500 transition"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )})}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
