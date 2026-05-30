# Frontend Module: `src/components/layout`

Houses UI views, states interfaces, layout modules, and sub-components for the **COMPONENTS/LAYOUT** domain layer.

## Files and Responsibilities

### 📄 `DashboardLayout.tsx`

Base structural frame bundling unified sidebars, header blocks, and responsive side sheets.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **frontend: App.tsx** (Line 7):

  ```typescript

  importDashboardLayoutfrom"./components/layout/DashboardLayout";

  ```

---

### 📄 `MarketingNav.tsx`

Public homepage header with responsive links and call-to-actions.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **frontend: pages/Home.tsx** (Line 7):

  ```typescript

  importMarketingNavfrom'../components/layout/MarketingNav';

  ```

---

### 📄 `NotificationBell.tsx`

Dynamic status badge displaying numeric highlights for new notification alerts.

**Inter-Module Linkages:**

No external linkages or imports from other directories.

---

### 📄 `Sidebar.tsx`

Left-rail controls containing role-restricted routes and responsive navigation links.

**Inter-Module Linkages:**

No external linkages or imports from other directories.

---
