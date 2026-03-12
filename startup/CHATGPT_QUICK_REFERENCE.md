# LeadSync CRM - Quick Reference for AI/ChatGPT

**Purpose**: Ultra-condensed project overview for LLM understanding.  
**Format**: Structured, bullet-point based for easy parsing.

---

## 🏢 Project At A Glance

| Aspect | Details |
|--------|---------|
| **Project Name** | LeadSync CRM |
| **Type** | Full-Stack SaaS Lead Management |
| **Architecture** | React 18 Frontend + Node.js Express Backend |
| **Database** | PostgreSQL with Prisma ORM |
| **Multi-Tenancy** | Yes (Company-scoped data) |
| **Target Users** | SMBs across all industries |

---

## 📂 Quick Directory Map

```
d:\startup/
├── src/                   ← React Frontend (MAIN)
├── leadsync-backend/      ← Node.js API
├── dist/                  ← Compiled output
└── node_modules/          ← Dependencies
```

---

## 🎨 FRONTEND STRUCTURE (React)

### Main Tech Stack
- **React 18** (UI library)
- **TypeScript** (type safety)
- **Tailwind CSS** (styling)
- **Vite** (build tool)
- **React Router** (navigation)

### Component Organization (src/)

```
src/
├── components/
│   ├── layout/         → Sidebar, DashboardLayout, Nav
│   ├── ui/             → Modal, Spinner, Toast
│   ├── leads/          → LeadsTable, LeadDetailModal
│   ├── conversations/  → ChatPanel
│   ├── dashboard/      → SectionSummary cards
│   └── auth/           → RequireAuth guard
├── pages/
│   ├── Home.tsx        → Marketing homepage
│   ├── Login.tsx       → Login page
│   ├── Signup.tsx      → Signup page
│   └── dashboard/      → DashboardHome, Leads, Conversations, Deals, Revenue, Settings, Reports
├── context/
│   └── AuthContext.tsx → User + Company state
├── data/
│   └── mockData.ts     → Mock companies, leads, messages, deals
├── types/
│   └── index.ts        → All TypeScript interfaces
└── utils/
    └── formatINR.ts    → Currency formatter

```

### Core Frontend Features

| Feature | Components | Purpose |
|---------|-----------|---------|
| **Lead Management** | LeadsTable, LeadDetailModal | Search, filter, view, delete leads |
| **Conversations** | ChatPanel | Message threads with timestamps |
| **Sales Pipeline** | Deals.tsx | Kanban board (5 stages) |
| **Revenue Analytics** | Revenue.tsx | KPIs, trends, breakdowns |
| **Settings** | Settings.tsx | Profile, integrations, danger zone |
| **Public Home** | Home.tsx | Marketing landing page |

### Frontend Startup Commands

```bash
npm install              # Install dependencies
npm run dev             # Start dev server (port 5173)
npm run build           # Build for production
npm run preview         # Preview production build
```

---

## 🔌 BACKEND STRUCTURE (Express)

### Main Tech Stack
- **Node.js + Express** (web framework)
- **TypeScript** (type safety)
- **Prisma** (ORM)
- **PostgreSQL** (database)
- **JWT** (authentication)

### API Organization (leadsync-backend/src/)

```
leadsync-backend/src/
├── routes/
│   ├── auth.routes.ts              → Login, Signup
│   ├── leads.routes.ts             → CRUD leads
│   ├── conversations.routes.ts     → Message threads
│   ├── integrations.routes.ts      → Third-party integrations
│   ├── telegram/                   → Telegram webhook + controller
│   ├── public.routes.ts            → Public endpoints
│   └── secure.routes.ts            → Protected endpoints
├── services/
│   ├── telegram.service.ts         → Telegram API client
│   └── telegram.webhook.ts         → Webhook handler
├── bot/
│   ├── bot.logic.ts                → Conversation AI logic
│   └── telegram.sender.ts          → Message sending
├── middleware/
│   └── auth.middleware.ts          → JWT verification
├── lib/
│   ├── api.ts                      → API utilities
│   └── prisma.ts                   → Prisma client
├── utils/
│   └── jwt.ts                      → Token generation
├── app.ts                          → Express app setup
└── server.ts                       → Server entry (port 4000)

prisma/
├── schema.prisma                   → Database models
├── seed.ts                         → DB seeding
└── migrations/                     → Migration history (7 completed)
```

### Core API Endpoints

```
PUBLIC (no auth):
  GET  /health                         → Health check
  POST /api/auth/signup                → Register
  POST /api/auth/login                 → Login

PROTECTED (require JWT):
  GET  /api/leads                      → List leads
  POST /api/leads                      → Create lead
  GET  /api/leads/:id                  → Get lead details
  PUT  /api/leads/:id                  → Update lead
  DELETE /api/leads/:id                → Delete lead

  GET  /api/conversations              → List conversations
  POST /api/conversations              → Create conversation
  GET  /api/conversations/:id/messages → Get messages
  POST /api/conversations/:id/messages → Send message

TELEGRAM:
  POST /api/telegram/webhook           → Receive messages
  POST /api/telegram/send              → Send messages
```

### Backend Startup Commands

```bash
cd leadsync-backend
npm install                    # Install dependencies
npx prisma migrate deploy      # Run migrations
npm run seed                   # Seed database (optional)
npm run dev                    # Start dev server (port 4000)
npm run dev:all                # With ngrok tunnel
```

---

## 🗄️ DATABASE SCHEMA (Prisma)

### Tables at a Glance

```
Company (Multi-tenant root)
  ├─ id (UUID, PK)
  ├─ name (String)
  ├─ telegramBotToken (String, optional)
  └─ Relations: users, leads, conversations

User (Team member/Agent)
  ├─ id (UUID, PK)
  ├─ email (String)
  ├─ name (String)
  ├─ passwordHash (String)
  ├─ role (OWNER | AGENT)
  ├─ companyId (FK → Company)
  └─ Unique: (email, companyId)

Lead (Contact)
  ├─ id (UUID, PK)
  ├─ name (String, optional)
  ├─ contact (String) — phone/email
  ├─ channel (WEBSITE | TELEGRAM | WHATSAPP)
  ├─ companyId (FK → Company)
  └─ Unique: (contact, channel, companyId)

Conversation (Thread with Lead)
  ├─ id (UUID, PK)
  ├─ leadId (FK → Lead)
  ├─ companyId (FK → Company)
  ├─ channel (WEBSITE | TELEGRAM | WHATSAPP)
  ├─ mode (BOT | HUMAN)
  └─ Relations: messages

Message (Individual message)
  ├─ id (UUID, PK)
  ├─ content (String)
  ├─ sender (CLIENT | AGENT | SYSTEM)
  ├─ conversationId (FK → Conversation)
  └─ createdAt (DateTime)
```

### Key Enums

```typescript
Role: OWNER | AGENT
Channel: WEBSITE | TELEGRAM | WHATSAPP
ConversationMode: BOT | HUMAN
MessageSender: CLIENT | AGENT | SYSTEM
```

---

## 🔐 Authentication & Multi-Tenancy Pattern

### How Authentication Works

```
1. User submits login credentials
   ↓
2. Backend checks DB: User.email + Company match
   ↓
3. Backend verifies password hash (bcryptjs)
   ↓
4. Backend generates JWT (includes userId + companyId)
   ↓
5. Frontend stores JWT in localStorage
   ↓
6. All API calls include: Authorization: Bearer <JWT>
   ↓
7. Backend middleware validates JWT on protected routes
```

### Multi-Tenancy Rule (CRITICAL)

**EVERY query MUST filter by companyId:**

```typescript
// ✅ CORRECT: Filters by company
const leads = await prisma.lead.findMany({
  where: { companyId: userCompanyId }
});

// ❌ WRONG: Returns data from all companies
const leads = await prisma.lead.findMany();
```

---

## 📊 Mock Data Location

**File**: `src/data/mockData.ts`

Contains:
- 3 sample companies
- 50+ mock leads
- 30+ mock messages
- 20+ mock deals
- 10+ mock agents

**Used by**: All frontend pages (until backend integration)  
**Purpose**: Development & testing without backend

---

## 🔄 Example Data Flow: "Create Lead"

### Frontend to Backend

```
User clicks "Create Lead" in LeadsTable.tsx
  ↓
Form submitted with: { name, email, phone, source, priority }
  ↓
POST /api/leads
  {
    "name": "John Doe",
    "email": "john@example.com",
    "source": "website",
    "priority": "high",
    "companyId": "co1"
  }
  ↓
Backend (leads.routes.ts):
  1. Extract JWT from header → get userCompanyId
  2. Validate input
  3. prisma.lead.create({ ...data, companyId: userCompanyId })
  ↓
Response: { id, name, email, ..., createdAt }
  ↓
Frontend updates LeadsTable state
  ↓
Success toast notification
```

---

## 🤖 Example Data Flow: "Telegram Message Received"

```
Telegram user sends message to bot
  ↓
Telegram API → POST /api/telegram/webhook
  {
    "message_id": 123,
    "text": "Hi, I'm interested!",
    "from": { "id": 456, "first_name": "John" },
    "chat": { "id": 789 }
  }
  ↓
Backend (telegram.webhook.ts):
  1. Verify webhook secret matches X-Telegram-Bot-API-Secret-Token
  2. Extract phone/email from Telegram user
  3. prisma.lead.upsert() → Create or get Lead
  4. prisma.conversation.create() → New conversation
  5. Run bot.logic.ts → Generate auto-response
  6. Call telegram.sender.send() → Send response back
  7. prisma.message.create() → Store message in DB
  ↓
Telegram user receives auto-response
  ↓
Agent sees new conversation in Dashboard
```

---

## 🎯 Feature Checklist

### ✅ COMPLETED
- [x] React 18 + TypeScript frontend
- [x] Tailwind CSS styling
- [x] Multi-tenant architecture
- [x] Lead CRUD (Create, Read, Update, Delete)
- [x] Lead search, filter, sort, pagination
- [x] Conversations / Chat UI
- [x] Sales Pipeline (Kanban)
- [x] Revenue Analytics
- [x] Settings & Integrations pages
- [x] Public marketing homepage
- [x] Auth Context state management
- [x] Express backend setup
- [x] Prisma + PostgreSQL schema
- [x] JWT authentication
- [x] Telegram webhook integration (partial)

### ⏳ IN PROGRESS
- [ ] Telegram bot refinements
- [ ] Frontend ↔ Backend API connection
- [ ] WhatsApp integration
- [ ] Email integration
- [ ] WebSocket for real-time chat

### 📋 TODO
- [ ] Tests (Jest, RTL)
- [ ] Advanced reporting
- [ ] AI lead scoring
- [ ] Mobile app
- [ ] Docker deployment

---

## 🌍 Frontend Pages Overview

```
/                          → Home (Marketing page)
/login                     → Login form
/signup                    → Signup form

/dashboard                 → Dashboard home (DashboardHome.tsx)
  ├── /dashboard/leads     → Leads table
  ├── /dashboard/conversations → Conversation list
  ├── /dashboard/deals     → Sales pipeline Kanban
  ├── /dashboard/revenue   → Analytics dashboard
  ├── /dashboard/reports   → Reports page
  └── /dashboard/settings  → Settings & integrations
```

---

## 🔌 Environment Variables

### Frontend (.env)
```bash
VITE_API_URL=http://localhost:4000
```

### Backend (.env)
```bash
DATABASE_URL=postgresql://user:password@localhost:5432/leadsync
PORT=4000
NODE_ENV=development
JWT_SECRET=your-secret
TELEGRAM_BOT_TOKEN=your-token
TELEGRAM_WEBHOOK_SECRET=your-webhook-secret
CORS_ORIGIN=http://localhost:5173
```

---

## 💡 Key Concepts to Remember

1. **Company-Scoped**: All data filtered by `companyId` automatically
2. **JWT-Based Auth**: Every request includes bearer token in header
3. **Prisma Migrations**: Database changes tracked in `/migrations`
4. **Mock Data**: Frontend uses mock data until backend APIs are connected
5. **Type-Safe**: TypeScript everywhere (frontend + backend)
6. **Telegram Webhooks**: Incoming messages trigger serverless-like responses

---

## 🚀 Local Development Startup

### Terminal 1: Frontend
```bash
cd d:\startup
npm install
npm run dev
# Opens http://localhost:5173
```

### Terminal 2: Backend
```bash
cd d:\startup\leadsync-backend
npm install
npx prisma migrate deploy
npm run dev
# Opens http://localhost:4000
```

### Terminal 3: Database (optional, if using local PostgreSQL)
```bash
# Ensure PostgreSQL is running on port 5432
# Database name: leadsync
psql -U postgres -d leadsync
```

---

## 📚 File Reading Guide for AI

### To understand Frontend:
1. Read `src/App.tsx` (routing)
2. Read `src/context/AuthContext.tsx` (state)
3. Read `src/types/index.ts` (data structure)
4. Read `src/data/mockData.ts` (sample data)
5. Pick any page in `src/pages/` and trace component calls

### To understand Backend:
1. Read `leadsync-backend/src/app.ts` (setup)
2. Read `leadsync-backend/prisma/schema.prisma` (database)
3. Read `leadsync-backend/src/routes/auth.routes.ts` (example endpoint)
4. Read `leadsync-backend/src/middleware/auth.middleware.ts` (auth logic)
5. Read `leadsync-backend/src/services/telegram.service.ts` (integration)

### To understand Full-Stack Flow:
1. Pick a feature (e.g., "Create Lead")
2. Find frontend component handling it
3. Trace API call to backend route
4. Follow database query in service
5. Read response handling in frontend

---

**This quick reference is optimized for LLM/ChatGPT understanding. Use the comprehensive guide for detailed implementation.**
