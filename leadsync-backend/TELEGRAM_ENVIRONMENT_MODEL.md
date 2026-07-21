# Telegram Environment & Routing Architecture (`isTest` / `IS_LOCAL`)

This document explains the runtime behavior, environment variables, routing logic, and database flag semantics governing Telegram message ingestion across local development and production environments.

---

## 1. The `isTest` Flag Overload (Known Architectural Wart)

In the current system architecture, the `isTest` column on the `Company` Prisma model is **overloaded** with two separate responsibilities:

1. **Domain Data Classification**: Distinguishing disposable automated test companies from real customer business data.
2. **Environment Routing Flag**: Directing local polling (`telegram.polling.ts`) vs. production webhook registration (`telegram.webhook.ts`).

> [!WARNING]
> **Known Wart / Technical Debt**:
> Using `isTest` to control infrastructure transport routing (polling vs webhooks) is an architectural compromise. A real customer business company (such as *Om Sai Silk Boutique*) marked with `isTest: true` during local dev testing will **NOT** have webhooks registered when deployed to production until `isTest` is explicitly flipped to `false`.

---

## 2. Environment Controls & Verified Code Lines

### Variable Resolution
`IS_LOCAL` is resolved centrally in [`src/services/messaging/telegramSelector.service.ts:3`](file:///d:/startup-backup/startup-new/startup/leadsync-backend/src/services/messaging/telegramSelector.service.ts#L3):

```ts
export const IS_LOCAL = process.env.IS_LOCAL === "true" || process.env.NODE_ENV !== "production";
```

`TELEGRAM_POLLING` is checked at the top of [`src/services/messaging/telegram.polling.ts:15`](file:///d:/startup-backup/startup-new/startup/leadsync-backend/src/services/messaging/telegram.polling.ts#L15):
```ts
if (process.env.TELEGRAM_POLLING !== "true") {
  console.log("ℹ️ Telegram Polling is disabled. Webhook-mode will be used.");
  return;
}
```

The public URL check in [`src/services/messaging/telegram.webhook.ts:12-15`](file:///d:/startup-backup/startup-new/startup/leadsync-backend/src/services/messaging/telegram.webhook.ts#L12-L15) skips webhook registration if `API_BASE_URL` is local:
```ts
if (!apiBaseUrl || apiBaseUrl.includes("localhost") || apiBaseUrl.includes("127.0.0.1")) {
  console.warn(`⚠️ Skipping Telegram webhook registration: API_BASE_URL is not public (${apiBaseUrl})`);
  return { ok: false, description: "Not a public URL" };
}
```

---

### Behavior Matrix: Polling vs. Webhook

| File | Subsystem | Behavior when `IS_LOCAL=true` (Local Dev) | Behavior when `IS_LOCAL=false` (Production) |
| :--- | :--- | :--- | :--- |
| `src/services/messaging/telegram.polling.ts` | **Long-Polling Service** | Active if `TELEGRAM_POLLING=true`. Queries companies with `isTest: true` AND `telegramBotUsername === process.env.MY_BOT_USERNAME`. Failsafe prevents polling if `MY_BOT_USERNAME` is unset. | Queries companies with `isTest: false`. (Typically disabled in favor of webhooks via `TELEGRAM_POLLING=false`). |
| `src/services/messaging/telegram.webhook.ts` | **Webhook Event Ingestion** | `initializeTelegramWebhooks()` queries `isTest: false` companies. Attempts registration but gracefully skips per bot if `API_BASE_URL` contains `localhost` or `127.0.0.1`. | Queries `isTest: false` companies. Calls Telegram API `setWebhook` with public `API_BASE_URL` and `allowed_updates: ["message", "callback_query"]`. |

---

## 3. Operational Table of Current Database Companies (DB-Verified)

Below is the live operational status of all existing company records based on direct database verification:

| Company ID | Company Name | `isTest` | `telegramConnected` | Telegram Bot Username | Local Dev Polling Status (`IS_LOCAL=true`) | Production Webhook Status (`IS_LOCAL=false`) |
| :--- | :--- | :---: | :---: | :--- | :--- | :--- |
| `3102a85e-1798-45bb-b6c5-d94ea436f775` | **Om Sai Silk Boutique** | `true` | `true` | `@Newgen17_bot` | **POLLED** if `MY_BOT_USERNAME=Newgen17_bot` | **SKIPPED** (Ignored by `initializeTelegramWebhooks` because `isTest=true`) |
| `6e91a188-f794-4c59-b367-44b9db07b10f` | **MD Homemades** | `true` | `true` | `@Goofygr_bot` | **POLLED** if `MY_BOT_USERNAME=Goofygr_bot` | **SKIPPED** (Ignored because `isTest=true`) |
| `b136e450-fb2c-4508-962a-3c165b3459b7` | **jj enterprise** | `true` | `true` | `@fucknikil_bot` | **POLLED** if `MY_BOT_USERNAME=fucknikil_bot` | **SKIPPED** (Ignored because `isTest=true`) |
| `a2de9e9f-7582-4394-b5c1-9b06ffe4535a` | **test** | `true` | `false` | `null` | **INACTIVE** (`telegramConnected: false`) | **INACTIVE** (`telegramConnected: false`) |

### Provenance of Company `a2de9e9f-7582-4394-b5c1-9b06ffe4535a` ("test")
* **Created At**: `2026-07-18T06:53:28.744Z`
* **User Email**: `digitalma7321@gmail.com`
* **Company Code**: `DIGITAL5017`
* **Origin**: Created during web UI onboarding/signup testing on July 18.
* **Child Record Audit**: Contains 1 User (`digitalma7321@gmail.com`), 0 Leads, 0 Conversations, 0 Orders, 0 ConversationalRules.
* **Why omitted from earlier Telegram audits**: `telegramConnected` is `false` and `telegramBotToken` is `null`. Because all Telegram polling/webhook queries include `where: { telegramConnected: true }`, this record never matches any Telegram query and has been completely inert.

---

## 4. Operational Chain: Local Laptop vs. Deployed Production

```mermaid
flowchart TD
    subgraph Local Laptop ("npm run dev")
        A1["Env: IS_LOCAL=true\nTELEGRAM_POLLING=true\nMY_BOT_USERNAME=Goofygr_bot"] --> A2["telegram.polling.ts Starts"]
        A2 --> A3["Query DB: isTest: true AND telegramBotUsername: MY_BOT_USERNAME"]
        A3 --> A4["Polls Telegram getUpdates API for @Goofygr_bot"]
        A4 --> A5["Dispatches update to local AI Orchestrator"]
    end

    subgraph Production Server ("Deployed Cloud")
        B1["Env: IS_LOCAL=false\nTELEGRAM_POLLING=false\nAPI_BASE_URL=https://api.leadsync.ai"] --> B2["telegram.webhook.ts Initializes"]
        B2 --> B3["Query DB: isTest: false AND telegramConnected: true"]
        B3 --> B4["Calls Telegram setWebhook with allowed_updates: ['message', 'callback_query']"]
        B4 --> B5["Telegram POSTs updates to https://api.leadsync.ai/api/webhook/telegram/webhook"]
        B5 --> B6["Dispatches update to Production AI Orchestrator"]
    end
```

### Environment Variable Differences

| Configuration Parameter | Local Laptop (`npm run dev`) | Deployed Production Server |
| :--- | :--- | :--- |
| `IS_LOCAL` | `true` | `false` |
| `NODE_ENV` | `development` | `production` |
| `TELEGRAM_POLLING` | `true` | `false` (or unset) |
| `MY_BOT_USERNAME` | Set to dev bot (e.g. `Goofygr_bot`) | **Unused / Not required** |
| `API_BASE_URL` | `http://localhost:5000` | Public HTTPS domain (e.g. `https://api.leadsync.ai`) |
| Active Transport | **Long-Polling loop** (`getUpdates`) | **HTTPS Webhook endpoint** (`setWebhook`) |

### Mandatory Requirements per Environment

#### For a Company to Work in Local Dev (`IS_LOCAL=true`):
1. `isTest` must be `true`.
2. `telegramConnected` must be `true`.
3. `telegramBotToken` must be non-null and decryptable.
4. `telegramBotUsername` in DB **MUST EXACTLY MATCH** `process.env.MY_BOT_USERNAME`.
5. `TELEGRAM_POLLING=true` in `.env`.

#### For a Company to Work in Deployed Production (`IS_LOCAL=false`):
1. `isTest` **MUST BE `false`** (Critical: `initializeTelegramWebhooks` filters out `isTest: true`).
2. `telegramConnected` must be `true`.
3. `telegramBotToken` must be non-null and validly encrypted.
4. `telegramWebhookSecret` must be encrypted in DB (auto-generated if missing).
5. `API_BASE_URL` on server must be a valid public HTTPS URL.
6. `allowed_updates` must include `["message", "callback_query"]`.

---

## 5. Production Deployment Checklist (Telegram Integration)

Follow this checklist prior to and during any live production deployment to ensure zero token collisions, valid webhook registration, and isolation of test data.

### Step 1: Database Flag Flip for Production Companies
- [ ] For `3102a85e-1798-45bb-b6c5-d94ea436f775` (**Om Sai Silk Boutique**) and any future real business company, set `isTest = false` in the production database:
  ```sql
  UPDATE "Company"
  SET "isTest" = false
  WHERE id = '3102a85e-1798-45bb-b6c5-d94ea436f775';
  ```
  *Why*: `initializeTelegramWebhooks()` filters strictly by `isTest: false`. If `isTest` remains `true`, production webhook registration will skip this company.

### Step 2: Environment Variable Verification
- [ ] Confirm `IS_LOCAL` resolves to `false` in production environment (`IS_LOCAL=false` or `NODE_ENV=production`).
- [ ] Confirm `TELEGRAM_POLLING=false` (or omitted) on production servers so polling loops do not run.
- [ ] Confirm `MY_BOT_USERNAME` is **NOT** set or required on production servers (production webhooks use `secret_token` HMAC routing).
- [ ] Confirm `ENCRYPTION_KEY` in production matches the key used to encrypt `telegramBotToken` in DB.

### Step 3: Production Webhook Endpoint Reachability
- [ ] Confirm `API_BASE_URL` is set to the public HTTPS domain (e.g. `https://api.leadsync.ai`).
- [ ] Verify `setWebhook` call includes `allowed_updates: ["message", "callback_query"]` so both text messages and inline button taps are delivered.

### Step 4: Pre-Flight Integrity Queries against Production Database

Run these diagnostic SQL queries directly against the target database before starting the production application server:

#### A. Duplicate Bot Token Check
```sql
SELECT "telegramBotToken", COUNT(*) as count, ARRAY_AGG(name) as company_names, ARRAY_AGG(id) as company_ids
FROM "Company"
WHERE "telegramBotToken" IS NOT NULL
  AND "telegramConnected" = true
  AND "isTest" = false
GROUP BY "telegramBotToken"
HAVING COUNT(*) > 1;
```
* **Clean Result**: `0 rows returned`.
* **Action if > 0 rows**: Resolve duplicate tokens immediately before deployment to avoid cross-tenant misrouting.

#### B. Decryption Integrity Audit
Run pre-flight decryption check via Node runner:
```ts
import { prisma } from "./src/lib/prisma";
import { decryptSecret } from "./src/utils/encryption";

async function auditProductionTokens() {
  const prodCompanies = await prisma.company.findMany({
    where: { telegramConnected: true, isTest: false }
  });

  let failed = 0;
  for (const c of prodCompanies) {
    const tokenDecrypted = decryptSecret(c.telegramBotToken);
    if (!tokenDecrypted) {
      console.error(`❌ Decryption failed for company: ${c.name} (${c.id})`);
      failed++;
    }
  }
  console.log(`Audit complete: ${prodCompanies.length} checked, ${failed} failed.`);
}
auditProductionTokens();
```
* **Clean Result**: `0 failed`. All production bot tokens decrypt successfully using the server's `ENCRYPTION_KEY`.

### Step 5: Test Company Isolation Audit
- [ ] Verify test companies (`MD Homemades` `6e91a188`, `jj enterprise` `b136e450`) retain `isTest = true` in production database.
- [ ] Confirm `initializeTelegramWebhooks` output during startup logs `0` webhooks registered for test companies.
