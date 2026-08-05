import "./utils/bigint-patch";
import express from "express";
import cors from "cors";
import compression from "compression";
import helmet from "helmet";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import pinoHttp from "pino-http";
import crypto from "crypto";
import { PgRateLimitStore, startRateLimitCleanup } from "./stores/pgRateLimitStore";
import path from "path";
import { getAllowedOrigins } from "./utils/cors";
import logger from "./lib/logger";


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

// HTTP request logging — structured JSON via existing pino logger
app.use(
  pinoHttp({
    logger: logger as any,
    // Auto-generate a request ID if the client didn't send one
    genReqId: (req) => (req.headers["x-request-id"] as string) || crypto.randomUUID(),
    // Custom request serializer: strip sensitive data, omit bodies
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url,
          // Intentionally omit headers (Authorization, cookies) and body
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
    // Only log the response, not the request (method+url logged on res finish)
    autoLogging: {
      ignore: () => false,
    },
    // Redact Authorization header and any cookie headers from logged headers
    customLogLevel(_req, res, err) {
      if (res.statusCode >= 500 || err) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
    customSuccessMessage(_req, res) {
      return `request completed`;
    },
    customErrorMessage(_req, res, err) {
      return `request error: ${err.message}`;
    },
  })
);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'", "https:", "http:", "ws:", "wss:"],
        frameSrc: ["'self'", "blob:", "https:"],
        objectSrc: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// Rate limiters — backed by PostgreSQL for multi-instance safety
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { message: "Too many requests from this IP, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  store: new PgRateLimitStore({ windowMs: 15 * 60 * 1000, max: 20 }),
});

const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  store: new PgRateLimitStore({ windowMs: 60 * 1000, max: 200 }),
});

// Webhook-specific rate limiter: 100 req/min per IP, keyed by IP+companyId
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ip = ipKeyGenerator(req.ip || req.socket.remoteAddress || "unknown");
    const companyId = (req.params as any).companyId || "";
    return `${ip}:${companyId}`;
  },
  store: new PgRateLimitStore({ windowMs: 60 * 1000, max: 100 }),
});

startRateLimitCleanup();

// CORS configuration
app.use(
  cors({
    origin: getAllowedOrigins(),
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

// Global API rate limiter (skip /api/auth — they have their own stricter authLimiter)
app.use("/api", (req, _res, next) => {
  if (req.path.startsWith("/auth")) return next();
  return generalLimiter(req, _res, next);
});

import { pgBossService } from "./services/infrastructure/pgboss/pgboss.service";
import { WorkerRegistry } from "./services/infrastructure/pgboss/worker.registry";
import { SchedulerRegistry } from "./services/infrastructure/pgboss/scheduler.registry";

app.get("/health", async (_req, res) => {
  const health: any = {
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    pgBoss: {
      isRunning: pgBossService.isStarted,
      workersRegistered: WorkerRegistry.hasRegistered,
      schedulesRegistered: SchedulerRegistry.hasRegistered,
    },
  };

  // DB connectivity check
  try {
    const { PrismaClient } = require("@prisma/client");
    const p = new PrismaClient();
    await p.$queryRaw`SELECT 1`;
    await p.$disconnect();
    health.db = { status: "connected" };
  } catch (err: any) {
    health.status = "degraded";
    health.db = { status: "error", error: err.message };
  }

  const statusCode = health.status === "ok" ? 200 : 503;
  res.status(statusCode).json(health);
});

/* 🔓 PUBLIC ROUTES */
app.use("/api/auth", authLimiter, authRoutes); // strict limiter on auth
app.use("/api/auth", authLimiter, googleAuthRoutes); // Google OAuth routes
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
app.use("/api/conversations", leadsRoutes);

import paymentsRoutes from "./routes/payments/payments.routes";

app.use("/api/dashboard", dashboardRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/broadcasts", broadcastRoutes);
app.use("/api/menu", productsRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/companies", inventoryRoutes);
app.use("/api/companies", voiceIntakeRoutes);
app.use("/api/automation/rule-groups", authMiddleware, ruleGroupsRoutes);
app.use("/api/automation/conversational-rules", authMiddleware, conversationalRulesRoutes);

app.use("/api/widget", widgetRoutes);
app.use("/api/webhook/widget", widgetRoutes);
app.use("/api/webhook/telegram", webhookLimiter, telegramWebhookRoutes);
app.use("/api/webhook", webhookLimiter, webhookRoutes);
app.use("/api/webhook", webhookLimiter, websiteRoutes);

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
import staffRoutes from "./routes/staff/staff.routes";

app.use("/api/team", teamRoutes);
app.use("/api/team/invitations", invitationsRoutes);
app.use("/api/company", companyRoutes);
app.use("/api/staff", staffRoutes);

/* 🩺 DIAGNOSTIC ROUTE */
app.get("/api/debug/system", async (_req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "Access denied in production mode" });
  }
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

/* ☠️ DEAD-LETTER JOBS — Admin visibility endpoint */
app.get("/api/internal/failed-jobs/count", async (_req, res) => {
  try {
    const { PrismaClient } = require("@prisma/client");
    const prisma = new PrismaClient();
    const total = await prisma.failedJob.count();
    const byQueue = await prisma.failedJob.groupBy({
      by: ["queue"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    });
    const recent = await prisma.failedJob.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: { id: true, queue: true, jobId: true, error: true, attempts: true, companyId: true, createdAt: true },
    });
    await prisma.$disconnect();
    res.json({ total, byQueue: byQueue.map((r: any) => ({ queue: r.queue, count: r._count.id })), recent });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* 📊 QUEUE HEALTH — PgBoss queue metrics for monitoring */
app.get("/api/internal/queue-health", async (_req, res) => {
  try {
    if (!pgBossService.isStarted) {
      return res.status(503).json({ error: "PgBoss not running" });
    }
    const boss = pgBossService.getBoss();
    const queues = [
      "webhook.process", "ai-triage-job", "GENERATE_PDF", "SEND_EMAIL",
      "RECOVER_WEBHOOK", "CLEANUP_IDEMPOTENCY", "PROCESS_AI_TASK",
      "CLEANUP_WEBHOOKS", "menu.restructure.job", "knowledge.train.job",
      "voice.process.job", "CHECK_MISSED_REPLY_SLA", "NIGHTLY_PAYMENT_RECONCILIATION",
      "PROCESS_OUTBOX_EVENTS"
    ];
    const metrics: Record<string, any> = {};
    for (const q of queues) {
      try {
        const [completed, failed] = await Promise.all([
          boss.getCompletedCount(q),
          boss.getFailedCount(q),
        ]);
        metrics[q] = { completed, failed };
      } catch {
        metrics[q] = { error: "unavailable" };
      }
    }
    res.json({ status: "ok", queues: metrics });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
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
