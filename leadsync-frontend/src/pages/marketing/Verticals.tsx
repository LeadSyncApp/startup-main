import { motion } from "framer-motion";
import { Scissors, ShoppingBag, Stethoscope, Utensils } from "lucide-react";
import { fadeUp, inViewOnce, stagger } from "./motion";

/* ════════════════════════════════════════════════════════════════════ */
/*                             WHO IT'S FOR                            */
/*  Offset masonry rather than a 4-up grid — columns start at           */
/*  different heights so the eye moves diagonally instead of scanning   */
/*  a row of identical boxes.                                          */
/* ════════════════════════════════════════════════════════════════════ */

const VERTICALS = [
  {
    icon: ShoppingBag,
    label: "Shops & retail",
    body: "Sell to walk-ins and online customers from the same place.",
    /** Vertical nudge (desktop only) that creates the staggered look. */
    offset: "lg:mt-0",
  },
  {
    icon: Scissors,
    label: "Handmade & crafts",
    body: "Take custom orders without losing track of who asked for what.",
    offset: "lg:mt-12",
  },
  {
    icon: Utensils,
    label: "Food & tiffin",
    body: "Daily menus, repeat customers, and orders that don't get missed.",
    offset: "lg:mt-4",
  },
  {
    icon: Stethoscope,
    label: "Appointments & services",
    body: "Bookings and follow-ups, without the back-and-forth.",
    offset: "lg:mt-16",
  },
];

export function Verticals() {
  return (
    <section
      id="who-its-for"
      className="py-24 sm:py-28"
      style={{ backgroundColor: "var(--story-bg-1)" }}
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <motion.div
          variants={stagger(0.09)}
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          className="max-w-xl mb-14 sm:mb-16"
        >
          <motion.p
            variants={fadeUp}
            className="text-[11px] font-semibold uppercase tracking-[0.18em] mb-4"
            style={{ color: "var(--brand-saffron)", fontFamily: "var(--font-mono)" }}
          >
            Who it's for
          </motion.p>
          <motion.h2
            variants={fadeUp}
            className="display-soft text-[2rem] sm:text-[2.7rem] leading-[1.08] font-bold"
            style={{ color: "var(--app-text)", letterSpacing: "-0.03em" }}
          >
            Made for your kind of shop.
          </motion.h2>
        </motion.div>

        <motion.div
          variants={stagger(0.1)}
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6 lg:items-start"
        >
          {VERTICALS.map((v) => (
            <motion.div
              key={v.label}
              variants={fadeUp}
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
              className={`card-hover rounded-2xl p-6 ${v.offset}`}
            >
              <span
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl mb-4"
                style={{
                  backgroundColor: "var(--brand-saffron-soft)",
                  color: "var(--brand-saffron)",
                }}
              >
                <v.icon className="h-5 w-5" />
              </span>
              <h3
                className="text-[16px] font-bold mb-2"
                style={{ color: "var(--app-text)", fontFamily: "var(--font-display)" }}
              >
                {v.label}
              </h3>
              <p
                className="text-[14.5px] leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
              >
                {v.body}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
