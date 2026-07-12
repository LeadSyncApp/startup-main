import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, AlertTriangle, 
  ShoppingBag, Sparkles, MessageCircle, Instagram, Globe, UserPlus
} from "lucide-react";
import toast from "react-hot-toast";
import { authedFetch } from "../../api/client";
import { timeAgo } from "../../lib/timeAgo";

// Tier types
type Tier = "claim_now" | "follow_up" | "browsing";

// Backend Lead interface extended with new fields
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
}

// Get tier based on intent/pendingOrderAmount/aiScore
function getTier(lead: BackendLead): Tier {
  if (lead.intent === "ORDERING" || (lead.pendingOrderAmount !== null && lead.pendingOrderAmount > 0)) {
    return "claim_now";
  }
  if (lead.aiScore === 65) {
    return "follow_up";
  }
  return "browsing";
}

// Tier colors
const TIER_COLORS = {
  claim_now: {
    border: "border-l-[#ff6b35]",
    pill: "bg-gradient-to-r from-[#ff6b35] to-[#ff8c42]",
    glow: "shadow-[0_0_80px_rgba(255,107,53,0.25)]",
  },
  follow_up: {
    border: "border-l-[#b8860b]",
    pill: "bg-[#b8860b]",
    glow: "shadow-[0_0_80px_rgba(184,134,11,0.25)]",
  },
  browsing: {
    border: "border-l-[#50c878]",
    pill: "bg-[#50c878]",
    glow: "shadow-[0_0_80px_rgba(80,200,120,0.25)]",
  },
};

export function StreamTriage() {
  const [leads, setLeads] = useState<BackendLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  // Fetch unassigned leads
  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      const res = await authedFetch("/api/leads?filter=unassigned");
      if (!res.ok) throw new Error("Failed to fetch leads");
      const data: BackendLead[] = await res.json();
      setLeads(data);
      setCurrentIndex(0);
    } catch (e: any) {
      toast.error(e.message || "Failed to load leads");
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
    // Poll every 10 seconds for new leads
    const interval = setInterval(fetchLeads, 10000);
    return () => clearInterval(interval);
  }, [fetchLeads]);

  // Partition leads into tiers and sort by daysSinceActive descending
  const { claimNowLeads, followUpLeads, browsingLeads } = useMemo(() => {
    const claimNow: BackendLead[] = [];
    const followUp: BackendLead[] = [];
    const browsing: BackendLead[] = [];

    leads.forEach(lead => {
      const tier = getTier(lead);
      if (tier === "claim_now") claimNow.push(lead);
      else if (tier === "follow_up") followUp.push(lead);
      else browsing.push(lead);
    });

    // Sort each tier by daysSinceActive descending (newest first)
    claimNow.sort((a, b) => b.daysSinceActive - a.daysSinceActive);
    followUp.sort((a, b) => b.daysSinceActive - a.daysSinceActive);
    browsing.sort((a, b) => b.daysSinceActive - a.daysSinceActive);

    return { claimNowLeads: claimNow, followUpLeads: followUp, browsingLeads: browsing };
  }, [leads]);

  // Active lead for left card
  const activeLead = useMemo(() => {
    if (selectedLeadId) {
      return leads.find(l => l.id === selectedLeadId) || null;
    }
    if (currentIndex < leads.length) {
      return leads[currentIndex];
    }
    return null;
  }, [currentIndex, leads, selectedLeadId]);

  // Handle claim
  const handleClaim = async () => {
    if (!activeLead?.conversationId) return;
    try {
      // BUG 1 FIX: Use claim-pending-order for orders, assign endpoint for non-orders
      const endpoint = activeLead.pendingOrderAmount !== null && activeLead.pendingOrderAmount > 0
        ? `/api/leads/${activeLead.id}/claim-pending-order`
        : `/api/leads/${activeLead.id}/assign`;
      
      const res = await authedFetch(endpoint, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to claim");
      }
      toast.success(`Claimed conversation with ${activeLead.name || activeLead.contact}`);
      // Move to next lead after claiming
      setCurrentIndex(prev => prev + 1);
      setSelectedLeadId(null);
      fetchLeads();
    } catch (e: any) {
      toast.error(e.message || "Failed to claim ticket");
    }
  };

  // Handle skip
  const handleSkip = () => {
    setCurrentIndex(prev => prev + 1);
    setSelectedLeadId(null);
  };

  // Handle row click in queue panel
  const handleRowClick = (leadId: string) => {
    const lead = leads.find(l => l.id === leadId);
    if (lead) {
      setSelectedLeadId(leadId);
    }
  };

  // Render channel icon
  const renderIcon = (channel: string) => {
    switch (channel.toUpperCase()) {
      case "WHATSAPP": return <MessageCircle className="h-4 w-4 shrink-0" />;
      case "INSTAGRAM": return <Instagram className="h-4 w-4 shrink-0" />;
      default: return <Globe className="h-4 w-4 shrink-0" />;
    }
  };

  // Render tier pill badge
  const renderTierPill = (lead: BackendLead) => {
    const tier = getTier(lead);
    const label = tier === "claim_now" ? "Claim Now" : tier === "follow_up" ? "Follow Up" : "Browsing";
    return (
      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider font-mono text-white ${TIER_COLORS[tier].pill}`}>
        {label}
      </span>
    );
  };

  // Glassmorphism styles
  const glassStyles = "backdrop-filter backdrop-blur-[20px] bg-[rgba(22,29,45,0.75)]";

  if (loading) {
    return <div className="p-12 text-center text-slate-400 animate-pulse">Loading intelligence streams...</div>;
  }

  return (
    <div className="p-4 bg-slate-950 rounded-3xl border border-slate-900 shadow-2xl text-slate-200">
      
      {/* Upper bar */}
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

        <button 
          onClick={fetchLeads} 
          className="text-[10px] font-mono font-black border border-slate-800 bg-slate-900/40 hover:bg-slate-900 px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 transition cursor-pointer"
        >
          Refresh Queue
        </button>
      </div>

      {/* Two-column layout: stacks to single column under 768px, right panel below left */}
      <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-6">
        
        {/* LEFT - Swipe Card */}
        <div className="flex flex-col justify-between">
          <AnimatePresence mode="wait">
            {!activeLead ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-slate-900 rounded-2xl bg-slate-950/40 min-h-[440px]"
              >
                <div className="h-12 w-12 bg-indigo-900/20 rounded-full flex items-center justify-center text-teal-400 border border-teal-500/25 mb-4">
                  <ShoppingBag className="h-6 w-6 text-teal-400 animate-bounce" />
                </div>
                <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest font-mono">No new conversations!</h3>
                <p className="text-[11px] text-slate-500 max-w-xs mt-2 leading-relaxed">
                  Excellent work! The shared inbox zero-queue rule is maintained. We will alert you when a new ticket drops.
                </p>
                <button
                  onClick={fetchLeads}
                  className="mt-6 px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs font-black rounded-xl text-slate-300 transition cursor-pointer"
                >
                  Retrieve Fresh Streams
                </button>
              </motion.div>
            ) : (
              <motion.div
                key={activeLead.id}
                initial={{ opacity: 0, scale: 0.96, x: 20 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95, x: -30 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className={`bg-slate-950 border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden flex flex-col justify-between min-h-[440px] relative ${glassStyles} ${TIER_COLORS[getTier(activeLead)].glow}`}
              >
                {/* Left border based on tier */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${TIER_COLORS[getTier(activeLead)].border.replace("border-l-", "bg-")}`}></div>

                {/* Lock Overlay */}
                {activeLead.status !== "OPEN" && (
                   <div className="absolute inset-0 bg-slate-950/80 z-20 flex flex-col items-center justify-center border-2 border-amber-500/50 rounded-2xl backdrop-blur-sm">
                       <AlertTriangle className="h-10 w-10 text-amber-500 mb-3 animate-pulse" />
                       <h4 className="text-sm font-black text-amber-400 font-mono tracking-widest uppercase mb-1">Queue Handled</h4>
                       <p className="text-[10px] text-slate-300 uppercase font-black">Already Assigned</p>
                       <button 
                         onClick={() => setCurrentIndex(prev => prev + 1)} 
                         className="mt-6 px-4 py-2 bg-slate-800 text-white text-[10px] font-black uppercase rounded-lg shadow cursor-pointer">
                         Next Ticket
                       </button>
                   </div>
                )}

                {/* Card Header */}
                <div className="p-4 border-b border-slate-900 bg-slate-900/20 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="h-6 w-6 rounded-full bg-slate-905 flex items-center justify-center text-[10px] font-black font-mono border border-slate-800 bg-slate-900 text-cyan-400">
                      {activeLead.id.split("-")[0].substring(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <h4 className="text-[11px] font-black text-slate-200">{activeLead.name || activeLead.contact || "Customer"}</h4>
                      <p className="text-[9px] text-slate-500 font-mono tracking-widest uppercase">
                        {activeLead.lastActiveAt ? timeAgo(activeLead.lastActiveAt) : "No activity"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className={`flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded border uppercase tracking-wider font-mono ${
                      activeLead.channel.toUpperCase() === "WHATSAPP"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : activeLead.channel.toUpperCase() === "INSTAGRAM"
                        ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        : "bg-teal-500/10 text-teal-400 border-teal-500/20"
                    }`}>
                      {renderIcon(activeLead.channel)}
                      {activeLead.channel}
                    </span>

                    {renderTierPill(activeLead)}
                  </div>
                </div>

                {/* Main Content */}
                <div className="p-4 space-y-3 flex-1">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest font-mono">Last Customer Message</span>
                      {activeLead.hasAutoReply && activeLead.botRepliedAt && (
                        <span 
                          className="text-[9px] font-mono" 
                          style={{ color: "var(--signal)" }}
                        >
                          Bot replied {timeAgo(activeLead.botRepliedAt)}
                        </span>
                      )}
                    </div>
                    <blockquote className="p-3 bg-slate-900/60 rounded-xl border border-slate-800/60 font-mono text-xs text-slate-350 italic mt-1 leading-relaxed relative text-left">
                      "{activeLead.lastMessage || "No messages yet"}"
                    </blockquote>
                  </div>

                  {/* Amount display if pendingOrderAmount > 0 */}
                  {activeLead.pendingOrderAmount !== null && activeLead.pendingOrderAmount > 0 && (
                    <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-800/60 text-center">
                      <span className="text-[10px] text-slate-500 font-mono uppercase">Pending Order</span>
                      <p className="text-4xl font-black text-cyan-400 font-mono mt-1">₹{activeLead.pendingOrderAmount.toLocaleString("en-IN")}</p>
                    </div>
                  )}
                </div>

                {/* Bottom Swipe Controls */}
                <div className="p-4 border-t border-slate-900 bg-slate-900/40 grid grid-cols-2 gap-3">
                  <button
                    onClick={handleSkip}
                    className="py-3 bg-rose-955 hover:bg-rose-950 font-black uppercase tracking-widest text-[10px] text-rose-400 border border-rose-900 rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5 active:scale-95"
                  >
                    <X className="h-4 w-4" /> Skip / Spam
                  </button>

                  <button
                    onClick={handleClaim}
                    disabled={!activeLead.conversationId}
                    className="py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest text-[10px] rounded-xl cursor-pointer shadow-lg shadow-indigo-600/15 transition-all flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <UserPlus className="h-4 w-4 stroke-[3]" /> Claim Conversation
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* RIGHT - Queue Panel */}
        <div className={`rounded-2xl ${glassStyles}`}>
          <div className="p-4 space-y-4">
            
            {/* CLAIM NOW Section */}
            <div>
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono mb-2">
                CLAIM NOW ({claimNowLeads.length})
              </h3>
              {claimNowLeads.length === 0 ? (
                <div className="text-[11px] text-slate-600 font-mono p-3">No conversations in this tier</div>
              ) : (
                claimNowLeads.map(lead => (
                  <button
                    key={lead.id}
                    onClick={() => handleRowClick(lead.id)}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-800/40 bg-transparent hover:bg-[rgba(255,255,255,0.04)] transition-all cursor-pointer text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-slate-300 truncate">{lead.name || lead.contact}</p>
                      <p className="text-[9px] text-slate-500 font-mono mt-0.5">
                        {lead.lastActiveAt ? timeAgo(lead.lastActiveAt) : "No activity"}
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-cyan-400 shrink-0 ml-2">
                      ₹{lead.pendingOrderAmount?.toLocaleString("en-IN") || "0"}
                    </span>
                  </button>
                ))
              )}
            </div>

            {/* FOLLOW UP Section */}
            <div>
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono mb-2">
                FOLLOW UP ({followUpLeads.length})
              </h3>
              {followUpLeads.length === 0 ? (
                <div className="text-[11px] text-slate-600 font-mono p-3">No conversations in this tier</div>
              ) : (
                followUpLeads.map(lead => (
                  <button
                    key={lead.id}
                    onClick={() => handleRowClick(lead.id)}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-800/40 bg-transparent hover:bg-[rgba(255,255,255,0.04)] transition-all cursor-pointer text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-slate-300 truncate">{lead.name || lead.contact}</p>
                      <p className="text-[9px] text-slate-500 font-mono mt-0.5">
                        {lead.lastActiveAt ? timeAgo(lead.lastActiveAt) : "No activity"}
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 shrink-0 ml-2">
                      {lead.hasAutoReply ? "Acknowledged" : ""}
                    </span>
                  </button>
                ))
              )}
            </div>

            {/* BROWSING Section */}
            <div>
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono mb-2">
                BROWSING ({browsingLeads.length})
              </h3>
              {browsingLeads.length === 0 ? (
                <div className="text-[11px] text-slate-600 font-mono p-3">No conversations in this tier</div>
              ) : (
                browsingLeads.map(lead => (
                  <button
                    key={lead.id}
                    onClick={() => handleRowClick(lead.id)}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-800/40 bg-transparent hover:bg-[rgba(255,255,255,0.04)] transition-all cursor-pointer text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-slate-300 truncate">{lead.name || lead.contact}</p>
                      <p className="text-[9px] text-slate-500 font-mono mt-0.5">
                        {lead.lastActiveAt ? timeAgo(lead.lastActiveAt) : "No activity"}
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 shrink-0 ml-2">
                      {lead.hasAutoReply ? "Acknowledged" : ""}
                    </span>
                  </button>
                ))
              )}
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}

export default StreamTriage;