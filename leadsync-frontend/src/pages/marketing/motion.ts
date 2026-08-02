/* ════════════════════════════════════════════════════════════════════ */
/*              SHARED MOTION PRIMITIVES — MARKETING PAGE              */
/*                                                                      */
/*  Single source of truth for landing-page motion. Previously each     */
/*  section file declared its own identical `fadeUp` / `stagger` pair,  */
/*  which is why every section entered exactly the same way.            */
/* ════════════════════════════════════════════════════════════════════ */

import type { Variants } from "framer-motion";

/** Matches the easing already used across index.css. */
export const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5, ease: EASE } },
};

/** Bubbles, cards — arrives from below with a little more travel. */
export const riseIn: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, ease: EASE } },
};

/** Stamps, badges — lands with a slight overshoot. */
export const stampIn: Variants = {
  hidden: { opacity: 0, scale: 0.6 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring", stiffness: 320, damping: 18 },
  },
};

export function stagger(staggerChildren = 0.08, delayChildren = 0): Variants {
  return { visible: { transition: { staggerChildren, delayChildren } } };
}

/** Screen swap inside the phone frame. */
export const screenSwap: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE } },
  exit: { opacity: 0, y: -12, transition: { duration: 0.25, ease: EASE } },
};

/** Standard `whileInView` config so every section reveals consistently. */
export const inViewOnce = { once: true, margin: "-80px" } as const;
