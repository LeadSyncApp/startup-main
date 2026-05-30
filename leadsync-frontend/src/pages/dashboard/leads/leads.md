# Frontend Module: `src/pages/dashboard/leads`

Houses UI views, states interfaces, layout modules, and sub-components for the **PAGES/DASHBOARD/LEADS** domain layer.

## Files and Responsibilities

### 📄 `Leads.tsx`

Master lead manager routing to active kanbans, bulk modifiers, and drawers.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **frontend: App.tsx** (Line 19):

  ```typescript

  constLeads          = lazy(()=>import("./pages/dashboard/leads/Leads"));

  ```

---
