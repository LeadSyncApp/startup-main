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

const footerLinks = {
  product: [
    { label: "Dashboard", to: "/dashboard" },
    { label: "AI Auto-Replies", to: "/dashboard" },
    { label: "Orders", to: "/dashboard" },
    { label: "Inventory", to: "/dashboard" },
    { label: "Broadcast", to: "/dashboard" },
  ],
  gettingStarted: [
    { label: "Sign Up", to: "/onboarding" },
    { label: "Log In", to: "/login" },
  ],
  company: [
    { label: "About SaLira", to: "/" },
  ],
};

export function Footer() {
  return (
    <footer
      className="border-t"
      style={{ borderColor: "var(--app-border)" }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-1">
            <Logo className="mb-4" />
            <p className="text-sm leading-relaxed" style={{ color: "var(--app-text-muted)" }}>
              AI-powered commerce platform for Indian businesses.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4
              className="text-xs font-bold uppercase tracking-widest mb-4"
              style={{ color: "var(--app-text)" }}
            >
              Product
            </h4>
            <ul className="space-y-2.5">
              {footerLinks.product.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.to}
                    className="text-sm transition-colors hover:underline"
                    style={{ color: "var(--app-text-muted)" }}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Getting Started */}
          <div>
            <h4
              className="text-xs font-bold uppercase tracking-widest mb-4"
              style={{ color: "var(--app-text)" }}
            >
              Getting Started
            </h4>
            <ul className="space-y-2.5">
              {footerLinks.gettingStarted.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.to}
                    className="text-sm transition-colors hover:underline"
                    style={{ color: "var(--app-text-muted)" }}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4
              className="text-xs font-bold uppercase tracking-widest mb-4"
              style={{ color: "var(--app-text)" }}
            >
              Company
            </h4>
            <ul className="space-y-2.5">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.to}
                    className="text-sm transition-colors hover:underline"
                    style={{ color: "var(--app-text-muted)" }}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="pt-8 border-t flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{ borderColor: "var(--app-border)" }}
        >
          <p className="text-xs" style={{ color: "var(--app-text-muted)" }}>
            &copy; {new Date().getFullYear()} SaLira. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            {/* Social links — placeholder icons until real social profiles exist */}
            <span className="text-xs" style={{ color: "var(--app-text-muted)" }}>
              Coming soon: social links
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
