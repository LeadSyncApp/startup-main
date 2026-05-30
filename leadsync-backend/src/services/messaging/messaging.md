
# Service Module: `services/messaging`

Houses the business logic engines, calculators, integrations, and database transition sequences for the **MESSAGING** contextual layer.

## Files and Responsibilities

### 📄 `customerMessaging.service.ts`

Outward uniform pipeline formatting messages, converting audio attachments, and dispatching payloads.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **backend: services/workflow/orderWorkflow.service.ts** (Line 5):

  ```typescript

  import{ customerMessagingService }from"../messaging/customerMessaging.service";

  ```

---

### 📄 `telegram.polling.ts`

Polling fallback service checking Telegram API for updates if webhooks cannot be registered.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **backend: server.ts** (Line 12):

  ```typescript

  import{ startTelegramPolling }from"./services/messaging/telegram.polling";

  ```

---

### 📄 `telegram.service.ts`

Exposes standard API wrappers to dispatch formatted Telegram texts, media files, and buttons.

**Inter-Module Linkages:**

Called or exported by:

- **backend: services/index.ts** (Line 21):

  ```typescript

  export{ createOrder }from"./messaging/telegram.service";

  ```

  *(Note: This service has no other active callers or references in the codebase.)*

---

### 📄 `telegram.webhook.ts`

Registers local service URLs with Telegram webhook lists.

**Inter-Module Linkages:**

This service is currently not imported or used anywhere in the application (unused file).

---

### 📄 `telegramSelector.service.ts`

Prevents multiple node clusters from multi-polling the same Telegram streams by obtaining locks.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **backend: lib/socket.ts** (Line 5):

  ```typescript

  import{IS_LOCAL}from"../services/messaging/telegramSelector.service";

  ```

---
