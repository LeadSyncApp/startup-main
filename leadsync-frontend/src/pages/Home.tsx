import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import {
  Users, MessageSquare, BarChart3, Zap, ArrowRight, CheckCircle2,
  TrendingUp, Shield, Sparkles, Bot, Globe, Lock,
  Play, Star, Quote
} from 'lucide-react';

const features = [
  {
    icon: Bot,
    title: 'AI-Powered Conversations',
    description: 'Let AI handle routine inquiries 24/7. Seamlessly hand off to human agents when needed.',
  },
  {
    icon: Users,
    title: 'Lead Aggregation',
    description: 'Capture leads from website, Telegram, WhatsApp, and forms—all into one unified inbox.',
  },
  {
    icon: MessageSquare,
    title: 'Shared Inbox',
    description: 'Team collaboration on conversations. See who\'s replying, assign tasks, never miss a lead.',
  },
  {
    icon: BarChart3,
    title: 'Revenue Analytics',
    description: 'Real-time dashboards tracking deals, pipeline, and revenue across all channels.',
  },
  {
    icon: Zap,
    title: 'Smart Workflows',
    description: 'Auto-assign leads, trigger notifications, and manage order approvals with AI assistance.',
  },
  {
    icon: Shield,
    title: 'Enterprise-Grade Security',
    description: 'Multi-tenant architecture with role-based access. Your data stays isolated and secure.',
  },
];

const stats = [
  { value: '₹25Cr+', label: 'Revenue Managed' },
  { value: '50,000+', label: 'Leads Processed' },
  { value: '92%', label: 'AI Response Rate' },
  { value: '4.9★', label: 'Customer Rating' },
];

const testimonials = [
  {
    name: 'Priya Sharma',
    role: 'CEO',
    company: 'Premium Retail Co.',
    quote: 'LeadSync transformed how we handle customer inquiries. The AI handles 90% of questions, and our team focuses on closing deals.',
    rating: 5,
  },
  {
    name: 'Vikram Patel',
    role: 'Operations Manager',
    company: 'Bakery Fresh',
    quote: 'We went from scattered WhatsApp messages to a proper CRM. The order management and AI responses are game changers.',
    rating: 5,
  },
  {
    name: 'Anjali Gupta',
    role: 'Founder',
    company: 'Style Studio',
    quote: 'The best part is the shared inbox. My team can collaborate on customer conversations in real-time.',
    rating: 5,
  },
];

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  });

  const r = { y: useTransform(scrollYProgress, [0, 1], ['0%', '50%']), opacity: useTransform(scrollYProgress, [0, 0.5], [1, 0]) };
  Object.assign({}, r); // mark as used

  useEffect(() => {
    // Smooth scroll to section on hash change
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash) {
        const element = document.querySelector(hash);
        element?.scrollIntoView({ behavior: 'smooth' });
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return (
    <div ref={containerRef} className="min-h-screen bg-background-primary text-text-primary">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background-primary/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-brand flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-text-primary" />
              </div>
              <span className="font-bold text-lg">LeadSync</span>
            </Link>

            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-text-secondary hover:text-text-primary transition-colors">Features</a>
              <a href="#how-it-works" className="text-sm text-text-secondary hover:text-text-primary transition-colors">How it Works</a>
              <a href="#testimonials" className="text-sm text-text-secondary hover:text-text-primary transition-colors">Testimonials</a>
            </div>

            <div className="flex items-center gap-3">
              <Link
                to="/login"
                className="hidden sm:block text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                Log in
              </Link>
              <Link
                to="/signup"
                className="btn-gradient"
              >
                Start Free
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-accent/10 rounded-full filter blur-[120px]"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
          <motion.div
            className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-violet-500/10 rounded-full filter blur-[100px]"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.2, 0.4, 0.2],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
          <div className="absolute inset-0 bg-gradient-mesh opacity-20" />

          {/* Grid Pattern */}
          <div
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
              backgroundSize: '60px 60px',
            }}
          />
        </div>

        <motion.div
          style={{ opacity: r.opacity }}
          className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center"
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 mb-8"
          >
            <Sparkles className="h-4 w-4 text-accent" />
            <span className="text-sm font-medium text-accent">Now with AI-Powered Conversations</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6"
          >
            <span className="text-gradient">AI-Powered CRM</span>
            <br />
            <span className="text-text-primary">for Modern Teams</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-xl text-text-secondary max-w-2xl mx-auto mb-10"
          >
            Capture leads from any channel. Let AI handle routine conversations.
            Your team focuses on what matters—closing deals.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link
              to="/signup"
              className="group btn-gradient text-base px-8 py-4"
            >
              Start Free Trial
              <ArrowRight className="ml-2 h-5 w-5 inline group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#demo"
              className="btn-secondary text-base px-8 py-4"
            >
              <Play className="mr-2 h-5 w-5 inline" />
              Watch Demo
            </a>
          </motion.div>

          {/* Trust badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="mt-12 flex flex-wrap justify-center gap-6 text-sm text-text-muted"
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              14-day free trial
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              No credit card required
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Cancel anytime
            </span>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8"
          >
            {stats.map((stat, _i) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-gradient">{stat.value}</div>
                <div className="text-sm text-text-muted mt-1">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-6 h-10 rounded-full border-2 border-border flex items-start justify-center p-2"
          >
            <motion.div className="w-1.5 h-1.5 rounded-full bg-text-muted" />
          </motion.div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Everything you need to manage leads</h2>
            <p className="text-text-secondary text-lg max-w-2xl mx-auto">
              From first contact to closed deal—LeadSync provides all the tools your team needs
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, _i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: _i * 0.1 }}
                whileHover={{ y: -4 }}
                className="group p-6 rounded-2xl bg-background-secondary border border-border hover:border-accent/30 transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <feature.icon className="h-6 w-6 text-accent" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-text-secondary text-sm">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="py-24 px-4 sm:px-6 lg:px-8 bg-background-secondary">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">How it works</h2>
            <p className="text-text-secondary text-lg max-w-2xl mx-auto">
              Get started in minutes. Capture leads, automate responses, and close more deals.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Connect Channels',
                description: 'Link your Telegram bot, website forms, or WhatsApp Business. All leads flow into one inbox.',
                icon: Globe,
              },
              {
                step: '02',
                title: 'AI Takes Over',
                description: 'AI responds to common questions, qualifies leads, and creates orders automatically.',
                icon: Bot,
              },
              {
                step: '03',
                title: 'Your Team Closes',
                description: 'Human agents get involved for complex deals. Track everything in the dashboard.',
                icon: TrendingUp,
              },
            ].map((item, _i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: _i * 0.1 }}
                className="relative"
              >
                <div className="text-6xl font-bold text-background-elevated mb-4">{item.step}</div>
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
                  <item.icon className="h-6 w-6 text-accent" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                <p className="text-text-secondary">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Dashboard Preview */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Powerful dashboards for
                <span className="text-gradient"> data-driven decisions</span>
              </h2>
              <p className="text-text-secondary text-lg mb-8">
                Track revenue, monitor pipeline, and analyze team performance in real-time.
                Make informed decisions with beautiful, actionable insights.
              </p>

              <div className="space-y-4">
                {[
                  { icon: BarChart3, text: 'Real-time revenue tracking' },
                  { icon: Users, text: 'Team performance metrics' },
                  { icon: Lock, text: 'Enterprise-grade security' },
                ].map((item) => (
                  <div key={item.text} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                      <item.icon className="h-4 w-4 text-accent" />
                    </div>
                    <span className="text-text-secondary">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative"
            >
              <div className="absolute -inset-4 bg-gradient-brand opacity-20 blur-3xl rounded-full" />
              <div className="relative bg-background-secondary border border-border rounded-2xl p-6 shadow-card-elevated">
                {/* Mock Dashboard UI */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-32 bg-background-tertiary rounded" />
                    <div className="h-8 w-24 bg-accent/20 rounded" />
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    {['Revenue', 'Orders', 'Leads', 'AI Hit'].map((label) => (
                      <div key={label} className="bg-background-tertiary rounded-lg p-3">
                        <div className="h-3 w-16 bg-background-elevated rounded mb-2" />
                        <div className="h-6 w-12 bg-accent/30 rounded" />
                      </div>
                    ))}
                  </div>
                  <div className="h-32 bg-background-tertiary rounded-lg flex items-end p-4 gap-2">
                    {[40, 65, 45, 80, 55, 90, 70].map((h, _i) => (
                      <div
                        key={_i}
                        className="flex-1 bg-accent/30 rounded-t"
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-24 px-4 sm:px-6 lg:px-8 bg-background-secondary">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Loved by teams worldwide</h2>
            <p className="text-text-secondary text-lg">See what our customers have to say</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, _i) => (
              <motion.div
                key={testimonial.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: _i * 0.1 }}
                className="group p-6 rounded-2xl bg-background-primary border border-border hover:border-accent/30 transition-colors"
              >
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, j) => (
                    <Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>

                <Quote className="h-8 w-8 text-accent/20 mb-4" />

                <p className="text-text-secondary mb-6">{testimonial.quote}</p>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-brand flex items-center justify-center text-text-primary font-semibold">
                    {testimonial.name[0]}
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{testimonial.name}</div>
                    <div className="text-text-muted text-xs">
                      {testimonial.role}, {testimonial.company}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative bg-gradient-to-br from-accent/20 to-violet-500/20 rounded-3xl p-12 border border-accent/20"
          >
            <div className="relative z-10">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Ready to transform your sales?
              </h2>
              <p className="text-text-secondary text-lg mb-8 max-w-xl mx-auto">
                Join hundreds of teams using LeadSync to capture leads, automate conversations, and close more deals.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  to="/signup"
                  className="btn-gradient text-base px-8 py-4"
                >
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5 inline" />
                </Link>
                <a
                  href="mailto:sales@leadsync.io"
                  className="btn-secondary text-base px-8 py-4"
                >
                  Contact Sales
                </a>
              </div>

              <div className="mt-8 flex flex-wrap justify-center gap-6 text-sm text-text-muted">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  Free 14-day trial
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  No setup required
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  24/7 support
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-brand flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-text-primary" />
                </div>
                <span className="font-bold">LeadSync</span>
              </div>
              <p className="text-text-muted text-sm">
                AI-powered CRM for modern sales teams.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-text-muted">
                <li><a href="#features" className="hover:text-text-primary">Features</a></li>
                <li><a href="#" className="hover:text-text-primary">Pricing</a></li>
                <li><a href="#" className="hover:text-text-primary">Integrations</a></li>
                <li><a href="#" className="hover:text-text-primary">Changelog</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-text-muted">
                <li><a href="#" className="hover:text-text-primary">About</a></li>
                <li><a href="#" className="hover:text-text-primary">Blog</a></li>
                <li><a href="#" className="hover:text-text-primary">Careers</a></li>
                <li><a href="#" className="hover:text-text-primary">Contact</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-text-muted">
                <li><a href="#" className="hover:text-text-primary">Privacy</a></li>
                <li><a href="#" className="hover:text-text-primary">Terms</a></li>
                <li><a href="#" className="hover:text-text-primary">Security</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-text-muted text-sm">
              © {new Date().getFullYear()} LeadSync. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <a href="#" className="text-text-muted hover:text-text-primary">
                <Globe className="h-5 w-5" />
              </a>
              <a href="#" className="text-text-muted hover:text-text-primary">
                <MessageSquare className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
