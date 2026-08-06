import { useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, ChevronDown, Sparkles } from "lucide-react";
import { EASE, fadeUp, screenSwap, stagger } from "../motion";
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

  // Local ref for tracking section scroll progress
  const sectionElementRef = useRef<HTMLElement | null>(null);

  // Scroll offset ["start 85%", "start 64px"]:
  // Animation triggers as section top enters lower 15% of viewport and settles at sticky top-16 (64px).
  const { scrollYProgress } = useScroll({
    target: sectionElementRef,
    offset: ["start 85%", "start 64px"],
  });

  // Alternating horizontal entrance direction matching beat.phoneSide
  // "right" -> slides in from right (+120px to 0)
  // "left"  -> slides in from left (-120px to 0)
  const initialX = beat.phoneSide === "right" ? 120 : -120;

  // Eased scroll-linked horizontal transform for phone
  const rawX = useTransform(
    scrollYProgress,
    [0, 1],
    [initialX, 0],
    { ease: (t) => 1 - Math.pow(1 - t, 2.5) }
  );

  // Fade-in opacity transform for phone (0 when section is below viewport -> 1 at sticky pin)
  const rawPhoneOpacity = useTransform(
    scrollYProgress,
    [0, 0.4, 1],
    [0, 0.6, 1]
  );

  // Bidirectional scroll-linked fade-up transform for description text (y: 28px -> 0, opacity: 0 -> 1)
  // Operates identically whether scrolling DOWN or scrolling UP!
  const rawTextY = useTransform(
    scrollYProgress,
    [0, 1],
    [28, 0],
    { ease: (t) => 1 - Math.pow(1 - t, 2) }
  );

  const rawTextOpacity = useTransform(
    scrollYProgress,
    [0, 0.4, 1],
    [0, 0.6, 1]
  );

  const scrollX = reduced ? 0 : rawX;
  const scrollOpacity = reduced ? 1 : rawPhoneOpacity;
  const textY = reduced ? 0 : rawTextY;
  const textOpacity = reduced ? 1 : rawTextOpacity;

  // Desktop: text sits opposite the phone in the 2-col grid.
  const textColumn = beat.phoneSide === "left" ? "lg:col-start-2" : "lg:col-start-1";

  return (
    <section
      ref={(el) => {
        sectionElementRef.current = el;
        sectionRef(el);
      }}
      data-beat={index}
      className={`relative flex flex-col items-start min-h-screen ${
        isHero
          ? "lg:flex-row lg:items-center lg:min-h-screen lg:pt-14 lg:pb-20"
          : "lg:flex-row lg:items-center lg:min-h-screen lg:pt-20 lg:pb-20"
      } ${DEBUG_STORY ? "debug-story-section" : ""}`}
      style={{ backgroundColor: beat.bg }}
    >
      {/* ── MOBILE: sticky phone with entrance motion ──
          Hero beat (beat 0) automatically slides in from the right on initial mount.
          Beats 1-5 slide in from alternating left/right sides as driven by scroll progress. */}
      <div className={`w-full lg:hidden ${DEBUG_STORY ? "debug-story-phone" : ""}`}>
        <div className="sticky top-16 flex justify-center z-20 overflow-visible">
          {isHero && !reduced ? (
            <motion.div
              initial={{ x: 120, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.65, ease: EASE, delay: 0.15 }}
              className="will-change-transform"
            >
              <InlinePhone beat={beat} instant={false} />
            </motion.div>
          ) : (
            <motion.div style={{ x: scrollX, opacity: scrollOpacity }} className="will-change-transform">
              <InlinePhone beat={beat} instant={false} />
            </motion.div>
          )}
        </div>
      </div>

      {/* ── MOBILE: text — in flow directly below phone with bidirectional scroll-linked fade-up ──
          Description text stays opacity 0 until section enters viewport, preventing pre-scroll peeking,
          and animates bidirectionally when scrolling DOWN and scrolling UP. */}
      <motion.div
        style={{ y: isHero ? 0 : textY, opacity: isHero ? 1 : textOpacity }}
        className={`w-full relative z-10 px-5 pt-2 pb-6 max-w-xl mx-auto lg:hidden ${DEBUG_STORY ? "debug-story-text" : ""}`}
      >
        {isHero ? (
          <motion.span
            variants={fadeUp}
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
            variants={fadeUp}
            className="text-[11px] font-semibold uppercase tracking-[0.18em] mb-4"
            style={{ color: "var(--brand-saffron)", fontFamily: "var(--font-mono)" }}
          >
            {beat.eyebrow}
          </motion.p>
        )}

        {isHero ? (
          <motion.h1
            variants={fadeUp}
            className="display-soft text-[2.4rem] leading-[1.06] font-bold mb-6"
            style={{ color: "var(--app-text)", letterSpacing: "-0.03em" }}
          >
            {beat.heading}
          </motion.h1>
        ) : (
          <motion.h2
            variants={fadeUp}
            className="display-soft text-[2rem] leading-[1.08] font-bold mb-5"
            style={{ color: "var(--app-text)", letterSpacing: "-0.03em" }}
          >
            {beat.heading}
          </motion.h2>
        )}

        <motion.p
          variants={fadeUp}
          className="text-[16.5px] leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          {beat.body}
        </motion.p>

        {isHero && (
          <>
            <motion.div
              variants={fadeUp}
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
              variants={fadeUp}
              className="text-[13px] mt-4"
              style={{ color: "var(--app-text-muted)" }}
            >
              Free to start · No card needed · Set up in a few minutes
            </motion.p>
          </>
        )}
      </motion.div>

      {/* ── DESKTOP: grid with phone + text side-by-side (unchanged) ── */}
      <div className="hidden lg:grid w-full max-w-6xl mx-auto px-8 grid-cols-2 gap-8 items-center">
        {/* Phone, in flow: only when motion is reduced (overlay handles it otherwise) */}
        <div
          className={`${
            reduced ? "flex" : "hidden"
          } justify-center row-start-1 ${
            beat.phoneSide === "left" ? "col-start-1" : "col-start-2"
          }`}
        >
          <InlinePhone beat={beat} instant={reduced} />
        </div>

        <motion.div
          variants={stagger(0.09)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.4 }}
          className={`${textColumn} row-start-1 max-w-xl`}
        >
          {isHero ? (
            <motion.span
              variants={fadeUp}
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
              variants={fadeUp}
              className="text-[11px] font-semibold uppercase tracking-[0.18em] mb-4"
              style={{ color: "var(--brand-saffron)", fontFamily: "var(--font-mono)" }}
            >
              {beat.eyebrow}
            </motion.p>
          )}

          {isHero ? (
            <motion.h1
              variants={fadeUp}
              className="display-soft text-[3.5rem] leading-[1.06] font-bold mb-6"
              style={{ color: "var(--app-text)", letterSpacing: "-0.03em" }}
            >
              {beat.heading}
            </motion.h1>
          ) : (
            <motion.h2
              variants={fadeUp}
              className="display-soft text-[3rem] leading-[1.08] font-bold mb-5"
              style={{ color: "var(--app-text)", letterSpacing: "-0.03em" }}
            >
              {beat.heading}
            </motion.h2>
          )}

          <motion.p
            variants={fadeUp}
            className="text-[17.5px] leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            {beat.body}
          </motion.p>

          {isHero && (
            <>
              <motion.div
                variants={fadeUp}
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
                variants={fadeUp}
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
          className="hidden lg:flex absolute bottom-7 left-1/2 -translate-x-1/2 flex-col items-center gap-1.5"
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

      {/* ── DESKTOP ONLY: global pinned phone with horizontal glide ──
          Mobile uses per-section sticky phones (inside BeatSection). */}
      {!reduced && (
        <div className="hidden lg:block absolute inset-0 pointer-events-none z-10">
          <div className="sticky top-16 h-[calc(100dvh-4rem)]">
            <div className="relative h-full max-w-6xl mx-auto px-8">
              <motion.div
                className="absolute"
                style={{ top: "50%", left: "27%", transform: "translate(-50%, -50%)" }}
                animate={{ left: beat.phoneSide === "left" ? "27%" : "73%" }}
                transition={{ duration: 0.85, ease: EASE }}
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
