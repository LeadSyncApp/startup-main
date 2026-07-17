import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Sparkles, MessageCircle, Instagram, Globe, UserPlus,
  ShoppingBag, Clock, Eye, Zap, HeartHandshake, ChevronRight,
  AlertTriangle, Shield, Bot, ChevronDown, Filter,
} from "lucide-react";
import toast from "react-hot-toast";
import { authedFetch } from "../../api/client";
import { timeAgo } from "../../lib/timeAgo";
import { getSocket } from "../../lib/socketClient";

// ── Types ──
type Tier = "claim_now" | "follow_up" | "browsing";

export interface BackendLead {
  id: string;
  name: string | null;
  contact: string | null;
  channel: string;
  lastActiveAt: string | null;
  conversationId: string | null;
  lastMessage: string;
  intent: string | null;
  status: string;
  assignedTo: { id: string; firstName: string; lastName: string } | null;
  priority: string;
  agentAssigned: string | null;
  pendingOrderAmount: number | null;
  aiScore: number;
  daysSinceActive: number;
  hasAutoReply: boolean;
  botRepliedAt: string | null;
  reasoning: string | null;
  pastOrders: number;
  lifetimeValue: number;
  matchedProduct: { name: string; variant: string; stock: number; thumbnailUrl: string } | null;
  dropOffMinutes: number | null;
}

// ── Tier classification (computed at ingestion, stored value) ──
function getBaseTier(lead: BackendLead): Tier {
  if (lead.intent === "ORDERING" || (lead.pendingOrderAmount !== null && lead.pendingOrderAmount > 0)) {
    return "claim_now";
  }
  if (lead.aiScore >= 60) {
    return "follow_up";
  }
  return "browsing";
}

// ── Auto-escalation: promotes leads based on wait time thresholds ──
function getEffectiveTier(lead: BackendLead): Tier {
  const base = getBaseTier(lead);
  const waited = lead.lastActiveAt ? Date.now() - new Date(lead.lastActiveAt).getTime() : 0;
  const hours = waited / 3_600_000;

  // Browsing → Follow Up after 2h untouched
  if (base === "browsing" && hours >= 2) return "follow_up";
  // Follow Up → Claim Now after 6h untouched (also catches Browsing → Claim Now if 6h+)
  if ((base === "browsing" || base === "follow_up") && hours >= 6) return "claim_now";

  return base;
}

// ── AI reasoning computed from lead data ──
interface AiReason { label: string; icon: string; }

function getAiReasons(lead: BackendLead): AiReason[] {
  const reasons: AiReason[] = [];
  const tier = getEffectiveTier(lead);

  if (tier === "claim_now") {
    if (lead.pendingOrderAmount && lead.pendingOrderAmount > 0) {
      reasons.push({ label: `Pending ₹${lead.pendingOrderAmount}`, icon: "💰" });
    }
    if (lead.intent === "ORDERING") {
      reasons.push({ label: "High purchase intent", icon: "🎯" });
    }
    if (lead.lastActiveAt) {
      const waited = Date.now() - new Date(lead.lastActiveAt).getTime();
      if (waited < 15 * 60 * 1000) {
        reasons.push({ label: "Just arrived", icon: "⚡" });
      }
    }
  } else if (tier === "follow_up") {
    if (lead.lastActiveAt) {
      const waited = Date.now() - new Date(lead.lastActiveAt).getTime();
      const mins = Math.floor(waited / 60000);
      if (mins >= 60) {
        reasons.push({ label: `Waiting ${Math.floor(mins / 60)}h`, icon: "⏳" });
      } else {
        reasons.push({ label: `Waiting ${mins}m`, icon: "⏳" });
      }
    }
    if (lead.intent === "SUPPORT") {
      reasons.push({ label: "Asked for help", icon: "❓" });
    }
    if (!lead.pendingOrderAmount && lead.intent !== "ORDERING") {
      reasons.push({ label: "Showed interest", icon: "👀" });
    }
  } else {
    if (lead.daysSinceActive >= 1) {
      reasons.push({ label: "Cold lead", icon: "❄️" });
    } else {
      reasons.push({ label: "Low intent", icon: "🔍" });
    }
    reasons.push({ label: "Browsing only", icon: "🛍️" });
  }

  if (lead.aiScore > 80 && !lead.pendingOrderAmount) {
    reasons.push({ label: "Returning customer", icon: "🔄" });
  }

  return reasons.slice(0, 2);
}

// ── Tier config ──
const TIER_CONFIG: Record<Tier, {
  label: string; icon: React.ComponentType<{ className?: string }>;
  color: string; badgeBg: string; badgeText: string; sectionBg: string;
  borderGlow: string; cardBorder: string;
}> = {
  claim_now: {
    label: "Claim Now", icon: Zap, color: "#ff6b35",
    badgeBg: "bg-orange-500", badgeText: "text-orange-400",
    sectionBg: "bg-orange-500/[0.04]", borderGlow: "shadow-[0_0_60px_rgba(255,107,53,0.10)]",
    cardBorder: "border-l-orange-500",
  },
  follow_up: {
    label: "Follow Up", icon: Clock, color: "#d4a017",
    badgeBg: "bg-amber-600", badgeText: "text-amber-400",
    sectionBg: "bg-amber-500/[0.04]", borderGlow: "shadow-[0_0_60px_rgba(212,160,23,0.08)]",
    cardBorder: "border-l-amber-500",
  },
  browsing: {
    label: "Browsing", icon: Eye, color: "#2dd4bf",
    badgeBg: "bg-teal-600", badgeText: "text-teal-400",
    sectionBg: "bg-teal-500/[0.03]", borderGlow: "shadow-[0_0_60px_rgba(45,212,191,0.06)]",
    cardBorder: "border-l-teal-500",
  },
};

// ── Helpers ──
function waitTime(lead: BackendLead): string {
  if (!lead.lastActiveAt) return "";
  const diff = Date.now() - new Date(lead.lastActiveAt).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function getWaitMinutes(lastActiveAt: string | null): number {
  if (!lastActiveAt) return 0;
  return Math.floor((Date.now() - new Date(lastActiveAt).getTime()) / 60000);
}

const CHANNEL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  WHATSAPP: MessageCircle, INSTAGRAM: Instagram, TELEGRAM: MessageCircle, WEBSITE: Globe,
};

const TIERS: Tier[] = ["claim_now", "follow_up", "browsing"];
const MAX_COLLAPSED = 3;
const VIRTUAL_ROW_HEIGHT = 82;

const glassStyles = "backdrop-filter backdrop-blur-[20px] bg-[rgba(22,29,45,0.75)]";

// ── Conversation card (shared between collapsed and virtual views) ──
function ConversationCard({
  lead, tier, isSelected, onSelect, onClaim,
}: {
  lead: BackendLead; tier: Tier; isSelected: boolean;
  onSelect: (id: string) => void; onClaim: (id: string) => void;
}) {
  const cfg = TIER_CONFIG[tier];
  const isUrgent = tier === "claim_now";

  return (
    <button
      onClick={() => onSelect(lead.id)}
      className={`w-full text-left transition-all cursor-pointer group border-l-2 ${
        isSelected ? `bg-slate-800/40 ${cfg.cardBorder}` : `hover:bg-slate-800/20 ${cfg.cardBorder}`
      }`}
    >
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[8px] font-black font-mono shrink-0 border ${
            isUrgent
              ? "bg-orange-500/20 text-orange-400 border-orange-500/30"
              : tier === "follow_up"
              ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
              : "bg-teal-500/20 text-teal-400 border-teal-500/30"
          }`}>
            {(lead.name || lead.contact || "??").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-[11px] font-bold text-slate-200 truncate">{lead.name || lead.contact || "Customer"}</p>
              {isUrgent && <span className="h-1.5 w-1.5 rounded-full bg-orange-400 shrink-0" />}
            </div>
            <p className="text-[9px] text-slate-500 font-mono flex items-center gap-1">
              <ChannelIcon channel={lead.channel} />
              <span>{lead.channel}</span>
              <span className="text-slate-600">·</span>
              <span>{waitTime(lead)}</span>
            </p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onClaim(lead.id); }}
            disabled={!lead.conversationId}
            className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider font-mono transition-all active:scale-95 ${
              isUrgent
                ? "bg-orange-500 hover:bg-orange-400 text-white shadow-lg shadow-orange-500/20"
                : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60"
            }`}
          >
            <UserPlus className="h-2.5 w-2.5" />
            Claim
          </button>
        </div>
        <p className="text-[10px] text-slate-400 mt-1 truncate leading-relaxed pl-8">
          &ldquo;{lead.lastMessage || "No messages"}&rdquo;
        </p>
        <AiReasonTags lead={lead} />
      </div>
    </button>
  );
}

function ChannelIcon({ channel }: { channel: string }) {
  const Icon = CHANNEL_ICONS[channel.toUpperCase()] || Globe;
  return <Icon className="h-3 w-3" />;
}

function AiReasonTags({ lead }: { lead: BackendLead }) {
  const reasons = getAiReasons(lead);
  if (reasons.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
      {reasons.map((r, i) => (
        <span key={i} className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800/60 text-slate-400 border border-slate-700/50">
          <span>{r.icon}</span>
          <span>{r.label}</span>
        </span>
      ))}
    </div>
  );
}

// ── Tier section ──
function TierSection({
  tier, leads, expanded, onToggle, selectedLeadId, onSelectLead, onClaim, emptyLabel,
}: {
  tier: Tier; leads: BackendLead[]; expanded: boolean;
  onToggle: () => void; selectedLeadId: string | null;
  onSelectLead: (id: string) => void; onClaim: (id: string) => void;
  emptyLabel?: string;
}) {
  const cfg = TIER_CONFIG[tier];
  const Icon = cfg.icon;
  const isUrgent = tier === "claim_now";
  const scrollRef = useRef<HTMLDivElement>(null);
  const total = leads.length;
  const visible = expanded ? leads : leads.slice(0, MAX_COLLAPSED);

  const virtualizer = useVirtualizer({
    count: expanded ? leads.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => VIRTUAL_ROW_HEIGHT,
    overscan: 5,
  });

  return (
    <div className={`rounded-xl border border-slate-800/60 overflow-hidden ${cfg.borderGlow} transition-all duration-200`}>
      {/* Header — always visible */}
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-3 py-2 border-b border-slate-800/60 ${cfg.sectionBg} cursor-pointer hover:brightness-110 transition-all`}
      >
        <div className="flex items-center gap-2">
          <div className={`relative ${isUrgent ? "animate-pulse" : ""}`}>
            <Icon className={`h-3.5 w-3.5 ${isUrgent ? "text-orange-400" : tier === "follow_up" ? "text-amber-400" : "text-teal-400"}`} />
            {isUrgent && <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-orange-400 animate-ping" />}
          </div>
          <h3 className={`text-[10px] font-black uppercase tracking-widest font-mono ${
            isUrgent ? "text-orange-300" : tier === "follow_up" ? "text-amber-300" : "text-teal-300"
          }`}>
            {cfg.label}
          </h3>
          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
            isUrgent ? "bg-orange-500/20 text-orange-300" : tier === "follow_up" ? "bg-amber-500/20 text-amber-300" : "bg-teal-500/20 text-teal-300"
          }`}>
            {total}
          </span>
        </div>
        <span className="text-[8px] font-mono text-slate-500 flex items-center gap-1">
          {expanded ? "Hide" : `${Math.min(MAX_COLLAPSED, total)}/${total}`}
          <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
        </span>
      </button>

      {/* Collapsed: show top N cards */}
      {!expanded && (
        <div className="divide-y divide-slate-800/40">
          {visible.length === 0 ? (
            <div className="px-3 py-4 text-center">
              <p className="text-[10px] text-slate-600 font-mono">{emptyLabel || "No conversations"}</p>
            </div>
          ) : (
            visible.map(lead => (
              <ConversationCard
                key={lead.id}
                lead={lead} tier={tier}
                isSelected={selectedLeadId === lead.id}
                onSelect={onSelectLead}
                onClaim={onClaim}
              />
            ))
          )}
          {/* "View all" action when collapsed and there are more */}
          {total > MAX_COLLAPSED && (
            <button
              onClick={onToggle}
              className="w-full px-3 py-2 text-[9px] font-mono font-bold text-slate-500 hover:text-slate-300 hover:bg-slate-800/20 transition-colors flex items-center justify-center gap-1"
            >
              View all {total} <ChevronRight className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {/* Expanded: virtual list */}
      {expanded && (
        <div className="relative">
          {leads.length === 0 ? (
            <div className="px-3 py-4 text-center">
              <p className="text-[10px] text-slate-600 font-mono">{emptyLabel || "No conversations"}</p>
            </div>
          ) : (
            <div ref={scrollRef} className="overflow-auto max-h-[400px] divide-y divide-slate-800/40">
              <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
                {virtualizer.getVirtualItems().map(virtualItem => {
                  const lead = leads[virtualItem.index];
                  if (!lead) return null;
                  return (
                    <div
                      key={lead.id}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: `${virtualItem.size}px`,
                        transform: `translateY(${virtualItem.start}px)`,
                      }}
                    >
                      <ConversationCard
                        lead={lead} tier={tier}
                        isSelected={selectedLeadId === lead.id}
                        onSelect={onSelectLead}
                        onClaim={onClaim}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ──
export function StreamTriage() {
  const [leads, setLeads] = useState<BackendLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<Tier>>(new Set());
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(new Set());

  const availablePlatforms = useMemo(() => {
    const platforms = new Set(leads.map(l => l.channel.toUpperCase()));
    return Array.from(platforms).sort();
  }, [leads]);

  const filteredLeads = useMemo(() => {
    if (selectedPlatforms.size === 0) return leads;
    return leads.filter(l => selectedPlatforms.has(l.channel.toUpperCase()));
  }, [leads, selectedPlatforms]);

  // ── Initial fetch ──
  const initialFetch = useCallback(async () => {
    try {
      setLoading(true);
      const res = await authedFetch("/api/leads?filter=unclaimed");
      if (!res.ok) throw new Error("Failed to fetch leads");
      const json = await res.json();
      const data: BackendLead[] = json.data;
      setLeads(data);
      setCurrentIndex(0);
    } catch {
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Poll: merge silently ──
  const pollLeads = useCallback(async () => {
    try {
      const res = await authedFetch("/api/leads?filter=unclaimed");
      if (!res.ok) return;
      const json = await res.json();
      const incoming: BackendLead[] = json.data;
      setLeads(prev => {
        const incomingMap = new Map(incoming.map(l => [l.id, l]));
        if (incoming.length === 0 && prev.length === 0) return prev;
        let changed = false;
        const merged = prev.map(existing => {
          const updated = incomingMap.get(existing.id);
          if (updated) { incomingMap.delete(existing.id); if (!shallowEqual(existing, updated)) changed = true; return updated; }
          return existing;
        });
        if (incomingMap.size > 0) { changed = true; for (const l of incomingMap.values()) merged.push(l); }
        return changed ? merged : prev;
      });
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    initialFetch();
    const interval = setInterval(pollLeads, 10000);
    return () => clearInterval(interval);
  }, [initialFetch, pollLeads]);

  // ── Socket subscription for real-time conversation events ──
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNewConversation = (data: BackendLead) => {
      // Patch: insert the single new lead without any full re-fetch
      setLeads(prev => {
        if (prev.some(l => l.id === data.id)) return prev; // already exists
        return [...prev, data];
      });
    };

    const handleUpdatedConversation = (data: BackendLead) => {
      // Patch: update the specific lead by id
      setLeads(prev => {
        let changed = false;
        const updated = prev.map(l => {
          if (l.id === data.id) { changed = true; return { ...l, ...data }; }
          return l;
        });
        return changed ? updated : prev;
      });
    };

    socket.on("conversation.new", handleNewConversation);
    socket.on("conversation.updated", handleUpdatedConversation);

    return () => {
      socket.off("conversation.new", handleNewConversation);
      socket.off("conversation.updated", handleUpdatedConversation);
    };
  }, []);

  function shallowEqual(a: Record<string, any>, b: Record<string, any>): boolean {
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (const k of ka) if (a[k] !== b[k]) return false;
    return true;
  }

  // ── Partition leads into tiers (uses auto-escalation) ──
  const partitioned = useMemo(() => {
    const groups: Record<Tier, BackendLead[]> = { claim_now: [], follow_up: [], browsing: [] };
    filteredLeads.forEach(lead => {
      const tier = getEffectiveTier(lead);
      groups[tier].push(lead);
    });
    const sortByLatest = (a: BackendLead, b: BackendLead) =>
      new Date(b.lastActiveAt || 0).getTime() - new Date(a.lastActiveAt || 0).getTime();
    for (const t of TIERS) groups[t].sort(sortByLatest);
    return groups;
  }, [filteredLeads]);

  const activeLead = useMemo(() => {
    if (selectedLeadId) return leads.find(l => l.id === selectedLeadId) || null;
    if (currentIndex < leads.length) return leads[currentIndex];
    return null;
  }, [currentIndex, leads, selectedLeadId]);

  const toggleSection = (tier: Tier) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(tier)) next.delete(tier); else next.add(tier);
      return next;
    });
  };

  // ── Handle claim ──
  const handleClaim = async (leadId?: string) => {
    const lead = leadId ? leads.find(l => l.id === leadId) : activeLead;
    if (!lead?.conversationId) return;
    try {
      const endpoint = lead.pendingOrderAmount !== null && lead.pendingOrderAmount > 0
        ? `/api/leads/${lead.id}/claim-pending-order`
        : `/api/leads/${lead.id}/assign`;
      const res = await authedFetch(endpoint, { method: "POST" });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.message || "Failed to claim"); }
      toast.success(`Claimed ${lead.name || lead.contact}`);
      setCurrentIndex(prev => prev + 1);
      setSelectedLeadId(null);
      setLeads(prev => prev.filter(l => l.id !== lead.id));
      pollLeads();
    } catch (e: any) { toast.error(e.message || "Failed to claim ticket"); }
  };

  const handleSkip = async () => {
    const lead = activeLead;
    if (lead?.conversationId) {
      try {
        const res = await authedFetch(`/api/leads/${lead.id}/skip`, { method: "POST" });
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.message || "Failed to skip"); }
        toast.success(`Skipped ${lead.name || lead.contact}`);
      } catch (e: any) { toast.error(e.message || "Failed to skip"); }
    }
    setCurrentIndex(prev => prev + 1);
    setSelectedLeadId(null);
  };
  const handleRowClick = (leadId: string) => setSelectedLeadId(leadId);

  // ── Loading state ──
  if (loading) {
    return <div className="p-12 text-center text-slate-400 animate-pulse text-xs font-mono">Loading intelligence streams...</div>;
  }

  // ── Empty state ──
  if (leads.length === 0) {
    return (
      <div className="p-4 bg-slate-950 rounded-3xl border border-slate-900 shadow-2xl text-slate-200">
        <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-slate-900 rounded-2xl bg-slate-950/40 min-h-[440px]">
          <div className="h-12 w-12 bg-[var(--brand-saffron-soft)] rounded-full flex items-center justify-center text-[var(--brand-saffron)] border border-[var(--brand-saffron)]/25 mb-4">
            <ShoppingBag className="h-6 w-6 text-[var(--brand-saffron)] animate-bounce" />
          </div>
          <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest font-mono">No new conversations!</h3>
          <p className="text-[11px] text-slate-500 max-w-xs mt-2 leading-relaxed">
            Excellent work! The shared inbox zero-queue rule is maintained. We will alert you when a new ticket drops.
          </p>
          <button onClick={initialFetch} className="mt-6 px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs font-black rounded-xl text-slate-300 transition cursor-pointer">
            Retrieve Fresh Streams
          </button>
        </div>
      </div>
    );
  }

  // ── Main render ──
  return (
    <div className="p-4 bg-slate-950 rounded-3xl border border-slate-900 shadow-2xl text-slate-200">
      {/* Top bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-900 pb-5 mb-5 gap-3">
        <div>
          <h2 className="text-xs font-black text-slate-300 uppercase tracking-widest font-mono flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500 animate-spin" style={{ animationDuration: "3s" }} />
            Intelligence Stream
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Review and claim unassigned inbound conversations in real-time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={initialFetch} className="text-[10px] font-mono font-black border border-slate-800 bg-slate-900/40 hover:bg-slate-900 px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 transition cursor-pointer">
            Refresh Queue
          </button>
        </div>
      </div>

      {/* Platform filter chips */}
      <div className="flex items-center gap-1.5 pb-4 flex-wrap border-b border-slate-900 mb-5 -mt-2">
        <Filter className="h-3 w-3 text-slate-500 shrink-0" />
        <button
          onClick={() => setSelectedPlatforms(new Set())}
          className={`text-[9px] font-mono px-2 py-0.5 rounded-full border transition-all cursor-pointer ${
            selectedPlatforms.size === 0
              ? "bg-[var(--brand-saffron-soft)] text-[var(--brand-saffron)] border-[var(--brand-saffron)]/30"
              : "bg-slate-800/40 text-slate-500 border-slate-700/50 hover:text-slate-300"
          }`}
        >
          All Platforms
        </button>
        {availablePlatforms.map(p => {
          const Icon = CHANNEL_ICONS[p];
          const isActive = selectedPlatforms.has(p);
          return (
            <button
              key={p}
              onClick={() => {
                const next = new Set(selectedPlatforms);
                if (isActive) next.delete(p); else next.add(p);
                setSelectedPlatforms(next);
              }}
              className={`inline-flex items-center gap-1 text-[9px] font-mono px-2 py-0.5 rounded-full border transition-all cursor-pointer ${
                isActive
                  ? "bg-[var(--brand-saffron-soft)] text-[var(--brand-saffron)] border-[var(--brand-saffron)]/30"
                  : "bg-slate-800/40 text-slate-500 border-slate-700/50 hover:text-slate-300"
              }`}
            >
              {Icon && <Icon className="h-2.5 w-2.5" />}
              {p.charAt(0) + p.slice(1).toLowerCase()}
            </button>
          );
        })}
        {selectedPlatforms.size > 0 && (
          <span className="text-[8px] font-mono text-slate-600 ml-auto">
            {filteredLeads.length} of {leads.length} conversations
          </span>
        )}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-6">
        {/* LEFT: Detail card */}
        <div className="flex flex-col justify-between">
          <AnimatePresence mode="wait">
            {!activeLead ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-slate-900 rounded-2xl bg-slate-950/40 min-h-[560px]"
              >
                <div className="h-12 w-12 bg-[var(--brand-saffron-soft)] rounded-full flex items-center justify-center text-[var(--brand-saffron)] border border-[var(--brand-saffron)]/25 mb-4">
                  <ShoppingBag className="h-6 w-6 text-[var(--brand-saffron)] animate-bounce" />
                </div>
                <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest font-mono">Select a conversation</h3>
                <p className="text-[11px] text-slate-500 max-w-xs mt-2 leading-relaxed">
                  Click on any conversation in the queue to review details and claim it.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key={activeLead.id}
                initial={{ opacity: 0, scale: 0.96, x: 20 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95, x: -30 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className={`bg-slate-950 border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden flex flex-col justify-between min-h-[560px] relative ${glassStyles} ${TIER_CONFIG[getEffectiveTier(activeLead)].borderGlow}`}
              >
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                  getEffectiveTier(activeLead) === "claim_now" ? "bg-orange-500" :
                  getEffectiveTier(activeLead) === "follow_up" ? "bg-amber-500" : "bg-teal-500"
                }`} />

                {activeLead.status !== "OPEN" && (
                  <div className="absolute inset-0 bg-slate-950/80 z-20 flex flex-col items-center justify-center border-2 border-amber-500/50 rounded-2xl backdrop-blur-sm">
                    <AlertTriangle className="h-10 w-10 text-amber-500 mb-3 animate-pulse" />
                    <h4 className="text-sm font-black text-amber-400 font-mono tracking-widest uppercase mb-1">Queue Handled</h4>
                    <p className="text-[10px] text-slate-300 uppercase font-black">Already Assigned</p>
                    <button onClick={() => setCurrentIndex(prev => prev + 1)} className="mt-6 px-4 py-2 bg-slate-800 text-white text-[10px] font-black uppercase rounded-lg shadow cursor-pointer">Next Ticket</button>
                  </div>
                )}

                <div className="p-4 border-b border-slate-900 bg-slate-900/20 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-black font-mono border ${
                      getEffectiveTier(activeLead) === "claim_now"
                        ? "bg-orange-500/20 text-orange-400 border-orange-500/30"
                        : getEffectiveTier(activeLead) === "follow_up"
                        ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                        : "bg-teal-500/20 text-teal-400 border-teal-500/30"
                    }`}>
                      {(activeLead.name || activeLead.contact || "??").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-200">{activeLead.name || activeLead.contact || "Customer"}</h4>
                      <p className="text-[9px] text-slate-500 font-mono tracking-widest uppercase flex items-center gap-1">
                        <ChannelIcon channel={activeLead.channel} />
                        {activeLead.channel}
                        <span className="text-slate-600 mx-0.5">·</span>
                        {activeLead.lastActiveAt ? timeAgo(activeLead.lastActiveAt) : "No activity"}
                      </p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider font-mono text-white ${TIER_CONFIG[getEffectiveTier(activeLead)].badgeBg}`}>
                    {(() => { const I = TIER_CONFIG[getEffectiveTier(activeLead)].icon; return <I className="h-2.5 w-2.5" />; })()}
                    {TIER_CONFIG[getEffectiveTier(activeLead)].label}
                  </span>
                </div>

                <div className="p-4 space-y-3 flex-1 overflow-y-auto">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest font-mono">Last Customer Message</span>
                      {activeLead.hasAutoReply && activeLead.botRepliedAt && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-mono text-teal-400/70">
                          <Bot className="h-2.5 w-2.5" />
                          Bot replied {timeAgo(activeLead.botRepliedAt)}
                        </span>
                      )}
                    </div>
                    <blockquote className="p-3 bg-slate-900/60 rounded-xl border border-slate-800/60 font-mono text-xs text-slate-300 italic mt-1 leading-relaxed relative text-left">
                      &ldquo;{activeLead.lastMessage || "No messages yet"}&rdquo;
                    </blockquote>
                  </div>

                  <div className="p-3 rounded-xl bg-[var(--brand-saffron-soft)]/40 border border-[var(--brand-saffron)]/20">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Shield className="h-3 w-3 text-[var(--brand-saffron)]" />
                      <span className="text-[9px] font-black text-[var(--brand-saffron)] uppercase tracking-widest font-mono">AI Intelligence</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {getAiReasons(activeLead).map((r, i) => (
                        <span key={i} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[var(--brand-saffron-soft)] text-[var(--brand-saffron)] border border-[var(--brand-saffron)]/25 font-mono">
                          {r.icon} {r.label}
                        </span>
                      ))}
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-800/60 text-slate-400 border border-slate-700/50 font-mono">
                        <HeartHandshake className="h-2.5 w-2.5" />
                        {activeLead.aiScore}% confidence
                      </span>
                    </div>
                    {activeLead.reasoning && (
                      <p className="text-[10px] text-[var(--brand-saffron)]/70 leading-relaxed mt-2">
                        {activeLead.reasoning}
                      </p>
                    )}
                  </div>

                  {activeLead.pendingOrderAmount !== null && activeLead.pendingOrderAmount > 0 && (
                    <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-800/60 text-center">
                      <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Pending Order</span>
                      <p className="text-4xl font-black text-[var(--brand-saffron)] font-mono mt-1">₹{activeLead.pendingOrderAmount.toLocaleString("en-IN")}</p>
                    </div>
                  )}

                  <div className="p-3 rounded-xl bg-[var(--brand-saffron-soft)]/40 border border-[var(--brand-saffron)]/20">
                    <div className="flex items-center gap-1.5 mb-2">
                      <UserPlus className="h-3 w-3 text-[var(--brand-saffron)]" />
                      <span className="text-[9px] font-black text-[var(--brand-saffron)] uppercase tracking-widest font-mono">Customer</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-mono border ${
                        activeLead.pastOrders === 0
                          ? "bg-[var(--brand-saffron-soft)] text-[var(--brand-saffron)] border-[var(--brand-saffron)]/25"
                          : "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                      }`}>
                        {activeLead.pastOrders === 0 ? "New" : "Repeat"}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {activeLead.pastOrders === 0
                          ? "First interaction"
                          : `${ordinal(activeLead.pastOrders + 1)} order · ₹${activeLead.lifetimeValue.toLocaleString("en-IN")} lifetime`
                        }
                      </span>
                    </div>
                  </div>

                  {activeLead.matchedProduct && (
                    <div className="p-3 rounded-xl bg-[var(--brand-saffron-soft)]/40 border border-[var(--brand-saffron)]/20">
                      <div className="flex items-center gap-1.5 mb-2">
                        <ShoppingBag className="h-3 w-3 text-[var(--brand-saffron)]" />
                        <span className="text-[9px] font-black text-[var(--brand-saffron)] uppercase tracking-widest font-mono">Product Match</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-slate-800/80 border border-slate-700/50 flex items-center justify-center text-[8px] text-slate-500 overflow-hidden shrink-0">
                          {activeLead.matchedProduct.thumbnailUrl ? (
                            <img src={activeLead.matchedProduct.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <ShoppingBag className="h-4 w-4 text-slate-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-slate-200 truncate">{activeLead.matchedProduct.name}</p>
                          <p className="text-[9px] text-slate-400 font-mono">{activeLead.matchedProduct.variant}</p>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-emerald-400 whitespace-nowrap">
                          {activeLead.matchedProduct.stock} in stock
                        </span>
                      </div>
                    </div>
                  )}

                  {activeLead.dropOffMinutes !== null && (
                    <div className="flex items-center gap-1.5 text-[10px] text-amber-400/80 font-mono">
                      <Clock className="h-3 w-3 shrink-0" />
                      <span>
                        Waiting {getWaitMinutes(activeLead.lastActiveAt)}m — customers like this typically go cold after {activeLead.dropOffMinutes}m.
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-4 border-t border-slate-900 bg-slate-900/40 grid grid-cols-2 gap-3">
                  <button onClick={handleSkip} className="py-3 bg-rose-950/50 hover:bg-rose-950/70 font-black uppercase tracking-widest text-[10px] text-rose-400 border border-rose-900/50 rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5 active:scale-95">
                    <X className="h-4 w-4" /> Skip / Spam
                  </button>
                  <button
                    onClick={() => handleClaim()}
                    disabled={!activeLead.conversationId}
                    className={`py-3 font-black uppercase tracking-widest text-[10px] rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                      getEffectiveTier(activeLead) === "claim_now"
                        ? "bg-orange-500 hover:bg-orange-400 text-white shadow-lg shadow-orange-500/20"
                        : "bg-[var(--brand-saffron)] hover:bg-[var(--brand-saffron-light)] text-white shadow-lg shadow-[var(--brand-saffron)]/30"
                    }`}
                  >
                    <UserPlus className="h-4 w-4 stroke-[3]" /> Claim Conversation
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* RIGHT: Queue panel */}
        <div className={`rounded-2xl ${glassStyles} overflow-hidden`}>
          <div className="p-3 space-y-3 max-h-[620px] overflow-y-auto custom-scrollbar">
            {TIERS.map(tier => (
              <TierSection
                key={tier}
                tier={tier}
                leads={partitioned[tier]}
                expanded={expandedSections.has(tier)}
                onToggle={() => toggleSection(tier)}
                selectedLeadId={selectedLeadId}
                onSelectLead={handleRowClick}
                onClaim={handleClaim}
                emptyLabel={selectedPlatforms.size > 0 ? "No conversations from selected platform(s)" : undefined}
              />
            ))}

            {/* Summary footer */}
            <div className="flex items-center justify-between px-1 pt-1">
              <span className="text-[8px] font-mono text-slate-600">
                {selectedPlatforms.size > 0 ? `${filteredLeads.length} of ` : ""}{leads.length} total · {partitioned.claim_now.length} urgent
              </span>
              <span className="text-[8px] font-mono text-slate-600 flex items-center gap-1">
                <Bot className="h-2.5 w-2.5" />
                AI-sorted
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StreamTriage;
