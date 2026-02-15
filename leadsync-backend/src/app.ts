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
import ordersRoutes from "./routes/orders.routes";   // ✅ ADD THIS

console.log('🔥 app.ts loaded')

const app = express()

app.use(
  cors({
    origin: true,
    credentials: true,
  })
)

app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'LeadSync backend running 🚀' })
})

/* 🔓 PUBLIC ROUTES */
app.use('/api/auth', authRoutes)
app.use('/api/telegram', telegramRoutes)
app.use('/api/public', publicRoutes)
app.use('/api/integrations', integrationsRoutes)
app.use('/api/integrations', telegramIntegrationRoutes)

/* 🔐 SECURE ROUTE */
app.use('/api/secure', secureRoutes)

/* 🔐 MAIN ROUTES */
app.use('/api/leads', leadsRoutes)
app.use('/api/conversations', conversationRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/orders', ordersRoutes)   // ✅ ADD THIS

export default app
