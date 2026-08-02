import { motion } from "framer-motion";
import { Check, Globe, Instagram, MessageCircle, Send } from "lucide-react";
import { fadeUp, inViewOnce, stagger } from "./motion";

/* ════════════════════════════════════════════════════════════════════ */
/*                            TRUST STRIP                              */
/*                                                                      */
/*  Only Telegram and the website chat widget genuinely connect today   */
/*  (see features/configurations/ConnectionsHub.tsx — the Meta          */
/*  platforms open a stub modal). This section says exactly that.       */
/*  Do not promote WhatsApp or Instagram to "live" here until the       */
/*  integration actually works.                                        */
/* ════════════════════════════════════════════════════════════════════ */

const CHANNELS = [
  { icon: Send, label: "Telegram", live: true },
  { icon: Globe, label: "Your website chat", live: true },
  { icon: MessageCircle, label: "WhatsApp", live: false },
  { icon: Instagram, label: "Instagram", live: false },
];

export function TrustStrip() {
  return (
    <section
      className="py-14 sm:py-16 border-y"
      style={{
        backgroundColor: "var(--story-bg-5)",
        borderColor: "var(--app-border)",
      }}
    >
      <motion.div
        variants={stagger(0.07)}
        initial="hidden"
        whileInView="visible"
        viewport={inViewOnce}
        className="max-w-6xl mx-auto px-5 sm:px-8 flex flex-col lg:flex-row lg:items-center gap-7 lg:gap-12"
      >
        <motion.p
          variants={fadeUp}
          className="text-[13px] font-semibold uppercase tracking-[0.16em] shrink-0 lg:max-w-[9rem] lg:leading-snug"
          style={{ color: "var(--app-text-muted)", fontFamily: "var(--font-mono)" }}
        >
          Works today with
        </motion.p>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          {CHANNELS.map((c) => (
            <motion.span
              key={c.label}
              variants={fadeUp}
              className="inline-flex items-center gap-2 rounded-full pl-3 pr-3.5 py-2 border"
              style={{
                backgroundColor: c.live ? "var(--app-surface)" : "transparent",
                borderColor: c.live ? "var(--brand-saffron)" : "var(--app-border)",
                opacity: c.live ? 1 : 0.72,
              }}
            >
              <c.icon
                className="h-4 w-4 shrink-0"
                style={{ color: c.live ? "var(--brand-saffron)" : "var(--app-text-muted)" }}
              />
              <span
                className="text-[14px] font-semibold"
                style={{ color: c.live ? "var(--app-text)" : "var(--app-text-muted)" }}
              >
                {c.label}
              </span>
              {c.live ? (
                <Check
                  className="h-3.5 w-3.5 shrink-0"
                  strokeWidth={3}
                  style={{ color: "var(--success-green)" }}
                />
              ) : (
                <span
                  className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                  style={{
                    backgroundColor: "var(--app-bg-soft)",
                    color: "var(--app-text-muted)",
                  }}
                >
                  Soon
                </span>
              )}
            </motion.span>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
