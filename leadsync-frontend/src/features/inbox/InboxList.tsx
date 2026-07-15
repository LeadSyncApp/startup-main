import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, MessageCircle, Instagram, Globe, Loader2, UserPlus } from "lucide-react";
import toast from "react-hot-toast";
import { authedFetch } from "../../api/client";
import { useAuth } from "../auth-tenancy/AuthContext";
import { getSocket } from "../../lib/socketClient";
import { Badge } from "../../components/ui/Badge";

// NOTE FOR REVIEW: InboxList accepts optional selectedLeadId and onSelectLead props
// for use inside InboxSplitView. When rendered standalone (legacy route), these
// default to null / no-op, preserving existing behavior.
interface InboxListProps {
  selectedLeadId?: string | null;
  onSelectLead?: (leadId: string) => void;
}

// ── Types matching backend GET /api/leads?filter=mine ──
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

export interface LeadsResponse {
  data: BackendLead[];
  meta: { total: number; page: number; limit: number; hasMore: boolean };
}

type FilterTab = "chats" | "completed";

const CHANNEL_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  TELEGRAM: MessageCircle,
  WHATSAPP: MessageCircle,
  INSTAGRAM: Instagram,
  WEBSITE: Globe,
};

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "chats", label: "Chats" },
  { key: "completed", label: "Completed" },
];

const STATUS_VARIANT: Record<string, "success" | "warning" | "error" | "info" | "neutral"> = {
  OPEN: "neutral",
  ASSIGNED: "warning",
  RESOLVED: "success",
  SNOOZED: "info",
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

export function InboxList({ selectedLeadId, onSelectLead }: InboxListProps = {}) {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<BackendLead[]>([]);
  const [meta, setMeta] = useState<{ total: number; page: number; limit: number; hasMore: boolean }>({ total: 0, page: 1, limit: 50, hasMore: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>("chats");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const { companyId } = useAuth();

  const fetchLeads = useCallback(async (pageNum: number = 1, append: boolean = false) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      // Map UI tabs to backend filter values
      const backendFilter = filter === "completed" ? "resolved" : "mine";
      params.set("filter", backendFilter);
      if (search) params.set("search", search);
      params.set("page", String(pageNum));
      params.set("limit", "50");

      const res = await authedFetch(`/api/leads?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch inbox");
      const json: LeadsResponse = await res.json();

      // Strict separation: hard-filter by status to prevent any leakage
      const statusFiltered = json.data.filter((lead) => {
        if (filter === "chats") {
          return lead.status !== "RESOLVED" && lead.status !== "COMPLETED";
        }
        if (filter === "completed") {
          return lead.status === "RESOLVED" || lead.status === "COMPLETED";
        }
        return true;
      });

      if (append) {
        setLeads((prev) => [...prev, ...statusFiltered]);
      } else {
        setLeads(statusFiltered);
      }
      setMeta(json.meta);
    } catch (e: any) {
      setError(e.message || "Failed to load inbox");
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  // Initial fetch when filter/search changes
  useEffect(() => {
    fetchLeads(1);
  }, [fetchLeads]);

  // Listen for real-time conversation resolution to remove from list immediately
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleResolved = (data: { conversationId: string; companyId: string }) => {
      if (data.companyId === companyId) {
        setLeads((prev) => prev.filter((lead) => lead.conversationId !== data.conversationId));
      }
    };

    socket.on("conversation.resolved", handleResolved);
    return () => {
      socket.off("conversation.resolved", handleResolved);
    };
  }, [companyId]);

  const handleLoadMore = () => {
    if (!meta.hasMore || loading) return;
    fetchLeads(meta.page + 1, true);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  // Handle claim for unclaimed chat
  const handleClaim = async (e: React.MouseEvent, leadId: string) => {
    e.stopPropagation(); // Prevent row click navigation
    e.preventDefault();
    try {
      const res = await authedFetch(`/api/leads/${leadId}/assign`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to claim");
      }
      // Refresh list to reflect new assignment
      fetchLeads();
    } catch (e: any) {
      toast.error(e.message || "Failed to claim");
    }
  };

  if (loading && leads.length === 0) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-brand-saffron" />
        <span className="ml-3 text-sm text-app-text-muted">Loading your inbox...</span>
      </div>
    );
  }

  if (error && leads.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-rose-400 font-mono">Failed to load inbox: {error}</p>
        <button
          onClick={() => fetchLeads(1)}
          className="mt-4 px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs font-black rounded-xl text-slate-300 transition cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search input */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search leads..."
          className="flex-1 input-field text-xs"
        />
        <button type="submit" className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs font-black text-slate-300 hover:bg-slate-700 transition cursor-pointer">
          Search
        </button>
        {search && (
          <button
            type="button"
            onClick={() => { setSearch(""); setSearchInput(""); }}
            className="px-2 py-1.5 text-xs font-black text-slate-500 hover:text-slate-300 transition cursor-pointer"
          >
            Clear
          </button>
        )}
      </form>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-slate-800 pb-2">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1 text-xs font-black rounded-t transition cursor-pointer ${
              filter === tab.key
                ? "bg-slate-800 text-slate-200 border-b-2 border-brand-saffron"
                : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {leads.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <div className="h-12 w-12 rounded-full bg-slate-900 flex items-center justify-center mb-4">
            <MessageSquare className="h-6 w-6 text-slate-500" />
          </div>
          <h3 className="text-sm font-black text-slate-300 uppercase tracking-widest">No conversations found</h3>
          <p className="text-xs text-slate-500 mt-2 max-w-xs">
            No conversations match the current filter.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-1">
            {leads.map((lead) => {
              const ChannelIcon = CHANNEL_ICON[lead.channel.toUpperCase()] || Globe;
              const displayName = lead.name || lead.contact || "Customer";
              const preview = lead.lastMessage ? (lead.lastMessage.length > 80 ? lead.lastMessage.slice(0, 80) + "..." : lead.lastMessage) : "No messages yet";

              return (
                <button
                  key={lead.id}
                  onClick={() => {
                    if (!lead.conversationId) return;
                    if (onSelectLead) {
                      onSelectLead(lead.id);
                    } else {
                      navigate(`/inbox/${lead.id}`);
                    }
                  }}
                  className={`w-full flex items-center gap-4 p-2 rounded-2xl border bg-[var(--ticket-bg)] text-[var(--ticket-text)] border-[var(--ticket-border)] hover:brightness-110 transition-all text-left cursor-pointer group ${
                    selectedLeadId === lead.id ? "ring-2 ring-[var(--brand-saffron)]" : ""
                  }`}
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
                      <Badge variant="neutral" className="flex items-center gap-1">
                        <ChannelIcon className="h-3 w-3" />
                        {lead.channel}
                      </Badge>
                      <Badge variant={STATUS_VARIANT[lead.status.toUpperCase()] || "neutral"}>
                        {lead.status}
                      </Badge>
                      {/* Pending order amount badge */}
                      {lead.pendingOrderAmount && lead.pendingOrderAmount > 0 && (
                        <Badge variant="warning">
                          ₹{Math.round(lead.pendingOrderAmount)}
                        </Badge>
                      )}
                      {/* Claim button for unassigned chats */}
                      {!lead.assignedTo && (
                        <button
                          onClick={(e) => handleClaim(e, lead.id)}
                          className="shrink-0 flex items-center gap-1 px-2 py-0.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 rounded text-[10px] font-black transition cursor-pointer border border-indigo-500/30"
                          title="Claim this conversation"
                        >
                          <UserPlus className="h-3 w-3" />
                          Claim
                        </button>
                      )}
                    </div>
                   </div>
                </button>
              );
            })}
          </div>

          {/* Load more button */}
          {meta.hasMore && (
            <div className="flex justify-center pt-2">
              <button
                onClick={handleLoadMore}
                disabled={loading}
                className="px-6 py-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-xs font-black rounded-xl text-slate-300 transition cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Loading...</span>
                ) : (
                  `Load more (${meta.total - leads.length} remaining)`
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default InboxList;