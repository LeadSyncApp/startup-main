import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ChevronDown, Sparkles } from "lucide-react";
import { EASE, screenSwap } from "../motion";
import { PhoneFrame } from "./PhoneFrame";
import { LockScreen } from "./screens/LockScreen";
import { ChatScreen } from "./screens/ChatScreen";
import { OrderScreen } from "./screens/OrderScreen";
import { PaidScreen } from "./screens/PaidScreen";
import { DashboardScreen } from "./screens/DashboardScreen";

/* ── Debug: set to true to draw red outlines around the phone and text
     containers so overlap is instantly visible in a screenshot. ── */
const DEBUG_STORY = false;

/* ════════════════════════════════════════════════════════════════════ */
/*                          THE SHOP COUNTER                           */
/*                                                                      */
/*  One scroll, one story: a customer's 9pm message becomes money in    */
/*  the morning. A single phone stays pinned and hands itself across    */
/*  the page as the beats alternate sides.                              */
/*                                                                      */
/*  MOBILE LAYOUT (per-section dual sticky):                            */
/*    Each <section> owns its own sticky phone + text pair.             */
/*    Phone: position:sticky top-16 (pins at 64px).                     */
/*    Text:  position:sticky top-[600px] (pins below phone, 36px gap).  */
/*    Both pin simultaneously while section is in viewport, then        */
/*    release together when section scrolls out.                        */
/*                                                                      */
/*  DESKTOP LAYOUT (unchanged):                                         */
/*    Phone in a global overlay with horizontal animation.              */
/*    Text in normal flow inside the section grid.                      */
/* ════════════════════════════════════════════════════════════════════ */

type ScreenId = "lock" | "chat-asked" | "chat-answered" | "order" | "paid" | "dashboard";

interface BeatDef {
  id: ScreenId;
  phoneSide: "left" | "right";
  bg: string;
  /** Phone status-bar clock. */
  time: string;
  screenBg: string;
  statusTone: "light" | "dark";
  eyebrow: string;
  heading: ReactNode;
  body: string;
}

const LOCK_BG = "linear-gradient(165deg, #24312C 0%, #141b19 55%, #0F1614 100%)";
const CREAM = "#faf7f2";

/** An italicised word, in Fraunces, used once per beat at most. */
function Em({ children }: { children: ReactNode }) {
  return (
    <em className="italic" style={{ fontFamily: "var(--font-display)" }}>
      {children}
    </em>
  );
}

export const BEATS: BeatDef[] = [
  {
    id: "lock",
    phoneSide: "right",
    bg: "var(--story-bg-0)",
    time: "9:04",
    screenBg: LOCK_BG,
    statusTone: "light",
    eyebrow: "Built for Indian shops",
    heading: (
      <>
        Your shop stays open,
        <br />
        even when you're <Em>asleep</Em>.
      </>
    ),
    body: "SaLira answers your customers on Telegram and your website, writes down their orders, and has everything ready for you in the morning.",
  },
  {
    id: "chat-asked",
    phoneSide: "left",
    bg: "var(--story-bg-1)",
    time: "9:04",
    screenBg: CREAM,
    statusTone: "dark",
    eyebrow: "9:04 pm",
    heading: <>A customer messages you at 9 pm.</>,
    body: "You've shut the shop and sat down for dinner. Your phone buzzes. Someone wants to know if you have her size.",
  },
  {
    id: "chat-answered",
    phoneSide: "right",
    bg: "var(--story-bg-2)",
    time: "9:05",
    screenBg: CREAM,
    statusTone: "dark",
    eyebrow: "9:05 pm",
    heading: (
      <>
        SaLira answers.
        <br />
        You stay <Em>asleep</Em>.
      </>
    ),
    body: "It knows your products, your prices and what's left in stock — so it gives her a real answer, not \"we'll get back to you tomorrow\".",
  },
  {
    id: "order",
    phoneSide: "left",
    bg: "var(--story-bg-3)",
    time: "9:06",
    screenBg: CREAM,
    statusTone: "dark",
    eyebrow: "9:06 pm",
    heading: <>The order writes itself down.</>,
    body: "No notebook, no screenshots, no typing it out again later. The item, the size, the price and who it's for — all saved, and your stock count updated.",
  },
  {
    id: "paid",
    phoneSide: "right",
    bg: "var(--story-bg-4)",
    time: "9:07",
    screenBg: CREAM,
    statusTone: "dark",
    eyebrow: "9:07 pm",
    heading: <>Payment link sent. Money received.</>,
    body: "She pays in the same chat she was already using. The moment the money arrives, the order marks itself paid.",
  },
  {
    id: "dashboard",
    phoneSide: "left",
    bg: "var(--story-bg-5)",
    time: "6:40",
    screenBg: CREAM,
    statusTone: "dark",
    eyebrow: "Next morning",
    heading: (
      <>
        You wake up
        <br />
        to <Em>this</Em>.
      </>
    ),
    body: "Open SaLira with your morning tea and see exactly what happened while you slept — what sold, what came in, and what's ready to pack.",
  },
];

function StoryScreen({ id, instant }: { id: ScreenId; instant: boolean }) {
  switch (id) {
    case "lock":
      return <LockScreen instant={instant} />;
    case "chat-asked":
      return <ChatScreen stage="asked" instant={instant} />;
    case "chat-answered":
      return <ChatScreen stage="answered" instant={instant} />;
    case "order":
      return <OrderScreen instant={instant} />;
    case "paid":
      return <PaidScreen instant={instant} />;
    case "dashboard":
      return <DashboardScreen instant={instant} />;
  }
}

/** Phone rendered in the flow — mobile always, desktop when motion is reduced. */
function InlinePhone({ beat, instant }: { beat: BeatDef; instant: boolean }) {
  return (
    <PhoneFrame time={beat.time} screenBg={beat.screenBg} statusTone={beat.statusTone}>
      <StoryScreen id={beat.id} instant={instant} />
    </PhoneFrame>
  );
}

interface BeatSectionProps {
  beat: BeatDef;
  index: number;
  sectionRef: (el: HTMLElement | null) => void;
  reduced: boolean;
}

function BeatSection({ beat, index, sectionRef, reduced }: BeatSectionProps) {
  const isHero = index === 0;

  // Alternating entrance direction for mobile phone (right / left)
  const phoneInitialX = beat.phoneSide === "right" ? 100 : -100;

  // Bidirectional phone entrance variants (scroll down & scroll up)
  const phoneVariants = {
    hidden: { x: reduced ? 0 : phoneInitialX, opacity: reduced ? 1 : 0 },
    visible: {
      x: 0,
      opacity: 1,
      transition: { duration: 0.55, ease: EASE },
    },
  };

  // Staggered parent container variants for mobile description text
  const textContainerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.05,
      },
    },
  };

  // Individual staggered item entrance variants (eyebrow, heading, body, CTAs)
  const textItemVariants = {
    hidden: { opacity: reduced ? 1 : 0, y: reduced ? 0 : 32 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.48, ease: EASE },
    },
  };

  return (
    <section
      ref={sectionRef}
      data-beat={index}
      className={`relative flex flex-col items-center justify-center min-h-[65vh] py-6 ${
        isHero
          ? "md:flex-row md:items-center md:min-h-[70vh] md:py-10"
          : "md:flex-row md:items-center md:min-h-[70vh] md:py-10"
      } ${DEBUG_STORY ? "debug-story-section" : ""}`}
      style={{ backgroundColor: beat.bg }}
    >
      {/* ── MOBILE: sticky phone with bidirectional scroll entrance motion ──
          Animates bidirectionally when scrolling DOWN and scrolling UP (once: false). */}
      <div className={`w-full md:hidden ${DEBUG_STORY ? "debug-story-phone" : ""}`}>
        <div className="sticky top-16 flex justify-center z-20 overflow-visible">
          <motion.div
            variants={phoneVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: false, amount: 0.2 }}
            className="will-change-transform"
          >
            <InlinePhone beat={beat} instant={false} />
          </motion.div>
        </div>
      </div>

      {/* ── MOBILE: text — in flow directly below phone with staggered bidirectional fade-up ──
          Staggered children (eyebrow -> heading -> body) animate prominently right as text enters view. */}
      <motion.div
        variants={textContainerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: false, amount: 0.35 }}
        className={`w-full relative z-10 px-5 pt-3 pb-8 max-w-xl mx-auto md:hidden ${DEBUG_STORY ? "debug-story-text" : ""}`}
      >
        {isHero ? (
          <motion.span
            variants={textItemVariants}
            className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] px-3 py-1.5 rounded-full mb-6"
            style={{
              backgroundColor: "var(--brand-saffron-soft)",
              color: "var(--brand-saffron)",
            }}
          >
            <Sparkles className="h-3 w-3" />
            {beat.eyebrow}
          </motion.span>
        ) : (
          <motion.p
            variants={textItemVariants}
            className="text-[11px] font-semibold uppercase tracking-[0.18em] mb-4"
            style={{ color: "var(--brand-saffron)", fontFamily: "var(--font-mono)" }}
          >
            {beat.eyebrow}
          </motion.p>
        )}

        {isHero ? (
          <motion.h1
            variants={textItemVariants}
            className="display-soft text-[2.4rem] leading-[1.06] font-bold mb-6"
            style={{ color: "var(--app-text)", letterSpacing: "-0.03em" }}
          >
            {beat.heading}
          </motion.h1>
        ) : (
          <motion.h2
            variants={textItemVariants}
            className="display-soft text-[2rem] leading-[1.08] font-bold mb-5"
            style={{ color: "var(--app-text)", letterSpacing: "-0.03em" }}
          >
            {beat.heading}
          </motion.h2>
        )}

        <motion.p
          variants={textItemVariants}
          className="text-[16.5px] leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          {beat.body}
        </motion.p>

        {isHero && (
          <>
            <motion.div
              variants={textItemVariants}
              className="flex flex-col items-stretch gap-3 mt-8"
            >
              <Link
                to="/onboarding"
                className="btn-primary text-base !px-7 !py-3.5 inline-flex items-center justify-center gap-2"
              >
                Start free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/login"
                className="btn-secondary text-base !px-7 !py-3.5 justify-center"
              >
                Log in
              </Link>
            </motion.div>
            <motion.p
              variants={textItemVariants}
              className="text-[13px] mt-4"
              style={{ color: "var(--app-text-muted)" }}
            >
              Free to start · No card needed · Set up in a few minutes
            </motion.p>
          </>
        )}
      </motion.div>

      {/* ── DESKTOP: 2-column grid with text in col-start-1 or col-start-2 ── */}
      <div className="hidden md:grid w-full max-w-6xl mx-auto px-8 grid-cols-2 gap-8 lg:gap-16 items-center relative z-10">
        {/* Placeholder spacer div matching phone column for reduced motion */}
        <div
          className={`${
            reduced ? "flex" : "hidden"
          } justify-center row-start-1 ${
            beat.phoneSide === "left" ? "col-start-1" : "col-start-2"
          }`}
        >
          <InlinePhone beat={beat} instant={reduced} />
        </div>

        {/* Text column */}
        <motion.div
          variants={textContainerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, amount: 0.35 }}
          className={`${
            beat.phoneSide === "left" ? "col-start-2" : "col-start-1"
          } row-start-1 max-w-xl`}
        >
          {isHero ? (
            <motion.span
              variants={textItemVariants}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] px-3 py-1.5 rounded-full mb-6"
              style={{
                backgroundColor: "var(--brand-saffron-soft)",
                color: "var(--brand-saffron)",
              }}
            >
              <Sparkles className="h-3 w-3" />
              {beat.eyebrow}
            </motion.span>
          ) : (
            <motion.p
              variants={textItemVariants}
              className="text-[11px] font-semibold uppercase tracking-[0.18em] mb-4"
              style={{ color: "var(--brand-saffron)", fontFamily: "var(--font-mono)" }}
            >
              {beat.eyebrow}
            </motion.p>
          )}

          {isHero ? (
            <motion.h1
              variants={textItemVariants}
              className="display-soft text-[2.8rem] lg:text-[3.5rem] leading-[1.06] font-bold mb-6"
              style={{ color: "var(--app-text)", letterSpacing: "-0.03em" }}
            >
              {beat.heading}
            </motion.h1>
          ) : (
            <motion.h2
              variants={textItemVariants}
              className="display-soft text-[2.4rem] lg:text-[3rem] leading-[1.08] font-bold mb-5"
              style={{ color: "var(--app-text)", letterSpacing: "-0.03em" }}
            >
              {beat.heading}
            </motion.h2>
          )}

          <motion.p
            variants={textItemVariants}
            className="text-[17.5px] leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            {beat.body}
          </motion.p>

          {isHero && (
            <>
              <motion.div
                variants={textItemVariants}
                className="flex flex-row items-center gap-3 mt-8"
              >
                <Link
                  to="/onboarding"
                  className="btn-primary text-base !px-7 !py-3.5 inline-flex items-center justify-center gap-2"
                >
                  Start free
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/login"
                  className="btn-secondary text-base !px-7 !py-3.5 justify-center"
                >
                  Log in
                </Link>
              </motion.div>
              <motion.p
                variants={textItemVariants}
                className="text-[13px] mt-4"
                style={{ color: "var(--app-text-muted)" }}
              >
                Free to start · No card needed · Set up in a few minutes
              </motion.p>
            </>
          )}
        </motion.div>
      </div>

      {/* Scroll cue, hero only, desktop */}
      {isHero && !reduced && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4, duration: 0.6 }}
          className="hidden md:flex absolute bottom-7 left-1/2 -translate-x-1/2 flex-col items-center gap-1.5"
        >
          <span
            className="text-[10px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: "var(--app-text-muted)" }}
          >
            See how a sale happens
          </span>
          <motion.span
            animate={{ y: [0, 5, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          >
            <ChevronDown className="h-4 w-4" style={{ color: "var(--brand-saffron)" }} />
          </motion.span>
        </motion.div>
      )}
    </section>
  );
}

interface ShopCounterStoryProps {
  active: number;
  setSectionRef: (index: number) => (el: HTMLElement | null) => void;
}

export function ShopCounterStory({ active, setSectionRef }: ShopCounterStoryProps) {
  const reduced = useReducedMotion() ?? false;
  const beat = BEATS[active];

  return (
    <div className="relative overflow-x-clip" id="how-it-works">
      {BEATS.map((b, i) => (
        <BeatSection key={b.id} beat={b} index={i} sectionRef={setSectionRef(i)} reduced={reduced} />
      ))}

      {/* ── DESKTOP ONLY: global pinned phone with grid-bounded horizontal glide ── */}
      {!reduced && (
        <div className="hidden md:block absolute inset-0 pointer-events-none z-20">
          <div className="sticky top-16 h-[calc(100dvh-4rem)] flex items-center">
            <div className="w-full max-w-6xl mx-auto px-8 relative">
              <motion.div
                className="w-1/2 flex justify-center"
                animate={{
                  x: beat.phoneSide === "left" ? "0%" : "100%",
                }}
                transition={{ duration: 0.75, ease: EASE }}
              >
                <PhoneFrame
                  time={beat.time}
                  screenBg={beat.screenBg}
                  statusTone={beat.statusTone}
                >
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={beat.id}
                      variants={screenSwap}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className="flex-1 flex flex-col"
                    >
                      <StoryScreen id={beat.id} instant={false} />
                    </motion.div>
                  </AnimatePresence>
                </PhoneFrame>
              </motion.div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
