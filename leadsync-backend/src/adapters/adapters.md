# Adapters Directory

This directory contains the integration adapters for various messaging channels. Adapters standardize the interface for receiving webhooks and sending messages across different platforms (Instagram, Telegram, etc.) into a unified format for the Leadsync backend.

## Files and their Responsibilities

### `channel.adapter.ts`

- **Purpose**: Defines the core `ChannelAdapter` typescript interface. It guarantees that any new messaging channel (e.g. WhatsApp, FB Messenger) implements required methods like `verifyWebhook`, `processWebhook`, `sendMessage`, and `sendTyping`.
- **Current Status**: Fully utilized. Acts as the foundational contract for all channel integrations.
- **Linked With**: `instagram.adapter.ts`, `telegram.adapter.ts`.

### `instagram.adapter.ts`

- **Purpose**: Implements the `ChannelAdapter` interface for Instagram. Connects to the Facebook Graph API.

  - Handles incoming webhooks from Instagram Direct Messages.
  - Automatically creates Lead or Conversation records if they don't exist.
  - Deduplicates incoming queries.
  - Triggers Auto-Assignment and notifies the relevant sales agent.
  - Calls the Bot Logic and intelligence parsers.
- **Current Status**: Active component of the multi-channel intake system.
- **Linked With**: `bot.logic.ts`, `prisma.ts`, `socket.ts`, `ai.service.ts`, `intelligence.service.ts`, `orderParser.service.ts`, `notification.service.ts`, `assignment.service.ts`.

### `telegram.adapter.ts`

- **Purpose**: Implements the `ChannelAdapter` interface for Telegram.

  - Handles text and voice notes (including resolving file downloads and translating via the Sarvam service).
  - Handles interactive UI elements, primarily Telegram Callback Queries for dynamic inline button responses (Confirm/Cancel Orders).
  - Maintains idempotency and deduplicates rapid consecutive messages.
  - Directs potential purchase requests to Bot/Human fallbacks.
- **Current Status**: Highly active and heavily utilizes deep integration logic for Telegram-specific features like voice processing and dynamic menus.
- **Linked With**: `channel.adapter.ts`, `sarvam.service.ts`, `prisma.ts`, `bot.logic.ts`, `orderParser.service.ts`, `assignment.service.ts`, cache & notification streams.

## Inter-Module Linkages

### `channel.adapter.ts`

This file is currently not referenced/called by files in other directories.

### `instagram.adapter.ts`

Called or imported by files in other folders:

- **backend: routes/messaging/instagram.routes.ts** (Line 3):

  ```typescript

  import{InstagramAdapter}from"../../adapters/instagram.adapter";

  ```

### `telegram.adapter.ts`

Called or imported by files in other folders:

- **backend: routes/messaging/conversations.routes.ts** (Line 8):

  ```typescript

  import{TelegramAdapter}from"../../adapters/telegram.adapter";

  ```
- **backend: routes/telegram/telegram.controller.ts** (Line 10):

  ```typescript

  import{TelegramAdapter}from"../../adapters/telegram.adapter";

  ```
- **backend: services/messaging/telegram.polling.ts** (Line 2):

  ```typescript

  import{TelegramAdapter}from"../../adapters/telegram.adapter";

  ```
