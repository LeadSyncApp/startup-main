# Agent Tasks — Common repo actions

This file documents small, repeatable tasks an automated agent can perform safely (or ask for confirmation when risky).

Safe to run without approval
- `npm install` in `leadsync-backend` and `leadsync-frontend` — installs dependencies.
- `npm run dev` in frontend or backend — starts local dev servers.
- `npm run repo:map` — regenerates repo documentation maps.

Require confirmation (ask before running)
- `npm run migrate` — applies Prisma migrations (may alter or drop data).
- `npx prisma migrate reset` — destructive reset (deletes data).
- `npm run seed` — inserts sample data; safe but may conflict with existing data.

How to run (examples)

From repo root (backend):

  cd leadsync-backend
  npm install
  # set up .env by copying .env.example -> .env and filling values
  npm run migrate   # ask before running
  npm run seed      # optional, ask before running
  npm run dev

Agent safety rules
- Do not commit secrets. If an env value is missing, prompt the user.
- Always link to `INSTALLATION.md` for full setup steps.
