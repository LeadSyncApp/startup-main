# Frontend Module: `src/pages/dashboard/settings`

Houses UI views, states interfaces, layout modules, and sub-components for the **PAGES/DASHBOARD/SETTINGS** domain layer.

## Files and Responsibilities

### 📄 `Settings.tsx`

Workspace control center mapping integrations, menu loaders, and AI properties.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **frontend: App.tsx** (Line 23):

  ```typescript

  const Settings       = lazy(() => import("./pages/dashboard/settings/Settings"));

  ```

---
