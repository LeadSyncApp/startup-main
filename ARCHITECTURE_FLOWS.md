# LeadSync CRM - Architecture & Flow Diagrams

---

## 🏛️ System Architecture (High Level)

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER / FRONTEND                       │
│                  (React 18 + TypeScript + Tailwind)             │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Pages/       │  │ Components/  │  │ Context/     │          │
│  │ Routes       │  │ UI Logic     │  │ State        │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                  │
│         └─────────────────┴─────────────────┘                  │
│                           │                                     │
│         ┌─────────────────▼─────────────────┐                 │
│         │   API Calls (Fetch / Axios)       │                 │
│         │   Authorization: Bearer JWT       │                 │
│         └─────────────────┬─────────────────┘                 │
└─────────────────────────────┼───────────────────────────────────┘
                              │
                    HTTP/HTTPS (REST API)
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND / API SERVER                        │
│            (Node.js + Express + TypeScript)                     │
│                     Running on Port 4000                        │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Routes/      │  │ Middleware/  │  │ Services/    │          │
│  │ Controllers  │  │ Auth Logic   │  │ Integration  │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                  │
│         └─────────────────┴─────────────────┘                  │
│                           │                                     │
│         ┌─────────────────▼─────────────────┐                 │
│         │      Prisma ORM                   │                 │
│         │  (Database Client & Migrations)   │                 │
│         └─────────────────┬─────────────────┘                 │
└─────────────────────────────┼───────────────────────────────────┘
                              │
                    SQL Queries
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE (PostgreSQL)                         │
│                                                                  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐   │
│  │ Companies   │ │ Users       │ │ Leads / Conversations  │   │
│  │ (Tenants)   │ │ (Agents)    │ │ / Messages             │   │
│  └─────────────┘ └─────────────┘ └─────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔀 Multi-Tenant Data Flow

```
Admin User (Company A) logs in
  ↓
JWT Token: { userId: 'user1', companyId: 'co1', ... }
  ↓
Stored in Frontend localStorage
  ↓
API Request to GET /api/leads
  Header: Authorization: Bearer <JWT>
  ↓
Backend Middleware (auth.middleware.ts)
  1. Verify JWT signature
  2. Extract companyId from JWT
  ↓
Backend Route Handler (leads.routes.ts)
  1. Validate JWT
  2. Build Prisma query WITH companyId filter:
     ```
     prisma.lead.findMany({
       where: { companyId: 'co1' }  ← CRITICAL
     })
     ```
  ↓
Database returns only Company A's leads
  ↓
Frontend receives response
  ↓
User sees only their company's data
  ✅ Data isolation enforced at multiple layers
```

---

## 🔐 Authentication Flow (Detailed)

```
SIGNUP FLOW:
━━━━━━━━━━━━

Frontend (Signup.tsx)
  ↓ User enters: companyName, name, email, password
  ↓
POST /api/auth/signup
{
  "companyName": "My Business",
  "name": "John Doe",
  "email": "john@business.com",
  "password": "securePassword123"
}
  ↓
Backend (auth.routes.ts)
  1. Validate input
  2. Check if email already registered (unique per company assumed)
  3. Create Company: { name: "My Business" }
  4. Hash password using bcryptjs
  5. Create User: { email, name, passwordHash, companyId, role: 'OWNER' }
  ↓
Backend generates JWT:
{
  userId: 'user-uuid-123',
  companyId: 'company-uuid-456',
  email: 'john@business.com',
  role: 'OWNER',
  iat: 1707459600,
  exp: 1707546000
}
  ↓
Response: { user, company, token }
  ↓
Frontend (AuthContext.tsx)
  1. Stores token in localStorage
  2. Updates AuthContext: { user, company, companyId }
  3. Redirects to /dashboard
  ✅ User logged in


LOGIN FLOW:
━━━━━━━━━━

Frontend (Login.tsx)
  ↓ User enters: email, password
  ↓
POST /api/auth/login
{
  "email": "john@business.com",
  "password": "securePassword123"
}
  ↓
Backend (auth.routes.ts)
  1. Find User by email
  2. Compare password hash using bcryptjs
  3. If mismatch → return 401 Unauthorized
  4. Generate JWT with userId + companyId
  ↓
Response: { user, company, token }
  ↓
Frontend stores in localStorage + AuthContext updates
  ✅ User logged in


PROTECTED API CALL:
━━━━━━━━━━━━━━━━

Frontend API Call
GET /api/leads
  Header: { Authorization: "Bearer <JWT>" }
  ↓
Backend Middleware (auth.middleware.ts)
  1. Extract JWT from Authorization header
  2. Verify JWT signature using JWT_SECRET
  3. If invalid → return 401 Unauthorized
  4. If valid → Extract userId + companyId from JWT
  5. Attach to req.user: { userId, companyId }
  ↓
Route Handler
  1. Access req.user.companyId
  2. Build query: { where: { companyId: req.user.companyId } }
  3. Return filtered results
  ✅ Data safely scoped
```

---

## 📨 Telegram Webhook Integration Flow

```
TELEGRAM MESSAGE RECEIVED:
═══════════════════════════════════════════════════════════════════

Telegram User sends message to bot
  ↓
Telegram API receives message
  ↓
Telegram API → POST /api/telegram/webhook
{
  "update_id": 123456789,
  "message": {
    "message_id": 1,
    "date": 1707459600,
    "text": "Hi, I'm interested in your product",
    "from": {
      "id": 456789,
      "is_bot": false,
      "first_name": "John",
      "username": "johndoe"
    },
    "chat": {
      "id": 456789,
      "type": "private",
      "first_name": "John"
    }
  }
}
  ↓
Backend (telegram.webhook.ts)
  1. Extract X-Telegram-Bot-API-Secret-Token from header
  2. Verify token matches TELEGRAM_WEBHOOK_SECRET (stored in env)
  3. If mismatch → return 403 Forbidden
  4. Parse message body
  ↓
Backend (telegram.webhook.ts) continued
  1. Extract contact info from Telegram user:
     contact = `john_456789` or parse phone/email if available
  2. Extract companyId from webhook metadata or Telegram bot config
  3. prisma.lead.upsert({
       where: { contact_channel_companyId: unique },
       update: { ... },
       create: {
         name: "John",
         contact: "john_456789",
         channel: "TELEGRAM",
         companyId: "co1"
       }
     })
  ↓
Lead created or fetched
  ↓
Backend (telegram.webhook.ts) continued
  4. prisma.conversation.upsert({
       where: { leadId_companyId: unique },
       create: {
         leadId: lead.id,
         companyId: "co1",
         channel: "TELEGRAM",
         mode: "BOT"  ← Start in bot mode
       }
     })
  ↓
Conversation created or fetched
  ↓
Backend (bot.logic.ts)
  1. Check conversation.mode
  2. If BOT mode:
     - Generate auto-response:
       "Thanks for contacting us! An agent will respond shortly."
  3. If HUMAN mode:
     - Notify agent in dashboard (WebSocket or polling)
  ↓
Backend (telegram.sender.ts)
  1. Call Telegram Bot API:
     POST https://api.telegram.org/bot{TOKEN}/sendMessage
     {
       "chat_id": 456789,
       "text": "Thanks for contacting us! An agent will respond shortly."
     }
  ↓
Telegram API sends response to user
  ↓
Backend (telegram.webhook.ts) - Store message
  1. prisma.message.create({
       content: "Hi, I'm interested in your product",
       sender: "CLIENT",
       conversationId: conv.id
     })
  ↓
Frontend (Dashboard - Conversations)
  1. Agent sees new lead appeared
  2. Agent clicks on lead
  3. Sees incoming message in ChatPanel
  4. Agent can respond (switches mode to HUMAN if needed)
  5. Response sent via POST /api/conversations/:id/messages
  ↓
Agent's Response Flow:
  Backend receives message
  prisma.message.create({
    content: "Agent response",
    sender: "AGENT",
    conversationId: conv.id
  })
  Backend (telegram.sender.ts) sends to Telegram
  Telegram user receives agent's message
  ✅ Full conversation established
```

---

## 📄 Lead Creation Flow (Frontend to Backend)

```
Frontend Component: LeadDetailModal.tsx or LeadsTable.tsx
════════════════════════════════════════════════════════════════════

User fills form:
  - Name: "Alice Johnson"
  - Email: "alice@company.com"
  - Phone: "+91-9876543210"
  - Source: "website"
  - Priority: "high"
  
User clicks "Create Lead"
  ↓
Form validation (frontend)
  ✓ Name not empty
  ✓ Email format valid
  ↓
useAuth() hook gets companyId from AuthContext
  ↓
Fetch POST /api/leads
{
  "name": "Alice Johnson",
  "email": "alice@company.com",
  "phone": "+91-9876543210",
  "source": "website",
  "priority": "high",
  "companyId": "co1"
}
Header: { Authorization: "Bearer <JWT>" }
  ↓
Backend: leads.routes.ts → POST /api/leads handler
  1. auth.middleware authenticates JWT
  2. Extract req.user.companyId: "co1"
  3. Validate request body
  4. Call leadService.createLead()
  ↓
Backend: leadService.createLead()
  1. prisma.lead.create({
       name: "Alice Johnson",
       email: "alice@company.com",
       phone: "+91-9876543210",
       source: "website",
       priority: "high",
       companyId: "co1"  ← MUST include company
     })
  ↓
Database: INSERT INTO leads (...)
  ↓
Response: { id, name, email, source, priority, companyId, createdAt }
  ↓
Frontend receives response
  ↓
Frontend: LeadsTable.tsx
  1. Add new lead to state.leads array
  2. Re-render table with new row
  3. Show success toast: "Lead created successfully"
  ↓
User sees new lead in table
  ✅ Lead successfully created and filtered to company
```

---

## 🏪 Conversation Message Exchange

```
Agent in Dashboard → ChatPanel → Sends Message
════════════════════════════════════════════════════════════════════

Agent types: "Hi Alice! Thanks for your interest. How can I help?"
  ↓
Clicks "Send" button
  ↓
Frontend: ChatPanel.tsx
  POST /api/conversations/{conversationId}/messages
  {
    "content": "Hi Alice! Thanks for your interest. How can I help?",
    "sender": "AGENT"
  }
  ↓
Backend: conversations.routes.ts
  1. Authenticate JWT (get req.user.companyId)
  2. Verify conversation exists and belongs to user's company
  3. Call messageService.createMessage()
  ↓
Backend: messageService.createMessage()
  1. prisma.message.create({
       content: "Hi Alice! Thanks for your interest. How can I help?",
       sender: "AGENT",
       conversationId: "{conversationId}"
     })
  ↓
Database: INSERT INTO messages (...)
  ↓
Response: { id, content, sender, createdAt }
  ↓
Backend: If Telegram channel → Call telegram.sender.send()
  1. Get Telegram chat_id from conversation metadata
  2. POST to Telegram API
  3. Send message to user's Telegram chat
  ↓
Frontend receives response
  ↓
Frontend: ChatPanel updates
  1. Add new message to messages array
  2. Re-render with new message from AGENT
  3. Auto-scroll to bottom
  4. Clear input field
  ↓
Telegram User receives message
  ↓
Agent-Customer conversation continues...
  ✅ Multi-channel messaging established
```

---

## 📊 Revenue Analytics Data Flow

```
User navigates to /dashboard/revenue
════════════════════════════════════════════════════════════════════

Frontend: Revenue.tsx loads
  ↓
Component state default: period = "month"
  ↓
useEffect triggers on mount:
  1. Get currentDate from system
  2. Calculate: 
     - thisMonth: startDate to endDate
     - lastMonth: (startDate - 30 days) to (endDate - 30 days)
  ↓
Fetch mockData (or API when backend ready):
  1. Get all deals where: companyId = user.companyId
  2. Filter by date range
  3. Filter where stage = "closed-won"
  ↓
Calculate KPIs:
  - totalRevenue = sum of all closed deal values
  - dealCount = number of closed deals
  - prevRevenue = sum of last period's deals
  - trendPercent = ((totalRevenue - prevRevenue) / prevRevenue) * 100
  ↓
Build breakdown data:
  1. Group by company: { companyName, totalRevenue, deals[] }
  2. Group by agent: { agentName, totalRevenue, dealCount, avgSize }
  ↓
Frontend: Revenue.tsx renders:
  1. Period toggle (Day / Month / Year)
  2. 3 KPI cards:
     - Total Revenue: ₹500,000 (↑ 12.5%)
     - Closed Deals: 5 deals (↑ 20%)
     - Companies: 3 (no change)
  3. Company-wise table with progress bars
  4. Agent-wise performance table
  5. Chart placeholder (ready for Recharts)
  ↓
When period toggled:
  1. Recalculate dateRange
  2. Filter data again
  3. Recalculate KPIs
  4. Re-render with new data
  ✅ Analytics dashboard working
```

---

## 🏭 Kanban Pipeline (Deals) Data Organization

```
Sales Pipeline at Dashboard
════════════════════════════════════════════════════════════════════

Deals model in mockData (when backend ready: Prisma Deal table):
  - Each deal has:
    * id, name, leadId, agentId, stage, value, companyId, createdAt
    * stage: 'qualified' | 'proposal' | 'negotiation' | 'closed-won' | 'closed-lost'

Frontend: Deals.tsx loads
  ↓
Group deals by stage:
  qualified = [deal1, deal3, deal5]
  proposal = [deal2, deal4]
  negotiation = []
  closed-won = [deal6, deal7]
  closed-lost = []
  ↓
Render 5 columns with collapsible headers:
  ┌─────────────┬──────────┬────────────┬────────────┬────────────┐
  │ Qualified   │ Proposal │ Negotiation│ Closed Won │ Closed Lost│
  │ (3 deals)   │ (2 deals)│ (0 deals)  │ (2 deals)  │ (0 deals)  │
  ├─────────────┼──────────┼────────────┼────────────┼────────────┤
  │ Card: Deal1 │ Card     │            │ Card: Deal6│            │
  │ Name: ...   │ ...      │            │ Value: ₹50K│            │
  │ Value: ₹30K │          │            │            │            │
  └─────────────┴──────────┴────────────┴────────────┴────────────┘
  ↓
Metrics Cards show:
  - Closed Revenue: ₹100K (↑ 15%)
  - Active Deals: 5
  - Avg Deal Size: ₹20K
  ↓
Features:
  - Collapsible columns (click column header)
  - Filter by agent (dropdown)
  - Drag-drop between columns (placeholder - ready)
  ✅ Sales pipeline visualization
```

---

## 🗺️ React Router Structure

```
App.tsx defines routes:

/                  (Public)
  └─ Home.tsx          → Marketing homepage

/login             (Public)
  └─ Login.tsx         → Login form

/signup            (Public)
  └─ Signup.tsx        → Signup form

/dashboard         (Protected by RequireAuth)
  └─ DashboardLayout (wrapper)
     ├─ index:               DashboardHome.tsx
     ├─ leads:              Leads.tsx
     ├─ conversations:      Conversations.tsx
     ├─ deals:              Deals.tsx
     ├─ revenue:            Revenue.tsx
     ├─ reports:            Reports.tsx
     └─ settings:           Settings.tsx

*                  (Wildcard)
  └─ Navigate to /    (404 redirect)
```

---

## 🧩 Component Hierarchy Example (Leads Page)

```
App.tsx (top-level router)
  ├─ <Routes>
  └─ <Route path="/dashboard/leads">
     └─ RequireAuth (auth guard)
        └─ DashboardLayout (layout wrapper)
           └─ Leads.tsx (page container)
              ├─ LeadsTable.tsx (main component)
              │  ├─ Search Input
              │  ├─ Filters (Source, Priority)
              │  ├─ Sort Controls
              │  ├─ Table Rows
              │  │  └─ Each Row → onClick → LeadDetailModal
              │  └─ Pagination Controls
              ├─ LeadDetailModal.tsx (modal when lead clicked)
              │  ├─ Tabs: Details | Notes | Conversations
              │  ├─ Details Tab
              │  │  ├─ Lead info (read-only)
              │  │  └─ Assign Agent (dropdown)
              │  ├─ Notes Tab
              │  │  ├─ Display existing notes
              │  │  └─ Add/Edit notes (editable textarea)
              │  └─ Conversations Tab
              │     └─ ChatPanel.tsx (embedded chat)
              │        ├─ Message list (auto-scroll)
              │        ├─ Timestamps
              │        └─ Send message input
              └─ Toast notifications (global)
```

---

## 📱 Authentication Guard Flow

```
User not logged in tries to access /dashboard
  ↓
React renders: <Route element={<RequireAuth />}>
  ↓
RequireAuth component (src/components/auth/RequireAuth.tsx)
  1. useAuth() hook checks if user is null
  2. localStorage check: is JWT token present?
  ↓
If user = null AND no token:
  → Redirect to /login
  → User sees Login page
  ↓
If user is not null (logged in):
  → Check AuthContext: user, company, companyId set?
  ✓ Yes → Render <Outlet /> (protected route content)
  ✗ No → Try to restore from token
  ↓
Logout flow:
  User clicks "Logout" button
  → AuthContext.logout() clears user + company
  → localStorage token removed
  → Redirect to /login
  ✅ Auth guard working
```

---

## 🔄 State Management Pattern (AuthContext)

```
Context Structure (src/context/AuthContext.tsx):
═════════════════════════════════════════════════════════════════

AuthContextValue {
  user: User | null
    ├─ id: string
    ├─ email: string
    ├─ name: string
    ├─ role: 'OWNER' | 'AGENT'
    └─ companyId: string

  company: Company | null
    ├─ id: string
    └─ name: string

  companyId: string | null
    → Shorthand for company.id

  isLoading: boolean
    → For async operations

  login(userObj, companyObj): void
    → Called after successful auth API response

  logout(): void
    → Clears auth state, user navigates to /login
}

Usage in Components:
  const { user, company, companyId, login, logout } = useAuth();
  
  → Access current user anywhere
  → Filter data by companyId
  → Update auth state after login/signup
  → Trigger logout on button click
```

---

**All flows are designed with multi-tenancy in mind. Every database operation filters by companyId.**
