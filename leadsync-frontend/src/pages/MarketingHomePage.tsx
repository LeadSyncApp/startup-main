import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import {
  ShoppingBag,
  Scissors,
  Utensils,
  Stethoscope,
  Bot,
  ShoppingCart,
  Radio,
  BarChart3,
  SlidersHorizontal,
  Shield,
  ArrowRight,
  Store,
  Sparkles,
  Zap,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};

/* ─── Logo Wordmark ─── */
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

/* ─── Section wrapper ─── */
function Section({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${className}`}>
      {children}
    </section>
  );
}

/* ─── Feature card ─── */
function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <motion.div
      variants={fadeUp}
      className="rounded-xl border p-6 transition-all duration-200 hover:border-[var(--brand-saffron)]"
      style={{
        backgroundColor: "var(--app-surface)",
        borderColor: "var(--app-border)",
        boxShadow: "var(--app-shadow-soft)",
      }}
    >
      <div
        className="h-10 w-10 rounded-xl flex items-center justify-center mb-4"
        style={{ backgroundColor: "var(--brand-saffron-soft)", color: "var(--brand-saffron)" }}
      >
        <Icon className="h-5 w-5" />
      </div>
      <h3
        className="text-base font-bold mb-2"
        style={{ fontFamily: "var(--font-display)", color: "var(--app-text)" }}
      >
        {title}
      </h3>
      <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        {description}
      </p>
    </motion.div>
  );
}

/* ─── Vertical card ─── */
function VerticalCard({
  icon: Icon,
  label,
  description,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
}) {
  return (
    <motion.div
      variants={fadeUp}
      className="rounded-xl border p-5 text-center transition-all duration-200 hover:border-[var(--brand-saffron)]"
      style={{
        backgroundColor: "var(--app-surface)",
        borderColor: "var(--app-border)",
      }}
    >
      <div
        className="h-12 w-12 rounded-xl flex items-center justify-center mx-auto mb-3"
        style={{ backgroundColor: "var(--brand-saffron-soft)", color: "var(--brand-saffron)" }}
      >
        <Icon className="h-6 w-6" />
      </div>
      <h3
        className="text-sm font-bold mb-1"
        style={{ fontFamily: "var(--font-display)", color: "var(--app-text)" }}
      >
        {label}
      </h3>
      <p className="text-xs leading-relaxed" style={{ color: "var(--app-text-muted)" }}>
        {description}
      </p>
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════════════════ */
/*                          MARKETING HOME PAGE                        */
/* ════════════════════════════════════════════════════════════════════ */

export default function MarketingHomePage() {
  return (
    <>
      <Helmet>
        <title>SaLira — Your Shop, Digitized</title>
        <meta
          name="description"
          content="Manage your shop across Telegram, WhatsApp, Instagram and more. Send invoices, track orders, automate replies, and grow your business — all from one place."
        />
        <meta property="og:title" content="SaLira — Your Shop, Digitized" />
        <meta
          property="og:description"
          content="AI-powered commerce platform for Indian SMEs. Manage leads, orders, inventory, and customer conversations across multiple channels."
        />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="SaLira" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="SaLira — Your Shop, Digitized" />
        <meta
          name="twitter:description"
          content="AI-powered commerce platform for Indian SMEs. Manage leads, orders, inventory, and customer conversations across multiple channels."
        />
      </Helmet>

      <div className="min-h-screen" style={{ backgroundColor: "var(--app-bg)" }}>
        {/* ─── Nav Bar ─── */}
        <nav
          className="sticky top-0 z-50 border-b backdrop-blur-md"
          style={{
            backgroundColor: "rgba(250, 247, 242, 0.85)",
            borderColor: "var(--app-border)",
          }}
        >
          <Section className="flex items-center justify-between h-16">
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
          </Section>
        </nav>

        {/* ─── Hero ─── */}
        <Section className="pt-20 pb-24 sm:pt-28 sm:pb-32 text-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
            className="max-w-3xl mx-auto"
          >
            <motion.div variants={fadeUp} className="mb-6">
              <span
                className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full"
                style={{
                  backgroundColor: "var(--brand-saffron-soft)",
                  color: "var(--brand-saffron)",
                }}
              >
                <Sparkles className="h-3 w-3" />
                Built for Indian businesses
              </span>
            </motion.div>
            <motion.h1
              variants={fadeUp}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6"
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--app-text)",
                letterSpacing: "-0.02em",
              }}
            >
              Big things start here
              <br />
              <span style={{ color: "var(--brand-saffron)" }}>welcome to SaLira.</span>
            </motion.h1>
            <motion.p
              variants={fadeUp}
              className="text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              One platform to manage your leads, orders, inventory, and customer conversations
              across Telegram, your website, and more — with AI that understands your business.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/onboarding"
                className="btn-primary text-base !px-8 !py-3 inline-flex items-center gap-2"
              >
                Get Started Free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/login"
                className="btn-secondary text-base !px-8 !py-3"
              >
                Log In
              </Link>
            </motion.div>
          </motion.div>
        </Section>

        {/* ─── Vertical Showcase ─── */}
        <Section className="pb-24">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={stagger}
            className="text-center mb-12"
          >
            <motion.h2
              variants={fadeUp}
              className="text-2xl sm:text-3xl font-bold mb-3"
              style={{ fontFamily: "var(--font-display)", color: "var(--app-text)" }}
            >
              Made for your kind of business
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="text-base max-w-xl mx-auto"
              style={{ color: "var(--app-text-muted)" }}
            >
              Whether you sell products, serve clients, or run appointments — SaLira adapts to how you work.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={stagger}
            className="grid grid-cols-2 lg:grid-cols-4 gap-4"
          >
            <VerticalCard
              icon={ShoppingBag}
              label="Retail / Shop"
              description="Manage walk-in and online customers, track sales, and send invoices in seconds."
            />
            <VerticalCard
              icon={Scissors}
              label="Handmade / Crafts"
              description="Showcase your creations, handle custom orders, and keep your craft business organised."
            />
            <VerticalCard
              icon={Utensils}
              label="Food & Beverage"
              description="Take orders, manage menus, and keep your food business running smoothly."
            />
            <VerticalCard
              icon={Stethoscope}
              label="Services / Appointments"
              description="Schedule appointments, manage bookings, and never miss a client follow-up."
            />
          </motion.div>
        </Section>

        {/* ─── Feature Grid ─── */}
        <Section className="pb-24">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={stagger}
            className="text-center mb-12"
          >
            <motion.h2
              variants={fadeUp}
              className="text-2xl sm:text-3xl font-bold mb-3"
              style={{ fontFamily: "var(--font-display)", color: "var(--app-text)" }}
            >
              Everything you need to run your shop
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="text-base max-w-xl mx-auto"
              style={{ color: "var(--app-text-muted)" }}
            >
              From first message to final delivery — automate the busywork, focus on growing your business.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={stagger}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            <FeatureCard
              icon={Bot}
              title="AI Auto-Replies"
              description="Understand customer intent in real time and respond instantly — your AI assistant knows your products, pricing, and policies."
            />
            <FeatureCard
              icon={ShoppingCart}
              title="Automatic Order Extraction"
              description="Orders placed in conversations are detected and captured automatically — no manual data entry needed."
            />
            <FeatureCard
              icon={Radio}
              title="Multi-Channel Messaging"
              description="Connect your Telegram channel and website chat widget today. WhatsApp and Instagram integration coming soon."
            />
            <FeatureCard
              icon={BarChart3}
              title="Real-Time Dashboard"
              description="Revenue trends, channel breakdown, top products, staff performance — 7+ analytics widgets at your fingertips."
            />
            <FeatureCard
              icon={SlidersHorizontal}
              title="No-Code Automation Rules"
              description="Set up auto-replies, order flows, and escalations in plain language — no technical skills required."
            />
            <FeatureCard
              icon={Shield}
              title="Enterprise-Grade Security"
              description="Multi-tenant data isolation means your business data stays yours — fully separated from every other merchant on the platform."
            />
          </motion.div>
        </Section>

        {/* ─── Business Scale ─── */}
        <Section className="pb-24">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={stagger}
            className="text-center mb-12"
          >
            <motion.h2
              variants={fadeUp}
              className="text-2xl sm:text-3xl font-bold mb-3"
              style={{ fontFamily: "var(--font-display)", color: "var(--app-text)" }}
            >
              Whether you're just starting out or scaling up
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="text-base max-w-xl mx-auto"
              style={{ color: "var(--app-text-muted)" }}
            >
              SaLira fits the size of your business today — and grows with you tomorrow.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={stagger}
            className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-3xl mx-auto"
          >
            <motion.div
              variants={fadeUp}
              className="rounded-xl border p-6 text-center"
              style={{
                backgroundColor: "var(--app-surface)",
                borderColor: "var(--app-border)",
              }}
            >
              <div
                className="h-12 w-12 rounded-xl flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: "var(--brand-saffron-soft)", color: "var(--brand-saffron)" }}
              >
                <Store className="h-6 w-6" />
              </div>
              <h3
                className="text-base font-bold mb-2"
                style={{ fontFamily: "var(--font-display)", color: "var(--app-text)" }}
              >
                Home-Grown
              </h3>
              <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--text-secondary)" }}>
                No GST needed. Simple setup for personal and home sellers getting started.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {["Quick setup", "No tax fields", "Upgrade anytime"].map((tag) => (
                  <span
                    key={tag}
                    className="text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{
                      backgroundColor: "var(--brand-saffron-soft)",
                      color: "var(--brand-saffron)",
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </motion.div>

            <motion.div
              variants={fadeUp}
              className="rounded-xl border p-6 text-center"
              style={{
                backgroundColor: "var(--app-surface)",
                borderColor: "var(--app-border)",
              }}
            >
              <div
                className="h-12 w-12 rounded-xl flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: "var(--brand-saffron-soft)", color: "var(--brand-saffron)" }}
              >
                <Zap className="h-6 w-6" />
              </div>
              <h3
                className="text-base font-bold mb-2"
                style={{ fontFamily: "var(--font-display)", color: "var(--app-text)" }}
              >
                SME / Retail
              </h3>
              <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--text-secondary)" }}>
                GST invoicing enabled. Built for registered businesses with tax-ready features.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {["GST invoice field", "Business-grade profile", "Tax-ready orders"].map((tag) => (
                  <span
                    key={tag}
                    className="text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{
                      backgroundColor: "var(--brand-saffron-soft)",
                      color: "var(--brand-saffron)",
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </Section>

        {/* ─── Final CTA ─── */}
        <Section className="pb-24">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={stagger}
            className="rounded-2xl border p-10 sm:p-14 text-center"
            style={{
              backgroundColor: "var(--app-surface)",
              borderColor: "var(--app-border)",
              boxShadow: "var(--app-shadow-md)",
            }}
          >
            <motion.h2
              variants={fadeUp}
              className="text-2xl sm:text-3xl font-bold mb-4"
              style={{ fontFamily: "var(--font-display)", color: "var(--app-text)" }}
            >
              Ready to digitize your shop?
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="text-base max-w-lg mx-auto mb-8"
              style={{ color: "var(--app-text-muted)" }}
            >
              Join hundreds of Indian businesses already using SaLira to manage their leads, orders, and customer conversations — all in one place.
            </motion.p>
            <motion.div variants={fadeUp}>
              <Link
                to="/onboarding"
                className="btn-primary text-base !px-10 !py-3.5 inline-flex items-center gap-2"
              >
                Get Started Free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
          </motion.div>
        </Section>

        {/* ─── Footer ─── */}
        <footer
          className="border-t"
          style={{ borderColor: "var(--app-border)" }}
        >
          <Section className="flex flex-col sm:flex-row items-center justify-between h-16 gap-4">
            <Logo />
            <p className="text-xs" style={{ color: "var(--app-text-muted)" }}>
              &copy; {new Date().getFullYear()} SaLira. All rights reserved.
            </p>
          </Section>
        </footer>
      </div>
    </>
  );
}
