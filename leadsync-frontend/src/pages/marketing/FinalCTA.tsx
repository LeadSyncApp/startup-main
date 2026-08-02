import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { fadeUp, inViewOnce, stagger } from "./motion";

/* ════════════════════════════════════════════════════════════════════ */
/*                              FINAL CTA                              */
/*  The page's only saturated band. Everything else is cream or spruce, */
/*  so this reads as the arrival point rather than one more section.    */
/* ════════════════════════════════════════════════════════════════════ */

const TERRACOTTA = "#A74B2A";
const CREAM = "#faf7f2";

export function FinalCTA() {
  return (
    <section
      className="relative overflow-hidden py-24 sm:py-32"
      style={{ backgroundColor: TERRACOTTA }}
    >
      {/* Warm light from the top-left, so the band isn't a flat rectangle */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 12% 0%, rgba(255, 214, 186, 0.28) 0%, rgba(255,255,255,0) 62%)",
        }}
      />

      <motion.div
        variants={stagger(0.09)}
        initial="hidden"
        whileInView="visible"
        viewport={inViewOnce}
        className="relative max-w-3xl mx-auto px-5 sm:px-8 text-center"
      >
        <motion.h2
          variants={fadeUp}
          className="display-soft text-[2.3rem] sm:text-[3.2rem] leading-[1.06] font-bold"
          style={{ color: CREAM, letterSpacing: "-0.03em" }}
        >
          Open your shop on SaLira tonight.
        </motion.h2>

        <motion.p
          variants={fadeUp}
          className="text-[17px] sm:text-[18.5px] leading-relaxed mt-5 max-w-xl mx-auto"
          style={{ color: "rgba(250, 247, 242, 0.82)" }}
        >
          Connect Telegram or your website chat, add a few products, and let it answer the next
          customer who messages you.
        </motion.p>

        <motion.div variants={fadeUp} className="mt-9">
          <Link
            to="/onboarding"
            className="btn-interactive inline-flex items-center justify-center gap-2 rounded-xl px-9 py-4 text-[16px] font-semibold"
            style={{
              backgroundColor: CREAM,
              color: TERRACOTTA,
              boxShadow: "0 12px 28px -12px rgba(0,0,0,0.45)",
            }}
          >
            Start free
            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>

        <motion.p
          variants={fadeUp}
          className="text-[13.5px] mt-5"
          style={{ color: "rgba(250, 247, 242, 0.7)" }}
        >
          Free to start · No card needed · Set up in a few minutes
        </motion.p>
      </motion.div>
    </section>
  );
}
