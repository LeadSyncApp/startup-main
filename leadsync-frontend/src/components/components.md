# Frontend Module: `src/components`

Houses UI views, states interfaces, layout modules, and sub-components for the **COMPONENTS** domain layer.

## Files and Responsibilities

### 📄 `CompletedOrderTable.tsx`

Interactive table displaying historic completed orders with client-side tabular pagination.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **frontend: pages/dashboard/orders/Orders.tsx** (Line 15):

  ```typescript

  importCompletedOrderTablefrom"@/components/CompletedOrderTable";

  ```

---

### 📄 `ErrorBoundary.tsx`

Safety boundaries capturing react component rendering crashes to fallback gracefully.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **frontend: main.tsx** (Line 9):

  ```typescript

  importErrorBoundaryfrom'./components/ErrorBoundary'

  ```

---

### 📄 `ProtectedRoute.tsx`

Client-side navigation guard verifying validation state and redirecting guests.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **frontend: App.tsx** (Line 5):

  ```typescript

  importProtectedRoutefrom"./components/ProtectedRoute";

  ```

---

### 📄 `PublicRoute.tsx`

Ensures authenticated users do not revisit registration/login views.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **frontend: App.tsx** (Line 6):

  ```typescript

  importPublicRoutefrom"./components/PublicRoute";

  ```

---

### 📄 `SectionSummary.tsx`

Compact status board presenting brief descriptions and counts for main sections.

**Inter-Module Linkages:**

This component is currently not imported or used anywhere in the application (unused file).

---
