import { Helmet } from "react-helmet-async";
import { NavBar } from "./marketing/NavBar";
import { ShopCounterStory, MobileStickyPhone, BEATS } from "./marketing/story/ShopCounterStory";
import { useScrollBeat } from "./marketing/story/useScrollBeat";
import { TrustStrip } from "./marketing/TrustStrip";
import { Features } from "./marketing/Features";
import { Verticals } from "./marketing/Verticals";
import { BusinessScale } from "./marketing/BusinessScale";
import { HonestProof } from "./marketing/HonestProof";
import { FinalCTA } from "./marketing/FinalCTA";
import { Footer } from "./marketing/Footer";

/* ════════════════════════════════════════════════════════════════════ */
/*                          MARKETING HOME PAGE                        */
/*                                                                      */
/*  Section backgrounds are deliberately varied rather than one flat    */
/*  cream from top to bottom:                                          */
/*    story        story-bg-0 → story-bg-5  (warms as the story runs)  */
/*    trust strip  story-bg-5               (continues, no seam)       */
/*    features     app-bg                   (resets, a breath)         */
/*    verticals    story-bg-1                                          */
/*    business     app-bg                                              */
/*    proof        story-bg-4 / story-bg-5  (deepest cream)            */
/*    final CTA    #A74B2A                  (the only saturated band)  */
/* ════════════════════════════════════════════════════════════════════ */

const DESCRIPTION =
  "Answer customers, take orders and get paid — on Telegram and your website chat. SaLira replies for you, writes the order down, and has it ready in the morning.";

export default function MarketingHomePage() {
  const { active, setSectionRef } = useScrollBeat(BEATS.length, false);

  return (
    <>
      <Helmet>
        <title>SaLira — Your shop, open even when you're asleep</title>
        {/* Channel claims stay limited to what actually connects today.
            WhatsApp and Instagram are labelled "coming soon" in TrustStrip. */}
        <meta name="description" content={DESCRIPTION} />
        <meta
          property="og:title"
          content="SaLira — Your shop, open even when you're asleep"
        />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="SaLira" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:title"
          content="SaLira — Your shop, open even when you're asleep"
        />
        <meta name="twitter:description" content={DESCRIPTION} />
      </Helmet>

      <div className="min-h-screen" style={{ backgroundColor: "var(--app-bg)" }}>
        <NavBar />
        {/* Mobile sticky phone — rendered here (outside ShopCounterStory's
            relative wrapper) to avoid containing-block issues that break
            position:fixed on some mobile browsers. */}
        <MobileStickyPhone active={active} />
        <ShopCounterStory active={active} setSectionRef={setSectionRef} />
        <TrustStrip />
        {/* HowItWorks.tsx is deliberately not rendered — the scroll-story above
            IS the "how it works" explanation. Same for Hero.tsx and
            DashboardPreview.tsx, which the story replaced. Files kept on disk. */}
        <Features />
        <Verticals />
        <BusinessScale />
        {/* PRICING DEFERRED: No real pricing tiers or subscription plans exist yet.
            Add a Pricing section here once pricing is finalized. */}
        <HonestProof />
        <FinalCTA />
        <Footer />
      </div>
    </>
  );
}
