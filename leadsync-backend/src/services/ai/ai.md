# Service Module: `services/ai`

Houses the business logic engines, calculators, integrations, and database transition sequences for the **AI** contextual layer.

## Files and Responsibilities

### 📄 `ai.service.ts`

Primary wrapper utilizing @google/genai SDK to yield structured text, classify intents, and produce menu structures.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **backend: adapters/instagram.adapter.ts** (Line 11):

  ```typescript

  import{ generateBotReply }from"../services/ai/ai.service";

  ```
- **backend: adapters/telegram.adapter.ts** (Line 13):

  ```typescript

  import{ generateBotReply }from"../services/ai/ai.service";

  ```
- **backend: bot/bot.logic.ts** (Line 5):

  ```typescript

  import{ generateShopReply }from"../services/ai/ai.service";

  ```
- **backend: routes/core/dashboard.routes.ts** (Line 4):

  ```typescript

  import{ generateStructuredMenu, generateLearnedContext }from"../../services/ai/ai.service";

  ```
- **backend: routes/messaging/conversations.routes.ts** (Line 9):

  ```typescript

  import{ generateAgentSuggestion, generateConversationSummary }from"../../services/ai/ai.service";

  ```
- **backend: services/infrastructure/queue.service.ts** (Line 1):

  ```typescript

  import{ generateBotReply, generateStructuredMenu }from"../ai/ai.service";

  ```
- **backend: services/tools/verify-prod-rules.ts** (Line 6):

  ```typescript

  import{ generateBotReply }from"../ai/ai.service";

  ```

---

### 📄 `intelligence.service.ts`

Analyzes active conversations asynchronously to score buyer intent, tag interest items, and alert agents.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **backend: adapters/instagram.adapter.ts** (Line 14):

  ```typescript

  import{ intelligenceService }from"../services/ai/intelligence.service";

  ```
- **backend: adapters/telegram.adapter.ts** (Line 16):

  ```typescript

  import{ intelligenceService }from"../services/ai/intelligence.service";

  ```
- **backend: services/tools/verify-prod-rules.ts** (Line 5):

  ```typescript

  import{ intelligenceService }from"../ai/intelligence.service";

  ```

---

### 📄 `orderParser.service.ts`

 passively parses live chats to isolate product choices and output valid, structured shop lists.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **backend: adapters/instagram.adapter.ts** (Line 15):

  ```typescript

  import{ orderParserService }from"../services/ai/orderParser.service";

  ```
- **backend: adapters/telegram.adapter.ts** (Line 17):

  ```typescript

  import{ orderParserService }from"../services/ai/orderParser.service";

  ```
- **backend: services/tools/verify-prod-rules.ts** (Line 7):

  ```typescript

  import{ orderParserService }from"../ai/orderParser.service";

  ```

---

### 📄 `sarvam.service.ts`

Integrates with Sarvam API for speech recognition, language translations, and audio translations.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **backend: adapters/telegram.adapter.ts** (Line 19):

  ```typescript

  import{ sarvamService }from"../services/ai/sarvam.service";

  ```
- **backend: routes/messaging/conversations.routes.ts** (Line 7):

  ```typescript

  import{ sarvamService }from"../../services/ai/sarvam.service";

  ```

---
