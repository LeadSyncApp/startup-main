/* ════════════════════════════════════════════════════════════════════ */
/*                    SHARED BITS FOR PHONE SCREENS                    */
/*                                                                      */
/*  NOTE ON COLOUR: everything inside the phone is hard-coded, not      */
/*  tokenised. The screen represents the product's own light UI seen    */
/*  inside a physical object, so it must stay legible whether the       */
/*  visitor is viewing the page in light or dark theme.                 */
/* ════════════════════════════════════════════════════════════════════ */

export const SCREEN = {
  bg: "#faf7f2",
  surface: "#ffffff",
  text: "#1B2421",
  textMuted: "#5A6C67",
  border: "#e4e0d6",
  accent: "#A74B2A", // deep terracotta — passes AA against white text
  accentSoft: "rgba(211, 107, 70, 0.10)",
  money: "#5B8C1F", // pistachio, darkened for contrast on cream
  telegram: "#229ED9",
} as const;

/** Paper-plane mark. Deliberately generic — we label the channel in text
 *  rather than reproducing Telegram's actual logo. */
export function PlaneMark({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M14.6 1.6 1.9 6.5c-.7.3-.7 1.3 0 1.5l3.2 1 1.2 3.9c.2.7 1.1.8 1.5.2l1.7-2.3 3.3 2.4c.5.4 1.2.1 1.3-.5l1.4-10.3c.1-.7-.6-1.2-1.2-.9Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Stands in for a product photo. Woven gradient reads as fabric, which
 *  looks deliberate in a way a gray box never does. */
export function FabricSwatch({ className = "" }: { className?: string }) {
  return (
    <div
      className={`shrink-0 overflow-hidden ${className}`}
      style={{
        background:
          "repeating-linear-gradient(45deg, #3C6E9B 0 3px, #35618A 3px 6px), linear-gradient(160deg, #4A7FAD, #2B5379)",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.18)",
      }}
    />
  );
}

export function TypingDots() {
  return (
    <span className="flex items-center gap-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full"
          style={{
            backgroundColor: SCREEN.textMuted,
            animation: `storyTypingDot 1.1s ${i * 0.16}s infinite ease-in-out`,
          }}
        />
      ))}
    </span>
  );
}

/** Double tick, drawn rather than imported so it sits right at 11px. */
export function ReadTicks({ color = "rgba(255,255,255,0.75)" }: { color?: string }) {
  return (
    <svg width="14" height="9" viewBox="0 0 14 9" fill="none" aria-hidden="true">
      <path d="M1 5.1 3.2 7.3 8 1.7" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.2 5.6 7.6 7.3 12.4 1.7" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
