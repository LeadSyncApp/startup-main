import { useState } from "react";
import { motion } from "framer-motion";
import { UserCheck, RotateCw, Activity, Check, Users, Sparkles } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";

interface Workload {
  id: string;
  name: string;
  role: string;
  openChats: number;
  isAvailable?: boolean;
}

interface AssignmentStrategyManagerProps {
  currentStrategy: "MANUAL" | "ROUND_ROBIN" | "LOAD_BALANCED";
  workloads: Workload[];
  isActive: boolean;
  onSave: (strategy: "MANUAL" | "ROUND_ROBIN" | "LOAD_BALANCED") => Promise<void>;
}

export function AssignmentStrategyManager({
  currentStrategy,
  workloads,
  onSave
}: AssignmentStrategyManagerProps) {
  const { user } = useAuth();
  const [selected, setSelected] = useState<"MANUAL" | "ROUND_ROBIN" | "LOAD_BALANCED">(currentStrategy);
  const [isSaving, setIsSaving] = useState(false);

  const canEdit = user?.role === "OWNER" || user?.role === "ADMIN";

  // Compute total load
  const totalOpenLoads = workloads.reduce((acc, curr) => acc + curr.openChats, 0);

  const handleApply = async () => {
    if (!canEdit) {
      toast.error("Security Lock: Only administrators or owners can change chat assignment settings.");
      return;
    }
    setIsSaving(true);
    try {
      await onSave(selected);
    } catch {
      // Error is handled in parent
    } finally {
      setIsSaving(false);
    }
  };

  const CARD_VARIANTS = {
    hover: { scale: 1.02, y: -2, transition: { duration: 0.2 } },
    tap: { scale: 0.98 }
  };

  return (
    <div className="space-y-6" id="assignment-strategy-section">
      <div className="border-b border-app pb-5">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-50 text-indigo-600 p-2.5 rounded-2xl">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
              Automated Chat Assignment Strategies
              <span className="bg-indigo-100 text-indigo-800 text-xs px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider">NEW</span>
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              Select how incoming customer conversations and generated hot leads are routed to your active staff members.
            </p>
          </div>
        </div>
      </div>

      {/* Grid of strategies */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* MANUAL CLAIM CARD */}
        <motion.div
          variants={CARD_VARIANTS}
          whileHover={canEdit ? "hover" : undefined}
          whileTap={canEdit ? "tap" : undefined}
          onClick={() => canEdit && setSelected("MANUAL")}
          className={`relative border-2 p-5 rounded-2xl flex flex-col justify-between cursor-pointer transition-all ${
            selected === "MANUAL"
              ? "border-indigo-600 bg-indigo-50/20 shadow-indigo-50/50 shadow-md"
              : "border-app bg-app-surface hover:border-slate-300 shadow-sm"
          }`}
          id="strategy-manual-card"
        >
          <div className="space-y-4">
            <div className="flex justify-between items-start">
              <div className={`p-3 rounded-2xl ${selected === "MANUAL" ? "bg-indigo-600 text-white" : "bg-slate-100 text-app-muted"}`}>
                <UserCheck className="w-6 h-6" />
              </div>
              {selected === "MANUAL" && (
                <span className="flex items-center gap-1 bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                  <Check className="w-3.5 h-3.5" /> Selected
                </span>
              )}
            </div>
            
            <div>
              <h3 className="font-bold text-app-text text-lg">Manual Claims</h3>
              <p className="text-slate-500 text-sm mt-2 leading-relaxed">
                Incoming conversations default to "unassigned". Agents manually browse the queue and click "Claim" to inherit threads.
              </p>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-app flex flex-wrap gap-1.5">
            <span className="bg-slate-100 text-app-muted text-xs px-2.5 py-1 rounded-lg font-semibold">Self-Selected</span>
            <span className="bg-slate-100 text-app-muted text-xs px-2.5 py-1 rounded-lg font-semibold">Strict Boundaries</span>
          </div>
        </motion.div>

        {/* ROUND ROBIN CARD */}
        <motion.div
          variants={CARD_VARIANTS}
          whileHover={canEdit ? "hover" : undefined}
          whileTap={canEdit ? "tap" : undefined}
          onClick={() => canEdit && setSelected("ROUND_ROBIN")}
          className={`relative border-2 p-5 rounded-2xl flex flex-col justify-between cursor-pointer transition-all ${
            selected === "ROUND_ROBIN"
              ? "border-indigo-600 bg-indigo-50/20 shadow-indigo-50/50 shadow-md"
              : "border-app bg-app-surface hover:border-slate-300 shadow-sm"
          }`}
          id="strategy-round-robin-card"
        >
          <div className="space-y-4">
            <div className="flex justify-between items-start">
              <div className={`p-3 rounded-2xl ${selected === "ROUND_ROBIN" ? "bg-indigo-600 text-white" : "bg-slate-100 text-app-muted"}`}>
                <RotateCw className="w-6 h-6" />
              </div>
              {selected === "ROUND_ROBIN" && (
                <span className="flex items-center gap-1 bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                  <Check className="w-3.5 h-3.5" /> Selected
                </span>
              )}
            </div>
            
            <div>
              <h3 className="font-bold text-app-text text-lg">Sequential Round-Robin</h3>
              <p className="text-slate-500 text-sm mt-2 leading-relaxed">
                Rotates newly initiated chats and order requests through each active agent sequentially in a continuous repeating sequence.
              </p>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-app flex flex-wrap gap-1.5">
            <span className="bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded-lg font-semibold">100% Equal load</span>
            <span className="bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded-lg font-semibold">Automatic assigning</span>
          </div>
        </motion.div>

        {/* LOAD BALANCED CARD */}
        <motion.div
          variants={CARD_VARIANTS}
          whileHover={canEdit ? "hover" : undefined}
          whileTap={canEdit ? "tap" : undefined}
          onClick={() => canEdit && setSelected("LOAD_BALANCED")}
          className={`relative border-2 p-5 rounded-2xl flex flex-col justify-between cursor-pointer transition-all ${
            selected === "LOAD_BALANCED"
              ? "border-indigo-600 bg-indigo-50/20 shadow-indigo-50/50 shadow-md"
              : "border-app bg-app-surface hover:border-slate-300 shadow-sm"
          }`}
          id="strategy-load-balanced-card"
        >
          <div className="space-y-4">
            <div className="flex justify-between items-start">
              <div className={`p-3 rounded-2xl ${selected === "LOAD_BALANCED" ? "bg-indigo-600 text-white" : "bg-slate-100 text-app-muted"}`}>
                <Activity className="w-6 h-6" />
              </div>
              {selected === "LOAD_BALANCED" && (
                <span className="flex items-center gap-1 bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                  <Check className="w-3.5 h-3.5" /> Selected
                </span>
              )}
            </div>
            
            <div>
              <h3 className="font-bold text-app-text text-lg">Load-Balanced Capacity</h3>
              <p className="text-slate-500 text-sm mt-2 leading-relaxed">
                Measures current workload and routes incoming threads to the agent with the fewest open chats. Prevents any bottlenecking.
              </p>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-app flex flex-wrap gap-1.5">
            <span className="bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded-lg font-semibold">Burnout Protection</span>
            <span className="bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded-lg font-semibold">Capacity Optimised</span>
          </div>
        </motion.div>

      </div>

      {/* Real-time Load Analyzer for SME Manager */}
      <div className="bg-app-bg/50 rounded-2xl p-5 border border-app grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        <div className="md:col-span-1 space-y-1">
          <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-500" /> Crew Workload Allocator
          </h4>
          <p className="text-slate-500 text-xs leading-relaxed">
            A real-time overview of your squad's active capacity. Load balancing ensures incoming tickets directly route to lowest handles.
          </p>
          <div className="pt-2 text-xs text-slate-400 font-medium">
            Active Squad Backlog: <span className="text-indigo-600 font-bold">{totalOpenLoads} open chats</span>
          </div>
        </div>

        <div className="md:col-span-2 flex flex-wrap gap-4">
          {workloads.map((agent) => {
            const workloadPct = totalOpenLoads > 0 ? (agent.openChats / totalOpenLoads) * 100 : 0;
            return (
              <div
                key={agent.id}
                className={`bg-app-surface px-4 py-3 rounded-xl border flex-1 min-w-[140px] shadow-sm flex flex-col justify-between space-y-1.5 transition-all ${
                  agent.isAvailable !== false ? "border-app" : "border-app bg-app-bg opacity-75"
                }`}
              >
                <div className="flex justify-between items-center gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${agent.isAvailable !== false ? "bg-emerald-500 animate-pulse" : "bg-amber-400"}`} />
                    <span className="font-bold text-slate-700 text-xs truncate max-w-[90px]" title={`${agent.name} (${agent.isAvailable !== false ? 'Accepting Chats' : 'On break'})`}>
                      {agent.name}
                    </span>
                  </div>
                  <span className="text-[10px] uppercase font-black text-slate-400 shrink-0">{agent.role}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        agent.openChats > 5
                          ? "bg-red-500"
                          : agent.openChats > 2
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      }`}
                      style={{ width: `${Math.max(10, Math.min(100, workloadPct || 10))}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-slate-800 shrink-0">{agent.openChats} open</span>
                </div>
              </div>
            );
          })}
          {workloads.length === 0 && (
            <p className="text-xs text-slate-400 italic">No team users found. Add team members to unlock auto-assignment routing.</p>
          )}
        </div>
      </div>

      {canEdit ? (
        <div className="flex justify-end pt-2">
          <button
            onClick={handleApply}
            disabled={isSaving || selected === currentStrategy}
            className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-bold transition-all shadow ${
              selected === currentStrategy
                ? "bg-slate-100 text-slate-400 shadow-none cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-indigo-100 cursor-pointer"
            }`}
            id="apply-assignment-strategy-button"
          >
            {isSaving ? "Saving system preferences..." : "Apply Strategy Preferences"}
          </button>
        </div>
      ) : (
        <p className="text-xs text-slate-400 italic text-right">
          🔒 Active Strategy is managed by Administrators. Read-only access.
        </p>
      )}
    </div>
  );
}
