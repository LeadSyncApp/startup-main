import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ChevronDown, Sparkles } from "lucide-react";
import { EASE, fadeUp, screenSwap, stagger } from "../motion";
import { PhoneFrame } from "./PhoneFrame";
import { LockScreen } from "./screens/LockScreen";
import { ChatScreen } from "./screens/ChatScreen";
import { OrderScreen } from "./screens/OrderScreen";
import { PaidScreen } from "./screens/PaidScreen";
import { DashboardScreen } from "./screens/DashboardScreen";

/* ════════════════════════════════════════════════════════════════════ */
/*                          THE SHOP COUNTER                           */
/*                                                                      */
/*  One scroll, one story: a customer's 9pm message becomes money in    */
/*  the morning. A single phone stays pinned and hands itself across    */
/*  the page as the beats alternate sides.                              */
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

const BEATS: BeatDef[] = [
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

  // Text sits opposite the phone.
  const textColumn = beat.phoneSide === "left" ? "lg:col-start-2" : "lg:col-start-1";

  return (
    <section
      ref={sectionRef}
      data-beat={index}
      className={`relative flex items-center ${
        isHero
          ? "min-h-[100dvh] lg:min-h-[calc(100vh-4rem)] pt-[calc(4rem+240px)] lg:pt-14 pb-20"
          : "min-h-[70dvh] lg:min-h-screen pt-[calc(4rem+240px)] lg:pt-20 pb-16 lg:pb-20"
      }`}
      style={{ backgroundColor: beat.bg }}
    >
      <div className="w-full max-w-6xl mx-auto px-5 sm:px-8 grid lg:grid-cols-2 gap-6 lg:gap-8 items-center">
        {/* Phone, in flow: hidden on mobile (sticky phone handles it); desktop only when motion is reduced */}
        <div
          className={`hidden ${
            reduced ? "lg:flex" : ""
          } justify-center row-start-1 ${
            beat.phoneSide === "left" ? "lg:col-start-1" : "lg:col-start-2"
          }`}
        >
          <InlinePhone beat={beat} instant={reduced} />
        </div>

        <motion.div
          variants={stagger(0.09)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.4 }}
          className={`${textColumn} row-start-2 lg:row-start-1 max-w-xl`}
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
              className="display-soft text-[2.4rem] leading-[1.06] sm:text-[3.1rem] lg:text-[3.5rem] font-bold mb-6"
              style={{ color: "var(--app-text)", letterSpacing: "-0.03em" }}
            >
              {beat.heading}
            </motion.h1>
          ) : (
            <motion.h2
              variants={fadeUp}
              className="display-soft text-[2rem] leading-[1.08] sm:text-[2.6rem] lg:text-[3rem] font-bold mb-5"
              style={{ color: "var(--app-text)", letterSpacing: "-0.03em" }}
            >
              {beat.heading}
            </motion.h2>
          )}

          <motion.p
            variants={fadeUp}
            className="text-[16.5px] sm:text-[17.5px] leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            {beat.body}
          </motion.p>

          {isHero && (
            <>
              <motion.div
                variants={fadeUp}
                className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-8"
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

      {/* Scroll cue, hero only */}
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

export function ShopCounterStory() {
  const reduced = useReducedMotion() ?? false;
  const [active, setActive] = useState(0);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);

  // Scroll-position-based beat detection — more reliable than IntersectionObserver
  // on Android where viewport height changes cause useInView to miscalculate.
  useEffect(() => {
    if (reduced) return;

    const detectActiveBeat = () => {
      const scrollY = window.scrollY;
      const viewportHeight = window.innerHeight;
      const triggerPoint = scrollY + viewportHeight * 0.4;

      let newActive = 0;
      for (let i = sectionRefs.current.length - 1; i >= 0; i--) {
        const el = sectionRefs.current[i];
        if (!el) continue;
        if (el.offsetTop <= triggerPoint) {
          newActive = i;
          break;
        }
      }
      setActive(newActive);
    };

    // Use passive scroll listener for performance
    window.addEventListener("scroll", detectActiveBeat, { passive: true });
    // Run once on mount
    detectActiveBeat();
    return () => window.removeEventListener("scroll", detectActiveBeat);
  }, [reduced]);

  const beat = BEATS[active];

  const setSectionRef = useCallback((index: number) => (el: HTMLElement | null) => {
    sectionRefs.current[index] = el;
  }, []);

  return (
    <div className="relative" id="how-it-works">
      {BEATS.map((b, i) => (
        <BeatSection key={b.id} beat={b} index={i} sectionRef={setSectionRef(i)} reduced={reduced} />
      ))}

      {/* Pinned phone for MOBILE — transitions between screens as user scrolls */}
      {!reduced && (
        <div className="lg:hidden fixed top-14 left-0 right-0 z-10 pointer-events-none flex justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={beat.id}
              variants={screenSwap}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <PhoneFrame
                time={beat.time}
                screenBg={beat.screenBg}
                statusTone={beat.statusTone}
              >
                <StoryScreen id={beat.id} instant={false} />
              </PhoneFrame>
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* Pinned phone for DESKTOP — glides between left/right as beats alternate */}
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
