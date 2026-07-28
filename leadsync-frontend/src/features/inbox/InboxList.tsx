import { useState, useEffect, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, MessageCircle, Instagram, Globe, Loader2, UserPlus, Trash2, CheckSquare, Square } from "lucide-react";
import toast from "react-hot-toast";
import { authedFetch } from "../../api/client";
import { useAuth } from "../auth-tenancy/AuthContext";
import { onEvent } from "../../lib/socketClient";
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
  unreadCount: number;
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

export const InboxList = memo(function InboxList({ selectedLeadId, onSelectLead }: InboxListProps = {}) {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<BackendLead[]>([]);
  const [meta, setMeta] = useState<{ total: number; page: number; limit: number; hasMore: boolean }>({ total: 0, page: 1, limit: 50, hasMore: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>("chats");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  // Total conversation counts per tab, always visible in the tab labels.
  const [tabTotals, setTabTotals] = useState<Record<FilterTab, number>>({ chats: 0, completed: 0 });
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const { companyId } = useAuth();

  const fetchTabTotals = useCallback(async () => {
    try {
      const searchParam = search ? `&search=${encodeURIComponent(search)}` : "";
      const [chatsRes, completedRes] = await Promise.all([
        authedFetch(`/api/leads?filter=mine&countOnly=true${searchParam}`),
        authedFetch(`/api/leads?filter=resolved&countOnly=true${searchParam}`),
      ]);
      if (chatsRes.ok && completedRes.ok) {
        const [chatsJson, completedJson] = await Promise.all([chatsRes.json(), completedRes.json()]);
        setTabTotals({
          chats: chatsJson.meta?.total ?? 0,
          completed: completedJson.meta?.total ?? 0,
        });
      }
    } catch (e) {
      // Ignore count fetch errors defensively
    }
  }, [search]);

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

      // Strict separation: trust backend filter as single source of truth.
      // Backend 'resolved' filter uses a raw SQL subquery to match only leads
      // whose MOST-RECENT conversation is RESOLVED. The client-side guard is
      // kept only for defensive consistency, referencing RESOLVED only.
      const statusFiltered = json.data.filter((lead) => {
        if (filter === "chats") {
          return lead.status !== "RESOLVED";
        }
        if (filter === "completed") {
          return lead.status === "RESOLVED";
        }
        return true;
      });

      if (append) {
        setLeads((prev) => {
          const next = [...prev, ...statusFiltered];
          const unreadIds = next
            .filter((l) => l.status !== "RESOLVED" && (l.unreadCount ?? 0) > 0)
            .map((l) => l.id);
          window.dispatchEvent(
            new CustomEvent("inbox:unread_leads", {
              detail: { unreadLeadIds: unreadIds },
            })
          );
          return next;
        });
      } else {
        setLeads(statusFiltered);
        const unreadIds = statusFiltered
          .filter((l) => l.status !== "RESOLVED" && (l.unreadCount ?? 0) > 0)
          .map((l) => l.id);
        window.dispatchEvent(
          new CustomEvent("inbox:unread_leads", {
            detail: { unreadLeadIds: unreadIds },
          })
        );
      }
      setMeta(json.meta);
      setTabTotals((prev) => ({ ...prev, [filter]: json.meta?.total ?? 0 }));
      fetchTabTotals();
    } catch (e: any) {
      setError(e.message || "Failed to load inbox");
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, [filter, search, fetchTabTotals]);

  // Initial fetch when filter/search changes + initial fetch for both tab totals.
  useEffect(() => {
    setSelectedLeadIds([]);
    fetchLeads(1);
    fetchTabTotals();
  }, [fetchLeads, fetchTabTotals]);

  // Listen for real-time conversation resolution to remove from list immediately
  useEffect(() => {
    const handleResolved = (data: { conversationId: string; companyId: string }) => {
      if (data.companyId === companyId) {
        setLeads((prev) => prev.filter((lead) => lead.conversationId !== data.conversationId));
        fetchLeads(1);
      }
    };

    return onEvent("conversation.resolved", handleResolved);
  }, [companyId, fetchLeads]);

  // Refresh the list when a conversation is updated (e.g. marked read or new message),
  // so per-chat unread counts + dot update in real time without a page reload.
  useEffect(() => {
    const handleUpdated = () => {
      fetchLeads(meta.page || 1);
    };

    return onEvent("conversation_updated", handleUpdated);
  }, [fetchLeads, meta.page]);

  // Instant local clear when a conversation is opened: the detail view tells us
  // which lead was just marked read, so we zero its unreadCount immediately
  // (the socket re-fetch then keeps it authoritative).
  useEffect(() => {
    const handleRead = (e: Event) => {
      const leadId = (e as CustomEvent<{ leadId: string }>).detail?.leadId;
      if (!leadId) return;
      setLeads((prev) => {
        const next = prev.map((lead) =>
          lead.id === leadId ? { ...lead, unreadCount: 0, isUnread: false } : lead
        );
        const unreadIds = next
          .filter((l) => l.status !== "RESOLVED" && (l.unreadCount ?? 0) > 0)
          .map((l) => l.id);
        window.dispatchEvent(
          new CustomEvent("inbox:unread_leads", {
            detail: { unreadLeadIds: unreadIds },
          })
        );
        return next;
      });
    };

    window.addEventListener("conversation:read", handleRead);
    return () => window.removeEventListener("conversation:read", handleRead);
  }, []);

  const handleLoadMore = () => {
    if (!meta.hasMore || loading) return;
    fetchLeads(meta.page + 1, true);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  // Handle claim for unclaimed chat
  const handleClaim = useCallback(async (e: React.MouseEvent, leadId: string) => {
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
  }, [fetchLeads]);

  // Handle bulk deletion
  const handleBulkDelete = useCallback(async () => {
    if (selectedLeadIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedLeadIds.length} selected conversation(s)?`)) return;
    try {
      setBulkDeleting(true);
      const res = await authedFetch("/api/leads/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedLeadIds }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to delete selected conversations");
      }
      toast.success(`Successfully deleted ${selectedLeadIds.length} conversation(s)`);
      setSelectedLeadIds([]);
      fetchLeads(1);
    } catch (e: any) {
      toast.error(e.message || "Failed to delete conversations");
    } finally {
      setBulkDeleting(false);
    }
  }, [selectedLeadIds, fetchLeads]);

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
        <p className="text-sm text-rose-500 dark:text-rose-400 font-mono">Failed to load inbox: {error}</p>
        <button
          onClick={() => fetchLeads(1)}
          className="mt-4 px-4 py-2 bg-[var(--app-surface-alt)] border border-[var(--app-border)] hover:bg-[var(--app-bg-soft)] text-xs font-black rounded-xl text-[var(--app-text)] transition cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

   return (
    <div className="flex flex-col h-full min-h-0 relative">
      {/* Search input */}
      <div className="px-4 pt-4">
        <form onSubmit={handleSearchSubmit} className="flex gap-2" data-tour="search-input">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search leads..."
            className="flex-1 input-field text-xs"
          />
          <button type="submit" className="px-3 py-1.5 bg-[var(--app-surface-alt)] border border-[var(--app-border)] rounded text-xs font-black text-[var(--app-text)] hover:bg-[var(--app-bg-soft)] transition cursor-pointer">
            Search
          </button>
          {search && (
            <button
              type="button"
              onClick={() => { setSearch(""); setSearchInput(""); }}
              className="px-2 py-1.5 text-xs font-black text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition cursor-pointer"
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {/* Filter tabs */}
      <div className="border-b border-[var(--app-border)] px-4 pb-2 mt-3">
        <div className="flex gap-1" data-tour="filter-tabs">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setLeads([]); setFilter(tab.key); setSelectedLeadIds([]); }}
              className={`px-3 py-1 text-xs font-black rounded-t transition cursor-pointer ${
                filter === tab.key
                  ? "bg-[var(--app-surface-alt)] text-[var(--app-text)] border-b-2 border-brand-saffron"
                  : "text-[var(--app-text-muted)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-soft)]"
              }`}
            >
              {tab.label} ({tabTotals[tab.key]})
            </button>
          ))}
        </div>
      </div>

      {/* Select All Bar */}
      {leads.length > 0 && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--app-border)] bg-[var(--app-bg-soft)] text-xs">
          <button
            type="button"
            onClick={() => {
              if (selectedLeadIds.length === leads.length) {
                setSelectedLeadIds([]);
              } else {
                setSelectedLeadIds(leads.map((l) => l.id));
              }
            }}
            className="flex items-center gap-2 text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition cursor-pointer font-bold"
          >
            {selectedLeadIds.length > 0 && selectedLeadIds.length === leads.length ? (
              <CheckSquare className="h-4 w-4 text-brand-saffron" />
            ) : (
              <Square className="h-4 w-4 text-[var(--app-text-muted)]" />
            )}
            Select All ({leads.length})
          </button>
          {selectedLeadIds.length > 0 && (
            <span className="text-[10px] font-black text-brand-saffron uppercase tracking-widest">
              {selectedLeadIds.length} selected
            </span>
          )}
        </div>
      )}

      {leads.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <div className="h-12 w-12 rounded-full bg-[var(--app-surface-alt)] flex items-center justify-center mb-4">
            <MessageSquare className="h-6 w-6 text-[var(--app-text-muted)]" />
          </div>
          <h3 className="text-sm font-black text-[var(--app-text)] uppercase tracking-widest">No conversations found</h3>
          <p className="text-xs text-[var(--app-text-muted)] mt-2 max-w-xs">
            No conversations match the current filter.
          </p>
        </div>
      ) : (
        <>
          <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 mt-2">
            <div className="space-y-2" data-tour="conversation-row">
            {leads.map((lead) => {
               const ChannelIcon = CHANNEL_ICON[lead.channel.toUpperCase()] || Globe;
              const displayName = lead.name || lead.contact || "Customer";
              const preview = lead.lastMessage ? (lead.lastMessage.length > 80 ? lead.lastMessage.slice(0, 80) + "..." : lead.lastMessage) : "No messages yet";
              // A lead that is currently open in the detail pane should never show
              // as unread — the user is viewing it live, so suppress the badge + highlight.
              const isOpenHere = selectedLeadId === lead.id;
              const shownUnread = isOpenHere ? 0 : lead.unreadCount;
              const isChecked = selectedLeadIds.includes(lead.id);

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
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border bg-[var(--ticket-bg)] text-[var(--ticket-text)] border-[var(--ticket-border)] hover:brightness-110 transition-all text-left cursor-pointer group ${
                    selectedLeadId === lead.id ? "ring-2 ring-[var(--brand-saffron)]" : ""
                  } ${(lead.isUnread && !isOpenHere) ? "bg-[var(--brand-saffron-soft)]/40 border-[var(--brand-saffron)]/40" : ""}`}
                >
                  {/* Row Checkbox */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedLeadIds((prev) =>
                        prev.includes(lead.id) ? prev.filter((id) => id !== lead.id) : [...prev, lead.id]
                      );
                    }}
                    className="p-1 text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition cursor-pointer shrink-0"
                    title={isChecked ? "Deselect" : "Select"}
                  >
                    {isChecked ? (
                      <CheckSquare className="h-4 w-4 text-brand-saffron" />
                    ) : (
                      <Square className="h-4 w-4 text-[var(--app-text-muted)] opacity-50 group-hover:opacity-100" />
                    )}
                  </div>

                  {/* Avatar */}
                  <div className="h-10 w-10 rounded-full bg-brand-navy text-white flex items-center justify-center shrink-0 text-xs font-black">
                    {displayName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                  </div>

                   {/* Content */}
                   <div className="flex-1 min-w-0">
                     <div className="flex items-center justify-between gap-2">
                       <div className="flex items-center gap-2">
                           <h4 className={`text-sm truncate ${(lead.isUnread && !isOpenHere) ? "font-extrabold" : "font-bold"} text-[var(--ticket-text)]`}>{displayName}</h4>
                          {/* Unread message count badge (WhatsApp-style) — shows how many new messages arrived since last viewed */}
                          {shownUnread > 0 && (
                            <span
                              className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--brand-saffron)] text-[var(--brand-saffron-contrast)] text-[10px] font-black leading-none shrink-0"
                              title={`${shownUnread} unread message${shownUnread === 1 ? "" : "s"}`}
                            >
                              {shownUnread > 99 ? "99+" : shownUnread}
                            </span>
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

                      {/* Claim button for unassigned active chats */}
                      {!lead.assignedTo && lead.status !== "RESOLVED" && filter !== "completed" && (
                        <button
                          onClick={(e) => handleClaim(e, lead.id)}
                          data-tour="claim-chat"
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
          </div>

          {/* Load more button or end message */}
          {meta.hasMore ? (
            <div className="flex justify-center pt-2">
              <button
                onClick={handleLoadMore}
                disabled={loading}
                className="px-6 py-2 bg-[var(--app-surface-alt)] border border-[var(--app-border)] hover:bg-[var(--app-bg-soft)] text-xs font-black rounded-xl text-[var(--app-text)] transition cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Loading...</span>
                ) : (
                  `Load more (${meta.total - leads.length} remaining)`
                )}
              </button>
            </div>
          ) : leads.length > 0 ? (
            <div className="py-8 text-center">
              <span className="text-[10px] font-bold text-[var(--app-text-muted)] uppercase tracking-widest font-mono">End of conversations</span>
            </div>
          ) : null}
        </>
      )}

      {/* Floating Bulk Action Bar */}
      {selectedLeadIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700">
          <span className="text-xs font-black tracking-wide">{selectedLeadIds.length} selected</span>
          <div className="h-4 w-px bg-slate-700" />
          <button
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {bulkDeleting ? "Deleting..." : "Delete Selected"}
          </button>
          <button
            onClick={() => setSelectedLeadIds([])}
            className="px-2 py-1 text-slate-400 hover:text-white text-xs font-bold transition cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
});

export default InboxList;