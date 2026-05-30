# Frontend Module: `src/pages/dashboard/dashboard-home`

Houses UI views, states interfaces, layout modules, and sub-components for the **PAGES/DASHBOARD/DASHBOARD-HOME** domain layer.

## Files and Responsibilities

### 📄 `DashboardHome.tsx`

Main dashboard panel depicting active KPIs, dynamic charts, and action prompts.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **frontend: App.tsx** (Line 16):

  ```typescript

  constDashboardHome  = lazy(()=>import("./pages/dashboard/dashboard-home/DashboardHome"));

  ```

---
