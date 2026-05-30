# Services Directory

This directory is the "business logic" heart of the backend. It cleanly separates operations from the HTTP requests handling them.

## Subdirectories and their Responsibilities

### `ai/`

The intelligence engine.

- `ai.service.ts`: Integrates with LLM APIs directly to yield structured generative text replies.
- `intelligence.service.ts`: Analyzes chat transcripts asynchronously to determine Customer intent/sentiment.
- `orderParser.service.ts`: Listens passively to human chats to discern if a purchase conversation resulted in a completed entity.
- `sarvam.service.ts`: Integrates with Sarvam API specifically for fast Voice/Audio Transcription (STT) and native language translation/audio replies (TTS).

### `infrastructure/`

Underlying system capabilities decoupled from exact providers:

- `cache.service.ts`: Fast temporary memory storage (in-memory or Redis-like maps).
- `notification.service.ts`: Emits alerts locally or to web UI sockets.
- `queue.service.ts`: Manages background job deduplication for AI or mass-message dispatch.

### `integrations/`

Contains bridges to heavy external CRMs or third-party platforms outside generic channels (e.g. `crm.service.ts`, `invoice.service.ts`, `payment.service.ts`, `fileParser.service.ts`). Used once an order reaches a billing phase.

### `messaging/`

Contains heavier asynchronous messaging polling and configuration structures dedicated entirely to interacting with Telegram APIs programmatically:

`telegram.polling.ts`, `telegram.service.ts`, `telegram.webhook.ts`.

### `workflow/`

Controls multi-step transaction pipelines inside the database logic.

- `assignment.service.ts`: Executes routing logic to assign incoming leads to specific human agents based on rules.
- `newOrderArrival.service.ts` & `orderWorkflow.service.ts`: Transitions generated shopping cart sessions into persisted database objects with correct statuses (`BOT_CREATED_ORDER` -> `PENDING` -> `DELIVERED`). Limits race conditions.

### `tools/`

Contains scripts (`debug-ai.ts`, `verify-prod-rules.ts`) utilized mostly for backend debugging or internal state audits.
