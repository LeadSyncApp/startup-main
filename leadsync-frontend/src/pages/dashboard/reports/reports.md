# Frontend Module: `src/pages/dashboard/reports`

Houses UI views, states interfaces, layout modules, and sub-components for the **PAGES/DASHBOARD/REPORTS** domain layer.

## Files and Responsibilities

### 📄 `Reports.tsx`

Renders detailed reporting widgets evaluating active channel response margins.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **frontend: App.tsx** (Line 22):

  ```typescript

  constReports        = lazy(()=>import("./pages/dashboard/reports/Reports"));

  ```

---
