/**
 * Home / Marketing Page - Fully public, industry-agnostic
 * Showcases CRM features for any SME (bakery, retailer, e-commerce, services, etc.)
 * No sensitive company data visible. CTAs: Signup / Login
 */
import { Link } from 'react-router-dom';
import MarketingNav from '../components/layout/MarketingNav';
import {
  Users,
  MessageSquare,
  BarChart3,
  Zap,
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  Shield,
  Sparkles,
} from 'lucide-react';

const features = [
  {
    icon: Users,
    title: 'Lead Aggregation',
    description: 'Capture leads from website forms, chat widgets, social media, and demo signups—into one unified inbox across all sources.',
  },
  {
    icon: MessageSquare,
    title: 'Shared Inbox & Chat',
    description: 'Unified conversations per company. Any agent sees the same messages. Manual and automated responses for real-time engagement.',
  },
  {
    icon: BarChart3,
    title: 'Revenue Dashboards',
    description: 'Day, Month, Year views with company-wise breakdown. Track deals, pipeline, and revenue—flexible formatting.',
  },
  {
    icon: TrendingUp,
    title: 'Sales Pipeline',
    description: 'Kanban-style view from qualified to closed won. Track deal value, agents, and progress across stages.',
  },
  {
    icon: Zap,
    title: 'Automation & Workflow',
    description: 'Auto-response templates, lead assignment rules, and notification workflows (coming soon).',
  },
  {
    icon: Shield,
    title: 'Multi-Tenant & Secure',
    description: 'Separate data per company/tenant. Role-based access (Admin, Manager, Agent). Industry-agnostic for any SME.',
  },
];

const industries = ['Retail', 'Bakery & Food', 'E-Commerce', 'Services', 'Real Estate', 'B2B SaaS', 'Consulting', 'Hospitality'];

const testimonials = [
  {
    name: 'Priya Sharma',
    company: 'Retail Shop 123',
    quote: 'LeadSync helped us organize leads from all channels in one place. Our team closes more deals now.',
    rating: 5,
  },
  {
    name: 'Vikram Patel',
    company: 'Bakery XYZ',
    quote: 'Perfect for small businesses. No complex setup. Just add leads, assign to team, and track revenue.',
    rating: 5,
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <MarketingNav />

      {/* Hero Section */}
      <section className="relative py-20 sm:py-32 lg:py-40 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Background gradient elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-100 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        </div>

        <div className="relative mx-auto max-w-4xl text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full bg-cyan-50 border border-cyan-200">
            <Sparkles className="h-4 w-4 text-cyan-600" />
            <span className="text-sm font-semibold text-cyan-700">Lead Management for SMEs</span>
          </div>

          {/* Main heading */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-slate-900 mb-6">
            Sync Every Lead.
            <br />
            <span className="bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">Close More Deals.</span>
          </h1>

          {/* Value Proposition - 3 lines */}
          <div className="max-w-2xl mx-auto mb-8 space-y-3">
            <p className="text-lg text-slate-600 font-medium">
              Aggregate leads from chat, forms, websites, and social media into one unified inbox.
            </p>
            <p className="text-lg text-slate-600 font-medium">
              Manage conversations, assign tasks, and track progress—all in real-time with your team.
            </p>
            <p className="text-lg text-slate-600 font-medium">
              Scale your sales operations with automated workflows and revenue dashboards built for SMEs.
            </p>
          </div>

          {/* CTAs */}
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/signup"
              className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 px-8 py-3.5 text-base font-semibold text-white hover:shadow-xl hover:scale-105 transition-all duration-200"
            >
              Start Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-lg border-2 border-slate-800 bg-white px-8 py-3.5 text-base font-semibold text-slate-900 hover:bg-slate-50 hover:border-cyan-600 transition-colors duration-200"
            >
              Log In
            </Link>
          </div>

          {/* Trust indicators */}
          <p className="mt-8 text-sm text-slate-500 font-medium">
            ✓ No credit card required &nbsp;&nbsp;&nbsp;✓ 14-day free trial &nbsp;&nbsp;&nbsp;✓ Cancel anytime
          </p>
        </div>
      </section>

      {/* Features Grid Section */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-white to-slate-50">
        <div className="mx-auto max-w-7xl">
          {/* Section header */}
          <div className="text-center mb-16 sm:mb-20">
            <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4">
              Everything You Need to Convert
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              From first touch to closed deal—LeadSync brings your lead management into one intelligent platform.
            </p>
          </div>

          {/* Features grid - 6 cards */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="group rounded-2xl border border-slate-200 bg-white p-8 hover:border-cyan-300 hover:shadow-xl hover:shadow-cyan-500/10 transition-all duration-300 cursor-default"
              >
                {/* Icon container */}
                <div className="rounded-xl bg-gradient-to-br from-cyan-100 to-blue-100 p-3 w-fit mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Icon className="h-6 w-6 text-cyan-600" />
                </div>

                {/* Content */}
                <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
                <p className="text-slate-600 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Industries Section */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="mx-auto max-w-6xl">
          {/* Section header */}
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold mb-4">Works for Any Industry</h2>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto">
              LeadSync is built industry-agnostic. Perfect for SMEs across all verticals.
            </p>
          </div>

          {/* Industry tags - 8 cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {industries.map((industry) => (
              <div
                key={industry}
                className="group rounded-xl border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 px-6 py-4 text-center hover:border-cyan-500 hover:shadow-lg hover:shadow-cyan-500/20 transition-all duration-300 cursor-default"
              >
                <p className="font-semibold text-white group-hover:text-cyan-400 transition-colors">{industry}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="mx-auto max-w-6xl">
          {/* Section header */}
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4">What Our Users Say</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Join hundreds of SMEs who trust LeadSync to manage their leads and close more deals.
            </p>
          </div>

          {/* Testimonial cards - 2 cards */}
          <div className="grid gap-8 sm:grid-cols-2 max-w-4xl mx-auto">
            {testimonials.map(({ name, company, quote, rating }) => (
              <div
                key={name}
                className="group rounded-2xl border border-slate-200 bg-white p-8 hover:border-cyan-300 hover:shadow-xl hover:shadow-cyan-500/10 transition-all duration-300"
              >
                {/* Star rating */}
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(rating)].map((_, i) => (
                    <span key={i} className="text-amber-400 text-lg">★</span>
                  ))}
                </div>

                {/* Quote */}
                <p className="text-lg text-slate-700 mb-6 leading-relaxed">"{quote}"</p>

                {/* Author */}
                <div className="border-t border-slate-200 pt-4">
                  <p className="font-bold text-slate-900">{name}</p>
                  <p className="text-sm text-slate-500">{company}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section with dark gradient */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-white to-slate-50">
        <div className="mx-auto max-w-3xl">
          <div className="relative rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-8 sm:px-12 py-16 sm:py-20 text-center border border-slate-700 shadow-2xl overflow-hidden">
            {/* Background accent */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10"></div>
            </div>

            <div className="relative">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Ready to sync your leads?
              </h2>
              <p className="text-lg text-slate-300 mb-8 max-w-lg mx-auto">
                Join SMEs across all industries managing leads more effectively with LeadSync.
              </p>

              {/* CTAs */}
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  to="/signup"
                  className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 px-8 py-3.5 font-semibold text-white hover:shadow-lg hover:shadow-cyan-500/50 hover:scale-105 transition-all duration-200"
                >
                  Get Started Free
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center rounded-lg border border-slate-500 bg-transparent px-8 py-3.5 font-semibold text-slate-200 hover:border-slate-300 hover:bg-slate-700/50 transition-all duration-200"
                >
                  Log In
                </Link>
              </div>

              {/* Benefits */}
              <ul className="mt-8 flex flex-wrap justify-center gap-4 sm:gap-6 text-sm text-slate-300">
                {['No credit card required', '14-day free trial', 'Cancel anytime'].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-cyan-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 sm:grid-cols-3 mb-8">
            {/* Brand */}
            <div>
              <p className="font-bold text-slate-900 mb-2">LeadSync CRM</p>
              <p className="text-sm text-slate-600">Lead management platform for SMEs across all industries.</p>
            </div>

            {/* Quick links */}
            <div>
              <p className="font-semibold text-slate-900 mb-4">Quick Links</p>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="text-slate-600 hover:text-slate-900 transition-colors">Features</a></li>
                <li><a href="#" className="text-slate-600 hover:text-slate-900 transition-colors">Pricing</a></li>
                <li><a href="#" className="text-slate-600 hover:text-slate-900 transition-colors">Blog</a></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <p className="font-semibold text-slate-900 mb-4">Legal</p>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="text-slate-600 hover:text-slate-900 transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="text-slate-600 hover:text-slate-900 transition-colors">Terms of Service</a></li>
                <li><a href="#" className="text-slate-600 hover:text-slate-900 transition-colors">Contact</a></li>
              </ul>
            </div>
          </div>

          {/* Copyright */}
          <div className="border-t border-slate-200 pt-8 text-center text-sm text-slate-600">
            <p>© {new Date().getFullYear()} LeadSync CRM. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
