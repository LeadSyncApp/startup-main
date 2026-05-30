# Utils Directory

Provides generic helper functions and logic decoupling for token generation and specialized AI shopping memory logic.

## Files and their Responsibilities

### `jwt.ts`

- **Purpose**: Wraps the `jsonwebtoken` library to standardize payload signing (`signToken`) with 7-day expiration and extraction (`verifyToken`).
- **Current Status**: Active utility.
- **Linked With**: Auth controllers (`src/routes/auth/`) and `auth.middleware.ts`.

### `shop-ai.utils.ts`

- **Purpose**: Defines pure utility functions explicitly built for the E-Commerce Language Model (LLM) workflows.

  - Generates and maintains ephemeral Shopping Session Cart state memory (`getSession`, `updateSession`, `createFreshSessionState`).
  - Acts as a structured retrieval system (`calculateRetrieval`) matching client natural language against database menus/inventory based on string similarity prior to invoking AI prompts—saving context tokens and increasing accuracy.
  - Contains JSON safety parsers (`safeJsonParse`) designed specifically to intercept broken syntax formatting outputted randomly by unpredictable LLM APIs.
- **Current Status**: Highly utilized part of the `bot.logic.ts` flow. Acts as the protective boundary between the raw DB structures and the AI.
- **Linked With**: `bot.logic.ts` and `ai.service.ts`.

## Inter-Module Linkages

### `jwt.ts`

Called or imported by files in other folders:

- **backend: routes/auth/auth.routes.ts** (Line 5):

  ```typescript

  import{ signToken }from"../../utils/jwt";

  ```

### `shop-ai.utils.ts`

Called or imported by files in other folders:

- **backend: bot/bot.logic.ts** (Line 4):

  ```typescript

  import{ getSession, updateSession, getMenuSnapshot, calculateRetrieval, createFreshSessionState }from"../utils/shop-ai.utils";

  ```
- **backend: services/ai/ai.service.ts** (Line 4):

  ```typescript

  import{ safeJsonParse, sanitizeReply, getMenuSnapshot, calculateRetrieval }from"../../utils/shop-ai.utils";

  ```
