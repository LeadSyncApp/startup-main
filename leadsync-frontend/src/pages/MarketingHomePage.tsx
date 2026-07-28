import { Helmet } from "react-helmet-async";
import { NavBar } from "./marketing/NavBar";
import { Hero } from "./marketing/Hero";
import { HowItWorks } from "./marketing/HowItWorks";
import { Verticals } from "./marketing/Verticals";
import { Features } from "./marketing/Features";
import { BusinessScale } from "./marketing/BusinessScale";
import { FinalCTA } from "./marketing/FinalCTA";
import { Footer } from "./marketing/Footer";

/* ════════════════════════════════════════════════════════════════════ */
/*                          MARKETING HOME PAGE                        */
/* ════════════════════════════════════════════════════════════════════ */

export default function MarketingHomePage() {
  return (
    <>
      <Helmet>
        <title>SaLira — Your Shop, Digitized</title>
        <meta
          name="description"
          content="Manage your shop across Telegram, WhatsApp, Instagram and more. Send invoices, track orders, automate replies, and grow your business — all from one place."
        />
        <meta property="og:title" content="SaLira — Your Shop, Digitized" />
        <meta
          property="og:description"
          content="AI-powered commerce platform for Indian SMEs. Manage leads, orders, inventory, and customer conversations across multiple channels."
        />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="SaLira" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="SaLira — Your Shop, Digitized" />
        <meta
          name="twitter:description"
          content="AI-powered commerce platform for Indian SMEs. Manage leads, orders, inventory, and customer conversations across multiple channels."
        />
      </Helmet>

      <div className="min-h-screen" style={{ backgroundColor: "var(--app-bg)" }}>
        <NavBar />
        <Hero />
        <HowItWorks />
        <Verticals />
        <Features />
        <BusinessScale />
        {/* PRICING DEFERRED: No real pricing tiers or subscription plans exist yet.
            Add a Pricing section here once pricing is finalized. */}
        <FinalCTA />
        <Footer />
      </div>
    </>
  );
}
