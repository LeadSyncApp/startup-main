# Running the LeadSync Project (Frontend + Backend)

This document collects the exact commands to install, run, and troubleshoot the repository to avoid confusion.

## Prerequisites

- Node.js (LTS >= 18) and npm
- Git
- A database (set via `DATABASE_URL` in backend `.env`) — SQLite/Postgres/etc.

## Repo layout (quick refs)

- Frontend: [package.json](package.json) - Runs on http://localhost:5173
- Backend: [leadsync-backend/package.json](leadsync-backend/package.json) - Runs on http://localhost:4000

## 1 — Install dependencies

From the repository root (frontend):

```bash
npm install
```

Install backend dependencies:

```bash
cd leadsync-backend
npm install
```

## 2 — Environment variables

- Backend: create `leadsync-backend/.env` (never commit it). Required keys (example):

```
DATABASE_URL="postgresql://user:pass@localhost:5432/leadsync"
PORT=4000
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
NODE_ENV=development
```

- Frontend: create `.env.local` at repo root to point to the API, e.g.:

```
VITE_API_URL=http://localhost:4000
```

Adjust `VITE_API_URL` if you run the backend on a different host/port.

## 3 — Database / Prisma (backend)

From `leadsync-backend` directory run:

```bash
npx prisma generate           # generate Prisma client
# Option A (development - applies migrations & opens interactive flow):
npx prisma migrate dev --name init
# Option B (production / CI):
npx prisma migrate deploy

# Run the seed script (creates 2 demo companies + 2 users):
npm run seed
```

If you see `DATABASE_URL not found` errors, ensure `leadsync-backend/.env` exists with:
```
DATABASE_URL="postgresql://user:pass@localhost:5432/leadsync"
PORT=4000
TELEGRAM_BOT_TOKEN=your_token_here
NODE_ENV=development
```

## 4 — Run in development (two terminals)

- Terminal A — Start backend (watch, port 4000):

```bash
cd leadsync-backend
npm run dev
# Output: Server running on http://localhost:4000
# CORS enabled for http://localhost:5173
```

- Terminal B — Start frontend (Vite, port 5173):

```bash
# from repo root
npm run dev
# Output: http://localhost:5173 (with HMR enabled)
```

Frontend communicates with backend at `http://localhost:4000/api/*` routes. CORS is pre-configured in `app.ts`.

## 5 — Build & run production

- Build frontend:

```bash
npm run build        # from repo root
```

- Build backend and start:

```bash
cd leadsync-backend
npm run build
npm start            # runs built dist/server.js
```

## 6 — Common troubleshooting

- If frontend cannot reach API: confirm `VITE_API_URL` and backend `PORT` match. Restart Vite after changing `.env.local`.
- Prisma errors: run `npx prisma generate` then `npx prisma migrate dev` and review `DATABASE_URL`.
- If TypeScript runtime errors occur in backend dev mode, ensure `ts-node-dev` installed (it is a devDependency) and that `npm install` completed.

## 7 — Quick command summary

- Install all deps (root + backend):

```bash
npm install && cd leadsync-backend && npm install && cd ..
```

- Dev run (backend, frontend):

```bash
# Terminal 1
eval "cd leadsync-backend && npm run dev"
# Terminal 2
npm run dev
```

---
If you'd like, I can also add a small npm script at the repo root to start both services concurrently (using `concurrently`) — want that?