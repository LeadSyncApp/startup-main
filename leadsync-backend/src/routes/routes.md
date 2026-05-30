# Routes Directory

This directory maps inbound HTTP traffic (API endpoints) to the corresponding business logic layer services. It is divided topically by domain.

## Subdirectories and their Responsibilities

### `auth/`

Contains routes related to login, signup, and token generation (`auth.routes.ts`, `public.routes.ts`, `secure.routes.ts`). Defines how user identities and roles (`OWNER`, `ADMIN`, `AGENT`) are provisioned.

### `bot/`

Contains endpoints for configuring bot knowledge (`bot-knowledge.routes.ts`) and global merchant automation flags (`automation.routes.ts`) used to define AI conversational bounds and auto-assignment strategies.

### `core/`

Handles core platform UI endpoints:

- `dashboard.routes.ts` & `analytics.routes.ts`: Serves charts, funnel counts, and revenue statistics for the frontend UI.
- `notification.routes.ts`: Manages unread alert queues for agents.
- `users.routes.ts`: Team management and role configuration within a single tenant (company).

### `integrations/`

Endpoints used by frontend clients to establish OAuth bindings or toggle feature flags for 3rd party modules like `instagram.integration.routes.ts` and `telegram.integration.routes.ts`.

### `leads/`

`leads.routes.ts` - A major CRUD router managing the CRM aspect of the application (fetching pipelines, editing lead details).

### `messaging/`

Handles direct real-time communication modules.

- `conversations.routes.ts`: Fetches entire chat logs and permits human agents to reply directly, disabling AI take-over.
- `broadcasts.routes.ts`: Allows scheduling bulk promotions.

### `orders/`

- `orders.routes.ts` & `newOrderArrivals.routes.ts`: Governs the checkout/POS experience. Maps endpoints to manually review, accept, reject or modify "ghost orders" discovered by AI.

### `telegram/` & `webhooks/`

`webhook.routes.ts` - Maps generic inbound webhooks into the adapter systems.

`telegram.controller.ts` & `telegram.routes.ts` - Dedicated entrypoints for Telegram polling or direct platform-specific verifications.
