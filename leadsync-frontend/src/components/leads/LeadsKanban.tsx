import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, TrendingUp, MessageCircle } from "lucide-react";
import { api } from "../../lib/api";
import toast from "react-hot-toast";

const SEGMENTS = [
  { key: "NEW",         label: "New",         color: "bg-blue-500",   light: "bg-blue-50 border-blue-200",  text: "text-blue-700"   },
  { key: "REGULAR",     label: "Regular",     color: "bg-emerald-500",light: "bg-emerald-50 border-emerald-200", text: "text-emerald-700" },
  { key: "VIP",         label: "VIP",         color: "bg-violet-500", light: "bg-violet-50 border-violet-200",  text: "text-violet-700"  },
  { key: "CHURN_RISK",  label: "Churn Risk",  color: "bg-red-500",    light: "bg-red-50 border-red-200",     text: "text-red-700"    },
];

const PRIORITY_COLOR: Record<string, string> = {
  URGENT: "bg-red-100 text-red-700 border-red-200",
  HIGH:   "bg-orange-100 text-orange-700 border-orange-200",
  NORMAL: "bg-slate-100 text-slate-500 border-slate-200",
};

const CHANNEL_COLOR: Record<string, string> = {
  TELEGRAM: "bg-blue-100 text-blue-700",
  INSTAGRAM: "bg-pink-100 text-pink-700",
  WHATSAPP:  "bg-green-100 text-green-700",
  OFFLINE:   "bg-[#F1F5F9] text-[#475569] border border-[#CBD5E1]",
};

interface Lead {
  id: string;
  name?: string;
  contact: string;
  channel: string;
  segment: string;
  priority?: string;
  totalSpend?: number;
  lastMessage?: string;
  conversationId?: string;
  aiScore?: number;
  suggestedAction?: string;
  daysSinceActive?: number;
}

interface Props {
  leads: Lead[];
  onRowClick: (lead: Lead) => void;
  onSegmentChange: (leadId: string, newSegment: string) => void;
}

function LeadCard({ lead, onRowClick, onSegmentChange }: {
  lead: Lead;
  onRowClick: (l: Lead) => void;
  onSegmentChange: (id: string, seg: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const initials = (lead.name || lead.contact).slice(0, 2).toUpperCase();
  const priority = lead.priority ?? "NORMAL";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 340, damping: 28 }}
      className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm hover:shadow-md hover:border-slate-300 transition-all cursor-pointer group"
      onClick={() => onRowClick(lead)}
    >
      {/* Avatar + name row */}
      <div className="flex items-center gap-2.5 mb-2.5">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white text-xs font-black shrink-0">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800 truncate leading-tight">
            {lead.name || lead.contact}
          </p>
          {lead.name && (
            <p className="text-[11px] text-slate-400 truncate">{lead.contact}</p>
          )}
        </div>
      </div>

      {/* Badges */}
      <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${PRIORITY_COLOR[priority]}`}>
          {priority}
        </span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${lead.channel?.toUpperCase() === "WEBSITE" ? CHANNEL_COLOR.OFFLINE : (CHANNEL_COLOR[lead.channel] ?? "bg-slate-100 text-slate-600")}`}>
          {lead.channel?.toUpperCase() === "WEBSITE" ? "OFFLINE" : lead.channel}
        </span>
        {(lead.totalSpend ?? 0) > 0 && (
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-0.5">
            <TrendingUp size={9} />
            ₹{(lead.totalSpend ?? 0).toLocaleString("en-IN")}
          </span>
        )}
      </div>

      {/* Last message preview */}
      {lead.lastMessage && (
        <div className="flex items-start gap-1.5 mb-3">
          <MessageCircle size={11} className="text-slate-300 mt-0.5 shrink-0" />
          <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">{lead.lastMessage}</p>
        </div>
      )}

      {/* AI Score bar */}
      <div className="mb-3 px-0.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">AI Score</span>
          <span className={`text-[10px] font-black ${
            (lead.aiScore ?? 0) >= 70 ? "text-emerald-600" :
            (lead.aiScore ?? 0) >= 40 ? "text-amber-600" : "text-red-500"
          }`}>{lead.aiScore ?? 0}</span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              (lead.aiScore ?? 0) >= 70 ? "bg-emerald-500" :
              (lead.aiScore ?? 0) >= 40 ? "bg-amber-500" : "bg-red-400"
            }`}
            style={{ width: `${lead.aiScore ?? 0}%` }}
          />
        </div>
        {lead.suggestedAction && lead.suggestedAction !== "Monitor" && (
          <span className="text-[9px] font-bold text-indigo-600 mt-1 inline-block">⚡ {lead.suggestedAction}</span>
        )}
      </div>

      {/* Move to segment dropdown */}
      <div className="relative" onClick={e => e.stopPropagation()}>
        <button
          onClick={() => setMenuOpen(o => !o)}
          className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-indigo-600 transition py-0.5"
        >
          Move to <ChevronDown size={10} className={`transition-transform ${menuOpen ? "rotate-180" : ""}`} />
        </button>
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.96 }}
              transition={{ duration: 0.12 }}
              className="absolute bottom-full mb-1 left-0 bg-white border border-slate-200 rounded-xl shadow-xl z-30 overflow-hidden min-w-[140px]"
            >
              {SEGMENTS.filter(s => s.key !== lead.segment).map(seg => (
                <button
                  key={seg.key}
                  onClick={() => { onSegmentChange(lead.id, seg.key); setMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-slate-50 transition flex items-center gap-2"
                >
                  <span className={`w-2 h-2 rounded-full ${seg.color}`} />
                  {seg.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default function LeadsKanban({ leads, onRowClick, onSegmentChange }: Props) {
  const [localLeads, setLocalLeads] = useState<Lead[]>(leads);

  // Keep local in sync when parent lead list changes (filters, refetch)
  if (JSON.stringify(leads.map(l => l.id)) !== JSON.stringify(localLeads.map(l => l.id))) {
    setLocalLeads(leads);
  }

  const handleMove = async (leadId: string, newSegment: string) => {
    // Optimistic update
    setLocalLeads(prev => prev.map(l => l.id === leadId ? { ...l, segment: newSegment } : l));
    try {
      await api.patch(`/leads/${leadId}`, { segment: newSegment });
      onSegmentChange(leadId, newSegment);
      toast.success(`Moved to ${SEGMENTS.find(s => s.key === newSegment)?.label}`);
    } catch {
      // Revert
      setLocalLeads(prev => prev.map(l => l.id === leadId ? { ...l, segment: leads.find(x => x.id === leadId)?.segment ?? l.segment } : l));
      toast.error("Failed to move lead");
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {SEGMENTS.map(seg => {
        const col = localLeads.filter(l => l.segment === seg.key);
        return (
          <div key={seg.key} className="flex flex-col gap-3">
            {/* Column header */}
            <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl border ${seg.light}`}>
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${seg.color}`} />
                <span className={`text-sm font-bold ${seg.text}`}>{seg.label}</span>
              </div>
              <span className={`text-xs font-black px-2 py-0.5 rounded-full ${seg.color} text-white`}>
                {col.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-2.5 min-h-[120px]">
              <AnimatePresence mode="popLayout">
                {col.length === 0 ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center"
                  >
                    <p className="text-xs text-slate-300 font-medium">No leads</p>
                  </motion.div>
                ) : (
                  col.map(lead => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      onRowClick={onRowClick}
                      onSegmentChange={handleMove}
                    />
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>
        );
      })}
    </div>
  );
}
