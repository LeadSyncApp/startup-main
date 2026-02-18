import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { api } from "../../lib/api";

// CRM Order Interface
interface Order {
  id: string;
  summary: string;
  status: string; // NEW, CONFIRMED, PREPARING, READY, DELIVERED, CANCELLED
  approvalStatus: string;
  amount: number;
  priorityScore: number;
  isUrgent: boolean;
  lead: {
    name: string;
    contact: string;
    segment: string; // VIP, NEW, etc.
    totalSpend: number;
  };
  processedBy?: { name: string };
  createdAt: string;
}

const COLUMN_CONFIG = [
  { id: "NEW", title: "New Requests", color: "border-blue-200 bg-blue-50/50" },
  { id: "PROCESSING", title: "In Kitchen / Processing", color: "border-indigo-200 bg-indigo-50/50", statuses: ["CONFIRMED", "PREPARING"] },
  { id: "READY", title: "Ready for Pickup", color: "border-emerald-200 bg-emerald-50/50", statuses: ["READY"] },
  { id: "COMPLETED", title: "Completed", color: "border-slate-200 bg-slate-50/50", statuses: ["DELIVERED"] },
];

export default function Orders() {
  const { token } = useAuth();
  const { socket } = useSocket();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Initial Fetch
  useEffect(() => {
    if (!token) return;
    const fetchOrders = async () => {
      try {
        const data = await api.get("/orders");
        setOrders(data);
      } catch (err) {
        console.error("Failed to load orders", err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, [token]);

  // Real-Time Listener
  useEffect(() => {
    if (!socket) return;

    const handleCreate = (newOrder: Order) => {
      setOrders(prev => [newOrder, ...prev]);
    };

    const handleUpdate = (updated: Order) => {
      setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
    };

    socket.on("order_created", handleCreate);
    socket.on("order_updated", handleUpdate);

    return () => {
      socket.off("order_created", handleCreate);
      socket.off("order_updated", handleUpdate);
    };
  }, [socket]);

  // Actions
  const handleApprove = async (id: string) => {
    try {
      await api.post(`/orders/${id}/approve`);
    } catch (e) { alert("Failed to approve"); }
  };

  const handleReject = async (id: string) => {
    if (!confirm("Reject this order?")) return;
    try {
      await api.post(`/orders/${id}/reject`);
    } catch (e) { alert("Failed to reject"); }
  };

  const handleMoveStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/orders/${id}/status`, { status });
    } catch (e) { console.error(e); }
  };

  // Derived State
  const revenueToday = useMemo(() => orders
    .filter(o => o.status !== "CANCELLED" && new Date(o.createdAt).toDateString() === new Date().toDateString())
    .reduce((acc, o) => acc + (o.amount || 0), 0), [orders]);

  const pendingCount = orders.filter(o => o.status === "NEW").length;
  const urgentCount = orders.filter(o => o.isUrgent || o.priorityScore > 50).length;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400 animate-pulse">
        Loading Live Operations Center...
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col gap-6">

      {/* Header Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 flex-shrink-0">
        <StatCard title="Revenue Today" value={`₹${revenueToday.toLocaleString()}`} icon="💰" />
        <StatCard title="Pending" value={pendingCount} icon="⏳" highlight={pendingCount > 0} />
        <StatCard title="Urgent" value={urgentCount} icon="🔥" warn={urgentCount > 0} />
        <StatCard title="Total Active" value={orders.filter(o => o.status !== "DELIVERED" && o.status !== "CANCELLED").length} icon="📦" />
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="h-full flex gap-4 min-w-[1000px]">
          {COLUMN_CONFIG.map(col => (
            <div key={col.id} className={`flex-1 flex flex-col rounded-xl border ${col.color} p-3`}>
              <h3 className="font-bold text-slate-700 mb-3 flex justify-between items-center">
                {col.title}
                <span className="bg-white/50 px-2 py-0.5 rounded text-xs">
                  {orders.filter(o => (col.statuses ? col.statuses.includes(o.status) : o.status === col.id)).length}
                </span>
              </h3>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                <AnimatePresence mode="popLayout">
                  {orders
                    .filter(o => (col.statuses ? col.statuses.includes(o.status) : o.status === col.id))
                    .sort((a, b) => b.priorityScore - a.priorityScore) // Sort by Priority
                    .map(order => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        onApprove={() => handleApprove(order.id)}
                        onReject={() => handleReject(order.id)}
                        onMove={(s: string) => handleMoveStatus(order.id, s)}
                      />
                    ))}
                </AnimatePresence>
                {orders.filter(o => (col.statuses ? col.statuses.includes(o.status) : o.status === col.id)).length === 0 && (
                  <div className="text-center py-10 opacity-40 text-sm italic">Empty</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Sub-components
function OrderCard({ order, onApprove, onReject, onMove }: any) {
  const isNew = order.status === "NEW";
  const isUrgent = order.isUrgent || order.priorityScore > 50;
  const isVIP = order.lead?.segment === "VIP" || order.lead?.totalSpend > 5000;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={`bg-white p-4 rounded-xl shadow-sm border border-slate-200 relative group 
                ${isUrgent ? "ring-2 ring-red-100" : ""}
            `}
    >
      {/* Badges */}
      <div className="flex gap-2 mb-2">
        {isUrgent && <span className="bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded">URGENT</span>}
        {isVIP && <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded">VIP</span>}
        <span className="ml-auto text-xs text-slate-400 font-mono">
          {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* Content */}
      <h4 className="font-semibold text-slate-800 text-sm leading-tight mb-1">{order.summary}</h4>
      <div className="flex justify-between items-baseline mb-3">
        <span className="text-xs text-slate-500">{order.lead?.name || "Guest"}</span>
        <span className="font-bold text-slate-900">₹{order.amount}</span>
      </div>

      {/* Actions */}
      {isNew ? (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onReject} className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50">Reject</button>
          <button onClick={onApprove} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-sm">Confirm</button>
        </div>
      ) : (
        // Workflow Buttons
        <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
          {(order.status === "CONFIRMED" || order.status === "NEW") && (
            <button onClick={() => onMove("PREPARING")} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded">Start Prep</button>
          )}
          {order.status === "PREPARING" && (
            <button onClick={() => onMove("READY")} className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded">Mark Ready</button>
          )}
          {order.status === "READY" && (
            <button onClick={() => onMove("DELIVERED")} className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded">Deliver</button>
          )}
        </div>
      )}
    </motion.div>
  );
}

function StatCard({ title, value, icon, highlight, warn }: any) {
  return (
    <div className={`bg-white p-4 rounded-xl border shadow-sm flex items-center gap-3 ${warn ? 'border-red-200 bg-red-50' : highlight ? 'border-blue-200' : 'border-slate-100'}`}>
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-xs text-slate-500 uppercase font-medium">{title}</p>
        <p className={`text-xl font-bold ${warn ? 'text-red-700' : 'text-slate-800'}`}>{value}</p>
      </div>
    </div>
  );
}
