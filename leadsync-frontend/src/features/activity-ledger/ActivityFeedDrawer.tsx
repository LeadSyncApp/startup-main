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

  const eventColorMap: Record<string, { cssVar: string; icon: typeof CreditCard }> = {
    PAYMENT_SUCCESS: { cssVar: '--success-green', icon: CreditCard },
    ORDER_PLACED: { cssVar: '--success-green', icon: CreditCard },
    NEW_LEAD: { cssVar: '--brand-saffron', icon: UserPlus },
    CLAIMED: { cssVar: '--info-blue', icon: Zap },
    APPROVED: { cssVar: '--success-green', icon: CheckCircle2 },
    ABANDONED_CART: { cssVar: '--danger-red', icon: Sparkles },
    ACTION_REQUIRED: { cssVar: '--danger-red', icon: Sparkles },
  };

  const getEventIconAndStyle = (event: SystemEvent) => {
    const mapping = eventColorMap[event.type];
    const cssVar = mapping?.cssVar || '--brand-saffron';
    const IconComp = mapping?.icon || Sparkles;
    return { IconComp, cssVar };
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
            className="fixed top-0 right-0 h-full w-full max-w-[460px] bg-[var(--app-bg)] border-l border-[var(--app-border)] shadow-2xl z-[101] flex flex-col font-sans"
          >
            {/* Header */}
            <div className="p-6 border-b border-[var(--app-border)] bg-[var(--app-surface)] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--brand-saffron) 10%, transparent)', borderColor: 'var(--brand-saffron)', color: 'var(--brand-saffron)', borderWidth: 1 }}>
                  <Zap className="h-4.5 w-4.5" style={{ fill: 'var(--brand-saffron)', opacity: 0.2 }} />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[var(--app-text)] tracking-wide uppercase">Business life stream</h3>
                  <p className="text-[10px] uppercase font-black tracking-widest mt-0.5 text-[var(--app-text-muted)]">Unified System Ledger</p>
                </div>
              </div>
              
              <button
                onClick={onClose}
                className="h-8 w-8 rounded-lg border flex items-center justify-center transition cursor-pointer"
                style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-bg-soft)', color: 'var(--app-text-muted)' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--app-surface)'; e.currentTarget.style.color = 'var(--app-text)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--app-bg-soft)'; e.currentTarget.style.color = 'var(--app-text-muted)'; }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Filters bar */}
            <div className="px-6 py-3.5 border-b flex items-center justify-between gap-1.5" style={{ backgroundColor: 'var(--app-bg-soft)', borderColor: 'var(--app-border)' }}>
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
                        ? 'text-[var(--brand-saffron)]'
                        : 'bg-transparent border-transparent text-[var(--app-text-muted)]'
                    }`}
                    style={filter === tab.id ? { backgroundColor: 'color-mix(in srgb, var(--brand-saffron) 15%, transparent)', borderColor: 'var(--brand-saffron)' } : {}}
                    onMouseEnter={(e) => { if (filter !== tab.id) { e.currentTarget.style.color = 'var(--app-text)'; e.currentTarget.style.backgroundColor = 'var(--app-bg)'; } }}
                    onMouseLeave={(e) => { if (filter !== tab.id) { e.currentTarget.style.color = 'var(--app-text-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; } }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 pl-3 shrink-0" style={{ borderLeftWidth: 1, borderLeftColor: 'var(--app-border)' }}>
                <button
                  onClick={markAllAsRead}
                  title="Mark all as read"
                  className="p-1 h-7 w-7 rounded-md transition cursor-pointer flex items-center justify-center border border-transparent"
                  style={{ color: 'var(--app-text-muted)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--app-bg-soft)'; e.currentTarget.style.color = 'var(--success-green)'; e.currentTarget.style.borderColor = 'var(--app-border)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--app-text-muted)'; e.currentTarget.style.borderColor = 'transparent'; }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={clearEvents}
                  title="Clear ledger"
                  className="p-1 h-7 w-7 rounded-md transition cursor-pointer flex items-center justify-center border border-transparent"
                  style={{ color: 'var(--app-text-muted)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--app-bg-soft)'; e.currentTarget.style.color = 'var(--danger-red)'; e.currentTarget.style.borderColor = 'var(--app-border)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--app-text-muted)'; e.currentTarget.style.borderColor = 'transparent'; }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Event List (Life Stream) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0 bg-[var(--app-bg)]">
              <AnimatePresence initial={false}>
                {filteredEvents.length > 0 ? (
                  filteredEvents.map((event) => {
                    const { IconComp, cssVar } = getEventIconAndStyle(event);
                    const isUnread = !event.read;
                    return (
                      <motion.div
                        key={event.id}
                        initial={{ opacity: 0, y: -20, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ type: 'spring', damping: 18, stiffness: 240 }}
                        className="group rounded-2xl p-4.5 relative overflow-hidden transition-all duration-200 shadow-md"
                        style={{
                          backgroundColor: isUnread ? 'var(--app-bg-soft)' : 'var(--app-surface)',
                          borderColor: 'var(--app-border)',
                          borderWidth: 1,
                          borderLeft: `4px solid var(${cssVar})`,
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--app-bg-soft)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isUnread ? 'var(--app-bg-soft)' : 'var(--app-surface)'; }}
                      >
                        {/* Status notification dot */}
                        {isUnread && (
                          <span className="absolute top-4 right-4 h-2.5 w-2.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--brand-saffron)', borderColor: 'var(--app-bg)' }} />
                        )}

                        <div className="flex gap-4 items-start">
                          <div
                            className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                            style={{
                              backgroundColor: `color-mix(in srgb, var(${cssVar}) 10%, transparent)`,
                              borderColor: `color-mix(in srgb, var(${cssVar}) 30%, transparent)`,
                              color: `var(${cssVar})`,
                              borderWidth: 1,
                            }}
                          >
                            <IconComp className="h-4 w-4" />
                          </div>

                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="text-[10px] font-mono font-black uppercase tracking-widest text-[var(--app-text-muted)]">
                                {event.type.replace('_', ' ')}
                              </span>
                              <span className="text-[9px] font-semibold font-mono text-[var(--app-text-muted)]">
                                {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                            </div>

                            <p className="text-xs leading-relaxed font-semibold text-[var(--app-text)]">
                              {event.content}
                            </p>

                            {/* Actions links if present */}
                            {(event.actionLink || isUnread) && (
                              <div className="pt-2 flex items-center gap-3">
                                {isUnread && (
                                  <button
                                    onClick={() => markAsRead(event.id)}
                                    className="text-[9px] font-extrabold px-2 py-0.5 rounded transition cursor-pointer"
                                    style={{
                                      color: 'var(--success-green)',
                                      backgroundColor: 'color-mix(in srgb, var(--success-green) 10%, transparent)',
                                      borderColor: 'color-mix(in srgb, var(--success-green) 20%, transparent)',
                                      borderWidth: 1,
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = `color-mix(in srgb, var(--success-green) 15%, transparent)`; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = `color-mix(in srgb, var(--success-green) 10%, transparent)`; }}
                                  >
                                    Acknowledge
                                  </button>
                                )}
                                {event.actionLink && (
                                  <a
                                    href={event.actionLink}
                                    className="text-[9px] font-extrabold flex items-center gap-1 transition decoration-transparent"
                                    style={{ color: 'var(--brand-saffron)' }}
                                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--brand-saffron)'; e.currentTarget.style.opacity = '0.8'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--brand-saffron)'; e.currentTarget.style.opacity = '1'; }}
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
                    <Layers className="h-9 w-9 mb-3 text-[var(--app-text-muted)]" />
                    <h4 className="font-bold text-sm tracking-wide uppercase text-[var(--app-text)]">All quiet on Ledger</h4>
                    <p className="text-[10px] max-w-xs mt-1 text-[var(--app-text-muted)]">
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
