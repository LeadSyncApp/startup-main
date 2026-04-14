import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { motion, AnimatePresence } from 'framer-motion';
import LeadsTable from '../../components/leads/LeadsTable';
import LeadDrawer from '../../components/leads/LeadDrawer';
import SectionSummary from '../../components/dashboard/SectionSummary';
import { api } from '../../lib/api';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { EmptyLeads } from '../../components/ui/EmptyState';
import { PageTransition } from '../../components/ui/Animations';
import { Search, X, CheckSquare, UserCheck, LayoutGrid, List, ShoppingCart, Trash } from 'lucide-react';
import LeadsKanban from '../../components/leads/LeadsKanban';
import toast from 'react-hot-toast';
import Button from '../../components/ui/Button';

export default function Leads() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [searchParams] = useSearchParams();

  const [filter, setFilter] = useState('all');
  const [showNewOrderArrivalsOnly, setShowNewOrderArrivalsOnly] = useState(
    searchParams.get('filter') === 'newOrderArrivals'
  );

  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());

  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const handleSelect = (id: string) => {
    setSelectedLeads((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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

  useEffect(() => {
    if (!token) return;
    fetchLeads();
  }, [token, filter]);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const data = await api.get(`/leads?filter=${filter}`);
      setLeads(data);
    } catch (err) {
      console.error('Failed to fetch leads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!socket) return;

    const onNewLead = (lead: any) => {
      if (filter === 'all' || filter === 'unassigned') {
        setLeads((prev) => [lead, ...prev]);
      }
    };

    const onAssigned = (data: any) => {
      setLeads((prev) =>
        prev
          .map((lead) => {
            if (lead.conversationId === data.conversationId) {
              if (filter === 'unassigned' && data.assignedTo) return null;
              return {
                ...lead,
                agentAssigned: data.assignedTo?.name,
                assignedTo: data.assignedTo,
                status: data.status,
              };
            }
            return lead;
          })
          .filter(Boolean)
      );
    };

    const onLeadUpdated = (data: any) => {
      setLeads((prev) =>
        prev.map((lead) => {
          if (lead.id === data.leadId) {
            return { ...lead, ...data };
          }
          return lead;
        })
      );
    };

    socket.on('lead_created', onNewLead);
    socket.on('conversation_assigned', onAssigned);
    socket.on('lead_updated', onLeadUpdated);

    return () => {
      socket.off('lead_created', onNewLead);
      socket.off('conversation_assigned', onAssigned);
      socket.off('lead_updated', onLeadUpdated);
    };
  }, [socket, filter, user]);

  const handleClaim = async (conversationId: string, e: any) => {
    e.stopPropagation();
    if (!user?.id) return;

    try {
      await api.patch(`/conversations/${conversationId}/assign`, { assignedToId: user.id });
      setLeads((prev) =>
        prev.map((l) =>
          l.conversationId === conversationId
            ? { ...l, agentAssigned: user.name, assignedTo: { id: user.id, name: user.name } }
            : l
        )
      );
      toast.success('Lead claimed!');
    } catch {
      toast.error('Could not claim lead');
    }
  };

  const handleClaimPendingOrder = async (leadId: string, e: any) => {
    e.stopPropagation();
    if (!user?.id) return;

    try {
      await api.post(`/leads/${leadId}/claim-pending-order`);
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId
            ? {
                ...l,
                pendingOrderState: 'CLAIMED_FOR_APPROVAL',
                agentAssigned: user.name,
                assignedTo: { id: user.id, name: user.name },
              }
            : l
        )
      );
      toast.success('Order claimed!');
      setTimeout(() => {
        const lead = leads.find((l) => l.id === leadId);
        if (lead?.conversationId) {
          navigate(`/dashboard/conversations?conversationId=${lead.conversationId}`);
        }
      }, 500);
    } catch {
      toast.error('Could not claim order');
    }
  };

  const handleBulkAssign = async () => {
    if (!user?.id || selectedLeads.size === 0) return;
    const ids = Array.from(selectedLeads);

    try {
      await Promise.all(
        ids.map((id) => {
          const lead = leads.find((l) => l.id === id);
          if (lead?.conversationId) {
            return api.patch(`/conversations/${lead.conversationId}/assign`, { assignedToId: user.id });
          }
          return Promise.resolve();
        })
      );
      setLeads((prev) =>
        prev.map((l) =>
          ids.includes(l.id)
            ? { ...l, agentAssigned: user.name, assignedTo: { id: user.id, name: user.name } }
            : l
        )
      );
      toast.success(`Assigned ${ids.length} leads to you`);
      clearSelection();
    } catch {
      toast.error('Failed to assign some leads');
    }
  };

  const handleBulkPriority = async (priority: string) => {
    if (selectedLeads.size === 0) return;
    const ids = Array.from(selectedLeads);

    try {
      await Promise.all(ids.map((id) => api.patch(`/leads/${id}`, { priority })));
      setLeads((prev) => prev.map((l) => (ids.includes(l.id) ? { ...l, priority } : l)));
      toast.success(`Updated priority for ${ids.length} leads`);
      clearSelection();
    } catch {
      toast.error('Some updates failed');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedLeads.size === 0) return;
    if (!['ADMIN', 'OWNER'].includes(user?.role || '')) {
      toast.error('Only admins can delete leads');
      return;
    }

    const ids = Array.from(selectedLeads);
    const confirmed = window.confirm(`Delete ${ids.length} leads? This cannot be undone.`);
    if (!confirmed) return;

    try {
      await Promise.all(ids.map((id) => api.delete(`/leads/${id}`)));
      setLeads((prev) => prev.filter((l) => !ids.includes(l.id)));
      toast.success(`Deleted ${ids.length} leads`);
      clearSelection();
    } catch {
      toast.error('Failed to delete some leads');
    }
  };

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const matchesSearch =
        !search ||
        lead.name?.toLowerCase().includes(search.toLowerCase()) ||
        lead.contact?.includes(search);
      const matchesChannel = channelFilter === 'ALL' || lead.channel === channelFilter;
      const matchesPriority = priorityFilter === 'ALL' || lead.priority === priorityFilter;
      const matchesNewOrderArrivals =
        !showNewOrderArrivalsOnly || (lead.pendingOrderState && lead.pendingOrderState !== 'NONE');
      return matchesSearch && matchesChannel && matchesPriority && matchesNewOrderArrivals;
    });
  }, [leads, search, channelFilter, priorityFilter, showNewOrderArrivalsOnly]);

  const toggleNewOrderArrivals = (show: boolean) => {
    setShowNewOrderArrivalsOnly(show);
    if (show) {
      navigate('/dashboard/leads?filter=newOrderArrivals', { replace: true });
    } else {
      navigate('/dashboard/leads', { replace: true });
    }
  };

  const channels = useMemo(() => {
    return [...new Set(leads.map((l) => l.channel).filter(Boolean))];
  }, [leads]);

  return (
    <PageTransition className="space-y-4 lg:space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <SectionSummary
          title="Leads CRM"
          description="Manage and convert your sales pipeline"
          stats={[
            { label: 'Total', value: String(leads.length) },
            { label: 'Filtered', value: String(filteredLeads.length) },
          ]}
        />

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* View Toggle */}
          <div className="flex bg-background-tertiary p-1 rounded-lg">
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-md transition ${
                viewMode === 'table'
                  ? 'bg-background-secondary text-accent shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <List size={18} />
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-2 rounded-md transition ${
                viewMode === 'kanban'
                  ? 'bg-background-secondary text-accent shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <LayoutGrid size={18} />
            </button>
          </div>

          {/* Order Toggle */}
          <div className="flex bg-background-tertiary p-1 rounded-lg">
            <button
              onClick={() => toggleNewOrderArrivals(!showNewOrderArrivalsOnly)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md transition text-sm ${
                showNewOrderArrivalsOnly
                  ? 'bg-background-secondary text-accent shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <ShoppingCart size={16} />
              Orders
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-2 rounded-md transition text-sm ${
                filter === 'all' && !showNewOrderArrivalsOnly
                  ? 'bg-background-secondary text-accent shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              All
            </button>
          </div>

          {/* Filter Tabs */}
          {!showNewOrderArrivalsOnly && (
            <div className="flex bg-background-tertiary p-1 rounded-lg">
              {['all', 'me', 'unassigned'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-2 rounded-md transition text-sm capitalize ${
                    filter === f
                      ? 'bg-background-secondary text-accent shadow-sm'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  {f === 'me' ? 'Mine' : f}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      {!loading && leads.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted h-4 w-4" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search leads..."
              className="w-full bg-background-tertiary border border-border rounded-lg py-2.5 pl-10 pr-8 text-text-primary placeholder:text-text-muted focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {channels.length > 1 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {['ALL', ...channels].map((ch) => (
                <button
                  key={ch}
                  onClick={() => setChannelFilter(ch)}
                  className={`px-3 py-2 text-xs font-medium rounded-lg border transition ${
                    channelFilter === ch
                      ? 'bg-accent text-white border-accent'
                      : 'bg-background-tertiary text-text-secondary border-border hover:border-accent/30'
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1.5">
            {['ALL', 'URGENT', 'HIGH', 'NORMAL'].map((p) => (
              <button
                key={p}
                onClick={() => setPriorityFilter(p)}
                className={`px-3 py-2 text-xs font-medium rounded-lg border transition ${
                  priorityFilter === p
                    ? p === 'URGENT'
                      ? 'bg-danger text-white border-danger'
                      : p === 'HIGH'
                      ? 'bg-warning text-white border-warning'
                      : 'bg-accent text-white border-accent'
                    : 'bg-background-tertiary text-text-secondary border-border hover:border-accent/30'
                }`}
              >
                {p === 'ALL' ? 'All' : p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <TableSkeleton rows={8} cols={5} />
      ) : leads.length === 0 ? (
        <EmptyLeads onAction={() => navigate('/dashboard/settings')} />
      ) : filteredLeads.length === 0 ? (
        <div className="bg-background-secondary rounded-xl border border-border p-10 text-center">
          <p className="text-text-muted">No leads match your filters.</p>
          <button
            onClick={() => {
              setSearch('');
              setChannelFilter('ALL');
              setPriorityFilter('ALL');
            }}
            className="mt-3 text-accent text-sm hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : viewMode === 'kanban' ? (
        <LeadsKanban
          leads={filteredLeads}
          onRowClick={(lead: any) => setSelectedLead(lead)}
          onSegmentChange={(leadId, newSegment) => {
            setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, segment: newSegment } : l)));
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

      {/* Bulk Actions */}
      <AnimatePresence>
        {selectedLeads.size > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-background-secondary border border-border text-text-primary px-5 py-3 rounded-2xl shadow-card-elevated"
          >
            <CheckSquare size={16} className="text-accent shrink-0" />
            <span className="text-sm font-medium mr-2">{selectedLeads.size} selected</span>
            <div className="w-px h-5 bg-border mx-1" />
            <Button variant="secondary" size="sm" onClick={handleBulkAssign} leftIcon={<UserCheck size={14} />}>
              Claim
            </Button>
            <Button variant="secondary" size="sm" onClick={() => handleBulkPriority('URGENT')}
              className="text-warning border-warning/20 hover:bg-warning/10"
            >
              Urgent
            </Button>
            <Button variant="secondary" size="sm" onClick={() => handleBulkPriority('HIGH')}
              className="text-emerald-400 border-emerald-400/20 hover:bg-emerald-400/10"
            >
              High
            </Button>
            {['ADMIN', 'OWNER'].includes(user?.role || '') && (
              <Button variant="danger" size="sm" onClick={handleBulkDelete} leftIcon={<Trash size={14} />}>
                Delete
              </Button>
            )}
            <div className="w-px h-5 bg-border mx-1" />
            <button onClick={clearSelection} className="text-text-muted hover:text-text-primary transition-colors">
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drawer */}
      <LeadDrawer lead={selectedLead} onClose={() => setSelectedLead(null)} />
    </PageTransition>
  );
}
