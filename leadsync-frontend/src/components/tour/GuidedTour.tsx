import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight, ChevronLeft, Store, MessageSquare, ShoppingBag, Zap, Settings, Users,
  Check, HelpCircle, ArrowUp
} from 'lucide-react';
import { TabID } from '../layouts/MasterDashboardLayout';

interface TourStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  targetSelector: string;
}

const pageTourSteps: Record<TabID, TourStep[]> = {
  shop: [
    {
      title: 'Daily Collection Stats',
      description: 'See today\'s collections, pending payments, paid orders, and pending orders at a glance.',
      icon: <Store className="h-5 w-5" />,
      targetSelector: '[data-tour="daily-stats"]',
    },
    {
      title: 'Quick Actions',
      description: 'Reply to messages, view orders, check customers, or send offers — all with one tap.',
      icon: <Zap className="h-5 w-5" />,
      targetSelector: '[data-tour="quick-actions"]',
    },
    {
      title: 'Today\'s Activity',
      description: 'Real-time activity pulse showing your shop\'s performance throughout the day.',
      icon: <ShoppingBag className="h-5 w-5" />,
      targetSelector: '[data-tour="todays-activity"]',
    },
    {
      title: 'Getting Started',
      description: 'Start your digital journey — import data or log your first customer.',
      icon: <Zap className="h-5 w-5" />,
      targetSelector: '[data-tour="getting-started"]',
    },
  ],
  messages: [
    {
      title: 'Customer Conversations',
      description: 'When customers message you on WhatsApp or Instagram, their chats appear here. Reply, send invoices, and take orders in one screen.',
      icon: <MessageSquare className="h-5 w-5" />,
      targetSelector: '[data-tour="messages-panel"]',
    },
  ],
  customers: [
    {
      title: 'Customer List',
      description: 'View all your customers, their contact info, order history, and preferences in one place.',
      icon: <Users className="h-5 w-5" />,
      targetSelector: '[data-tour="customers-list"]',
    },
  ],
  broadcast: [
    {
      title: 'Broadcast Engine',
      description: 'Send special offers, new arrivals, or festival greetings to all your customers at once.',
      icon: <Zap className="h-5 w-5" />,
      targetSelector: '[data-tour="broadcast-engine"]',
    },
  ],
  orders: [
    {
      title: 'Order Fulfillment',
      description: 'See all orders, mark them confirmed or shipped, and customers get notified automatically.',
      icon: <ShoppingBag className="h-5 w-5" />,
      targetSelector: '[data-tour="orders-board"]',
    },
  ],
  automation: [
    {
      title: 'Automation Builder',
      description: 'Build automated checkout flows and chatbot responses for your customers.',
      icon: <Zap className="h-5 w-5" />,
      targetSelector: '[data-tour="automation-builder"]',
    },
  ],
  settings: [
    {
      title: 'Shop Settings',
      description: 'Configure your profile, add staff, connect WhatsApp and Instagram. Set everything up the way you want.',
      icon: <Settings className="h-5 w-5" />,
      targetSelector: '[data-tour="settings-page"]',
    },
  ],
};

const DISMISSED_KEY = 'leadsync_tour_dismissed';

interface GuidedTourProps {
  activeTab: TabID;
}

export const GuidedTour: React.FC<GuidedTourProps> = ({ activeTab }) => {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [tourActive, setTourActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [hasTarget, setHasTarget] = useState(false);
  const scrollAttemptRef = useRef(0);
  const [, setRenderTick] = useState(0);

  const steps = pageTourSteps[activeTab] || [];
  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const stepKey = `${activeTab}-${currentStep}`;

  // Clean up when tour deactivates
  useEffect(() => {
    if (!tourActive) {
      setTargetRect(null);
      setHasTarget(false);
      setCurrentStep(0);
    }
  }, [tourActive]);

  // Search for target element when step changes
  useEffect(() => {
    if (!tourActive || !step) return;

    const findTarget = () => {
      setRenderTick(t => t + 1);
      const el = document.querySelector(step.targetSelector);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
          const rect = el.getBoundingClientRect();
          setTargetRect(rect);
          setHasTarget(true);
        }, 400);
        scrollAttemptRef.current = 0;
        return true;
      }
      return false;
    };

    setHasTarget(false);
    setTargetRect(null);

    const timeout = setTimeout(() => {
      if (!findTarget()) {
        const interval = setInterval(() => {
          scrollAttemptRef.current++;
          if (findTarget() || scrollAttemptRef.current > 10) {
            clearInterval(interval);
          }
        }, 250);
      }
    }, 300);

    return () => {
      clearTimeout(timeout);
    };
  }, [currentStep, tourActive, step, stepKey]);

  // Handle resize for spotlight
  useEffect(() => {
    if (!tourActive || !hasTarget || !step) return;
    const handleResize = () => {
      const el = document.querySelector(step.targetSelector);
      if (el) {
        setTargetRect(el.getBoundingClientRect());
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [tourActive, hasTarget, step, stepKey]);

  const handleGuideClick = useCallback(() => {
    if (tourActive) {
      // If tour is active, dismiss it
      setTourActive(false);
      return;
    }
    // Show confirmation dialog
    setShowConfirmation(true);
  }, [tourActive]);

  const handleShow = useCallback(() => {
    setShowConfirmation(false);
    localStorage.removeItem(DISMISSED_KEY);
    setCurrentStep(0);
    setTourActive(true);
  }, []);

  const handleDismissPermanently = useCallback(() => {
    setShowConfirmation(false);
    localStorage.setItem(DISMISSED_KEY, 'true');
  }, []);

  const handleNext = useCallback(() => {
    if (isLastStep) {
      setTourActive(false);
    } else {
      setHasTarget(false);
      setTargetRect(null);
      setCurrentStep(prev => prev + 1);
    }
  }, [isLastStep]);

  const handlePrev = useCallback(() => {
    if (currentStep === 0) return;
    setHasTarget(false);
    setTargetRect(null);
    setCurrentStep(prev => Math.max(0, prev - 1));
  }, [currentStep]);

  const handleSkip = useCallback(() => {
    setTourActive(false);
  }, []);

  const padding = 16;

  // Spotlight clip-path (only if target found)
  const overlayStyle: React.CSSProperties = targetRect ? {
    clipPath: `polygon(
      0% 0%,
      0% 100%,
      100% 100%,
      100% 0%,
      0% 0%,
      ${targetRect.left - padding}px ${targetRect.top - padding}px,
      ${targetRect.left - padding}px ${targetRect.bottom + padding}px,
      ${targetRect.right + padding}px ${targetRect.bottom + padding}px,
      ${targetRect.right + padding}px ${targetRect.top - padding}px,
      ${targetRect.left - padding}px ${targetRect.top - padding}px
    )`,
  } : {};

  // Determine tooltip position relative to target
  const getTooltipPosition = () => {
    if (!targetRect) return { bottom: '2rem', left: '50%', transform: 'translateX(-50%)' };

    const viewportHeight = window.innerHeight;
    const centerY = viewportHeight / 2;
    const isInTopHalf = targetRect.top + targetRect.height / 2 < centerY;

    if (isInTopHalf) {
      // Show below the target
      return {
        top: targetRect.bottom + padding + 12,
        left: Math.max(16, Math.min(targetRect.left + targetRect.width / 2 - 240, window.innerWidth - 496)),
      };
    } else {
      // Show above the target
      return {
        bottom: viewportHeight - targetRect.top + padding + 12,
        left: Math.max(16, Math.min(targetRect.left + targetRect.width / 2 - 240, window.innerWidth - 496)),
      };
    }
  };

  const tooltipPos = getTooltipPosition();

  return (
    <>
      {/* Floating Guide Button - always visible at top-right */}
      <button
        onClick={handleGuideClick}
        className="fixed top-20 right-4 md:top-20 md:right-4 z-50 h-10 w-10 rounded-full bg-brand-navy text-white shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-200 flex items-center justify-center cursor-pointer"
        title="Page guide"
      >
        <HelpCircle className="h-5 w-5" />
      </button>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirmation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => setShowConfirmation(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.2 }}
              className="bg-app-surface rounded-2xl shadow-2xl border border-app-border p-6 w-[90vw] max-w-sm mx-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl bg-brand-saffron-soft text-brand-saffron flex items-center justify-center">
                  <HelpCircle className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-app-text text-lg">Page Guide</h3>
              </div>
              <p className="text-app-text-muted text-sm leading-relaxed mb-6">
                Do you want to know about this page? We'll walk you through each section with a quick guided tour.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDismissPermanently}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-app-text-muted hover:bg-app-bg-soft hover:text-app-text transition-all cursor-pointer"
                >
                  Dismiss
                </button>
                <button
                  onClick={handleShow}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-brand-navy text-white hover:bg-brand-navy/90 transition-all cursor-pointer"
                >
                  Show
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tour Mode */}
      <AnimatePresence>
        {tourActive && step && (
          <>
            {/* Semi-transparent overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-app-backdrop transition-all duration-300"
              style={targetRect ? overlayStyle : {}}
              onClick={handleSkip}
            />

            {/* Spotlight ring (only if target found) */}
            {targetRect && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="fixed z-40 border-2 border-brand-saffron rounded-lg shadow-[0_0_0_4px_rgba(212,168,67,0.3)] pointer-events-none"
                style={{
                  top: targetRect.top - padding,
                  left: targetRect.left - padding,
                  width: targetRect.width + padding * 2,
                  height: targetRect.height + padding * 2,
                }}
              />
            )}

            {/* Dialogue tooltip positioned near the target */}
            <motion.div
              key={stepKey}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="fixed z-50 w-[90vw] max-w-sm"
              style={{
                ...tooltipPos,
                position: 'fixed',
              }}
            >
              {/* Arrow pointing toward target */}
              {hasTarget && (
                <div className={`flex ${targetRect && targetRect.top + targetRect.height / 2 < window.innerHeight / 2 ? 'justify-center mb-1' : 'justify-center mt-1'}`}>
                  <div className="animate-bounce">
                    <ArrowUp className={`h-5 w-5 text-brand-saffron ${targetRect && targetRect.top + targetRect.height / 2 < window.innerHeight / 2 ? '' : 'rotate-180'}`} />
                  </div>
                </div>
              )}

              <div className="bg-app-surface rounded-2xl shadow-2xl border border-app-border p-5">
                {/* Progress dots */}
                <div className="flex gap-1 mb-4">
                  {steps.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-all ${
                        i <= currentStep ? 'bg-brand-navy' : 'bg-app-border'
                      }`}
                    />
                  ))}
                </div>

                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-xl bg-brand-saffron-soft text-brand-saffron flex items-center justify-center shrink-0">
                    {step.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-app-text text-sm">{step.title}</h3>
                    <p className="text-sm text-app-text-muted mt-1 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-app-border">
                  <button
                    onClick={handleSkip}
                    className="text-sm text-app-text-muted hover:text-app-text font-medium cursor-pointer"
                  >
                    Skip tour
                  </button>
                  <div className="flex items-center gap-2">
                    {currentStep > 0 && (
                      <button
                        onClick={handlePrev}
                        className="p-2 rounded-lg hover:bg-app-bg-soft text-app-text-muted cursor-pointer"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={handleNext}
                      className="btn-primary text-sm flex items-center gap-1.5 cursor-pointer"
                    >
                      {isLastStep ? (
                        <>
                          Done
                          <Check className="h-4 w-4" />
                        </>
                      ) : (
                        <>
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export const useGuidedTour = () => {
  return {};
};