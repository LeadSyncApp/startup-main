# Frontend Module: `src/components/leads`

Houses UI views, states interfaces, layout modules, and sub-components for the **COMPONENTS/LEADS** domain layer.

## Files and Responsibilities

### 📄 `BulkActionsPanel.tsx`

Multi-selector bottom rails bulk updates assignments, deletions, or priority variables.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **frontend: pages/dashboard/leads/Leads.tsx** (Line 21):

  ```typescript

  importBulkActionsPanelfrom"@/components/leads/BulkActionsPanel.tsx";

  ```

---

### 📄 `LeadDetailModal.tsx`

Provides modal workspace reviewing customer chats history, custom metrics, and timelines.

**Inter-Module Linkages:**

This component is currently not imported or used anywhere in the application (unused file).

---

### 📄 `LeadDrawer.tsx`

Slides in from screen right to inspect inline profiles, details, and priorities fields.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **frontend: pages/dashboard/leads/Leads.tsx** (Line 7):

  ```typescript

  importLeadDrawerfrom"@/components/leads/LeadDrawer";

  ```

---

### 📄 `LeadsKanban.tsx`

Grid drag-and-drop workflow tracking lead stages from PROSPECT to DELIVERED.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **frontend: pages/dashboard/leads/Leads.tsx** (Line 13):

  ```typescript

  importLeadsKanbanfrom"@/components/leads/LeadsKanban";

  ```

---

### 📄 `LeadsTable.tsx`

Paginated workspace layout listing details columns and individual lead row modifiers.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **frontend: pages/dashboard/leads/Leads.tsx** (Line 6):

  ```typescript

  importLeadsTablefrom"@/components/leads/LeadsTable";

  ```

---

### 📄 `ManualOrderDetailModal.tsx`

Displays individual manual orders detail logs.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **frontend: pages/dashboard/leads/Leads.tsx** (Line 19):

  ```typescript

  importManualOrderDetailModalfrom"@/components/leads/ManualOrderDetailModal";

  ```

---

### 📄 `ManualOrderTable.tsx`

Table tracking draft lists and human-input POS entries.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **frontend: pages/dashboard/leads/Leads.tsx** (Line 20):

  ```typescript

  importManualOrderTablefrom"@/components/leads/ManualOrderTable";

  ```

---

### 📄 `MetricsCard.tsx`

Numeric KPI block detailed with dynamic sparkline vectors or visual delta stats.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **frontend: pages/dashboard/leads/Leads.tsx** (Line 17):

  ```typescript

  importMetricsCardfrom"@/components/leads/MetricsCard";

  ```

---

### 📄 `TakeOrderModal.tsx`

Form popup building instant direct shopping carts on behalf of customer.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **frontend: pages/dashboard/leads/Leads.tsx** (Line 18):

  ```typescript

  importTakeOrderModalfrom"@/components/leads/TakeOrderModal";

  ```

---
