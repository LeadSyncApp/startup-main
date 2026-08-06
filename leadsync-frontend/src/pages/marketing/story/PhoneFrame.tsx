import type { ReactNode } from "react";

/* ════════════════════════════════════════════════════════════════════ */
/*                             PHONE FRAME                             */
/*  Physical phone chassis. Always dark regardless of theme — a phone  */
/*  is an object in the world, not a surface in our UI.                */
/* ════════════════════════════════════════════════════════════════════ */

/* Status-bar glyphs are hand-rolled SVG rather than icon-font imports:
   at 10px, icon-library glyphs render muddy. */
function SignalBars() {
  return (
    <svg width="16" height="10" viewBox="0 0 16 10" fill="none" aria-hidden="true">
      <rect x="0" y="7" width="2.5" height="3" rx="0.8" fill="currentColor" />
      <rect x="4" y="5" width="2.5" height="5" rx="0.8" fill="currentColor" />
      <rect x="8" y="2.5" width="2.5" height="7.5" rx="0.8" fill="currentColor" />
      <rect x="12" y="0" width="2.5" height="10" rx="0.8" fill="currentColor" />
    </svg>
  );
}

function WifiGlyph() {
  return (
    <svg width="14" height="10" viewBox="0 0 14 10" fill="none" aria-hidden="true">
      <path d="M1 3.2a8.5 8.5 0 0 1 12 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M3.3 5.6a5.2 5.2 0 0 1 7.4 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="7" cy="8.4" r="1.1" fill="currentColor" />
    </svg>
  );
}

function BatteryGlyph() {
  return (
    <svg width="22" height="10" viewBox="0 0 22 10" fill="none" aria-hidden="true">
      <rect x="0.5" y="0.5" width="18" height="9" rx="2.5" stroke="currentColor" strokeOpacity="0.5" />
      <rect x="2" y="2" width="13" height="6" rx="1.4" fill="currentColor" />
      <path d="M20.5 3.5v3a1.6 1.6 0 0 0 0-3Z" fill="currentColor" fillOpacity="0.5" />
    </svg>
  );
}

interface PhoneFrameProps {
  /** Clock shown in the status bar, e.g. "9:04". */
  time: string;
  /** Screen background — any CSS `background` value, so gradients work. */
  screenBg?: string;
  /** Light glyphs for dark screens (lock screen), dark glyphs otherwise. */
  statusTone?: "light" | "dark";
  children: ReactNode;
}

export function PhoneFrame({
  time,
  screenBg = "#faf7f2",
  statusTone = "dark",
  children,
}: PhoneFrameProps) {
  const glyphColor = statusTone === "light" ? "rgba(255,255,255,0.92)" : "#1B2421";

  return (
    <div
      className="relative rounded-[2.6rem] p-[10px] select-none"
      style={{
        backgroundColor: "var(--phone-bezel)",
        boxShadow: "var(--phone-shadow)",
      }}
    >
      {/* Bezel highlight — sells it as glass rather than a flat rectangle */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[2.6rem]"
        style={{
          boxShadow:
            "inset 0 1px 0 0 rgba(255,255,255,0.18), inset 0 0 0 1px rgba(255,255,255,0.06)",
        }}
      />

      <div
        className="relative overflow-hidden rounded-[2.1rem] w-[220px] h-[480px] sm:w-[292px] sm:h-[604px]"
        style={{ background: screenBg }}
      >
        {/* Dynamic island */}
        <div
          className="absolute top-[9px] left-1/2 -translate-x-1/2 h-[22px] w-[74px] rounded-full z-30"
          style={{ backgroundColor: "var(--phone-bezel)" }}
        />

        {/* Status bar */}
        <div
          className="absolute top-0 inset-x-0 h-[42px] flex items-end justify-between px-6 pb-1.5 z-20 text-[11px] font-semibold"
          style={{ color: glyphColor, fontFamily: "var(--font-sans)" }}
        >
          <span className="tabular-nums">{time}</span>
          <span className="flex items-center gap-1.5">
            <SignalBars />
            <WifiGlyph />
            <BatteryGlyph />
          </span>
        </div>

        {/* Screen content */}
        <div className="absolute inset-0 pt-[42px] flex flex-col">{children}</div>

        {/* Home indicator */}
        <div
          className="absolute bottom-[7px] left-1/2 -translate-x-1/2 h-[4px] w-[104px] rounded-full z-20"
          style={{ backgroundColor: glyphColor, opacity: 0.35 }}
        />
      </div>
    </div>
  );
}
