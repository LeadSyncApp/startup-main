import { MoonStar, SunMedium } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

interface ThemeToggleProps {
  className?: string;
}

export default function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm font-medium text-[var(--app-text)] shadow-sm transition-colors hover:bg-[var(--app-bg-soft)] focus:outline-none focus:ring-2 focus:ring-cyan-500/30 ${className}`}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={theme === "dark"}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? (
        <>
          <SunMedium className="h-4 w-4" />
          <span>Light</span>
        </>
      ) : (
        <>
          <MoonStar className="h-4 w-4" />
          <span>Dark</span>
        </>
      )}
    </button>
  );
}
