# Frontend Module: `src/pages/dashboard/internal-note`

Houses UI views, states interfaces, layout modules, and sub-components for the **PAGES/DASHBOARD/INTERNAL-NOTE** domain layer.

## Files and Responsibilities

### 📄 `InternalNote.tsx`

Collaboration board letting operators input short logs regarding leads.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **frontend: pages/dashboard/agent-inbox/AgentCenterPanel.tsx** (Line 6):

  ```typescript

  import { NoteData } from "../internal-note/InternalNote";

  ```
- **frontend: pages/dashboard/agent-inbox/AgentChatFeed.tsx** (Line 2):

  ```typescript

  import { NoteData } from "../internal-note/InternalNote";

  ```
- **frontend: pages/dashboard/agent-inbox/useInboxState.ts** (Line 7):

  ```typescript

  import { NoteData } from "../internal-note/InternalNote";

  ```

---
