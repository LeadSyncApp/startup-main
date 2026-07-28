import { motion } from "framer-motion";
import { Store, Zap } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};

const tiers = [
  {
    icon: Store,
    title: "Home-Grown",
    description: "No GST needed. Simple setup for personal and home sellers getting started.",
    tags: ["Quick setup", "No tax fields", "Upgrade anytime"],
  },
  {
    icon: Zap,
    title: "SME / Retail",
    description: "GST invoicing enabled. Built for registered businesses with tax-ready features.",
    tags: ["GST invoice field", "Business-grade profile", "Tax-ready orders"],
  },
];

export function BusinessScale() {
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
        {tiers.map((tier) => (
          <motion.div
            key={tier.title}
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
              <tier.icon className="h-6 w-6" />
            </div>
            <h3
              className="text-base font-bold mb-2"
              style={{ fontFamily: "var(--font-display)", color: "var(--app-text)" }}
            >
              {tier.title}
            </h3>
            <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--text-secondary)" }}>
              {tier.description}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {tier.tags.map((tag) => (
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
        ))}
      </motion.div>
    </section>
  );
}
