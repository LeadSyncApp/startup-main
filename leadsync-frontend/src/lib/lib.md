# Frontend Module: `src/lib`

Houses UI views, states interfaces, layout modules, and sub-components for the **LIB** domain layer.

## Files and Responsibilities

### 📄 `api.ts`

Handles rendering and interface presentation.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **frontend: components/conversations/NotesPanel.tsx** (Line 4):

  ```typescript

  import{ api }from"../../lib/api";

  ```
- **frontend: components/layout/NotificationBell.tsx** (Line 4):

  ```typescript

  import{ api }from"../../lib/api";

  ```
- **frontend: components/leads/LeadsKanban.tsx** (Line 4):

  ```typescript

  import{ api }from"../../lib/api";

  ```
- **frontend: components/leads/TakeOrderModal.tsx** (Line 5):

  ```typescript

  import{ api }from"../../lib/api";

  ```
- **frontend: components/settings/AutomationManager.tsx** (Line 4):

  ```typescript

  import{ api }from"../../lib/api";

  ```
- **frontend: components/settings/BotKnowledgeManager.tsx** (Line 4):

  ```typescript

  import{ api }from"../../lib/api";

  ```
- **frontend: components/ui/GlobalSearch.tsx** (Line 5):

  ```typescript

  import{ api }from"../../lib/api";

  ```
- **frontend: pages/Login.tsx** (Line 6):

  ```typescript

  import{ api }from"../lib/api";

  ```
- **frontend: pages/Signup.tsx** (Line 6):

  ```typescript

  import{ api }from"../lib/api";// ✅ centralized API

  ```
- **frontend: pages/dashboard/agent-inbox/useInboxState.ts** (Line 2):

  ```typescript

  import{ api }from"../../../lib/api";

  ```
- **frontend: pages/dashboard/conversations/Conversations.tsx** (Line 4):

  ```typescript

  import{ api }from'../../../lib/api';

  ```

---
