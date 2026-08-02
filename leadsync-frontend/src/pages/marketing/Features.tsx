import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Check, Lock, MessageSquare, Package, TrendingUp } from "lucide-react";
import { fadeUp, inViewOnce, stagger } from "./motion";
import { FabricSwatch, SCREEN } from "./story/screens/parts";

/* ════════════════════════════════════════════════════════════════════ */
/*                              FEATURES                               */
/*                                                                      */
/*  Four things, in plain words. Each one is paired with a small crop   */
/*  of real UI rather than an icon in a rounded square — the point is   */
/*  to show the thing, not decorate the claim.                         */
/*                                                                      */
/*  Crops are hard-coded light like the phone screens (see              */
/*  story/screens/parts.tsx) so they stay legible in either theme.      */
/* ════════════════════════════════════════════════════════════════════ */

function Crop({ children }: { children: ReactNode }) {
  return (
    <div
      className="rounded-2xl p-3.5 w-full"
      style={{
        backgroundColor: SCREEN.bg,
        border: `1px solid ${SCREEN.border}`,
        boxShadow: "var(--app-shadow-xl)",
      }}
    >
      {children}
    </div>
  );
}

/* ── Crop 1: order written down from a chat ── */
function OrderCrop() {
  return (
    <Crop>
      <div
        className="rounded-xl px-3 py-2.5 mb-2"
        style={{ backgroundColor: SCREEN.surface, border: `1px solid ${SCREEN.border}` }}
      >
        <p className="text-[12px] leading-snug" style={{ color: SCREEN.text }}>
          "2 of the blue cotton saree, size M please"
        </p>
        <p className="text-[9.5px] mt-1" style={{ color: SCREEN.textMuted }}>
          Priya Nair · 9:04 pm
        </p>
      </div>
      <div className="flex items-center justify-center py-0.5">
        <span
          className="text-[9.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
          style={{ backgroundColor: SCREEN.accentSoft, color: SCREEN.accent }}
        >
          becomes
        </span>
      </div>
      <div
        className="rounded-xl p-2 flex items-center gap-2.5 mt-2"
        style={{ backgroundColor: SCREEN.surface, border: `1px solid ${SCREEN.border}` }}
      >
        <FabricSwatch className="h-9 w-9 rounded-lg" />
        <div className="min-w-0 flex-1">
          <p className="text-[11.5px] font-semibold truncate" style={{ color: SCREEN.text }}>
            Blue Cotton Saree · M
          </p>
          <p className="text-[9.5px] mt-0.5" style={{ color: SCREEN.textMuted }}>
            Qty 2 · Order #1042
          </p>
        </div>
        <span
          className="text-[12px] font-bold shrink-0"
          style={{ color: SCREEN.text, fontFamily: "var(--font-mono)" }}
        >
          ₹2,480
        </span>
      </div>
    </Crop>
  );
}

/* ── Crop 2: the day at a glance ── */
function GlanceCrop() {
  const bars = [38, 62, 45, 78, 56, 92, 71];
  return (
    <Crop>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11.5px] font-bold" style={{ color: SCREEN.text }}>
          This week
        </span>
        <span
          className="text-[13px] font-bold"
          style={{ color: SCREEN.money, fontFamily: "var(--font-mono)" }}
        >
          ₹28,400
        </span>
      </div>
      <div className="flex items-end gap-1.5 h-20">
        {bars.map((h, i) => (
          <motion.div
            key={i}
            className="flex-1 rounded-t-md"
            style={{
              backgroundColor: i === bars.length - 2 ? SCREEN.accent : "rgba(211,107,70,0.28)",
            }}
            initial={{ height: 0 }}
            whileInView={{ height: `${h}%` }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.5, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
          />
        ))}
      </div>
      <div className="flex justify-between mt-2">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} className="text-[9px] flex-1 text-center" style={{ color: SCREEN.textMuted }}>
            {d}
          </span>
        ))}
      </div>
    </Crop>
  );
}

/* ── Crop 3: replies in your own words ── */
function RepliesCrop() {
  return (
    <Crop>
      <p
        className="text-[9.5px] font-bold uppercase tracking-wider mb-2"
        style={{ color: SCREEN.textMuted }}
      >
        Tell it what to do
      </p>
      <div
        className="rounded-xl px-3 py-2.5 mb-2.5"
        style={{ backgroundColor: SCREEN.surface, border: `1px solid ${SCREEN.border}` }}
      >
        <p className="text-[12px] leading-snug" style={{ color: SCREEN.text }}>
          If someone asks about delivery, tell them it's free above ₹999 and takes 3–4 days.
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        <span
          className="h-4 w-4 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: SCREEN.money }}
        >
          <Check className="h-2.5 w-2.5 text-white" strokeWidth={4} />
        </span>
        <span className="text-[10.5px] font-semibold" style={{ color: SCREEN.text }}>
          Saved. No settings, no code.
        </span>
      </div>
    </Crop>
  );
}

/* ── Crop 4: your shop is separate ── */
function PrivacyCrop() {
  return (
    <Crop>
      <div
        className="rounded-xl px-3 py-3 flex items-center gap-2.5"
        style={{ backgroundColor: SCREEN.surface, border: `1.5px solid ${SCREEN.accent}` }}
      >
        <span
          className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: SCREEN.accent }}
        >
          <Lock className="h-4 w-4 text-white" />
        </span>
        <div>
          <p className="text-[11.5px] font-bold" style={{ color: SCREEN.text }}>
            Your shop
          </p>
          <p className="text-[9.5px]" style={{ color: SCREEN.textMuted }}>
            Orders · Customers · Stock
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-2">
        {["Another shop", "Another shop"].map((label, i) => (
          <div
            key={i}
            className="rounded-lg px-2.5 py-2.5"
            style={{
              backgroundColor: SCREEN.surface,
              border: `1px dashed ${SCREEN.border}`,
              opacity: 0.55,
            }}
          >
            <p className="text-[9.5px] font-semibold" style={{ color: SCREEN.textMuted }}>
              {label}
            </p>
            <p className="text-[8.5px] mt-0.5" style={{ color: SCREEN.textMuted }}>
              Can't see yours
            </p>
          </div>
        ))}
      </div>
    </Crop>
  );
}

interface FeatureDef {
  icon: typeof MessageSquare;
  title: string;
  body: string;
  crop: () => JSX.Element;
}

const FEATURES: FeatureDef[] = [
  {
    icon: Package,
    title: "Orders from chat, written down for you.",
    body: "When a customer says what they want, SaLira turns it into a proper order — item, size, quantity, price and who it's for. Your stock count updates on its own.",
    crop: OrderCrop,
  },
  {
    icon: TrendingUp,
    title: "See how the day is going, at a glance.",
    body: "Open one screen and know what sold, what came in, and what's still waiting to be packed. No spreadsheets to keep up to date.",
    crop: GlanceCrop,
  },
  {
    icon: MessageSquare,
    title: "Set your own replies, in plain words.",
    body: "Type what you'd say yourself — about delivery, sizes, timings, anything — and SaLira says it to customers the same way. Change it whenever you like.",
    crop: RepliesCrop,
  },
  {
    icon: Lock,
    title: "Your data is yours alone.",
    body: "Your orders, customers and stock are kept apart from every other shop using SaLira. Nobody else's shop can see them.",
    crop: PrivacyCrop,
  },
];

export function Features() {
  return (
    <section
      id="features"
      className="py-24 sm:py-28"
      style={{ backgroundColor: "var(--app-bg)" }}
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <motion.div
          variants={stagger(0.09)}
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          className="max-w-2xl mb-16 sm:mb-20"
        >
          <motion.p
            variants={fadeUp}
            className="text-[11px] font-semibold uppercase tracking-[0.18em] mb-4"
            style={{ color: "var(--brand-saffron)", fontFamily: "var(--font-mono)" }}
          >
            And the rest of the day
          </motion.p>
          <motion.h2
            variants={fadeUp}
            className="display-soft text-[2rem] sm:text-[2.7rem] leading-[1.08] font-bold"
            style={{ color: "var(--app-text)", letterSpacing: "-0.03em" }}
          >
            Four things it quietly takes off your hands.
          </motion.h2>
        </motion.div>

        <div className="space-y-20 sm:space-y-24">
          {FEATURES.map((f, i) => {
            const cropLeft = i % 2 === 1; // alternate sides
            const CropComponent = f.crop;
            return (
              <motion.div
                key={f.title}
                variants={stagger(0.1)}
                initial="hidden"
                whileInView="visible"
                viewport={inViewOnce}
                className="grid lg:grid-cols-12 gap-8 lg:gap-14 items-center"
              >
                {/* Offset: text spans 6 of 12 but starts off the grid edge */}
                <motion.div
                  variants={fadeUp}
                  className={`lg:col-span-6 ${
                    cropLeft ? "lg:col-start-7" : "lg:col-start-1"
                  } order-2 lg:order-none`}
                >
                  <span
                    className="inline-flex items-center justify-center h-10 w-10 rounded-xl mb-5"
                    style={{
                      backgroundColor: "var(--brand-saffron-soft)",
                      color: "var(--brand-saffron)",
                    }}
                  >
                    <f.icon className="h-5 w-5" />
                  </span>
                  <h3
                    className="display-soft text-[1.45rem] sm:text-[1.75rem] leading-[1.15] font-bold mb-4"
                    style={{ color: "var(--app-text)", letterSpacing: "-0.02em" }}
                  >
                    {f.title}
                  </h3>
                  <p
                    className="text-[16.5px] leading-relaxed max-w-lg"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {f.body}
                  </p>
                </motion.div>

                <motion.div
                  variants={fadeUp}
                  className={`lg:col-span-5 ${
                    cropLeft ? "lg:col-start-1 lg:row-start-1" : "lg:col-start-8"
                  } order-1 lg:order-none`}
                >
                  <CropComponent />
                </motion.div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
