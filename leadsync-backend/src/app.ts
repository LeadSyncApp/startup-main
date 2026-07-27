import express from "express";
import cors from "cors";
import compression from "compression";
import helmet from "helmet";
import rateLimit, { MemoryStore } from "express-rate-limit";
import path from "path";

// Routes
import authRoutes from "./routes/auth/auth.routes";
import publicRoutes from "./routes/auth/public.routes";
import secureRoutes from "./routes/auth/secure.routes";
import googleAuthRoutes from "./routes/auth/google.routes";
import meRoutes from "./routes/auth/me.routes";
import { initializeGoogleStrategy } from "./services/auth/google.strategy";

import leadsRoutes from "./routes/leads/leads.routes";
import telegramRoutes from "./routes/telegram/telegram.routes";

import integrationsRoutes from "./routes/integrations/integrations.routes";
import telegramIntegrationRoutes from "./routes/integrations/telegram.integration.routes";
import instagramIntegrationRoutes from "./routes/integrations/instagram.integration.routes";


import dashboardRoutes from "./routes/core/dashboard.routes";
import { authMiddleware } from "./middleware/auth.middleware";
import analyticsRoutes from "./routes/core/analytics.routes";
import notificationRoutes from "./routes/core/notification.routes";
import inventoryRoutes from "./routes/automation/inventory.routes";
import voiceIntakeRoutes from "./routes/automation/voiceIntake.routes";
import productsRoutes from "./routes/core/products.routes";
import broadcastRoutes from "./routes/core/broadcast.routes";

import ordersRoutes from "./routes/orders/orders.routes";
import newOrderArrivalsRoutes from "./routes/orders/newOrderArrivals.routes";

import botKnowledgeRoutes from "./routes/bot/bot-knowledge.routes";
import conversationalRulesRoutes from "./routes/automation/conversationalRules.routes";
import ruleGroupsRoutes from "./routes/automation/ruleGroups.routes";

import webhookRoutes from "./routes/webhooks/webhook.routes";
import websiteRoutes from "./routes/webhooks/website.routes";
import widgetRoutes from "./routes/webhooks/widget.routes";
import telegramWebhookRoutes from "./routes/webhooks/telegram.routes";
import { metadataRoutes } from "./routes/crm/metadata.routes";
import { productFieldsRoutes } from "./routes/crm/product-fields.routes";

console.log("🔥 app.ts loaded");

// Initialize OAuth strategies
initializeGoogleStrategy();

const app = express();

app.set("trust proxy", 1); // Trust first proxy for Railway deployment

app.use(compression()); // ✅ GZIP Compression
app.use(helmet({ 
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginEmbedderPolicy: false,
  frameguard: false
})); // ✅ Security headers (CSP/CORP/COOP off for dev/cross-origin compatibility)

// Rate limiters
// Fallback template tracker proxy for cluster safety: Swap this to 'new RedisStore({ client })' when deploying active Redis cluster instances.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { message: "Too many requests from this IP, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  store: new MemoryStore(),
});

const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  store: new MemoryStore(),
});

// CORS configuration
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Webhook-Signature', 'X-Shopify-Hmac-SHA256', 'X-WC-Webhook-Signature', 'x-webhook-signature', 'x-shopify-hmac-sha256', 'x-wc-webhook-signature'],
  })
);

app.use(express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf;
  }
}));

// Global API rate limiter (auth routes also have their own stricter limiter)
app.use("/api", generalLimiter);

import { pgBossService } from "./services/infrastructure/pgboss/pgboss.service";
import { WorkerRegistry } from "./services/infrastructure/pgboss/worker.registry";
import { SchedulerRegistry } from "./services/infrastructure/pgboss/scheduler.registry";

app.get("/health", (_req, res) => {
  res.json({ 
    status: "LeadSync backend running 🚀",
    pgBoss: {
      isRunning: pgBossService.isStarted,
      workersRegistered: WorkerRegistry.hasRegistered,
      schedulesRegistered: SchedulerRegistry.hasRegistered
    }
  });
});

/* 🔓 PUBLIC ROUTES */
app.use("/api/auth", authLimiter, authRoutes); // strict limiter on auth
app.use("/api/auth", googleAuthRoutes); // Google OAuth routes
app.use("/api/auth", meRoutes); // /api/auth/me
app.use("/api/telegram", telegramRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/integrations", integrationsRoutes);
app.use("/api/integrations", telegramIntegrationRoutes);
app.use("/api/integrations", instagramIntegrationRoutes);

/* 🔐 SECURE ROUTE */
app.use("/api/secure", secureRoutes);
app.use("/api/users", secureRoutes);

/* 🔐 MAIN ROUTES */
app.use("/api/leads", leadsRoutes);

app.use("/api/dashboard", dashboardRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/broadcasts", broadcastRoutes);
app.use("/api/menu", productsRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/companies", inventoryRoutes);
app.use("/api/companies", voiceIntakeRoutes);
app.use("/api/automation/rule-groups", authMiddleware, ruleGroupsRoutes);
app.use("/api/automation/conversational-rules", authMiddleware, conversationalRulesRoutes);

app.use("/api/widget", widgetRoutes);
app.use("/api/webhook/widget", widgetRoutes);
app.use("/api/webhook/telegram", telegramWebhookRoutes);
app.use("/api/webhook", websiteRoutes);
app.use("/api/webhook", webhookRoutes);

// Serve widget.js static file with cache-busting headers
const publicDirPath = path.resolve(__dirname, '../public');
app.get('/widget.js', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(publicDirPath, 'widget.js'));
});
app.use('/public', express.static(publicDirPath));
app.use("/api/bot-knowledge", botKnowledgeRoutes);

// 🆕 Add New Order Arrivals routes
app.use("/api/newOrderArrivals", newOrderArrivalsRoutes);

// CRM Routes
app.use("/api/metadata", metadataRoutes);
app.use("/api/crm/metadata", metadataRoutes);
app.use("/api", productFieldsRoutes);

/* 👥 TEAM ROUTES */
import teamRoutes from "./routes/team/team.routes";
import invitationsRoutes from "./routes/team/invitations.routes";
import companyRoutes from "./routes/team/company.routes";
import onboardingRoutes from "./routes/onboarding/onboarding.routes";

app.use("/api/team", teamRoutes);
app.use("/api/team/invitations", invitationsRoutes);
app.use("/api/company", companyRoutes);
app.use("/api/onboarding", onboardingRoutes);

/* 🩺 DIAGNOSTIC ROUTE */
app.get("/api/debug/system", async (req, res) => {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    env: {
      has_groq_key: !!process.env.GROQ_API_KEY,
      groq_key_prefix: process.env.GROQ_API_KEY?.substring(0, 7),
      has_sarvam_key: !!process.env.SARVAM_API_KEY,
      has_db: !!process.env.DATABASE_URL,
    }
  };
  res.json(diagnostics);
});

import { errorMiddleware } from "./middleware/error.middleware";

// Serve frontend static files
const frontendDistPath = path.resolve(__dirname, '../../leadsync-frontend/dist');
app.use(express.static(frontendDistPath));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  } else {
    res.status(404).json({ error: 'API route not found' });
  }
});

app.use(errorMiddleware);

export default app;
