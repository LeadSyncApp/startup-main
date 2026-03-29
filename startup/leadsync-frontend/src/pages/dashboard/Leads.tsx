import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { motion, AnimatePresence } from "framer-motion";
import LeadsTable from "../../components/leads/LeadsTable";
import LeadDrawer from "../../components/leads/LeadDrawer";
import SectionSummary from "../../components/dashboard/SectionSummary";
import { api } from "../../lib/api";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { EmptyLeads } from "../../components/ui/EmptyState";
import { PageTransition } from "../../components/ui/Animations";
import { Search, X, CheckSquare, UserCheck, AlertTriangle, LayoutGrid, List, ShoppingCart } from "lucide-react";
import LeadsKanban from "../../components/leads/LeadsKanban";
import toast from "react-hot-toast";

export default function Leads() {
  const { token, companyId, user } = useAuth();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [searchParams] = useSearchParams();

  // Filter State for Shared Inbox + Pending Approval toggle
  const [filter, setFilter] = useState(() => {
    // Check for pendingApproval filter in URL
    const urlFilter = searchParams.get('filter');
    return urlFilter === 'pendingApproval' ? 'all' : 'all';
  });
  
  // Pending approval filter flag - now as a separate toggle state
  const [showPendingApprovalOnly, setShowPendingApprovalOnly] = useState(() => {
    return searchParams.get('filter') === 'pendingApproval';
  });

  // Drawer & search state
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");

  // View mode
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");

  // Bulk selection
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());

  const handleSelect = (id: string) => {
    setSelectedLeads(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedLeads.size === filteredLeads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(filteredLeads.map((l: any) => l.id)));
    }
  };

  const clearSelection = () => setSelectedLeads(new Set());

  // Leads State
  const [leads, setLeads] = useState<any[]>(() => {
    // Only hydrate from cache if default 'all' view
    if (!companyId) return [];
    try {
      const saved = localStorage.getItem(`leadsync_leads_cache_${companyId}`);
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [loading, setLoading] = useState(leads.length === 0);

  useEffect(() => {
    if (!token) return;

    const fetchLeads = async () => {
      try {
        setLoading(true);
        const data = await api.get(`/leads?filter=${filter}`);
        setLeads(data);
        if (companyId && filter === "all") {
          localStorage.setItem(`leadsync_leads_cache_${companyId}`, JSON.stringify(data));
        }
      } catch (err) {
        console.error("❌ Failed to fetch leads:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchLeads();
  }, [token, filter]);

  // Real-time updates
  useEffect(() => {
    if (!socket) return;

    const onNewLead = (lead: any) => {
      if (filter === "all" || filter === "unassigned") {
        setLeads((prev) => [lead, ...prev]);
      }
    };

    const onAssigned = (data: any) => {
      // data: { conversationId, assignedTo: {id, name}, status }
      setLeads((prev) => prev.map(lead => {
        if (lead.conversationId === data.conversationId) {
          // Determine if we should keep it in current filter view
          if (filter === "unassigned" && data.assignedTo) return null; // Remove from unassigned
          if (filter === "me" && data.assignedTo?.id !== user?.id) return null; // Verify filtering

          return {
            ...lead,
            agentAssigned: data.assignedTo?.name,
            assignedTo: data.assignedTo,
            status: data.status
          };
        }
        return lead;
      }).filter(Boolean) as any[]);
    };

    // 🆕 Handle lead updates for pending orders
    const onLeadUpdated = (data: any) => {
      setLeads(prev => prev.map(lead => {
        if (lead.id === data.leadId) {
          return {
            ...lead,
            hasPendingOrderApproval: data.hasPendingOrderApproval,
            pendingOrderState: data.pendingOrderState,
            pendingOrderId: data.pendingOrderId,
            pendingOrderClaimedById: data.pendingOrderClaimedById,
            pendingOrderClaimedAt: data.pendingOrderClaimedAt,
            pendingOrderSummary: data.pendingOrderSummary,
            pendingOrderAmount: data.pendingOrderAmount,
            agentAssigned: data.agentAssigned,
            suggestedAction: data.pendingOrderState === "PENDING_APPROVAL" ? "Review order" : 
                           data.pendingOrderState === "CLAIMED_FOR_APPROVAL" ? "Process order" : lead.suggestedAction
          };
        }
        return lead;
      }));
    };

    socket.on("lead_created", onNewLead);
    socket.on("conversation_assigned", onAssigned);
    socket.on("lead_updated", onLeadUpdated);

    return () => {
      socket.off("lead_created", onNewLead);
      socket.off("conversation_assigned", onAssigned);
      socket.off("lead_updated", onLeadUpdated);
    };
  }, [socket, filter, user]);

  const handleClaim = async (conversationId: string, e: any) => {
    e.stopPropagation();
    if (!user?.id) return;

    try {
      await api.patch(`/conversations/${conversationId}/assign`, { assignedToId: user.id });
      // Optimistic UI update
      setLeads(prev => prev.map(l =>
        l.conversationId === conversationId
          ? { ...l, agentAssigned: user.name, assignedTo: { id: user.id, name: user.name } }
          : l
      ));
    } catch (err) {
      console.error("Failed to claim chat", err);
      alert("Could not claim chat. Someone else might have taken it.");
    }
  };

  const handleClaimPendingOrder = async (leadId: string, e: any) => {
    e.stopPropagation();
    if (!user?.id) return;

    try {
      await api.post(`/leads/${leadId}/claim-pending-order`);
      // Optimistic UI update
      setLeads(prev => prev.map(l =>
        l.id === leadId
          ? { 
              ...l, 
              pendingOrderState: "CLAIMED_FOR_APPROVAL",
              agentAssigned: user.name, 
              assignedTo: { id: user.id, name: user.name },
              suggestedAction: "Process order"
            }
          : l
      ));
      toast.success("Pending order claimed! Opening conversation...");
      
      // Navigate to conversation after a short delay
      setTimeout(() => {
        const lead = leads.find(l => l.id === leadId);
        if (lead?.conversationId) {
          navigate(`/dashboard/conversations?conversationId=${lead.conversationId}`);
        }
      }, 1000);
    } catch (err: any) {
      console.error("Failed to claim pending order", err);
      toast.error(err.response?.data?.message || "Could not claim pending order. Someone else might have taken it.");
    }
  };

  const handleBulkAssign = async () => {
    if (!user?.id || selectedLeads.size === 0) return;
    const ids = Array.from(selectedLeads);
    const targetLeads = leads.filter((l: any) => ids.includes(l.id) && l.conversationId);
    if (targetLeads.length === 0) { toast.error("No conversations found to assign."); return; }

    const results = await Promise.allSettled(
      targetLeads.map((l: any) =>
        api.patch(`/conversations/${l.conversationId}/assign`, { assignedToId: user.id })
      )
    );
    const succeeded = results.filter(r => r.status === "fulfilled").length;
    setLeads(prev => prev.map(l =>
      ids.includes(l.id) ? { ...l, agentAssigned: user.name, assignedTo: { id: user.id, name: user.name } } : l
    ));
    toast.success(`Assigned ${succeeded} conversation${succeeded !== 1 ? "s" : ""} to you`);
    clearSelection();
  };

  const handleBulkPriority = async (priority: string) => {
    if (selectedLeads.size === 0) return;
    const ids = Array.from(selectedLeads);
    try {
      await Promise.all(ids.map(id => api.patch(`/leads/${id}`, { priority })));
      setLeads(prev => prev.map(l => ids.includes(l.id) ? { ...l, priority } : l));
      toast.success(`Updated priority for ${ids.length} lead${ids.length !== 1 ? "s" : ""}`);
      clearSelection();
    } catch {
      toast.error("Some updates failed");
    }
  };

  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      const matchesSearch = !search ||
        lead.name?.toLowerCase().includes(search.toLowerCase()) ||
        lead.contact?.includes(search);
      const matchesChannel = channelFilter === "ALL" || lead.channel === channelFilter;
      const matchesPriority = priorityFilter === "ALL" || lead.priority === priorityFilter;
      const matchesPendingApproval = !showPendingApprovalOnly || 
        (lead.pendingOrderState && lead.pendingOrderState !== "NONE");
      return matchesSearch && matchesChannel && matchesPriority && matchesPendingApproval;
    });
  }, [leads, search, channelFilter, priorityFilter, showPendingApprovalOnly]);

  // Sync URL with pending approval filter state
  useEffect(() => {
    const currentFilter = searchParams.get('filter');
    const shouldShowPending = currentFilter === 'pendingApproval';
    if (shouldShowPending !== showPendingApprovalOnly) {
      setShowPendingApprovalOnly(shouldShowPending);
    }
  }, [searchParams]);

  // Update URL when pending approval toggle changes
  const togglePendingApproval = (show: boolean) => {
    setShowPendingApprovalOnly(show);
    if (show) {
      navigate('/dashboard/leads?filter=pendingApproval', { replace: true });
    } else {
      navigate('/dashboard/leads', { replace: true });
    }
  };

  // Clear bulk selection when filters change
  useEffect(() => { setSelectedLeads(new Set()); }, [filter, search, channelFilter, priorityFilter, showPendingApprovalOnly]);

  const channels = useMemo(() => {
    const unique = [...new Set(leads.map(l => l.channel).filter(Boolean))];
    return unique;
  }, [leads]);

  return (
    <PageTransition className="space-y-4 lg:space-y-6">
      {/* Header row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <SectionSummary
          title="Leads CRM"
          description="Manage customer sales and support tickets."
          stats={[
            { label: "Visible", value: String(filteredLeads.length) },
            ...(leads.length !== filteredLeads.length ? [{ label: "Total", value: String(leads.length) }] : []),
          ]}
        />

        {/* View toggle + Filter Tabs */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode("table")}
              title="Table view"
              className={`p-2 rounded-md transition ${viewMode === "table" ? "bg-white shadow-sm text-indigo-600" : "text-slate-400 hover:text-slate-600"}`}
            >
              <List size={15} />
            </button>
            <button
              onClick={() => setViewMode("kanban")}
              title="Kanban view"
              className={`p-2 rounded-md transition ${viewMode === "kanban" ? "bg-white shadow-sm text-indigo-600" : "text-slate-400 hover:text-slate-600"}`}
            >
              <LayoutGrid size={15} />
            </button>
          </div>
          
          {/* Pending Approval Toggle */}
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => togglePendingApproval(false)}
              className={`px-3 lg:px-4 py-2 text-xs lg:text-sm font-medium rounded-md transition ${!showPendingApprovalOnly
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
                }`}
            >
              All Leads
            </button>
            <button
              onClick={() => togglePendingApproval(true)}
              className={`px-3 lg:px-4 py-2 text-xs lg:text-sm font-medium rounded-md transition ${showPendingApprovalOnly
                  ? "bg-white text-amber-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
                }`}
            >
              Pending Approval
            </button>
          </div>
          
          {/* Inbox Filter Tabs */}
          {!showPendingApprovalOnly && (
            <div className="flex bg-slate-100 p-1 rounded-lg">
            {["all", "me", "unassigned"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 lg:px-4 py-2 text-xs lg:text-sm font-medium rounded-md transition ${filter === f
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                  }`}
              >
                {f === "all" ? "All" : f === "me" ? "Mine" : "Unassigned"}
              </button>
            ))}
            </div>
          )}
        </div>
      </div>

      {/* Search + Filter bar */}
      {!loading && leads.length > 0 && (
        <React.Fragment>
          {showPendingApprovalOnly && (
            <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <ShoppingCart size={16} className="text-amber-600" />
                <span className="text-amber-800 font-medium text-sm">
                  Showing only leads with pending order approvals
                </span>
              </div>
              <button
                onClick={() => togglePendingApproval(false)}
                className="text-amber-600 hover:text-amber-800 text-xs font-medium underline"
              >
                Clear filter
              </button>
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or contact..."
              className="w-full pl-9 pr-8 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Channel Filter */}
          {channels.length > 1 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {["ALL", ...channels].map(ch => (
                <button
                  key={ch}
                  onClick={() => setChannelFilter(ch)}
                  className={`px-3 py-2 text-xs font-bold rounded-lg border transition ${
                    channelFilter === ch
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                      : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600"
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>
          )}

          {/* Priority Filter */}
          <div className="flex items-center gap-1.5">
            {["ALL", "URGENT", "HIGH", "NORMAL"].map(p => (
              <button
                key={p}
                onClick={() => setPriorityFilter(p)}
                className={`px-3 py-2 text-xs font-bold rounded-lg border transition ${
                  priorityFilter === p
                    ? p === "URGENT" ? "bg-red-600 text-white border-red-600"
                    : p === "HIGH" ? "bg-orange-500 text-white border-orange-500"
                    : "bg-slate-700 text-white border-slate-700"
                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"
                }`}
              >
                {p === "ALL" ? "All" : p}
              </button>
            ))}
          </div>
        </div>
        </React.Fragment>
      )}

      {loading ? (
        <TableSkeleton rows={8} cols={5} />
      ) : leads.length === 0 ? (
        <EmptyLeads onAction={() => navigate("/dashboard/settings")} />
      ) : filteredLeads.length === 0 ? (
        <div className="bg-white rounded-xl border p-10 text-center">
          <p className="text-slate-400 text-sm">No leads match your filters.</p>
          <button onClick={() => { setSearch(""); setChannelFilter("ALL"); setPriorityFilter("ALL"); }} className="mt-3 text-indigo-500 text-xs font-bold hover:underline">
            Clear filters
          </button>
        </div>
      ) : viewMode === "kanban" ? (
        <LeadsKanban
          leads={filteredLeads}
          onRowClick={(lead: any) => setSelectedLead(lead)}
          onSegmentChange={(leadId, newSegment) => {
            setLeads(prev => prev.map(l => l.id === leadId ? { ...l, segment: newSegment } : l));
          }}
        />
      ) : (
        <LeadsTable
          leads={filteredLeads}
          onRowClick={(lead: any) => setSelectedLead(lead)}
          onClaim={handleClaim}
          onClaimPendingOrder={handleClaimPendingOrder}
          selectedIds={selectedLeads}
          onSelect={handleSelect}
          onSelectAll={handleSelectAll}
          allSelected={selectedLeads.size > 0 && selectedLeads.size === filteredLeads.length}
          currentUser={user ? { id: user.id, role: user.role } : undefined}
        />
      )}

      {/* Floating bulk action bar */}
      <AnimatePresence>
        {selectedLeads.size > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl shadow-slate-900/40 border border-slate-700"
          >
            <CheckSquare size={16} className="text-indigo-400 shrink-0" />
            <span className="text-sm font-black mr-2 min-w-[80px]">
              {selectedLeads.size} selected
            </span>
            <div className="w-px h-5 bg-slate-700 mx-1" />
            <button
              onClick={handleBulkAssign}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl transition active:scale-95"
            >
              <UserCheck size={13} />
              Assign to me
            </button>
            <button
              onClick={() => handleBulkPriority("URGENT")}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded-xl transition active:scale-95"
            >
              <AlertTriangle size={13} />
              Mark Urgent
            </button>
            <button
              onClick={() => handleBulkPriority("HIGH")}
              className="text-xs font-bold px-3 py-1.5 bg-orange-600 hover:bg-orange-500 rounded-xl transition active:scale-95"
            >
              High Priority
            </button>
            <div className="w-px h-5 bg-slate-700 mx-1" />
            <button
              onClick={clearSelection}
              className="text-xs font-bold text-slate-400 hover:text-white px-2 py-1.5 rounded-xl transition"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lead Detail Drawer */}
      <LeadDrawer lead={selectedLead} onClose={() => setSelectedLead(null)} />
    </PageTransition>
  );
}
