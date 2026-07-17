import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Play, X, MonitorSmartphone, Sparkles } from 'lucide-react';
import { DemoFlowPlayer } from './DemoFlowPlayer';
import type { TabID } from '../components/layouts/MasterDashboardLayout';

interface SimulationControllerProps {
  onNavigate: (tab: TabID) => void;
}

export const SimulationController: React.FC<SimulationControllerProps> = ({ onNavigate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  const handleStartDemo = useCallback(() => {
    setIsOpen(false);
    setShowDemo(true);
  }, []);

  const handleCloseDemo = useCallback(() => {
    setShowDemo(false);
  }, []);

  const handleComplete = useCallback(() => {
    // Could track demo completed state here
  }, []);

  return createPortal(
    <>
      {/* Demo Flow Player (fullscreen overlay) */}
      <AnimatePresence>
        {showDemo && (
          <DemoFlowPlayer
            onNavigate={onNavigate}
            onClose={handleCloseDemo}
            onComplete={handleComplete}
          />
        )}
      </AnimatePresence>

      {/* Floating trigger button */}
      <div className="fixed bottom-6 right-6 z-[2147483647] pointer-events-none select-none flex flex-col items-end">
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className="pointer-events-auto mb-4 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl p-5 shadow-[0_20px_50px_rgba(212,168,67,0.15)] dark:shadow-[0_20px_50px_rgba(212,168,67,0.08)] overflow-hidden relative"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-saffron/5 rounded-full blur-3xl pointer-events-none" />
              
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <MonitorSmartphone className="h-4 w-4 text-brand-saffron" />
                  <h3 className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-[0.2em]">Demo Mode</h3>
                </div>
                <button 
                  onClick={() => setIsOpen(false)} 
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3">
                {/* Play Demo Button */}
                <button 
                  onClick={handleStartDemo}
                  className="w-full flex items-center justify-between p-3.5 bg-gradient-to-r from-brand-saffron/10 to-amber-50 dark:from-brand-saffron/5 dark:to-slate-800 hover:from-brand-saffron/20 hover:to-amber-100 dark:hover:from-brand-saffron/10 dark:hover:to-slate-700 rounded-2xl border border-brand-saffron/20 hover:border-brand-saffron/40 transition-all text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-brand-saffron/15 flex items-center justify-center text-brand-saffron group-hover:scale-110 transition-transform">
                      <Play className="h-5 w-5 ml-0.5" />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-slate-800 dark:text-slate-100">Watch Full Demo</div>
                      <div className="text-[9px] text-slate-500">See the complete order flow</div>
                    </div>
                  </div>
                  <Sparkles className="h-3.5 w-3.5 text-brand-saffron group-hover:rotate-12 transition-transform" />
                </button>

                {/* Info box */}
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-slate-700/50 mt-2">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Zap className="h-3 w-3 text-brand-saffron" />
                    <span className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">What you'll see</span>
                  </div>
                  <ul className="space-y-1">
                    {[
                      'Orders from WhatsApp, Instagram & Web',
                      'Smart priority sorting & team assignment',
                      'Staff vs AI conversation handling',
                      'Order confirmation & fulfillment board',
                      'Real-time dashboard revenue update',
                    ].map((item, i) => (
                      <li key={i} className="text-[9px] text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                        <span className="h-1 w-1 rounded-full bg-brand-saffron/60" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`pointer-events-auto h-14 w-14 rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 group relative ${
            isOpen 
              ? 'bg-slate-100 dark:bg-slate-800 text-brand-saffron rotate-90' 
              : 'bg-gradient-to-br from-brand-saffron to-amber-500 text-white'
          }`}
        >
          <Zap className={`h-6 w-6 transition-transform duration-500 ${isOpen ? 'scale-75' : ''}`} />
          <div className={`absolute inset-0 rounded-2xl border-2 border-brand-saffron/30 animate-ping ${isOpen ? 'hidden' : 'block'}`} />
        </button>
      </div>
    </>,
    document.body
  );
};