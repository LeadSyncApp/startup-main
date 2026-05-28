import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { api } from "../../lib/api";
import {
  X,
  TrendingUp,
  Users,
  UserCheck
} from "lucide-react";
import { toast } from "react-hot-toast";
import { PageTransition } from "../../components/ui/Animations";
import { Order, OrderStatus } from "../../types";
import CompletedOrderTable from "../../components/dashboard/CompletedOrderTable";

export default function Orders() {
  const { token, isOwner, isAdmin } = useAuth();
  const { socket } = useSocket();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"pending" | "processing" | "completed">("pending");
  const [showDetailedBoard, setShowDetailedBoard] = useState(false);
  const [actionOrder, setActionOrder] = useState<Order | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [invoicePreview, setInvoicePreview] = useState<{ url: string; invoiceNumber: string } | null>(null);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);



  const isManager = isOwner || isAdmin;

  // Fetch Orders - Fetch both active and history for holistic view
  const fetchOrders = async () => {
    try {
      setLoading(true);
      const [activeData, historyData] = await Promise.all([
        api.get(`/orders?view=active&t=${Date.now()}`),
        api.get(`/orders?view=history&t=${Date.now()}`)
      ]);
      // De-duplicate and combine
      const combined = [...activeData, ...historyData];
      const uniqueMap = new Map<string, Order>();
      combined.forEach(o => uniqueMap.set(o.id, o));
      setOrders(Array.from(uniqueMap.values()));
    } catch (err) {
      console.error("Failed to load orders", err);
      toast.error("Could not load fresh orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchOrders();
  }, [token]);

  // Real-time integration
  useEffect(() => {
    if (!socket) return;

    const handleUpdate = (updated: Order) => {
      setOrders(prev => {
        const index = prev.findIndex(o => o.id === updated.id);
        if (index === -1) {
          return [updated, ...prev];
        }
        const next = [...prev];
        next[index] = updated;
        return next;
      });
    };

    const handleCreate = (newOrder: Order) => {
      setOrders(prev => {
        if (prev.some(o => o.id === newOrder.id)) return prev;
        return [newOrder, ...prev];
      });
    };

    socket.on("order_created", handleCreate);
    socket.on("order_updated", handleUpdate);
    return () => {
      socket.off("order_created", handleCreate);
      socket.off("order_updated", handleUpdate);
    };
  }, [socket]);

  // Metrics Calculations
  const metrics = useMemo(() => {
    const todayStr = new Date().toDateString();
    
    const todayOrders = orders.filter(o => new Date(o.createdAt).toDateString() === todayStr);
    
    const revenueToday = todayOrders
      .filter(o => !["CANCELLED", "REJECTED"].includes(o.status.toUpperCase()))
      .reduce((sum, o) => sum + (o.amount || 0), 0);

    const pendingCount = orders.filter(o =>
      ["PENDING", "NEW", "BOT_CREATED_ORDER", "USER_CONFIRMED_PENDING_AGENT"].includes(o.status.toUpperCase())
    ).length;

    const processingCount = orders.filter(o =>
      ["PROCESSING", "CONFIRMED", "PREPARING", "READY", "PAID", "SHIPPED"].includes(o.status.toUpperCase())
    ).length;

    const completedCount = orders.filter(o =>
      ["COMPLETED", "DELIVERED", "ARCHIVED"].includes(o.status.toUpperCase())
    ).length;

    // Active Agent Counting
    const activeAgentsMap = new Map<string, { name: string; completedCount: number }>();
    orders.forEach(o => {
      if (o.processedBy?.id) {
        const key = o.processedBy.id;
        const current = activeAgentsMap.get(key) || { name: o.processedBy.name, completedCount: 0 };
        if (["COMPLETED", "DELIVERED"].includes(o.status.toUpperCase())) {
          current.completedCount += 1;
        }
        activeAgentsMap.set(key, current);
      }
    });

    const activeAgentsCount = activeAgentsMap.size;
    
    let topAgent = { name: "N/A", count: 0 };
    activeAgentsMap.forEach((val) => {
      if (val.completedCount > topAgent.count) {
        topAgent = { name: val.name, count: val.completedCount };
      }
    });

    return {
      revenueToday,
      pendingCount,
      processingCount,
      completedCount,
      activeAgentsCount,
      topAgent
    };
  }, [orders]);

  // Single Accept / Reject actions from pending states
  const handleConfirmAction = async () => {
    if (!actionOrder || !actionType) return;
    const orderId = actionOrder.id;
    const type = actionType;

    // Optimistic status update before DB feedback
    const nextStatus = type === "approve" ? "PROCESSING" : "CANCELLED";
    setOrders(prev =>
      prev.map(o => (o.id === orderId ? { ...o, status: nextStatus, version: o.version + 1 } : o))
    );

    setActionOrder(null);
    setActionType(null);

    try {
      if (type === "approve") {
        await api.post(`/orders/${orderId}/approve`, { version: actionOrder.version });
        toast.success("Order accepted for handling");
      } else {
        await api.post(`/orders/${orderId}/reject`, { version: actionOrder.version });
        toast.success("Order request rejected");
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.response?.data?.message || "Action failed. Reverting...");
      fetchOrders();
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: OrderStatus, version: number) => {
    // Optimistic UI state
    setOrders(prev =>
      prev.map(o => (o.id === id ? { ...o, status: newStatus, version: version + 1 } : o))
    );

    try {
      await api.patch(`/orders/${id}/status`, { status: newStatus, version });
      toast.success(`Order moved to ${newStatus.toLowerCase()}`);
    } catch (e: any) {
      console.error(e);
      toast.error(e.response?.data?.message || "Transition rejected. Refreshing...");
      fetchOrders();
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    const id = deleteConfirmId;
    setDeleteConfirmId(null);
    try {
      await api.delete(`/orders/${id}`);
      setOrders(prev => prev.filter(o => o.id !== id));
      toast.success("Order record archived");
    } catch (e) {
      toast.error("Failed to archive order");
    }
  };

  // Divide orders into three active work state tabs
  const tabFilteredOrders = useMemo(() => {
    return orders.filter(o => {
      const status = (o.status || "").toUpperCase();
      if (activeTab === "pending") {
        return ["PENDING", "NEW", "BOT_CREATED_ORDER", "USER_CONFIRMED_PENDING_AGENT"].includes(status);
      }
      if (activeTab === "processing") {
        return ["PROCESSING", "CONFIRMED", "PREPARING", "READY", "PAID", "SHIPPED"].includes(status);
      }
      if (activeTab === "completed") {
        return ["COMPLETED", "DELIVERED", "ARCHIVED", "CANCELLED", "REJECTED"].includes(status);
      }
      return false;
    });
  }, [orders, activeTab]);

  return (
    <PageTransition className="h-[calc(100vh-6rem)] flex flex-col gap-4 lg:gap-6 relative">
      {isManager && !showDetailedBoard ? (
        // --- 1. ADMIN/OWNER METRICS OVERVIEW DASHBOARD ---
        <div className="space-y-6 overflow-y-auto pr-1 flex-1 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-app-bg p-5 rounded-2xl border border-app">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Business Control Center</h2>
              <p className="text-xs text-slate-500">
                Performance dashboard for SME workflow, revenue monitoring, and staff assignment
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">

              <button
                id="view-detailed-reports-btn"
                onClick={() => setShowDetailedBoard(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-lg transition"
              >
                📊 View Detailed Reports
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <div className="bg-app-surface p-5 rounded-2xl border border-app shadow-sm flex flex-col justify-between">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Revenue Today</span>
              <div className="mt-2 text-2xl font-black text-slate-800">₹{metrics.revenueToday.toLocaleString()}</div>
              <span className="text-[10px] text-emerald-500 font-semibold mt-1 flex items-center gap-1">
                <TrendingUp size={12} /> Today's Sales
              </span>
            </div>

            <div className="bg-app-surface p-5 rounded-2xl border border-app shadow-sm flex flex-col justify-between">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Pending Accept</span>
              <div className="mt-2 text-2xl font-black text-amber-500">{metrics.pendingCount}</div>
              <span className="text-[10px] text-slate-500 font-semibold mt-1">Awaiting agents</span>
            </div>

            <div className="bg-app-surface p-5 rounded-2xl border border-app shadow-sm flex flex-col justify-between">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Processing Count</span>
              <div className="mt-2 text-2xl font-black text-indigo-500">{metrics.processingCount}</div>
              <span className="text-[10px] text-slate-500 font-semibold mt-1">Active handling</span>
            </div>

            <div className="bg-app-surface p-5 rounded-2xl border border-app shadow-sm flex flex-col justify-between">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Completed Count</span>
              <div className="mt-2 text-2xl font-black text-emerald-600">{metrics.completedCount}</div>
              <span className="text-[10px] text-slate-500 font-semibold mt-1">History archived</span>
            </div>

            <div className="bg-app-surface p-5 rounded-2xl border border-app shadow-sm flex flex-col justify-between">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Active Agents</span>
              <div className="mt-2 text-2xl font-black text-blue-600">{metrics.activeAgentsCount}</div>
              <span className="text-[100%] text-slate-500 font-semibold mt-1 flex items-center gap-1">
                <Users size={12} /> Working now
              </span>
            </div>

            <div className="bg-app-surface p-5 rounded-2xl border border-app shadow-sm flex flex-col justify-between">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Top Performing Agent</span>
              <div className="mt-2 text-base font-black text-slate-800 truncate" title={metrics.topAgent.name}>
                {metrics.topAgent.name}
              </div>
              <span className="text-[10px] text-indigo-600 font-semibold mt-1 flex items-center gap-1">
                <UserCheck size={12} /> {metrics.topAgent.count} Completed
              </span>
            </div>
          </div>

          {/* Quick Info Grid panel for overview */}
          <div className="bg-app-surface rounded-2xl border border-app shadow-sm p-6">
            <div className="flex items-center justify-between pb-3 border-b border-app mb-4">
              <h3 className="font-bold text-slate-800 text-sm">Active Agent Pipelines</h3>
              <button
                onClick={() => setShowDetailedBoard(true)}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-bold hover:underline"
              >
                Inspect Live Workspace →
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(
                orders.reduce<Record<string, { name: string; completed: number; pending: number; totalVolume: number }>>((acc, o) => {
                  if (o.processedBy?.id) {
                    const id = o.processedBy.id;
                    if (!acc[id]) {
                      acc[id] = { name: o.processedBy.name, completed: 0, pending: 0, totalVolume: 0 };
                    }
                    if (["COMPLETED", "DELIVERED"].includes(o.status.toUpperCase())) {
                      acc[id].completed += 1;
                    } else if (!["CANCELLED", "REJECTED"].includes(o.status.toUpperCase())) {
                      acc[id].pending += 1;
                    }
                    acc[id].totalVolume += o.amount || 0;
                  }
                  return acc;
                }, {})
              ).map(([id, stat]) => (
                <div key={id} className="p-4 rounded-xl bg-app-bg border border-app flex flex-col justify-between gap-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-bold text-sm text-slate-800">{stat.name}</span>
                      <div className="text-[10px] text-slate-400">Total processed volume: ₹{stat.totalVolume.toLocaleString()}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                      Agent Profile
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div className="bg-app-surface p-2 rounded-lg border border-app">
                      <div className="text-[10px] text-slate-400">Completed</div>
                      <div className="font-bold text-emerald-600">{stat.completed} orders</div>
                    </div>
                    <div className="bg-app-surface p-2 rounded-lg border border-app">
                      <div className="text-[10px] text-slate-400">Active Handling</div>
                      <div className="font-bold text-amber-500">{stat.pending} in pipeline</div>
                    </div>
                  </div>
                </div>
              ))}
              {orders.filter(o => o.processedBy?.id).length === 0 && (
                <div className="col-span-2 text-center py-8 text-slate-400 italic text-xs">
                  No active agent assignments detected today.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        // --- 2. STREAMLINED CLIENT WORKSPACE / TABBED ACTIVE INTERFACE ---
        <>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
            <div>
              {isManager && (
                <button
                  id="back-to-metrics-btn"
                  onClick={() => setShowDetailedBoard(false)}
                  className="mb-2 inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 transition"
                >
                  ← Back to Metrics Dashboard
                </button>
              )}
              <h2 className="text-xl font-bold text-app-text">
                {isManager ? "Global Orders Management" : "My Orders Workspace"}
              </h2>
              <p className="text-xs text-slate-500">
                {isManager
                  ? 'Detailed workspace overview of incoming, active, and completed orders'
                  : 'Receive, transition, and complete client orders within a simplified click flow'}
              </p>
            </div>

            {/* Compact tab selectors */}
            <div className="flex items-center gap-2 self-stretch sm:self-auto flex-wrap">

              <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-auto self-stretch sm:self-auto">
              {(["pending", "processing", "completed"] as const).map(tabKey => {
                const count = orders.filter(o => {
                  const s = (o.status || "").toUpperCase();
                  if (tabKey === "pending") {
                    return ["PENDING", "NEW", "BOT_CREATED_ORDER", "USER_CONFIRMED_PENDING_AGENT"].includes(s);
                  }
                  if (tabKey === "processing") {
                    return ["PROCESSING", "CONFIRMED", "PREPARING", "READY", "PAID", "SHIPPED"].includes(s);
                  }
                  return ["COMPLETED", "DELIVERED", "ARCHIVED", "CANCELLED", "REJECTED"].includes(s);
                }).length;

                return (
                  <button
                    key={tabKey}
                    id={`tab-btn-${tabKey}`}
                    onClick={() => setActiveTab(tabKey)}
                    className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      activeTab === tabKey
                        ? "bg-app-surface text-app-text shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {tabKey === "pending" && "⏳ Pending"}
                    {tabKey === "processing" && "⚙️ Processing"}
                    {tabKey === "completed" && "🏁 Completed"}
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[9px] ${
                        activeTab === tabKey
                          ? "bg-indigo-50 text-indigo-700 font-extrabold"
                          : "bg-slate-200/65 text-app-muted"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
              </div>
            </div>
          </div>

          {/* Tab Work Panel View */}
          {loading ? (
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div
                  key={i}
                  className="rounded-2xl border border-app bg-app-bg/50 p-4 space-y-3 animate-pulse"
                >
                  <div className="h-4 bg-slate-200 rounded w-1/3 mb-4" />
                  <div className="h-20 bg-app-surface rounded-xl border border-app" />
                  <div className="h-20 bg-app-surface rounded-xl border border-app" />
                </div>
              ))}
            </div>
          ) : tabFilteredOrders.length === 0 ? (
            <div className="flex-1 flex items-center justify-center bg-app-bg rounded-2xl border-2 border-dashed border-app p-8">
              <div className="text-center max-w-sm">
                <div className="mx-auto w-12 h-12 bg-app-surface rounded-2xl shadow-sm flex items-center justify-center text-xl mb-4 text-slate-400">
                  📦
                </div>
                <h3 className="font-bold text-slate-800 text-sm mb-1 uppercase tracking-tight">
                  No orders found
                </h3>
                <p className="text-xs text-slate-400">
                  There are no orders resting inside the <strong>{activeTab}</strong> workflow stage.
                </p>
              </div>
            </div>
          ) : activeTab === "completed" ? (
            <CompletedOrderTable orders={tabFilteredOrders} />
          ) : (
            <div className="flex-1 overflow-y-auto pr-1">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-4">
                <AnimatePresence mode="popLayout">
                  {tabFilteredOrders.map(order => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -10 }}
                      key={order.id}
                      className={`bg-app-surface p-5 rounded-2xl shadow-sm border relative flex flex-col justify-between ${
                        order.isUrgent || (order.priorityScore && order.priorityScore > 50)
                          ? "border-red-200 ring-2 ring-red-50"
                          : "border-app"
                      }`}
                    >
                      <div>
                        {/* Card Header information */}
                        <div className="flex justify-between items-start mb-3">
                          <span className="text-lg font-black text-indigo-600">₹{order.amount}</span>
                          <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded font-mono font-medium">
                            {new Date(order.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </span>
                        </div>

                        {/* Order Summary details */}
                        <h4 className="font-bold text-slate-800 text-sm leading-snug mb-2">{order.summary}</h4>

                        {/* Customer context info */}
                        <div className="text-xs text-slate-500 flex items-center gap-1.5 py-2 border-b border-dashed border-app mb-3">
                          <span className="text-slate-400">👤 Contact:</span>
                          <span className="font-medium text-slate-700">{order.lead?.name || "Anonymous Client"}</span>
                          {order.lead?.contact && (
                            <span className="text-[10px] text-slate-400">({order.lead.contact})</span>
                          )}
                        </div>

                        {/* Invoice rendering */}
                        {order.invoice?.pdfUrl && (
                          <div className="mb-4">
                            <button
                              id={`preview-invoice-${order.id}`}
                              onClick={() =>
                                setInvoicePreview({
                                  url: order.invoice!.pdfUrl,
                                  invoiceNumber: order.invoice!.invoiceNumber
                                })
                              }
                              className="w-full inline-flex items-center justify-between px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition"
                            >
                              <span className="flex items-center gap-1.5">📄 View Invoice File</span>
                              <span className="text-[10px] text-indigo-500">{order.invoice.invoiceNumber}</span>
                            </button>
                          </div>
                        )}

                        {/* Managed agent metadata */}
                        {isManager && order.processedBy && (
                          <div className="mb-4 text-[11px] text-slate-500 bg-app-bg px-2.5 py-1.5 rounded-lg flex items-center justify-between">
                            <span className="text-slate-400 flex items-center gap-1">👨‍💻 Handler Agent:</span>
                            <span className="font-bold text-slate-700">{order.processedBy.name}</span>
                          </div>
                        )}
                      </div>

                      {/* --- TIGHTLY COUPLED SIMPLE CLICK STATE TRIGGERS --- */}
                      <div className="pt-2">
                        {activeTab === "pending" && (
                          <div className="grid grid-cols-2 gap-2 w-full">
                            <button
                              id={`reject-btn-${order.id}`}
                              onClick={() => {
                                setActionOrder(order);
                                setActionType("reject");
                              }}
                              className="px-3 py-2 rounded-xl border border-red-200 text-red-600 text-xs font-bold hover:bg-red-50 hover:border-red-300 transition"
                            >
                              Reject
                            </button>
                            <button
                              id={`accept-btn-${order.id}`}
                              onClick={() => {
                                setActionOrder(order);
                                setActionType("approve");
                              }}
                              className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-100 transition"
                            >
                              Accept Order
                            </button>
                          </div>
                        )}

                        {activeTab === "processing" && (
                          <div className="flex flex-col gap-2 w-full">
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                id={`cancel-btn-${order.id}`}
                                onClick={() => handleUpdateStatus(order.id, "CANCELLED", order.version)}
                                className="px-3 py-1.5 border border-app text-slate-500 text-xs font-bold rounded-xl hover:bg-app-bg hover:text-red-500 hover:border-red-200 transition"
                              >
                                Cancel Order
                              </button>
                              <button
                                id={`complete-btn-${order.id}`}
                                onClick={() => handleUpdateStatus(order.id, "COMPLETED", order.version)}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition"
                              >
                                Complete Work
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}
        </>
      )}

      {/* --- Delete Confirmation Modal --- */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setDeleteConfirmId(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-app-surface rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden relative z-10 border border-app"
            >
              <div className="h-2 w-full bg-red-500" />
              <div className="p-6">
                <h3 className="text-base font-bold text-app-text mb-1">Archive Order?</h3>
                <p className="text-xs text-slate-500 leading-normal mb-5">
                  Are you sure you want to archive or remove this order record? This action removes it from the active views.
                </p>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setDeleteConfirmId(null)}
                    className="px-3 py-2 text-slate-500 hover:bg-app-bg rounded-xl text-xs font-bold border border-app"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    className="px-4 py-2 text-white text-xs font-bold rounded-xl shadow-lg bg-red-600 hover:bg-red-700 shadow-red-100"
                  >
                    Confirm Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- ACCEPT/REJECT PENDING APPROVAL DIALOG MODAL --- */}
      <AnimatePresence>
        {actionOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => {
                setActionOrder(null);
                setActionType(null);
              }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-app-surface rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden relative z-10 border border-app"
            >
              <div
                className={`h-2 w-full ${actionType === "approve" ? "bg-indigo-600" : "bg-red-500"}`}
              />
              <div className="p-6">
                <h3 className="text-base font-bold text-app-text mb-1">
                  {actionType === "approve" ? "Accept Client Order Request?" : "Reject Order Request?"}
                </h3>
                <p className="text-xs text-slate-500 leading-normal mb-5">
                  {actionType === "approve"
                    ? `You are claiming order for client amount ₹${actionOrder.amount}. It will transition immediately into your active processing list.`
                    : "Are you sure you want to reject and decline this inbound order request?"}
                </p>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      setActionOrder(null);
                      setActionType(null);
                    }}
                    className="px-3 py-2 text-slate-500 hover:bg-app-bg rounded-xl text-xs font-bold border border-app"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmAction}
                    className={`px-4 py-2 text-white text-xs font-bold rounded-xl shadow-lg ${
                      actionType === "approve"
                        ? "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100"
                        : "bg-red-600 hover:bg-red-700 shadow-red-100"
                    }`}
                  >
                    Confirm Action
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- PDF INVOICE EMBEDDED PREVIEW MODAL --- */}
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
              className="relative z-10 flex flex-col m-4 md:m-8 bg-app-surface rounded-2xl shadow-2xl overflow-hidden flex-1"
            >
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-app bg-app-bg shrink-0">
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
                    Open in tab ↗
                  </a>
                  <button
                    onClick={() => setInvoicePreview(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
              <iframe
                src={invoicePreview.url}
                className="w-full flex-1 border-0"
                title="Invoice Document Preview"
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>


    </PageTransition>
  );
}
