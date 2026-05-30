# Middleware Directory

Contains Express.js middleware functions that intercept incoming HTTP requests to apply global checks, modifications, and security guards before hitting the core route controllers.

## Files and their Responsibilities

### `auth.middleware.ts`

- **Purpose**: Implements core Authentication and Authorization checks.

  - `authMiddleware`: Verifies the incoming `Bearer` JWT token from the `Authorization` header, decodes it using the backend secret, and attaches the parsed `user` object (including `userId`, `companyId`, `role`, `staffId`, `name`) to the Express request instance. Rejects invalid tokens with `401 Unauthorized`.
  - `authorizeRoles(...)`: A configurable RBAC (Role-Based Access Control) function that acts as a secondary layer to restrict endpoints to specific roles (e.g. `OWNER`, `ADMIN`, `AGENT`). Exits with `403 Forbidden` if roles don't match.
- **Current Status**: Highly critical. Fully operational and actively protecting insecure routes across the application.
- **Linked With**: Heavily imported across all files inside the `src/routes/` directory (except public webhooks and public auth routes).

## Inter-Module Linkages

### `auth.middleware.ts`

Called or imported by files in other folders:

- **backend: routes/auth/secure.routes.ts** (Line 2):

  ```typescript

  import{ authMiddleware,AuthRequest}from'../../middleware/auth.middleware'

  ```
- **backend: routes/bot/automation.routes.ts** (Line 3):

  ```typescript

  import{ authMiddleware,AuthRequest}from"../../middleware/auth.middleware";

  ```
- **backend: routes/bot/bot-knowledge.routes.ts** (Line 3):

  ```typescript

  import{ authMiddleware,AuthRequest}from"../../middleware/auth.middleware";

  ```
- **backend: routes/core/analytics.routes.ts** (Line 3):

  ```typescript

  import{ authMiddleware,AuthRequest}from"../../middleware/auth.middleware";

  ```
- **backend: routes/core/dashboard.routes.ts** (Line 3):

  ```typescript

  import{ authMiddleware,AuthRequest}from"../../middleware/auth.middleware";

  ```
- **backend: routes/core/notification.routes.ts** (Line 2):

  ```typescript

  import{ authMiddleware,AuthRequest}from"../../middleware/auth.middleware";

  ```
- **backend: routes/core/users.routes.ts** (Line 5):

  ```typescript

  import{ authMiddleware,AuthRequest}from"../../middleware/auth.middleware";

  ```
- **backend: routes/integrations/instagram.integration.routes.ts** (Line 3):

  ```typescript

  import{ authMiddleware,AuthRequest}from"../../middleware/auth.middleware";

  ```
- **backend: routes/integrations/integrations.routes.ts** (Line 3):

  ```typescript

  import{ authMiddleware,AuthRequest}from"../../middleware/auth.middleware";

  ```
- **backend: routes/integrations/telegram.integration.routes.ts** (Line 5):

  ```typescript

  import{ authMiddleware,AuthRequest}from"../../middleware/auth.middleware";

  ```
- **backend: routes/leads/leads.routes.ts** (Line 3):

  ```typescript

  import{ authMiddleware, authorizeRoles,AuthRequest}from"../../middleware/auth.middleware";

  ```
- **backend: routes/messaging/broadcasts.routes.ts** (Line 4):

  ```typescript

  import{ authMiddleware,AuthRequest}from"../../middleware/auth.middleware";

  ```
- **backend: routes/messaging/conversations.routes.ts** (Line 2):

  ```typescript

  import{ authMiddleware,AuthRequest}from"../../middleware/auth.middleware";

  ```
- **backend: routes/orders/newOrderArrivals.routes.ts** (Line 2):

  ```typescript

  import{ authMiddleware,AuthRequest}from"../../middleware/auth.middleware";

  ```
- **backend: routes/orders/orders.routes.ts** (Line 3):

  ```typescript

  import{ authMiddleware, authorizeRoles,AuthRequest}from"../../middleware/auth.middleware";

  ```
