# Frontend Module: `src/pages/dashboard/conversations`

Houses UI views, states interfaces, layout modules, and sub-components for the **PAGES/DASHBOARD/CONVERSATIONS** domain layer.

## Files and Responsibilities

### 📄 `Conversations.tsx`

Split layout overview mapping live channels, manual overrides, and mode toggles.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **frontend: App.tsx** (Line 18):

  ```typescript

  constConversations  = lazy(()=>import("./pages/dashboard/conversations/Conversations"));

  ```

---
