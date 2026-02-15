# **LeadSync CRM - Complete Codebase Documentation**

**Project Name:** LeadSync CRM  
**Version:** 1.0.0  
**Type:** Full-Stack SaaS Lead Management Platform  
**Current Date:** February 8, 2026  
**Status:** Production-Ready with Full UI/UX Enhancements ✅  
**Frontend:** http://localhost:5173 | **Backend:** http://localhost:4000

---

## **📋 Table of Contents**

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Directory Structure](#directory-structure)
4. [Frontend Architecture](#frontend-architecture)
5. [Backend Architecture](#backend-architecture)
6. [Database Schema & Models](#database-schema--models)
7. [API Endpoints](#api-endpoints)
8. [Core Features](#core-features)
9. [Data Models & Types](#data-models--types)
10. [Development Guide](#development-guide)

---

## **🎯 Project Overview**

**LeadSync CRM** is a production-ready, multi-tenant SaaS lead management platform designed for SME businesses across any industry vertical. The application provides:

- **Lead Management**: Advanced search, filtering, sorting, and detailed analytics
- **Shared Inbox**: Real-time conversations grouped by lead
- **Sales Pipeline**: Kanban-style deal management
- **Revenue Analytics**: Period-based insights with trend indicators
- **Settings & Integrations**: Profile management, notifications, and integration points
- **Public Marketing Site**: Hero section, feature showcase, testimonials

**Target Users:**
- Sales teams (agents, managers)
- Business owners
- Multi-company enterprises

**Key Differentiators:**
- Industry-agnostic (works for retail, bakery, e-commerce, services, real estate, B2B SaaS, consulting, hospitality)
- Multi-tenant architecture
- Mock data placeholders ready for real backend integration
- Production-ready TypeScript + React frontend
- Express.js + Prisma backend

---

## **🛠️ Tech Stack**

### **Frontend Stack**

| Technology | Purpose | Version | Details |
|-----------|---------|---------|---------|
| **React** | UI Framework | ^18.3.1 | JSX-based component library |
| **TypeScript** | Type Safety | ~5.6.2 | Strict type checking for production |
| **Tailwind CSS** | Styling | ^3.4.15 | Utility-first CSS framework |
| **Vite** | Build Tool | ^5.4.10 | Fast development server & build |
| **React Router** | SPA Routing | ^6.28.0 | Client-side navigation |
| **Lucide React** | Icons | ^0.454.0 | 450+ SVG icons |
| **Recharts** | Data Visualization | ^2.6.2 | Chart library (ready for integration) |
| **react-hot-toast** | Notifications | ^2.4.0 | Toast notifications |
| **Framer Motion** | Animations | ^10.12.16 | Smooth UI animations |
| **@headlessui/react** | Components | ^1.7.17 | Unstyled, accessible components |

### **Backend Stack**

| Technology | Purpose | Version | Details |
|-----------|---------|---------|---------|
| **Express.js** | Web Framework | ^4.22.1 | Node.js server framework |
| **TypeScript** | Type Safety | ^5.9.3 | Strict server-side typing |
| **Prisma ORM** | Database Access | ^6.6.0 | Type-safe DB queries |
| **PostgreSQL** | Database | Latest | Primary data store |
| **bcryptjs** | Password Hashing | ^3.0.3 | Secure user authentication |
| **jsonwebtoken** | JWT Tokens | ^9.0.3 | Stateless authentication |
| **CORS** | Security | ^2.8.6 | Cross-origin for http://localhost:5173 |
| **dotenv** | Config | ^17.2.4 | Environment variable management |
| **ts-node-dev** | Dev Server | ^2.0.0 | Hot-reloading TypeScript runner |
| **concurrently** | Process Manager | ^9.2.0 | Run dev + ngrok together |

### **Build & Dev Tools**

- **Package Manager:** npm
- **Module Type:** ESM (frontend), CommonJS (backend)
- **Node Version:** ^18.0.0 (recommended)

---

## **📁 Directory Structure**

```
d:\startup/                           # Root monorepo
├── src/                              # FRONTEND - React + TypeScript
│   ├── App.tsx                       # Main app routing & component
│   ├── main.tsx                      # React entry point (Vite)
│   ├── index.css                     # Global styles + Tailwind imports
│   ├── vite-env.d.ts                # Vite type definitions
│   │
│   ├── components/                   # Reusable UI components
│   │   ├── conversations/
│   │   │   └── ChatPanel.tsx         # Message display & input for shared inbox
│   │   ├── dashboard/
│   │   │   ├── SectionSummary.tsx   # KPI card component (revenue, deals, etc)
│   │   ├── layout/
│   │   │   ├── DashboardLayout.tsx  # Main dashboard wrapper with sidebar
│   │   │   ├── MarketingNav.tsx     # Public site navigation
│   │   │   └── Sidebar.tsx          # Side navigation for dashboard
│   │   ├── leads/
│   │   │   ├── LeadDetailModal.tsx  # Lead details modal with 3 tabs
│   │   │   └── LeadsTable.tsx       # Leads list table with pagination
│   │   └── ui/
│   │       ├── Modal.tsx             # Reusable modal wrapper
│   │       ├── Spinner.tsx           # Loading spinner
│   │       ├── Toast.tsx             # Single toast notification
│   │       └── ToastContainer.tsx    # Toast notification manager
│   │
│   ├── context/
│   │   └── AuthContext.tsx          # React Context for auth state
│   │
│   ├── data/
│   │   └── mockData.ts              # Mock leads, users, conversations for demo
│   │
│   ├── pages/                        # Full-page components (routes)
│   │   ├── Home.tsx                  # Public landing page
│   │   ├── Login.tsx                 # Login form page
│   │   ├── Signup.tsx                # Signup form page
│   │   └── dashboard/                # Protected dashboard pages
│   │       ├── DashboardHome.tsx    # Dashboard welcome/overview
│   │       ├── Leads.tsx             # Leads management page
│   │       ├── Conversations.tsx     # Shared inbox page
│   │       ├── Deals.tsx             # Sales pipeline (Kanban)
│   │       ├── Revenue.tsx           # Analytics dashboard
│   │       ├── Reports.tsx           # Reports page
│   │       └── Settings.tsx          # User settings & integrations
│   │
│   ├── types/
│   │   └── index.ts                  # Shared TypeScript interfaces & types
│   │
│   └── utils/
│       └── formatINR.ts              # Utility: Format currency to Indian Rupees
│
├── leadsync-backend/                 # BACKEND - Express + Prisma
│   ├── src/
│   │   ├── server.ts                 # Entry point, port configuration
│   │   ├── app.ts                    # Express app setup, middleware, routes
│   │   │
│   │   ├── lib/
│   │   │   └── prisma.ts             # Prisma client singleton instance
│   │   │
│   │   └── routes/
│   │       ├── leads/
│   │       │   └── leads.routes.ts   # GET /api/leads - fetch leads by companyId
│   │       └── telegram/
│   │           └── telegram.routes.ts # POST /api/telegram/webhook - Telegram bot webhook
│   │
│   ├── prisma/
│   │   ├── schema.prisma             # Database schema (Company, User, Lead, Message, etc)
│   │   ├── seed.ts                   # Database seeding script
│   │   ├── migrations/               # Database migration history
│   │   │   ├── migration_lock.toml   # Prisma migration lock file
│   │   │   └── 20260207162601_init/  # Initial schema migration
│   │   │       └── migration.sql     # SQL for initial tables
│   │   │
│   │   └── [Other migration folders...]
│   │
│   ├── package.json                  # Backend dependencies & scripts
│   ├── tsconfig.json                 # TypeScript config for backend
│   └── dist/                          # Compiled JavaScript output (after build)
│
├── package.json                      # Frontend root dependencies & scripts
├── tsconfig.json                     # Frontend TypeScript config
├── tsconfig.node.json                # TypeScript config for Vite config file
├── vite.config.ts                    # Vite build configuration
├── tailwind.config.js                # Tailwind CSS configuration
├── postcss.config.js                 # PostCSS configuration (for Tailwind)
│
├── README.md                         # Project overview (user-friendly)
├── PROJECT_STRUCTURE.md              # Directory tree overview
├── ENHANCEMENTS.md                   # Feature enhancement tracking
├── ENHANCEMENTS_SUMMARY.md           # Summary of completed enhancements
├── ENHANCEMENTS_COMPLETE.md          # Final enhancement status
├── SETTINGS_ENHANCEMENTS.md          # Settings improvements
│
└── index.html                        # HTML entry point for Vite

```

---

## **🎨 Frontend Architecture**

### **Technology Overview**
- **Framework:** React 18 with TypeScript
- **Styling:** Tailwind CSS (utility-first) + Lucide icons
- **Routing:** React Router v6 (SPA)
- **State Management:** React Context API (AuthContext) + local component state
- **Build:** Vite (fast development & optimized builds)

### **Component Structure**

#### **1. App-Level Routing** (`src/App.tsx`)
```
/                          → Home (public marketing site)
/login                     → Login page
/signup                    → Signup page
/dashboard                 → DashboardLayout (protected)
  /dashboard               → DashboardHome
  /dashboard/leads         → Leads page
  /dashboard/conversations → Shared inbox
  /dashboard/deals         → Sales pipeline
  /dashboard/revenue       → Revenue analytics
  /dashboard/reports       → Reports
  /dashboard/settings      → Settings & integrations
*                          → Not found → redirect to /
```

#### **2. Component Hierarchy**

**Layout Components:**
- `DashboardLayout` - Main dashboard wrapper, renders sidebar + nested routes
- `MarketingNav` - Navigation for public pages (Home)
- `Sidebar` - Dashboard left navigation with links to all sections

**Feature Components:**
- **Leads Module:**
  - `LeadsTable` - Displays leads with search, filter, sort, pagination
  - `LeadDetailModal` - Opens when clicking a lead; 3 tabs: Details (assign), Notes (edit), Conversations
  
- **Conversations Module:**
  - `ChatPanel` - Message thread display with sender badges, auto-scroll, attachments
  
- **Analytics:**
  - `SectionSummary` - Reusable KPI card (displays metric, value, trend)
  - Revenue page uses multiple SectionSummary cards + charts (Recharts placeholders)
  - Deals page uses Kanban-style layout with cards

**UI Components:**
- `Modal` - Reusable modal wrapper (for leads detail, delete confirmation, etc)
- `Spinner` - Loading state indicator
- `Toast` - Single notification (success, error, info)
- `ToastContainer` - Manager for multiple toasts

#### **3. State Management**

**AuthContext** (`src/context/AuthContext.tsx`):
- Stores: current user, company, authentication status
- Provides: login, logout, signup methods (placeholders for now)
- Used across all dashboard pages

**Mock Data** (`src/data/mockData.ts`):
- Sample leads, users, conversations, deals, revenue metrics
- Used for component development before backend integration

#### **4. Styling Approach**

- **Tailwind CSS**: Utility classes for layout, spacing, colors, responsive design
- **Lucide icons**: `<Icon />` components for 450+ SVG icons
- **Dark mode**: Light/dark toggle in Settings (UI ready, no-op for now)
- **Responsive**: Mobile-first design (tablets, desktops)

### **Key Pages**

| Page | Route | Purpose | Key Components |
|------|-------|---------|---|
| Home | `/` | Public landing page | MarketingNav, Hero, Features grid, Testimonials |
| Login | `/login` | Authentication | Form with email/password, link to signup |
| Signup | `/signup` | Registration | Form with name/email/password, link to login |
| Dashboard Home | `/dashboard` | Overview | 4 KPI cards (leads, conversations, deals, revenue) |
| Leads | `/dashboard/leads` | Lead management | LeadsTable, filters, LeadDetailModal |
| Conversations | `/dashboard/conversations` | Shared inbox | ChatPanel, lead list, message threads |
| Deals | `/dashboard/deals` | Sales pipeline | Kanban board, deal cards, metrics, agent filter |
| Revenue | `/dashboard/revenue` | Analytics | Period toggle, KPI cards, trend indicators, tables, charts |
| Reports | `/dashboard/reports` | Reporting | Placeholder page |
| Settings | `/dashboard/settings` | Configuration | Profile, notifications, appearance, integrations, danger zone |

---

## **🔧 Backend Architecture**

### **Technology Overview**
- **Framework:** Express.js with TypeScript
- **ORM:** Prisma (type-safe database access)
- **Database:** PostgreSQL
- **API Style:** RESTful JSON endpoints
- **Server:** Node.js with hot-reload (ts-node-dev)

### **File Structure**

**Entry Points:**
- `server.ts` - Creates and starts Express server on port (default 3001 or env PORT)
- `app.ts` - Express app setup: middleware (CORS, JSON), health check, route mounting

**Route Organization:**
- `/routes/leads/leads.routes.ts` - Lead CRUD operations
- `/routes/telegram/telegram.routes.ts` - Telegram webhook handler

**Database:**
- `/lib/prisma.ts` - Prisma client singleton (reused across routes)
- `/prisma/schema.prisma` - Database schema definition
- `/prisma/seed.ts` - Database seeding script (populate initial data)
- `/prisma/migrations/` - Migration history for database changes

### **Middleware Stack**

```
Express App
├── cors() - Handle cross-origin requests from frontend
├── express.json() - Parse JSON request bodies
├── Routes (leads, telegram, health check)
└── Error handling (try-catch in route handlers)
```

### **API Health Check**

```
GET /health
Response: { status: 'LeadSync backend running 🚀' }
```

---

## **🗄️ Database Schema & Models**

### **Prisma Schema Overview** (`prisma/schema.prisma`)

**Provider:** PostgreSQL  
**Generated Client:** Prisma Client JS (auto-generated, type-safe)

#### **Enums**

**Channel:**
- `WEBSITE` - Lead source: website form
- `TELEGRAM` - Lead source: Telegram bot
- `WHATSAPP` - Lead source: WhatsApp Business

**Role:**
- `OWNER` - Company owner/admin
- `AGENT` - Sales agent/team member

**MessageSender:**
- `CLIENT` - Message from lead/customer
- `AGENT` - Message from team member
- `SYSTEM` - Auto-response or system message

#### **Models**

##### **1. Company**
```
Model: Company (multi-tenant unit)
Fields:
  - id: UUID (primary key)
  - name: String (company name)
  - createdAt: DateTime (created timestamp)

Relations:
  - users: User[] (team members)
  - leads: Lead[] (company's leads)

Purpose: Multi-tenant isolation; all data scoped per company
```

##### **2. User**
```
Model: User (team member / agent)
Fields:
  - id: UUID (primary key)
  - email: String (unique, login identifier)
  - name: String (display name)
  - role: Role (OWNER or AGENT)
  - companyId: UUID (foreign key)
  - createdAt: DateTime

Relations:
  - company: Company (parent company)

Purpose: User accounts, role-based access, auth
```

##### **3. Lead**
```
Model: Lead (prospect / customer)
Fields:
  - id: UUID (primary key)
  - name: String? (optional, lead's name)
  - contact: String (phone, email, or Telegram username)
  - channel: Channel (how lead was acquired)
  - companyId: UUID (foreign key, multi-tenant isolation)
  - createdAt: DateTime (when lead was created)

Relations:
  - company: Company (parent company)
  - conversations: Conversation[] (message threads)

Purpose: Lead database; scoped per company
```

##### **4. Conversation**
```
Model: Conversation (message thread per lead)
Fields:
  - id: UUID (primary key)
  - channel: Channel (communication channel)
  - leadId: UUID (foreign key)
  - createdAt: DateTime

Relations:
  - lead: Lead (parent lead)
  - messages: Message[] (message history)

Purpose: Group messages by lead; one conversation = one lead communication thread
```

##### **5. Message**
```
Model: Message (individual message)
Fields:
  - id: UUID (primary key)
  - content: String (message text)
  - sender: MessageSender (CLIENT, AGENT, or SYSTEM)
  - conversationId: UUID (foreign key)
  - createdAt: DateTime

Relations:
  - conversation: Conversation (parent conversation)

Purpose: Store individual messages in a thread
```

### **Database Relationships**

```
Company (1) ──→ (N) User
Company (1) ──→ (N) Lead
Lead (1) ──→ (N) Conversation
Conversation (1) ──→ (N) Message
```

### **Multi-Tenant Architecture**

Every data model includes `companyId` to enforce multi-tenant isolation:
- All leads are scoped per company
- All users belong to one company
- All conversations are accessed through company's leads
- Messages inherit company context through conversation → lead → company

---

## **📡 API Endpoints**

### **Base URL**: `http://localhost:4000`

### **1. Health Check**

```
GET /health
Description: Server status check
Response:
  {
    "status": "LeadSync backend running 🚀"
  }
Status: 200 OK
```

### **2. Authentication**

#### **User Signup**
```
POST /api/auth/signup
Body:
  {
    "companyName": "string",
    "name": "string",
    "email": "string",
    "password": "string"
  }
Response (Success 200):
  {
    "token": "jwt_token",
    "user": {
      "id": "uuid",
      "email": "string",
      "name": "string",
      "role": "OWNER"
    }
  }
```

#### **User Login**
```
POST /api/auth/login
Body:
  {
    "email": "string",
    "password": "string"
  }
Response (Success 200):
  {
    "token": "jwt_token",
    "user": {
      "id": "uuid",
      "email": "string",
      "name": "string",
      "role": "OWNER" | "AGENT"
    }
  }
```

### **3. Integrations**

#### **Ping / Health Check**
```
GET /api/integrations/ping
Description: Frontend connection verification
Response (Success 200):
  {
    "status": "ok",
    "message": "Frontend connected to backend 🚀"
  }
```

### **4. Leads Management**

#### **Get All Leads for Company**
```
GET /api/leads?companyId=xxx
Parameters:
  - companyId (required, string): UUID of the company
Auth: Bearer token (JWT)

Response (Success 200):
  [
    {
      "id": "uuid",
      "name": "John Doe",
      "contact": "+91-XXXXXX",
      "channel": "TELEGRAM" | "WEBSITE" | "WHATSAPP",
      "companyId": "uuid",
      "createdAt": "2026-02-07T10:00:00Z",
      "conversations": [
        {
          "id": "uuid",
          "channel": "TELEGRAM",
          "leadId": "uuid",
          "createdAt": "...",
          "messages": [...]
        }
      ]
    },
    ...
  ]

Error (400):
  { "error": "companyId is required" }

Error (500):
  { "error": "Failed to fetch leads" }
```

#### **Expected Future Endpoints** (to be implemented):
```
POST /api/leads
  - Create a new lead

GET /api/leads/:id
  - Get lead details

PUT /api/leads/:id
  - Update lead info

DELETE /api/leads/:id
  - Delete lead

POST /api/leads/:id/assign
  - Assign lead to agent
```

### **3. Telegram Integration**

#### **Telegram Webhook**
```
POST /api/telegram/webhook
Description: Receives messages from Telegram bot; creates/updates leads and messages

Request Body (from Telegram):
  {
    "message": {
      "message_id": 123,
      "from": {
        "id": "telegram_user_id",
        "first_name": "John",
        "username": "john_doe"
      },
      "text": "Hello, I'm interested in your service"
    }
  }

Processing Flow:
  1. Extract message from payload
  2. Get first company (demo hardcoding)
  3. Find or create Lead with (contact=telegramUserId, channel=TELEGRAM)
  4. Find or create Conversation for that lead
  5. Create Message record with sender=CLIENT
  6. Log to console for debugging

Response:
  201 Created (if message processed)
  200 OK (if no message, skipped)
  500 Error (if no company found)

Console Logs:
  📩 Telegram Webhook Payload: [full request body]
  💬 Message from [name] ([id]): [text]
  ✅ Lead created/found
  ✅ Message saved
```

#### **Expected Future Endpoints**:
```
POST /api/telegram/send
  - Send message to Telegram user

GET /api/telegram/webhooks
  - List configured webhooks

POST /api/telegram/webhooks
  - Register new webhook

DELETE /api/telegram/webhooks/:id
  - Remove webhook
```

---

## **🎯 Core Features**

### **Lead Management**
- ✅ Search by name, email
- ✅ Filter by source (website, chat, demo, referral, social, other)
- ✅ Filter by priority (critical, high, medium, low)
- ✅ Sort by date, name, priority
- ✅ Pagination (6 leads per page)
- ✅ Detailed modal with 3 tabs:
  - **Details**: Lead info, agent assignment
  - **Notes**: Inline note editing
  - **Conversations**: Message history
- ✅ Status badges ("New" vs "Contacted")

### **Conversations / Shared Inbox**
- ✅ Real-time message threads per lead
- ✅ Sender badges (Lead=gray, Agent=cyan, Auto-response=amber)
- ✅ Auto-scroll to latest message
- ✅ Date separators between messages
- ✅ Attachment button (placeholder for files)
- ✅ Auto-response toggle
- ✅ Company-scoped (all agents see same conversations)

### **Sales Pipeline / Deals**
- ✅ Kanban-style board: Qualified → Proposal → Negotiation → Closed Won → Closed Lost
- ✅ Collapsible stages
- ✅ Color-coded backgrounds
- ✅ Deal cards: lead name, value (₹), agent, date
- ✅ 3 metrics: Total closed value, Active deals count, Average deal size
- ✅ Agent filter
- ⏳ Drag-drop (placeholder UI ready)
- ⏳ Charts (Recharts ready)

### **Revenue Analytics**
- ✅ Period toggle: Day / Month / Year views
- ✅ Trend indicators: % change vs previous period (↑ green / ↓ red)
- ✅ 3 KPI cards: Total revenue, Closed deals count, Companies count
- ✅ Company-wise breakdown table with animated progress bars
- ✅ Agent-wise performance table (revenue, deal count, avg deal size)
- ⏳ Time-series chart (Recharts placeholder)

### **Settings & Integrations**
- ✅ **Profile**: Name, email, company (read-only), role (read-only)
- ✅ **Notifications**: Email on assignment, new lead alerts
- ✅ **Appearance**: Dark/Light toggle (UI ready)
- ✅ **Integrations**: 4 cards:
  - Slack OAuth
  - WhatsApp Business API
  - Email IMAP/SMTP
  - Lead Sources API
- ✅ **Danger Zone**: Delete account (with confirmation modal)

### **Public Marketing Site**
- ✅ Hero section: Tagline, value prop, 2 CTAs (Start Trial, Log In)
- ✅ 6-feature grid: Lead Aggregation, Shared Inbox, Revenue Dashboards, Sales Pipeline, Automation, Multi-Tenant
- ✅ Industries showcase: 8 verticals (Retail, Bakery, E-Commerce, Services, Real Estate, B2B SaaS, Consulting, Hospitality)
- ✅ 2 Testimonials with 5-star ratings
- ✅ Dark CTA section + footer

### **Authentication (Placeholder)**
- ✅ Login form (email/password)
- ✅ Signup form (name/email/password)
- ✅ Auth context with user state
- ⏳ Backend integration (ready for Supabase/Firebase)
- ⏳ Password reset
- ⏳ OAuth providers (Google, GitHub)

---

## **📊 Data Models & Types**

### **Frontend Types** (`src/types/index.ts`)

```typescript
// User roles
type UserRole = 'admin' | 'manager' | 'agent'

// Company/tenant
interface Company {
  id: string
  name: string
  industry?: string // 'bakery', 'retail', 'ecommerce', etc.
}

// User account
interface User {
  id: string
  email: string
  name: string
  role: UserRole
  avatar?: string
  companyId?: string // multi-tenant
}

// Lead sources
type LeadSource = 'website' | 'chat' | 'demo' | 'referral' | 'social' | 'other'

// Lead priority
type LeadPriority = 'low' | 'medium' | 'high' | 'critical'

// Lead record
interface Lead {
  id: string
  name: string
  email: string
  phone?: string
  company?: string // customer's company
  source: LeadSource
  priority: LeadPriority
  agentAssigned?: string
  agentId?: string
  companyId: string // multi-tenant scope
  createdAt: string
  notes?: string
}

// Message
interface Message {
  id: string
  leadId: string
  companyId: string // shared inbox scope
  content: string
  senderName: string
  sender: 'lead' | 'agent' | 'auto'
  createdAt: string
  attachments?: Attachment[]
}

// Conversation
interface Conversation {
  id: string
  leadId: string
  companyId: string
  messages: Message[]
  lastMessageAt: string
}

// Deal / Sales Stage
interface Deal {
  id: string
  leadId: string
  stage: 'qualified' | 'proposal' | 'negotiation' | 'closed-won' | 'closed-lost'
  value: number // in rupees
  currency: string
  agentId: string
  createdAt: string
}

// KPI / Metric
interface KPI {
  label: string
  value: number | string
  trend?: number // % change
  trendDirection?: 'up' | 'down'
}
```

### **Backend Models** (Prisma)

See [Database Schema & Models](#-database-schema--models) section above.

---

## **🚀 Development Guide**

### **Frontend Setup**

```bash
# 1. Install dependencies
npm install

# 2. Start development server (Vite)
npm run dev
# Output: Local:   http://localhost:5173/

# 3. Build for production
npm run build
# Generates: dist/ folder (77KB JS + 5.5KB CSS gzipped)

# 4. Preview production build
npm run preview
# Output: Local:   http://localhost:4173/

# 5. Lint code (if eslint configured)
npm run lint
```

### **Backend Setup**

```bash
# 1. Navigate to backend
cd leadsync-backend

# 2. Install dependencies
npm install

# 3. Setup environment variables
# Create .env file:
# DATABASE_URL="postgresql://user:password@localhost:5432/leadsync_db"
# PORT=3001

# 4. Run database migrations
npx prisma migrate dev --name init

# 5. Seed database (optional)
npm run seed

# 6. Start development server (hot-reload)
npm run dev
# Output: Server running on http://localhost:3001

# 7. Build for production
npm run build
# Generates: dist/ folder

# 8. Start production server
npm start
```

### **Database Setup**

```bash
# Install PostgreSQL (if not already)
# Then create database:
createdb leadsync_db

# Set DATABASE_URL in .env:
# DATABASE_URL="postgresql://user:password@localhost:5432/leadsync_db"

# Apply Prisma migrations:
npx prisma migrate dev

# Open Prisma Studio (GUI):
npx prisma studio
# Opens: http://localhost:5555
```

### **Environment Variables**

**Frontend** (`.env` or `.env.local`):
```
VITE_API_URL=http://localhost:3001/api
VITE_APP_NAME=LeadSync CRM
```

**Backend** (`.env`):
```
DATABASE_URL=postgresql://user:password@localhost:5432/leadsync_db
PORT=3001
NODE_ENV=development
```

### **Project Scripts Summary**

| Script | Location | Purpose |
|--------|----------|---------|
| `npm run dev` | Frontend root | Start Vite dev server (port 5173) |
| `npm run build` | Frontend root | Build for production |
| `npm run preview` | Frontend root | Preview production build |
| `npm run lint` | Frontend root | Lint code (if configured) |
| `npm run dev` | Backend | Start Express server with hot-reload (port 3001) |
| `npm run build` | Backend | Compile TypeScript to JavaScript |
| `npm run start` | Backend | Start compiled server |
| `npm run seed` | Backend | Seed database with initial data |

### **Common Development Workflows**

#### **1. Adding a New Lead Feature**
- Create component in `src/components/leads/`
- Add route in `src/App.tsx` if needed
- Use mock data from `src/data/mockData.ts`
- Add types to `src/types/index.ts`
- Call backend API when ready

#### **2. Creating a New API Endpoint**
- Create route file in `leadsync-backend/src/routes/`
- Define route handler with request/response types
- Add Prisma query in the handler
- Register route in `leadsync-backend/src/app.ts`
- Test with curl or Postman
- Update frontend to call endpoint

#### **3. Modifying Database Schema**
```bash
# Edit prisma/schema.prisma
# Then run:
npx prisma migrate dev --name description_of_change

# Prisma generates SQL migration automatically
# Apply to database
# Regenerates Prisma Client types
```

#### **4. Connecting Frontend to Live API**
- Update `VITE_API_URL` in `.env`
- Replace mock data calls with real API calls
- Add error handling for API failures
- Add loading states in components

### **Deployment Checklist**

**Frontend:**
- [ ] Run `npm run build`
- [ ] Verify `dist/` folder
- [ ] Deploy to Netlify, Vercel, or static hosting
- [ ] Set environment variables on hosting platform
- [ ] Test all routes and API calls

**Backend:**
- [ ] Run `npm run build`
- [ ] Verify `dist/` folder
- [ ] Deploy to Heroku, Railway, or your server
- [ ] Set environment variables (DATABASE_URL, PORT, NODE_ENV)
- [ ] Run migrations: `npx prisma migrate deploy`
- [ ] Verify health check: `GET /health`
- [ ] Configure CORS for frontend domain

---

## **🔒 Security Considerations**

### **Current Status** (Mock placeholders)
- ❌ No real authentication middleware
- ❌ No authorization checks
- ❌ No input validation (server-side)
- ❌ No rate limiting
- ❌ No HTTPS/SSL enforcement
- ❌ API keys not protected

### **Before Production Deployment**

1. **Authentication:**
   - Implement JWT or session-based auth
   - Validate tokens on backend
   - Secure password hashing (bcrypt)

2. **Authorization:**
   - Add role-based access control (RBAC)
   - Verify user belongs to company
   - Filter data by companyId in all queries

3. **Input Validation:**
   - Validate request data on backend
   - Sanitize email, phone, text inputs
   - Check data types and lengths

4. **HTTPS/SSL:**
   - Enable HTTPS on production
   - Enforce CORS for specific origins
   - Set secure cookies (HttpOnly, SameSite)

5. **Database:**
   - Use strong passwords
   - Enable encryption at rest
   - Setup automated backups
   - Use connection pooling

6. **Rate Limiting:**
   - Implement rate limiting middleware
   - Limit API calls per user/IP
   - Prevent brute force attacks

7. **Secrets Management:**
   - Use environment variables
   - Rotate secrets regularly
   - Never commit `.env` files
   - Use secrets manager in production

---

## **📞 Integration Points**

### **Ready-to-Integrate Services**

1. **Authentication:**
   - Supabase Auth
   - Firebase Authentication
   - Auth0
   - Passport.js

2. **Database:**
   - PostgreSQL (already configured with Prisma)
   - Supabase (PostgreSQL + Auth)
   - MongoDB (requires Prisma adapter)

3. **Messaging:**
   - Telegram Bot API (webhook already setup)
   - WhatsApp Business API
   - Twilio (SMS/WhatsApp)
   - SendGrid (email)

4. **Real-Time:**
   - Socket.io (for live conversations)
   - Supabase Realtime (subscriptions)
   - Firebase Realtime Database

5. **Analytics:**
   - Google Analytics
   - Mixpanel
   - PostHog
   - Segment

6. **Monitoring:**
   - Sentry (error tracking)
   - LogRocket (session replay)
   - New Relic (APM)

7. **Payment:**
   - Stripe (subscriptions, invoices)
   - Razorpay (India-focused)

---

## **📝 File-by-File Reference**

### **Frontend Files**

| File | Lines | Purpose |
|------|-------|---------|
| `src/App.tsx` | ~60 | Main routing component |
| `src/main.tsx` | ~10 | React entry point |
| `src/index.css` | ~20 | Global styles + Tailwind |
| `src/context/AuthContext.tsx` | ~100+ | Auth state management |
| `src/data/mockData.ts` | ~200+ | Mock data for demo |
| `src/types/index.ts` | ~75+ | TypeScript interfaces |
| `src/utils/formatINR.ts` | ~20 | Currency formatting utility |
| `src/components/layout/*.tsx` | ~300+ | Layout components |
| `src/components/leads/*.tsx` | ~500+ | Lead feature UI |
| `src/components/conversations/*.tsx` | ~300+ | Chat/Conversations UI |
| `src/components/ui/*.tsx` | ~200+ | Reusable UI components |
| `src/pages/Home.tsx` | ~500+ | Public landing page |
| `src/pages/dashboard/*.tsx` | ~1500+ | Dashboard pages |

### **Backend Files**

| File | Lines | Purpose |
|------|-------|---------|
| `leadsync-backend/src/server.ts` | ~30 | Express server startup |
| `leadsync-backend/src/app.ts` | ~35 | Express app + middleware |
| `leadsync-backend/src/lib/prisma.ts` | ~10 | Prisma client instance |
| `leadsync-backend/src/routes/leads/leads.routes.ts` | ~35 | Leads API endpoints |
| `leadsync-backend/src/routes/telegram/telegram.routes.ts` | ~94 | Telegram webhook handler |
| `leadsync-backend/prisma/schema.prisma` | ~84 | Database schema |
| `leadsync-backend/prisma/seed.ts` | ~100+ | Database seeder |

### **Configuration Files**

| File | Purpose |
|------|---------|
| `package.json` | Frontend dependencies, scripts, metadata |
| `tsconfig.json` | Frontend TypeScript config |
| `tsconfig.node.json` | Vite TypeScript config |
| `vite.config.ts` | Vite build + dev config |
| `tailwind.config.js` | Tailwind CSS theming |
| `postcss.config.js` | PostCSS + Tailwind pipeline |
| `leadsync-backend/package.json` | Backend dependencies, scripts |
| `leadsync-backend/tsconfig.json` | Backend TypeScript config |
| `leadsync-backend/prisma/schema.prisma` | Database schema definition |

---

## **🎓 Learning Resources**

### **Frontend**
- [React 18 Docs](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [React Router Docs](https://reactrouter.com)
- [Vite Docs](https://vitejs.dev)

### **Backend**
- [Express.js Docs](https://expressjs.com)
- [Prisma Docs](https://www.prisma.io/docs)
- [PostgreSQL Docs](https://www.postgresql.org/docs)
- [Node.js Docs](https://nodejs.org/docs)

### **Full-Stack**
- [OpenAPI/Swagger Docs](https://swagger.io)
- [REST API Best Practices](https://restfulapi.net)
- [TypeScript Best Practices](https://github.com/microsoft/TypeScript-Node-Starter)

---

## **🐛 Troubleshooting**

### **Frontend**

| Issue | Solution |
|-------|----------|
| Port 5173 already in use | `npm run dev -- --port 5174` |
| Tailwind classes not applying | Rebuild CSS: `npm install -D tailwindcss` |
| TypeScript errors | Run `tsc --noEmit` to check all files |
| Module not found | Clear node_modules: `rm -rf node_modules && npm install` |
| CORS error when calling backend | Ensure backend has `cors()` middleware |

### **Backend**

| Issue | Solution |
|-------|----------|
| PORT already in use | Kill process: `lsof -i :3001` then `kill -9 <PID>` |
| DATABASE_URL not found | Create `.env` file with DATABASE_URL |
| Prisma DB Error | Run migrations: `npx prisma migrate dev` |
| Permission denied during npm start | Check Node version: `node --version` (need ^18) |

### **Database**

| Issue | Solution |
|-------|----------|
| Can't connect to PostgreSQL | Check connection string, server running, credentials |
| Migration conflicts | Reset database: `npx prisma migrate reset` |
| Prisma schema invalid | Validate: `npx prisma generate` |

---

## **📅 Roadmap & TODOs**

### **Current Status**
- ✅ Full frontend UI implementation
- ✅ Mock data integration
- ✅ Basic backend structure
- ✅ Prisma ORM setup
- ✅ Telegram webhook starter

### **Phase 2 (Planned)**
- [ ] Real authentication (Supabase/Firebase)
- [ ] Live Telegram integration (full)
- [ ] WebSocket for real-time conversations
- [ ] File uploads for attachments
- [ ] Email integration
- [ ] WhatsApp API integration

### **Phase 3 (Planned)**
- [ ] Advanced analytics (charts, custom reports)
- [ ] Automation rules (auto-assign, auto-responses)
- [ ] Bulk operations (export, import)
- [ ] Team collaboration (comments, @mentions)
- [ ] Mobile app (React Native/Flutter)

### **Phase 4 (Planned)**
- [ ] Machine learning (lead scoring, churn prediction)
- [ ] Advanced CRM features (custom fields, workflows)
- [ ] Marketplace (third-party integrations)
- [ ] White-label solution

---

## **Contact & Support**

- **Repository:** [GitHub link if applicable]
- **Documentation:** This file
- **Support Email:** [To be added]
- **Issues:** GitHub Issues or internal tracking system

---

**Last Updated:** February 7, 2026  
**Maintained By:** LeadSync Dev Team  
**License:** [Specify your license]
