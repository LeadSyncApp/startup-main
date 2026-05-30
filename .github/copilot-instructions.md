# Copilot Instructions — Backend-first workflow

Purpose: concise, actionable instructions for AI coding agents working on the backend (local development, migrations, seeding, env setup).

Scope: focused on `leadsync-backend`. For frontend guidance, see `leadsync-frontend/` and `AGENTS.md`.

Start here
- Install dependencies in each package: `npm install` in `leadsync-backend` and `leadsync-frontend`.
- For backend development run `npm run dev` from `leadsync-backend` (port 4000 by default).

Environment
- Use `.env.example` files added to each package as templates. Copy to `.env` and fill secrets.
- Never write secrets into source-controlled files.

Database workflow
- Create database (local Postgres) or use Supabase. Update `DATABASE_URL`/`DIRECT_URL` in `leadsync-backend/.env`.
- Run migrations: from `leadsync-backend` run `npm run migrate`.
- Seed sample data: `npm run seed` (uses `prisma/seed.ts`).

Common scripts
- `npm run dev` — start backend with `ts-node-dev` (hot reload).
- `npm run build` — compile TypeScript to `dist/`.
- `npm run start` — run compiled backend.
- `npm run repo:map` — regenerate repository map (PowerShell script).

Agent behavior guidelines
- Link to, rather than duplicate, existing docs. Use `INSTALLATION.md` for full setup steps.
- When changing database schema: update `prisma/schema.prisma`, then create a migration and run `npm run migrate`.
- When asked to run commands, request confirmation before executing anything that alters data (migrations, resets).

Core identity (applies to all work in this repo)
- Context before code: clarify problem, users, constraints, and success metrics.
- Verify before modifying: discover existing patterns and match them; don’t assume.
- Production-grade: explicit types/contracts, validation, error handling, security-by-default, and accessible UX.
- Consistency over cleverness: preserve working behavior; avoid new paradigms without approval.
- Git safety: atomic commits; **never push to `main` without explicit permission**.
- Full checklist and templates: see `.github/CORE_IDENTITY_ARCHITECTURE.md`.

Files added to support this:
- `leadsync-backend/.env.example` — environment template for backend.
- `leadsync-frontend/.env.example` — environment template for frontend.
- `.github/AGENT_TASKS.md` — short task list for automated agents.
