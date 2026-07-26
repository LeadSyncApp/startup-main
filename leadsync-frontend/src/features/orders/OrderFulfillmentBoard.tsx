import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  ShoppingBag, 
  Truck, 
  CheckCircle2, 
  Clock, 
  Search,
  Filter,
  User,
  IndianRupee,
  MoreVertical,
  ChevronRight,
  ClipboardList,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { authedFetch } from '../../api/client';

export const OrderFulfillmentBoard: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [tab, setTab] = useState<'READY' | 'SHIPPED' | 'PENDING'>('READY');
  const [search, setSearch] = useState('');

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authedFetch('/api/orders?view=active');
      if (res.ok) {
        const data = await res.json();
        setOrders(Array.isArray(data) ? data : []);
      } else {
        toast.error('Failed to load orders');
      }
    } catch (err) {
      console.error('Error loading orders:', err);
      toast.error('Network error loading orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const updateStatus = async (orderId: string, newStatus: string) => {
    setUpdatingOrderId(orderId);
    try {
      const res = await authedFetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        toast.success(`Order status updated to ${newStatus}`);
        await fetchOrders();
      } else {
        const data = await res.json();
        toast.error(data.message || 'Failed to update order status');
      }
    } catch (err) {
      console.error('Status update error:', err);
      toast.error('Network error updating status');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const READY_STATUSES = ['PAID', 'APPROVED', 'CONFIRMED', 'READY', 'PROCESSING', 'PREPARING'];
  const SHIPPED_STATUSES = ['SHIPPED', 'DELIVERED', 'COMPLETED'];

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      let displayStatus = 'PENDING';
      if (READY_STATUSES.includes(o.status)) {
        displayStatus = 'READY';
      } else if (SHIPPED_STATUSES.includes(o.status)) {
        displayStatus = 'SHIPPED';
      } else {
        displayStatus = 'PENDING';
      }

      const matchesTab = displayStatus === tab;
      const customerName = o.lead?.name || 'Customer';
      const orderIdStr = o.id || '';
      const summaryStr = o.summary || '';

      const matchesSearch = customerName.toLowerCase().includes(search.toLowerCase()) || 
                           orderIdStr.toLowerCase().includes(search.toLowerCase()) ||
                           summaryStr.toLowerCase().includes(search.toLowerCase());
      return matchesTab && matchesSearch;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, tab, search]);

  const readyCount = useMemo(() => {
    return orders.filter(o => READY_STATUSES.includes(o.status)).length;
  }, [orders]);

  const shippedCount = useMemo(() => {
    return orders.filter(o => SHIPPED_STATUSES.includes(o.status)).length;
  }, [orders]);

  const pendingCount = useMemo(() => {
    return orders.filter(o => ![...READY_STATUSES, ...SHIPPED_STATUSES].includes(o.status)).length;
  }, [orders]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID':
      case 'COMPLETED':
      case 'READY':
      case 'APPROVED':
      case 'CONFIRMED':
        return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'PENDING':
      case 'NEW':
        return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'SHIPPED':
      case 'DELIVERED':
        return 'bg-blue-50 text-blue-600 border-blue-100';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <ShoppingBag className="size-6 text-indigo-600" />
            Order Fulfillment
          </h2>
          <p className="text-sm text-slate-500 font-medium">Manage your paid orders and logistics</p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl items-center gap-1">
          <button 
            onClick={() => setTab('READY')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 ${tab === 'READY' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >
            <CheckCircle2 className="size-3.5" />
            Ready for Packing ({readyCount})
          </button>
          <button 
            onClick={() => setTab('SHIPPED')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 ${tab === 'SHIPPED' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >
            <Truck className="size-3.5" />
            Shipped/Out ({shippedCount})
          </button>
          <button 
            onClick={() => setTab('PENDING')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 ${tab === 'PENDING' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >
            <Clock className="size-3.5" />
            Wait for Payment ({pendingCount})
          </button>
          <button 
            onClick={fetchOrders}
            title="Refresh orders from server"
            className="p-1.5 hover:bg-white text-slate-500 hover:text-slate-900 rounded-lg transition"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl p-4 flex items-center gap-3 shadow-sm">
        <Search className="size-4 text-slate-400" />
        <input 
          type="text" 
          placeholder="Search by customer name or Order ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent border-none outline-none text-sm font-medium placeholder:text-slate-300"
        />
        <button className="p-2 hover:bg-slate-50 rounded-xl transition text-slate-400">
          <Filter className="size-4" />
        </button>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="size-8 border-3 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-100 rounded-3xl p-16 text-center">
            <ClipboardList className="size-12 text-slate-100 mx-auto mb-4" />
            <h3 className="text-slate-400 font-black text-sm">No orders found here</h3>
            <p className="text-slate-300 text-[10px] font-bold uppercase tracking-widest mt-1">
              {tab === 'READY' ? 'Orders confirmed as PAID will auto-jump here for packing' : 'Nothing to show in this view'}
            </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredOrders.map((order) => {
              const isUpdating = updatingOrderId === order.id;

              return (
                <motion.div 
                  layout
                  key={order.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 group ${
                    isUpdating ? "opacity-60 pointer-events-none select-none" : ""
                  }`}
                >
                  <div className="p-5 border-b border-slate-50 bg-slate-50/30">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex gap-2">
                        <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                        {(order.priorityScore > 70 || order.isUrgent) ? (
                          <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border bg-red-50 text-red-600 border-red-100">
                            URGENT
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border bg-slate-50 text-slate-600 border-slate-100">
                            STANDARD
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 font-mono">
                        #{order.id.slice(0, 8)}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="size-10 bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm">
                        <User className="size-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-black text-slate-900">{order.lead?.name || "Customer"}</h4>
                          {(order.status === 'PAID' || order.status === 'APPROVED' || order.status === 'CONFIRMED') && (
                            <span className="bg-emerald-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">Paid</span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 font-bold">{order.lead?.contact || "No Contact"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</span>
                      <span className="text-2xl font-black text-indigo-600 flex items-center gap-0.5">
                        <IndianRupee className="size-5" />
                        {Number(order.amount || 0).toLocaleString()}
                      </span>
                    </div>

                    <div className="bg-slate-50 rounded-2xl p-3">
                      <p className="text-xs text-slate-600 font-medium leading-relaxed italic">
                        "{order.summary || "Order"}"
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      {['PENDING', 'NEW'].includes(order.status) && (
                        <div className="flex-1 py-3 bg-slate-50 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest text-center border border-dashed border-slate-200">
                          Waiting for Payment
                        </div>
                      )}
                      {['READY', 'PAID', 'APPROVED', 'CONFIRMED', 'PROCESSING', 'PREPARING'].includes(order.status) && (
                        <button 
                           onClick={() => updateStatus(order.id, 'SHIPPED')}
                           disabled={isUpdating}
                           className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {isUpdating ? <Loader2 className="size-3.5 animate-spin" /> : null}
                          Mark as Shipped
                        </button>
                      )}
                      {['SHIPPED'].includes(order.status) && (
                         <button 
                            onClick={() => updateStatus(order.id, 'DELIVERED')}
                            disabled={isUpdating}
                            className="flex-1 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                         >
                           {isUpdating ? <Loader2 className="size-3.5 animate-spin" /> : null}
                           Mark as Delivered
                         </button>
                      )}
                      <button className="p-3 border border-slate-200 rounded-2xl text-slate-400 hover:bg-slate-50 transition">
                        <MoreVertical className="size-4" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                       <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                          <Clock className="size-3" />
                          {new Date(order.createdAt).toLocaleDateString()}
                       </div>
                       <button className="text-[10px] font-black uppercase text-indigo-600 hover:underline flex items-center gap-1">
                          View Chat
                          <ChevronRight className="size-3" />
                       </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
