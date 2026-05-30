# Service Module: `services/integrations`

Houses the business logic engines, calculators, integrations, and database transition sequences for the **INTEGRATIONS** contextual layer.

## Files and Responsibilities

### 📄 `crm.service.ts`

Synchronizes leads, totals, email details, and milestones with external high-volume CRM setups.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **backend: adapters/telegram.adapter.ts** (Line 22):

  ```typescript

  import{ recalculateLeadCRM }from"../services/integrations/crm.service";

  ```
- **backend: routes/orders/orders.routes.ts** (Line 13):

  ```typescript

  import{ recalculateLeadCRM }from"../../services/integrations/crm.service";

  ```
- **backend: services/workflow/newOrderArrival.service.ts** (Line 12):

  ```typescript

  import{ recalculateLeadCRM }from"../integrations/crm.service";

  ```
- **backend: services/workflow/orderWorkflow.service.ts** (Line 7):

  ```typescript

  import{ recalculateLeadCRM }from"../integrations/crm.service";

  ```

---

### 📄 `email.service.ts`

Helper wrapping SMTP or mail API keys to reliably fire account activations and password resets.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **backend: routes/auth/auth.routes.ts** (Line 7):

  ```typescript

  import{ sendEmail, generatePasswordResetHtml }from"../../services/integrations/email.service";

  ```

---

### 📄 `fileParser.service.ts`

Directly processes uploaded vendor spreadsheets or menu PDFs to extract items and price lists.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **backend: routes/core/dashboard.routes.ts** (Line 6):

  ```typescript

  import{ upload, fileParserService }from"../../services/integrations/fileParser.service";

  ```

---

### 📄 `invoice.service.ts`

Assembles formatted transaction and item-matrix lists to dispatch to consumers upon order finalization.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **backend: routes/webhooks/webhook.routes.ts** (Line 6):

  ```typescript

  import{ invoiceService }from"../../services/integrations/invoice.service";

  ```

---

### 📄 `payment.service.ts`

Bridges order processors to checkout engines to create links or verify remote hooks.

**Inter-Module Linkages:**

No external linkages or imports from other directories.

---
