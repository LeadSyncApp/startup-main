# Telegram Environment & Routing Architecture

This document explains the runtime behavior, environment variables, routing logic, and database flag semantics governing Telegram message ingestion across local development and production environments.

---

## 1. The `isTest` Flag Semantics (Decoupled Model)

In this architecture, the `isTest` column on the `Company` Prisma model has a **single, unified responsibility**:

* **Domain Data Classification & Disposal Safety**: Distinguishing disposable automated test companies from real business customer data.
* **Safety Net for Test Cleanup**: Used exclusively by test infrastructure (`testCompanyFactory.ts`) to ensure test cleanup functions (`assertCanModifyCompany`, `cleanupTestCompany`) **NEVER** modify or delete real business data.

> [!NOTE]
> **Decoupled Architecture**:
> `isTest` **does NOT affect message transport routing**. Polling (`telegram.polling.ts`) and webhook registration (`telegram.webhook.ts`) operate independently of `isTest`. Real customer companies (such as *Om Sai Silk Boutique* with `isTest: false`) can be polled locally in development without changing their database flags.

---

## 2. Infrastructure Transport Routing Controls

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
| `src/services/messaging/telegram.polling.ts` | **Long-Polling Service** | Active if `TELEGRAM_POLLING=true`. Queries companies with `telegramConnected: true` AND `telegramBotUsername === process.env.MY_BOT_USERNAME`. Failsafe prevents polling if `MY_BOT_USERNAME` is unset. | Queries companies with `telegramConnected: true`. (Typically disabled in favor of webhooks via `TELEGRAM_POLLING=false`). |
| `src/services/messaging/telegram.webhook.ts` | **Webhook Event Ingestion** | `initializeTelegramWebhooks()` queries companies with `telegramConnected: true`. Attempts registration but gracefully skips per bot if `API_BASE_URL` contains `localhost` or `127.0.0.1`. | Queries companies with `telegramConnected: true`. Calls Telegram API `setWebhook` with public `API_BASE_URL` and `allowed_updates: ["message", "callback_query"]`. |

---

## 3. Operational Table of Current Database Companies (DB-Verified)

Below is the live operational status of all existing company records based on direct database verification:

| Company ID | Company Name | `isTest` | `telegramConnected` | Telegram Bot Username | Local Dev Polling Status (`IS_LOCAL=true`) | Production Webhook Status (`IS_LOCAL=false`) |
| :--- | :--- | :---: | :---: | :--- | :--- | :--- |
| `3102a85e-1798-45bb-b6c5-d94ea436f775` | **Om Sai Silk Boutique** | `false` | `true` | `@Newgen17_bot` | **POLLED** if `MY_BOT_USERNAME=Newgen17_bot` | **REGISTERED** (`telegramConnected: true`) |
| `6e91a188-f794-4c59-b367-44b9db07b10f` | **MD Homemades** | `true` | `true` | `@Goofygr_bot` | **POLLED** if `MY_BOT_USERNAME=Goofygr_bot` | **REGISTERED** (`telegramConnected: true`) |
| `b136e450-fb2c-4508-962a-3c165b3459b7` | **jj enterprise** | `true` | `true` | `@fucknikil_bot` | **POLLED** if `MY_BOT_USERNAME=fucknikil_bot` | **REGISTERED** (`telegramConnected: true`) |
| `a2de9e9f-7582-4394-b5c1-9b06ffe4535a` | **test** | `true` | `false` | `null` | **INACTIVE** (`telegramConnected: false`) | **INACTIVE** (`telegramConnected: false`) |

---

## 4. Operational Chain: Local Laptop vs. Deployed Production

```mermaid
flowchart TD
    subgraph Local Laptop ("npm run dev")
        A1["Env: IS_LOCAL=true\nTELEGRAM_POLLING=true\nMY_BOT_USERNAME=Newgen17_bot"] --> A2["telegram.polling.ts Starts"]
        A2 --> A3["Query DB: telegramConnected: true AND telegramBotUsername: MY_BOT_USERNAME"]
        A3 --> A4["Polls Telegram getUpdates API for @Newgen17_bot"]
        A4 --> A5["Dispatches update to local AI Orchestrator"]
    end

    subgraph Production Server ("Deployed Cloud")
        B1["Env: IS_LOCAL=false\nTELEGRAM_POLLING=false\nAPI_BASE_URL=https://api.leadsync.ai"] --> B2["telegram.webhook.ts Initializes"]
        B2 --> B3["Query DB: telegramConnected: true AND telegramBotToken: not null"]
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
| `MY_BOT_USERNAME` | Set to dev bot (e.g. `Newgen17_bot`) | **Unused / Not required** |
| `API_BASE_URL` | `http://localhost:5000` | Public HTTPS domain (e.g. `https://api.leadsync.ai`) |
| Active Transport | **Long-Polling loop** (`getUpdates`) | **HTTPS Webhook endpoint** (`setWebhook`) |

### Mandatory Requirements per Environment

#### For a Company to Work in Local Dev (`IS_LOCAL=true`):
1. `telegramConnected` must be `true`.
2. `telegramBotToken` must be non-null and decryptable.
3. `telegramBotUsername` in DB **MUST EXACTLY MATCH** `process.env.MY_BOT_USERNAME`.
4. `TELEGRAM_POLLING=true` in `.env`.

#### For a Company to Work in Deployed Production (`IS_LOCAL=false`):
1. `telegramConnected` must be `true`.
2. `telegramBotToken` must be non-null and validly encrypted.
3. `telegramWebhookSecret` must be encrypted in DB (auto-generated if missing).
4. `API_BASE_URL` on server must be a valid public HTTPS URL.
5. `allowed_updates` must include `["message", "callback_query"]`.

---

## 5. Production Deployment Checklist (Telegram Integration)

### Step 1: Environment Variable Verification
- [ ] Confirm `IS_LOCAL` resolves to `false` in production environment (`IS_LOCAL=false` or `NODE_ENV=production`).
- [ ] Confirm `TELEGRAM_POLLING=false` (or omitted) on production servers so polling loops do not run.
- [ ] Confirm `MY_BOT_USERNAME` is **NOT** set or required on production servers.
- [ ] Confirm `ENCRYPTION_KEY` in production matches the key used to encrypt `telegramBotToken` in DB.

### Step 2: Production Webhook Endpoint Reachability
- [ ] Confirm `API_BASE_URL` is set to the public HTTPS domain (e.g. `https://api.leadsync.ai`).
- [ ] Verify `setWebhook` call includes `allowed_updates: ["message", "callback_query"]`.

### Step 3: Pre-Flight Integrity Queries against Production Database

#### A. Duplicate Bot Token Check
```sql
SELECT "telegramBotToken", COUNT(*) as count, ARRAY_AGG(name) as company_names, ARRAY_AGG(id) as company_ids
FROM "Company"
WHERE "telegramBotToken" IS NOT NULL
  AND "telegramConnected" = true
GROUP BY "telegramBotToken"
HAVING COUNT(*) > 1;
```
* **Clean Result**: `0 rows returned`.

#### B. Decryption Integrity Audit
Run pre-flight decryption check via Node runner:
```ts
import { prisma } from "./src/lib/prisma";
import { decryptSecret } from "./src/utils/encryption";

async function auditProductionTokens() {
  const prodCompanies = await prisma.company.findMany({
    where: { telegramConnected: true }
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
* **Clean Result**: `0 failed`.
