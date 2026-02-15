import express from 'express'
import cors from 'cors'

// Routes
import authRoutes from './routes/auth.routes'
import leadsRoutes from './routes/leads/leads.routes'
import telegramRoutes from './routes/telegram/telegram.routes'
import integrationsRoutes from './routes/integrations.routes'
import secureRoutes from './routes/secure.routes'
import conversationRoutes from './routes/conversations.routes'
import publicRoutes from './routes/public.routes'
import dashboardRoutes from "./routes/dashboard.routes";
import telegramIntegrationRoutes from "./routes/telegram.integration.routes";

console.log('🔥 app.ts loaded')

const app = express()

/* -------------------- Middleware -------------------- */
app.use(
  cors({
    origin: true,
    credentials: true,
  })
)

// 🔴 REQUIRED FOR TELEGRAM
app.use(express.json())

/* -------------------- Health Check -------------------- */
app.get('/health', (_req, res) => {
  res.json({ status: 'LeadSync backend running 🚀' })
})

/* -------------------- API Routes -------------------- */

/* 🔓 PUBLIC ROUTES (NO AUTH) */
app.use('/api/auth', authRoutes)
app.use('/api/telegram', telegramRoutes)
app.use('/api/public', publicRoutes)
app.use('/api/integrations', integrationsRoutes)
app.use('/api/integrations', telegramIntegrationRoutes)

/* 🔐 SECURE ROUTE (ONLY /api/secure) */
app.use('/api/secure', secureRoutes)

/* 🔐 OTHER ROUTES (keep existing behavior) */
app.use('/api/leads', leadsRoutes)
app.use('/api/conversations', conversationRoutes)
app.use('/api/dashboard', dashboardRoutes)

/* -------------------- Export App -------------------- */
export default app
