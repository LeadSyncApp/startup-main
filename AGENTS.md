# AGENTS.md — Chat Agent Instructions

Purpose: Give AI coding agents the minimal, high-value knowledge they need to work in this repository.

Quick facts
- **Runtime:** Node.js >=20.16.0 (see [leadsync-backend/package.json](leadsync-backend/package.json)).
- **Languages:** TypeScript for backend and frontend; frontend uses Vite.
- **ORM:** Prisma — schema at [leadsync-backend/prisma/schema.prisma](leadsync-backend/prisma/schema.prisma).

How to run (local dev)
- Backend: from `leadsync-backend` run:

  npm install
  npm run dev

- Frontend: from `leadsync-frontend` run:

  npm install
  npm run dev

Where to look first
- Backend entry: [leadsync-backend/src/server.ts](leadsync-backend/src/server.ts) and [leadsync-backend/src/app.ts](leadsync-backend/src/app.ts).
- Routes and services: [leadsync-backend/src/routes](leadsync-backend/src/routes) and [leadsync-backend/src/services](leadsync-backend/src/services).
- Frontend entry: [leadsync-frontend/src/main.tsx](leadsync-frontend/src/main.tsx) / [leadsync-frontend/src/App.tsx](leadsync-frontend/src/App.tsx).
- Database migrations: [leadsync-backend/prisma/migrations](leadsync-backend/prisma/migrations).

Common tasks for agents
- When making backend changes, update Prisma schema and run `npm run migrate` in `leadsync-backend`.
- Preserve existing documentation: link to docs instead of duplicating them. See [INSTALLATION.md](INSTALLATION.md) and [leadsync-backend/ORDER_WORKFLOW.md](leadsync-backend/ORDER_WORKFLOW.md).
- Use existing repo-mapping scripts: `npm run repo:map` in either package to regenerate maps.

Conventions and caveats
- Prefer minimal, reversible changes. Avoid sweeping refactors without tests.
- Tests are not present in the repo root; run local lint/build steps only when relevant.
- Environment variables are used (see `leadsync-backend/.env` references in code). Do not commit secrets.
- General operating standard for agents: see `.github/CORE_IDENTITY_ARCHITECTURE.md`.

Suggested next customizations
- Create a per-area `.github/copilot-instructions.md` focusing on backend developer workflows (migrations, seeding, env setup).
- Add an `agent-skill` for common repo tasks (migrate, seed, dev-run). This accelerates automated runs.

Links
- Installation guide: [INSTALLATION.md](INSTALLATION.md)
- Backend repo map: [leadsync-backend/REPO_MAP.md](leadsync-backend/REPO_MAP.md)
- Frontend repo map: [leadsync-frontend/REPO_MAP.md](leadsync-frontend/REPO_MAP.md)
