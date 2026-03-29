import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { api } from "../../lib/api";
import { getIndustryConfig } from "../../utils/industryConfig";
import { Trash2, Package, X } from "lucide-react";
import toast from "react-hot-toast";
import { PageTransition } from "../../components/ui/Animations";
import { EmptyOrders } from "../../components/ui/EmptyState";

// --- Types ---
interface Order {
  id: string;
  summary: string;
  status: string;
  approvalStatus: string;
  amount: number;
  priorityScore: number;
  isUrgent: boolean;
  lead: {
    name: string;
    contact: string;
    segment: string;
    totalSpend: number;
    channel: string;
  };
  processedBy?: { 
    id: string; 
    name: string; 
  };
  createdAt: string;
  completedAt?: string;
  version: number;
  invoice?: {
    pdfUrl: string;
    invoiceNumber: string;
  };
}

export default function Orders() {
  const { token, company, isOwner, isAdmin, user } = useAuth();
  const { socket } = useSocket();

  const industry = useMemo(() => getIndustryConfig(company?.botBusinessType), [company]);

  const COLUMN_CONFIG = useMemo(() => [
    { id: "NEW", title: industry.pipelineLabels.new, color: "border-blue-200 bg-blue-50/50", statuses: ["NEW", "PENDING"] },
    { id: "PROCESSING", title: industry.pipelineLabels.processing, color: "border-indigo-200 bg-indigo-50/50", statuses: ["PROCESSING", "CONFIRMED", "PREPARING"] },
    { id: "READY", title: industry.pipelineLabels.ready, color: "border-emerald-200 bg-emerald-50/50", statuses: ["READY"] },
  ], [industry]);

  const [orders, setOrders] = useState<Order[]>([]);
  const [awaitingOrders, setAwaitingOrders] = useState<Order[]>([]);
  const [view, setView] = useState<'active' | 'history' | 'awaiting'>('active');
  const [loading, setLoading] = useState(true);
  const [awaitingLoading, setAwaitingLoading] = useState(false);

  // Modal State
  const [actionOrder, setActionOrder] = useState<Order | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);

  // Invoice preview modal
  const [invoicePreview, setInvoicePreview] = useState<{ url: string; invoiceNumber: string } | null>(null);

  // History Selection State
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [isDeletingBatch, setIsDeletingBatch] = useState(false);

  // Fetch Orders
  const fetchOrders = async (currentView: string) => {
    try {
      setLoading(true);
      const data = await api.get(`/orders?view=${currentView}&t=${Date.now()}`);
      if (currentView === view) setOrders(data);
    } catch (err) {
      console.error("Failed to load orders", err);
    } finally {
      if (currentView === view) setLoading(false);
    }
  };

  // Fetch Awaiting Orders
  const fetchAwaitingOrders = async () => {
    try {
      setAwaitingLoading(true);
      const data = await api.get(`/orders/awaiting?t=${Date.now()}`);
      setAwaitingOrders(data);
    } catch (err) {
      console.error("Failed to load awaiting orders", err);
    } finally {
      setAwaitingLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    setOrders([]);
    if (view === 'awaiting') {
      fetchAwaitingOrders();
    } else {
      fetchOrders(view);
    }
  }, [token, view]);

  // Real-Time Listener
  useEffect(() => {
    if (!socket) return;

    const RANKS: Record<string, number> = {
      'BOT_CREATED_ORDER': 0, 'PENDING': 1, 'NEW': 1, 'CONFIRMED': 2, 'PROCESSING': 3,
      'PREPARING': 4, 'READY': 5, 'SHIPPED': 6, 'DELIVERED': 7,
      'COMPLETED': 8, 'CANCELLED': 9, 'REJECTED': 9, 'ARCHIVED': 10
    };
    const TERMINAL = ['DELIVERED', 'COMPLETED', 'CANCELLED', 'REJECTED', 'ARCHIVED', 'SHIPPED'];

    const handleUpdate = (updated: Order) => {
      const status = (updated.status || "NEW").toUpperCase();
      const isTerminal = TERMINAL.includes(status);

      setOrders(prev => {
        const index = prev.findIndex(o => o.id === updated.id);

        if (view === 'active') {
          if (isTerminal) return prev.filter(o => o.id !== updated.id);

          if (index === -1) {
            // Re-addition guard
            const isGenuinelyNew = ['NEW', 'PENDING', 'BOT_CREATED_ORDER'].includes(status);
            if (isGenuinelyNew) return [updated, ...prev];
            return prev;
          }

          // Regression guard
          const currentRank = RANKS[prev[index].status.toUpperCase()] || 0;
          const newRank = RANKS[status] || 0;
          if (newRank < currentRank) return prev;

          const next = [...prev];
          next[index] = updated;
          return next;
        } else {
          // History View
          if (!isTerminal) return prev.filter(o => o.id !== updated.id);
          if (index === -1) return [updated, ...prev];

          const next = [...prev];
          next[index] = updated;
          return next;
        }
      });

      // Update awaiting orders if in that view
      if (view === 'awaiting') {
        setAwaitingOrders(prev => {
          const index = prev.findIndex(o => o.id === updated.id);
          const isAwaitingStatus = ['BOT_CREATED_ORDER', 'PENDING'].includes(status);
          
          if (!isAwaitingStatus) {
            // Remove from awaiting if no longer awaiting
            return prev.filter(o => o.id !== updated.id);
          }
          
          if (index === -1) {
            // Add to awaiting if new awaiting order
            return [updated, ...prev];
          }
          
          // Update existing
          const next = [...prev];
          next[index] = updated;
          return next;
        });
      }
    };

    const handleCreate = (newOrder: Order) => {
      const status = (newOrder.status || "NEW").toUpperCase();
      const isTerminal = TERMINAL.includes(status);

      if (view === 'active' && !isTerminal) {
        setOrders(prev => {
          if (prev.some(o => o.id === newOrder.id)) return prev;
          return [newOrder, ...prev];
        });
      }

      // Add to awaiting orders if it's an awaiting order
      if (view === 'awaiting' && ['BOT_CREATED_ORDER', 'PENDING'].includes(status)) {
        setAwaitingOrders(prev => {
          if (prev.some(o => o.id === newOrder.id)) return prev;
          return [newOrder, ...prev];
        });
      }
    };

    socket.on("order_created", handleCreate);
    socket.on("order_updated", handleUpdate);
    return () => {
      socket.off("order_created", handleCreate);
      socket.off("order_updated", handleUpdate);
    };
  }, [socket, view]);

  // Actions
  const handleClaimOrder = async (orderId: string) => {
    try {
      const orderToUpdate = awaitingOrders.find(o => o.id === orderId);
      if (!orderToUpdate) return;

      // Optimistic update
      setAwaitingOrders(prev => prev.map(o => 
        o.id === orderId 
          ? { ...o, processedBy: { id: user?.id || '', name: user?.name || 'Agent' }, status: 'PENDING' }
          : o
      ));

      await api.post(`/orders/${orderId}/claim`, { version: orderToUpdate.version });
      toast.success("Order claimed successfully!");
      
      // Refresh awaiting orders
      fetchAwaitingOrders();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Failed to claim order");
      fetchAwaitingOrders(); // Revert optimistic update
    }
  };

  const handleConfirmAction = async () => {
    if (!actionOrder || !actionType) return;
    const orderId = actionOrder.id;
    const type = actionType;

    // Optimistic Update
    setOrders(prev => prev.filter(o => {
      if (view === 'active' && type === 'reject' && o.id === orderId) return false;
      return true;
    }));

    setActionOrder(null);
    setActionType(null);

    try {
      if (type === 'approve') {
        await api.post(`/orders/${orderId}/approve`, { version: actionOrder.version });
      } else {
        await api.post(`/orders/${orderId}/reject`, { version: actionOrder.version });
      }
      toast.success(type === 'approve' ? "Order Accepted" : "Order Rejected");
    } catch (e: any) {
      if (e.response?.status === 409) {
        toast.error("Order updated by another agent. Refreshing...");
        fetchOrders(view);
      } else {
        toast.error("Action failed");
        fetchOrders(view); // Revert optimistic
      }
    }
  };

  const handleMoveStatus = async (id: string, status: string) => {
    const orderToUpdate = orders.find(o => o.id === id);
    if (!orderToUpdate) return;

    const oldOrders = [...orders];
    const nextVersion = (orderToUpdate.version || 0) + 1;
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status, version: nextVersion } : o));

    const TERMINAL = ['DELIVERED', 'COMPLETED', 'CANCELLED', 'REJECTED', 'ARCHIVED'];
    if (view === 'active' && TERMINAL.includes(status.toUpperCase())) {
      setOrders(prev => prev.filter(o => o.id !== id));
    }

    try {
      await api.patch(`/orders/${id}/status`, { status, version: orderToUpdate.version });
    } catch (e: any) {
      console.error(e);
      setOrders(oldOrders);
      if (e.response?.status === 409) {
        toast.error("Concurrency Conflict. Refreshing...");
        fetchOrders(view);
      } else if (e.response?.status === 400) {
        toast.error(e.response.data.message || "Invalid status transition");
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to archive this order?")) return;
    try {
      await api.delete(`/orders/${id}`);
      setOrders(prev => prev.filter(o => o.id !== id));
      setSelectedOrders(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.success("Order Archived");
    } catch (e) {
      toast.error("Failed to archive");
    }
  };

  const handleBatchDelete = async () => {
    if (selectedOrders.size === 0) return;
    if (!confirm(`Are you sure you want to archive ${selectedOrders.size} orders?`)) return;

    setIsDeletingBatch(true);
    const toastId = toast.loading(`Archiving ${selectedOrders.size} orders...`);

    try {
      // Assuming backend supports batch delete or we do it sequentially
      // For now, let's do it sequentially to match existing API
      await Promise.all(Array.from(selectedOrders).map(id => api.delete(`/orders/${id}`)));

      setOrders(prev => prev.filter(o => !selectedOrders.has(o.id)));
      setSelectedOrders(new Set());
      toast.success(`${selectedOrders.size} orders archived`, { id: toastId });
    } catch (e) {
      toast.error("Failed to archive some orders", { id: toastId });
    } finally {
      setIsDeletingBatch(false);
    }
  };

  const toggleSelectOrder = (id: string) => {
    setSelectedOrders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (ids: string[]) => {
    if (selectedOrders.size === ids.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(ids));
    }
  };

  const activeOrdersCount = useMemo(() => orders.filter(o =>
    !['DELIVERED', 'COMPLETED', 'CANCELLED', 'REJECTED', 'ARCHIVED', 'SHIPPED'].includes(o.status.toUpperCase())
  ).length, [orders]);

  const revenueToday = useMemo(() => orders
    .filter(o => !['CANCELLED', 'REJECTED', 'ARCHIVED'].includes(o.status.toUpperCase()))
    .reduce((acc, o) => acc + (o.amount || 0), 0), [orders]);

  // Group History
  const groupedOrders = useMemo(() => {
    if (view !== 'history') return {};
    const groups: Record<string, Order[]> = { 'Today': [], 'Yesterday': [], 'This Week': [], 'Older': [] };

    orders.forEach(order => {
      const date = new Date(order.completedAt || order.createdAt);
      const today = new Date();
      const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);

      if (date.toDateString() === today.toDateString()) groups['Today'].push(order);
      else if (date.toDateString() === yesterday.toDateString()) groups['Yesterday'].push(order);
      else if (today.getTime() - date.getTime() < 7 * 24 * 60 * 60 * 1000) groups['This Week'].push(order);
      else groups['Older'].push(order);
    });
    return groups;
  }, [orders, view]);

  return (
    <PageTransition className="h-[calc(100vh-6rem)] flex flex-col gap-4 lg:gap-6 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 flex-shrink-0">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4 w-full md:w-auto">
          <StatCard title={view === 'active' ? "Active Pipeline" : "Total Revenue"} value={`₹${revenueToday.toLocaleString()}`} icon="💰" />
          <StatCard title="Orders" value={view === 'active' ? activeOrdersCount : orders.length} icon="📦" />
        </div>
        <div className="flex items-center gap-2 self-end">
          {view === 'history' && (isOwner || isAdmin) && selectedOrders.size > 0 && (
            <button
              onClick={handleBatchDelete}
              disabled={isDeletingBatch}
              className="flex items-center gap-2 px-3 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition shadow-lg text-xs font-bold"
            >
              <Trash2 size={14} />
              Archive ({selectedOrders.size})
            </button>
          )}
          <div className="bg-slate-100 p-1 rounded-lg flex">
            <button onClick={() => setView('active')} className={`px-3 lg:px-4 py-1.5 rounded-md text-xs lg:text-sm font-medium transition ${view === 'active' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>Live Board</button>
            <button onClick={() => setView('awaiting')} className={`px-3 lg:px-4 py-1.5 rounded-md text-xs lg:text-sm font-medium transition ${view === 'awaiting' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>Awaiting Orders</button>
            <button onClick={() => setView('history')} className={`px-3 lg:px-4 py-1.5 rounded-md text-xs lg:text-sm font-medium transition ${view === 'history' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>History</button>
          </div>
        </div>
      </div>

      {loading || (view === 'awaiting' && awaitingLoading) ? (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-3 animate-pulse">
              <div className="h-5 bg-slate-200 rounded w-1/3 mb-4" />
              {[1, 2].map(j => (
                <div key={j} className="bg-white p-4 rounded-xl border border-slate-100 space-y-2">
                  <div className="h-4 bg-slate-200 rounded w-1/4" />
                  <div className="h-3 bg-slate-200 rounded w-3/4" />
                  <div className="h-3 bg-slate-200 rounded w-1/2" />
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : view === 'awaiting' ? (
        <div className="flex-1 overflow-y-auto">
          {awaitingOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="h-20 w-20 bg-amber-50 rounded-2xl flex items-center justify-center mb-4">
                <Package className="h-10 w-10 text-amber-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">No Awaiting Orders</h3>
              <p className="text-slate-400 max-w-sm">AI-detected orders that need agent review will appear here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {awaitingOrders.map(order => (
                <AwaitingOrderCard 
                  key={order.id} 
                  order={order} 
                  onClaim={() => handleClaimOrder(order.id)}
                  currentUser={user?.id}
                />
              ))}
            </div>
          )}
        </div>
      ) : view === 'active' ? (
        orders.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyOrders />
          </div>
        ) : (
          <>
            {/* Desktop Kanban */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden hidden md:block">
              <div className="h-full flex gap-4 min-w-[900px]">
            {COLUMN_CONFIG.map(col => (
              <div key={col.id} className={`flex-1 flex flex-col rounded-xl border ${col.color} p-3`}>
                <h3 className="font-bold text-slate-700 mb-3 flex justify-between items-center text-sm">
                  {col.title}
                  <span className="bg-white/50 px-2 py-0.5 rounded text-[10px] tabular-nums">
                    {orders.filter(o => col.statuses.includes((o.status || "").toUpperCase())).length}
                  </span>
                </h3>
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                  {orders.filter(o => col.statuses.includes((o.status || "").toUpperCase())).map(order => (
                    <OrderCard key={order.id} order={order} onApprove={() => { setActionOrder(order); setActionType('approve'); }} onReject={() => { setActionOrder(order); setActionType('reject'); }} onMove={(s: string) => handleMoveStatus(order.id, s)} onPreviewInvoice={(url: string, num: string) => setInvoicePreview({ url, invoiceNumber: num })} />
                  ))}
                  {orders.filter(o => col.statuses.includes((o.status || "").toUpperCase())).length === 0 && (
                    <div className="h-40 flex items-center justify-center text-slate-400 text-xs italic border-2 border-dashed border-slate-200/50 rounded-xl">No orders</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

            {/* Mobile Stacked View */}
            <div className="flex-1 overflow-y-auto md:hidden space-y-4">
              {COLUMN_CONFIG.map(col => {
                const colOrders = orders.filter(o => col.statuses.includes((o.status || "").toUpperCase()));
                if (colOrders.length === 0) return null;
                return (
                  <div key={col.id} className={`rounded-xl border ${col.color} p-3`}>
                    <h3 className="font-bold text-slate-700 mb-3 flex justify-between items-center text-sm">
                      {col.title}
                      <span className="bg-white/50 px-2 py-0.5 rounded text-[10px] tabular-nums">{colOrders.length}</span>
                    </h3>
                    <div className="space-y-3">
                      {colOrders.map(order => (
                        <OrderCard key={order.id} order={order} onApprove={() => { setActionOrder(order); setActionType('approve'); }} onReject={() => { setActionOrder(order); setActionType('reject'); }} onMove={(s: string) => handleMoveStatus(order.id, s)} onPreviewInvoice={(url: string, num: string) => setInvoicePreview({ url, invoiceNumber: num })} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )
      ) : (
        <div className="bg-white rounded-xl shadow border overflow-hidden flex-1 overflow-y-auto">
          {Object.entries(groupedOrders).map(([label, group]) => group.length > 0 && (
            <div key={label}>
              <div className="bg-slate-50 px-6 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider sticky top-0 z-10 border-b border-t border-slate-200 flex items-center gap-4">
                {(isOwner || isAdmin) && (
                  <input
                    type="checkbox"
                    checked={group.every(o => selectedOrders.has(o.id))}
                    onChange={() => toggleSelectAll(group.map(o => o.id))}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 pointer-events-auto"
                  />
                )}
                {label} ({group.length})
              </div>
              <table className="min-w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {group.map(order => (
                    <tr key={order.id} className={`hover:bg-indigo-50/30 transition ${selectedOrders.has(order.id) ? 'bg-indigo-50/50' : ''}`}>
                      <td className="px-6 py-4 w-10">
                        {(isOwner || isAdmin) && (
                          <input
                            type="checkbox"
                            checked={selectedOrders.has(order.id)}
                            onChange={() => toggleSelectOrder(order.id)}
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 pointer-events-auto"
                          />
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-500 w-32">
                        {new Date(order.completedAt || order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-800">
                        {order.lead?.name || 'Unknown'}
                        <div className="text-[10px] text-slate-400">{order.lead?.contact}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 line-clamp-1 max-w-[200px]">{order.summary}</td>
                      <td className="px-6 py-4 font-bold text-slate-900">₹{order.amount}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={order.status} />
                          {order.status.toUpperCase() === "SHIPPED" && (
                            <button
                              onClick={() => handleMoveStatus(order.id, "DELIVERED")}
                              className="text-[10px] bg-slate-800 text-white px-2 py-1 rounded hover:bg-slate-700 transition font-bold"
                            >
                              Complete
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {order.invoice?.pdfUrl ? (
                          <button
                            onClick={() => setInvoicePreview({ url: order.invoice!.pdfUrl, invoiceNumber: order.invoice!.invoiceNumber })}
                            className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 font-bold group"
                          >
                            <span className="bg-indigo-50 p-1.5 rounded-lg group-hover:bg-indigo-100 transition">📄</span>
                            <div className="flex flex-col">
                              <span className="text-[10px] uppercase tracking-tighter text-slate-400">Invoice</span>
                              <span className="text-xs">{order.invoice.invoiceNumber}</span>
                            </div>
                          </button>
                        ) : (
                          <span className="text-slate-300 italic text-xs">Not Paid</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {(isOwner || isAdmin) && (
                          <button onClick={() => handleDelete(order.id)} className="p-2 text-slate-400 hover:text-rose-600 transition">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {orders.length === 0 && (
            <div className="p-10 flex flex-col items-center justify-center">
              <Package className="h-10 w-10 text-slate-300 mb-3" />
              <p className="text-slate-400 font-medium">No completed orders yet.</p>
            </div>
          )}
        </div>
      )}

      {/* --- MODAL --- */}
      <AnimatePresence>
        {actionOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setActionOrder(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative z-10">
              <div className={`h-2 w-full ${actionType === 'approve' ? 'bg-green-500' : 'bg-red-500'}`} />
              <div className="p-6">
                <h3 className="text-xl font-bold text-slate-900 mb-2">{actionType === 'approve' ? 'Accept Order?' : 'Reject Order?'}</h3>
                <p className="text-slate-600 mb-6">{actionType === 'approve' ? `Accept order for ₹${actionOrder.amount}?` : `Reject this order?`}</p>
                <div className="flex gap-3 justify-end">
                  <button onClick={() => setActionOrder(null)} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg">Cancel</button>
                  <button onClick={handleConfirmAction} className={`px-6 py-2 text-white font-bold rounded-lg shadow-lg ${actionType === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>Confirm</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Invoice Preview Modal */}
      <AnimatePresence>
        {invoicePreview && (
          <div
            className="fixed inset-0 z-50 flex flex-col"
            onKeyDown={e => e.key === "Escape" && setInvoicePreview(null)}
            tabIndex={-1}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setInvoicePreview(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 16 }}
              transition={{ type: "spring", stiffness: 340, damping: 28 }}
              className="relative z-10 flex flex-col m-4 md:m-8 bg-white rounded-2xl shadow-2xl overflow-hidden flex-1"
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📄</span>
                  <span className="font-bold text-slate-800">{invoicePreview.invoiceNumber}</span>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={invoicePreview.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition"
                  >
                    Open in new tab ↗
                  </a>
                  <button
                    onClick={() => setInvoicePreview(null)}
                    className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
              {/* PDF iframe */}
              <iframe
                src={invoicePreview.url}
                className="w-full flex-1 border-0"
                title="Invoice Preview"
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
}

function OrderCard({ order, onApprove, onReject, onMove, onPreviewInvoice }: any) {
  const currentStatus = (order.status || "").toUpperCase();
  const isNew = currentStatus === "NEW" || currentStatus === "PENDING" || currentStatus === "BOT_CREATED_ORDER";
  const isUrgent = order.isUrgent || order.priorityScore > 50;

  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className={`bg-white p-4 rounded-xl shadow-sm border border-slate-200 relative group ${isUrgent ? "ring-2 ring-red-100" : ""}`}>
      <div className="flex justify-between items-start mb-2">
        <span className="font-bold text-indigo-600">₹{order.amount}</span>
        <span className="text-[10px] text-slate-400 font-mono">{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      <h4 className="font-semibold text-slate-800 text-sm leading-tight mb-3">{order.summary}</h4>
      <div className="flex justify-between items-center mb-3">
        <div className="text-xs text-slate-500">👤 {order.lead?.name}</div>
        {order.invoice?.pdfUrl && (
          <button
            onClick={e => { e.stopPropagation(); onPreviewInvoice?.(order.invoice.pdfUrl, order.invoice.invoiceNumber); }}
            title="Preview Invoice"
            className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded hover:bg-indigo-100 transition font-bold flex items-center gap-1"
          >
            📄 Invoice
          </button>
        )}
      </div>
      <OrderTimeline status={currentStatus} />
      {isNew ? (
        <div className="grid grid-cols-2 gap-2 mt-3">
          <button onClick={onReject} className="px-3 py-2 rounded-lg border border-red-200 text-red-600 text-xs font-bold hover:bg-red-50 transition">Reject</button>
          <button onClick={onApprove} className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 shadow-md transition">Accept</button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 mt-3">
          {(currentStatus === "PROCESSING" || currentStatus === "CONFIRMED") && (
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => onMove("CANCELLED")} className="text-[10px] text-red-500 font-bold hover:underline">Cancel</button>
              <button onClick={() => onMove("PREPARING")} className="flex-1 text-xs bg-indigo-50 text-indigo-700 px-3 py-2 rounded font-semibold hover:bg-indigo-100 italic">Start Prep</button>
            </div>
          )}
          {currentStatus === "PREPARING" && (
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => onMove("CANCELLED")} className="text-[10px] text-red-500 font-bold hover:underline">Cancel</button>
              <button onClick={() => onMove("READY")} className="flex-1 text-xs bg-emerald-50 text-emerald-700 px-3 py-2 rounded font-semibold hover:bg-emerald-100">Mark Ready</button>
            </div>
          )}
          {currentStatus === "READY" && (
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => onMove("CANCELLED")} className="text-[10px] text-red-500 font-bold hover:underline">Cancel</button>
              <button onClick={() => onMove("SHIPPED")} className="flex-1 text-xs bg-amber-50 text-amber-700 px-3 py-2 rounded font-semibold hover:bg-amber-100 italic font-bold">Deliver Now</button>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    DELIVERED: "bg-emerald-100 text-emerald-700",
    CANCELLED: "bg-red-100 text-red-700",
    REJECTED: "bg-red-100 text-red-700",
    NEW: "bg-blue-100 text-blue-700",
    CONFIRMED: "bg-indigo-100 text-indigo-700",
    COMPLETED: "bg-emerald-100 text-emerald-700",
    SHIPPED: "bg-amber-100 text-amber-700",
    PROCESSING: "bg-indigo-100 text-indigo-700",
    PREPARING: "bg-indigo-100 text-indigo-700"
  };
  return <span className={`px-2 py-1 rounded text-xs font-bold ${styles[status] || "bg-slate-100 text-slate-600"}`}>{status}</span>;
}

// ─── Order Status Timeline ───────────────────────────────────────────────────
const TIMELINE_STEPS = [
  { key: "NEW",        label: "New",      icon: "📋" },
  { key: "PROCESSING", label: "Accepted", icon: "✅" },
  { key: "PREPARING",  label: "Preparing",icon: "👨‍🍳" },
  { key: "READY",      label: "Ready",    icon: "📦" },
  { key: "SHIPPED",    label: "Shipped",  icon: "🚚" },
  { key: "DELIVERED",  label: "Done",     icon: "🎉" },
];

const STATUS_RANK: Record<string, number> = {
  BOT_CREATED_ORDER: -1, PENDING: 0, NEW: 0,
  CONFIRMED: 1, PROCESSING: 1,
  PREPARING: 2, READY: 3, SHIPPED: 4,
  DELIVERED: 5, COMPLETED: 5,
};

function OrderTimeline({ status }: { status: string }) {
  const cancelled = ["CANCELLED", "REJECTED", "ARCHIVED"].includes(status.toUpperCase());
  const currentRank = STATUS_RANK[status.toUpperCase()] ?? 0;

  if (cancelled) {
    return (
      <div className="mt-3 pt-3 border-t border-slate-100">
        <span className="text-[10px] font-black text-red-500 bg-red-50 border border-red-200 px-2 py-1 rounded-lg uppercase tracking-wider">
          ✕ {status}
        </span>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      <div className="flex items-center justify-between relative">
        {/* Connector line */}
        <div className="absolute left-0 right-0 top-[11px] h-0.5 bg-slate-100 z-0" />
        <div
          className="absolute left-0 top-[11px] h-0.5 bg-indigo-400 z-0 transition-all duration-700"
          style={{ width: `${Math.min(100, (currentRank / (TIMELINE_STEPS.length - 1)) * 100)}%` }}
        />
        {TIMELINE_STEPS.map((step, i) => {
          const done = i < currentRank;
          const active = i === currentRank;
          return (
            <div key={step.key} className="flex flex-col items-center relative z-10 flex-1">
              <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] border-2 transition-all duration-300 ${
                done    ? "bg-indigo-500 border-indigo-500 text-white shadow-md shadow-indigo-200" :
                active  ? "bg-white border-indigo-500 text-indigo-600 shadow-md shadow-indigo-100 scale-110" :
                          "bg-white border-slate-200 text-slate-300"
              }`}>
                {done ? "✓" : step.icon}
              </div>
              {active && (
                <span className="mt-1 text-[8px] font-black text-indigo-600 leading-none text-center whitespace-nowrap">
                  {step.label}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AwaitingOrderCard({ order, onClaim, currentUser }: { 
  order: Order; 
  onClaim: () => void; 
  currentUser?: string; 
}) {
  const isClaimed = order.processedBy?.id === currentUser;
  const isUnclaimed = !order.processedBy;
  const isClaimedByOthers = order.processedBy && order.processedBy.id !== currentUser;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }} 
      animate={{ opacity: 1, scale: 1 }} 
      className={`bg-white p-4 rounded-xl shadow-sm border relative group ${
        isClaimed ? 'border-indigo-200 bg-indigo-50/30' : 
        isUnclaimed ? 'border-amber-200 bg-amber-50/30' : 
        'border-slate-200'
      }`}
    >
      {/* Status Badge */}
      <div className="absolute top-3 right-3">
        {isClaimed && (
          <span className="text-[9px] font-black bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full uppercase">
            Claimed by You
          </span>
        )}
        {isUnclaimed && (
          <span className="text-[9px] font-black bg-amber-100 text-amber-700 px-2 py-1 rounded-full uppercase animate-pulse">
            Unclaimed
          </span>
        )}
        {isClaimedByOthers && (
          <span className="text-[9px] font-black bg-slate-100 text-slate-600 px-2 py-1 rounded-full uppercase">
            Claimed by {order.processedBy?.name}
          </span>
        )}
      </div>

      <div className="flex justify-between items-start mb-3">
        <span className="font-bold text-lg text-slate-900">₹{order.amount}</span>
        <span className="text-[10px] text-slate-400 font-mono">
          {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      <h4 className="font-semibold text-slate-800 text-sm leading-tight mb-3 pr-16">
        {order.summary}
      </h4>

      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span className="font-medium">👤 Customer:</span>
          <span className="font-medium">{order.lead?.name || 'Unknown'}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span className="font-medium">📞 Contact:</span>
          <span className="font-medium">{order.lead?.contact}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span className="font-medium">📱 Channel:</span>
          <span className="font-medium">{order.lead?.channel}</span>
        </div>
        {order.isUrgent && (
          <div className="flex items-center gap-2 text-xs text-red-600 font-bold">
            <span className="h-2 w-2 bg-red-500 rounded-full animate-pulse"></span>
            <span>URGENT ORDER</span>
          </div>
        )}
      </div>

      {/* Action Button */}
      {isUnclaimed && (
        <button
          onClick={onClaim}
          className="w-full py-2 px-4 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition shadow-md active:scale-95"
        >
          Claim Order
        </button>
      )}
      {isClaimed && (
        <div className="w-full py-2 px-4 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-bold text-center border border-indigo-200">
          ✓ Claimed - Move to Live Board to process
        </div>
      )}
      {isClaimedByOthers && (
        <div className="w-full py-2 px-4 rounded-lg bg-slate-100 text-slate-500 text-xs font-medium text-center border border-slate-200">
          Claimed by {order.processedBy?.name}
        </div>
      )}
    </motion.div>
  );
}

function StatCard({ title, value, icon }: any) {
  return (
    <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{title}</p>
        <p className="text-xl font-bold text-slate-800">{value}</p>
      </div>
    </div>
  );
}
