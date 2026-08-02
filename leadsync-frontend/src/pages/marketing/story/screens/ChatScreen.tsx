import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, Sparkles } from "lucide-react";
import { EASE } from "../../motion";
import { FabricSwatch, PlaneMark, ReadTicks, SCREEN, TypingDots } from "./parts";

/* ════════════════════════════════════════════════════════════════════ */
/*                      BEATS 1 & 2 — THE CONVERSATION                 */
/* ════════════════════════════════════════════════════════════════════ */

export function ChatHeader() {
  return (
    <div
      className="flex items-center gap-2.5 px-3.5 py-2.5 shrink-0"
      style={{ backgroundColor: SCREEN.surface, borderBottom: `1px solid ${SCREEN.border}` }}
    >
      <ChevronLeft className="h-4 w-4 shrink-0" style={{ color: SCREEN.textMuted }} />
      <span
        className="h-8 w-8 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0"
        style={{ backgroundColor: SCREEN.accentSoft, color: SCREEN.accent }}
      >
        P
      </span>
      <div className="min-w-0 flex-1">
        <p
          className="text-[13px] font-semibold leading-tight truncate"
          style={{ color: SCREEN.text, fontFamily: "var(--font-sans)" }}
        >
          Priya Nair
        </p>
        <p
          className="text-[10.5px] leading-tight flex items-center gap-1 mt-0.5"
          style={{ color: SCREEN.textMuted, fontFamily: "var(--font-sans)" }}
        >
          <span style={{ color: SCREEN.telegram }}>
            <PlaneMark size={9} />
          </span>
          via Telegram
        </p>
      </div>
    </div>
  );
}

export function IncomingBubble() {
  return (
    <div className="flex flex-col items-start">
      <div
        className="max-w-[85%] rounded-2xl rounded-bl-md px-3 py-2"
        style={{
          backgroundColor: SCREEN.surface,
          border: `1px solid ${SCREEN.border}`,
        }}
      >
        <p
          className="text-[12.5px] leading-snug"
          style={{ color: SCREEN.text, fontFamily: "var(--font-sans)" }}
        >
          Do you have the blue cotton saree in M?
        </p>
      </div>
      <span
        className="text-[9.5px] mt-1 ml-1"
        style={{ color: SCREEN.textMuted, fontFamily: "var(--font-sans)" }}
      >
        9:04 pm
      </span>
    </div>
  );
}

export function OutgoingBubble() {
  return (
    <div className="flex flex-col items-end">
      <div
        className="max-w-[88%] rounded-2xl rounded-br-md px-3 py-2.5"
        style={{ backgroundColor: SCREEN.accent }}
      >
        {/* Product card inside the reply */}
        <div
          className="flex items-center gap-2 rounded-xl p-1.5 mb-2"
          style={{ backgroundColor: "rgba(255,255,255,0.16)" }}
        >
          <FabricSwatch className="h-9 w-9 rounded-lg" />
          <div className="min-w-0">
            <p
              className="text-[11px] font-semibold leading-tight text-white truncate"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              Blue Cotton Saree · M
            </p>
            <p
              className="text-[10px] leading-tight mt-0.5"
              style={{ color: "rgba(255,255,255,0.82)", fontFamily: "var(--font-sans)" }}
            >
              3 left in stock
            </p>
          </div>
        </div>
        <p
          className="text-[12.5px] leading-snug text-white"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          Yes, we have it! It's ₹1,240 including delivery. Shall I reserve one for you?
        </p>
        <span className="flex items-center justify-end gap-1 mt-1">
          <span
            className="text-[9.5px]"
            style={{ color: "rgba(255,255,255,0.75)", fontFamily: "var(--font-sans)" }}
          >
            9:05 pm
          </span>
          <ReadTicks />
        </span>
      </div>
      <span
        className="text-[9.5px] mt-1 mr-1 flex items-center gap-1"
        style={{ color: SCREEN.textMuted, fontFamily: "var(--font-sans)" }}
      >
        <Sparkles className="h-2.5 w-2.5" style={{ color: SCREEN.accent }} />
        Answered by SaLira
      </span>
    </div>
  );
}

/** Static thread, used as the backdrop behind the order & payment sheets. */
export function ChatBackdrop() {
  return (
    <div className="flex-1 flex flex-col" style={{ backgroundColor: SCREEN.bg }}>
      <ChatHeader />
      <div className="flex-1 px-3 py-3 flex flex-col gap-3 overflow-hidden">
        <IncomingBubble />
        <OutgoingBubble />
      </div>
    </div>
  );
}

interface ChatScreenProps {
  /** "asked" = customer message only. "answered" = types, then replies. */
  stage: "asked" | "answered";
  instant?: boolean;
}

export function ChatScreen({ stage, instant = false }: ChatScreenProps) {
  const answering = stage === "answered";
  // Phase drives the typing-then-reply choreography. Reduced motion and the
  // "asked" beat both skip straight to their final state.
  const [phase, setPhase] = useState<"idle" | "typing" | "replied">(() =>
    !answering ? "idle" : instant ? "replied" : "idle"
  );

  useEffect(() => {
    if (!answering || instant) {
      setPhase(answering ? "replied" : "idle");
      return;
    }
    setPhase("idle");
    const toTyping = window.setTimeout(() => setPhase("typing"), 500);
    const toReplied = window.setTimeout(() => setPhase("replied"), 2000);
    return () => {
      window.clearTimeout(toTyping);
      window.clearTimeout(toReplied);
    };
  }, [answering, instant]);

  return (
    <div className="flex-1 flex flex-col" style={{ backgroundColor: SCREEN.bg }}>
      <ChatHeader />

      <div className="flex-1 px-3 py-3 flex flex-col gap-3 overflow-hidden">
        <div className="flex justify-center">
          <span
            className="text-[9.5px] font-medium px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: "rgba(27,36,33,0.05)",
              color: SCREEN.textMuted,
              fontFamily: "var(--font-sans)",
            }}
          >
            Today
          </span>
        </div>

        <motion.div
          initial={instant ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
        >
          <IncomingBubble />
        </motion.div>

        {phase === "typing" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="flex justify-end"
          >
            <div
              className="rounded-2xl rounded-br-md px-3 py-2"
              style={{ backgroundColor: SCREEN.surface, border: `1px solid ${SCREEN.border}` }}
            >
              <TypingDots />
            </div>
          </motion.div>
        )}

        {phase === "replied" && (
          <motion.div
            initial={instant ? false : { opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.45, ease: EASE }}
          >
            <OutgoingBubble />
          </motion.div>
        )}
      </div>

      {/* Composer — empty, because the shop owner never touched it */}
      <div
        className="shrink-0 px-3 pt-2 pb-6 flex items-center gap-2"
        style={{ backgroundColor: SCREEN.surface, borderTop: `1px solid ${SCREEN.border}` }}
      >
        <div
          className="flex-1 rounded-full px-3 py-1.5 text-[11px]"
          style={{
            backgroundColor: SCREEN.bg,
            color: SCREEN.textMuted,
            border: `1px solid ${SCREEN.border}`,
            fontFamily: "var(--font-sans)",
          }}
        >
          Message
        </div>
        <span
          className="h-7 w-7 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: SCREEN.accentSoft, color: SCREEN.accent }}
        >
          <PlaneMark size={11} />
        </span>
      </div>
    </div>
  );
}
