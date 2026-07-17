import React, { useState } from "react";
import { Sparkles, Terminal, PlayCircle, RotateCcw, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

interface SimulationLog {
  id: string;
  timestamp: string;
  event: string;
  status: "SUCCESS" | "TRACE" | "CRITICAL";
  payload: string;
}

export function AIOrchestrator() {
  const [systemPrompt, setSystemPrompt] = useState(
    "You are a polite Indian D2C salesperson. Convert customer catalog catalog requests. Always validate sizing specs and suggest a matching item bundle before checkout. Stand in the Asia/Kolkata timezone context."
  );
  const [customerQuery, setCustomerQuery] = useState("Hey! Is the silk kurti still available? Do you ship to Delhi?");
  const [responseOutput, setResponseOutput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<SimulationLog[]>([
    {
      id: "log-1",
      timestamp: "12:01:45 PM",
      event: "Sync Engine Loaded",
      status: "SUCCESS",
      payload: "[Pre-heat] Workspace context loaded. SME category: Retail Clothing.",
    },
    {
      id: "log-2",
      timestamp: "12:01:46 PM",
      event: "System Instruction Cache Refresh",
      status: "TRACE",
      payload: "Loaded prompt set: 'polite Indian D2C salesperson'.",
    },
  ]);

  const handleTestOrchestration = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerQuery.trim()) {
      toast.error("Please enter a customer query to test");
      return;
    }

    setIsRunning(true);
    setResponseOutput("");

    // Simulate system trace logs
    const newLogs: SimulationLog[] = [
      {
        id: `log-${Date.now()}-1`,
        timestamp: new Date().toLocaleTimeString(),
        event: "Keyword Detection Routing",
        status: "TRACE",
        payload: `Detected terms: "silk kurti" -> [Catalog SKU mapped], "Delhi" -> [Indian shipping rules matched]`,
      },
      {
        id: `log-${Date.now()}-2`,
        timestamp: new Date().toLocaleTimeString(),
        event: "LLM Orchestration Triggered",
        status: "SUCCESS",
        payload: "Prompt instruction set & context variables injected into model parameters successfully.",
      },
    ];

    setLogs((prev) => [...prev, ...newLogs]);

    setTimeout(() => {
      setResponseOutput(
        `🤖 [AI Response]: Hello there! Yes, the Premium pre-treated Silk Kurti is absolutely available and ready to ship. We provide complementary express logistics delivery straight to your Delhi location (typically arrived within 24-48 business hours)! Would you like to add it to your order queue? I can also bundle our popular Kolhapuri Chappals to complete the ensemble.`
      );
      setIsRunning(false);
      toast.success("Single-turn orchestration rules executed cleanly!");
    }, 1800);
  };

  const clearSandbox = () => {
    setCustomerQuery("");
    setResponseOutput("");
    toast.success("Sandbox environment reset");
  };

  return (
    <div className="p-4 bg-slate-950 rounded-2xl border border-slate-900 shadow-2xl selection:bg-indigo-500/10 text-xs">
      {/* Upper bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-900 pb-4 mb-5 gap-3">
        <div>
          <h2 className="text-sm font-black text-slate-200 uppercase tracking-widest font-mono flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cyan-400 fill-cyan-500 animate-pulse" />
            AI Prompt & Rule Orchestrator
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Optimize single-turn sales playbook prompts. Tune and test instruction sets against live triggers.
          </p>
        </div>
        <span className="text-[10px] uppercase font-mono font-black text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded">
          Rule-Base Tuner
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Prompt configuration */}
        <form onSubmit={handleTestOrchestration} className="space-y-4">
          <div className="space-y-1.5">
            <label className="font-extrabold text-slate-400 font-mono text-[9px] uppercase tracking-wider block">
              Core Prompt Template / System Directives
            </label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={4}
              className="w-full bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-all font-mono leading-relaxed"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="font-extrabold text-slate-400 font-mono text-[9px] uppercase tracking-wider block">
                Sandbox Customer Input Query
              </label>
              <button
                type="button"
                onClick={clearSandbox}
                className="text-[9px] font-mono font-black text-rose-400 hover:text-rose-300 uppercase tracking-wide flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="h-2.5 w-2.5" />
                Clear Test Box
              </button>
            </div>
            <input
              type="text"
              value={customerQuery}
              onChange={(e) => setCustomerQuery(e.target.value)}
              placeholder="e.g. Do you accept COD same day to Bangalore?"
              className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-3.5 py-2.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-all font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={isRunning || !customerQuery.trim()}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-black font-mono uppercase text-slate-950 bg-cyan-400 hover:bg-[#22d3ee] disabled:opacity-40 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-950/20"
          >
            {isRunning ? (
              <>
                <RefreshCw className="h-4.5 w-4.5 text-slate-950 animate-spin" />
                <span>Generating Sandbox Inference...</span>
              </>
            ) : (
              <>
                <PlayCircle className="h-4.5 w-4.5 text-slate-950" />
                <span>Execute Sandbox Rule Match</span>
              </>
            )}
          </button>
        </form>

        {/* Console logs */}
        <div className="flex flex-col h-full bg-slate-950/40 border border-slate-900 rounded-xl overflow-hidden min-h-[300px]">
          {/* Header console tab */}
          <div className="bg-slate-900/80 px-3 py-2 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="h-3.5 w-3.5 text-slate-500" />
              <span className="font-extrabold text-slate-400 font-mono text-[9px] uppercase tracking-wider">
                Orchestration Tracer Logs
              </span>
            </div>
            <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
          </div>

          {/* Body logs console */}
          <div className="flex-1 overflow-y-auto p-3 font-mono text-[10px] space-y-2.5 max-h-[220px] custom-scrollbar">
            {logs.map((log) => (
              <div key={log.id} className="border-b border-slate-900/40 pb-2">
                <div className="flex justify-between text-[8px] text-slate-500">
                  <span>Timestamp: {log.timestamp}</span>
                  <span
                    className={
                      log.status === "SUCCESS"
                        ? "text-emerald-400 font-black"
                        : log.status === "CRITICAL"
                        ? "text-rose-400 font-black"
                        : "text-slate-400"
                    }
                  >
                    [{log.status}]
                  </span>
                </div>
                <p className="text-cyan-400 font-extrabold uppercase mt-0.5 text-[9px]">
                  {log.event}
                </p>
                <p className="text-slate-400 mt-0.5 leading-normal">{log.payload}</p>
              </div>
            ))}
          </div>

          {/* Sandbox Response block */}
          <div className="bg-slate-900/60 p-3 border-t border-slate-800/80 font-mono">
            <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider block mb-1">
              Sandbox Inference Output Preview
            </span>
            <div className="p-2.5 bg-slate-950/80 border border-slate-800 rounded-lg text-[10.5px] leading-relaxed text-slate-300 min-h-[90px] whitespace-pre-wrap">
              {isRunning ? (
                <div className="flex items-center gap-2 py-4 justify-center text-slate-500 animate-pulse">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Computing response context against Prompt instruction template...</span>
                </div>
              ) : (
                responseOutput || (
                  <p className="text-slate-600 italic">
                    Output preview displays here once executing Sandbox execution matches.
                  </p>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AIOrchestrator;
