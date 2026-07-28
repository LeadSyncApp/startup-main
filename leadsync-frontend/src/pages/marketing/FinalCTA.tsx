import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};

export function FinalCTA() {
  return (
    <section className="pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
          Set up your business in minutes. No credit card required.
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
    </section>
  );
}
