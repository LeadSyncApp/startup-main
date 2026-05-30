# Frontend Module: `src/pages/dashboard/orders`

Houses UI views, states interfaces, layout modules, and sub-components for the **PAGES/DASHBOARD/ORDERS** domain layer.

## Files and Responsibilities

### 📄 `Orders.tsx`

Orders dashboard listing customer orders and dispatching state transitions.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **frontend: App.tsx** (Line 20):

  ```typescript

  constOrders         = lazy(()=>import("./pages/dashboard/orders/Orders"));

  ```

---
