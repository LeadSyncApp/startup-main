import { Link } from "react-router-dom";

function Logo({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`flex items-center gap-2 ${className}`}>
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
  return (
    <nav
      className="sticky top-0 z-50 border-b backdrop-blur-md"
      style={{
        backgroundColor: "var(--app-bg)",
        opacity: 0.95,
        borderColor: "var(--app-border)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        <Logo />
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
            style={{ color: "var(--text-secondary)" }}
          >
            Log In
          </Link>
          <Link
            to="/onboarding"
            className="btn-primary text-sm !px-4 !py-2"
          >
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  );
}
