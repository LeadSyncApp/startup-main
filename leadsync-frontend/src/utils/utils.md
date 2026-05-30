# Frontend Module: `src/utils`

Houses UI views, states interfaces, layout modules, and sub-components for the **UTILS** domain layer.

## Files and Responsibilities

### 📄 `formatINR.ts`

Utility library for formatting currency in Indian Rupees (INR) and Indian date style formatting.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **frontend: components/leads/LeadDetailModal.tsx** (Line 23):

  ```typescript

  import{ formatDateIN }from'../../utils/formatINR';

  ```
- **frontend: pages/dashboard/revenue/Revenue.tsx** (Line 15):

  ```typescript

  import{ formatINR }from"@/utils/formatINR";

  ```
- **frontend: pages/dashboard/reports/Reports.tsx** (Line 4):

  ```typescript

  import{ formatINR }from"@/utils/formatINR";

  ```

---

### 📄 `industryConfig.ts`

Configuration map defining customized pipeline step names, terms, icons, and colors based on the business industry field.

**Inter-Module Linkages:**

This utility file is currently not imported or used anywhere in the application (unused file).

---
