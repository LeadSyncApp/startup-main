# Bot Directory

This directory manages the conversational logic and AI agent rules that act as the first line of defense for incoming customer queries.

## Files and their Responsibilities

### `bot.logic.ts`

- **Purpose**: The central brain for routing bot conversations.

  - Distinguishes between Human mode and Bot mode.
  - Fuses internal structured merchant knowledge base (botLearnedContext/Menu) with customer profile specifics (total spend, segments).
  - Tracks the customer session logic (active carts/abandoned checkouts via `getSession`/`updateSession`).
  - Calls `generateShopReply` to interact with LLMs and ultimately transforms those intentions into action items (like calling `newOrderArrivalService`).
- **Current Status**: Core backbone of the AI response generation capabilities. Fully operational.
- **Linked With**: `prisma.ts`, `newOrderArrival.service.ts`, `shop-ai.utils.ts`, `ai.service.ts`.

### `telegram.sender.ts`

- **Purpose**: Provides modular, straightforward utility functions (`sendTelegramMessage`, `sendChatAction`) bypassing the heavier adapter for situations where simply emitting an outbound API call to Telegram is required.
- **Current Status**: Active helper script, primarily decoupling outbound REST calls from the complex Webhook intake.
- **Linked With**: Used wherever direct outbound Telegram requests without Webhook context are needed.

## Inter-Module Linkages

### `bot.logic.ts`

Called or imported by files in other folders:

- **backend: adapters/instagram.adapter.ts** (Line 3):

  ```typescript

  import{ handleBotMessage }from"../bot/bot.logic";

  ```
- **backend: adapters/telegram.adapter.ts** (Line 21):

  ```typescript

  import{ handleBotMessage }from"../bot/bot.logic";

  ```

### `telegram.sender.ts`

Called or imported by files in other folders:

- **backend: routes/messaging/conversations.routes.ts** (Line 4):

  ```typescript

  import{ sendTelegramMessage }from"../../bot/telegram.sender";

  ```
- **backend: routes/orders/orders.routes.ts** (Line 11):

  ```typescript

  import{ sendTelegramMessage }from"../../bot/telegram.sender";

  ```
- **backend: services/messaging/customerMessaging.service.ts** (Line 2):

  ```typescript

  import{ sendTelegramMessage }from"../../bot/telegram.sender";

  ```
