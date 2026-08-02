import { motion } from "framer-motion";
import { Check, Moon, Package, Sparkles } from "lucide-react";
import { CountUp } from "../../../../components/ui/CountUp";
import { EASE, stagger } from "../../motion";
import { FabricSwatch, SCREEN } from "./parts";

/* ════════════════════════════════════════════════════════════════════ */
/*                     BEAT 5 — WHAT YOU WAKE UP TO                    */
/* ════════════════════════════════════════════════════════════════════ */

interface ScreenProps {
  instant?: boolean;
}

const tileVariant = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
};

export function DashboardScreen({ instant = false }: ScreenProps) {
  return (
    <motion.div
      variants={stagger(0.1, 0.15)}
      initial={instant ? false : "hidden"}
      animate="visible"
      className="flex-1 flex flex-col px-3.5 pt-3 pb-6 gap-2.5 overflow-hidden"
      style={{ backgroundColor: SCREEN.bg }}
    >
      <motion.div variants={tileVariant}>
        <p
          className="text-[10px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: SCREEN.textMuted, fontFamily: "var(--font-sans)" }}
        >
          Tuesday · 6:40 am
        </p>
        <p
          className="text-[19px] font-bold leading-tight mt-0.5"
          style={{ color: SCREEN.text, fontFamily: "var(--font-display)" }}
        >
          Good morning, Anita
        </p>
      </motion.div>

      {/* While you slept */}
      <motion.div
        variants={tileVariant}
        className="rounded-xl px-3 py-2.5 flex items-center gap-2.5"
        style={{ backgroundColor: SCREEN.accentSoft, border: `1px solid rgba(211,107,70,0.22)` }}
      >
        <span
          className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: SCREEN.accent }}
        >
          <Moon className="h-3.5 w-3.5 text-white" />
        </span>
        <div className="min-w-0">
          <p
            className="text-[11.5px] font-bold leading-tight"
            style={{ color: SCREEN.accent, fontFamily: "var(--font-sans)" }}
          >
            While you slept
          </p>
          <p
            className="text-[10px] leading-tight mt-0.5"
            style={{ color: SCREEN.textMuted, fontFamily: "var(--font-sans)" }}
          >
            SaLira answered 6 chats and took 3 orders
          </p>
        </div>
      </motion.div>

      {/* Numbers */}
      <div className="grid grid-cols-2 gap-2">
        <motion.div
          variants={tileVariant}
          className="rounded-xl px-3 py-2.5"
          style={{ backgroundColor: SCREEN.surface, border: `1px solid ${SCREEN.border}` }}
        >
          <p
            className="text-[9.5px] font-medium uppercase tracking-wider"
            style={{ color: SCREEN.textMuted, fontFamily: "var(--font-sans)" }}
          >
            New orders
          </p>
          <p
            className="text-[22px] font-bold leading-tight tabular-nums mt-0.5"
            style={{ color: SCREEN.text, fontFamily: "var(--font-mono)" }}
          >
            {instant ? "3" : <CountUp value={3} duration={900} />}
          </p>
        </motion.div>

        <motion.div
          variants={tileVariant}
          className="rounded-xl px-3 py-2.5"
          style={{ backgroundColor: SCREEN.surface, border: `1px solid ${SCREEN.border}` }}
        >
          <p
            className="text-[9.5px] font-medium uppercase tracking-wider"
            style={{ color: SCREEN.textMuted, fontFamily: "var(--font-sans)" }}
          >
            Earned
          </p>
          <p
            className="text-[22px] font-bold leading-tight tabular-nums mt-0.5"
            style={{ color: SCREEN.money, fontFamily: "var(--font-mono)" }}
          >
            {instant ? (
              "₹4,120"
            ) : (
              <CountUp
                value={4120}
                duration={1100}
                formatter={(v) => `₹${v.toLocaleString("en-IN")}`}
              />
            )}
          </p>
        </motion.div>
      </div>

      {/* Orders waiting */}
      <motion.div
        variants={tileVariant}
        className="rounded-xl overflow-hidden"
        style={{ backgroundColor: SCREEN.surface, border: `1px solid ${SCREEN.border}` }}
      >
        <div
          className="px-3 py-2 flex items-center gap-1.5"
          style={{ borderBottom: `1px solid ${SCREEN.border}` }}
        >
          <Package className="h-3 w-3" style={{ color: SCREEN.accent }} />
          <span
            className="text-[10.5px] font-bold"
            style={{ color: SCREEN.text, fontFamily: "var(--font-sans)" }}
          >
            Ready to pack
          </span>
        </div>

        {[
          { name: "Priya Nair", item: "Blue Cotton Saree · M", amount: "₹1,240", paid: true },
          { name: "Rahul Menon", item: "Cotton Kurta · L", amount: "₹1,680", paid: true },
          { name: "Sneha Iyer", item: "Silk Dupatta", amount: "₹1,200", paid: false },
        ].map((o) => (
          <div
            key={o.name}
            className="px-3 py-2 flex items-center gap-2"
            style={{ borderBottom: `1px solid ${SCREEN.border}` }}
          >
            <FabricSwatch className="h-7 w-7 rounded-md" />
            <div className="min-w-0 flex-1">
              <p
                className="text-[11px] font-semibold leading-tight truncate"
                style={{ color: SCREEN.text, fontFamily: "var(--font-sans)" }}
              >
                {o.name}
              </p>
              <p
                className="text-[9.5px] leading-tight mt-0.5 truncate"
                style={{ color: SCREEN.textMuted, fontFamily: "var(--font-sans)" }}
              >
                {o.item}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p
                className="text-[11px] font-bold tabular-nums"
                style={{ color: SCREEN.text, fontFamily: "var(--font-mono)" }}
              >
                {o.amount}
              </p>
              {o.paid ? (
                <span
                  className="text-[8.5px] font-bold flex items-center justify-end gap-0.5 mt-0.5"
                  style={{ color: SCREEN.money, fontFamily: "var(--font-sans)" }}
                >
                  <Check className="h-2 w-2" strokeWidth={4} />
                  PAID
                </span>
              ) : (
                <span
                  className="text-[8.5px] font-bold mt-0.5 block"
                  style={{ color: SCREEN.textMuted, fontFamily: "var(--font-sans)" }}
                >
                  AWAITING
                </span>
              )}
            </div>
          </div>
        ))}
      </motion.div>

      <motion.p
        variants={tileVariant}
        className="text-[9.5px] flex items-center justify-center gap-1 mt-auto"
        style={{ color: SCREEN.textMuted, fontFamily: "var(--font-sans)" }}
      >
        <Sparkles className="h-2.5 w-2.5" style={{ color: SCREEN.accent }} />
        You didn't type a single reply
      </motion.p>
    </motion.div>
  );
}
