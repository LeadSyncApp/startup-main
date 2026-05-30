# Service Module: `services/tools`

Houses the business logic engines, calculators, integrations, and database transition sequences for the **TOOLS** contextual layer.

## Files and Responsibilities

### 📄 `debug-ai.ts`

Utility playground executing quick AI tests from local terminal flags.

**Inter-Module Linkages:**

Standalone diagnostic script intended for direct terminal or CLI execution. It is not imported by any other files in the application.

---

### 📄 `verify-prod-rules.ts`

Checks system prompt structures against guardrails to maintain response quality.

**Inter-Module Linkages:**

Standalone verification script intended for direct terminal or CLI execution. It is not imported by other files, but it makes imports from other modules:

- **backend: services/ai/intelligence.service.ts** (Line 5):

  ```typescript

  import{ intelligenceService }from"../ai/intelligence.service";

  ```
- **backend: services/ai/ai.service.ts** (Line 6):

  ```typescript

  import{ generateBotReply }from"../ai/ai.service";

  ```
- **backend: services/ai/orderParser.service.ts** (Line 7):

  ```typescript

  import{ orderParserService }from"../ai/orderParser.service";

  ```

---
