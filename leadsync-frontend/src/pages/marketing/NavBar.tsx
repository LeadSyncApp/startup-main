import { Link } from "react-router-dom";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../features/theme/ThemeContext";

/* ════════════════════════════════════════════════════════════════════ */
/*                               NAVBAR                                */
/*                                                                      */
/*  The theme toggle matters here: ThemeContext defaults to the         */
/*  visitor's OS preference, so someone on a dark-mode phone lands on   */
/*  the spruce version of this page with no way to switch.             */
/* ════════════════════════════════════════════════════════════════════ */

const LINKS = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "Who it's for", href: "#who-its-for" },
];

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 shrink-0">
      <img
        src="/salira-logo.png"
        alt="SaLira"
        className="h-9 w-9 rounded-xl object-contain shrink-0"
      />
      <span
        className="text-xl font-bold tracking-tight"
        style={{ fontFamily: "var(--font-display)", color: "var(--app-text)" }}
      >
        SaLira
      </span>
    </Link>
  );
}

export function NavBar() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <nav
      className="marketing-nav-bg sticky top-0 z-50 border-b backdrop-blur-md"
      style={{ borderColor: "var(--app-border)" }}
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-8 flex items-center justify-between h-16 gap-4">
        <Logo />

        <div className="hidden md:flex items-center gap-1">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-[14px] font-medium px-3 py-2 rounded-lg transition-colors hover:opacity-70"
              style={{ color: "var(--text-secondary)" }}
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className="icon-interactive h-9 w-9 rounded-xl flex items-center justify-center border"
            style={{
              borderColor: "var(--app-border)",
              backgroundColor: "var(--app-surface)",
              color: "var(--app-text-muted)",
            }}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <Link
            to="/login"
            className="hidden sm:inline-flex text-[14px] font-semibold px-3.5 py-2 rounded-xl transition-colors hover:opacity-70"
            style={{ color: "var(--text-secondary)" }}
          >
            Log in
          </Link>
          <Link to="/onboarding" className="btn-primary text-[14px] !px-4 !py-2">
            Start free
          </Link>
        </div>
      </div>
    </nav>
  );
}
