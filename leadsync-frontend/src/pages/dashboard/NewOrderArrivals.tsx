import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../../lib/api";
import toast from "react-hot-toast";
import { 
  ShoppingCart, 
  Clock, 
  User, 
  AlertCircle, 
  ArrowRight,
  History
} from "lucide-react";
import { PageTransition } from "../../components/ui/Animations";
import { TableSkeleton } from "../../components/ui/Skeleton";

interface CustomerHistory {
  isExistingCustomer: boolean;
  previousOrderCount: number;
  previousSpend: number;
  previousAgent?: { id: string; name: string };
  recentOrders: Array<{
    id: string;
    amount: number;
    createdAt: string;
    processedBy?: string;
  }>;
  wasDeleted: boolean;
  wasClosed: boolean;
}

interface NewOrderArrival {
  id: string;
  summary: string;
  amount: number;
  priorityScore: number;
  createdAt: string;
  lead: {
    id: string;
    name: string | null;
    contact: string;
    channel: string;
    totalSpend: number;
    orderCount: number;
    segment: string;
    status: string;
  };
  conversation: {
    id: string;
    mode: string;
    assignedToId: string | null;
  };
  customerHistory: CustomerHistory;
  canCurrentUserClaim: boolean;
  isClaimed: boolean;
  timeInQueue: number;
}

export default function NewOrderArrivals() {
  const { token, user } = useAuth();
  const { socket } = useSocket();
  const [orders, setOrders] = useState<NewOrderArrival[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());

  // Fetch new order arrivals
  useEffect(() => {
    if (!token) return;

    const fetchOrders = async () => {
      try {
        setLoading(true);
        const data = await api.get("/newOrderArrivals");
        setOrders(data);
      } catch (err) {
        console.error("❌ Failed to fetch new order arrivals:", err);
        toast.error("Failed to load new order arrivals");
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [token]);

  // Real-time updates
  useEffect(() => {
    if (!socket) return;

    const onNewOrderArrival = (order: any) => {
      setOrders(prev => [order, ...prev]);
      toast.success("🛒 New Order Arrival!", {
        icon: "🛒",
        duration: 4000,
      });
    };

    const onOrderArrivalClaimed = (data: any) => {
      setOrders(prev => prev.filter(order => order.id !== data.orderId));
      toast(`${data.claimedBy.name} claimed an order`, {
        icon: "✅",
        duration: 3000,
      });
    };

    socket.on("new_order_arrival", onNewOrderArrival);
    socket.on("order_arrival_claimed", onOrderArrivalClaimed);

    return () => {
      socket.off("new_order_arrival", onNewOrderArrival);
      socket.off("order_arrival_claimed", onOrderArrivalClaimed);
    };
  }, [socket]);

  const handleClaim = async (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user?.id) return;

    try {
      await api.post(`/newOrderArrivals/${orderId}/claim`);
      
      // Optimistic UI update
      setOrders(prev => prev.filter(order => order.id !== orderId));
      
      toast.success("Order claimed! Opening conversation...");
      
      // Navigate to conversation after a short delay
      setTimeout(() => {
        const order = orders.find(o => o.id === orderId);
        if (order?.conversation.id) {
          window.location.href = `/dashboard/conversations?conversationId=${order.conversation.id}`;
        }
      }, 1000);
    } catch (err: any) {
      console.error("Failed to claim order", err);
      toast.error(err.response?.data?.message || "Could not claim order. Someone else might have taken it.");
    }
  };

  const handleBulkClaim = async () => {
    if (selectedOrders.size === 0) return;
    
    const ids = Array.from(selectedOrders);
    const results = await Promise.allSettled(
      ids.map(id => api.post(`/newOrderArrivals/${id}/claim`))
    );
    
    const succeeded = results.filter(r => r.status === "fulfilled").length;
    const failed = results.filter(r => r.status === "rejected").length;
    
    // Remove successfully claimed orders from UI
    const successfulIds: string[] = [];
    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        successfulIds.push(ids[index]);
      }
    });
    
    if (successfulIds.length > 0) {
      setOrders(prev => prev.filter(order => !successfulIds.includes(order.id)));
    }
    
    // Provide precise feedback
    if (failed === 0) {
      toast.success(`Claimed ${succeeded} order${succeeded !== 1 ? "s" : ""}!`);
    } else if (succeeded === 0) {
      toast.error("All orders were already claimed");
    } else {
      toast.success(`Claimed ${succeeded} of ${ids.length} orders (${failed} failed)`);
    }
    
    setSelectedOrders(new Set());
  };

  const formatTimeInQueue = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  const getPriorityColor = (priorityScore: number) => {
    if (priorityScore >= 80) return "text-red-600 bg-red-50 border-red-200";
    if (priorityScore >= 60) return "text-orange-600 bg-orange-50 border-orange-200";
    return "text-blue-600 bg-blue-50 border-blue-200";
  };

  const getCustomerTypeBadge = (history: CustomerHistory) => {
    if (history.wasDeleted) {
      return { text: "Returning Deleted", color: "bg-purple-100 text-purple-700 border-purple-200" };
    }
    if (history.wasClosed) {
      return { text: "Returning Closed", color: "bg-indigo-100 text-indigo-700 border-indigo-200" };
    }
    if (history.isExistingCustomer) {
      return { text: "Returning Customer", color: "bg-green-100 text-green-700 border-green-200" };
    }
    return { text: "New Customer", color: "bg-gray-100 text-gray-700 border-gray-200" };
  };

  const handleSelect = (orderId: string) => {
    setSelectedOrders(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId); 
      else next.add(orderId);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedOrders.size === orders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(orders.map(o => o.id)));
    }
  };

  if (loading) {
    return (
      <PageTransition className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-black text-app-text">New Order Arrivals</h1>
        </div>
        <TableSkeleton rows={8} cols={6} />
      </PageTransition>
    );
  }

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-app-text flex items-center gap-3">
            <ShoppingCart className="text-indigo-600" />
            New Order Arrivals
          </h1>
          <p className="text-app-muted mt-2">
            All incoming orders requiring claim - universal intake queue
          </p>
        </div>
        
        {selectedOrders.size > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-app-muted">
              {selectedOrders.size} selected
            </span>
            <button
              onClick={handleBulkClaim}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition active:scale-95"
            >
              Claim All Selected
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-app-surface p-6 rounded-2xl border border-app">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-app-muted">In Queue</p>
              <p className="text-2xl font-bold text-app-text">{orders.length}</p>
            </div>
            <Clock className="text-slate-400" size={20} />
          </div>
        </div>
        
        <div className="bg-app-surface p-6 rounded-2xl border border-app">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-app-muted">New Customers</p>
              <p className="text-2xl font-bold text-app-text">
                {orders.filter(o => !o.customerHistory.isExistingCustomer).length}
              </p>
            </div>
            <User className="text-slate-400" size={20} />
          </div>
        </div>
        
        <div className="bg-app-surface p-6 rounded-2xl border border-app">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-app-muted">Returning</p>
              <p className="text-2xl font-bold text-app-text">
                {orders.filter(o => o.customerHistory.isExistingCustomer).length}
              </p>
            </div>
            <User className="text-slate-400" size={20} />
          </div>
        </div>
        
        <div className="bg-app-surface p-6 rounded-2xl border border-app">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-app-muted">High Priority</p>
              <p className="text-2xl font-bold text-app-text">
                {orders.filter(o => o.priorityScore >= 70).length}
              </p>
            </div>
            <AlertCircle className="text-slate-400" size={20} />
          </div>
        </div>
      </div>

      {/* Orders Table */}
      {orders.length === 0 ? (
        <div className="bg-app-surface rounded-2xl border border-app p-12 text-center">
          <ShoppingCart className="mx-auto text-slate-300 mb-4" size={48} />
          <h3 className="text-xl font-bold text-app-text mb-2">No new orders</h3>
          <p className="text-app-muted">All orders have been claimed. Check back later for new arrivals.</p>
        </div>
      ) : (
        <div className="bg-app-surface rounded-2xl border border-app overflow-hidden">
          {/* Table Header */}
          <div className="bg-app-bg px-6 py-4 border-b border-app">
            <div className="flex items-center gap-4">
              <input
                type="checkbox"
                checked={selectedOrders.size === orders.length}
                onChange={handleSelectAll}
                className="rounded border-app-border-strong"
              />
              <span className="text-sm font-medium text-app-text">
                {selectedOrders.size > 0 ? `${selectedOrders.size} selected` : "Select all"}
              </span>
            </div>
          </div>

          {/* Orders List */}
          <div className="divide-y divide-slate-200">
            <AnimatePresence>
              {orders.map((order) => {
                const customerBadge = getCustomerTypeBadge(order.customerHistory);
                const priorityColor = getPriorityColor(order.priorityScore);
                
                return (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="p-6 hover:bg-app-bg transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <input
                        type="checkbox"
                        checked={selectedOrders.has(order.id)}
                        onChange={() => handleSelect(order.id)}
                        className="mt-1 rounded border-app-border-strong"
                      />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-bold text-app-text">
                                {order.lead.name || "Customer"}
                              </h3>
                              <span className={`text-xs font-bold px-2 py-1 rounded-full border ${customerBadge.color}`}>
                                {customerBadge.text}
                              </span>
                              <span className={`text-xs font-bold px-2 py-1 rounded-full border ${priorityColor}`}>
                                Priority: {order.priorityScore}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-4 text-sm text-app-muted">
                              <span className="flex items-center gap-1">
                                <span>{order.lead.contact}</span>
                                <span className="text-slate-400">•</span>
                                <span>{order.lead.channel?.toUpperCase() === "WEBSITE" ? "OFFLINE" : order.lead.channel}</span>
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock size={14} />
                                {formatTimeInQueue(order.timeInQueue)}
                              </span>
                            </div>
                          </div>
                          
                          <button
                            onClick={(e) => handleClaim(order.id, e)}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition active:scale-95 flex items-center gap-2"
                          >
                            Claim Order
                            <ArrowRight size={16} />
                          </button>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-app-text">Order:</span>
                            <span className="font-bold text-app-text">{order.summary}</span>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-app-text">Value:</span>
                            <span className="font-bold text-green-600">₹{order.amount.toLocaleString()}</span>
                          </div>
                          
                          {order.customerHistory.isExistingCustomer && (
                            <div className="bg-app-bg rounded-lg p-3 space-y-1">
                              <div className="flex items-center gap-2 text-sm">
                                <History size={14} className="text-app-muted" />
                                <span className="font-medium text-app-text">Customer History:</span>
                              </div>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="text-app-muted">Previous Orders:</span>
                                  <span className="font-medium text-app-text">{order.customerHistory.previousOrderCount}</span>
                                </div>
                                <div>
                                  <span className="text-app-muted">Previous Spend:</span>
                                  <span className="font-medium text-app-text">₹{order.customerHistory.previousSpend.toLocaleString()}</span>
                                </div>
                                {order.customerHistory.previousAgent && (
                                  <div className="col-span-2">
                                    <span className="text-app-muted">Previous Agent:</span>
                                    <span className="font-medium text-app-text">{order.customerHistory.previousAgent.name}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}
    </PageTransition>
  );
}
