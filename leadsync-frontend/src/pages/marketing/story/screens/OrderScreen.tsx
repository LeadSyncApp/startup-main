import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { EASE, stampIn } from "../../motion";
import { ChatBackdrop } from "./ChatScreen";
import { FabricSwatch, SCREEN } from "./parts";

/* ════════════════════════════════════════════════════════════════════ */
/*                   BEAT 3 — THE ORDER WRITES ITSELF                  */
/* ════════════════════════════════════════════════════════════════════ */

interface ScreenProps {
  instant?: boolean;
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span
        className="text-[11px]"
        style={{ color: SCREEN.textMuted, fontFamily: "var(--font-sans)" }}
      >
        {label}
      </span>
      <span
        className={`text-[12px] ${bold ? "font-bold" : "font-medium"} text-right`}
        style={{
          color: SCREEN.text,
          fontFamily: bold ? "var(--font-mono)" : "var(--font-sans)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

export function OrderScreen({ instant = false }: ScreenProps) {
  return (
    <div className="flex-1 relative overflow-hidden">
      {/* The conversation carries on underneath */}
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

      {/* Order sheet */}
      <motion.div
        initial={instant ? false : { y: "100%" }}
        animate={{ y: 0 }}
        transition={{ duration: 0.55, delay: instant ? 0 : 0.2, ease: EASE }}
        className="absolute inset-x-0 bottom-0 rounded-t-2xl px-4 pt-3 pb-6"
        style={{ backgroundColor: SCREEN.surface, boxShadow: "0 -8px 30px rgba(27,36,33,0.18)" }}
      >
        <div
          className="h-1 w-9 rounded-full mx-auto mb-3.5"
          style={{ backgroundColor: SCREEN.border }}
        />

        <div className="flex items-center gap-2 mb-3">
          <motion.span
            variants={stampIn}
            initial={instant ? false : "hidden"}
            animate="visible"
            transition={{ delay: instant ? 0 : 0.75 }}
            className="h-5 w-5 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: SCREEN.money }}
          >
            <Check className="h-3 w-3 text-white" strokeWidth={3} />
          </motion.span>
          <p
            className="text-[13px] font-bold"
            style={{ color: SCREEN.text, fontFamily: "var(--font-display)" }}
          >
            Order added
          </p>
          <span
            className="ml-auto text-[9.5px] font-semibold px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: SCREEN.accentSoft,
              color: SCREEN.accent,
              fontFamily: "var(--font-sans)",
            }}
          >
            #1042
          </span>
        </div>

        <div
          className="flex items-center gap-2.5 rounded-xl p-2 mb-3"
          style={{ backgroundColor: SCREEN.bg, border: `1px solid ${SCREEN.border}` }}
        >
          <FabricSwatch className="h-10 w-10 rounded-lg" />
          <div className="min-w-0 flex-1">
            <p
              className="text-[11.5px] font-semibold leading-tight truncate"
              style={{ color: SCREEN.text, fontFamily: "var(--font-sans)" }}
            >
              Blue Cotton Saree
            </p>
            <p
              className="text-[10px] leading-tight mt-0.5"
              style={{ color: SCREEN.textMuted, fontFamily: "var(--font-sans)" }}
            >
              Size M · Qty 1
            </p>
          </div>
          <span
            className="text-[12px] font-bold shrink-0"
            style={{ color: SCREEN.text, fontFamily: "var(--font-mono)" }}
          >
            ₹1,240
          </span>
        </div>

        <div className="space-y-1.5 mb-3">
          <Row label="Customer" value="Priya Nair" />
          <Row label="Came from" value="Telegram" />
          <Row label="Total" value="₹1,240" bold />
        </div>

        <p
          className="text-[10px] leading-snug text-center"
          style={{ color: SCREEN.textMuted, fontFamily: "var(--font-sans)" }}
        >
          Stock updated automatically · 2 left
        </p>
      </motion.div>
    </div>
  );
}
