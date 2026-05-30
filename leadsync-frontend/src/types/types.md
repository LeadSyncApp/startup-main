# Frontend Module: `src/types`

Houses UI views, states interfaces, layout modules, and sub-components for the **TYPES** domain layer.

## Files and Responsibilities

### 📄 `index.ts`

Handles rendering and interface presentation.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **frontend: components/conversations/ChatPanel.tsx** (Line 28):

  ```typescript

  importtype{Message,LeadPriority}from'../../types';

  ```
- **frontend: components/leads/LeadDetailModal.tsx** (Line 24):

  ```typescript

  importtype{Lead,Message,User}from'../../types';

  ```
- **frontend: components/ui/Toast.tsx** (Line 6):

  ```typescript

  importtype{ToastMessage}from'../../types';

  ```

---

### 📄 `react-confetti.d.ts`

Handles rendering and interface presentation.

**Inter-Module Linkages:**

No external linkages or imports from other directories.

---
