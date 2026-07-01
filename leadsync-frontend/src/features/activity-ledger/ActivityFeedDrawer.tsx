import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Zap, Trash2, CheckCircle2, ArrowRight, Sparkles, 
  UserPlus, CreditCard, Layers 
} from 'lucide-react';
import { useActivityStore, SystemEvent } from './useActivityStore';
import { useSimulationStore } from '../../simulation/simulationStore';

interface ActivityFeedDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ActivityFeedDrawer: React.FC<ActivityFeedDrawerProps> = ({ isOpen, onClose }) => {
  const { events, clearEvents, markAsRead, markAllAsRead } = useActivityStore();
  const { activities } = useSimulationStore();
  const [filter, setFilter] = useState<'all' | 'high' | 'payments' | 'leads'>('all');

  // Merge events from both stores for a complete view
  const allEventsOrdered = useMemo(() => {
    const simEvents = activities.map(act => ({
      id: act.id,
      type: (act.action === 'RECV_MSG' ? 'NEW_LEAD' : act.action === 'CLAIM_CHAT' ? 'CLAIMED' : 'APPROVED') as any,
      content: act.action === 'RECV_MSG' 
        ? `[SIM] New message from ${act.target}` 
        : act.action === 'CLAIM_CHAT' 
        ? `[SIM] ${act.user} claimed chat with ${act.target}`
        : `[SIM] ${act.user} approved order ${act.target}`,
      timestamp: act.time,
      priority: 'high' as const,
      read: true,
      actionLink: undefined as string | undefined
    }));

    return [...simEvents, ...events].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [activities, events]);

  // Filtered list
  const filteredEvents = allEventsOrdered.filter(e => {
    if (filter === 'high') return e.priority === 'high';
    if (filter === 'payments') return e.type === 'PAYMENT_SUCCESS' || e.type === 'ORDER_PLACED';
    if (filter === 'leads') return e.type === 'NEW_LEAD' || e.type === 'ABANDONED_CART';
    return true;
  });

  const getEventIconAndStyle = (event: SystemEvent) => {
    switch (event.type) {
      case 'PAYMENT_SUCCESS':
      case 'ORDER_PLACED':
        return {
          icon: CreditCard,
          bg: 'bg-teal-500/10 border-teal-500/30 text-teal-400',
          accent: 'border-l-4 border-l-teal-500'
        };
      case 'NEW_LEAD':
        return {
          icon: UserPlus,
          bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
          accent: 'border-l-4 border-l-amber-500'
        };
      case 'CLAIMED':
        return {
          icon: Zap,
          bg: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400',
          accent: 'border-l-4 border-l-indigo-500'
        };
      case 'APPROVED':
        return {
          icon: CheckCircle2,
          bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
          accent: 'border-l-4 border-l-emerald-500'
        };
      case 'ABANDONED_CART':
      case 'ACTION_REQUIRED':
        return {
          icon: Sparkles,
          bg: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
          accent: 'border-l-4 border-l-rose-500'
        };
      default:
        return {
          icon: Sparkles,
          bg: 'bg-slate-800 border-slate-705 text-amber-300',
          accent: 'border-l-4 border-l-slate-700'
        };
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Dark Overlay with blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[100]"
          />

          {/* Slide-over Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 24, stiffness: 220 }}
            className="fixed top-0 right-0 h-full w-full max-w-[460px] bg-[#05060b] border-l border-slate-900 shadow-2xl z-[101] flex flex-col font-sans"
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-900 bg-[#090a10] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-400/30 flex items-center justify-center text-amber-400">
                  <Zap className="h-4.5 w-4.5 fill-amber-400/20" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-100 tracking-wide uppercase">Business life stream</h3>
                  <p className="text-[10px] text-slate-450 uppercase font-black tracking-widest mt-0.5">Unified System Ledger</p>
                </div>
              </div>
              
              <button
                onClick={onClose}
                className="h-8 w-8 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/30 hover:bg-slate-900/80 text-slate-400 hover:text-slate-200 flex items-center justify-center transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Filters bar */}
            <div className="px-6 py-3.5 bg-[#090a10]/50 border-b border-slate-900 flex items-center justify-between gap-1.5">
              <div className="flex gap-1.5 overflow-x-auto py-0.5 no-scrollbar">
                {[
                  { id: 'all', label: 'All Log' },
                  { id: 'high', label: 'Priority' },
                  { id: 'payments', label: 'Payments' },
                  { id: 'leads', label: 'Leads' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setFilter(tab.id as any)}
                    className={`px-3 py-1 rounded-full text-[10px] font-bold transition border shrink-0 cursor-pointer ${
                      filter === tab.id
                        ? 'bg-amber-500/15 border-amber-400/40 text-amber-300'
                        : 'bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 border-l border-slate-800 pl-3 shrink-0">
                <button
                  onClick={markAllAsRead}
                  title="Mark all as read"
                  className="p-1 h-7 w-7 rounded-md hover:bg-slate-900 text-slate-450 hover:text-emerald-400 transition cursor-pointer flex items-center justify-center border border-transparent hover:border-slate-800"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={clearEvents}
                  title="Clear ledger"
                  className="p-1 h-7 w-7 rounded-md hover:bg-slate-900 text-slate-450 hover:text-rose-400 transition cursor-pointer flex items-center justify-center border border-transparent hover:border-slate-800"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Event List (Life Stream) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0 bg-[#05060b]">
              <AnimatePresence initial={false}>
                {filteredEvents.length > 0 ? (
                  filteredEvents.map((event) => {
                    const style = getEventIconAndStyle(event);
                    const IconComp = style.icon;
                    return (
                      <motion.div
                        key={event.id}
                        initial={{ opacity: 0, y: -20, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ type: 'spring', damping: 18, stiffness: 240 }}
                        className={`group bg-[#090a10] border border-slate-900 rounded-2xl p-4.5 relative overflow-hidden transition-all duration-200 hover:bg-[#0d0e16] hover:border-slate-850 shadow-md ${
                          style.accent
                        } ${!event.read ? 'bg-[#0a0c16]/80 ring-1 ring-amber-500/15' : ''}`}
                      >
                        {/* Status notification dot */}
                        {!event.read && (
                          <span className="absolute top-4 right-4 h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse border border-[#05060b]" />
                        )}

                        <div className="flex gap-4 items-start">
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center border shrink-0 ${style.bg}`}>
                            <IconComp className="h-4 w-4" />
                          </div>

                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="text-[10px] font-mono font-black text-slate-450 uppercase tracking-widest">
                                {event.type.replace('_', ' ')}
                              </span>
                              <span className="text-[9px] font-semibold text-slate-500 font-mono">
                                {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                            </div>

                            <p className="text-xs text-slate-300 leading-relaxed font-semibold">
                              {event.content}
                            </p>

                            {/* Actions links if present */}
                            {(event.actionLink || !event.read) && (
                              <div className="pt-2 flex items-center gap-3">
                                {!event.read && (
                                  <button
                                    onClick={() => markAsRead(event.id)}
                                    className="text-[9px] font-extrabold text-emerald-450 hover:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-400/20 px-2 py-0.5 rounded transition cursor-pointer"
                                  >
                                    Acknowledge
                                  </button>
                                )}
                                {event.actionLink && (
                                  <a
                                    href={event.actionLink}
                                    className="text-[9px] font-extrabold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition decoration-transparent"
                                  >
                                    View Source <ArrowRight className="h-2.5 w-2.5" />
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="h-full flex flex-col items-center justify-center text-center py-12 px-6"
                  >
                    <Layers className="h-9 w-9 text-slate-800 mb-3" />
                    <h4 className="text-slate-300 font-bold text-sm tracking-wide uppercase">All quiet on Ledger</h4>
                    <p className="text-[10px] text-slate-500 max-w-xs mt-1">
                      No matching events logged yet. Use the simulator tools above to live inject new buyer streams and webhook matches!
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
