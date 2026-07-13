import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, MessageCircle, Instagram, Globe, Loader2 } from "lucide-react";
import { authedFetch } from "../../api/client";

// ── Types matching backend GET /api/leads?filter=me ──
export interface BackendLead {
  id: string;
  name: string | null;
  contact: string | null;
  channel: string;
  lastActiveAt: string;
  conversationId: string | null;
  lastMessage: string;
  intent: string | null;
  status: string;
  assignedTo: { id: string; firstName: string; lastName: string } | null;
  priority: string;
  agentAssigned: string | null;
  // 🆕 New fields
  pendingOrderAmount: number | null;
  isUnread: boolean;
  lastMessageSender: "CLIENT" | "AGENT" | "SYSTEM" | "BOT" | null;
}

const CHANNEL_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  TELEGRAM: MessageCircle,
  WHATSAPP: MessageCircle,
  INSTAGRAM: Instagram,
  WEBSITE: Globe,
};

const CHANNEL_CLASS: Record<string, string> = {
  TELEGRAM: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  WHATSAPP: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  INSTAGRAM: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  WEBSITE: "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  OPEN: { label: "Open", className: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
  ASSIGNED: { label: "Assigned", className: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  RESOLVED: { label: "Resolved", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  SNOOZED: { label: "Snoozed", className: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function InboxList() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<BackendLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await authedFetch("/api/leads?filter=me");
      if (!res.ok) throw new Error("Failed to fetch inbox");
      const data: BackendLead[] = await res.json();
      setLeads(data);
    } catch (e: any) {
      setError(e.message || "Failed to load inbox");
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-brand-saffron" />
        <span className="ml-3 text-sm text-app-text-muted">Loading your inbox...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-rose-400 font-mono">Failed to load inbox: {error}</p>
        <button
          onClick={fetchLeads}
          className="mt-4 px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs font-black rounded-xl text-slate-300 transition cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <div className="h-12 w-12 rounded-full bg-slate-900 flex items-center justify-center mb-4">
          <MessageSquare className="h-6 w-6 text-slate-500" />
        </div>
        <h3 className="text-sm font-black text-slate-300 uppercase tracking-widest">No conversations yet</h3>
        <p className="text-xs text-slate-500 mt-2 max-w-xs">
          No conversations are assigned to you yet. Head to Messages to claim inbound leads.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {leads.map((lead) => {
        const ChannelIcon = CHANNEL_ICON[lead.channel.toUpperCase()] || Globe;
        const channelClass = CHANNEL_CLASS[lead.channel.toUpperCase()] || CHANNEL_CLASS.WEBSITE;
        const statusInfo = STATUS_BADGE[lead.status.toUpperCase()] || STATUS_BADGE.OPEN;
        const displayName = lead.name || lead.contact || "Customer";
        const preview = lead.lastMessage ? (lead.lastMessage.length > 80 ? lead.lastMessage.slice(0, 80) + "..." : lead.lastMessage) : "No messages yet";

        return (
          <button
            key={lead.id}
            onClick={() => lead.conversationId && navigate(`/inbox/${lead.id}`)}
            className="w-full flex items-center gap-4 p-4 rounded-2xl border bg-[var(--ticket-bg)] text-[var(--ticket-text)] border-[var(--ticket-border)] hover:brightness-110 transition-all text-left cursor-pointer group"
          >
            {/* Avatar */}
            <div className="h-10 w-10 rounded-full bg-brand-navy text-white flex items-center justify-center shrink-0 text-xs font-black">
              {displayName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
            </div>

             {/* Content */}
             <div className="flex-1 min-w-0">
               <div className="flex items-center justify-between gap-2">
                 <div className="flex items-center gap-2">
                   <h4 className="text-sm font-bold text-[var(--ticket-text)] truncate">{displayName}</h4>
                   {/* 🆕 Unread indicator - 8px dot in brick color */}
                   {lead.isUnread && (
                     <div className="h-2 w-2 rounded-full bg-[var(--brick)] shrink-0" title="Unread"></div>
                   )}
                 </div>
                 <span className="text-[10px] text-[var(--ticket-text)] font-mono shrink-0 opacity-70">{relativeTime(lead.lastActiveAt)}</span>
               </div>
                <p className="text-xs text-[var(--ticket-text)] truncate mt-0.5 opacity-80 flex items-center gap-1.5">
                  {lead.lastMessageSender === "BOT" && (
                    <span className="shrink-0 text-[10px] font-black px-2 py-1 rounded-full bg-teal-600/90 text-white uppercase tracking-wider">AI</span>
                  )}
                  {lead.lastMessageSender === "AGENT" && (
                    <span className="shrink-0 text-[10px] font-black px-2 py-1 rounded-full bg-brand-navy text-white uppercase tracking-wider">You</span>
                  )}
                  <span className="truncate">{preview}</span>
                </p>
               <div className="flex items-center gap-2 mt-2">
                 <span className={`flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider font-mono ${channelClass}`}>
                   <ChannelIcon className="h-3 w-3" />
                   {lead.channel}
                 </span>
                 <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider font-mono ${statusInfo.className}`}>
                   {statusInfo.label}
                 </span>
                 {/* 🆕 Pending order amount badge */}
                 {lead.pendingOrderAmount && lead.pendingOrderAmount > 0 && (
                   <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                     ₹{Math.round(lead.pendingOrderAmount)}
                   </span>
                 )}
               </div>
             </div>
          </button>
        );
      })}
    </div>
  );
}

export default InboxList;