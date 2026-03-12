# LeadSync CRM - Complete File Structure Guide

**Purpose**: Detailed breakdown of every directory and its purpose.  
**Format**: Tree structure with explanations.

---

## 📁 Root Directory (`d:\startup\`)

```
d:\startup/
│
├── 📂 src/                                   [FRONTEND - MAIN APPLICATION]
│   ├── 📂 components/                       Main UI components (reusable)
│   │   ├── 📂 auth/
│   │   │   └── RequireAuth.tsx             Route protection component
│   │   ├── 📂 conversations/
│   │   │   └── ChatPanel.tsx               Chat/message UI
│   │   ├── 📂 dashboard/
│   │   │   └── SectionSummary.tsx          KPI card component
│   │   ├── 📂 layout/
│   │   │   ├── DashboardLayout.tsx         Main dashboard wrapper
│   │   │   ├── MarketingNav.tsx            Top nav for public pages
│   │   │   └── Sidebar.tsx                 Left navigation + company switcher
│   │   ├── 📂 leads/
│   │   │   ├── LeadDetailModal.tsx         Lead details popup (3 tabs)
│   │   │   └── LeadsTable.tsx              Leads list with filtering
│   │   └── 📂 ui/
│   │       ├── Modal.tsx                   Reusable modal component
│   │       ├── Spinner.tsx                 Loading spinner
│   │       ├── Toast.tsx                   Individual toast (legacy)
│   │       └── ToastContainer.tsx          Global toast manager
│   │
│   ├── 📂 context/
│   │   └── AuthContext.tsx                 User + Company state (React Context)
│   │
│   ├── 📂 data/
│   │   └── mockData.ts                     Mock companies, leads, deals, messages
│   │
│   ├── 📂 pages/
│   │   ├── Home.tsx                        Marketing homepage (public)
│   │   ├── Login.tsx                       Login page (public)
│   │   ├── Signup.tsx                      Signup page (public)
│   │   └── 📂 dashboard/
│   │       ├── DashboardHome.tsx           Main dashboard with KPIs
│   │       ├── Leads.tsx                   Leads page
│   │       ├── Conversations.tsx           Conversations / Shared Inbox
│   │       ├── Deals.tsx                   Sales Pipeline (Kanban)
│   │       ├── Revenue.tsx                 Analytics dashboard
│   │       ├── Reports.tsx                 Reports page
│   │       └── Settings.tsx                Settings & integrations
│   │
│   ├── 📂 types/
│   │   └── index.ts                        All TypeScript interfaces
│   │
│   ├── 📂 utils/
│   │   └── formatINR.ts                    Currency formatting (₹)
│   │
│   ├── App.tsx                             Main router configuration
│   ├── main.tsx                            React entry point
│   ├── index.css                           Tailwind imports + global styles
│   └── vite-env.d.ts                       Vite type definitions
│
├── 📂 leadsync-backend/                    [BACKEND - API SERVER]
│   ├── 📂 src/
│   │   ├── 📂 routes/                      API endpoints
│   │   │   ├── 📂 leads/
│   │   │   │   └── leads.routes.ts        Lead CRUD endpoints
│   │   │   ├── 📂 telegram/
│   │   │   │   ├── telegram.controller.ts Route handlers
│   │   │   │   └── telegram.routes.ts     Webhook endpoints
│   │   │   ├── auth.routes.ts             Signup/Login endpoints
│   │   │   ├── conversations.routes.ts    Conversation endpoints
│   │   │   ├── integrations.routes.ts     Integration endpoints
│   │   │   ├── public.routes.ts           Public endpoints (no auth)
│   │   │   └── secure.routes.ts           Protected endpoints (require auth)
│   │   │
│   │   ├── 📂 services/
│   │   │   ├── telegram.service.ts        Telegram API client
│   │   │   └── telegram.webhook.ts        Webhook handler
│   │   │
│   │   ├── 📂 bot/
│   │   │   ├── bot.logic.ts               Bot conversation logic
│   │   │   └── telegram.sender.ts         Send messages to Telegram
│   │   │
│   │   ├── 📂 middleware/
│   │   │   └── auth.middleware.ts         JWT authentication
│   │   │
│   │   ├── 📂 lib/
│   │   │   ├── api.ts                     API utilities
│   │   │   └── prisma.ts                  Prisma client instance
│   │   │
│   │   ├── 📂 utils/
│   │   │   └── jwt.ts                     JWT token generation
│   │   │
│   │   ├── app.ts                         Express app setup
│   │   └── server.ts                      Server entry point (port 4000)
│   │
│   ├── 📂 prisma/
│   │   ├── schema.prisma                  Database models definition
│   │   ├── seed.ts                        Database seeding script
│   │   └── 📂 migrations/                 Migration history
│   │       ├── migration_lock.toml        Prisma lock file
│   │       ├── 20260208094647_init/
│   │       ├── 20260208182720_add_telegram_webhook_secret_and_fix_relations/
│   │       ├── 20260208183718_add_telegram_webhook_secret/
│   │       ├── 20260208202707_add_conversation_mode/
│   │       ├── 20260208211639_fix_company_conversation_relation/
│   │       └── 20260208212439_finalize_conversation_schema/
│   │
│   ├── package.json                       Backend dependencies
│   ├── tsconfig.json                      TypeScript config
│   └── tsconfig.prisma.json                Prisma TypeScript config
│
├── 📂 dist/                                [BUILD OUTPUT - Generated]
│   └── (Compiled frontend code - don't edit)
│
├── 📂 node_modules/                        [DEPENDENCIES - Auto-generated]
│   └── (All npm packages - don't edit)
│
├── 📄 Configuration Files (Root)
│   ├── package.json                       Frontend project metadata
│   ├── package-lock.json                  Dependency lock file
│   ├── tsconfig.json                      TypeScript config (frontend)
│   ├── tsconfig.node.json                 TypeScript for build tools
│   ├── vite.config.ts                     Vite build configuration
│   ├── tailwind.config.js                 Tailwind CSS configuration
│   ├── postcss.config.js                  PostCSS setup for Tailwind
│   ├── index.html                         HTML entry point
│   └── .env                               Environment variables (not in git)
│
└── 📄 Documentation Files
    ├── README.md                          Project overview
    ├── RUNNING.md                         How to run locally
    ├── COMPREHENSIVE_PROJECT_GUIDE.md     ← MAIN DOCUMENTATION
    ├── CHATGPT_QUICK_REFERENCE.md         ← AI-FRIENDLY SUMMARY
    ├── ARCHITECTURE_FLOWS.md               ← DATA FLOW DIAGRAMS
    ├── PROJECT_STRUCTURE.md               Legacy structure doc
    ├── QUICK_REFERENCE.md                 Legacy quick ref
    ├── DOCUMENTATION_SUMMARY.md           Legacy summary
    ├── ENHANCEMENTS.md                    Feature list
    ├── ENHANCEMENTS_COMPLETE.md           Completed features
    ├── FILE_INVENTORY.md                  File listing
    └── (Other docs)                       Legacy documentation
```

---

## 📄 Key Files Explained

### Frontend Core Files

#### `src/App.tsx`
- **Purpose**: Main React Router configuration
- **Contains**: Route definitions for all pages
- **Key Routes**:
  - `/` → Home (public)
  - `/login`, `/signup` → Auth pages (public)
  - `/dashboard/*` → Protected dashboard routes
- **Key Component**: RequireAuth wrapper for protected routes

#### `src/main.tsx`
- **Purpose**: React entry point
- **Does**:
  1. Renders React app into DOM
  2. Wraps app with AuthProvider (for context)
  3. ToastContainer injected here

#### `src/index.css`
- **Purpose**: Global styles
- **Contains**:
  - Tailwind CSS imports
  - Global CSS classes
  - Font definitions
  - Custom utility classes

#### `src/context/AuthContext.tsx`
- **Purpose**: User authentication state management
- **Provides**: `useAuth()` hook
- **Contains**:
  - User object (id, email, name, role, companyId)
  - Company object (id, name)
  - login/logout methods
- **Usage**: Every component accesses current user/company via `useAuth()`

#### `src/types/index.ts`
- **Purpose**: Centralized TypeScript interfaces
- **Exports**:
  - User, Company, Lead, Message, Deal interfaces
  - Type definitions for all API responses
  - Enums for statuses (source, priority, etc.)

#### `src/data/mockData.ts`
- **Purpose**: Mock data for frontend development
- **Contents**:
  - mockCompanies (3 companies)
  - mockLeads (50+ leads, filtered by companyId)
  - mockMessages (30+ messages)
  - mockDeals (20+ deals)
  - mockAgents (10+ agents)
- **Usage**: Used in all frontend pages until backend APIs are integrated

### Backend Core Files

#### `leadsync-backend/src/server.ts`
- **Purpose**: Server entry point
- **Does**:
  1. Imports Express app
  2. Sets PORT (default 4000)
  3. Calls app.listen(PORT)
  4. Logs startup message
- **Run**: `npm run dev` from leadsync-backend

#### `leadsync-backend/src/app.ts`
- **Purpose**: Express app configuration
- **Does**:
  1. Creates Express instance
  2. Sets up CORS middleware
  3. Sets up body parser (JSON)
  4. Registers all routes
  5. Exports app
- **CORS**: Configured for `http://localhost:5173` (frontend)

#### `leadsync-backend/prisma/schema.prisma`
- **Purpose**: Prisma database schema definition
- **Models**:
  1. Company (tenant root)
  2. User (team agent)
  3. Lead (contact)
  4. Conversation (thread)
  5. Message (individual message)
- **Enums**: Role, Channel, MessageSender, ConversationMode
- **Key Feature**: Multi-tenant with `companyId` filtering

#### `leadsync-backend/src/routes/auth.routes.ts`
- **Purpose**: Authentication endpoints
- **Endpoints**:
  - `POST /signup` → Register new user + company
  - `POST /login` → Authenticate user
- **Flow**: Validates password → Generates JWT → Returns user + token

#### `leadsync-backend/src/middleware/auth.middleware.ts`
- **Purpose**: JWT verification middleware
- **Does**:
  1. Extracts JWT from Authorization header
  2. Verifies JWT signature
  3. Attaches user data to req.user
  4. Allows next() or returns 401
- **Usage**: Applied to all protected routes

#### `leadsync-backend/src/routes/leads/leads.routes.ts`
- **Purpose**: Lead management endpoints
- **Endpoints**:
  - `GET /api/leads` → Fetch company leads
  - `POST /api/leads` → Create lead
  - `GET /api/leads/:id` → Get lead details
  - `PUT /api/leads/:id` → Update lead
  - `DELETE /api/leads/:id` → Delete lead
- **Key**: Each endpoint filters by `req.user.companyId`

#### `leadsync-backend/src/services/telegram.service.ts`
- **Purpose**: Telegram API client
- **Methods**:
  - sendMessage() → Send message via Telegram API
  - getUpdates() → Fetch incoming messages
  - setBotWebhook() → Register webhook URL
- **Uses**: axios for HTTP requests to Telegram API

#### `leadsync-backend/src/services/telegram.webhook.ts`
- **Purpose**: Handle incoming Telegram messages
- **Flow**:
  1. Verify webhook secret
  2. Extract message + sender
  3. Create/get Lead
  4. Create/get Conversation
  5. Store message
  6. Generate auto-response
  7. Send response via Telegram

### Configuration Files

#### `package.json` (Frontend)
- **Scripts**:
  - `npm run dev` → Start Vite dev server
  - `npm run build` → Build for production
  - `npm run preview` → Serve production build
- **Dependencies**: React, React Router, Tailwind, Lucide, Recharts, etc.

#### `package.json` (Backend)
- **Scripts**:
  - `npm run dev` → Start with ts-node-dev (hot reload)
  - `npm run build` → Compile TypeScript to JS
  - `npm run seed` → Populate database
  - `npm run dev:all` → Start with ngrok tunnel
- **Dependencies**: Express, Prisma, JWT, bcryptjs, etc.

#### `tsconfig.json`
- **Purpose**: TypeScript compiler options
- **Key Settings**:
  - target: ES2020
  - module: esnext
  - jsx: react-jsx
  - strict: true (strict type checking)
  - resolveJsonModule: true

#### `vite.config.ts`
- **Purpose**: Vite bundler configuration
- **Settings**:
  - React plugin enabled
  - Dev server port: 5173
  - Build output: dist/

#### `tailwind.config.js`
- **Purpose**: Tailwind CSS customization
- **Custom Colors**:
  - Primary: cyan-600
  - Text: slate colors
  - Status colors (red, amber, sky, emerald)
- **Plugins**: @tailwindcss/forms (optional)

#### `.env` (Backend)
- **Variables** (Don't commit this file!):
  - DATABASE_URL
  - PORT
  - JWT_SECRET
  - TELEGRAM_BOT_TOKEN
  - TELEGRAM_WEBHOOK_SECRET
  - CORS_ORIGIN

---

## 🎯 File Access Patterns

### To Add a New Feature (Example: "Delete Conversation")

#### Step 1: Frontend Component
- File: `src/pages/dashboard/Conversations.tsx`
- Add delete button with onClick handler
- Call `fetch('/api/conversations/{id}', { method: 'DELETE' })`

#### Step 2: Backend Route
- File: `leadsync-backend/src/routes/conversations.routes.ts`
- Add: `router.delete('/:id', deleteConversation)`
- Check companyId matches

#### Step 3: Database
- File: auto-reflected in Prisma
- Query: `prisma.conversation.delete({ where: { id, companyId } })`

#### Step 4: Test
- Frontend: Click delete, see response
- Check database: record should be gone

---

## 📊 File Dependency Graph

```
App.tsx
  ├── Imports from pages/
  │   ├── Home.tsx
  │   ├── Login.tsx
  │   ├── Signup.tsx
  │   └── pages/dashboard/
  │       ├── DashboardHome.tsx
  │       ├── Leads.tsx
  │       │   └── Imports LeadsTable.tsx + components
  │       ├── Conversations.tsx
  │       │   └── Imports ChatPanel.tsx
  │       ├── Deals.tsx
  │       ├── Revenue.tsx
  │       ├── Reports.tsx
  │       └── Settings.tsx
  │
  ├── Imports DashboardLayout from components/layout/
  │
  └── Imports AuthContext from context/
      └── Provides useAuth() hook to all components

Every Component/Page
  ├── Imports from types/index.ts (interfaces)
  ├── Imports from data/mockData.ts (sample data)
  ├── Uses AuthContext via useAuth() hook
  ├── Imports UI components from components/ui/
  └── May import from utils/

API Calls (in pages/components)
  ├── Hit backend /api/* endpoints
  │   └── leadsync-backend routes
  │       ├── auth.routes.ts
  │       ├── leads.routes.ts
  │       ├── conversations.routes.ts
  │       ├── telegram.routes.ts
  │       └── etc.
  │
  ├── Backend routes call services/
  │   ├── telegram.service.ts
  │   ├── lead.service.ts
  │   └── conversation.service.ts
  │
  └── Services call Prisma ORM
      └── prisma/schema.prisma
          └── PostgreSQL database
```

---

## 🔍 How to Find Something

### "I need to find the Login page"
→ `src/pages/Login.tsx`

### "I need to understand authentication"
→ Start: `src/context/AuthContext.tsx`  
→ Then: `leadsync-backend/src/routes/auth.routes.ts`  
→ Then: `leadsync-backend/src/middleware/auth.middleware.ts`

### "I need to find the Leads API"
→ `leadsync-backend/src/routes/leads/leads.routes.ts`

### "I need to see what a Lead looks like"
→ `src/types/index.ts` (interface)  
→ `src/data/mockData.ts` (sample data)  
→ `leadsync-backend/prisma/schema.prisma` (database model)

### "I need to understand Telegram integration"
→ `leadsync-backend/src/services/telegram.webhook.ts` (incoming)  
→ `leadsync-backend/src/services/telegram.service.ts` (outgoing)  
→ `leadsync-backend/src/bot/bot.logic.ts` (logic)

### "I need to modify how leads are displayed"
→ `src/components/leads/LeadsTable.tsx` (main table)  
→ `src/components/leads/LeadDetailModal.tsx` (detailed view)

### "I need to understand database schema"
→ `leadsync-backend/prisma/schema.prisma`

### "I need to add an API endpoint"
→ Create file: `leadsync-backend/src/routes/feature.routes.ts`  
→ Register in: `leadsync-backend/src/app.ts`  
→ Add TypeScript types to: `src/types/index.ts`

---

## ✅ Checklist for Understanding the Project

- [ ] Read `COMPREHENSIVE_PROJECT_GUIDE.md` (main guide)
- [ ] Read `CHATGPT_QUICK_REFERENCE.md` (quick overview)
- [ ] Read `ARCHITECTURE_FLOWS.md` (data flows)
- [ ] Browse `src/App.tsx` (routing)
- [ ] Browse `src/context/AuthContext.tsx` (state)
- [ ] Browse `src/types/index.ts` (data structure)
- [ ] Browse `src/data/mockData.ts` (sample data)
- [ ] Browse `leadsync-backend/src/app.ts` (backend setup)
- [ ] Browse `leadsync-backend/prisma/schema.prisma` (database)
- [ ] Read `leadsync-backend/src/routes/auth.routes.ts` (example endpoint)
- [ ] Understand auth flow from login to protected API call
- [ ] Understand multi-tenancy pattern (companyId filtering)
- [ ] Trace a feature end-to-end (e.g., Create Lead)

**After completing this checklist, you should have a complete understanding of the entire project.**

---

**This guide was created on February 9, 2026. Update when major file changes occur.**
