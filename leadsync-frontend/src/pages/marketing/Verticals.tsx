import { motion } from "framer-motion";
import { ShoppingBag, Scissors, Utensils, Stethoscope } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};

const verticals = [
  {
    icon: ShoppingBag,
    label: "Retail / Shop",
    description: "Manage walk-in and online customers, track sales, and send invoices in seconds.",
  },
  {
    icon: Scissors,
    label: "Handmade / Crafts",
    description: "Showcase your creations, handle custom orders, and keep your craft business organised.",
  },
  {
    icon: Utensils,
    label: "Food & Beverage",
    description: "Take orders, manage menus, and keep your food business running smoothly.",
  },
  {
    icon: Stethoscope,
    label: "Services / Appointments",
    description: "Schedule appointments, manage bookings, and never miss a client follow-up.",
  },
];

export function Verticals() {
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
        {verticals.map((v) => (
          <motion.div
            key={v.label}
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
              <v.icon className="h-6 w-6" />
            </div>
            <h3
              className="text-sm font-bold mb-1"
              style={{ fontFamily: "var(--font-display)", color: "var(--app-text)" }}
            >
              {v.label}
            </h3>
            <p className="text-xs leading-relaxed" style={{ color: "var(--app-text-muted)" }}>
              {v.description}
            </p>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
