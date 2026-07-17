# PROJECT AUDIT: LeadSync cCommerce System
*Last Updated: 2026-07-17*

Welcome to the LeadSync codebase! This document is designed for developers joining the project to quickly understand the architecture, tech stack, implementation status, and recent engineering decisions.

---

## 1. Project Structure Overview

LeadSync is split into a multi-tenant backend built with Express and Prisma, and a responsive frontend React dashboard built with Vite.

```
startup/
├── PROJECT_AUDIT.md                 # This audit document
├── TASK_PROGRESS.md                 # Temporary task scratchpad
├── leadsync-backend/                # Node.js Express backend
│   ├── prisma/                      # Prisma schema and migration history
│   │   ├── schema.prisma            # Master database schema
│   │   └── migrations/              # Database migration SQL files
│   ├── scripts/                     # Operational scripts (seed, backup, etc.)
│   └── src/
│       ├── adapters/                # Multi-channel integrations (Telegram, WhatsApp, Instagram)
│       ├── controllers/             # Webhook and registration controllers
│       ├── interfaces/              # Shared messaging types and provider interfaces
│       ├── lib/                     # Core utilities (prisma.ts client, socket.ts, tenantDb.ts)
│       ├── middleware/              # Auth, error, and tenant isolation middlewares
│       ├── routes/                  # Express routes (grouped: auth/, core/, bot/, webhooks/)
│       ├── services/
│       │   ├── ai/                  # LLM clients (Groq, Gemini), language detection (Sarvam)
│       │   ├── automation/          # Rule-matching logic, auto-replies, cold lead cron jobs
│       │   ├── infrastructure/      # pg-boss job runners, cache, notifications
│       │   ├── knowledge/           # rule/product embedding generators & retrievers
│       │   ├── messaging/           # Telegram sender and long-polling engines
│       │   └── workflow/            # Order creation intake, state machine transitions
│       ├── app.ts                   # Express app configuration and middleware registry
│       └── server.ts                # App bootstrapper, socket server, Telegram polls
│
└── leadsync-frontend/               # React Vite client dashboard
    ├── index.html                   # HTML entrypoint
    ├── tailwind.config.js           # TailwindCSS configuration
    ├── src/
    │   ├── App.tsx                  # Main router, route guards, and socket client
    │   ├── api/                     # API client wrapper (authedFetch)
    │   ├── components/              # Shared UI components (layouts, onboarding, tour)
    │   ├── lib/                     # Permissions matrix and Socket.IO client connection
    │   ├── simulation/              # Simulated demo player, scenes, and mock state stores
    │   └── features/                # Domain-focused feature modules
    │       ├── activity-ledger/     # Live activity logging and notifications
    │       ├── ai-orchestration/    # Instruction configurations
    │       ├── audience-crm/        # Lead listings and CRM profiles
    │       ├── auth-tenancy/        # Signup/onboarding contexts and auth wrappers
    │       ├── broadcast/           # Segmented template broadcasts
    │       ├── configurations/      # Connections hubs, configurations, auto-reply rules
    │       ├── dashboard/           # Sales analytics, pulse graphs, KPI rollups
    │       ├── inbox/               # Live chat inbox (Split-view, detail, product picker)
    │       ├── inventory/           # Free-text product intake and variants confirmation
    │       ├── notifications/       # Real-time staff notifications
    │       ├── orders/              # Order status fulfillment board
    │       └── stream-triage/       # Multi-channel intake workbench & inbox queue
```

---

## 2. Tech Stack

### Backend
- **Runtime & Language**: Node.js (CommonJS package type), TypeScript (`ts-node-dev` for development, `tsc` for build compilation)
- **Web Framework**: Express
- **Real-Time Communication**: Socket.IO (`socket.io`, `@socket.io/postgres-adapter` for scaling across processes)
- **Database & ORM**: PostgreSQL (hosted on Supabase) via Prisma ORM (Version **6.19.2**)
- **Vector Search**: pgvector (`Unsupported("vector")`) for normalized embeddings
- **Background Jobs**: pg-boss (Version **10.1.3**) using native PostgreSQL queues for async tasks (webhook ingestion, PDF generation)
- **Authentication**: JWT/Custom session authorization with `bcryptjs` and `jsonwebtoken`, combined with Google OAuth2 (`passport-google-oauth20`)
- **Third-Party AI APIs**:
  - **Groq API**: `llama-3.3-70b-versatile` (Primary model for fast, structured JSON intent classification, order extraction, and shop replies)
  - **Google Generative AI**: Gemini (Backup model)
  - **Sarvam AI**: `text-lid` API for Indian language code detection (with fallback script ranges), and `translate` API
  - **Xenova Transformers**: Local embedding model (`Xenova/multilingual-e5-small`) generating 384-dimensional normalized vectors
- **Integrations**: Telegram Bot API, Meta WhatsApp/Instagram Graph APIs
- **Document Utilities**: `pdfkit` (PDF invoice creation), `exceljs` (data export)

### Frontend
- **Framework**: React (v18.3.1)
- **Build Tool**: Vite (v7.3.1)
- **Styling**: TailwindCSS (v3.4.15) with PostCSS
- **State Management**: Zustand (v5.0.14) with localStorage persistence
- **Routing**: React Router DOM (v6.28.0)
- **Animations**: Framer Motion (v10.12.16)
- **Charting**: Recharts (v2.6.2)
- **Networking**: Axios, Socket.IO Client (v4.8.3)
- **Utilities**: Lucide React (icons), Headless UI, React Virtual (virtualized scroll list), React Hot Toast

---

## 3. Core Features & Status

### Inbox & Conversation System
- **My Chats (HUMAN Mode)**: Staff take manual control of threads. Socket.IO broadcasts incoming messages instantly to the workbench. Supports quick-replies, manual notes, and toggling back to AI mode.
- **New Customers / Triage Queue (BOT Mode)**: Inbound messages are processed by background pg-boss workers. Real-time triaging flags client intents (Checkout vs. Query vs. Support). Cold threads are swept by the "Ghost Reaper" worker every 15 minutes.
- **Status**: **Fully Implemented**. Real-time updates occur via Socket.IO events (`conversation:new`, `new_message`, `conversation_updated`).

### AI Auto-Reply & RAG Product Matching
- **Conversational Auto-Replies**: Evaluates inbound messages in BOT mode. Uses local Xenova embeddings and `pgvector` cosine similarity (`<=>`) to match queries against rules in the `KnowledgeChunk` table.
- **Product Grounding**: For customer queries matching catalog patterns, it retrieves matching product information from the database to inject into the LLM context envelope.
- **Status**: **Fully Implemented**. Employs a strict **confidence-gap logic** (minimum score difference of 0.04 between the top and second-best matched rules) to prevent false-positive matches. If only one rule exists, it defaults to the LLM (no confident gap path).

### Automation Flows
- **AI Instructions**: Business-specific guidelines compile dynamically into prompt envelopes (`<MerchantRules>`) to guide the assistant's persona.
- **Event Auto-Replies**: Rules trigger automatically on order lifecycle updates (e.g., `lead.welcome`, `order.placed`, `order.status.changed`). Includes custom delay overrides (VIP: 60 min, Regular: default, New: 24h, Churn Risk: 0 min).
- **Status**: **Fully Implemented**. Backed by pg-boss queues for delayed/scheduled deliveries.

### Inventory Management
- **Intake Engine**: Support for copy-pasted freeform text blocks. The AI parses unstructured text into structured products, categories, base prices, attributes, and variants.
- **Confirmation Screen**: Interactive card UI in the frontend allowing staff to edit parsed items and add attribute values (like Size or Color) before committing to the database.
- **Status**: **Fully Implemented** for Retail, Restaurant, and Services verticals.

### Orders, Payment, & Invoice Generation
- **Order Generation**: Created manually by agents or automatically parsed from checkout intents by the AI.
- **Payment Link Generation**: Integrates Razorpay payment links. Features offline backup UPI-pay link generation (`upi://pay`) utilizing the merchant's configured UPI details.
- **Invoice PDF**: Razorpay paid webhooks trigger background pdfkit jobs to compile invoices, upload them, and broadcast PDFs to conversation threads.
- **Status**: **Partially Built / Work in Progress** (see Incomplete Items below).

### Notifications System
- **Backend Alerts**: Real-time staff notifications for new leads, pending order arrivals, escalations, and SLA violations persist in the `Notification` table.
- **Frontend Toasts**: Uses Socket.IO listeners (`onNotification`) to trigger animated toast alerts dynamically on the staff workbench.
- **Status**: **Fully Implemented**.

### Broadcast & Customers Pages
- **Broadcasts**: Send bulk messages to leads filtered by segments (NEW, REGULAR, VIP, CHURN_RISK) or tags.
- **Customers**: Audiences view listing customer spend profiles, priority rankings, and custom fields.
- **Status**: **Fully Implemented**.

---

## 4. Known Incomplete, Broken, or Stubbed Items

> [!WARNING]
> Please review and resolve these outstanding issues before pushing to production:

1. **Order Confirmation Flow Looping**: The order confirmation intake flow currently loops/retries simulator states in some scenarios instead of successfully committing a real order to the database. (Under investigation).
2. **Orders Page Payment Link Generation**: The Orders page (`OrderFulfillmentBoard.tsx`) **does not** contain any payment-link generation UI. Catalog-based UPI payment requests are generated from the Inbox/Chat page via `ProductPickerModal` (which generates markdown product card payloads for the chat) or through the backend `/api/orders/payment-request` API.
3. **Webhook Ingestion Completeness**: `webhook.routes.ts` lacks a generic `/api/webhook/message` gateway endpoint for general inbound APIs, containing only the Razorpay handler. Telegram webhooks route separately through `telegram.controller.ts`.
4. **Dead Code Variables**: The `SINGLE_RULE_MIN_SCORE` environment variable is defined in the auto-reply service code but is never used in the matching logic.
5. **Rule Hour/Date Range Migrations**: The `ConversationalRule` schema contains `hourRange` and `dateRange` GIN-indexed JSON fields, but the corresponding database migration `20260708000000_split_timeRange` is not fully applied or verified in all developer environments.
6. **Product Embedding Service**: The `KnowledgeChunk` enum includes the `PRODUCT` type, but no active background service writes catalog product vector embeddings to the database yet.
7. **Rule Group Activation Control**: The `RuleGroup` model has an `isEnabled` field, but the backend API has no batch activation/deactivation endpoints implemented.
8. **Missing Internal Note References**: The `company.routes.ts` file contains fallback comments (`TODO: internalNote model removed from schema`) because some endpoints attempt to query notes that were removed or changed.

---

## 5. Database Schema Summary

We utilize a multi-tenant PostgreSQL schema scoped by a `companyId` foreign key. Key entities and relationships include:

```mermaid
erDiagram
    Company ||--o{ User : employs
    Company ||--o{ Lead : manages
    Company ||--o{ Conversation : registers
    Company ||--o{ Order : processes
    Company ||--o{ Product : catalog
    Company ||--o{ KnowledgeChunk : embeds
    Company ||--o{ Invoice : bills
    
    Lead ||--o{ Conversation : participates
    Lead ||--o{ Order : places
    
    Conversation ||--o{ Message : contains
    Conversation ||--o{ Order : links
    Conversation ||--o{ RuleDecisionLog : logs
    Conversation ||--o{ ConversationActivity : tracks
    
    Order ||--o| Invoice : generates
    Order ||--|{ OrderItem : details
    Order ||--o{ OrderLog : audits
    
    Product ||--o{ OrderItem : references
```

### Key Models Defined:
- **`Company`**: Represents the tenant (merchant) including API tokens (Telegram/Instagram/WhatsApp), business hours, custom OOO replies, currency symbols, and UPI addresses.
- **`User`**: Merchant staff and owners. Supports roles (`OWNER`, `MANAGER`, `STAFF`) and availability tracking.
- **`Lead`**: Customer profile. Tracks tags, total spending, language preferences, channel of entry, and priority levels.
- **`Conversation`**: Channels threads (Telegram, Instagram, WhatsApp, Website) in `BOT` or `HUMAN` mode, assigned staff, and resolution states.
- **`Message`**: Content records with delivery statuses (`PENDING`, `SENT`, `FAILED`) and sender assignments (`CLIENT`, `AGENT`, `SYSTEM`, `BOT`).
- **`Product` & `InventoryProduct`**: SKU-level and template-level catalogs containing pricing, cost of goods sold (COGS), categories, and stock quantities.
- **`Order` & `OrderItem`**: Transactions mapping items, COGS, profit, priority scores, and statuses (`NEW`, `PENDING`, `PAID`, `SHIPPED`, `DELIVERED`).
- **`KnowledgeChunk`**: Vector embeddings containing serialized rules, FAQs, or policies for pgvector retrieval.
- **`RuleDecisionLog`**: Real-time evaluation log showing top scores, gap calculations, and routing choices for full observability.

---

## 6. Environment & Local Setup

### Required Environment Variables (.env)
Copy these to `leadsync-backend/.env` (modify credentials as required):
```bash
# PostgreSQL DB connections (direct connection overrides PgBouncer to prevent client crashes)
DATABASE_URL="postgresql://username:password@pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true"
DIRECT_URL="postgresql://username:password@pooler.supabase.com:5432/postgres?sslmode=require"

# AI Integrations
GROQ_API_KEY="gsk_..."
GEMINI_API_KEY="AIzaSy..."
SARVAM_API_KEY="sk_..."

# Messaging channels
TELEGRAM_BOT_TOKEN="8552408439:AA..."
TELEGRAM_POLLING=true

# Security & Sessions
JWT_SECRET="your-secret-key"
ENCRYPTION_KEY="64-character-hex-string"

# Mail dispatch
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="name@gmail.com"
SMTP_PASS="app-password"

# Configuration
PROCESS_PROFILE="COMBINED" # Options: COMBINED, WORKER, WEB
```

### Running Locally

> [!IMPORTANT]
> The database client generation requires PowerShell execution policy bypasses on Windows environments.

1. **Backend Setup**:
   ```powershell
   cd leadsync-backend
   npm install
   # Generates tenant-scoped Prisma client
   npm run db:client
   # Start dev server (ts-node-dev)
   npm run dev
   ```
2. **Frontend Setup**:
   ```bash
   cd leadsync-frontend
   npm install
   npm run dev
   ```
3. **Database Migrations**:
   If schema changes occur:
   ```bash
   npx prisma migrate deploy
   ```

### Known Gotchas & Commands:
- **PgBouncer Transactions**: Always configure `DIRECT_URL` for schema migrations to avoid pgbouncer transactions errors.
- **Do Not Run `git add .`**: The repo uses custom hooks and files that should not be mass-added. Add modified files explicitly.
- **Windows PowerShell**: Running client generator scripts on Windows requires `-ExecutionPolicy Bypass`.
- **OrderItem and InventoryProduct Dual-Table Gap (High Priority Fix Needed)**: The `OrderItem.productId` field references the old, legacy `Product` table rather than the new `InventoryProduct` table used for active inventory management. This architectural leftover has already caused two critical bugs:
  1. **AI Checkout order creation** (originally threw `OrderItem_productId_fkey` constraint violation trying to write `InventoryProduct` ID to `Product` ID).
  2. **Payment request generation** (failed because it queried the legacy `Product` table for catalog products instead of `InventoryProduct` and `InventoryVariant`).
  Both have been patched with the temporary workaround of setting `productId: null` in `OrderItem` records. This creates a broken/missing link between orders and active catalog products, which will distort product performance reporting. It is strongly recommended to consolidate the schemas by migrating `OrderItem.productId` to reference `InventoryProduct` instead of continuing to patch around it.
- **Manually Applied SQL Migrations (Prisma Schema Match)**: Two columns exist in the live database that were manually applied outside of standard Prisma migrations: `clientMessageId` and `deliveryError`. These columns are not recorded in the `prisma/migrations/` history, meaning the local migration history will not fully match the live DB schema representation.

---

## 7. Recent Architectural Decisions

### Tenant Isolation Middleware Pattern
To secure tenant boundaries, we leverage a dynamic, recursive Prisma extension (`leadsync-backend/src/lib/prisma.ts`):
- **scoping utility**: Automatically scopes queries on all tenant models by appending `companyId = tenantId` constraints to read and write operations.
- **Bypass List**:
  - Whitelisted tables: `Company`, `Idempotency`, `InventoryVariant`, `PostalPincodeIndex` (stored in `GLOBAL_SYSTEM_TABLES` as they contain no `companyId` or represent global indices).
  - Whitelisted operations: `findMany`, `createMany`, `deleteMany`, `updateMany`, `count`.
  - Whitelisted queries matching specific primary/secondary keys like `where.id`, `where.email`, `where.conversationId`, or `where.tokenLookup`.
- **Gotcha**: If you perform a query on a tenant table without checking by ID and without supplying `companyId` context (or passing an operation not whitelisted), the system triggers a **Mandatory Tenancy Breach** and throws a `403 Forbidden` error.

### Business-Type Schema-Per-Vertical
- LeadSync supports customized workflows for **Retail**, **Restaurant**, and **Services** templates using the `Company.businessType` field.
- The backend switches menu structures (`BotConfiguration.botStructuredMenu`) and inventory tables depending on the vertical, enabling restaurant tables to compile menus while services vertical compiles service packages.

### RAG Chunk Separation by SourceType
- All embeddings are mapped in the `KnowledgeChunk` table.
- Separation by `sourceType` (`RULE`, `PRODUCT`, `POLICY`, `MANUAL`) allows pgvector queries to run scoped searches (e.g., matching only rules in `conversationalAutoReply.service.ts` or matching only inventory catalog items in `retrieveProductChunks`). This keeps search spaces narrow and prevents false crossovers.

---
