import express from "express";
import cors from "cors";
import compression from "compression";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

// Routes
import authRoutes from "./routes/auth.routes";
import leadsRoutes from "./routes/leads/leads.routes";
import telegramRoutes from "./routes/telegram/telegram.routes";
import integrationsRoutes from "./routes/integrations.routes";
import secureRoutes from "./routes/secure.routes";
import conversationRoutes from "./routes/conversations.routes";
import publicRoutes from "./routes/public.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import telegramIntegrationRoutes from "./routes/telegram.integration.routes";
import instagramIntegrationRoutes from "./routes/instagram.integration.routes";
import instagramRoutes from "./routes/instagram.routes";
import ordersRoutes from "./routes/orders.routes";
import usersRoutes from "./routes/users.routes";
import analyticsRoutes from "./routes/analytics.routes";
import notificationRoutes from "./routes/notification.routes";
import webhookRoutes from "./routes/webhook.routes";
import broadcastsRoutes from "./routes/broadcasts.routes";
import botKnowledgeRoutes from "./routes/bot-knowledge.routes";
import automationRoutes from "./routes/automation.routes";

// 🆕 Import New Order Arrivals routes
import newOrderArrivalsRoutes from "./routes/newOrderArrivals.routes";

console.log("🔥 app.ts loaded");

const app = express();

app.set("trust proxy", 1); // Trust first proxy for Railway deployment

app.use(compression()); // ✅ GZIP Compression
app.use(helmet({ contentSecurityPolicy: false })); // ✅ Security headers (CSP off — API-only backend)

// Rate limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { message: "Too many requests from this IP, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

// CORS configuration
const envOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  ...envOrigins,
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      // Allow localhost for development
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }

      // Allow any Vercel domain
      if (origin.includes('vercel.app')) {
        return callback(null, true);
      }

      // Allow configured origins
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.warn(`CORS blocked for origin: ${origin}`);
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json());

// Global API rate limiter (auth routes also have their own stricter limiter)
app.use("/api", generalLimiter);

app.get("/health", (_req, res) => {
  res.json({ status: "LeadSync backend running 🚀" });
});

/* 🔓 PUBLIC ROUTES */
app.use("/api/auth", authLimiter, authRoutes); // strict limiter on auth
app.use("/api/telegram", telegramRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/integrations", integrationsRoutes);
app.use("/api/integrations", telegramIntegrationRoutes);
app.use("/api/integrations", instagramIntegrationRoutes);
app.use("/api/instagram", instagramRoutes);  // Instagram DM webhook

/* 🔐 SECURE ROUTE */
app.use("/api/secure", secureRoutes);

/* 🔐 MAIN ROUTES */
app.use("/api/leads", leadsRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/webhook", webhookRoutes);
app.use("/api/broadcasts", broadcastsRoutes);
app.use("/api/bot-knowledge", botKnowledgeRoutes);
app.use("/api/automation", automationRoutes);

// 🆕 Add New Order Arrivals routes
app.use("/api/newOrderArrivals", newOrderArrivalsRoutes);

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
      has_telegram_token: !!process.env.TELEGRAM_BOT_TOKEN,
      has_db: !!process.env.DATABASE_URL,
    }
  };
  res.json(diagnostics);
});

export default app;
