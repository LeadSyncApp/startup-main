# Lib Directory

Provides core singleton instances and centralized drivers for database, external standard APIs, and Real-time communication.

## Files and their Responsibilities

### `api.ts`

- **Purpose**: Defines shared standard configurations or utilities for generating generic API logic and handling external integrations safely if required.
- **Current Status**: Active framework-level utility.

### `prisma.ts`

- **Purpose**: The foundational Database client. It instantiates and exports a singleton instance of the `PrismaClient` to ensure connections to the database are pooled successfully and prevents the app from exceeding connection limits across hot reloads or excessive serverless functions.
- **Current Status**: Essential. Fully active.
- **Linked With**: Every repository, adapter, and service file within the application that accesses the database.

### `socket.ts`

- **Purpose**: The WebSockets layer mapping. Responsible for emitting real-time updates directly to frontend clients based on backend events (`emitToCompany`, `emitToConversation`). Used primarily for broadcasting live incoming messages, updating the kanban boards, and broadcasting notification bells.
- **Current Status**: Highly utilized. Critical to the real-time "chat" feel of the platform.
- **Linked With**: Used nearly everywhere, prominently in `adapters`, `orderWorkflow.service.ts`, and core webhook controllers.

## Inter-Module Linkages

### `api.ts`

This file is currently not referenced/called by files in other directories.

### `prisma.ts`

Called or imported by files in other folders:

- **backend: adapters/instagram.adapter.ts** (Line 2):

  ```typescript

  import{ prisma }from"../lib/prisma";

  ```
- **backend: adapters/telegram.adapter.ts** (Line 2):

  ```typescript

  import{ prisma }from"../lib/prisma";

  ```
- **backend: bot/bot.logic.ts** (Line 1):

  ```typescript

  import{ prisma }from"../lib/prisma";

  ```
- **backend: routes/auth/auth.routes.ts** (Line 4):

  ```typescript

  import{ prisma }from"../../lib/prisma";

  ```
- **backend: routes/auth/public.routes.ts** (Line 2):

  ```typescript

  import{ prisma }from'../../lib/prisma'

  ```
- **backend: routes/bot/automation.routes.ts** (Line 2):

  ```typescript

  import{ prisma }from"../../lib/prisma";

  ```
- **backend: routes/bot/bot-knowledge.routes.ts** (Line 2):

  ```typescript

  import{ prisma }from"../../lib/prisma";

  ```
- **backend: routes/core/analytics.routes.ts** (Line 2):

  ```typescript

  import{ prisma }from"../../lib/prisma";

  ```
- **backend: routes/core/dashboard.routes.ts** (Line 2):

  ```typescript

  import{ prisma }from"../../lib/prisma";

  ```
- **backend: routes/core/notification.routes.ts** (Line 4):

  ```typescript

  import{ prisma }from"../../lib/prisma";

  ```
- **backend: routes/core/users.routes.ts** (Line 4):

  ```typescript

  import{ prisma }from"../../lib/prisma";

  ```
- **backend: routes/integrations/instagram.integration.routes.ts** (Line 2):

  ```typescript

  import{ prisma }from"../../lib/prisma";

  ```
- **backend: routes/integrations/integrations.routes.ts** (Line 2):

  ```typescript

  import{ prisma }from"../../lib/prisma";

  ```
- **backend: routes/integrations/telegram.integration.routes.ts** (Line 4):

  ```typescript

  import{ prisma }from"../../lib/prisma";// correct path for src/routes -> src/lib

  ```
- **backend: routes/leads/leads.routes.ts** (Line 2):

  ```typescript

  import{ prisma }from"../../lib/prisma";

  ```
- **backend: routes/messaging/broadcasts.routes.ts** (Line 3):

  ```typescript

  import{ prisma }from"../../lib/prisma";

  ```
- **backend: routes/messaging/conversations.routes.ts** (Line 3):

  ```typescript

  import{ prisma }from"../../lib/prisma";

  ```
- **backend: routes/messaging/instagram.routes.ts** (Line 2):

  ```typescript

  import{ prisma }from"../../lib/prisma";

  ```
- **backend: routes/orders/newOrderArrivals.routes.ts** (Line 3):

  ```typescript

  import{ prisma }from"../../lib/prisma";

  ```
- **backend: routes/orders/orders.routes.ts** (Line 2):

  ```typescript

  import{ prisma }from"../../lib/prisma";

  ```
- **backend: routes/telegram/telegram.controller.ts** (Line 2):

  ```typescript

  import{ prisma }from"../../lib/prisma";

  ```
- **backend: routes/webhooks/webhook.routes.ts** (Line 2):

  ```typescript

  import{ prisma }from"../../lib/prisma";

  ```
- **backend: server.ts** (Line 13):

  ```typescript

  import{ prisma }from"./lib/prisma";

  ```
- **backend: services/ai/intelligence.service.ts** (Line 1):

  ```typescript

  import{ prisma }from"../../lib/prisma";

  ```
- **backend: services/ai/orderParser.service.ts** (Line 1):

  ```typescript

  import{ prisma }from"../../lib/prisma";

  ```
- **backend: services/infrastructure/notification.service.ts** (Line 1):

  ```typescript

  import{ prisma }from"../../lib/prisma";

  ```
- **backend: services/integrations/crm.service.ts** (Line 1):

  ```typescript

  import{ prisma }from"../../lib/prisma";

  ```
- **backend: services/integrations/invoice.service.ts** (Line 1):

  ```typescript

  import{ prisma }from"../../lib/prisma";

  ```
- **backend: services/integrations/payment.service.ts** (Line 2):

  ```typescript

  import{ prisma }from"../../lib/prisma";

  ```
- **backend: services/messaging/customerMessaging.service.ts** (Line 1):

  ```typescript

  import{ prisma }from"../../lib/prisma";

  ```
- **backend: services/messaging/telegram.polling.ts** (Line 1):

  ```typescript

  import{ prisma }from"../../lib/prisma";

  ```
- **backend: services/messaging/telegram.service.ts** (Line 1):

  ```typescript

  import{ prisma }from"../../lib/prisma";

  ```
- **backend: services/messaging/telegramSelector.service.ts** (Line 1):

  ```typescript

  import{ prisma }from"../../lib/prisma";

  ```
- **backend: services/workflow/assignment.service.ts** (Line 1):

  ```typescript

  import{ prisma }from"../../lib/prisma";

  ```
- **backend: services/workflow/automation.service.ts** (Line 1):

  ```typescript

  import{ prisma }from"../../lib/prisma";

  ```
- **backend: services/workflow/newOrderArrival.service.ts** (Line 1):

  ```typescript

  import{ prisma }from"../../lib/prisma";

  ```
- **backend: services/workflow/orderWorkflow.service.ts** (Line 1):

  ```typescript

  import{ prisma }from"../../lib/prisma";

  ```

### `socket.ts`

Called or imported by files in other folders:

- **backend: adapters/instagram.adapter.ts** (Line 10):

  ```typescript

  import{ emitToCompany, emitToConversation, safeEmitConversationUpdate }from"../lib/socket";

  ```
- **backend: adapters/telegram.adapter.ts** (Line 12):

  ```typescript

  import{ emitToCompany, emitToConversation, safeEmitConversationUpdate }from"../lib/socket";

  ```
- **backend: routes/core/users.routes.ts** (Line 7):

  ```typescript

  import{ emitToAgent }from"../../lib/socket";

  ```
- **backend: routes/leads/leads.routes.ts** (Line 5):

  ```typescript

  import{ safeEmitConversationUpdate, emitToAgent, emitToCompany }from"../../lib/socket";

  ```
- **backend: routes/messaging/conversations.routes.ts** (Line 6):

  ```typescript

  import{ emitToCompany, emitToConversation, safeEmitConversationUpdate, emitToAgent, emitToCompanyAdmin }from"../../lib/socket";

  ```
- **backend: routes/orders/newOrderArrivals.routes.ts** (Line 5):

  ```typescript

  import{ emitToCompany }from"../../lib/socket";

  ```
- **backend: routes/orders/orders.routes.ts** (Line 12):

  ```typescript

  import{ safeEmitConversationUpdate, emitToCompany, emitToAgent }from"../../lib/socket";

  ```
- **backend: routes/webhooks/webhook.routes.ts** (Line 5):

  ```typescript

  import{ emitToConversation, safeEmitConversationUpdate }from"../../lib/socket";

  ```
- **backend: server.ts** (Line 10):

  ```typescript

  import{ initSocket }from"./lib/socket";

  ```
- **backend: services/ai/intelligence.service.ts** (Line 4):

  ```typescript

  import{ emitToCompany, emitToConversation, emitToAgent, emitToCompanyAdmin }from"../../lib/socket";

  ```
- **backend: services/ai/orderParser.service.ts** (Line 3):

  ```typescript

  import{ emitToCompany, emitToConversation, emitToAgent, emitToCompanyAdmin, safeEmitConversationUpdate }from"../../lib/socket";

  ```
- **backend: services/infrastructure/notification.service.ts** (Line 2):

  ```typescript

  import{ emitToAgent, emitToCompanyAdmin }from"../../lib/socket";

  ```
- **backend: services/integrations/crm.service.ts** (Line 2):

  ```typescript

  import{ emitToCompany }from"../../lib/socket";

  ```
- **backend: services/messaging/customerMessaging.service.ts** (Line 4):

  ```typescript

  import{ emitToConversation }from"../../lib/socket";

  ```
- **backend: services/workflow/assignment.service.ts** (Line 2):

  ```typescript

  import{ safeEmitConversationUpdate, emitToAgent, emitToCompany }from"../../lib/socket";

  ```
- **backend: services/workflow/automation.service.ts** (Line 2):

  ```typescript

  import{ getIO, emitToAgent }from"../../lib/socket";

  ```
- **backend: services/workflow/newOrderArrival.service.ts** (Line 10):

  ```typescript

  import{ emitToCompany, emitToCompanyAdmin, emitToAgent, safeEmitConversationUpdate }from"../../lib/socket";

  ```
- **backend: services/workflow/orderWorkflow.service.ts** (Line 3):

  ```typescript

  import{ safeEmitConversationUpdate, emitToCompany, emitToCompanyAdmin }from"../../lib/socket";

  ```
