import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Phone, MessageSquare, ShoppingCart, Star, ArrowRight, TrendingUp, Clock, Hash, StickyNote } from "lucide-react";
import { useNavigate } from "react-router-dom";

// ─── Quick notes (localStorage, per-lead) ──────────────────────────────────
function useLeadNote(leadId: string) {
  const [note, setNote] = useState(() =>
    leadId ? localStorage.getItem(`leadsync_lead_note_${leadId}`) || "" : ""
  );

  useEffect(() => {
    if (!leadId) { setNote(""); return; }
    setNote(localStorage.getItem(`leadsync_lead_note_${leadId}`) || "");
  }, [leadId]);

  const save = (val: string) => {
    if (!leadId) return;
    setNote(val);
    if (val.trim()) {
      localStorage.setItem(`leadsync_lead_note_${leadId}`, val);
    } else {
      localStorage.removeItem(`leadsync_lead_note_${leadId}`);
    }
  };

  return { note, save };
}

interface Lead {
  id: string;
  name: string;
  contact: string;
  channel: string;
  segment: string;
  totalSpend: number;
  orderCount: number;
  priority: string;
  intent: string;
  lastMessage: string;
  lastActiveAt: string;
  createdAt: string;
  agentAssigned: string | null;
  conversationId: string | null;
}

interface LeadDrawerProps {
  lead: Lead | null;
  onClose: () => void;
}

const SEGMENT_BADGE: Record<string, string> = {
  VIP: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  REGULAR: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  NEW: "bg-green-500/10 text-green-400 border-green-500/20",
  CHURN_RISK: "bg-red-500/10 text-red-400 border-red-500/20",
};

const CHANNEL_EMOJI: Record<string, string> = {
  TELEGRAM: "✈️",
  INSTAGRAM: "📸",
  WEBSITE: "🌐",
  WHATSAPP: "💚",
  MANUAL: "👤",
};

const PRIORITY_COLOR: Record<string, string> = {
  URGENT: "text-red-400 bg-red-500/10 border-red-500/20",
  HIGH: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  NORMAL: "text-text-muted bg-background-tertiary border-border",
};

function formatRelative(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function LeadDrawer({ lead, onClose }: LeadDrawerProps) {
  const navigate = useNavigate();
  const drawerRef = useRef<HTMLDivElement>(null);
  const noteState = useLeadNote(lead?.id || "");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent) => {
    if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {lead && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          onMouseDown={handleBackdrop}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
          />

          {/* Drawer */}
          <motion.div
            ref={drawerRef}
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="relative w-full max-w-sm bg-background-secondary shadow-2xl flex flex-col h-full z-10 overflow-y-auto"
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-border flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`h-12 w-12 rounded-2xl flex items-center justify-center text-xl font-black shadow-sm ${
                  lead.segment === "VIP" ? "bg-yellow-500/10 text-yellow-400" :
                  lead.priority === "URGENT" ? "bg-red-500/10 text-red-400" :
                  "bg-indigo-500/10 text-indigo-400"
                }`}>
                  {(lead.name || "?").charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h2 className="font-black text-text-primary text-base leading-tight">{lead.name || "Unknown"}</h2>
                    {lead.segment === "VIP" && <Star size={13} className="text-yellow-500 fill-yellow-400" />}
                  </div>
                  <p className="text-xs text-text-disabled mt-0.5">{lead.contact}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-background-tertiary rounded-xl transition text-text-disabled hover:text-text-primary"
              >
                <X size={18} />
              </button>
            </div>

            {/* Badges Row */}
            <div className="px-6 py-3 flex items-center gap-2 flex-wrap border-b border-border">
              <span className={`text-[10px] font-black px-2 py-1 rounded-lg border ${SEGMENT_BADGE[lead.segment] || "bg-background-elevated text-text-muted border-border"}`}>
                {lead.segment || "REGULAR"}
              </span>
              <span className={`text-[10px] font-black px-2 py-1 rounded-lg border ${PRIORITY_COLOR[lead.priority] || PRIORITY_COLOR.NORMAL}`}>
                {lead.priority}
              </span>
              <span className="text-[10px] font-bold bg-background-tertiary text-text-muted px-2 py-1 rounded-lg">
                {CHANNEL_EMOJI[lead.channel] || "📡"} {lead.channel}
              </span>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 px-6 py-4 border-b border-border">
              <div className="bg-emerald-500/10 rounded-xl p-3 border border-emerald-500/20">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp size={13} className="text-emerald-400" />
                  <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400">Total Spend</span>
                </div>
                <p className="text-lg font-black text-text-primary">₹{(lead.totalSpend || 0).toLocaleString()}</p>
              </div>
              <div className="bg-indigo-500/10 rounded-xl p-3 border border-indigo-500/20">
                <div className="flex items-center gap-1.5 mb-1">
                  <ShoppingCart size={13} className="text-indigo-400" />
                  <span className="text-[9px] font-black uppercase tracking-wider text-indigo-400">Orders</span>
                </div>
                <p className="text-lg font-black text-text-primary">{lead.orderCount || 0}</p>
              </div>
            </div>

            {/* Info rows */}
            <div className="px-6 py-4 space-y-3 border-b border-border">
              <div className="flex items-center gap-3 text-sm">
                <div className="h-8 w-8 rounded-lg bg-background-tertiary flex items-center justify-center shrink-0">
                  <Clock size={14} className="text-text-muted" />
                </div>
                <div>
                  <p className="text-[10px] text-text-disabled uppercase tracking-wider font-bold">Last Active</p>
                  <p className="text-sm font-semibold text-text-primary">{formatRelative(lead.lastActiveAt || lead.createdAt)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <div className="h-8 w-8 rounded-lg bg-background-tertiary flex items-center justify-center shrink-0">
                  <Hash size={14} className="text-text-muted" />
                </div>
                <div>
                  <p className="text-[10px] text-text-disabled uppercase tracking-wider font-bold">Intent</p>
                  <p className="text-sm font-semibold text-text-primary">{lead.intent || "Browsing"}</p>
                </div>
              </div>

              {lead.agentAssigned && (
                <div className="flex items-center gap-3 text-sm">
                  <div className="h-8 w-8 rounded-lg bg-background-tertiary flex items-center justify-center shrink-0">
                    <Phone size={14} className="text-text-muted" />
                  </div>
                  <div>
                    <p className="text-[10px] text-text-disabled uppercase tracking-wider font-bold">Assigned To</p>
                    <p className="text-sm font-semibold text-text-primary">{lead.agentAssigned}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Last Message */}
            {lead.lastMessage && (
              <div className="px-6 py-4 border-b border-border">
                <p className="text-[10px] text-text-disabled uppercase tracking-wider font-black mb-2">Last Message</p>
                <div className="bg-background-tertiary rounded-xl p-3 border border-border">
                  <p className="text-sm text-text-secondary leading-relaxed line-clamp-4">
                    "{lead.lastMessage}"
                  </p>
                </div>
              </div>
            )}

            {/* Quick Note */}
            <div className="px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2 mb-2">
                <StickyNote size={13} className="text-amber-500" />
                <p className="text-[10px] text-text-disabled uppercase tracking-wider font-black">Quick Note</p>
              </div>
              <textarea
                value={noteState.note}
                onChange={e => noteState.save(e.target.value)}
                placeholder="Add a private note about this lead…"
                rows={3}
                className="w-full text-sm text-text-primary bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-text-disabled leading-relaxed"
              />
              {noteState.note && (
                <button
                  onClick={() => noteState.save("")}
                  className="mt-1 text-[9px] text-slate-400 hover:text-red-400 font-bold uppercase tracking-wider transition"
                >
                  Clear note
                </button>
              )}
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Actions */}
            <div className="px-6 py-5 border-t border-border bg-background-tertiary space-y-2">
              {lead.conversationId && (
                <button
                  onClick={() => {
                    navigate("/dashboard/conversations");
                    onClose();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition active:scale-[0.98] shadow-lg shadow-indigo-200"
                >
                  <MessageSquare size={16} />
                  Open Conversation
                  <ArrowRight size={14} className="ml-auto opacity-60" />
                </button>
              )}
              <p className="text-center text-[9px] text-text-disabled uppercase tracking-widest">
                Member since {new Date(lead.createdAt).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
