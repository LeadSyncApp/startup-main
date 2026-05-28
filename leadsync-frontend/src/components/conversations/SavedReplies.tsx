import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Plus, Trash2, Check, X, Zap } from "lucide-react";

export interface SavedReply {
  id: string;
  title: string;
  content: string;
}

const STORAGE_KEY = "leadsync_saved_replies";

const DEFAULT_REPLIES: SavedReply[] = [
  { id: "1", title: "Welcome", content: "Hi! 👋 Thanks for reaching out. How can I help you today?" },
  { id: "2", title: "Processing order", content: "Your order is being processed and will be ready shortly. We'll notify you as soon as it's confirmed!" },
  { id: "3", title: "Delivery time", content: "Standard delivery takes 30–45 minutes. We'll keep you updated on your order status." },
  { id: "4", title: "Thank you", content: "Thank you for your order! 🙏 We appreciate your support. Is there anything else I can help you with?" },
  { id: "5", title: "Will check", content: "Let me check that for you right away and get back to you in a moment!" },
];

export function useSavedReplies() {
  const [replies, setReplies] = useState<SavedReply[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_REPLIES;
    } catch {
      return DEFAULT_REPLIES;
    }
  });

  const save = useCallback((updated: SavedReply[]) => {
    setReplies(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, []);

  const addReply = useCallback((title: string, content: string) => {
    const newReply: SavedReply = { id: Date.now().toString(), title, content };
    save([...replies, newReply]);
  }, [replies, save]);

  const deleteReply = useCallback((id: string) => {
    save(replies.filter(r => r.id !== id));
  }, [replies, save]);

  return { replies, addReply, deleteReply };
}

// ──────────────────────────────────────────────
// Floating quick-insert panel (shown on "/" key)
// ──────────────────────────────────────────────
interface SavedRepliesPopupProps {
  query: string;
  onSelect: (content: string) => void;
  onClose: () => void;
}

export function SavedRepliesPopup({ query, onSelect, onClose }: SavedRepliesPopupProps) {
  const { replies } = useSavedReplies();
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = replies.filter(r =>
    !query || r.title.toLowerCase().includes(query.toLowerCase()) || r.content.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => { setCursor(0); }, [query]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") { e.preventDefault(); setCursor(c => Math.min(c + 1, filtered.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
      else if (e.key === "Enter") { e.preventDefault(); if (filtered[cursor]) onSelect(filtered[cursor].content); }
      else if (e.key === "Escape") { onClose(); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [filtered, cursor, onSelect, onClose]);

  // Scroll active item into view
  useEffect(() => {
    const item = listRef.current?.children[cursor] as HTMLElement;
    item?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  if (filtered.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.97 }}
        className="absolute bottom-full left-0 mb-2 w-full bg-app-surface rounded-2xl shadow-2xl border border-app p-4 text-sm text-slate-400 text-center z-50"
      >
        No saved replies found for "{query}"
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      className="absolute bottom-full left-0 mb-2 w-full max-h-72 bg-app-surface rounded-2xl shadow-2xl border border-app overflow-hidden z-50"
    >
      <div className="px-4 py-2.5 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
        <Zap size={12} className="text-indigo-500" />
        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Saved Replies</span>
        <span className="ml-auto text-[9px] text-indigo-400">↑↓ navigate · Enter insert · Esc close</span>
      </div>
      <div ref={listRef} className="overflow-y-auto max-h-56 divide-y divide-slate-50">
        {filtered.map((reply, i) => (
          <button
            key={reply.id}
            onClick={() => onSelect(reply.content)}
            className={`w-full text-left px-4 py-3 transition-colors flex flex-col gap-0.5 ${
              i === cursor ? "bg-indigo-50" : "hover:bg-app-bg"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800">{reply.title}</span>
              {i === cursor && <Check size={10} className="text-indigo-500 ml-auto" />}
            </div>
            <p className="text-xs text-slate-500 truncate">{reply.content}</p>
          </button>
        ))}
      </div>
    </motion.div>
  );
}

// ──────────────────────────────────────────────
// Manager panel (used in Settings)
// ──────────────────────────────────────────────
export function SavedRepliesManager() {
  const { replies, addReply, deleteReply } = useSavedReplies();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const handleAdd = () => {
    if (!title.trim() || !content.trim()) return;
    addReply(title.trim(), content.trim());
    setTitle("");
    setContent("");
    setShowForm(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen size={16} className="text-indigo-500" />
          <h3 className="font-semibold text-slate-800 text-sm">Saved Replies</h3>
          <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold">{replies.length}</span>
        </div>
        <button
          onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition"
        >
          {showForm ? <X size={13} /> : <Plus size={13} />}
          {showForm ? "Cancel" : "Add Reply"}
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-indigo-50 rounded-xl p-4 space-y-3 border border-indigo-100">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Reply name (e.g. Welcome)"
                className="w-full text-sm px-3 py-2 rounded-lg border border-indigo-200 bg-app-surface focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Reply content..."
                rows={3}
                className="w-full text-sm px-3 py-2 rounded-lg border border-indigo-200 bg-app-surface focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              />
              <button
                onClick={handleAdd}
                disabled={!title.trim() || !content.trim()}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg disabled:opacity-40 hover:bg-indigo-700 transition"
              >
                <Check size={12} /> Save Reply
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2">
        {replies.length === 0 && (
          <p className="text-xs text-slate-400 italic text-center py-4">No saved replies yet. Add one above.</p>
        )}
        {replies.map((reply) => (
          <div key={reply.id} className="flex items-start justify-between gap-3 bg-app-bg rounded-xl p-3 border border-app group">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-800">{reply.title}</p>
              <p className="text-xs text-slate-500 truncate mt-0.5">{reply.content}</p>
            </div>
            <button
              onClick={() => deleteReply(reply.id)}
              className="p-1 text-slate-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
