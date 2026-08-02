import { motion } from "framer-motion";
import { EASE } from "../../motion";
import { PlaneMark, SCREEN } from "./parts";

interface ScreenProps {
  instant?: boolean;
}

/** Beat 0 — the shop is closed, the phone is face-down on the counter,
 *  and a customer message arrives anyway. */
export function LockScreen({ instant = false }: ScreenProps) {
  return (
    <div className="flex-1 flex flex-col items-center px-5 pt-10">
      <motion.div
        initial={instant ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="text-center"
      >
        <p
          className="text-[13px] font-medium"
          style={{ color: "rgba(255,255,255,0.62)", fontFamily: "var(--font-sans)" }}
        >
          Tuesday, 12 March
        </p>
        <p
          className="text-[62px] leading-none font-semibold tabular-nums mt-1"
          style={{ color: "rgba(255,255,255,0.95)", fontFamily: "var(--font-sans)" }}
        >
          9:04
        </p>
      </motion.div>

      {/* The notification */}
      <motion.div
        initial={instant ? false : { opacity: 0, y: 22, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, delay: instant ? 0 : 0.55, ease: EASE }}
        className="mt-8 w-full rounded-2xl px-3.5 py-3 backdrop-blur-md"
        style={{
          backgroundColor: "rgba(255,255,255,0.13)",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.14)",
        }}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <span
            className="h-4 w-4 rounded-[5px] flex items-center justify-center shrink-0"
            style={{ backgroundColor: SCREEN.telegram, color: "#fff" }}
          >
            <PlaneMark size={9} />
          </span>
          <span
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "rgba(255,255,255,0.7)", fontFamily: "var(--font-sans)" }}
          >
            Telegram
          </span>
          <span className="text-[10px] ml-auto" style={{ color: "rgba(255,255,255,0.55)" }}>
            now
          </span>
        </div>
        <p
          className="text-[13px] font-semibold leading-snug"
          style={{ color: "#fff", fontFamily: "var(--font-sans)" }}
        >
          Priya Nair
        </p>
        <p
          className="text-[12.5px] leading-snug mt-0.5"
          style={{ color: "rgba(255,255,255,0.8)", fontFamily: "var(--font-sans)" }}
        >
          Do you have the blue cotton saree in M?
        </p>
      </motion.div>

      <motion.p
        initial={instant ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: instant ? 0 : 1.1 }}
        className="mt-auto mb-8 text-[11px] text-center"
        style={{ color: "rgba(255,255,255,0.45)", fontFamily: "var(--font-sans)" }}
      >
        Shop closed · 8:30 pm
      </motion.p>
    </div>
  );
}
