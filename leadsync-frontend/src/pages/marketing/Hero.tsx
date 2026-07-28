import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { DashboardPreview } from "./DashboardPreview";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};

export function Hero() {
  return (
    <>
      <section className="pt-20 pb-8 sm:pt-28 sm:pb-12 text-center max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
      </section>

      {/* Dashboard Preview */}
      <section className="pb-20 sm:pb-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <DashboardPreview />
      </section>
    </>
  );
}
