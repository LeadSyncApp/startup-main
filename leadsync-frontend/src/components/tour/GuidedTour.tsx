import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, X, ChevronLeft, ChevronRight, Lightbulb } from 'lucide-react';
import { TabID } from '../layouts/MasterDashboardLayout';
import { getGuideForPage } from './guideRegistry';
import type { GuideSection } from '../../guides/types';
import { useWizardStep } from '../../contexts/WizardContext';

const DRAWER_WIDTH_DESKTOP = 400;
const POLL_INTERVAL_MS = 150;

interface GuidedTourProps {
  activeTab: TabID;
}

export const GuidedTour: React.FC<GuidedTourProps> = ({ activeTab }) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const overlayRef = useRef<HTMLDivElement | null>(null);

  const setPollTick = useState(0)[1];

  const { step: wizardStep } = useWizardStep();

  const guide = getGuideForPage(activeTab);
  const sections: GuideSection[] = guide?.sections ?? [];

  // Filter to sections whose data-tour target is in the DOM AND match the current wizard step
  const visibleSections = sections.filter(s => {
    if (wizardStep && s.wizardStep && s.wizardStep !== wizardStep) return false;
    return document.querySelector(`[data-tour="${s.id}"]`) !== null;
  });

  const currentSection: GuideSection | undefined = visibleSections[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === visibleSections.length - 1;
  const hasMoreSections = visibleSections.length < sections.length;

  // ── Poll for DOM changes while guide is open ──
  const prevVisibleIdsRef = useRef<string[]>([]);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emptyCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCloseDrawer = useCallback(() => {
    setDrawerOpen(false);
    setCurrentStep(0);
    if (scrollTimerRef.current) { clearTimeout(scrollTimerRef.current); scrollTimerRef.current = null; }
    if (emptyCloseTimerRef.current) { clearTimeout(emptyCloseTimerRef.current); emptyCloseTimerRef.current = null; }
  }, []);

  // Wait for scroll to finish using scrollend event, falling back to timeout
  const waitForScroll = useCallback((target: Element, onDone: () => void) => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (timer) { clearTimeout(timer); timer = null; }
      scrollTimerRef.current = null;
    };

    if ('onscrollend' in target) {
      const onScrollEnd = () => { cleanup(); onDone(); };
      target.addEventListener('scrollend', onScrollEnd, { once: true });
      timer = setTimeout(() => { target.removeEventListener('scrollend', onScrollEnd); onDone(); }, 600);
    } else {
      timer = setTimeout(onDone, 600);
    }
    scrollTimerRef.current = timer;
  }, []);

  useEffect(() => {
    if (!drawerOpen) {
      prevVisibleIdsRef.current = [];
      return;
    }

    const intervalId = setInterval(() => {
      const nextIds = sections
        .filter(s => document.querySelector(`[data-tour="${s.id}"]`) !== null)
        .map(s => s.id);

      const prevIds = prevVisibleIdsRef.current;
      const changed = nextIds.length !== prevIds.length ||
        nextIds.some((id, i) => id !== prevIds[i]);

      if (changed) {
        prevVisibleIdsRef.current = nextIds;
        setPollTick(t => t + 1); // force re-render so visibleSections recomputes

        setCurrentStep(prevStep => {
          const prevSection = sections[prevStep];
          if (!prevSection) return 0;

          if (nextIds.includes(prevSection.id)) {
            return Math.min(prevStep, nextIds.length - 1);
          }

          const origIdx = sections.findIndex(s => s.id === prevSection.id);
          for (let i = origIdx + 1; i < sections.length; i++) {
            if (nextIds.includes(sections[i].id)) {
              return nextIds.indexOf(sections[i].id);
            }
          }

          if (nextIds.length > 0) {
            return nextIds.length - 1;
          }

          return 0;
        });
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [drawerOpen, sections]);

  // Close drawer when tab changes
  useEffect(() => {
    setDrawerOpen(false);
    setCurrentStep(0);
    if (scrollTimerRef.current) { clearTimeout(scrollTimerRef.current); scrollTimerRef.current = null; }
    if (emptyCloseTimerRef.current) { clearTimeout(emptyCloseTimerRef.current); emptyCloseTimerRef.current = null; }
  }, [activeTab]);

  // Reset to first section when wizard step changes
  useEffect(() => {
    setCurrentStep(0);
    if (emptyCloseTimerRef.current) { clearTimeout(emptyCloseTimerRef.current); emptyCloseTimerRef.current = null; }
  }, [wizardStep]);

  // Close guide if all visible sections disappear
  useEffect(() => {
    if (drawerOpen && sections.length > 0 && visibleSections.length === 0) {
      if (emptyCloseTimerRef.current === null) {
        emptyCloseTimerRef.current = setTimeout(() => {
          emptyCloseTimerRef.current = null;
          setDrawerOpen(false);
          setCurrentStep(0);
        }, 2000);
      }
    } else {
      if (emptyCloseTimerRef.current) {
        clearTimeout(emptyCloseTimerRef.current);
        emptyCloseTimerRef.current = null;
      }
    }
    return () => {
      if (emptyCloseTimerRef.current) {
        clearTimeout(emptyCloseTimerRef.current);
        emptyCloseTimerRef.current = null;
      }
    };
  }, [drawerOpen, sections.length, visibleSections.length]);

  const scrollToAndHighlight = useCallback((sectionId: string, retries = 3) => {
    const el = document.querySelector(`[data-tour="${sectionId}"]`);
    if (!el) {
      if (retries > 0) requestAnimationFrame(() => scrollToAndHighlight(sectionId, retries - 1));
      return;
    }

    if (scrollTimerRef.current) {
      clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = null;
    }

    el.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const afterFirstScroll = () => {
      const rect = el.getBoundingClientRect();
      const isDesktop = window.innerWidth >= 768;
      if (isDesktop) {
        const viewportWidth = window.innerWidth;
        const drawerLeft = viewportWidth - DRAWER_WIDTH_DESKTOP;
        const elementRight = rect.left + rect.width;

        if (elementRight > drawerLeft) {
          const mainEl = document.querySelector('main');
          if (mainEl) {
            const overlap = elementRight - drawerLeft + 24;
            mainEl.scrollBy({ top: 0, left: overlap, behavior: 'smooth' });
          }
        }
      }
    };

    waitForScroll(el, afterFirstScroll);
  }, [waitForScroll]);

  const goToStep = useCallback((index: number) => {
    if (index < 0 || index >= visibleSections.length) return;
    setCurrentStep(index);
    const section = visibleSections[index];
    if (section) scrollToAndHighlight(section.id);
  }, [visibleSections, scrollToAndHighlight]);

  const handleNext = useCallback(() => {
    if (isLastStep) {
      if (hasMoreSections) {
        return;
      }
      handleCloseDrawer();
    } else {
      goToStep(currentStep + 1);
    }
  }, [currentStep, isLastStep, hasMoreSections, goToStep, handleCloseDrawer]);

  const handleBack = useCallback(() => {
    goToStep(currentStep - 1);
  }, [currentStep, goToStep]);

  const handleHelpClick = useCallback(() => {
    if (drawerOpen) {
      handleCloseDrawer();
    } else {
      setDrawerOpen(true);
      setCurrentStep(0);
    }
  }, [drawerOpen, handleCloseDrawer]);

  // ── Toggle data attribute on <html> so CSS can reflow main content ──
  useEffect(() => {
    if (drawerOpen) {
      document.documentElement.setAttribute('data-guide-drawer', 'open');
    } else {
      document.documentElement.removeAttribute('data-guide-drawer');
    }
    return () => document.documentElement.removeAttribute('data-guide-drawer');
  }, [drawerOpen]);

  // Scroll to first visible section when drawer opens
  useEffect(() => {
    if (drawerOpen && visibleSections.length > 0) {
      const first = visibleSections[0];
      if (first) scrollToAndHighlight(first.id);
    }
  }, [drawerOpen, visibleSections.length, scrollToAndHighlight]);

  // ── Continuous 60fps real-time highlight position synchronization loop ──
  useEffect(() => {
    if (!drawerOpen || !currentSection) {
      if (overlayRef.current) overlayRef.current.style.display = 'none';
      return;
    }

    let animFrameId: number;

    const syncOverlayPosition = () => {
      const el = document.querySelector(`[data-tour="${currentSection.id}"]`);
      if (!el || !overlayRef.current) {
        if (overlayRef.current) overlayRef.current.style.display = 'none';
      } else {
        const rect = el.getBoundingClientRect();
        const isValid =
          Number.isFinite(rect.top) && Number.isFinite(rect.left) &&
          Number.isFinite(rect.width) && Number.isFinite(rect.height) &&
          !Number.isNaN(rect.top) && !Number.isNaN(rect.left) &&
          rect.width > 0 && rect.height > 0;

        if (isValid) {
          const topPx = Math.round(rect.top);
          const leftPx = Math.round(rect.left);
          const widthPx = Math.round(rect.width);
          const heightPx = Math.round(rect.height);

          // Get computed border-radius from the target element or its primary child
          const computedStyle = window.getComputedStyle(el);
          let targetRadius = computedStyle.borderRadius;
          if ((!targetRadius || targetRadius === '0px' || targetRadius === '0px 0px 0px 0px') && el.firstElementChild) {
            const childRadius = window.getComputedStyle(el.firstElementChild).borderRadius;
            if (childRadius && childRadius !== '0px') {
              targetRadius = childRadius;
            }
          }

          overlayRef.current.style.display = 'block';
          overlayRef.current.style.top = `${topPx}px`;
          overlayRef.current.style.left = `${leftPx}px`;
          overlayRef.current.style.width = `${widthPx}px`;
          overlayRef.current.style.height = `${heightPx}px`;
          overlayRef.current.style.borderRadius = targetRadius && targetRadius !== '0px' ? targetRadius : '0.5rem';
        } else {
          if (overlayRef.current) overlayRef.current.style.display = 'none';
        }
      }

      animFrameId = requestAnimationFrame(syncOverlayPosition);
    };

    animFrameId = requestAnimationFrame(syncOverlayPosition);

    return () => {
      cancelAnimationFrame(animFrameId);
      if (overlayRef.current) overlayRef.current.style.display = 'none';
    };
  }, [drawerOpen, currentSection]);

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

      {/* Highlight ring overlay portaled directly to document.body with 0ms transition lag */}
      {createPortal(
        <div
          ref={overlayRef}
          className="fixed z-[9999] pointer-events-none"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: 0,
            height: 0,
            boxShadow: '0 0 0 2px var(--brand-saffron,#D4A843), 0 0 0 5px rgba(212,168,67,0.25)',
            display: 'none',
            pointerEvents: 'none',
            transition: 'opacity 0.15s ease-out',
          }}
        />,
        document.body
      )}

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
                    {visibleSections.length > 0 && (
                      <p className="text-xs text-[var(--app-text-muted)]">
                        Step {currentStep + 1} of {visibleSections.length}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleCloseDrawer}
                  className="p-2 rounded-lg hover:bg-[var(--app-bg-soft)] text-[var(--app-text-muted)] cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Progress bar */}
              {visibleSections.length > 0 && (
                <div className="px-5 pt-4 shrink-0">
                  <div className="h-1 rounded-full bg-[var(--app-bg)] overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-[var(--brand-saffron)]"
                      initial={false}
                      animate={{ width: `${((currentStep + 1) / visibleSections.length) * 100}%` }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              )}

              {/* Content area */}
              <div className="flex-1 overflow-y-auto px-5 py-4">
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
                ) : visibleSections.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <HelpCircle className="h-10 w-10 text-[var(--app-text-muted)] opacity-30 mb-3" />
                    <p className="text-sm font-medium text-[var(--app-text-muted)]">
                      No sections on this view
                    </p>
                    <p className="text-xs text-[var(--app-text-muted)] mt-1 opacity-60">
                      Navigate to a different screen to explore guide sections.
                    </p>
                  </div>
                ) : currentSection ? (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentSection.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                    >
                      {/* Section icon + title */}
                      <div className="flex items-center gap-3 mb-4">
                        <div className="h-10 w-10 rounded-xl bg-[var(--brand-saffron)] text-white flex items-center justify-center shrink-0">
                          <currentSection.icon className="h-5 w-5" />
                        </div>
                        <h3 className="font-bold text-base text-[var(--app-text)]">
                          {currentSection.title}
                        </h3>
                      </div>

                      {/* Description */}
                      <p className="text-[13px] text-[var(--app-text-muted)] leading-relaxed mb-4">
                        {currentSection.description}
                      </p>

                      {/* Why it matters */}
                      {currentSection.whyItMatters && (
                        <div className="flex items-start gap-2 p-3 rounded-xl bg-[var(--brand-saffron-soft)]/40 border border-[var(--brand-saffron)]/20">
                          <Lightbulb className="h-4 w-4 text-[var(--brand-saffron)]/60 shrink-0 mt-0.5" />
                          <p className="text-[12px] text-[var(--app-text-muted)]/70 leading-snug">
                            {currentSection.whyItMatters}
                          </p>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                ) : null}
              </div>

              {/* Navigation footer */}
              {visibleSections.length > 0 && (
                <div className="px-5 py-4 border-t border-[var(--app-border)] shrink-0 space-y-3">
                  {/* "More sections on other steps" hint */}
                  {isLastStep && hasMoreSections && (
                    <p className="text-[11px] text-[var(--app-text-muted)] text-center opacity-70">
                      More sections available on other steps — navigate there to continue the guide.
                    </p>
                  )}

                  <div className="flex items-center justify-between gap-3">
                    <button
                      onClick={handleBack}
                      disabled={isFirstStep}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold border border-[var(--app-border)] text-[var(--app-text)] hover:bg-[var(--app-bg)] transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      Back
                    </button>

                    <button
                      onClick={handleNext}
                      className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm transition cursor-pointer"
                      style={{ backgroundColor: 'var(--brand-saffron)' }}
                    >
                      {isLastStep ? (hasMoreSections ? 'Next' : 'Done') : 'Next'}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
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

