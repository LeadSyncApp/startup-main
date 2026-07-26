import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, X, ChevronRight } from 'lucide-react';
import { TabID } from '../layouts/MasterDashboardLayout';
import { getGuideForPage } from './guideRegistry';
import type { GuideSection } from '../../guides/types';

const HIGHLIGHT_PULSE_MS = 3000;

interface GuidedTourProps {
  activeTab: TabID;
}

export const GuidedTour: React.FC<GuidedTourProps> = ({ activeTab }) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const guide = getGuideForPage(activeTab);
  const sections: GuideSection[] = guide?.sections ?? [];

  // Close drawer and clear highlight when tab changes
  useEffect(() => {
    setDrawerOpen(false);
    setActiveSectionId(null);
    setHighlightRect(null);
    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = null;
    }
  }, [activeTab]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, []);

  const handleSectionClick = useCallback((section: GuideSection) => {
    const selector = `[data-tour="${section.id}"]`;
    const el = document.querySelector(selector);
    if (!el) return;

    el.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Clear previous highlight immediately
    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
    }
    setHighlightRect(null);
    setActiveSectionId(section.id);

    // Wait for scroll to finish, then measure and show highlight
    setTimeout(() => {
      const rect = el.getBoundingClientRect();
      setHighlightRect(rect);
    }, 400);

    // Auto-dismiss highlight after delay
    highlightTimerRef.current = setTimeout(() => {
      setHighlightRect(null);
      setActiveSectionId(null);
      highlightTimerRef.current = null;
    }, HIGHLIGHT_PULSE_MS);
  }, []);

  const handleHelpClick = useCallback(() => {
    setDrawerOpen(prev => !prev);
    if (drawerOpen) {
      setActiveSectionId(null);
      setHighlightRect(null);
    }
  }, [drawerOpen]);

  const handleCloseDrawer = useCallback(() => {
    setDrawerOpen(false);
    setActiveSectionId(null);
    setHighlightRect(null);
  }, []);

  return (
    <>
      {/* Help Button — fixed top-right */}
      <button
        onClick={handleHelpClick}
        className="fixed top-20 right-4 md:top-20 md:right-4 z-50 h-10 w-10 rounded-full bg-[var(--brand-navy,#D36B46)] text-white shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-200 flex items-center justify-center cursor-pointer"
        title="Page guide"
      >
        {drawerOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <HelpCircle className="h-5 w-5" />
        )}
      </button>

      {/* Highlight ring overlay */}
      <AnimatePresence>
        {highlightRect && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed z-[45] pointer-events-none"
            style={{
              top: highlightRect.top - 6,
              left: highlightRect.left - 6,
              width: highlightRect.width + 12,
              height: highlightRect.height + 12,
              boxShadow: '0 0 0 2px var(--brand-saffron,#D4A843), 0 0 0 6px rgba(212,168,67,0.25)',
              borderRadius: '0.75rem',
            }}
          />
        )}
      </AnimatePresence>

      {/* Guide Drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            {/* Backdrop — mobile only */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[46] bg-black/30 md:hidden"
              onClick={handleCloseDrawer}
            />

            {/* Drawer panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed z-[47] bg-[var(--app-surface)] border-l border-[var(--app-border)] shadow-2xl flex flex-col
                md:top-0 md:right-0 md:bottom-0 md:w-[400px]
                max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:h-[70vh] max-md:rounded-t-2xl max-md:border-l-0 max-md:border-t"
            >
              {/* Drawer header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--app-border)] shrink-0">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-[var(--brand-saffron-soft)] text-[var(--brand-saffron)] flex items-center justify-center">
                    <HelpCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-[var(--app-text)] text-sm">
                      {guide?.pageTitle ?? 'Page Guide'}
                    </h2>
                    <p className="text-xs text-[var(--app-text-muted)]">
                      {sections.length} section{sections.length !== 1 ? 's' : ''} to explore
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleCloseDrawer}
                  className="p-2 rounded-lg hover:bg-[var(--app-bg-soft)] text-[var(--app-text-muted)] cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Sections list */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {sections.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <HelpCircle className="h-10 w-10 text-[var(--app-text-muted)] opacity-30 mb-3" />
                    <p className="text-sm font-medium text-[var(--app-text-muted)]">
                      No guide available yet
                    </p>
                    <p className="text-xs text-[var(--app-text-muted)] mt-1 opacity-60">
                      Guide content for this page is coming soon.
                    </p>
                  </div>
                ) : (
                  sections.map((section) => {
                    const isActive = section.id === activeSectionId;
                    const Icon = section.icon;
                    return (
                      <button
                        key={section.id}
                        onClick={() => handleSectionClick(section)}
                        className={`w-full text-left rounded-xl p-4 transition-all duration-200 cursor-pointer border
                          ${isActive
                            ? 'bg-[var(--brand-saffron-soft)] border-[var(--brand-saffron)] shadow-md'
                            : 'bg-[var(--app-bg)] border-[var(--app-border)] hover:border-[var(--brand-saffron)] hover:shadow-sm'
                          }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 transition-colors
                            ${isActive
                              ? 'bg-[var(--brand-saffron)] text-white'
                              : 'bg-[var(--brand-saffron-soft)] text-[var(--brand-saffron)]'
                            }`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className={`font-bold text-sm ${isActive ? 'text-[var(--brand-saffron)]' : 'text-[var(--app-text)]'}`}>
                                {section.title}
                              </h3>
                              <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-transform ${isActive ? 'rotate-90 text-[var(--brand-saffron)]' : 'text-[var(--app-text-muted)]'}`} />
                            </div>
                            {isActive && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                transition={{ duration: 0.2 }}
                              >
                                <p className="text-xs text-[var(--app-text-muted)] mt-2 leading-relaxed">
                                  {section.description}
                                </p>
                                {section.whyItMatters && (
                                  <p className="text-xs text-[var(--brand-saffron)] mt-2 font-medium leading-relaxed">
                                    Why it matters: {section.whyItMatters}
                                  </p>
                                )}
                              </motion.div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Drawer footer hint */}
              {sections.length > 0 && (
                <div className="px-5 py-3 border-t border-[var(--app-border)] shrink-0">
                  <p className="text-[11px] text-[var(--app-text-muted)] text-center opacity-60">
                    Tap any section to scroll to it on the page
                  </p>
                </div>
              )}
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
