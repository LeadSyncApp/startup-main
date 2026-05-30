# Route Module: `routes/bot`

Responsible for handling HTTP traffic regarding the **BOT** domain context.

## Files and Responsibilities

### 📄 `automation.routes.ts`

Allows active company entities to read, verify, and update standard merchant process rules and automation tags.

**Defined Endpoints:**

- `GET``/` (Line 10)
- `POST``/` (Line 27)
- `PATCH``/:id` (Line 46)
- `DELETE``/:id` (Line 76)
- `GET``/:id/logs` (Line 94)

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **backend: app.ts** (Line 31):

  ```typescript

  import automationRoutes from"./routes/bot/automation.routes";

  ```

---

### 📄 `bot-knowledge.routes.ts`

Manages AI training files, structured menu catalogs, custom description logs, and prompt boundaries.

**Defined Endpoints:**

- `GET``/` (Line 8)
- `POST``/` (Line 25)
- `PATCH``/:id` (Line 44)
- `DELETE``/:id` (Line 71)

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **backend: app.ts** (Line 32):

  ```typescript

  import botKnowledgeRoutes from"./routes/bot/bot-knowledge.routes";

  ```

---
