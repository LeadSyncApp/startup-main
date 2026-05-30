# Frontend Module: `src/pages/dashboard/broadcasts`

Houses UI views, states interfaces, layout modules, and sub-components for the **PAGES/DASHBOARD/BROADCASTS** domain layer.

## Files and Responsibilities

### 📄 `Broadcasts.tsx`

Console drafting promotional broadcasts to distribute across active channels.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **frontend: App.tsx** (Line 25):

  ```typescript

  constBroadcasts     = lazy(()=>import("./pages/dashboard/broadcasts/Broadcasts"));

  ```

---
