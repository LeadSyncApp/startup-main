# Website Webhook Integration

## Overview

The Website webhook integration allows external websites, landing pages, e-commerce platforms (Shopify, WooCommerce), and custom form builders to send lead data into LeadSync via signed HTTP POST requests. The endpoint supports three authentication modes — one per platform — detected automatically from the signature header.

## Endpoint

```
POST /api/webhook/{companyId}
```

Where `{companyId}` is the UUID of the target company.

## Supported Platforms

| Platform      | Signature Header              | Encoding | Secret Field                |
|---------------|-------------------------------|----------|-----------------------------|
| Custom        | `X-Webhook-Signature`         | hex      | `websiteWebhookSecret`      |
| Shopify       | `X-Shopify-Hmac-SHA256`       | base64   | `shopifyWebhookSecret`      |
| WooCommerce   | `X-WC-Webhook-Signature`      | base64   | `wooCommerceWebhookSecret`  |

The middleware detects which header is present and validates against the matching secret. Only one header should be sent per request.

---

## Custom Website Authentication

Use the `X-Webhook-Signature` header with format `sha256=<hex-digest>`.

### Signing Algorithm

1. Serialize your payload as a JSON string (no extra whitespace).
2. Compute `HMAC-SHA256(payload, companyWebhookSecret)`.
3. Hex-encode the digest.
4. Set the header to `sha256=<hex-digest>`.

### Example (Node.js)

```js
const crypto = require("crypto");

const payload = JSON.stringify({ phone: "9876543210", name: "Jane Doe" });
const secret = "your-company-webhook-secret";

const signature = "sha256=" + crypto.createHmac("sha256", secret).update(payload).digest("hex");

fetch("https://your-leadsync-domain.com/api/webhook/{companyId}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Webhook-Signature": signature,
  },
  body: payload,
});
```

### Example (Python)

```python
import hmac, hashlib, json, requests

payload = json.dumps({"phone": "9876543210", "name": "Jane Doe"})
secret = "your-company-webhook-secret"

signature = "sha256=" + hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()

requests.post(
    "https://your-leadsync-domain.com/api/webhook/{companyId}",
    headers={"Content-Type": "application/json", "X-Webhook-Signature": signature},
    data=payload,
)
```

---

## Shopify Authentication

Shopify signs webhooks using `X-Shopify-Hmac-SHA256` with **base64** encoding (not hex).

### How to configure

1. In your Shopify admin, go to **Settings > Notifications > Webhooks**.
2. Create a webhook with the delivery URL pointing to `POST /api/webhook/{companyId}`.
3. Copy the webhook secret (or your app's API secret key) and store it as `shopifyWebhookSecret` in the Company record.
4. Ensure the webhook sends `X-Shopify-Hmac-SHA256` — Shopify does this automatically for all webhooks.

### Verification algorithm

```
expected = base64(HMAC-SHA256(rawBody, shopifyWebhookSecret))
```

Compare with the `X-Shopify-Hmac-SHA256` header value using constant-time comparison.

### Example (Node.js)

```js
const crypto = require("crypto");

const rawBody = req.rawBody; // Buffer, NOT parsed JSON
const secret = "your-shopify-webhook-secret";

const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
const provided = req.headers["x-shopify-hmac-sha256"];

const valid = crypto.timingSafeEqual(
  Buffer.from(expected, "utf-8"),
  Buffer.from(provided, "utf-8")
);
```

---

## WooCommerce Authentication

WooCommerce signs webhooks using `X-WC-Webhook-Signature` with **base64** encoding.

### How to configure

1. In your WooCommerce admin, go to **WooCommerce > Settings > Advanced > Webhooks**.
2. Create a webhook with the delivery URL pointing to `POST /api/webhook/{companyId}`.
3. Set the secret and store it as `wooCommerceWebhookSecret` in the Company record.
4. WooCommerce will send `X-WC-Webhook-Signature` automatically.

### Verification algorithm

```
expected = base64(HMAC-SHA256(rawBody, wooCommerceWebhookSecret))
```

Compare with the `X-WC-Webhook-Signature` header value using constant-time comparison.

### Example (Node.js)

```js
const crypto = require("crypto");

const rawBody = req.rawBody; // Buffer, NOT parsed JSON
const secret = "your-woocommerce-webhook-secret";

const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
const provided = req.headers["x-wc-webhook-signature"];

const valid = crypto.timingSafeEqual(
  Buffer.from(expected, "utf-8"),
  Buffer.from(provided, "utf-8")
);
```

---

## Platform Detection

The middleware detects which platform sent the webhook by checking which signature header is present:

- `X-Shopify-Hmac-SHA256` → Shopify parser
- `X-WC-Webhook-Signature` → WooCommerce parser
- `X-Webhook-Signature` → Custom parser

**This is header-based, not shape-based.** A Shopify-shaped payload (with `total_price` and `customer` fields) sent with a Custom `X-Webhook-Signature` header will be parsed using the Custom parser. This eliminates the ambiguity risk of shape-guessing.

Shape-based detection is only used as a fallback when no platform-specific header is present (should not normally occur).

---

## Payload Format

### Custom Webhooks

| Field         | Required | Description                                      |
|---------------|----------|--------------------------------------------------|
| `phone`       | Yes*     | Contact phone number (auto-normalized)           |
| `name`        | No       | Full name of the contact                         |
| `email`       | No       | Email address                                    |
| `message`     | No       | Lead message or inquiry text                     |
| `source`      | No       | Source label (default: `"website"`)              |
| `customFields`| No       | Object of custom key-value pairs                 |

### Shopify Webhooks

Shopify sends the full order object. The parser extracts:
- `customer.first_name` + `customer.last_name` → contact name
- `customer.phone` or `billing_address.phone` or `shipping_address.phone` → phone
- `total_price` → order total
- `line_items` → item descriptions
- `shipping_address` → address

### WooCommerce Webhooks

WooCommerce sends the full order object. The parser extracts:
- `billing.first_name` + `billing.last_name` → contact name
- `billing.phone` → phone
- `total` → order total
- `line_items` → item descriptions
- `shipping` → address

*Requests missing a valid phone number are accepted with status `"ignored"` (HTTP 200). They are not queued.

---

## Response Codes

| Status | Meaning                                                     |
|--------|-------------------------------------------------------------|
| 202    | Payload accepted and queued for processing                  |
| 200    | Payload valid but ignored (e.g., missing phone)             |
| 401    | Authentication failed (missing, malformed, or wrong secret) |
| 404    | Company not found                                           |
| 500    | Queue service error — safe to retry                         |

---

## Delivery Observability

Every incoming webhook is logged to the `WebhookDeliveryLog` table, regardless of outcome.

### Log fields

| Field        | Description                                        |
|--------------|----------------------------------------------------|
| `companyId`  | Target company UUID                                |
| `platform`   | `custom`, `shopify`, or `woocommerce`              |
| `outcome`    | `accepted`, `ignored`, `rejected`, or `error`      |
| `reason`     | Human-readable reason for non-accepted outcomes    |
| `statusCode` | HTTP status code returned                          |
| `rawPayload` | First 4000 chars of the JSON body                  |
| `rawHeaders` | Signature header presence summary                  |
| `createdAt`  | Timestamp                                          |

### Viewing logs

```
GET /api/company/webhook-logs?limit=50&offset=0
Authorization: Bearer <jwt-token>
```

Returns paginated delivery logs for the caller's company. Owner or Manager role required.

**Response (200):**
```json
{
  "logs": [
    {
      "id": "...",
      "platform": "shopify",
      "outcome": "accepted",
      "reason": null,
      "statusCode": 202,
      "createdAt": "2026-07-21T..."
    }
  ],
  "total": 142,
  "limit": 50,
  "offset": 0
}
```

---

## Webhook Replay

Failed deliveries (outcome = `error` or `rejected`) can be replayed through the same processing pipeline.

```
POST /api/company/webhook-logs/{logId}/replay
Authorization: Bearer <jwt-token>
```

- Only `error` or `rejected` deliveries can be replayed.
- The stored raw payload is re-parsed and enqueued.
- A new log entry is created for the replayed delivery.
- Owner role required.

**Response (200):**
```json
{
  "message": "Delivery replayed successfully",
  "logId": "..."
}
```

---

## Secret Rotation

Rotate any platform secret at any time:

```
POST /api/company/rotate-webhook-secret
Authorization: Bearer <jwt-token>
```

**Response (200):**
```json
{
  "message": "Website webhook secret rotated. Update your webhook URL with the new secret immediately — the old secret is no longer accepted.",
  "secret": "<new-64-char-hex-secret>"
}
```

The old secret is immediately invalidated. Update your webhook sender to use the new secret before the next request.

---

## Testing

Run the end-to-end security tests:

```bash
# Start the server (WEB mode — no worker/scheduler needed)
set PROCESS_PROFILE=WEB
npx ts-node --transpile-only src/server.ts

# In another terminal:
node scratch/e2e-webhook-test.js          # Custom signature tests (8/8)
node scratch/e2e-platform-signatures.js   # Shopify + WooCommerce tests (6/6)
node scratch/e2e-parser-disambig.js       # Parser disambiguation tests (3/3)
node scratch/e2e-delivery-log.js          # Delivery log tests (7/7)
node scratch/e2e-replay.js                # Replay endpoint tests (5/5)
```

Each test script creates a disposable test company (`isTest: true`), runs its tests, and automatically tears down the test company. No real data is touched.

---

## Security Notes

- Each platform has its own secret stored in a separate Company column.
- Shopify and WooCommerce use **base64** encoding; Custom uses **hex** encoding.
- The HMAC always operates on the raw JSON body bytes — do not re-serialize before signing.
- Route collision is prevented by Express route ordering: static paths (`/instagram`, `/razorpay`) are registered before the dynamic `/:companyId` path.
- All delivery attempts are logged for audit purposes.

---

## Internal Architecture

```
POST /api/webhook/:companyId
        │
        ▼
websiteWebhookValidator.ts    (detect header → validate HMAC → set req.detectedPlatform)
        │                          logs rejected requests to WebhookDeliveryLog
        ▼
website.routes.ts             (platform-specific parser → StandardMessageFrame)
        │                          logs accepted/ignored requests
        ▼
pgBoss("webhook.process")     (enqueue for async processing)
        │
        ▼
webhookPersistence.service    (save to IncomingWebhook table)
```
