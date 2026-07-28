import { motion } from "framer-motion";
import { Radio, Bot, TrendingUp } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.12 } },
};

const steps = [
  {
    icon: Radio,
    number: "01",
    title: "Connect your channels",
    description:
      "Link your Telegram channel, website chat widget, or other messaging platforms. SaLira unifies all conversations in one inbox.",
  },
  {
    icon: Bot,
    number: "02",
    title: "AI handles conversations",
    description:
      "Your AI assistant learns your products, pricing, and policies. It auto-replies to customers, extracts orders from chat, and escalates when needed.",
  },
  {
    icon: TrendingUp,
    number: "03",
    title: "Grow your business",
    description:
      "Track revenue, manage orders, broadcast to customers, and monitor performance — all from a single dashboard built for Indian businesses.",
  },
];

export function HowItWorks() {
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
          How SaLira works
        </motion.h2>
        <motion.p
          variants={fadeUp}
          className="text-base max-w-xl mx-auto"
          style={{ color: "var(--app-text-muted)" }}
        >
          Three steps from sign-up to your first AI-handled conversation.
        </motion.p>
      </motion.div>

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        variants={stagger}
        className="grid grid-cols-1 md:grid-cols-3 gap-8 relative"
      >
        {/* Connecting line (desktop only) */}
        <div
          className="hidden md:block absolute top-12 left-[16.67%] right-[16.67%] h-0.5"
          style={{ backgroundColor: "var(--app-border)" }}
        />

        {steps.map((step) => (
          <motion.div
            key={step.number}
            variants={fadeUp}
            className="relative text-center px-4"
          >
            {/* Step number badge */}
            <div className="relative z-10 mx-auto mb-6">
              <div
                className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto border-2"
                style={{
                  backgroundColor: "var(--app-surface)",
                  borderColor: "var(--brand-saffron)",
                  boxShadow: "0 0 0 4px var(--app-bg)",
                }}
              >
                <step.icon className="h-7 w-7" style={{ color: "var(--brand-saffron)" }} />
              </div>
              <span
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black"
                style={{
                  backgroundColor: "var(--brand-saffron)",
                  color: "var(--app-bg)",
                }}
              >
                {step.number}
              </span>
            </div>

            <h3
              className="text-lg font-bold mb-2"
              style={{ fontFamily: "var(--font-display)", color: "var(--app-text)" }}
            >
              {step.title}
            </h3>
            <p
              className="text-sm leading-relaxed max-w-xs mx-auto"
              style={{ color: "var(--app-text-muted)" }}
            >
              {step.description}
            </p>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
