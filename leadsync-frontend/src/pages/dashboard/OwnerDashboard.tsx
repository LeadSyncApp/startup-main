import { useEffect, useState, useCallback } from "react";
import { api } from "../../lib/api";
import { useSocket } from "../../context/SocketContext";
import { Users, UserCheck, MessageSquare, CheckCircle, Activity, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

interface AssignedConv {
  id: string;
  status: string;
  updatedAt: string;
  lead: {
    id: string;
    name: string | null;
    contact: string;
    channel: string;
  } | null;
}

interface AgentStat {
  agentId: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  isAvailable: boolean;
  staffId: string | null;
  totalAssignedCount: number;
  currentConvsCount: number;
  resolvedConvsCount: number;
  currentConversations: AssignedConv[];
  resolvedConversations: AssignedConv[];
}

interface ActivityItem {
  conversationId: string;
  channel: string;
  status: string;
  updatedAt: string;
  assignedTo: { id: string; name: string } | null;
  leadName: string;
  leadContact: string;
}

export default function OwnerDashboard() {
  const { socket } = useSocket();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    agentStats: AgentStat[];
    recentActivity: ActivityItem[];
  } | null>(null);

  const fetchStats = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await api.get("/users/owner-dashboard");
      setData(res);
    } catch (err: any) {
      toast.error("Failed to load owner dashboard statistics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Listen to live updates so the stats refresh seamlessly!
  useEffect(() => {
    if (!socket) return;

    const handleUpdate = () => {
      console.log("⚡ [OwnerDashboard] Realtime updates detected, refreshing stats...");
      fetchStats(true); // Silent update
    };

    socket.on("conversation_updated", handleUpdate);
    socket.on("conversation_assigned", handleUpdate);
    socket.on("notification_new", handleUpdate);

    return () => {
      socket.off("conversation_updated", handleUpdate);
      socket.off("conversation_assigned", handleUpdate);
      socket.off("notification_new", handleUpdate);
    };
  }, [socket, fetchStats]);

  if (loading && !data) {
    return (
      <div className="flex-1 flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
          <span className="text-sm text-app-muted font-medium">Analyzing assignment activity...</span>
        </div>
      </div>
    );
  }

  const stats = data?.agentStats || [];
  const activities = data?.recentActivity || [];

  const totalClosed = stats.reduce((sum, item) => sum + item.resolvedConvsCount, 0);
  const totalOpen = stats.reduce((sum, item) => sum + item.currentConvsCount, 0);
  const totalAssignments = stats.reduce((sum, item) => sum + item.totalAssignedCount, 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 lg:p-6" id="owner-dashboard-root">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-app pb-5">
        <div>
          <h1 className="text-2xl font-bold text-app-text tracking-tight">Owner Assignment Control</h1>
          <p className="text-sm text-app-muted">Monitor live updates, round-robin assignments, and agent capacity.</p>
        </div>
        <button
          onClick={() => fetchStats()}
          className="inline-flex items-center gap-2 justify-center px-4 py-2 border border-app bg-app-surface hover:bg-app-bg text-app-text text-sm font-medium rounded-lg shadow-sm transition-colors"
          id="btn-refresh-stats"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh Activity
        </button>
      </div>

      {/* Numerical Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4" id="owner-dashboard-grid-headers">
        <div className="bg-app-surface p-5 rounded-xl border border-app shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-400">Total Staff</div>
            <div className="text-2xl font-bold text-app-text">{stats.length}</div>
          </div>
        </div>

        <div className="bg-app-surface p-5 rounded-xl border border-app shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <MessageSquare className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-400">Current Sessions</div>
            <div className="text-2xl font-bold text-app-text">{totalOpen}</div>
          </div>
        </div>

        <div className="bg-app-surface p-5 rounded-xl border border-app shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <CheckCircle className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-400">Resolved Conversations</div>
            <div className="text-2xl font-bold text-app-text">{totalClosed}</div>
          </div>
        </div>

        <div className="bg-app-surface p-5 rounded-xl border border-app shadow-sm flex items-center gap-4">
          <div className="p-3 bg-app-bg text-app-muted rounded-lg">
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-400">Total Assignments</div>
            <div className="text-2xl font-bold text-app-text">{totalAssignments}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agents Listing & Status Monitor */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-lg font-semibold text-app-text flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-indigo-500" />
            Agent Performance Profiles
          </h2>

          <div className="grid grid-cols-1 gap-6">
            {stats.map((agent) => {
              const completionRate = agent.totalAssignedCount > 0 
                ? Math.round((agent.resolvedConvsCount / agent.totalAssignedCount) * 100)
                : 100;

              return (
                <div key={agent.agentId} className="bg-app-surface border border-app rounded-xl shadow-sm hover:border-app-border-strong transition-all overflow-hidden">
                  <div className="p-5 border-b border-app flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-app-bg/50">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-app-text">{agent.name}</span>
                        <span className="text-xs font-medium text-slate-400">({agent.role})</span>
                        {agent.isActive ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-app-bg-soft text-app-muted">
                            Inactive
                          </span>
                        )}

                        {agent.isAvailable ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700">
                            Available
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700">
                            Unavailable
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-app-muted mt-0.5">{agent.email} • Staff ID: {agent.staffId || "N/A"}</p>
                    </div>

                    <div className="text-left sm:text-right">
                      <div className="text-xs font-medium text-slate-400">Completion Tracker</div>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="w-24 bg-app-bg-soft rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-indigo-600 h-2 rounded-full transition-all"
                            style={{ width: `${completionRate}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold text-app-text">{completionRate}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {/* Currently Assigned */}
                    <div className="space-y-3">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex justify-between">
                        <span>Current Active ({agent.currentConvsCount})</span>
                      </div>
                      {agent.currentConversations.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No open conversations assigned.</p>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {agent.currentConversations.map((c) => (
                            <div key={c.id} className="p-2.5 bg-app-bg-soft/50 rounded-lg text-xs space-y-1">
                              <div className="flex justify-between font-semibold">
                                <span className="text-app-text">{c.lead?.name || c.lead?.contact || "Visitor"}</span>
                                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 uppercase font-mono text-[9px]">
                                  {c.status}
                                </span>
                              </div>
                              <div className="text-[11px] text-app-muted flex justify-between">
                                <span>{c.lead?.contact} • {c.lead?.channel}</span>
                                <span>Updated {new Date(c.updatedAt).toLocaleTimeString()}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Previously Assigned */}
                    <div className="space-y-3">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex justify-between">
                        <span>Resolved History ({agent.resolvedConvsCount})</span>
                      </div>
                      {agent.resolvedConversations.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No resolved history found.</p>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {agent.resolvedConversations.map((c) => (
                            <div key={c.id} className="p-2.5 bg-emerald-50/50 rounded-lg text-xs space-y-1">
                              <div className="flex justify-between font-semibold">
                                <span className="text-app-text">{c.lead?.name || c.lead?.contact || "Visitor"}</span>
                                <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 uppercase font-mono text-[9px]">
                                  RESOLVED
                                </span>
                              </div>
                              <div className="text-[11px] text-app-muted flex justify-between">
                                <span>{c.lead?.contact} • {c.lead?.channel}</span>
                                <span>Updated {new Date(c.updatedAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Assignment Activity and Channels */}
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-app-text flex items-center gap-2">
            <Activity className="h-5 w-5 text-indigo-500" />
            Live Activity Stream
          </h2>

          <div className="bg-app-surface border border-app rounded-xl shadow-sm p-4 space-y-4">
            {activities.length === 0 ? (
              <p className="text-sm text-slate-400 italic py-8 text-center">No recent assignment updates.</p>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {activities.map((act) => (
                  <div key={act.conversationId} className="p-3 border-l-2 border-indigo-500 bg-app-bg rounded-r-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-app-text">{act.leadName}</span>
                      <span className="text-[10px] bg-app-bg-soft px-1.5 py-0.5 rounded font-bold uppercase">
                        {act.channel}
                      </span>
                    </div>
                    <div className="text-xs text-app-muted">
                      {act.assignedTo ? (
                        <span>Assigned to <strong className="text-indigo-600">{act.assignedTo.name}</strong></span>
                      ) : (
                        <span className="text-amber-600 font-medium">🚨 Unassigned</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>Status: {act.status}</span>
                      <span>{new Date(act.updatedAt).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
