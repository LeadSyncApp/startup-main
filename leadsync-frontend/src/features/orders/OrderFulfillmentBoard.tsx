import React, { useState, useMemo } from 'react';
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
  ClipboardList
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { useSimulationStore } from '../../simulation/simulationStore';

export const OrderFulfillmentBoard: React.FC = () => {
  const { orders, approveOrder, logActivity } = useSimulationStore();
  const [tab, setTab] = useState<'PENDING' | 'READY' | 'SHIPPED'>('PENDING');
  const [search, setSearch] = useState('');
  const loading = false;

  // Mock processing state for simulation UI
  const processingOrders: Record<string, any> = {};

  const updateStatus = async (orderId: string, newStatus: string) => {
    if (newStatus === 'APPROVED' || newStatus === 'READY' || newStatus === 'SHIPPED') {
      approveOrder(orderId, 'Rahul');
      toast.success(`[Phase 5] Automation: Sent delivery update to customer via WhatsApp/Channel`);
      logActivity('Rahul', 'ORDER_APPROVE', orderId);
    }
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const displayStatus = (o.status === 'APPROVED' || o.status === 'PAID') ? 'READY' : o.status;
      const matchesTab = displayStatus === tab;
      const matchesSearch = o.customerName.toLowerCase().includes(search.toLowerCase()) || 
                           o.id.toLowerCase().includes(search.toLowerCase());
      return matchesTab && matchesSearch;
    }).sort((a, b) => b.priorityScore - a.priorityScore).map(o => ({
      id: o.id,
      amount: o.amount,
      status: (o.status === 'APPROVED' || o.status === 'PAID') ? 'READY' : o.status,
      summary: `Order for ${o.items.join(', ')}`,
      createdAt: o.timestamp,
      priorityScore: o.priorityScore,
      lead: {
        name: o.customerName,
        contact: 'Simulation Contact'
      },
      metadata: {}
    }));
  }, [orders, tab, search]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'READY': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'PENDING': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'SHIPPED': return 'bg-blue-50 text-blue-600 border-blue-100';
      default: return 'bg-slate-50 text-slate-600 border-slate-100';
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

        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button 
            onClick={() => setTab('READY')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 ${tab === 'READY' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >
            <CheckCircle2 className="size-3.5" />
            Ready for Packing ({orders.filter(o => o.status === 'APPROVED' || o.status === 'PAID').length})
          </button>
          <button 
            onClick={() => setTab('SHIPPED')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 ${tab === 'SHIPPED' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >
            <Truck className="size-3.5" />
            Shipped/Out ({orders.filter(o => o.status === 'SHIPPED').length})
          </button>
          <button 
            onClick={() => setTab('PENDING')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 ${tab === 'PENDING' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >
            <Clock className="size-3.5" />
            Wait for Payment ({orders.filter(o => o.status === 'PENDING').length})
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
              const procState = processingOrders[order.id];
              const isProcessing = procState?.isProcessing;
              const error = procState?.error;

              return (
                <motion.div 
                  layout
                  key={order.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 group ${
                    isProcessing ? "opacity-60 pointer-events-none select-none" : ""
                  }`}
                >
                  <div className="p-5 border-b border-slate-50 bg-slate-50/30">
                    <div className="flex items-center justify-between mb-3">
                      {isProcessing ? (
                        <span className="flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest animate-pulse leading-none">
                          <span className="h-1.5 w-1.5 bg-amber-500 rounded-full animate-ping shrink-0" />
                          <span>Syncing Broker</span>
                        </span>
                      ) : (
                        <div className="flex gap-2">
                          <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${getStatusColor(order.status)}`}>
                            {order.status}
                          </span>
                          {(order.priorityScore > 70) ? (
                            <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border bg-red-50 text-red-600 border-red-100">
                              URGENT
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border bg-slate-50 text-slate-600 border-slate-100">
                              STANDARD
                            </span>
                          )}
                        </div>
                      )}
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
                          <h4 className="text-sm font-black text-slate-900">{order.lead.name}</h4>
                          {order.status === 'PAID' && (
                            <span className="bg-emerald-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">Paid</span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 font-bold">{order.lead.contact}</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</span>
                      <span className="text-2xl font-black text-indigo-600 flex items-center gap-0.5">
                        <IndianRupee className="size-5" />
                        {order.amount.toLocaleString()}
                      </span>
                    </div>

                    <div className="bg-slate-50 rounded-2xl p-3">
                      <p className="text-xs text-slate-600 font-medium leading-relaxed italic">
                        "{order.summary}"
                      </p>
                    </div>

                    {/* Resilient Network Connection Error Warning Flip-down banner */}
                    {error && (
                      <motion.div 
                        initial={{ opacity: 0, scaleY: 0.8 }}
                        animate={{ opacity: 1, scaleY: 1 }}
                        className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 space-y-2 flex flex-col shadow-inner origin-top"
                      >
                        <p className="text-[10px] text-amber-800 font-black uppercase tracking-wider leading-tight flex items-start gap-1">
                          <span>⚠️</span>
                          <span>{error}</span>
                        </p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateStatus(order.id, procState.targetStatus || 'SHIPPED');
                          }}
                          className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors cursor-pointer shadow-xs"
                        >
                          Retry Connection Sync
                        </button>
                      </motion.div>
                    )}

                    <div className="flex items-center gap-2 pt-2">
                      {order.status === 'PENDING' && (
                        <div className="flex-1 py-3 bg-slate-50 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest text-center border border-dashed border-slate-200">
                          Waiting for Payment
                        </div>
                      )}
                      {(order.status === 'READY' || order.status === 'PAID') && (
                        <button 
                           onClick={() => updateStatus(order.id, 'SHIPPED')}
                           className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition shadow-lg shadow-indigo-600/20"
                        >
                          Mark as Shipped
                        </button>
                      )}
                      {order.status === 'SHIPPED' && (
                         <button 
                            onClick={() => updateStatus(order.id, 'COMPLETED')}
                            className="flex-1 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition shadow-sm"
                         >
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
