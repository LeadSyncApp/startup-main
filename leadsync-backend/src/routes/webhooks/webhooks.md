# Route Module: `routes/webhooks`

Responsible for handling HTTP traffic regarding the **WEBHOOKS** domain context.

## Files and Responsibilities

### 📄 `webhook.routes.ts`

Central ingress route capturing automated payments callbacks (Stripe) and modifying order statuses to PAID.

**Defined Endpoints:**

- `POST``/razorpay` (Line 16)

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **backend: app.ts** (Line 34):

  ```typescript

  import webhookRoutes from"./routes/webhooks/webhook.routes";

  ```

---
