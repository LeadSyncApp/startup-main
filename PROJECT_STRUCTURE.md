# LeadSync CRM - Complete Project Structure



## 📁 Root Directory Structure (2026)

```
Startup-main/
├── ARCHITECTURE_FLOWS.md
├── CHATGPT_QUICK_REFERENCE.md
├── COMPLETE_FILE_STRUCTURE_GUIDE.md
├── COMPREHENSIVE_PROJECT_GUIDE.md
├── DOCS_INDEX.md
├── DOCUMENTATION_INDEX.md
├── DOCUMENTATION_SUMMARY.md
├── ENHANCEMENTS_COMPLETE.md
├── ENHANCEMENTS_SUMMARY.md
├── ENHANCEMENTS.md
├── FILE_DETAILS.md
├── FILE_INVENTORY.md
├── FRONTEND_ARCHITECTURE.md
├── FRONTEND_COMPONENTS.md
├── FRONTEND_DOCS_INDEX.md
├── FRONTEND_OVERVIEW.md
├── FRONTEND_PAGES.md
├── FRONTEND_QUICK_REFERENCE.md
├── FRONTEND_SETUP.md
├── FRONTEND_STRUCTURE.md
├── FRONTEND_STYLING.md
├── index.html
├── package.json
├── postcss.config.js
├── PROJECT_CODEBASE_DOCUMENTATION.md
├── PROJECT_STRUCTURE.md
├── QUICK_REFERENCE.md
├── README.md
├── RUNNING.md
├── SETTINGS_ENHANCEMENTS.md
├── START_HERE_FOR_CHATGPT.md
├── tailwind.config.js
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
│
├── leadsync-backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.prisma.json
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── seed.ts
│   │   └── migrations/
│   │       ├── migration_lock.toml
│   │       ├── 20260208094647_init/
│   │       ├── 20260208182720_add_telegram_webhook_secret_and_fix_relations/
│   │       ├── 20260208183718_add_telegram_webhook_secret/
│   │       ├── 20260208202707_add_conversation_mode/
│   │       ├── 20260208211639_fix_company_conversation_relation/
│   │       ├── 20260208212439_finalize_conversation_schema/
│   │       ├── 20260211090420_add_orders_model/
│   │       └── 20260212165914_add_telegram_connected/
│   ├── src/
│   │   ├── app.ts
│   │   ├── server.ts
│   │   ├── testGemini.ts
│   │   ├── bot/
│   │   │   ├── bot.logic.ts
│   │   │   └── telegram.sender.ts
│   │   ├── config/
│   │   ├── lib/
│   │   │   ├── api.ts
│   │   │   └── prisma.ts
│   │   ├── middleware/
│   │   │   └── auth.middleware.ts
│   │   ├── routes/
│   │   │   ├── auth.routes.ts
│   │   │   ├── conversations.routes.ts
│   │   │   ├── dashboard.routes.ts
│   │   │   ├── integrations.routes.ts
│   │   │   ├── leads/
│   │   │   │   └── leads.routes.ts
│   │   │   ├── orders.routes.ts
│   │   │   ├── public.routes.ts
│   │   │   ├── secure.routes.ts
│   │   │   ├── telegram/
│   │   │   │   ├── telegram.controller.ts
│   │   │   │   └── telegram.routes.ts
│   │   │   └── telegram.integration.routes.ts
│   │   ├── services/
│   │   │   ├── geminiService.ts
│   │   │   ├── telegram.service.ts
│   │   │   └── telegram.webhook.ts
│   │   ├── utils/
│   │   │   └── jwt.ts
│   │   ├── voice/
│   │   │   ├── speechToText.ts
│   │   │   ├── telegramVoice.ts
│   │   │   ├── textToSpeech.ts
│   │   │   └── whisper.ts
│   ├── voices/
│   │   ├── *.ogg
│   │   ├── *.wav
│   │   └── *.txt
│   ├── .env
│   ├── .gitignore
│   ├── package-lock.json
│   └── ...
│
├── src/
│   ├── App.tsx
│   ├── index.css
│   ├── main.tsx
│   ├── vite-env.d.ts
│   ├── components/
│   │   ├── ProtectedRoute.tsx
│   │   ├── auth/
│   │   │   └── RequireAuth.tsx
│   │   ├── conversations/
│   │   │   └── ChatPanel.tsx
│   │   ├── dashboard/
│   │   │   └── SectionSummary.tsx
│   │   ├── layout/
│   │   │   ├── DashboardLayout.tsx
│   │   │   ├── MarketingNav.tsx
│   │   │   └── Sidebar.tsx
│   │   ├── leads/
│   │   │   ├── LeadDetailModal.tsx
│   │   │   └── LeadsTable.tsx
│   │   ├── ui/
│   │   │   ├── Modal.tsx
│   │   │   ├── Spinner.tsx
│   │   │   ├── Toast.tsx
│   │   │   └── ToastContainer.tsx
│   ├── context/
│   │   └── AuthContext.tsx
│   ├── data/
│   │   └── mockData.ts
│   ├── pages/
│   │   ├── Home.tsx
│   │   ├── Login.tsx
│   │   ├── Signup.tsx
│   │   └── dashboard/
│   │       ├── Conversations.tsx
│   │       ├── DashboardHome.tsx
│   │       ├── Leads.tsx
│   │       ├── Orders.tsx
│   │       ├── Reports.tsx
│   │       ├── Revenue.tsx
│   │       └── Settings.tsx
│   ├── types/
│   │   └── index.ts
│   ├── utils/
│   │   └── formatINR.ts
└── ...
```

---

## 🗄️ Backend Directory Structure

```
leadsync-backend/
├── 📦 Backend Configuration
│   ├── package.json                 # Dependencies (Express, Prisma, bcryptjs, JWT, etc.)
│   ├── tsconfig.json                # Backend TypeScript configuration
│   ├── tsconfig.prisma.json         # Prisma-specific TypeScript configuration
│   └── .env (not in repo)           # Environment variables
│       ├── DATABASE_URL             # PostgreSQL connection string
│       ├── PORT                     # Server port (default: 4000)
│       ├── TELEGRAM_BOT_TOKEN       # Telegram bot authentication token
│       └── NODE_ENV                 # Environment (development/production)
│
├── 📤 Prisma ORM & Database
│   ├── prisma/
│   │   ├── schema.prisma            # Database schema definition
│   │   │   ├── Models: Company, User, Lead, Conversation, Message
│   │   │   └── Enums: ConversationMode, Channel, Role, MessageSender
│   │   ├── seed.ts                  # Database seed script (demo data)
│   │   └── migrations/              # Database migration history
│   │       ├── migration_lock.toml  # Migration lock file
│   │       ├── 20260208094647_init/ # Initial schema creation
│   │       ├── 20260208182720_add_telegram_webhook_secret_and_fix_relations/
│   │       ├── 20260208183718_add_telegram_webhook_secret/
│   │       ├── 20260208202707_add_conversation_mode/
│   │       ├── 20260208211639_fix_company_conversation_relation/
│   │       └── 20260208212439_finalize_conversation_schema/
│   │
│   └── src/lib/
│       └── prisma.ts                # Prisma client singleton instance
│
├── 🚀 Express Application
│   ├── src/
│   │   ├── server.ts                # Server entry point (starts on port 4000)
│   │   │
│   │   ├── app.ts                   # Express application setup
│   │   │   ├── CORS middleware (http://localhost:5173)
│   │   │   ├── JSON body parser
│   │   │   ├── Health check endpoint: GET /health
│   │   │   └── Route mounting
│   │   │
│   │   ├── 🔐 Middleware
│   │   │   └── auth.middleware.ts   # JWT token verification & user extraction
│   │   │
│   │   ├── 🛣️ Routes
│   │   │   ├── auth.routes.ts       # Authentication routes
│   │   │   │   ├── POST /api/auth/signup    # Company & user registration
│   │   │   │   └── POST /api/auth/login     # User login with JWT
│   │   │   │
│   │   │   ├── leads/
│   │   │   │   └── leads.routes.ts  # Lead management routes
│   │   │   │       └── GET /api/leads?companyId=xxx  # Fetch company leads
│   │   │   │
│   │   │   ├── conversations.routes.ts     # Conversation routes
│   │   │   │   ├── GET /api/conversations # Fetch Telegram conversations
│   │   │   │   └── GET /api/conversations/:id # Get conversation with messages
│   │   │   │
│   │   │   ├── telegram/
│   │   │   │   ├── telegram.routes.ts      # Telegram routes
│   │   │   │   │   └── POST /api/telegram/webhook # Webhook receiver
│   │   │   │   └── telegram.controller.ts  # Telegram webhook handler
│   │   │   │
│   │   │   ├── integrations.routes.ts      # Integration routes
│   │   │   │   └── GET /api/integrations/ping  # Connectivity check
│   │   │   │
│   │   │   └── secure.routes.ts            # Protected routes
│   │   │       └── GET /api/secure         # Check auth with middleware
│   │   │
│   │   ├── 🛠️ Utilities
│   │   │   └── jwt.ts               # JWT creation and verification
│   │   │       ├── signToken()      # Create JWT token
│   │   │       └── verifyToken()    # Verify & decode JWT
│   │   │
│   │   ├── 🤖 Telegram Services
│   │   │   ├── services/
│   │   │   │   ├── telegram.service.ts     # Telegram message processing logic
│   │   │   │   └── telegram.webhook.ts     # Webhook handling & verification
│   │   │   │
│   │   │   └── bot/
│   │   │       ├── bot.logic.ts            # Bot conversation logic
│   │   │       └── telegram.sender.ts      # Message sending to Telegram
│   │   │
│   │   └── dist/                    # Compiled JavaScript output (after build)
│
└── 📊 Database Models (Prisma Schema)
    ├── Company
    │   ├── id (UUID, primary key)
    │   ├── name
    │   ├── telegramBotToken
    │   ├── telegramBotUsername
    │   ├── telegramWebhookSecret (unique)
    │   ├── createdAt
    │   └── Relations: users[], leads[], conversations[]
    │
    ├── User
    │   ├── id (UUID, primary key)
    │   ├── email
    │   ├── name
    │   ├── passwordHash (bcrypt)
    │   ├── role (OWNER | AGENT)
    │   ├── companyId (foreign key)
    │   ├── createdAt
    │   └── Unique constraint: [email, companyId]
    │
    ├── Lead
    │   ├── id (UUID, primary key)
    │   ├── name
    │   ├── contact (email/phone)
    │   ├── channel (WEBSITE | TELEGRAM | WHATSAPP)
    │   ├── companyId (foreign key)
    │   ├── createdAt
    │   ├── Relations: conversations[]
    │   └── Unique constraint: [contact, channel, companyId]
    │
    ├── Conversation
    │   ├── id (UUID, primary key)
    │   ├── leadId (foreign key)
    │   ├── companyId (foreign key)
    │   ├── channel (WEBSITE | TELEGRAM | WHATSAPP)
    │   ├── mode (BOT | HUMAN)
    │   ├── createdAt
    │   ├── updatedAt
    │   ├── Relations: lead, company, messages[]
    │   └── Indexes: [companyId], [leadId]
    │
    └── Message
        ├── id (UUID, primary key)
        ├── content
        ├── sender (CLIENT | AGENT | SYSTEM)
        ├── conversationId (foreign key)
        ├── createdAt
        └── Relations: conversation
```

---

## 🔄 API Endpoints Summary

### Authentication
- `POST /api/auth/signup` - Register new company and owner user
- `POST /api/auth/login` - Authenticate user and get JWT token

### Leads
- `GET /api/leads?companyId=xxx` - Fetch all leads for a company

### Conversations
- `GET /api/conversations` - Get all Telegram conversations (protected)
- `GET /api/conversations/:id` - Get conversation with messages (protected)

### Telegram
- `POST /api/telegram/webhook` - Receive Telegram webhook updates

### Integrations
- `GET /api/integrations/ping` - Health check

### Secure
- `GET /api/secure` - Test authenticated access (protected)

---

## 🔄 Application Flow

### Frontend Flow:
1. **App.tsx** → Routes pages with React Router
2. **AuthContext.tsx** → Provides global user/company state
3. **RequireAuth.tsx** → Guards protected routes
4. **DashboardLayout.tsx** → Wraps dashboard pages with sidebar
5. **Sidebar.tsx** → Navigation menu with role-based items
6. **Dashboard Pages** → Use components & mock data

### Backend Flow:
1. **server.ts** → Starts Express on port 4000
2. **app.ts** → Configures middleware, CORS, routes
3. **Routes** → Handle API requests (auth, leads, conversations, telegram)
4. **JWT Middleware** → Protects authenticated endpoints
5. **Prisma** → Queries PostgreSQL database
6. **Services** → Handle business logic (Telegram integration, bot logic)

### Authentication Flow:
1. User registers/logs in via frontend
2. Backend creates user with bcrypt password hash
3. JWT token issued on successful login
4. Frontend stores token in localStorage/context
5. Protected routes check token with AuthContext
6. Backend verifies JWT on protected endpoints

---

## 🎨 Styling & UI System

- **Tailwind CSS 3.4** - Utility-first CSS framework (3.4.15)
- **Color Scheme** - Blue/Cyan theme
  - Primary Blue: `#3b82f6` (500)
  - Accent Cyan: `#0ea5e9` (500)
- **Component Libraries**
  - **Lucide React** - Icon library (454.0)
  - **Recharts** - React charting library (2.6.2)
  - **React Hot Toast** - Toast notifications (2.4.0)
  - **Framer Motion** - Animations (10.12.16)
  - **Headless UI** - Unstyled accessible components (1.7.17)
- **Animations** - Framer Motion for transitions
- **Responsive Design** - Mobile-first (sm, md, lg, xl, 2xl breakpoints)

---

## 📦 Key Dependencies

### Frontend (src/)
- **React** 18.3 - UI library
- **React Router** 6.28 - Client-side routing
- **TypeScript** 5.6 - Type safety
- **Vite** 5.4 - Build tool & dev server
- **Tailwind CSS** 3.4 - Styling
- **Framer Motion** 10.12 - Animations
- **Recharts** 2.6 - Charts & graphs
- **React Hot Toast** 2.4 - Notifications
- **Lucide React** 0.454 - Icons
- **Headless UI** 1.7 - Components

### Backend (leadsync-backend/)
- **Express** 4.22 - Web framework
- **Prisma** 6.6 - ORM & database
- **TypeScript** 5.9 - Type safety
- **JWT** 9.0 - Authentication
- **bcryptjs** 3.0 - Password hashing
- **CORS** 2.8 - Cross-origin handling
- **Axios** 1.13 - HTTP client
- **ts-node-dev** 2.0 - Development runner
- **PostgreSQL** - Database (via Prisma)

---

## 🚀 Development & Build Commands

### Frontend (root directory)
```bash
npm run dev          # Start Vite dev server (http://localhost:5173)
npm run build        # TypeScript check + Vite production build
npm run preview      # Preview production build locally
```

### Backend (leadsync-backend/)
```bash
npm run dev          # Start with ts-node-dev (http://localhost:4000)
npm run ngrok        # Start ngrok tunnel for Telegram webhook
npm run dev:all      # Concurrent: frontend + backend + ngrok
npm run seed         # Populate database with demo data
npm run build        # TypeScript compilation to dist/
npm run start        # Run compiled dist/server.js
```

---

## 🏗️ Environment Setup

### Frontend (.env.local)
- `VITE_API_URL` - Backend API base URL (optional, defaults to localhost:4000)

### Backend (.env)
```
DATABASE_URL=postgresql://user:password@localhost:5432/leadsync
PORT=4000
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
NODE_ENV=development
```

---

## 📝 Notes

- **Multi-Tenant Ready** - All data scoped to Company ID
- **Role-Based Access** - OWNER vs AGENT roles
- **Telegram Integration** - Webhook-based message sync
- **Mock Data** - Frontend uses mock data, backend seeds PostgreSQL
- **Development Mode** - CORS allows localhost:5173 ↔ localhost:4000
- **Type Safety** - Both frontend & backend fully typed with TypeScript
