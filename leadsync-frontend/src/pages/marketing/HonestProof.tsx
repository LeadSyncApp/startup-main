import { motion } from "framer-motion";
import { CreditCard, Lock, X } from "lucide-react";
import { EASE, fadeUp, inViewOnce, stagger } from "./motion";

/* ════════════════════════════════════════════════════════════════════ */
/*                            HONEST PROOF                             */
/*                                                                      */
/*  SaLira has no customers to quote yet, so this section makes no      */
/*  claim it can't back. No invented names, no fake logos, no made-up   */
/*  numbers. When real testimonials exist they slot in at the TODO      */
/*  marker near the bottom of this file.                                */
/* ════════════════════════════════════════════════════════════════════ */

const STOP_DOING = [
  "Replying to the same question at midnight",
  "Writing orders on the back of a bill",
  "Chasing people for payment reminders",
  "Counting stock by hand at closing time",
];

/** Text with a line that draws itself through on scroll. */
function StruckItem({ text, index }: { text: string; index: number }) {
  return (
    <motion.li
      variants={fadeUp}
      className="flex items-start gap-3"
    >
      <span
        className="mt-1 h-5 w-5 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: "var(--brand-saffron-soft)" }}
      >
        <X className="h-3 w-3" strokeWidth={3} style={{ color: "var(--brand-saffron)" }} />
      </span>
      <span className="relative inline-block">
        <span
          className="text-[17px] sm:text-[18px] leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          {text}
        </span>
        <motion.span
          aria-hidden="true"
          className="absolute left-0 top-1/2 h-[2px] w-full origin-left rounded-full"
          style={{ backgroundColor: "var(--brand-saffron)" }}
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true, amount: 0.8 }}
          transition={{ duration: 0.55, delay: 0.25 + index * 0.12, ease: EASE }}
        />
      </span>
    </motion.li>
  );
}

function Assurance({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Lock;
  title: string;
  body: string;
}) {
  return (
    <motion.div variants={fadeUp} className="flex items-start gap-3">
      <span
        className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: "var(--brand-saffron-soft)", color: "var(--brand-saffron)" }}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <p
          className="text-[15px] font-bold mb-0.5"
          style={{ color: "var(--app-text)", fontFamily: "var(--font-display)" }}
        >
          {title}
        </p>
        <p className="text-[14px] leading-relaxed" style={{ color: "var(--app-text-muted)" }}>
          {body}
        </p>
      </div>
    </motion.div>
  );
}

export function HonestProof() {
  return (
    <section
      className="py-24 sm:py-28"
      style={{ backgroundColor: "var(--story-bg-4)" }}
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        {/* ── What you can stop doing ── */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <motion.div
            variants={stagger(0.09)}
            initial="hidden"
            whileInView="visible"
            viewport={inViewOnce}
          >
            <motion.p
              variants={fadeUp}
              className="text-[11px] font-semibold uppercase tracking-[0.18em] mb-4"
              style={{ color: "var(--brand-saffron)", fontFamily: "var(--font-mono)" }}
            >
              The honest pitch
            </motion.p>
            <motion.h2
              variants={fadeUp}
              className="display-soft text-[2rem] sm:text-[2.5rem] leading-[1.1] font-bold mb-5"
              style={{ color: "var(--app-text)", letterSpacing: "-0.03em" }}
            >
              What you can stop doing.
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="text-[16.5px] leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              We're new, so we won't pretend thousands of shops already use this. Here's the
              plain version of what changes on your first week.
            </motion.p>
          </motion.div>

          <motion.ul
            variants={stagger(0.1)}
            initial="hidden"
            whileInView="visible"
            viewport={inViewOnce}
            className="space-y-5"
          >
            {STOP_DOING.map((text, i) => (
              <StruckItem key={text} text={text} index={i} />
            ))}
          </motion.ul>
        </div>

        {/* ── Founder's note ──
            ╔══════════════════════════════════════════════════════════╗
            ║  PLACEHOLDER COPY — WRITTEN BY CLAUDE, NOT BY THE FOUNDER ║
            ║  Replace the three sentences and the signature below      ║
            ║  before launch. Marked in the DOM as                      ║
            ║  data-placeholder="founder-note" so it's easy to find.    ║
            ╚══════════════════════════════════════════════════════════╝ */}
        <motion.figure
          data-placeholder="founder-note"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          className="mt-20 sm:mt-24 rounded-3xl px-7 py-10 sm:px-14 sm:py-14 max-w-4xl mx-auto"
          style={{
            backgroundColor: "var(--story-bg-5)",
            boxShadow: "var(--app-shadow-xl)",
          }}
        >
          <blockquote
            className="display-soft italic text-[19px] sm:text-[23px] leading-[1.55]"
            style={{ color: "var(--app-text)" }}
          >
            I grew up around small shops, and the thing I kept noticing was how much of the day
            disappears into work that isn't really the work — answering the same question for the
            tenth time, writing an order on the back of a bill, trying to remember who still owes
            you money. SaLira is my attempt to hand those bits to a computer, so the part you
            actually care about is the part you get to spend your day on. It's early, and I'd
            genuinely like to hear what's missing.
          </blockquote>
          <figcaption
            className="mt-7 flex items-center gap-3"
            style={{ color: "var(--app-text-muted)" }}
          >
            <span
              className="h-10 w-10 rounded-full flex items-center justify-center text-[15px] font-bold shrink-0"
              style={{ backgroundColor: "var(--brand-saffron-soft)", color: "var(--brand-saffron)" }}
            >
              N
            </span>
            <span className="text-[14px] leading-tight">
              <span className="block font-bold" style={{ color: "var(--app-text)" }}>
                Nikilesh Ram S K
              </span>
              Founder, SaLira
            </span>
          </figcaption>
        </motion.figure>

        {/* ── Two plain assurances ── */}
        <motion.div
          variants={stagger(0.1)}
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          className="mt-16 grid sm:grid-cols-2 gap-8 max-w-3xl mx-auto"
        >
          <Assurance
            icon={Lock}
            title="Your shop's data is separate"
            body="Every shop's information is kept apart from every other shop's. Nobody else can see yours."
          />
          <Assurance
            icon={CreditCard}
            title="No card to start"
            body="Sign up, connect a channel, and try it with your own products. No payment details asked for."
          />
        </motion.div>

        {/* TODO: Real testimonials go here once merchants agree to be quoted.
            Keep names, business type and city — no stock photos, no invented
            people. Until then this space stays empty on purpose. */}
      </div>
    </section>
  );
}
