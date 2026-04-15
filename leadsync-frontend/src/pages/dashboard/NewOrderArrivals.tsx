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
    if (priorityScore >= 80) return "text-red-400 bg-red-500/10 border-red-500/20";
    if (priorityScore >= 60) return "text-orange-400 bg-orange-500/10 border-orange-500/20";
    return "text-blue-400 bg-blue-500/10 border-blue-500/20";
  };

  const getCustomerTypeBadge = (history: CustomerHistory) => {
    if (history.wasDeleted) {
      return { text: "Returning Deleted", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" };
    }
    if (history.wasClosed) {
      return { text: "Returning Closed", color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" };
    }
    if (history.isExistingCustomer) {
      return { text: "Returning Customer", color: "bg-green-500/10 text-green-400 border-green-500/20" };
    }
    return { text: "New Customer", color: "bg-background-elevated text-text-muted border-border" };
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
          <h1 className="text-3xl font-black text-text-primary">New Order Arrivals</h1>
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
          <h1 className="text-3xl font-black text-text-primary flex items-center gap-3">
            <ShoppingCart className="text-indigo-400" />
            New Order Arrivals
          </h1>
          <p className="text-text-muted mt-2">
            All incoming orders requiring claim - universal intake queue
          </p>
        </div>
        
        {selectedOrders.size > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-text-secondary">
              {selectedOrders.size} selected
            </span>
            <button
              onClick={handleBulkClaim}
              className="px-4 py-2 bg-accent text-white rounded-xl font-medium hover:bg-accent-hover transition active:scale-95"
            >
              Claim All Selected
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-background-secondary p-6 rounded-2xl border border-border shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-muted">In Queue</p>
              <p className="text-2xl font-bold text-text-primary">{orders.length}</p>
            </div>
            <Clock className="text-text-disabled" size={20} />
          </div>
        </div>
        
        <div className="bg-background-secondary p-6 rounded-2xl border border-border shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-muted">New Customers</p>
              <p className="text-2xl font-bold text-text-primary">
                {orders.filter(o => !o.customerHistory.isExistingCustomer).length}
              </p>
            </div>
            <User className="text-text-disabled" size={20} />
          </div>
        </div>
        
        <div className="bg-background-secondary p-6 rounded-2xl border border-border shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-muted">Returning</p>
              <p className="text-2xl font-bold text-text-primary">
                {orders.filter(o => o.customerHistory.isExistingCustomer).length}
              </p>
            </div>
            <User className="text-text-disabled" size={20} />
          </div>
        </div>
        
        <div className="bg-background-secondary p-6 rounded-2xl border border-border shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-muted">High Priority</p>
              <p className="text-2xl font-bold text-text-primary">
                {orders.filter(o => o.priorityScore >= 70).length}
              </p>
            </div>
            <AlertCircle className="text-text-disabled" size={20} />
          </div>
        </div>
      </div>

      {/* Orders Table */}
      {orders.length === 0 ? (
        <div className="bg-background-secondary rounded-2xl border border-border p-12 text-center">
          <ShoppingCart className="mx-auto text-text-disabled mb-4" size={48} />
          <h3 className="text-xl font-bold text-text-primary mb-2">No new orders</h3>
          <p className="text-text-muted">All orders have been claimed. Check back later for new arrivals.</p>
        </div>
      ) : (
        <div className="bg-background-secondary rounded-2xl border border-border overflow-hidden shadow-card">
          {/* Table Header */}
          <div className="bg-background-tertiary px-6 py-4 border-b border-border">
            <div className="flex items-center gap-4">
              <input
                type="checkbox"
                checked={selectedOrders.size === orders.length}
                onChange={handleSelectAll}
                className="rounded border-border"
              />
              <span className="text-sm font-medium text-text-secondary">
                {selectedOrders.size > 0 ? `${selectedOrders.size} selected` : "Select all"}
              </span>
            </div>
          </div>

          {/* Orders List */}
          <div className="divide-y divide-border">
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
                    className="p-6 hover:bg-background-tertiary/50 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <input
                        type="checkbox"
                        checked={selectedOrders.has(order.id)}
                        onChange={() => handleSelect(order.id)}
                        className="mt-1 rounded border-border"
                      />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-bold text-text-primary">
                                {order.lead.name || "Customer"}
                              </h3>
                              <span className={`text-xs font-bold px-2 py-1 rounded-full border ${customerBadge.color}`}>
                                {customerBadge.text}
                              </span>
                              <span className={`text-xs font-bold px-2 py-1 rounded-full border ${priorityColor}`}>
                                Priority: {order.priorityScore}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-4 text-sm text-text-secondary">
                              <span className="flex items-center gap-1">
                                <span>{order.lead.contact}</span>
                                <span className="text-text-disabled">•</span>
                                <span>{order.lead.channel}</span>
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock size={14} />
                                {formatTimeInQueue(order.timeInQueue)}
                              </span>
                            </div>
                          </div>
                          
                          <button
                            onClick={(e) => handleClaim(order.id, e)}
                            className="px-4 py-2 bg-accent text-white rounded-xl font-medium hover:bg-accent-hover transition active:scale-95 flex items-center gap-2"
                          >
                            Claim Order
                            <ArrowRight size={16} />
                          </button>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-text-secondary">Order:</span>
                            <span className="font-bold text-text-primary">{order.summary}</span>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-text-secondary">Value:</span>
                            <span className="font-bold text-green-400">₹{order.amount.toLocaleString()}</span>
                          </div>
                          
                          {order.customerHistory.isExistingCustomer && (
                            <div className="bg-background-tertiary rounded-lg p-3 space-y-1">
                              <div className="flex items-center gap-2 text-sm">
                                <History size={14} className="text-text-muted" />
                                <span className="font-medium text-text-secondary">Customer History:</span>
                              </div>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="text-text-muted">Previous Orders:</span>
                                  <span className="font-medium text-text-primary"> {order.customerHistory.previousOrderCount}</span>
                                </div>
                                <div>
                                  <span className="text-text-muted">Previous Spend:</span>
                                  <span className="font-medium text-text-primary"> ₹{order.customerHistory.previousSpend.toLocaleString()}</span>
                                </div>
                                {order.customerHistory.previousAgent && (
                                  <div className="col-span-2">
                                    <span className="text-text-muted">Previous Agent:</span>
                                    <span className="font-medium text-text-primary"> {order.customerHistory.previousAgent.name}</span>
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
