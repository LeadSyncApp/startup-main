# Route Module: `routes/orders`

Responsible for handling HTTP traffic regarding the **ORDERS** domain context.

## Files and Responsibilities

### 📄 `newOrderArrivals.routes.ts`

Directs fast order claim modules letting human agents override bot checkout queues with a single-click claim.

**Defined Endpoints:**

- `GET``/` (Line 13)
- `POST``/:id/claim` (Line 95)
- `GET``/claimed` (Line 126)
- `GET``/customer/:leadId/history` (Line 187)
- `POST``/confirm-order/:orderId` (Line 204)

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **backend: app.ts** (Line 29):

  ```typescript

  import newOrderArrivalsRoutes from"./routes/orders/newOrderArrivals.routes";

  ```

---

### 📄 `orders.routes.ts`

Manages shopping carts, allowing status transformations (BOT_CREATED_ORDER, PENDING, ACCEPTED, REJECTED, PAID, DELIVERED).

**Defined Endpoints:**

- `POST``/` (Line 20)
- `GET``/` (Line 176)
- `POST``/:id/approve` (Line 257)
- `POST``/:id/reject` (Line 316)
- `PATCH``/:id/status` (Line 376)
- `POST``/:id/claim` (Line 408)
- `GET``/awaiting` (Line 461)
- `DELETE``/:id` (Line 514)

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **backend: app.ts** (Line 28):

  ```typescript

  import ordersRoutes from"./routes/orders/orders.routes";

  ```

---
