# Route Module: `routes/integrations`

Responsible for handling HTTP traffic regarding the **INTEGRATIONS** domain context.

## Files and Responsibilities

### 📄 `instagram.integration.routes.ts`

Authorizes Meta API pipelines, processes handshake challenges, or de-registers connected accounts.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **backend: app.ts** (Line 17):

  ```typescript

  import instagramIntegrationRoutes from"./routes/integrations/instagram.integration.routes";

  ```

---

### 📄 `integrations.routes.ts`

Aggregates multi-channel platform statuses to render active integrations (e.g., Telegram, CRM, payment portals) cleanly.

**Defined Endpoints:**

- `GET``/ping` (Line 11)

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **backend: app.ts** (Line 15):

  ```typescript

  import integrationsRoutes from"./routes/integrations/integrations.routes";

  ```

---

### 📄 `telegram.integration.routes.ts`

Mounts setup sequences to register tokens directly with Telegram servers and verify connectivity.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **backend: app.ts** (Line 16):

  ```typescript

  import telegramIntegrationRoutes from"./routes/integrations/telegram.integration.routes";

  ```

---
