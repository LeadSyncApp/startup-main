# LeadSync CRM - Quick Reference Guide

**Last Updated:** February 8, 2026  
**For:** Quick navigation and common tasks

---

## 🚀 Quick Start (5 minutes)

### Prerequisites
- Node.js 18+
- PostgreSQL (or SQLite for dev)

### Setup
```bash
# 1. Install frontend dependencies
npm install

# 2. Install backend dependencies
cd leadsync-backend
npm install
cd ..

# 3. Create backend .env
cat > leadsync-backend/.env << EOF
DATABASE_URL="postgresql://user:pass@localhost:5432/leadsync"
PORT=4000
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
NODE_ENV=development
EOF

# 4. Initialize database
cd leadsync-backend
npx prisma migrate dev
npm run seed  # Creates 2 demo companies + 2 users
cd ..

# 5. Run (2 terminals)
# Terminal 1 (Backend):
cd leadsync-backend && npm run dev
# → Starts on http://localhost:4000
# → CORS configured for http://localhost:5173

# Terminal 2 (Frontend):
npm run dev
# → Opens http://localhost:5173
```

**Access:** Frontend: http://localhost:5173 | Backend: http://localhost:4000

---

## 📁 File Navigation Quick Links

### Frontend Components
- **Layouts:** `src/components/layout/` - DashboardLayout, Sidebar, MarketingNav
- **Leads:** `src/components/leads/` - LeadsTable, LeadDetailModal
- **Chat:** `src/components/conversations/` - ChatPanel
- **Metrics:** `src/components/dashboard/` - SectionSummary
- **UI Kit:** `src/components/ui/` - Modal, Spinner, Toast, ToastContainer

### Frontend Pages
- **Public:** `src/pages/Home.tsx`, `Login.tsx`, `Signup.tsx`
- **Dashboard:** `src/pages/dashboard/` - 7 dashboard pages
- **Routing:** `src/App.tsx`
- **Context:** `src/context/AuthContext.tsx`

### Backend Routes
- **Leads:** `leadsync-backend/src/routes/leads/leads.routes.ts`
- **Telegram:** `leadsync-backend/src/routes/telegram/telegram.routes.ts`
- **App Setup:** `leadsync-backend/src/app.ts`
- **Server:** `leadsync-backend/src/server.ts`

### Database
- **Schema:** `leadsync-backend/prisma/schema.prisma'
- **Seed:** `leadsync-backend/prisma/seed.ts`
- **Client:** `leadsync-backend/src/lib/prisma.ts`

### Configuration
- **Frontend:** `package.json`, `vite.config.ts`, `tailwind.config.js`, `tsconfig.json`
- **Backend:** `leadsync-backend/package.json`, `leadsync-backend/tsconfig.json`

---

## 🎯 Common Tasks

### Add a New Dashboard Page
```bash
# 1. Create page file
touch src/pages/dashboard/MyPage.tsx

# 2. Add TSX content:
export default function MyPage() {
  return <div>My Page</div>;
}

# 3. Add route in App.tsx
<Route path="my-page" element={<MyPage />} />

# 4. Add sidebar link in Sidebar.tsx
```

### Add a New Component
```bash
# 1. Create component file
touch src/components/myfeature/MyComponent.tsx

# 2. Add TSX with exports:
export default function MyComponent(props) {
  return <div>Component</div>;
}

# 3. Import and use in pages
import MyComponent from '../components/myfeature/MyComponent';
```

### Add Backend API Endpoint
```bash
# 1. Create route file
touch leadsync-backend/src/routes/myfeature/myfeature.routes.ts

# 2. Create Router and export:
const router = Router();
router.get('/', async (req, res) => {
  // Handler
});
export default router;

# 3. Mount in app.ts
app.use('/api/myfeature', myfeatureRoutes)

# 4. Access at GET /api/myfeature
```

### Database Changes
```bash
cd leadsync-backend

# 1. Edit schema.prisma
# 2. Create migration
npx prisma migrate dev --name "what_changed"
# 3. Apply to DB
npx prisma db push
# 4. Generate client
npx prisma generate
# 5. Seed if needed
npm run seed
```

### Update Types
```bash
# 1. Edit src/types/index.ts
# 2. Export new interfaces
# 3. Use in components with TypeScript verification
```

---

## 🔧 Development Commands

### Frontend
```bash
npm run dev          # Start Vite dev server
npm run build        # Build for production
npm run lint         # Check code style
npm run preview      # Preview production build
```

### Backend
```bash
cd leadsync-backend
npm run dev          # Start with hot reload
npm run build        # Compile TypeScript
npm run start        # Run compiled JS
npm run seed         # Populate database
npm run ngrok        # Create public tunnel
npm run dev:all      # Dev + ngrok together
```

### Database
```bash
npx prisma studio         # Visual database editor
npx prisma generate       # Generate Prisma client
npx prisma migrate dev    # Create migrations
npx prisma db push        # Push schema changes
npx prisma db pull        # Pull schema from DB
```

---

## 📊 Project Statistics

| Item | Count |
|------|-------|
| Components | 17 |
| Pages | 10 |
| Routes | 2 |
| Database Models | 5 |
| Configuration Files | 8 |
| Documentation Files | 8 |
| **Total Files** | **50+** |

---

## 🎨 Design System

### Colors
```
Primary Blue: #3b82f6
Secondary Cyan: #0ea5e9
Dark Slate: #0f172a
Light Slate: #f1f5f9
```

### Tailwind Breakpoints
```
sm: 640px
md: 768px
lg: 1024px
xl: 1280px
2xl: 1536px
```

### Animations
- Page entrance: 0.5s opacity + Y translate
- Staggered children: 0.05-0.1s stagger
- Scale hover: 1.02-1.05
- Tab transitions: AnimatePresence + fade

---

## 🔑 Environment Variables

### Backend (.env)
```
DATABASE_URL=postgresql://...
PORT=4000
TELEGRAM_BOT_TOKEN=...
NODE_ENV=development
```

### Frontend (.env.local)
```
VITE_API_URL=http://localhost:4000
```

---

## 📚 Documentation Files Location

- **Overview:** [README.md](README.md)
- **Setup Guide:** [RUNNING.md](RUNNING.md)
- **File Structure:** [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)
- **Technical Docs:** [PROJECT_CODEBASE_DOCUMENTATION.md](PROJECT_CODEBASE_DOCUMENTATION.md)
- **File Details:** [FILE_DETAILS.md](FILE_DETAILS.md)
- **File Inventory:** [FILE_INVENTORY.md](FILE_INVENTORY.md)
- **Enhancements:** [ENHANCEMENTS_COMPLETE.md](ENHANCEMENTS_COMPLETE.md)

---

## 🔗 Important URLs

| Service | URL | Details |
|---------|-----|---------|
| Frontend | http://localhost:5173 | Vite dev server |
| Backend | http://localhost:4000 | Express API |
| Database | localhost:5432 | PostgreSQL |
| Dashboard | http://localhost:5173/dashboard | Protected area |
| API Health | http://localhost:4000/health | Health check |

---

## 🐛 Troubleshooting

### Port Already In Use
```bash
# Find process on port 4000
lsof -i :4000  (Mac/Linux)
netstat -ano | findstr :4000  (Windows)

# Kill process
kill -9 <PID>  (Mac/Linux)
taskkill /PID <PID> /F  (Windows)
```

### Database Connection Error
```bash
# Check DATABASE_URL in leadsync-backend/.env
# Verify PostgreSQL is running
# Run migration: npx prisma migrate dev
```

### Prisma Client Issue
```bash
# Regenerate client
npx prisma generate

# Clear cache and reinstall
rm -rf node_modules/.prisma
npm install
```

### Vite Not Loading
```bash
# Clear vite cache
rm -rf node_modules/.vite

# Restart dev server
npm run dev
```

---

## 🚀 Production Deploy Checklist

### Frontend (Vercel)
- [ ] Build: `npm run build` passes
- [ ] No TypeScript errors
- [ ] Environment variables set
- [ ] API URL updated for production
- [ ] Push to Git repo
- [ ] Deploy via Vercel dashboard

### Backend (AWS/Railway/Heroku)
- [ ] Build: `npm run build` passes
- [ ] Database: PostgreSQL production instance
- [ ] Environment variables: DATABASE_URL, PORT, tokens
- [ ] Migrations: `npx prisma migrate deploy`
- [ ] Seed: Optional (production data)
- [ ] Deploy to hosting platform

### Database
- [ ] PostgreSQL production instance
- [ ] Backups configured
- [ ] Connection string secured
- [ ] Migrations applied
- [ ] Indexes created

---

## 📞 Key Contacts

| Role | Action |
|------|--------|
| **Bug Report** | Create GitHub issue |
| **Feature Request** | Create GitHub discussion |
| **Documentation** | Update relevant .md files |
| **Database** | Update schema.prisma |

---

## 🎓 Learning Resources

- React: https://react.dev
- TypeScript: https://www.typescriptlang.org/docs
- Tailwind CSS: https://tailwindcss.com/docs
- Vite: https://vitejs.dev/guide
- Prisma: https://www.prisma.io/docs
- Express: https://expressjs.com
- PostgreSQL: https://www.postgresql.org/docs

---

**Version:** 1.0.0  
**Last Updated:** February 8, 2026  
**Status:** Production Ready
