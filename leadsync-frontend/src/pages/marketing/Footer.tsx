import { Link } from "react-router-dom";

/* ════════════════════════════════════════════════════════════════════ */
/*                                FOOTER                               */
/*                                                                      */
/*  Every link here has to work for a LOGGED-OUT visitor. The previous  */
/*  version pointed all five "Product" links at /dashboard, which is    */
/*  auth-gated — clicking "Orders" bounced you to a login wall. They    */
/*  now point at the matching section of this page instead.            */
/* ════════════════════════════════════════════════════════════════════ */

function Logo({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`flex items-center gap-2 ${className}`}>
      <img
        src="/salira-logo-v2.png"
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

/** `to` for router links, `href` for same-page anchors. */
const COLUMNS: {
  heading: string;
  links: { label: string; to?: string; href?: string }[];
}[] = [
  {
    heading: "What it does",
    links: [
      { label: "How it works", href: "#how-it-works" },
      { label: "Orders from chat", href: "#features" },
      { label: "Your day at a glance", href: "#features" },
      { label: "Who it's for", href: "#who-its-for" },
    ],
  },
  {
    heading: "Get started",
    links: [
      { label: "Create your shop", to: "/onboarding" },
      { label: "Log in", to: "/login" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t" style={{ borderColor: "var(--app-border)" }}>
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-14">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-12">
          <div className="col-span-2">
            <Logo className="mb-4" />
            <p
              className="text-[14.5px] leading-relaxed max-w-xs"
              style={{ color: "var(--app-text-muted)" }}
            >
              Answer customers, take orders and get paid — without being at your phone all day.
              Built for small shops in India.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <h4
                className="text-[11px] font-bold uppercase tracking-[0.16em] mb-4"
                style={{ color: "var(--app-text)" }}
              >
                {col.heading}
              </h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.to ? (
                      <Link
                        to={link.to}
                        className="text-[14px] transition-colors hover:underline"
                        style={{ color: "var(--app-text-muted)" }}
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <a
                        href={link.href}
                        className="text-[14px] transition-colors hover:underline"
                        style={{ color: "var(--app-text-muted)" }}
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          className="pt-7 border-t flex flex-col sm:flex-row items-center justify-between gap-3"
          style={{ borderColor: "var(--app-border)" }}
        >
          <p className="text-[12.5px]" style={{ color: "var(--app-text-muted)" }}>
            &copy; {new Date().getFullYear()} SaLira. All rights reserved.
          </p>
          {/* Social links intentionally omitted until real profiles exist —
              an empty row reads better than "Coming soon: social links". */}
          <p className="text-[12.5px]" style={{ color: "var(--app-text-muted)" }}>
            Made in India
          </p>
        </div>
      </div>
    </footer>
  );
}
