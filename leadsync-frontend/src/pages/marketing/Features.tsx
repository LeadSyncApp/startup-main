import { motion } from "framer-motion";
import {
  Bot,
  ShoppingCart,
  Radio,
  BarChart3,
  SlidersHorizontal,
  Shield,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};

const features = [
  {
    icon: Bot,
    title: "AI Auto-Replies",
    description:
      "Understand customer intent in real time and respond instantly — your AI assistant knows your products, pricing, and policies.",
  },
  {
    icon: ShoppingCart,
    title: "Automatic Order Extraction",
    description:
      "Orders placed in conversations are detected and captured automatically — no manual data entry needed.",
  },
  {
    icon: Radio,
    title: "Multi-Channel Messaging",
    description:
      "Connect your Telegram channel and website chat widget today. WhatsApp and Instagram integration coming soon.",
  },
  {
    icon: BarChart3,
    title: "Real-Time Dashboard",
    description:
      "Revenue trends, channel breakdown, top products, staff performance — 7+ analytics widgets at your fingertips.",
  },
  {
    icon: SlidersHorizontal,
    title: "No-Code Automation Rules",
    description:
      "Set up auto-replies, order flows, and escalations in plain language — no technical skills required.",
  },
  {
    icon: Shield,
    title: "Enterprise-Grade Security",
    description:
      "Multi-tenant data isolation means your business data stays yours — fully separated from every other merchant on the platform.",
  },
];

export function Features() {
  return (
    <section className="pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
        {features.map((f) => (
          <motion.div
            key={f.title}
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
              <f.icon className="h-5 w-5" />
            </div>
            <h3
              className="text-base font-bold mb-2"
              style={{ fontFamily: "var(--font-display)", color: "var(--app-text)" }}
            >
              {f.title}
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {f.description}
            </p>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
