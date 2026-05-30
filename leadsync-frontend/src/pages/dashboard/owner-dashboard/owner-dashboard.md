# Frontend Module: `src/pages/dashboard/owner-dashboard`

Houses UI views, states interfaces, layout modules, and sub-components for the **PAGES/DASHBOARD/OWNER-DASHBOARD** domain layer.

## Files and Responsibilities

### 📄 `OwnerDashboard.tsx`

Restricted cockpit tracking absolute workspace revenue, totals, and records.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **frontend: App.tsx** (Line 26):

  ```typescript

  constOwnerDashboard= lazy(()=>import("./pages/dashboard/owner-dashboard/OwnerDashboard"));

  ```

---
