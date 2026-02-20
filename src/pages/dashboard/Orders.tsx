import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { api } from "../../lib/api";
import { getIndustryConfig } from "../../utils/industryConfig";
import { Trash2 } from "lucide-react";
import toast from "react-hot-toast";

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
  };
  processedBy?: { name: string };
  createdAt: string;
  completedAt?: string;
  version: number;
}

export default function Orders() {
  const { token, company } = useAuth();
  const { socket } = useSocket();

  const industry = useMemo(() => getIndustryConfig(company?.botBusinessType), [company]);

  const COLUMN_CONFIG = useMemo(() => [
    { id: "NEW", title: industry.pipelineLabels.new, color: "border-blue-200 bg-blue-50/50", statuses: ["NEW", "PENDING"] },
    { id: "PROCESSING", title: industry.pipelineLabels.processing, color: "border-indigo-200 bg-indigo-50/50", statuses: ["PROCESSING", "CONFIRMED", "PREPARING"] },
    { id: "READY", title: industry.pipelineLabels.ready, color: "border-emerald-200 bg-emerald-50/50", statuses: ["READY"] },
    { id: "DELIVERY", title: industry.pipelineLabels.logistics, color: "border-amber-200 bg-amber-50/50", statuses: ["SHIPPED"] },
  ], [industry]);

  const [orders, setOrders] = useState<Order[]>([]);
  const [view, setView] = useState<'active' | 'history'>('active');
  const [loading, setLoading] = useState(true);

  // Modal State
  const [actionOrder, setActionOrder] = useState<Order | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);

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

  useEffect(() => {
    if (!token) return;
    setOrders([]);
    fetchOrders(view);
  }, [token, view]);

  // Real-Time Listener
  useEffect(() => {
    if (!socket) return;

    const handleUpdate = (updated: Order) => {
      if (view === 'active') {
        // If moved to completed state, remove from active board
        if (['DELIVERED', 'COMPLETED', 'CANCELLED', 'REJECTED', 'ARCHIVED'].includes(updated.status)) {
          setOrders(prev => prev.filter(o => o.id !== updated.id));
        } else {
          // Update or Add (if newly confirmed or moved through pipeline)
          setOrders(prev => {
            const exists = prev.find(o => o.id === updated.id);
            if (exists) return prev.map(o => o.id === updated.id ? updated : o);
            return [updated, ...prev];
          });
        }
      } else {
        // History View: Add if completed
        if (['DELIVERED', 'COMPLETED', 'CANCELLED', 'REJECTED', 'ARCHIVED'].includes(updated.status)) {
          setOrders(prev => {
            const exists = prev.find(o => o.id === updated.id);
            if (exists) return prev.map(o => o.id === updated.id ? updated : o);
            return [updated, ...prev];
          });
        }
      }
    };

    const handleCreate = (newOrder: Order) => {
      if (view === 'active' && ['NEW', 'CONFIRMED', 'PROCESSING', 'PREPARING', 'READY', 'SHIPPED'].includes(newOrder.status)) {
        setOrders(prev => [newOrder, ...prev]);
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
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));

    if (view === 'active' && ['DELIVERED', 'COMPLETED', 'CANCELLED'].includes(status)) {
      setTimeout(() => setOrders(prev => prev.filter(o => o.id !== id)), 500);
    }

    try {
      await api.patch(`/orders/${id}/status`, { status, version: orderToUpdate.version });
    } catch (e: any) {
      console.error(e);
      setOrders(oldOrders);
      if (e.response?.status === 409) {
        toast.error("Order updated by another agent. Refreshing...");
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

  const revenueToday = useMemo(() => orders
    .filter(o => !['CANCELLED', 'REJECTED', 'ARCHIVED'].includes(o.status))
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
    <div className="h-[calc(100vh-6rem)] flex flex-col gap-6 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 flex-shrink-0">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full md:w-auto">
          <StatCard title={view === 'active' ? "Active Pipeline" : "Total Revenue"} value={`₹${revenueToday.toLocaleString()}`} icon="💰" />
          <StatCard title="Orders" value={orders.length} icon="📦" />
        </div>
        <div className="bg-slate-100 p-1 rounded-lg flex self-end">
          <button onClick={() => setView('active')} className={`px-4 py-2 text-sm font-medium rounded-md transition ${view === 'active' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>Live Board</button>
          <button onClick={() => setView('history')} className={`px-4 py-2 text-sm font-medium rounded-md transition ${view === 'history' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>History</button>
        </div>
        {view === 'history' && selectedOrders.size > 0 && (
          <button
            onClick={handleBatchDelete}
            disabled={isDeletingBatch}
            className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition shadow-lg animate-in fade-in slide-in-from-right-2"
          >
            <Trash2 size={16} />
            Archive Selected ({selectedOrders.size})
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-slate-400">Loading...</div>
      ) : view === 'active' ? (
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="h-full flex gap-4 min-w-[1200px]">
            {COLUMN_CONFIG.map(col => (
              <div key={col.id} className={`flex-1 flex flex-col rounded-xl border ${col.color} p-3`}>
                <h3 className="font-bold text-slate-700 mb-3 flex justify-between items-center">
                  {col.title}
                  <span className="bg-white/50 px-2 py-0.5 rounded text-xs opacity-70">
                    {orders.filter(o => (col.statuses ? col.statuses.includes(o.status) : o.status === col.id)).length}
                  </span>
                </h3>
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar pb-10">
                  <AnimatePresence mode="popLayout">
                    {orders
                      .filter(o => (col.statuses ? col.statuses.includes(o.status) : o.status === col.id))
                      .sort((a, b) => b.priorityScore - a.priorityScore)
                      .map(order => (
                        <OrderCard
                          key={order.id}
                          order={order}
                          onApprove={() => { setActionOrder(order); setActionType('approve'); }}
                          onReject={() => { setActionOrder(order); setActionType('reject'); }}
                          onMove={(s: string) => handleMoveStatus(order.id, s)}
                        />
                      ))}
                  </AnimatePresence>
                  {orders.filter(o => (col.statuses ? col.statuses.includes(o.status) : o.status === col.id)).length === 0 && (
                    <div className="text-center py-10 opacity-30 text-sm italic">No orders</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow border overflow-hidden flex-1 overflow-y-auto">
          {Object.entries(groupedOrders).map(([label, group]) => group.length > 0 && (
            <div key={label}>
              <div className="bg-slate-50 px-6 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider sticky top-0 z-10 border-b border-t border-slate-200 flex items-center gap-4">
                <input
                  type="checkbox"
                  checked={group.every(o => selectedOrders.has(o.id))}
                  onChange={() => toggleSelectAll(group.map(o => o.id))}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                />
                {label} ({group.length})
              </div>
              <table className="min-w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {group.map(order => (
                    <tr key={order.id} className={`hover:bg-indigo-50/30 transition ${selectedOrders.has(order.id) ? 'bg-indigo-50/50' : ''}`}>
                      <td className="px-6 py-4 w-10">
                        <input
                          type="checkbox"
                          checked={selectedOrders.has(order.id)}
                          onChange={() => toggleSelectOrder(order.id)}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                        />
                      </td>
                      <td className="px-6 py-4 text-slate-500 w-32">
                        {new Date(order.completedAt || order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-900">
                        {order.lead?.name || "Guest"}
                        <div className="text-xs text-slate-400">{order.lead?.contact}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 truncate max-w-[200px]" title={order.summary}>{order.summary}</td>
                      <td className="px-6 py-4 font-bold text-slate-700">₹{order.amount}</td>
                      <td className="px-6 py-4"><StatusBadge status={order.status} /></td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => handleDelete(order.id)} className="text-slate-400 hover:text-red-500 p-2">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {orders.length === 0 && <div className="p-10 text-center text-slate-400">No history found.</div>}
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
    </div>
  );
}

function OrderCard({ order, onApprove, onReject, onMove }: any) {
  const isNew = order.status === "NEW" || order.status === "PENDING";
  const isUrgent = order.isUrgent || order.priorityScore > 50;

  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className={`bg-white p-4 rounded-xl shadow-sm border border-slate-200 relative group ${isUrgent ? "ring-2 ring-red-100" : ""}`}>
      <div className="flex justify-between items-start mb-2">
        <span className="font-bold text-indigo-600">₹{order.amount}</span>
        <span className="text-[10px] text-slate-400 font-mono">{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      <h4 className="font-semibold text-slate-800 text-sm leading-tight mb-3">{order.summary}</h4>
      <div className="text-xs text-slate-500 mb-3 block">👤 {order.lead?.name}</div>
      {isNew ? (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onReject} className="px-3 py-2 rounded-lg border border-red-200 text-red-600 text-xs font-bold hover:bg-red-50 transition">Reject</button>
          <button onClick={onApprove} className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 shadow-md transition">Accept</button>
        </div>
      ) : (
        <div className="flex gap-2 justify-end">
          {order.status === "PROCESSING" && <button onClick={() => onMove("PREPARING")} className="w-full text-xs bg-indigo-50 text-indigo-700 px-3 py-2 rounded font-semibold hover:bg-indigo-100">Start Prep</button>}
          {order.status === "CONFIRMED" && <button onClick={() => onMove("PREPARING")} className="w-full text-xs bg-indigo-50 text-indigo-700 px-3 py-2 rounded font-semibold hover:bg-indigo-100">Start Prep</button>}
          {order.status === "PREPARING" && <button onClick={() => onMove("READY")} className="w-full text-xs bg-emerald-50 text-emerald-700 px-3 py-2 rounded font-semibold hover:bg-emerald-100">Mark Ready</button>}
          {order.status === "READY" && <button onClick={() => onMove("SHIPPED")} className="w-full text-xs bg-amber-50 text-amber-700 px-3 py-2 rounded font-semibold hover:bg-amber-100">Deliver</button>}
          {order.status === "SHIPPED" && <button onClick={() => onMove("DELIVERED")} className="w-full text-xs bg-slate-800 text-white px-3 py-2 rounded font-semibold hover:bg-slate-700">Complete</button>}
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
