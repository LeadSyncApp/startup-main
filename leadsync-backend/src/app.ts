import express from "express";
import cors from "cors";
import compression from "compression";

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
import ordersRoutes from "./routes/orders.routes";
import usersRoutes from "./routes/users.routes";
import analyticsRoutes from "./routes/analytics.routes";
import notificationRoutes from "./routes/notification.routes";

console.log("🔥 app.ts loaded");

const app = express();

app.use(compression()); // ✅ GZIP Compression

app.use(
  cors({
    origin: "*", // 🌍 Allow ANY device/origin
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "LeadSync backend running 🚀" });
});

/* 🔓 PUBLIC ROUTES */
app.use("/api/auth", authRoutes);
app.use("/api/telegram", telegramRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/integrations", integrationsRoutes);
app.use("/api/integrations", telegramIntegrationRoutes);
app.use("/api/integrations", instagramIntegrationRoutes);

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

/* 🩺 DIAGNOSTIC ROUTE */
app.get("/api/debug/system", async (req, res) => {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    env: {
      has_gemini_key: !!process.env.GEMINI_API_KEY,
      gemini_key_prefix: process.env.GEMINI_API_KEY?.substring(0, 7),
      has_groq_key: !!process.env.GROQ_API_KEY,
      groq_key_prefix: process.env.GROQ_API_KEY?.substring(0, 7),
      has_openrouter_key: !!process.env.OPENROUTER_API_KEY,
      openrouter_key_prefix: process.env.OPENROUTER_API_KEY?.substring(0, 7),
    }
  };
  res.json(diagnostics);
});

export default app;
