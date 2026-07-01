import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, AlertTriangle, 
  ShoppingBag, Sparkles, MessageCircle, Instagram, Globe, UserPlus
} from "lucide-react";
import toast from "react-hot-toast";
import { useSimulationStore } from "../../simulation/simulationStore";

// ... existing IndianPin map ...
export function validateIndianPin(pin: string): { valid: boolean; state?: string; region?: string } {
  const trimmed = (pin || "").trim();
  if (!/^\d{6}$/.test(trimmed)) {
    return { valid: false };
  }
  const firstTwo = parseInt(trimmed.substring(0, 2), 10);
  
  const mapping: Record<number, { state: string; region: string }> = {
    11: { state: "Delhi", region: "North" },
    12: { state: "Haryana", region: "North" },
    13: { state: "Haryana", region: "North" },
    14: { state: "Punjab", region: "North" },
    15: { state: "Punjab", region: "North" },
    16: { state: "Chandigarh", region: "North" },
    17: { state: "Himachal Pradesh", region: "North" },
    18: { state: "Jammu & Kashmir", region: "North" },
    19: { state: "Jammu & Kashmir", region: "North" },
    20: { state: "Uttar Pradesh", region: "North" },
    21: { state: "Uttar Pradesh", region: "North" },
    22: { state: "Uttar Pradesh", region: "North" },
    23: { state: "Uttar Pradesh", region: "North" },
    24: { state: "Uttar Pradesh", region: "North" },
    25: { state: "Uttar Pradesh", region: "North" },
    26: { state: "Uttar Pradesh", region: "North" },
    27: { state: "Uttar Pradesh", region: "North" },
    28: { state: "Uttar Pradesh & Uttarakhand", region: "North" },
    30: { state: "Rajasthan", region: "West" },
    31: { state: "Rajasthan", region: "West" },
    40: { state: "Maharashtra & Goa", region: "West" },
    41: { state: "Maharashtra", region: "West" },
    50: { state: "Andhra Pradesh & Telangana", region: "South" },
    60: { state: "Tamil Nadu", region: "South" },
    70: { state: "West Bengal", region: "East" },
    80: { state: "Bihar", region: "East" },
  };

  const matched = mapping[firstTwo];
  if (matched) {
    return { valid: true, state: matched.state, region: matched.region };
  }
  return { valid: false };
}

export interface TicketStream {
  id: string;
  customerName: string;
  sourceChannel: string;
  lastContent: string;
  timestamp: string;
  estimatedValue: number;
  extractedItems: { name: string; qty: number; price: number }[];
  addressDetails: {
    rawInput: string;
    landmark: string;
    city: string;
    state: string;
    pincode: string;
  };
  aiConfidence: number;
  intent?: string;
  aiSummary?: string;
  lockedBy?: string | null;
}

export function StreamTriage() {
  const { conversations, assignConversation, logActivity } = useSimulationStore();
  
  // Filter unassigned conversations for this view
  const streams = useMemo(() => {
    return conversations
      .filter(c => c.status === 'unassigned')
      .map(conv => ({
        id: conv.id,
        customerName: conv.customerName,
        sourceChannel: conv.platform.toUpperCase(),
        lastContent: conv.lastMessage,
        timestamp: new Date(conv.timestamp).toLocaleTimeString(),
        estimatedValue: 0,
        extractedItems: [] as { name: string; qty: number; price: number }[],
        addressDetails: {
          rawInput: '',
          landmark: '',
          city: '',
          state: '',
          pincode: ''
        },
        aiConfidence: 0.9,
        intent: conv.aiIntent || 'BROWSING',
        aiSummary: conv.aiSummary,
        lockedBy: conv.staffName
      }));
  }, [conversations]);

  const loading = false;

  // Operational metrics tracker for Indian home-preneur
  const [approvedCount] = useState(12); // Already triaged today
  const [approvedRevenue] = useState(28400); // Running revenue today
  useState(3600); // Savings from catching bad zip codes
  const [, setCompletedList] = useState<any[]>([]);
  const dailyTarget = 40000;
  const [currentIndex, setCurrentIndex] = useState(0);

  const resetDeck = () => {
    setCurrentIndex(0);
    toast("Queue refreshed via Simulation Store", { icon: "🔄" });
  };

  const activeTicket = useMemo(() => {
    if (currentIndex >= streams.length) return null;
    return streams[currentIndex];
  }, [currentIndex, streams]);

  const handleClaim = async () => {
    if (!activeTicket) return;
    try {
      assignConversation(activeTicket.id, 'user_1', 'Rahul');
      toast.success(`[Phase 2] Claimed conversation with ${activeTicket.customerName}`);
      logActivity('Rahul', 'CLAIM_CHAT', activeTicket.customerName);
    } catch (e: any) {
       toast.error("Failed to claim ticket");
    }
  };

  const handleReject = (reason: string = "Spam / Ignored") => {
    if (!activeTicket) return;

    toast(`Ticket from ${activeTicket.customerName} marked as [${reason}]`, { icon: "✖️" });
    setCompletedList((prev: any[]) => [
      { id: activeTicket.id, name: activeTicket.customerName, value: 0, status: "REJECTED" },
      ...prev
    ]);
    setCurrentIndex(prev => prev + 1);
  };

  const revenueProgress = Math.min((approvedRevenue / dailyTarget) * 100, 100);

  const renderIcon = (channel: string) => {
    switch (channel.toUpperCase()) {
      case "WHATSAPP": return <MessageCircle className="h-4 w-4 shrink-0" />;
      case "INSTAGRAM": return <Instagram className="h-4 w-4 shrink-0" />;
      default: return <Globe className="h-4 w-4 shrink-0" />;
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-400 animate-pulse">Loading intelligence streams...</div>;
  }

  return (
    <div className="p-4 bg-slate-950 rounded-3xl border border-slate-900 shadow-2xl selection:bg-cyan-500/10 text-slate-200">
      
      {/* Upper bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-900 pb-5 mb-5 gap-3">
        <div>
          <h2 className="text-xs font-black text-slate-300 uppercase tracking-widest font-mono flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500 animate-spin" style={{ animationDuration: "3s" }} />
            Tinder-Style Order Triage
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
             Review and claim unassigned inbound conversations in real-time.
          </p>
        </div>

        <button 
          onClick={resetDeck} 
          className="text-[10px] font-mono font-black border border-slate-800 bg-slate-900/40 hover:bg-slate-900 px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 transition cursor-pointer"
        >
          Replenish Queue
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-2 flex flex-col justify-between space-y-4">
          <AnimatePresence mode="wait">
            {!activeTicket ? (
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
                  onClick={resetDeck}
                  className="mt-6 px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs font-black rounded-xl text-slate-300 transition cursor-pointer"
                >
                  Retrieve Fresh Streams
                </button>
              </motion.div>
            ) : (
              <motion.div
                key={activeTicket.id}
                initial={{ opacity: 0, scale: 0.96, x: 20 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95, x: -30 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="bg-slate-950 border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden flex flex-col justify-between min-h-[440px] relative"
              >
                {/* Visual Lock Overlay */}
                {activeTicket.lockedBy && (
                   <div className="absolute inset-0 bg-slate-950/80 z-20 flex flex-col items-center justify-center border-2 border-amber-500/50 rounded-2xl backdrop-blur-sm">
                      <AlertTriangle className="h-10 w-10 text-amber-500 mb-3 animate-pulse" />
                      <h4 className="text-sm font-black text-amber-400 font-mono tracking-widest uppercase mb-1">Queue Handled</h4>
                      <p className="text-[10px] text-slate-300 uppercase font-black">Just Claimed by {activeTicket.lockedBy}</p>
                      <button 
                        onClick={() => setCurrentIndex(prev => prev + 1)} 
                        className="mt-6 px-4 py-2 bg-slate-800 text-white text-[10px] font-black uppercase rounded-lg shadow cursor-pointer">
                        Next Ticket
                      </button>
                   </div>
                )}

                {/* Active Card Title Header */}
                <div className="p-4 border-b border-slate-900 bg-slate-900/20 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="h-6 w-6 rounded-full bg-slate-905 flex items-center justify-center text-[10px] font-black font-mono border border-slate-800 bg-slate-900 text-cyan-400">
                      {activeTicket.id.split("-")[0].substring(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <h4 className="text-[11px] font-black text-slate-200">{activeTicket.customerName}</h4>
                      <p className="text-[9px] text-slate-500 font-mono tracking-widest uppercase">{activeTicket.timestamp}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className={`flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded border uppercase tracking-wider font-mono ${
                      activeTicket.sourceChannel === "WHATSAPP"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : activeTicket.sourceChannel === "INSTAGRAM"
                        ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        : "bg-teal-500/10 text-teal-400 border-teal-500/20"
                    }`}>
                      {renderIcon(activeTicket.sourceChannel)}
                      {activeTicket.sourceChannel}
                    </span>

                    <span 
                      className="text-[10px] flex items-center gap-1 font-black bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 rounded-md font-mono cursor-help"
                      title={activeTicket.aiSummary || "AI Triage Intent"}
                    >
                      {activeTicket.intent} Intent
                    </span>
                  </div>
                </div>

                {/* Main Raw Chat Bubble Preview */}
                <div className="p-4 space-y-3 bg-slate-950 flex-1">
                  <div>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest font-mono">Last Customer Message</span>
                    <blockquote className="p-3 bg-slate-900/60 rounded-xl border border-slate-800/60 font-mono text-xs text-slate-350 italic mt-1 leading-relaxed relative text-left">
                      "{activeTicket.lastContent}"
                    </blockquote>
                  </div>

                  {/* AI Extracted Structural Entities */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    
                    <div className="p-3 bg-slate-900/20 border border-slate-900 rounded-xl">
                      <span className="text-[8.5px] font-black text-slate-500 uppercase tracking-widest font-mono block mb-1">Extracted Line Items</span>
                      <div className="space-y-1 mt-1.5">
                        {activeTicket.extractedItems.length === 0 ? (
                           <div className="text-[10px] text-slate-600 font-mono">No items detected</div>
                        ) : activeTicket.extractedItems.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-[11px]">
                            <span className="font-bold text-slate-300">{item.qty}x {item.name}</span>
                            <span className="font-mono text-cyan-400">₹{item.price * item.qty}</span>
                          </div>
                        ))}
                        <div className="border-t border-slate-900 pt-1.5 flex justify-between items-center text-xs font-black text-slate-205 mt-1.5 font-mono">
                          <span>Total AI Value</span>
                          <span className="text-cyan-400">₹{activeTicket.estimatedValue}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-900/20 border border-slate-900 rounded-xl space-y-2">
                      <span className="text-[8.5px] font-black text-slate-500 uppercase tracking-widest font-mono block">Bharat-Address parsing</span>
                      
                      <div className="space-y-1 text-[11px] font-mono">
                        <div className="flex justify-between items-start">
                          <span className="text-slate-500">Region:</span>
                          <span className="text-slate-300 text-right">{activeTicket.addressDetails.city}, {activeTicket.addressDetails.state || "Unspecified"}</span>
                        </div>
                        <div className="flex justify-between items-start">
                          <span className="text-slate-500">Pincode:</span>
                          <span className={`font-black ${activeTicket.addressDetails.pincode ? "text-cyan-400" : "text-rose-400"}`}>
                            {activeTicket.addressDetails.pincode || "❌ Missing"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Bottom Swipe Controls */}
                <div className="p-4 border-t border-slate-900 bg-slate-900/40 grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleReject("User Skip")}
                    className="py-3 bg-rose-955 hover:bg-rose-950 font-black uppercase tracking-widest text-[10px] text-rose-400 border border-rose-900 rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5 active:scale-95"
                  >
                    <X className="h-4 w-4" /> Skip / Spam
                  </button>

                  <button
                    onClick={handleClaim}
                    className="py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest text-[10px] rounded-xl cursor-pointer shadow-lg shadow-indigo-600/15 transition-all flex items-center justify-center gap-1.5 active:scale-95"
                  >
                    <UserPlus className="h-4 w-4 stroke-[3]" /> Claim Conversation
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-slate-950 border border-slate-905 rounded-2xl bg-gradient-to-br from-slate-950 to-slate-900 relative overflow-hidden">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono block">Indian MSME Scoreboard</span>
            <div className="mt-3.5 flex justify-between items-baseline">
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">Today's Triage Volume</p>
                <p className="text-2xl font-black text-emerald-400 font-mono mt-0.5">₹{approvedRevenue.toLocaleString("en-IN")}</p>
              </div>

              <div className="text-right">
                <span className="text-[10px] bg-emerald-950 text-emerald-400 font-black px-2 py-0.5 rounded border border-emerald-800 uppercase font-mono">
                  {approvedCount} Orders
                </span>
              </div>
            </div>

            <div className="space-y-1.5 mt-4">
              <div className="flex justify-between items-center text-[10px] font-mono">
                <span className="text-slate-400">Daily Revenue Target</span>
                <span className="font-bold text-slate-200">{revenueProgress.toFixed(0)}% Completed</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-400 rounded-full transition-all duration-550"
                  style={{ width: `${revenueProgress}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                <span>Completed: ₹{approvedRevenue.toLocaleString("en-IN")}</span>
                <span>Target: Target: ₹{dailyTarget.toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}

export default StreamTriage;
