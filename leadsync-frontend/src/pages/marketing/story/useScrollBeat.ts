import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Scroll-position-based beat detection — more reliable than IntersectionObserver
 * on Android where viewport height changes cause useInView to miscalculate.
 *
 * Returns a ref callback to register section elements and the active beat index.
 */
export function useScrollBeat(beatCount: number, reduced: boolean) {
  const [active, setActive] = useState(0);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    if (reduced) return;

    let rafId: number | null = null;

    const detectActiveBeat = () => {
      const scrollY = window.scrollY;
      const viewportHeight = window.innerHeight;
      const triggerPoint = scrollY + viewportHeight * 0.4;

      let newActive = 0;
      for (let i = sectionRefs.current.length - 1; i >= 0; i--) {
        const el = sectionRefs.current[i];
        if (!el) continue;
        if (el.offsetTop <= triggerPoint) {
          newActive = i;
          break;
        }
      }
      setActive(newActive);
    };

    const onScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        detectActiveBeat();
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    detectActiveBeat();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [reduced, beatCount]);

  const setSectionRef = useCallback(
    (index: number) => (el: HTMLElement | null) => {
      sectionRefs.current[index] = el;
    },
    [],
  );

  return { active, setSectionRef, sectionRefs };
}
