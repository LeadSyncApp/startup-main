import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { EASE, fadeUp, inViewOnce, stagger } from "./motion";

/* ════════════════════════════════════════════════════════════════════ */
/*                            BUSINESS SIZE                            */
/*                                                                      */
/*  Deliberately NOT card-shaped. The previous version was two tiers    */
/*  side by side with feature pills, which read as a pricing table with */
/*  the prices missing — and no pricing exists yet. One sentence, two   */
/*  chips, one swapping line.                                          */
/* ════════════════════════════════════════════════════════════════════ */

const OPTIONS = [
  {
    id: "home",
    chip: "Just me, from home",
    line: "You'll skip GST entirely — no tax fields, no business registration, nothing to fill in that doesn't apply to you. Sign up and start taking orders.",
  },
  {
    id: "registered",
    chip: "A registered business with GST",
    line: "Your invoices carry your GST number and your orders are tax-ready from the first sale. Nothing extra to set up later.",
  },
] as const;

type OptionId = (typeof OPTIONS)[number]["id"];

export function BusinessScale() {
  const [selected, setSelected] = useState<OptionId>("home");
  const active = OPTIONS.find((o) => o.id === selected) ?? OPTIONS[0];

  return (
    <section className="py-24 sm:py-28" style={{ backgroundColor: "var(--app-bg)" }}>
      <motion.div
        variants={stagger(0.09)}
        initial="hidden"
        whileInView="visible"
        viewport={inViewOnce}
        className="max-w-3xl mx-auto px-5 sm:px-8 text-center"
      >
        <motion.h2
          variants={fadeUp}
          className="display-soft text-[1.9rem] sm:text-[2.4rem] leading-[1.12] font-bold"
          style={{ color: "var(--app-text)", letterSpacing: "-0.03em" }}
        >
          SaLira fits the size your shop is today.
        </motion.h2>

        <motion.div
          variants={fadeUp}
          className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5"
          role="group"
          aria-label="Choose your business type"
        >
          {OPTIONS.map((o) => {
            const isActive = o.id === selected;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => setSelected(o.id)}
                aria-pressed={isActive}
                className="btn-interactive rounded-full px-5 py-3 text-[15px] font-semibold border-2 transition-colors"
                style={{
                  backgroundColor: isActive ? "var(--brand-saffron)" : "var(--app-surface)",
                  borderColor: isActive ? "var(--brand-saffron)" : "var(--app-border)",
                  color: isActive ? "#faf7f2" : "var(--app-text)",
                }}
              >
                {o.chip}
              </button>
            );
          })}
        </motion.div>

        <motion.div variants={fadeUp} className="mt-8 min-h-[5.5rem] sm:min-h-[4.5rem]">
          <AnimatePresence mode="wait">
            <motion.p
              key={active.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="text-[16.5px] sm:text-[17.5px] leading-relaxed max-w-xl mx-auto"
              style={{ color: "var(--text-secondary)" }}
            >
              {active.line}
            </motion.p>
          </AnimatePresence>
        </motion.div>

        <motion.p
          variants={fadeUp}
          className="text-[14px] mt-2"
          style={{ color: "var(--app-text-muted)" }}
        >
          You can switch later — nothing is locked in.
        </motion.p>
      </motion.div>
    </section>
  );
}
