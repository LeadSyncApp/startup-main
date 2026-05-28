import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { motion, AnimatePresence } from "framer-motion";
import LeadsTable from "../../components/leads/LeadsTable";
import LeadDrawer from "../../components/leads/LeadDrawer";
import { api } from "../../lib/api";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { EmptyLeads } from "../../components/ui/EmptyState";
import { PageTransition } from "../../components/ui/Animations";
import { Search, X, AlertTriangle, LayoutGrid, List, ShoppingCart, Activity, DollarSign, Download, Printer, ChevronDown, Calendar, Plus } from "lucide-react";
import LeadsKanban from "../../components/leads/LeadsKanban";
import toast from "react-hot-toast";

// Modularized Components
import MetricsCard from "../../components/leads/MetricsCard";
import TakeOrderModal from "../../components/leads/TakeOrderModal";
import ManualOrderDetailModal from "../../components/leads/ManualOrderDetailModal";
import ManualOrderTable from "../../components/leads/ManualOrderTable";
import BulkActionsPanel from "../../components/leads/BulkActionsPanel.tsx";

const LeadsHeader = ({ totalLeads }: { totalLeads: number }) => (
  <div className="flex flex-col font-sans">
    <h1 className="text-3xl font-bold text-app-text tracking-tight mb-3">Leads CRM</h1>
    <div className="flex items-center gap-3">
      <div className="inline-flex items-center bg-app-surface px-3 py-1.5 rounded-full border border-app shadow-sm">
        <span className="text-sm font-medium text-app-muted">Total Leads</span>
        <span className="ml-2 text-sm font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">{totalLeads}</span>
      </div>
    </div>
  </div>
);

interface TabProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
}

const Tab = ({ label, isActive, onClick }: TabProps) => (
  <button
    onClick={onClick}
    className={`pb-4 px-2 text-sm font-medium transition-colors border-b-2 relative -mb-px whitespace-nowrap ${
      isActive 
        ? "border-blue-600 text-blue-600" 
        : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
    }`}
  >
    {label}
  </button>
);

const IconButton = ({ icon: Icon, onClick, title }: { icon: React.ElementType, onClick?: () => void, title?: string }) => (
  <button
    onClick={onClick}
    title={title}
    className="p-2 text-slate-500 hover:text-slate-700 bg-app-surface border border-app rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 transition-colors"
  >
    <Icon size={16} />
  </button>
);

export default function Leads() {
  const { token, companyId, user } = useAuth();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [searchParams, setSearchParams] = useSearchParams();

  // Manual Entry / High Fidelity Order Creation Form States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [prefCustomerName, setPrefCustomerName] = useState("");
  const [prefPhoneNumber, setPrefPhoneNumber] = useState("");
  const [selectedManualLeadDetail, setSelectedManualLeadDetail] = useState<any | null>(null);

  const [menuCategories, setMenuCategories] = useState<any[]>([]);

  // Fetch Bot Menu configuration for Custom Order auto-calculation
  useEffect(() => {
    if (!token) return;
    const fetchBotMenu = async () => {
      try {
        const res = await api.get("/dashboard/bot-config");
        let parsedMenu = res.company?.botStructuredMenu;
        if (typeof parsedMenu === "string") {
          try {
            parsedMenu = JSON.parse(parsedMenu);
          } catch (e) {
            parsedMenu = null;
          }
        }
        if (parsedMenu && parsedMenu.categories) {
          setMenuCategories(parsedMenu.categories);
        }
      } catch (err) {
        console.error("Failed to read bot menu in Leads:", err);
      }
    };
    fetchBotMenu();
  }, [token]);

  // Listen for create parameter from Dashboard quick actions & Conversations
  useEffect(() => {
    if (searchParams.get("create") === "true") {
      setShowCreateModal(true);
      
      const prefName = searchParams.get("name");
      if (prefName) {
        setPrefCustomerName(decodeURIComponent(prefName));
      }

      const prefPhone = searchParams.get("phone");
      if (prefPhone) {
        setPrefPhoneNumber(decodeURIComponent(prefPhone));
      }

      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("create");
      nextParams.delete("name");
      nextParams.delete("phone");
      setSearchParams(nextParams);
    }
  }, [searchParams]);

  // Filter State for Shared Inbox + Pending Approval toggle
  const [filter, setFilter] = useState(() => {
    // Check for pendingApproval filter in URL
    const urlFilter = searchParams.get('filter');
    return urlFilter === 'pendingApproval' ? 'all' : 'all';
  });
  
  // New Order Arrivals filter flag - now as a separate toggle state
  const [showNewOrderArrivalsOnly, setShowNewOrderArrivalsOnly] = useState(() => {
    return searchParams.get('filter') === 'newOrderArrivals';
  });

  // Drawer & search state
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateRangeFilter, setDateRangeFilter] = useState("ALL");

  // View mode
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");

  // Bulk selection
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSelect = (id: string) => {
    setSelectedLeads(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (filter === "manual") {
      if (selectedLeads.size === filteredManualLeads.length) {
        setSelectedLeads(new Set());
      } else {
        setSelectedLeads(new Set(filteredManualLeads.map((order: any) => order.id)));
      }
    } else {
      if (selectedLeads.size === filteredLeads.length) {
        setSelectedLeads(new Set());
      } else {
        setSelectedLeads(new Set(filteredLeads.map((l: any) => l.id)));
      }
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
  const [manualLeads, setManualLeads] = useState<any[]>([]);
  const [loadingManualLeads, setLoadingManualLeads] = useState(false);

  // Memoized manual leads mapped & filtered for search bar matching
  const filteredManualLeads = useMemo(() => {
    return manualLeads.filter(order => {
      const s = search.toLowerCase();
      if (!s) return true;
      return (
        order.lead?.name?.toLowerCase().includes(s) ||
        order.lead?.contact?.includes(s) ||
        order.summary?.toLowerCase().includes(s) ||
        order.items?.agentName?.toLowerCase().includes(s) ||
        order.items?.city?.toLowerCase().includes(s) ||
        order.items?.state?.toLowerCase().includes(s)
      );
    });
  }, [manualLeads, search]);

  const fetchManualLeads = async () => {
    if (!token) return;
    try {
      setLoadingManualLeads(true);
      const data = await api.get("/orders?view=manual");
      setManualLeads(data);
    } catch (err) {
      console.error("❌ Failed to fetch manual leads:", err);
    } finally {
      setLoadingManualLeads(false);
    }
  };

  const handleViewLeadReport = (order: any) => {
    if (!order || !order.lead) return;
    const originalLead = order.lead;
    const mappedLead = {
      id: originalLead.id,
      name: originalLead.name || "Customer",
      contact: originalLead.contact,
      channel: "MANUAL",
      segment: originalLead.segment || "NEW",
      totalSpend: originalLead.totalSpend || 0,
      orderCount: originalLead.orderCount || 0,
      priority: order.priority || "NORMAL",
      intent: "ORDERING",
      lastMessage: order.summary || "",
      lastActiveAt: originalLead.lastActiveAt || originalLead.createdAt || new Date().toISOString(),
      createdAt: originalLead.createdAt || new Date().toISOString(),
      agentAssigned: order.items?.agentName || order.processedBy?.name || "Agent",
      conversationId: originalLead.conversations?.[0]?.id || null,
    };
    setSelectedLead(mappedLead);
  };

  const fetchLeads = async () => {
    if (!token) return;
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

  useEffect(() => {
    if (filter === "manual") {
      fetchManualLeads();
    } else {
      fetchLeads();
    }
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
      setLeads((prev) => prev.map(lead => {
        if (lead.conversationId === data.conversationId) {
          if (filter === "unassigned" && data.assignedTo) return null;
          if (filter === "me" && data.assignedTo?.id !== user?.id) return null;

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
            suggestedAction: data.pendingOrderState === "PENDING_APPROVAL" ? "Claim order" : 
                           data.pendingOrderState === "CLAIMED_FOR_APPROVAL" ? "Process order" : lead.suggestedAction,
            isExistingCustomer: data.isExistingCustomer,
            previousOrderCount: data.previousOrderCount,
            previousSpend: data.previousSpend,
            previousAgentName: data.previousAgentName,
            previousAgentId: data.previousAgentId
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
      toast.success("Pending order claimed! Opening Orders Board...");
      
      setTimeout(() => {
        navigate(`/dashboard/orders`);
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

  const triggerDelete = () => {
    if (selectedLeads.size === 0) return;
    if (!["ADMIN", "OWNER"].includes(user?.role || "")) {
      toast.error("Only admins and owners can delete leads");
      return;
    }
    setShowDeleteConfirm(true);
  };

  const handleBulkDelete = async () => {
    setShowDeleteConfirm(false);
    if (selectedLeads.size === 0) return;
    
    if (!["ADMIN", "OWNER"].includes(user?.role || "")) {
      toast.error("Only admins and owners can delete leads/orders");
      return;
    }

    const ids = Array.from(selectedLeads);
    const count = ids.length;

    try {
      if (filter === "manual") {
        const results = await Promise.allSettled(
          ids.map(id => api.delete(`/orders/${id}`))
        );
        
        const succeeded = results.filter(r => r.status === "fulfilled").length;
        const failed = results.filter(r => r.status === "rejected").length;
        
        const successfulIds: string[] = [];
        results.forEach((result, index) => {
          if (result.status === "fulfilled") {
            successfulIds.push(ids[index]);
          }
        });
        
        if (successfulIds.length > 0) {
          setManualLeads(prev => prev.filter(o => !successfulIds.includes(o.id)));
        }
        
        if (failed === 0) {
          toast.success(`Deleted ${succeeded} manual order${succeeded !== 1 ? "s" : ""}`);
        } else if (succeeded === 0) {
          toast.error(`Failed to delete any manual orders`);
        } else {
          toast.error(`Deleted ${succeeded} of ${count} manual orders (${failed} failed)`);
        }
      } else {
        const results = await Promise.allSettled(
          ids.map(id => api.delete(`/leads/${id}`))
        );
        
        const succeeded = results.filter(r => r.status === "fulfilled").length;
        const failed = results.filter(r => r.status === "rejected").length;
        
        const successfulIds: string[] = [];
        results.forEach((result, index) => {
          if (result.status === "fulfilled") {
            successfulIds.push(ids[index]);
          }
        });
        
        if (successfulIds.length > 0) {
          setLeads(prev => prev.filter(l => !successfulIds.includes(l.id)));
        }
        
        if (failed === 0) {
          toast.success(`Deleted ${succeeded} lead${succeeded !== 1 ? "s" : ""}`);
        } else if (succeeded === 0) {
          toast.error(`Failed to delete any leads`);
        } else {
          toast.error(`Deleted ${succeeded} of ${count} leads (${failed} failed)`);
        }
      }
      
      clearSelection();
    } catch (error) {
      console.error("Bulk delete error:", error);
      toast.error("Delete operation failed");
    }
  };

  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      // 1. Search Filter
      const matchesSearch = !search ||
        lead.name?.toLowerCase().includes(search.toLowerCase()) ||
        lead.contact?.includes(search);
        
      // 2. Channel Filter
      const matchesChannel = channelFilter === "ALL" || lead.channel === channelFilter;
      
      // 3. Status Filter (integrates priority and standard conversation status)
      const matchesStatus = statusFilter === "ALL" || 
        lead.status?.toUpperCase() === statusFilter.toUpperCase() ||
        lead.priority?.toUpperCase() === statusFilter.toUpperCase();
        
      // 4. Date Range Filter
      let matchesDate = true;
      if (dateRangeFilter !== "ALL") {
        const leadDate = new Date(lead.createdAt || lead.lastActiveAt);
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfYesterday = new Date(startOfToday);
        startOfYesterday.setDate(startOfYesterday.getDate() - 1);
        
        const diffTime = Math.abs(now.getTime() - leadDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (dateRangeFilter === "TODAY") {
          matchesDate = leadDate >= startOfToday;
        } else if (dateRangeFilter === "YESTERDAY") {
          matchesDate = leadDate >= startOfYesterday && leadDate < startOfToday;
        } else if (dateRangeFilter === "LAST_7_DAYS") {
          matchesDate = diffDays <= 7;
        } else if (dateRangeFilter === "LAST_30_DAYS") {
          matchesDate = diffDays <= 30;
        }
      }
      
      // 5. New Order Arrivals Filter
      const matchesNewOrderArrivals = !showNewOrderArrivalsOnly || 
        (lead.pendingOrderState && lead.pendingOrderState !== "NONE");
        
      return matchesSearch && matchesChannel && matchesStatus && matchesDate && matchesNewOrderArrivals;
    });
  }, [leads, search, channelFilter, statusFilter, dateRangeFilter, showNewOrderArrivalsOnly]);

  // Real-time calculated metrics
  const averageAiScore = useMemo(() => {
    if (leads.length === 0) return "0%";
    const total = leads.reduce((sum, l) => sum + (l.aiScore || 0), 0);
    return `${Math.round(total / leads.length)}%`;
  }, [leads]);

  const totalPipelineRevenue = useMemo(() => {
    const sum = leads.reduce((sum, l) => sum + (l.totalSpend || 0), 0);
    if (sum >= 1000) {
      return `₹${(sum / 1000).toFixed(1)}k`;
    }
    return `₹${sum.toLocaleString("en-IN")}`;
  }, [leads]);

  // Sync URL with new order arrivals filter state
  useEffect(() => {
    const currentFilter = searchParams.get('filter');
    const shouldShowNewArrivals = currentFilter === 'newOrderArrivals';
    if (shouldShowNewArrivals !== showNewOrderArrivalsOnly) {
      setShowNewOrderArrivalsOnly(shouldShowNewArrivals);
    }
  }, [searchParams]);

  // Update URL when new order arrivals toggle changes
  const toggleNewOrderArrivals = (show: boolean) => {
    setShowNewOrderArrivalsOnly(show);
    if (show) {
      navigate('/dashboard/leads?filter=newOrderArrivals', { replace: true });
    } else {
      navigate('/dashboard/leads', { replace: true });
    }
  };

  // Clear bulk selection when filters change
  useEffect(() => { setSelectedLeads(new Set()); }, [filter, search, channelFilter, priorityFilter, statusFilter, dateRangeFilter, showNewOrderArrivalsOnly]);

  return (
    <PageTransition className="bg-[#F8FAFC] min-h-screen font-sans">
      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6 md:space-y-8 w-full block">
        {/* 1. Header & Primary Action */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <LeadsHeader totalLeads={leads.length} />
          <div className="flex items-center gap-3">
            {showNewOrderArrivalsOnly && (
              <button
                onClick={() => toggleNewOrderArrivals(false)}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium underline px-2"
              >
                Clear Arrivals Filter
              </button>
            )}
            <button
              id="manual-entry-and-take-order-btn"
              onClick={() => {
                setPrefCustomerName("");
                setPrefPhoneNumber("");
                setShowCreateModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors w-full sm:w-auto justify-center shadow-sm h-10 mt-1 active:scale-95 cursor-pointer"
            >
              <Plus size={16} />
              <span>Manual Entry / Take Order</span>
            </button>
          </div>
        </div>

        {/* 2. Tabs */}
        {!showNewOrderArrivalsOnly && (
          <div className="flex space-x-6 border-b border-app overflow-x-auto font-sans">
            <Tab label="All" isActive={filter === "all"} onClick={() => setFilter("all")} />
            <Tab label="Mine" isActive={filter === "me"} onClick={() => setFilter("me")} />
            <Tab label="Unassigned" isActive={filter === "unassigned"} onClick={() => setFilter("unassigned")} />
            <Tab label="Manual Leads 📋" isActive={filter === "manual"} onClick={() => setFilter("manual")} />
          </div>
        )}

        {/* 3. Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricsCard 
            title="New Order Arrivals" 
            value={leads.filter((l: any) => l.pendingOrderState === "PENDING_APPROVAL").length} 
            description="Last 24 hours" 
            icon={ShoppingCart} 
            iconBgColor="bg-blue-50" 
            iconColor="text-blue-600" 
          />
          <MetricsCard 
            title="High Priority Leads" 
            value={leads.filter((l: any) => l.priority === "URGENT" || l.priority === "HIGH").length} 
            description="Needs immediate action" 
            icon={AlertTriangle} 
            iconBgColor="bg-amber-50" 
            iconColor="text-amber-600" 
          />
          <MetricsCard 
            title="AI Conversion Score" 
            value={averageAiScore} 
            description="Average prediction" 
            icon={Activity} 
            iconBgColor="bg-emerald-50" 
            iconColor="text-emerald-600" 
          />
          <MetricsCard 
            title="Pipeline Revenue" 
            value={totalPipelineRevenue} 
            description="Total potential value" 
            icon={DollarSign} 
            iconBgColor="bg-purple-50" 
            iconColor="text-purple-600" 
          />
        </div>

        {/* 4. CRM Action Toolbar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-app-surface p-2 rounded-xl border border-app shadow-sm">
          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto px-2">
            <div className="relative w-full sm:w-64 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search leads..."
                className="w-full pl-9 pr-8 py-2 text-sm border border-app bg-app-bg rounded-lg focus:outline-none focus:bg-app-surface focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-colors"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                  <X size={13} />
                </button>
              )}
            </div>
            
            {/* Real-time Status Dropdown filter */}
            <div className="relative shrink-0 font-sans">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none flex items-center gap-2 pl-3 pr-8 py-2 text-sm font-medium text-app-muted bg-app-surface border border-app rounded-lg hover:bg-app-bg focus:outline-none focus:ring-2 focus:ring-blue-100 transition-colors cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="OPEN">Open Status</option>
                <option value="ASSIGNED">Assigned Status</option>
                <option value="RESOLVED">Resolved Status</option>
                <option value="SNOOZED">Snoozed Status</option>
                <option value="URGENT">Urgent Priority</option>
                <option value="HIGH">High Priority</option>
                <option value="NORMAL">Normal Priority</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-slate-400">
                <ChevronDown size={14} />
              </div>
            </div>

            {/* Real-time Date Range Dropdown filter */}
            <div className="relative shrink-0 font-sans">
              <select
                value={dateRangeFilter}
                onChange={(e) => setDateRangeFilter(e.target.value)}
                className="appearance-none flex items-center gap-2 pl-8 pr-8 py-2 text-sm font-medium text-app-muted bg-app-surface border border-app rounded-lg hover:bg-app-bg focus:outline-none focus:ring-2 focus:ring-blue-100 transition-colors cursor-pointer"
              >
                <option value="ALL">All Dates</option>
                <option value="TODAY">Today</option>
                <option value="YESTERDAY">Yesterday</option>
                <option value="LAST_7_DAYS">Last 7 Days</option>
                <option value="LAST_30_DAYS">Last 30 Days</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-slate-400">
                <Calendar size={14} />
              </div>
              <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-slate-400">
                <ChevronDown size={14} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 px-2 pb-2 md:pb-0 w-full md:w-auto justify-end">
            <div className="flex bg-slate-100 p-1 rounded-lg mr-2 shrink-0">
              <button
                onClick={() => setViewMode("table")}
                title="Table view"
                className={`p-1.5 rounded transition ${viewMode === "table" ? "bg-app-surface shadow text-blue-600" : "text-slate-400 hover:text-app-muted"}`}
              >
                <List size={16} />
              </button>
              <button
                onClick={() => setViewMode("kanban")}
                title="Kanban view"
                className={`p-1.5 rounded transition ${viewMode === "kanban" ? "bg-app-surface shadow text-blue-600" : "text-slate-400 hover:text-app-muted"}`}
              >
                <LayoutGrid size={16} />
              </button>
            </div>
            <IconButton icon={Download} title="Export" />
            <IconButton icon={Printer} title="Print" />
          </div>
        </div>

        {/* 5. Warning / Active Filter Notice */}
        {!loading && showNewOrderArrivalsOnly && (
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <ShoppingCart size={16} className="text-blue-600" />
            <span className="text-blue-800 font-medium text-sm">
              Showing only new order arrivals - any available agent can claim these orders
            </span>
          </div>
        )}

      {filter === "manual" ? (
        loadingManualLeads ? (
          <TableSkeleton rows={8} cols={8} />
        ) : filteredManualLeads.length === 0 ? (
          <div className="bg-app-surface rounded-[20px] p-12 text-center border border-app shadow-sm font-sans flex flex-col items-center justify-center">
            <div className="p-4 bg-blue-50 text-blue-600 rounded-full mb-4">
              <Plus size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-800 font-sans">No Manual Entries</h3>
            <p className="text-slate-500 mt-2 max-w-sm text-sm font-sans">Create a new manual entry using the "Manual Entry / Take Order" button above to record your first offline lead.</p>
          </div>
        ) : (
          <ManualOrderTable 
            orders={filteredManualLeads}
            selectedLeads={selectedLeads}
            onSelect={handleSelect}
            onSelectAll={handleSelectAll}
            onViewDetailedReport={setSelectedManualLeadDetail}
            onViewLeadReport={handleViewLeadReport}
          />
        )
      ) : loading ? (
        <TableSkeleton rows={8} cols={5} />
      ) : leads.length === 0 ? (
        <EmptyLeads onAction={() => navigate("/dashboard/settings")} />
      ) : filteredLeads.length === 0 ? (
        <div className="bg-app-surface rounded-xl border p-10 text-center font-sans">
          <p className="text-slate-400 text-sm">No leads match your filters.</p>
          <button onClick={() => { setSearch(""); setChannelFilter("ALL"); setPriorityFilter("ALL"); }} className="mt-3 text-indigo-500 text-xs font-bold hover:underline cursor-pointer">
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
      <BulkActionsPanel
        selectedCount={selectedLeads.size}
        filter={filter}
        userRole={user?.role}
        onBulkAssign={handleBulkAssign}
        onBulkPriority={handleBulkPriority}
        onTriggerDelete={triggerDelete}
        onClearSelection={clearSelection}
      />

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm shadow-xl"
              onClick={() => setShowDeleteConfirm(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-app-surface rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden relative z-10 border border-app"
            >
              <div className="h-2 w-full bg-red-500" />
              <div className="p-6">
                <h3 className="text-base font-bold text-app-text mb-1 font-sans text-left">
                  {filter === "manual" ? "Delete Orders?" : "Delete Leads?"}
                </h3>
                <p className="text-xs text-slate-500 leading-normal mb-5 font-sans text-left">
                  Are you sure you want to delete {selectedLeads.size} {filter === "manual" ? "manual order" : "lead"}{selectedLeads.size !== 1 ? 's' : ''}? This action cannot be undone.
                </p>
                <div className="flex gap-2 justify-end font-sans">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-3 py-2 text-slate-500 hover:bg-app-bg rounded-xl text-xs font-bold border border-app cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    className="px-4 py-2 text-white text-xs font-bold rounded-xl shadow-lg bg-red-600 hover:bg-red-700 shadow-red-100 cursor-pointer"
                  >
                    Confirm Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- Take Custom Order / Create Lead Form Modal --- */}
      <TakeOrderModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        user={user}
        menuCategories={menuCategories}
        onSuccess={() => {
          fetchLeads();
          if (filter === "manual") {
            fetchManualLeads();
          }
        }}
        initialCustomerName={prefCustomerName}
        initialPhoneNumber={prefPhoneNumber}
      />

      {/* Manual Entry Detailed View Modal */}
      <ManualOrderDetailModal
        order={selectedManualLeadDetail}
        onClose={() => setSelectedManualLeadDetail(null)}
      />

      {/* Lead Detail Drawer */}
      <LeadDrawer lead={selectedLead} onClose={() => setSelectedLead(null)} />
      </div>
    </PageTransition>
  );
}
