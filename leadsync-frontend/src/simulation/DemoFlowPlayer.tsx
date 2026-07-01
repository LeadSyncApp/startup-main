import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, MessageSquare, ShoppingBag, Globe, Instagram, Smartphone,
  CheckCircle2, Clock, UserCheck, Bot, ArrowRight,
  IndianRupee, Sparkles
} from 'lucide-react';
import { DEMO_SCENES, DEMO_ORDERS, DEMO_CONVERSATIONS } from './DemoScenes';
import type { TabID } from '../components/layouts/MasterDashboardLayout';

interface DemoFlowPlayerProps {
  onNavigate: (tab: TabID) => void;
  onClose: () => void;
  onComplete: () => void;
}

const PLATFORM_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  whatsapp: { icon: Smartphone, color: '#25D366', bg: 'bg-green-50' },
  instagram: { icon: Instagram, color: '#E4405F', bg: 'bg-pink-50' },
  web: { icon: Globe, color: '#6366F1', bg: 'bg-indigo-50' },
};

export const DemoFlowPlayer: React.FC<DemoFlowPlayerProps> = ({ onNavigate, onClose, onComplete }) => {
  const [currentSceneIdx, setCurrentSceneIdx] = useState(0);
  const [visibleOrders, setVisibleOrders] = useState<number[]>([]);
  const [assignedOrders, setAssignedOrders] = useState<number[]>([]);
  const [visibleMessages, setVisibleMessages] = useState<number[]>([]);
  const [showCompletion, setShowCompletion] = useState(false);
  const [progress, setProgress] = useState(0);
  const sceneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animTimerRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const currentScene = DEMO_SCENES[currentSceneIdx];

  const clearTimers = useCallback(() => {
    if (sceneTimerRef.current) clearTimeout(sceneTimerRef.current);
    animTimerRef.current.forEach(t => clearTimeout(t));
    animTimerRef.current = [];
  }, []);

  const advanceScene = useCallback(() => {
    const nextIdx = currentSceneIdx + 1;
    if (nextIdx >= DEMO_SCENES.length) {
      setShowCompletion(true);
      setProgress(100);
      setTimeout(() => {
        onComplete();
        onClose();
      }, 3000);
      return;
    }
    const nextScene = DEMO_SCENES[nextIdx];
    if (nextScene.navigateTo) {
      onNavigate(nextScene.navigateTo);
    }
    setCurrentSceneIdx(nextIdx);
    setVisibleOrders([]);
    setAssignedOrders([]);
    setVisibleMessages([]);
  }, [currentSceneIdx, onNavigate, onComplete, onClose]);

  // Progress tracking
  useEffect(() => {
    const totalDuration = DEMO_SCENES.reduce((sum, s) => sum + Math.max(s.duration, 100), 0);
    const elapsed = DEMO_SCENES.slice(0, currentSceneIdx).reduce((sum, s) => sum + Math.max(s.duration, 100), 0);
    setProgress(Math.min(100, (elapsed / totalDuration) * 100));
  }, [currentSceneIdx]);

  // Auto-advance for timed scenes
  useEffect(() => {
    clearTimers();
    if (!currentScene || currentScene.id === 'conversation-demo' || currentScene.id === 'complete') return;

    sceneTimerRef.current = setTimeout(() => {
      advanceScene();
    }, currentScene.duration);

    return () => {
      if (sceneTimerRef.current) clearTimeout(sceneTimerRef.current);
    };
  }, [currentScene, advanceScene, clearTimers]);

  // Scene-specific animation triggers
  useEffect(() => {
    if (!currentScene) return;
    clearTimers();

    const timers: ReturnType<typeof setTimeout>[] = [];

    if (currentScene.id === 'incoming-orders') {
      DEMO_ORDERS.forEach((order) => {
        const t = setTimeout(() => {
          setVisibleOrders(prev => [...prev, DEMO_ORDERS.indexOf(order)]);
        }, order.delay);
        timers.push(t);
      });
    }

    if (currentScene.id === 'auto-assignment') {
      // Show all orders first
      setVisibleOrders([0, 1, 2]);
      DEMO_ORDERS.forEach((order) => {
        const t = setTimeout(() => {
          setAssignedOrders(prev => [...prev, DEMO_ORDERS.indexOf(order)]);
        }, order.delay - 300);
        timers.push(t);
      });
    }

    if (currentScene.id === 'conversation-demo') {
      const allConversations = DEMO_CONVERSATIONS;
      let totalDelay = 0;
      allConversations.forEach((conv) => {
        conv.messages.forEach((msg) => {
          const t = setTimeout(() => {
            setVisibleMessages(prev => [...prev, allConversations.indexOf(conv) * 100 + conv.messages.indexOf(msg)]);
          }, msg.delay);
          timers.push(t);
          totalDelay = Math.max(totalDelay, msg.delay);
        });
      });
      // Auto-advance after all messages play
      const advanceT = setTimeout(() => {
        advanceScene();
      }, totalDelay + 3000);
      timers.push(advanceT);
    }

    animTimerRef.current = timers;
    return () => timers.forEach(t => clearTimeout(t));
  }, [currentScene, advanceScene, clearTimers]);

  const handleNext = () => {
    if (currentScene?.id === 'complete') {
      setShowCompletion(true);
      setTimeout(() => { onComplete(); onClose(); }, 500);
      return;
    }
    advanceScene();
  };

  const handleSkip = () => {
    clearTimers();
    setShowCompletion(true);
    setTimeout(() => { onComplete(); onClose(); }, 500);
  };

  const renderSceneContent = () => {
    if (!currentScene) return null;

    switch (currentScene.id) {
      case 'incoming-orders':
        return (
          <div className="space-y-3 w-full max-w-lg mx-auto">
            <div className="text-center mb-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-50 text-green-700 text-xs font-semibold">
                <Zap className="h-3 w-3" />
                Real-time sync active
              </div>
            </div>
            <AnimatePresence>
              {DEMO_ORDERS.map((order, idx) => {
                const isVisible = visibleOrders.includes(idx);
                const cfg = PLATFORM_CONFIG[order.platform];
                const Icon = cfg?.icon || ShoppingBag;
                const dir = idx === 0 ? -50 : idx === 1 ? 50 : -30;
                return (
                  <AnimatePresence key={order.customerName}>
                    {isVisible && (
                      <motion.div
                        initial={{ opacity: 0, x: dir, scale: 0.9 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                        className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 rounded-xl ${cfg?.bg || 'bg-gray-50'} flex items-center justify-center shrink-0`}>
                            <Icon className="h-5 w-5" style={{ color: cfg?.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">{order.customerName}</p>
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                Priority {order.priorityScore}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{order.items.join(', ')}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-sm font-bold text-green-600 dark:text-green-400">₹{order.amount.toLocaleString('en-IN')}</span>
                              <span className="text-2xs text-slate-400 uppercase">{order.platform}</span>
                            </div>
                          </div>
                        </div>
                        {/* Priority bar */}
                        <div className="mt-3 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${order.priorityScore}%` }}
                            transition={{ duration: 0.8, delay: 0.3 }}
                            className="h-full rounded-full bg-gradient-to-r from-green-400 to-emerald-500"
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                );
              })}
            </AnimatePresence>
            {visibleOrders.length === DEMO_ORDERS.length && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center text-xs text-green-600 dark:text-green-400 font-semibold mt-2"
              >
                ✓ 3 orders synced from 3 platforms
              </motion.p>
            )}
          </div>
        );

      case 'auto-assignment':
        return (
          <div className="space-y-3 w-full max-w-lg mx-auto">
            <div className="text-center mb-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
                <UserCheck className="h-3 w-3" />
                Smart assignment based on workload
              </div>
            </div>
            {DEMO_ORDERS.map((order, idx) => {
              const isAssigned = assignedOrders.includes(idx);
              const cfg = PLATFORM_CONFIG[order.platform];
              const Icon = cfg?.icon || ShoppingBag;
              return (
                <motion.div
                  key={order.customerName}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.15 }}
                  className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-xl ${cfg?.bg || 'bg-gray-50'} flex items-center justify-center shrink-0`}>
                      <Icon className="h-5 w-5" style={{ color: cfg?.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-sm text-slate-800 dark:text-slate-100">{order.customerName}</p>
                        <span className="text-xs font-bold text-amber-600">P{order.priorityScore}</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">₹{order.amount.toLocaleString('en-IN')} · {order.items.length} items</p>
                    </div>
                  </div>
                  <AnimatePresence>
                    {isAssigned && order.assignedTo && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700"
                      >
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-brand-navy text-white flex items-center justify-center text-xs font-bold">
                            {order.assignedTo.name[0]}
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                              Assigned to <span className="text-brand-navy dark:text-brand-saffron">{order.assignedTo.name}</span>
                              <span className="text-slate-400 font-normal"> · {order.assignedTo.role}</span>
                            </p>
                            <p className="text-2xs text-slate-400">Workload: Least busy</p>
                          </div>
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
            {assignedOrders.length === DEMO_ORDERS.length && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center text-xs text-green-600 dark:text-green-400 font-semibold mt-1"
              >
                ✓ All orders assigned to available team members
              </motion.p>
            )}
          </div>
        );

      case 'navigate-messages':
        return (
          <div className="flex flex-col items-center gap-4 py-6">
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <MessageSquare className="h-12 w-12 text-brand-saffron" />
            </motion.div>
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
              Navigating to Messages...
            </p>
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  className="h-2 w-2 rounded-full bg-brand-saffron"
                />
              ))}
            </div>
          </div>
        );

      case 'conversation-demo':
        return (
          <div className="w-full max-w-2xl mx-auto space-y-6">
            {/* Conversation 1: Staff handled */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-6 w-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs">👤</div>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Riya Sharma · Staff handled</span>
                <div className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-2xs font-semibold">
                  <CheckCircle2 className="h-3 w-3" /> Staff
                </div>
              </div>
              <div className="space-y-2">
                {DEMO_CONVERSATIONS[0].messages.map((msg, idx) => {
                  const isVisible = visibleMessages.includes(idx);
                  const isStaff = msg.sender === 'staff';
                  return (
                    <AnimatePresence key={idx}>
                      {isVisible && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          className={`flex ${isStaff ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                            isStaff
                              ? 'bg-brand-navy text-white rounded-br-md'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-md'
                          }`}>
                            {msg.content.split('\n').map((line, i) => (
                              <p key={i} className="text-sm leading-relaxed">{line}</p>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  );
                })}
              </div>
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-dashed border-slate-300 dark:border-slate-600" />
              </div>
              <div className="relative flex justify-center">
                <span className="px-3 text-2xs text-slate-400 bg-app-bg">vs</span>
              </div>
            </div>

            {/* Conversation 2: AI handled */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-6 w-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs">🤖</div>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Ananya Gupta · AI handled</span>
                <div className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-2xs font-semibold">
                  <Bot className="h-3 w-3" /> AI Auto-Reply
                </div>
              </div>
              <div className="space-y-2">
                {DEMO_CONVERSATIONS[1].messages.map((msg, idx) => {
                  const msgIdx = DEMO_CONVERSATIONS[0].messages.length + idx;
                  const isVisible = visibleMessages.includes(msgIdx);
                  const isAI = msg.sender === 'ai-bot';
                  return (
                    <AnimatePresence key={msgIdx}>
                      {isVisible && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          className={`flex ${isAI ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                            isAI
                              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-br-md'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-md'
                          }`}>
                            {msg.content.split('\n').map((line, i) => (
                              <p key={i} className="text-sm leading-relaxed">{line}</p>
                            ))}
                            {isAI && (
                              <div className="flex items-center gap-1 mt-1">
                                <Bot className="h-3 w-3 text-purple-200" />
                                <span className="text-2xs text-purple-200 font-medium">AI Generated</span>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  );
                })}
              </div>
            </div>
          </div>
        );

      case 'order-confirmed':
        return (
          <div className="flex flex-col items-center gap-4 py-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1, rotate: [0, -10, 10, 0] }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            >
              <ShoppingBag className="h-12 w-12 text-green-500" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <p className="text-lg font-bold text-green-600 dark:text-green-400">2 Orders Confirmed ✅</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Total: ₹21,000 in revenue</p>
            </motion.div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Clock className="h-3 w-3" />
              Syncing to Orders board...
            </div>
          </div>
        );

      case 'orders-board':
        return (
          <div className="space-y-3 w-full max-w-lg mx-auto">
            <div className="flex items-center gap-2 justify-center mb-2">
              <div className="h-6 w-6 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">📋</div>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Order Fulfillment Board</span>
            </div>
            {[
              { id: '#ORD-001', customer: 'Riya Sharma', amount: 17800, status: 'APPROVED', staff: 'Rahul', priority: 92 },
              { id: '#ORD-002', customer: 'Ananya Gupta', amount: 3200, status: 'APPROVED', staff: 'AI', priority: 85 },
              { id: '#ORD-003', customer: 'Priya Mehta', amount: 6800, status: 'PENDING', staff: 'Priya', priority: 76 },
            ].map((order, idx) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.2 }}
                className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                      order.status === 'APPROVED' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'
                    }`}>
                      <ShoppingBag className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm text-slate-800 dark:text-slate-100">{order.customer}</p>
                        <span className="text-2xs font-mono text-slate-400">{order.id}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span>₹{order.amount.toLocaleString('en-IN')}</span>
                        <span>·</span>
                        <span>Assigned: {order.staff}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      order.status === 'APPROVED' 
                        ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    }`}>
                      {order.status}
                    </span>
                    <p className="text-2xs text-slate-400 mt-1">P{order.priority}</p>
                  </div>
                </div>
              </motion.div>
            ))}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center text-xs text-green-600 dark:text-green-400 font-semibold mt-2"
            >
              ✓ Orders synced across fulfillment pipeline
            </motion.p>
          </div>
        );

      case 'back-to-home':
        return (
          <div className="flex flex-col items-center gap-4 py-6">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <IndianRupee className="h-12 w-12 text-green-500" />
            </motion.div>
            <div className="text-center space-y-2">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <p className="text-lg font-bold text-green-600 dark:text-green-400">Dashboard Updated!</p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="grid grid-cols-2 gap-3 mt-4"
              >
                <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700 text-center">
                  <p className="text-2xs text-slate-400 uppercase">Today's Collection</p>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="text-lg font-bold text-green-600"
                  >
                    ₹21,000
                  </motion.p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700 text-center">
                  <p className="text-2xs text-slate-400 uppercase">Orders Today</p>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.0 }}
                    className="text-lg font-bold text-brand-navy dark:text-brand-saffron"
                  >
                    3 New
                  </motion.p>
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5 }}
                className="flex items-center gap-1 justify-center text-xs text-slate-400 mt-3"
              >
                <Sparkles className="h-3 w-3" />
                Real-time sync · Auto-prioritized · Team assigned
              </motion.div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Completion overlay
  if (showCompletion) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      >
        <motion.div
          animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.05, 1] }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-2xl border border-brand-saffron/30 max-w-sm mx-4">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Demo Complete!</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              You've seen how LeadSync handles orders, conversations, team assignment, and real-time dashboard updates.
            </p>
            <button
              onClick={onClose}
              className="mt-6 px-6 py-2.5 bg-brand-navy text-white rounded-xl text-sm font-semibold hover:bg-brand-navy-light transition-all"
            >
              Explore the App
            </button>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex flex-col bg-app-bg/95 backdrop-blur-sm overflow-y-auto"
    >
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-slate-200 dark:bg-slate-700 z-[10000]">
        <motion.div
          className="h-full bg-gradient-to-r from-brand-saffron to-green-500"
          style={{ width: `${progress}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      {/* Close button */}
      <div className="fixed top-4 right-4 z-[10000]">
        <button
          onClick={handleSkip}
          className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow transition-all cursor-pointer"
        >
          Skip Demo
        </button>
      </div>

      {/* Scene counter */}
      <div className="fixed top-4 left-4 z-[10000]">
        <span className="text-xs font-mono text-slate-400">
          {currentSceneIdx + 1} / {DEMO_SCENES.length}
        </span>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 pt-20 pb-24">
        {/* Scene header */}
        {currentScene.title && (
          <motion.div
            key={currentScene.title}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">{currentScene.title}</h2>
            {currentScene.description && (
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">{currentScene.description}</p>
            )}
          </motion.div>
        )}

        {/* Scene content */}
        <motion.div
          key={currentScene.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-2xl"
        >
          {renderSceneContent()}
        </motion.div>
      </div>

      {/* Bottom navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 z-[10000]">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex gap-1.5">
            {DEMO_SCENES.map((scene, idx) => (
              <div
                key={scene.id}
                className={`h-1.5 w-6 rounded-full transition-all ${
                  idx === currentSceneIdx
                    ? 'bg-brand-saffron'
                    : idx < currentSceneIdx
                      ? 'bg-green-400'
                      : 'bg-slate-200 dark:bg-slate-700'
                }`}
              />
            ))}
          </div>
          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-navy text-white rounded-xl text-sm font-semibold hover:bg-brand-navy-light transition-all shadow-lg hover:shadow-xl cursor-pointer"
          >
            {currentScene?.id === 'complete' ? 'Finish' : 'Next'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};