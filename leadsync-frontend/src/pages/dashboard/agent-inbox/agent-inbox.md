
# Frontend Module: `src/pages/dashboard/agent-inbox`

Houses UI views, states interfaces, layout modules, and sub-components for the **PAGES/DASHBOARD/AGENT-INBOX** domain layer.

## Files and Responsibilities

### 📄 `AgentCenterPanel.tsx`

Main conversational canvas feeding real-time message streams.

**Inter-Module Linkages:**

Called or imported by files in the same folder:

- **frontend: pages/dashboard/agent-inbox/AgentInbox.tsx** (Line 3):

  ```typescript

  import{AgentCenterPanel}from"./AgentCenterPanel";

  ```

---

### 📄 `AgentChatFeed.tsx`

Lists historical bubble logs, time indicators, and sender tags.

**Inter-Module Linkages:**

Called or imported by files in the same folder:

- **frontend: pages/dashboard/agent-inbox/AgentCenterPanel.tsx** (Line 3):

  ```typescript

  import{AgentChatFeed}from"./AgentChatFeed";

  ```

---

### 📄 `AgentChatFooter.tsx`

Input footer containing quick buttons for voice translations and saved replies.

**Inter-Module Linkages:**

Called or imported by files in the same folder:

- **frontend: pages/dashboard/agent-inbox/AgentCenterPanel.tsx** (Line 4):

  ```typescript

  import{AgentChatFooter}from"./AgentChatFooter";

  ```

---

### 📄 `AgentChatHeader.tsx`

Header bar details of current customer channels and manual controls.

**Inter-Module Linkages:**

This component is currently not imported or used anywhere in the application (unused file).

---

### 📄 `AgentConfirmModal.tsx`

Confirmation popups executing operator updates of claims actions.

**Inter-Module Linkages:**

Called or imported by files in the same folder:

- **frontend: pages/dashboard/agent-inbox/AgentInbox.tsx** (Line 5):

  ```typescript

  import{AgentConfirmModal}from"./AgentConfirmModal";

  ```

---

### 📄 `AgentInbox.tsx`

Unified split-pane workspace centering the active team chat feed.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **frontend: App.tsx** (Line 17):

  ```typescript

  constAgentInbox     = lazy(()=>import("./pages/dashboard/agent-inbox/AgentInbox"));

  ```

---

### 📄 `AgentLeftPanel.tsx`

Sidebar displaying current active conversations queues.

**Inter-Module Linkages:**

Called or imported by files in the same folder:

- **frontend: pages/dashboard/agent-inbox/AgentInbox.tsx** (Line 2):

  ```typescript

  import{AgentLeftPanel}from"./AgentLeftPanel";

  ```

---

### 📄 `AgentRightPanel.tsx`

Right-bar dashboard capturing quick order records, transaction metadata, and logs.

**Inter-Module Linkages:**

Called or imported by files in the same folder:

- **frontend: pages/dashboard/agent-inbox/AgentInbox.tsx** (Line 4):

  ```typescript

  import{AgentRightPanel}from"./AgentRightPanel";

  ```

---

### 📄 `types.ts`

Enums and interfaces organizing inbox states.

**Inter-Module Linkages:**

Called or imported by files in the same folder:

- **frontend: pages/dashboard/agent-inbox/AgentLeftPanel.tsx** (Line 3):

  ```typescript

  import{UserData}from"./types";

  ```
- **frontend: pages/dashboard/agent-inbox/AgentCenterPanel.tsx** (Line 5):

  ```typescript

  import{UserData}from"./types";

  ```
- **frontend: pages/dashboard/agent-inbox/AgentRightPanel.tsx** (Line 2):

  ```typescript

  import{UserData}from"./types";

  ```
- **frontend: pages/dashboard/agent-inbox/useInboxState.ts** (Line 6):

  ```typescript

  import{UserData,ConfirmModalState}from"./types";

  ```
- **frontend: pages/dashboard/agent-inbox/AgentChatFooter.tsx** (Line 3):

  ```typescript

  import{UserData}from"./types";

  ```
- **frontend: pages/dashboard/agent-inbox/AgentConfirmModal.tsx** (Line 1):

  ```typescript

  import{ConfirmModalState}from"./types";

  ```

---

### 📄 `useInboxState.ts`

Helper managing react selectors, active state caches, and timeline messages.

**Inter-Module Linkages:**

Called or imported by files in the same folder:

- **frontend: pages/dashboard/agent-inbox/AgentInbox.tsx** (Line 1):

  ```typescript

  import{ useAgentInboxState }from"./useInboxState";

  ```

---
