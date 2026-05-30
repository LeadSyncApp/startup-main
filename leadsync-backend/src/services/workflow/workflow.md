# Service Module: `services/workflow`

Houses the business logic engines, calculators, integrations, and database transition sequences for the **WORKFLOW** contextual layer.

## Files and Responsibilities

### 📄 `assignment.service.ts`

Distributes hot incoming conversation leads to online human agents based on current active loads.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **backend: adapters/instagram.adapter.ts** (Line 17):

  ```typescript

  import{ assignmentService }from"../services/workflow/assignment.service";

  ```
- **backend: adapters/telegram.adapter.ts** (Line 20):

  ```typescript

  import{ assignmentService }from"../services/workflow/assignment.service";

  ```

---

### 📄 `automation.service.ts`

Background scheduler executing periodic events, reminders, and auto-responders.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **backend: server.ts** (Line 11):

  ```typescript

  import{ startAutomationRunner }from"./services/workflow/automation.service";

  ```

---

### 📄 `newOrderArrival.service.ts`

Locks order pipelines during rapid manual claims to resolve race conditions cleanly.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **backend: bot/bot.logic.ts** (Line 3):

  ```typescript

  import{ newOrderArrivalService }from"../services/workflow/newOrderArrival.service";

  ```
- **backend: routes/orders/newOrderArrivals.routes.ts** (Line 4):

  ```typescript

  import{ newOrderArrivalService }from"../../services/workflow/newOrderArrival.service";

  ```
- **backend: services/ai/orderParser.service.ts** (Line 7):

  ```typescript

  import{ newOrderArrivalService }from"../workflow/newOrderArrival.service";

  ```

---

### 📄 `orderWorkflow.service.ts`

Orchestrates the order lifecycle transitions, trigger invoicing, and updates CRM boards.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **backend: routes/orders/orders.routes.ts** (Line 252):

  ```typescript

  import{ orderWorkflowService }from"../../services/workflow/orderWorkflow.service";

  ```
- **backend: routes/webhooks/webhook.routes.ts** (Line 7):

  ```typescript

  import{ orderWorkflowService }from"../../services/workflow/orderWorkflow.service";

  ```

---
