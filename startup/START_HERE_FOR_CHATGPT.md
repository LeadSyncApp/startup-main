# LeadSync CRM - Start Here! 🚀

**For ChatGPT & AI Assistants**

This document gets you started with understanding the LeadSync CRM project in the quickest way possible.

---

## 📚 Documentation Reading Order

**Read these documents in order:**

1. **START HERE** → `CHATGPT_QUICK_REFERENCE.md` (2 min read)
   - Quick overview of the entire project
   - Tech stack summary
   - File structure at a glance

2. **Understand Architecture** → `ARCHITECTURE_FLOWS.md` (5 min read)
   - How data flows from frontend to backend
   - Authentication flow
   - Multi-tenancy pattern
   - Example API calls

3. **Dive Deep** → `COMPREHENSIVE_PROJECT_GUIDE.md` (15 min read)
   - Complete feature breakdown
   - Database schema details
   - Every component explained
   - Development workflows

4. **File Reference** → `COMPLETE_FILE_STRUCTURE_GUIDE.md` (lookup as needed)
   - Where every file is located
   - What each file does
   - How to find something
   - How to add new features

---

## 🎯 30-Second Project Overview

**LeadSync CRM** is a full-stack SaaS lead management platform:

```
┌─────────────────────────────────────────────────┐
│ FRONTEND (React 18 + TypeScript)                │
│ - Dashboard with leads, conversations, deals    │
│ - Multi-tenant UI (company switcher)            │
│ - Runs on port 5173                             │
└──────────────┬──────────────────────────────────┘
               │ HTTP/REST API
               ▼
┌──────────────────────────────────────────────────┐
│ BACKEND (Express + TypeScript)                   │
│ - JWT authentication                            │
│ - Lead/Conversation/Deal APIs                   │
│ - Telegram webhook integration                  │
│ - Runs on port 4000                             │
└──────────────┬──────────────────────────────────┘
               │ SQL Queries
               ▼
┌──────────────────────────────────────────────────┐
│ DATABASE (PostgreSQL + Prisma)                   │
│ - Companies, Users, Leads                       │
│ - Conversations, Messages                       │
│ - Multi-tenant data isolation                   │
└──────────────────────────────────────────────────┘
```

**Key Principle**: All data is scoped by `companyId` (multi-tenant)

---

## 🏗️ Project Structure (Simplified)

```
LeadSync CRM
├── Frontend (src/) ← React + Tailwind
│   ├── components/ - Reusable UI pieces
│   ├── pages/ - Full page views
│   ├── context/ - Authentication state
│   └── data/ - Mock sample data
│
└── Backend (leadsync-backend/src/) ← Express + Prisma
    ├── routes/ - API endpoints
    ├── services/ - Business logic
    ├── middleware/ - JWT auth
    └── prisma/ - Database schema
```

---

## 🔐 Authentication Flow (Simplified)

```
User logs in
  ↓
Backend generates JWT token (includes userId + companyId)
  ↓
Frontend stores JWT in localStorage
  ↓
Frontend sends JWT with every API request
  ↓
Backend verifies JWT
  ↓
Backend filters data by companyId from JWT
  ↓
✅ Secure, multi-tenant data access
```

---

## 📊 Key Features

| Feature | Frontend | Backend | Status |
|---------|----------|---------|--------|
| Lead Management | ✅ LeadsTable | ✅ /api/leads | Working |
| Conversations | ✅ ChatPanel | ✅ /api/conversations | Working |
| Sales Pipeline | ✅ Deals Kanban | ⏳ APIs | Ready |
| Revenue Analytics | ✅ Dashboard | ⏳ APIs | Frontend done |
| Telegram Bot | ✅ UI | ✅ Webhooks | In progress |
| Settings | ✅ UI | ⏳ APIs | Frontend done |

---

## 🚀 Quick Start (Local Development)

### Terminal 1: Run Frontend
```bash
cd d:\startup
npm install
npm run dev
# Opens http://localhost:5173
```

### Terminal 2: Run Backend
```bash
cd d:\startup\leadsync-backend
npm install
npm run dev
# Opens http://localhost:4000
```

### Check if it's working:
```
Frontend: http://localhost:5173 (see login page)
Backend: http://localhost:4000/health (should say "running 🚀")
```

---

## 🧠 Mental Model to Remember

### For Frontend Developers:
Think of the frontend as a **dashboard connected to mock data**. To connect it:
1. Replace `mockData` calls with API calls
2. Example change:
   ```typescript
   // Before (mock)
   const leads = mockLeads.filter(l => l.companyId === companyId);
   
   // After (API)
   const response = await fetch('/api/leads');
   const leads = await response.json();
   ```
3. The structure stays the same - just swap the data source

### For Backend Developers:
Think of the backend as **endpoint factory for frontend**. Each route:
1. Receives JWT from frontend
2. Extracts userId + companyId from JWT
3. Filters database by companyId (CRITICAL)
4. Returns JSON response
5. Frontend displays it

### For Full-Stack:
Every feature needs:
1. **Frontend UI** (component + state)
2. **Backend API** (endpoint + authentication)
3. **Database** (model + migration)
4. **Integration** (connect all 3)

---

## 🔍 Common Tasks

### "How do I add a new lead field?"

1. **Database** → Edit `leadsync-backend/prisma/schema.prisma`
   ```prisma
   model Lead {
     // ... existing fields
     newField: String?  // Add here
   }
   ```

2. **Migration** → Run `npx prisma migrate dev --name add_new_field`

3. **Frontend Type** → Edit `src/types/index.ts`
   ```typescript
   interface Lead {
     // ... existing fields
     newField?: string;  // Add here
   }
   ```

4. **Frontend UI** → Edit `src/components/leads/LeadDetailModal.tsx`
   ```tsx
   <input value={lead.newField} />
   ```

5. **Frontend Mock Data** → Edit `src/data/mockData.ts`
   ```typescript
   newField: "sample value"
   ```

### "How do I understand what a feature does?"

1. Find the **frontend component** (in `src/pages/` or `src/components/`)
2. Look at the **types** it uses (in `src/types/index.ts`)
3. Find the **mock data** it uses (in `src/data/mockData.ts`)
4. If backend integrated, find the **API endpoint** (in `leadsync-backend/src/routes/`)
5. Look at the **database model** (in `leadsync-backend/prisma/schema.prisma`)

### "I found a bug, where do I raise an issue?"

1. **Frontend bug** (UI doesn't work) → Check `src/components/` and `src/pages/`
2. **Backend bug** (API returns error) → Check `leadsync-backend/src/routes/` and services
3. **Database bug** (data corrupt) → Check `leadsync-backend/prisma/schema.prisma`
4. **Integration bug** (frontend+backend mismatch) → Check types in `src/types/index.ts`

---

## 📁 Must-Know Files

### Frontend
- **`src/App.tsx`** → Routes/Navigation structure
- **`src/context/AuthContext.tsx`** → User state & company context
- **`src/types/index.ts`** → All data types
- **`src/data/mockData.ts`** → Sample data (what you see in frontend)
- **`src/pages/dashboard/Leads.tsx`** → Example page

### Backend
- **`leadsync-backend/src/app.ts`** → Server setup
- **`leadsync-backend/src/routes/auth.routes.ts`** → Login/Signup
- **`leadsync-backend/src/routes/leads/leads.routes.ts`** → Leads API
- **`leadsync-backend/src/middleware/auth.middleware.ts`** → JWT verification
- **`leadsync-backend/prisma/schema.prisma`** → Database models

### Config
- **`package.json`** (both) → Dependencies & scripts
- **`tsconfig.json`** (both) → TypeScript settings
- **`.env`** → Secrets (not in git)

---

## ❓ FAQ for ChatGPT / AI Assistants

**Q: What is multi-tenancy?**  
A: Multiple companies use the same app. Each company only sees their own data. Every database query filters by `companyId`.

**Q: Where is the login form?**  
A: `src/pages/Login.tsx` (frontend), `leadsync-backend/src/routes/auth.routes.ts` (backend)

**Q: How do I see mock data?**  
A: Check `src/data/mockData.ts` — it's used by all frontend components

**Q: Where are all the leads stored?**  
A: In PostgreSQL database. Schema defined in `leadsync-backend/prisma/schema.prisma`

**Q: How do I add a new page?**  
A: 1) Create `.tsx` in `src/pages/`, 2) Add route in `src/App.tsx`, 3) Import components as needed

**Q: How do I create a new API endpoint?**  
A: 1) Add route in `leadsync-backend/src/routes/`, 2) Register in `app.ts`, 3) Add types to `src/types/index.ts`

**Q: How is Telegram integrated?**  
A: Webhook at `/api/telegram/webhook` → receives messages → stores lead → sends auto-response

**Q: What's the difference between mock data and API?**  
A: Mock data is hardcoded in `mockData.ts` for UI development. API calls database for real data.

---

## 🎓 Learning Path

1. **Day 1: Understand Structure**
   - Read the 4 main docs (this folder)
   - Run local dev servers
   - Login with mock data
   - Click around the UI

2. **Day 2: Trace a User Action**
   - Pick a simple action (e.g., "Create Lead")
   - Find frontend code
   - Find backend endpoint (if exists)
   - Find database query
   - Understand full flow

3. **Day 3: Make a Small Change**
   - Add a field to a form
   - See it reflected in UI
   - Update mock data
   - See it work end-to-end (if backend ready)

4. **Day 4+: Build New Features**
   - Understand multi-tenant requirement
   - Always filter by companyId
   - Follow existing patterns
   - Test locally

---

## 🆘 Help & Support

### If you're stuck on a concept:
1. Search in `COMPREHENSIVE_PROJECT_GUIDE.md`
2. Look at `ARCHITECTURE_FLOWS.md` for diagrams
3. Check example code in actual files
4. Trace through an existing feature

### If you're stuck on code:
1. Find the file in `COMPLETE_FILE_STRUCTURE_GUIDE.md`
2. Read the comments in that file
3. Check similar files for patterns
4. Run locally and trace execution

### If you have a question:
1. Is it about architecture? → Read `ARCHITECTURE_FLOWS.md`
2. Is it about a feature? → Search `COMPREHENSIVE_PROJECT_GUIDE.md`
3. Is it about file location? → Search `COMPLETE_FILE_STRUCTURE_GUIDE.md`
4. Is it about code? → Look at the actual file

---

## 🎯 Next Steps

1. **Read** → `CHATGPT_QUICK_REFERENCE.md` (quick overview)
2. **Understand** → `ARCHITECTURE_FLOWS.md` (see the flows)
3. **Deep Dive** → `COMPREHENSIVE_PROJECT_GUIDE.md` (all details)
4. **Reference** → `COMPLETE_FILE_STRUCTURE_GUIDE.md` (when needed)
5. **Run Locally** → `RUNNING.md` (setup instructions)

---

**You are now ready to understand and work with LeadSync CRM!**

**Questions? Search the docs above. Can't find it? Time to read the source code.**

💡 **Pro Tip**: Use `CTRL+F` to search these docs for keywords.

---

*Generated on February 9, 2026*
