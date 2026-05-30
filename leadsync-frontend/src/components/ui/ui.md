# Frontend Module: `src/components/ui`

Houses UI views, states interfaces, layout modules, and sub-components for the **COMPONENTS/UI** domain layer.

## Files and Responsibilities

### 📄 `Animations.tsx`

Declares Framer Motion fade-ins, sliding panels, and modal transition configs.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **frontend: pages/dashboard/new-order-arrivals/NewOrderArrivals.tsx** (Line 15):

  ```typescript

  import{PageTransition}from"@/components/ui/Animations";

  ```
- **frontend: pages/dashboard/revenue/Revenue.tsx** (Line 26):

  ```typescript

  import{PageTransition}from"@/components/ui/Animations";

  ```
- **frontend: pages/dashboard/leads/Leads.tsx** (Line 11):

  ```typescript

  import{PageTransition}from"@/components/ui/Animations";

  ```
- **frontend: pages/dashboard/orders/Orders.tsx** (Line 13):

  ```typescript

  import{PageTransition}from"@/components/ui/Animations";

  ```
- **frontend: pages/dashboard/reports/Reports.tsx** (Line 5):

  ```typescript

  import{PageTransition}from"@/components/ui/Animations";

  ```
- **frontend: pages/dashboard/broadcasts/Broadcasts.tsx** (Line 6):

  ```typescript

  import{PageTransition}from"@/components/ui/Animations";

  ```
- **frontend: pages/dashboard/settings/Settings.tsx** (Line 5):

  ```typescript

  import{PageTransition}from"@/components/ui/Animations";

  ```

---

### 📄 `EmptyState.tsx`

Placeholder layout showing instructions when table lists or feeds are blank.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **frontend: pages/dashboard/leads/Leads.tsx** (Line 10):

  ```typescript

  import{EmptyLeads}from"@/components/ui/EmptyState";

  ```
- **frontend: pages/dashboard/broadcasts/Broadcasts.tsx** (Line 7):

  ```typescript

  import{EmptyBroadcasts}from"@/components/ui/EmptyState";

  ```

---

### 📄 `GlobalSearch.tsx`

Universal input matching search targets across users, menus, and pages.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **frontend: components/layout/DashboardLayout.tsx** (Line 5):

  ```typescript

  importGlobalSearchfrom"../ui/GlobalSearch";

  ```

---

### 📄 `Modal.tsx`

Lightweight template with key escapes, click-outs, and sizing flags.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **frontend: components/leads/LeadDetailModal.tsx** (Line 22):

  ```typescript

  importModalfrom'../ui/Modal';

  ```

---

### 📄 `Skeleton.tsx`

Elegant placeholder bars reflecting loading structures before actual data loads.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **frontend: pages/dashboard/new-order-arrivals/NewOrderArrivals.tsx** (Line 16):

  ```typescript

  import{TableSkeleton}from"@/components/ui/Skeleton";

  ```
- **frontend: pages/dashboard/revenue/Revenue.tsx** (Line 27):

  ```typescript

  import{ChartSkeleton,StatCardSkeleton}from"@/components/ui/Skeleton";

  ```
- **frontend: pages/dashboard/dashboard-home/DashboardHome.tsx** (Line 21):

  ```typescript

  import{DashboardSkeleton}from"@/components/ui/Skeleton";

  ```
- **frontend: pages/dashboard/leads/Leads.tsx** (Line 9):

  ```typescript

  import{TableSkeleton}from"@/components/ui/Skeleton";

  ```

---

### 📄 `Spinner.tsx`

Adaptive rotating loader indicator of background API updates.

**Inter-Module Linkages:**

This component is currently not imported or used anywhere in the application (unused file).

---

### 📄 `StatusBadge.tsx`

Stylized tag presenting statuses like PENDING, EN_ROUTE, or CANCELLED.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **frontend: pages/dashboard/agent-inbox/AgentChatHeader.tsx** (Line 2):

  ```typescript

  import{StatusBadge}from"../../../components/ui/StatusBadge";

  ```
- **frontend: pages/dashboard/agent-inbox/AgentLeftPanel.tsx** (Line 2):

  ```typescript

  import{StatusBadge}from"../../../components/ui/StatusBadge";

  ```

---

### 📄 `Tabs.tsx`

Tab selectors controlling sliding state transitions in settings panels.

**Inter-Module Linkages:**

This component is currently not imported or used anywhere in the application (unused file).

---

### 📄 `ThemeToggle.tsx`

Quick header button switching theme context preferences.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **frontend: components/layout/DashboardLayout.tsx** (Line 6):

  ```typescript

  importThemeTogglefrom"../ui/ThemeToggle";

  ```
- **frontend: components/layout/MarketingNav.tsx** (Line 8):

  ```typescript

  importThemeTogglefrom"../ui/ThemeToggle";

  ```
- **frontend: components/layout/Sidebar.tsx** (Line 18):

  ```typescript

  importThemeTogglefrom"../ui/ThemeToggle";

  ```

---

### 📄 `Toast.tsx`

Self-closing floating indicator populating message warnings.

**Inter-Module Linkages:**

This component is currently not imported or used anywhere in the application (unused file).

---

### 📄 `ToastContainer.tsx`

Fixed coordinate stack organizing active toast components on screen.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **frontend: main.tsx** (Line 8):

  ```typescript

  importToastContainerfrom'./components/ui/ToastContainer'

  ```

---
