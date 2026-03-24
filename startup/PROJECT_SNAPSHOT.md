# PROJECT SNAPSHOT

## Project
LeadSync CRM

## Stack
- Frontend: React (Vite) → Vercel
- Backend: Node.js + Express → Railway
- DB: PostgreSQL (Supabase) + Prisma

## Architecture
- Monolithic backend (moving → microservices)
- REST APIs
- Multi-tenant (company-based)

## Core Modules
- Auth
- Leads
- Conversations
- Orders
- Automation
- Integrations (Telegram, Instagram)

## Backend Structure
# REPO MAP

_Generated automatically. Do not edit manually._

- leadsync-backend/
  - prisma/
    - migrations/
      - 20260208094647_init/
      - 20260208182720_add_telegram_webhook_secret_and_fix_relations/
      - 20260208183718_add_telegram_webhook_secret/
      - 20260208202707_add_conversation_mode/
      - 20260208211639_fix_company_conversation_relation/
      - 20260208212439_finalize_conversation_schema/
      - 20260211090420_add_orders_model/
      - 20260212165914_add_telegram_connected/
      - 20260213120325_add_unique_and_cascade/
      - 20260214084537_add_bot_config/
      - 20260214095533_add_structured_menu/
      - 20260215094423_add_admin_and_agent_performance/
      - 20260215104448_add_order_approval_flow/
      - 20260215153038_add_is_active_to_user/
      - 20260323095146_add_staff_id_to_user/
      - 20240219_enable_rls.sql
      - migration_lock.toml
    - schema.prisma
    - seed.ts
  - scripts/
    - backup.ps1
    - generate-repo-map.ps1
    - restore.ps1
  - src/
    - adapters/
      - channel.adapter.ts
      - instagram.adapter.ts
      - telegram.adapter.ts
    - bot/
      - bot.logic.ts
      - telegram.sender.ts
    - lib/
      - api.ts
      - prisma.ts
      - socket.ts
    - middleware/
      - auth.middleware.ts
    - routes/
      - leads/
      - telegram/
      - analytics.routes.ts
      - auth.routes.ts
      - automation.routes.ts
      - bot-knowledge.routes.ts
      - broadcasts.routes.ts
      - conversations.routes.ts
      - dashboard.routes.ts
      - instagram.integration.routes.ts
      - instagram.routes.ts
      - integrations.routes.ts
      - notification.routes.ts
      - orders.routes.ts
      - public.routes.ts
      - secure.routes.ts
      - telegram.integration.routes.ts
      - users.routes.ts
      - webhook.routes.ts
    - services/
      - ai.service.ts
      - automation.service.ts
      - cache.service.ts
      - customerMessaging.service.ts
      - customerMessaging.service.ts.utf8
      - email.service.ts
      - fileParser.service.ts
      - intelligence.service.ts
      - invoice.service.ts
      - notification.service.ts
      - orderParser.service.ts
      - orderWorkflow.service.ts
      - payment.service.ts
      - queue.service.ts
      - sarvam.service.ts
      - telegram.service.ts
      - telegram.webhook.ts
    - utils/
      - jwt.ts
      - shop-ai.utils.ts
    - app.ts
    - debug-ai.ts
    - server.ts
    - verify-prod-rules.ts
  - .gitignore
  - 1770758113965.json
  - package.json
  - package-lock.json
  - REPO_MAP.md
  - tsconfig.json
  - tsconfig.prisma.json
  - tsconfig.prisma.tsbuildinfo


## Frontend Structure
# REPO MAP

_Generated automatically. Do not edit manually._

- leadsync-frontend/
  - public/
    - favicon.ico
    - favicon.svg
  - scripts/
    - generate-repo-map.ps1
  - src/
    - assets/
      - react.svg
    - components/
      - conversations/
      - dashboard/
      - layout/
      - leads/
      - settings/
      - ui/
      - ErrorBoundary.tsx
      - ProtectedRoute.tsx
      - PublicRoute.tsx
    - context/
      - AuthContext.tsx
      - SocketContext.tsx
    - lib/
      - api.ts
    - pages/
      - dashboard/
      - Home.tsx
      - Login.tsx
      - OrderTracking.tsx
      - Signup.tsx
    - types/
      - index.ts
      - react-confetti.d.ts
    - utils/
      - formatINR.ts
      - industryConfig.ts
    - App.tsx
    - index.css
    - main.jsx
    - main.tsx
    - vite-env.d.ts
  - .eslintrc.json
  - .gitignore
  - index.html
  - package.json
  - package-lock.json
  - postcss.config.js
  - REPO_MAP.md
  - tailwind.config.js
  - tsconfig.json
  - tsconfig.node.json
  - tsconfig.tsbuildinfo
  - vite.config.ts


## Important Rules
- No breaking APIs
- No deleting files
- Backward compatibility required
- Multi-tenant isolation (companyId)
- No secrets in frontend