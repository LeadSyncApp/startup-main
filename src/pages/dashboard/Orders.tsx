import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { api } from "../../lib/api";

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
}

// --- Configuration ---
import { getIndustryConfig } from "../../utils/industryConfig";

// ...

export default function Orders() {
  const { token, company } = useAuth(); // Correctly use company from context
  const { socket } = useSocket();

  const industry = useMemo(() => getIndustryConfig(company?.botBusinessType), [company]);

  const COLUMN_CONFIG = useMemo(() => [
    { id: "NEW", title: industry.pipelineLabels.new, color: "border-blue-200 bg-blue-50/50" },
    { id: "PROCESSING", title: industry.pipelineLabels.processing, color: "border-indigo-200 bg-indigo-50/50", statuses: ["CONFIRMED", "PREPARING", "PROCESSING"] },
    { id: "READY", title: industry.pipelineLabels.ready, color: "border-emerald-200 bg-emerald-50/50", statuses: ["READY"] },
  ], [industry]);

  // ... rest of component

  const [orders, setOrders] = useState<Order[]>([]);
  const [view, setView] = useState<'active' | 'history'>('active');
  const [loading, setLoading] = useState(true);

  // Modal State
  const [actionOrder, setActionOrder] = useState<Order | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);

  // Fetch Orders
  const fetchOrders = async (currentView: string) => {
    try {
      setLoading(true);
      // Add timestamp to prevent caching
      const data = await api.get(`/orders?view=${currentView}&t=${Date.now()}`);

      // Additional safety check: Ensure we only set data if view hasn't changed
      if (currentView === view) {
        setOrders(data);
      }
    } catch (err) {
      console.error("Failed to load orders", err);
    } finally {
      if (currentView === view) setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    setOrders([]); // CLEAR STATE immediately on view change
    fetchOrders(view);
  }, [token, view]);

  // Real-Time Listener
  useEffect(() => {
    if (!socket) return;

    const handleUpdate = (updated: Order) => {
      if (view === 'active') {
        // If status became terminal (Delivered/Cancelled), remove it
        if (['DELIVERED', 'CANCELLED', 'REJECTED'].includes(updated.status)) {
          setOrders(prev => prev.filter(o => o.id !== updated.id));
        } else {
          setOrders(prev => {
            const exists = prev.find(o => o.id === updated.id);
            if (exists) return prev.map(o => o.id === updated.id ? updated : o);
            return [updated, ...prev];
          });
        }
      } else {
        // History View: If order became HISTORY, add it?
        if (['DELIVERED', 'CANCELLED', 'REJECTED'].includes(updated.status)) {
          setOrders(prev => {
            const exists = prev.find(o => o.id === updated.id);
            if (exists) return prev.map(o => o.id === updated.id ? updated : o);
            return [updated, ...prev];
          });
        }
      }
    };

    const handleCreate = (newOrder: Order) => {
      if (view === 'active') setOrders(prev => [newOrder, ...prev]);
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

    // Optimistic UI Update
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        if (type === 'approve') return { ...o, status: 'CONFIRMED' }; // Move to Kitchen
        if (type === 'reject') return { ...o, status: 'REJECTED' }; // Will be filtered out
      }
      return o;
    }).filter(o => {
      // If rejected, remove from Active view immediately
      if (view === 'active' && o.id === orderId && type === 'reject') return false;
      return true;
    }));

    setActionOrder(null);
    setActionType(null);

    try {
      if (type === 'approve') {
        await api.post(`/orders/${orderId}/approve`);
      } else {
        await api.post(`/orders/${orderId}/reject`);
      }
    } catch (e) {
      alert("Action failed, refreshing...");
      fetchOrders(view);
    }
  };

  const handleMoveStatus = async (id: string, status: string) => {
    // Optimistic Update
    const oldOrders = [...orders];
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));

    // Remove if moved to final state while in Active view
    if (view === 'active' && ['DELIVERED', 'CANCELLED'].includes(status)) {
      setTimeout(() => {
        setOrders(prev => prev.filter(o => o.id !== id));
      }, 500); // Small delay for animation
    }

    try {
      await api.patch(`/orders/${id}/status`, { status });
    } catch (e) {
      console.error(e);
      setOrders(oldOrders); // Revert on failure
    }
  };

  // Stats
  const revenueToday = useMemo(() => orders
    .filter(o => !['CANCELLED', 'REJECTED'].includes(o.status))
    .reduce((acc, o) => acc + (o.amount || 0), 0), [orders]);

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col gap-6 relative">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 flex-shrink-0">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full md:w-auto">
          <StatCard title={view === 'active' ? "Active Revenue" : "History Revenue"} value={`₹${revenueToday.toLocaleString()}`} icon="💰" />
          <StatCard title="Orders (Visible)" value={orders.length} icon="📦" />
        </div>

        {/* View Toggle */}
        <div className="bg-slate-100 p-1 rounded-lg flex self-end">
          <button
            onClick={() => setView('active')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition ${view === 'active' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}
          >
            Live Board
          </button>
          <button
            onClick={() => setView('history')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition ${view === 'history' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}
          >
            History
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-slate-400">Loading {view === 'active' ? 'Live' : 'History'}...</div>
      ) : view === 'active' ? (
        /* --- KANBAN BOARD --- */
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="h-full flex gap-4 min-w-[1000px]">
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

            {/* Simplified Completed Column Hint */}
            <div className="w-1/5 opacity-60 hover:opacity-100 transition-opacity border-l border-dashed border-slate-300 pl-4 flex flex-col">
              <h3 className="font-bold text-slate-400 mb-3">Completed</h3>
              <div className="text-xs text-slate-400 text-center italic mt-10">
                Visual placeholder. Moved to History.
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* --- HISTORY TABLE --- */
        <div className="bg-white rounded-xl shadow border overflow-hidden flex-1 overflow-y-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-600 font-semibold sticky top-0 bg-slate-50 z-10">
              <tr>
                <th className="px-6 py-3 text-left">Date</th>
                <th className="px-6 py-3 text-left">Wait Time</th>
                <th className="px-6 py-3 text-left">Customer</th>
                <th className="px-6 py-3 text-left">Summary</th>
                <th className="px-6 py-3 text-left">Amount</th>
                <th className="px-6 py-3 text-left">Status</th>
                <th className="px-6 py-3 text-left">Agent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map(order => (
                <tr key={order.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                    {new Date(order.createdAt).toLocaleDateString()} <br />
                    <span className="text-xs opacity-70">{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-xs">
                    {(new Date().getTime() - new Date(order.createdAt).getTime()) > 60000
                      ? Math.floor((new Date().getTime() - new Date(order.createdAt).getTime()) / 60000) + " min"
                      : "Just now"}
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-900">
                    {order.lead?.name || "Guest"}
                    <div className="text-xs text-slate-400">{order.lead?.contact}</div>
                  </td>
                  <td className="px-6 py-4 text-slate-600 truncate max-w-[200px]" title={order.summary}>
                    {order.summary}
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-700">₹{order.amount}</td>
                  <td className="px-6 py-4">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500">
                    {order.processedBy?.name || "-"}
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 opacity-40 italic">
                    No history yet. Delivered orders appear here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* --- MODAL --- */}
      <AnimatePresence>
        {actionOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setActionOrder(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative z-10"
            >
              <div className={`h-2 w-full ${actionType === 'approve' ? 'bg-green-500' : 'bg-red-500'}`} />
              <div className="p-6">
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  {actionType === 'approve' ? 'Accept Order?' : 'Reject Order?'}
                </h3>
                <p className="text-slate-600 mb-6">
                  {actionType === 'approve'
                    ? `Are you sure you want to accept this order for ₹${actionOrder.amount}? This will notify the customer.`
                    : `Are you sure you want to reject this order? This action cannot be undone.`
                  }
                </p>

                <div className="bg-slate-50 p-4 rounded-lg mb-6 text-sm border border-slate-100">
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-500">Customer:</span>
                    <span className="font-medium">{actionOrder.lead.name}</span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-500">Items:</span>
                    <span className="font-medium truncate max-w-[200px]">{actionOrder.summary}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total:</span>
                    <span className="font-bold text-slate-800">₹{actionOrder.amount}</span>
                  </div>
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setActionOrder(null)}
                    className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmAction}
                    className={`px-6 py-2 text-white font-bold rounded-lg shadow-lg transition transform active:scale-95 ${actionType === 'approve'
                      ? 'bg-green-600 hover:bg-green-700 shadow-green-200'
                      : 'bg-red-600 hover:bg-red-700 shadow-red-200'
                      }`}
                  >
                    {actionType === 'approve' ? 'Confirm Accept' : 'Confirm Reject'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

// --- SUB COMPONENTS (UNCHANGED) ---

function OrderCard({ order, onApprove, onReject, onMove }: any) {
  const isNew = order.status === "NEW";
  const isUrgent = order.isUrgent || order.priorityScore > 50;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={`bg-white p-4 rounded-xl shadow-sm border border-slate-200 relative group ${isUrgent ? "ring-2 ring-red-100" : ""}`}
    >
      <div className="flex justify-between items-start mb-2">
        <span className="font-bold text-indigo-600">₹{order.amount}</span>
        <span className="text-[10px] text-slate-400 font-mono">
          {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      <h4 className="font-semibold text-slate-800 text-sm leading-tight mb-3">{order.summary}</h4>
      <div className="text-xs text-slate-500 mb-3 block">
        👤 {order.lead?.name}
      </div>

      {isNew ? (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onReject} className="px-3 py-2 rounded-lg border border-red-200 text-red-600 text-xs font-bold hover:bg-red-50 transition">Reject</button>
          <button onClick={onApprove} className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 shadow-md transition">Accept</button>
        </div>
      ) : (
        <div className="flex gap-2 justify-end">
          {order.status === "CONFIRMED" && (
            <button onClick={() => onMove("PREPARING")} className="w-full text-xs bg-indigo-50 text-indigo-700 px-3 py-2 rounded font-semibold hover:bg-indigo-100">Start Prep</button>
          )}
          {order.status === "PREPARING" && (
            <button onClick={() => onMove("READY")} className="w-full text-xs bg-emerald-50 text-emerald-700 px-3 py-2 rounded font-semibold hover:bg-emerald-100">Mark Ready</button>
          )}
          {order.status === "READY" && (
            <button onClick={() => onMove("DELIVERED")} className="w-full text-xs bg-slate-800 text-white px-3 py-2 rounded font-semibold hover:bg-slate-700">Complete</button>
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
  };
  return (
    <span className={`px-2 py-1 rounded text-xs font-bold ${styles[status] || "bg-slate-100 text-slate-600"}`}>
      {status}
    </span>
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
