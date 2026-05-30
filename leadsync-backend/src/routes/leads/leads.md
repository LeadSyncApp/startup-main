# Route Module: `routes/leads`

Responsible for handling HTTP traffic regarding the **LEADS** domain context.

## Files and Responsibilities

### 📄 `leads.routes.ts`

Directs customer pipelining CRUD actions, managing conversion priorities, conversation mappings, and assignment overrides.

**Defined Endpoints:**

- `GET``/` (Line 13)
- `PATCH``/:id` (Line 156)
- `POST``/:id/claim-pending-order` (Line 185)
- `DELETE``/:id` (Line 345)

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **backend: app.ts** (Line 12):

  ```typescript

  import leadsRoutes from"./routes/leads/leads.routes";

  ```

---
