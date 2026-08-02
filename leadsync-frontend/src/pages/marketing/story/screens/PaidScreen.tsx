import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { EASE } from "../../motion";
import { ChatBackdrop } from "./ChatScreen";
import { SCREEN } from "./parts";

/* ════════════════════════════════════════════════════════════════════ */
/*                    BEAT 4 — PAYMENT LINK, MONEY IN                  */
/* ════════════════════════════════════════════════════════════════════ */

interface ScreenProps {
  instant?: boolean;
}

export function PaidScreen({ instant = false }: ScreenProps) {
  return (
    <div className="flex-1 relative overflow-hidden">
      <div className="absolute inset-0 flex flex-col">
        <ChatBackdrop />
      </div>
      <motion.div
        initial={instant ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35 }}
        className="absolute inset-0"
        style={{ backgroundColor: "rgba(27,36,33,0.32)" }}
      />

      <motion.div
        initial={instant ? false : { y: "100%" }}
        animate={{ y: 0 }}
        transition={{ duration: 0.55, delay: instant ? 0 : 0.15, ease: EASE }}
        className="absolute inset-x-0 bottom-0 rounded-t-2xl px-4 pt-3 pb-6"
        style={{ backgroundColor: SCREEN.surface, boxShadow: "0 -8px 30px rgba(27,36,33,0.18)" }}
      >
        <div
          className="h-1 w-9 rounded-full mx-auto mb-4"
          style={{ backgroundColor: SCREEN.border }}
        />

        <p
          className="text-[10px] font-semibold uppercase tracking-[0.14em] text-center mb-1"
          style={{ color: SCREEN.textMuted, fontFamily: "var(--font-sans)" }}
        >
          Payment received
        </p>

        <motion.p
          initial={instant ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: instant ? 0 : 0.5, ease: EASE }}
          className="text-[34px] leading-none font-bold text-center tabular-nums"
          style={{ color: SCREEN.text, fontFamily: "var(--font-mono)" }}
        >
          ₹1,240
        </motion.p>

        {/* The stamp */}
        <motion.div
          initial={instant ? false : { opacity: 0, scale: 0.5, rotate: -12 }}
          animate={{ opacity: 1, scale: 1, rotate: -6 }}
          transition={
            instant
              ? { duration: 0 }
              : { type: "spring", stiffness: 300, damping: 15, delay: 0.9 }
          }
          className="mx-auto mt-3 w-max flex items-center gap-1.5 px-3 py-1 rounded-lg"
          style={{
            backgroundColor: "rgba(91,140,31,0.12)",
            border: `1.5px solid ${SCREEN.money}`,
          }}
        >
          <Check className="h-3.5 w-3.5" strokeWidth={3} style={{ color: SCREEN.money }} />
          <span
            className="text-[13px] font-black tracking-[0.16em]"
            style={{ color: SCREEN.money, fontFamily: "var(--font-sans)" }}
          >
            PAID
          </span>
        </motion.div>

        <div
          className="mt-4 pt-3 space-y-1.5"
          style={{ borderTop: `1px solid ${SCREEN.border}` }}
        >
          {[
            ["Order", "#1042 · Blue Cotton Saree"],
            ["Paid by", "Priya Nair · UPI"],
            ["Received", "9:07 pm"],
          ].map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-3">
              <span
                className="text-[11px]"
                style={{ color: SCREEN.textMuted, fontFamily: "var(--font-sans)" }}
              >
                {label}
              </span>
              <span
                className="text-[11.5px] font-medium text-right truncate"
                style={{ color: SCREEN.text, fontFamily: "var(--font-sans)" }}
              >
                {value}
              </span>
            </div>
          ))}
        </div>

        <p
          className="text-[10px] leading-snug text-center mt-3"
          style={{ color: SCREEN.textMuted, fontFamily: "var(--font-sans)" }}
        >
          Order marked as paid · Receipt sent to Priya
        </p>
      </motion.div>
    </div>
  );
}
