# Frontend Module: `src/pages/dashboard/agent-inbox`

Houses UI views, states interfaces, layout modules, and sub-components for the **PAGES/DASHBOARD/AGENT-INBOX** domain layer.

## Files and Responsibilities

### 📄 `AgentCenterPanel.tsx`

Main conversational canvas feeding real-time message streams.

**Inter-Module Linkages:**

No external linkages or imports from other directories.

---

### 📄 `AgentChatFeed.tsx`

Lists historical bubble logs, time indicators, and sender tags.

**Inter-Module Linkages:**

No external linkages or imports from other directories.

---

### 📄 `AgentChatFooter.tsx`

Input footer containing quick buttons for voice translations and saved replies.

**Inter-Module Linkages:**

No external linkages or imports from other directories.

---

### 📄 `AgentChatHeader.tsx`

Header bar details of current customer channels and manual controls.

**Inter-Module Linkages:**

No external linkages or imports from other directories.

---

### 📄 `AgentConfirmModal.tsx`

Confirmation popups executing operator updates of claims actions.

**Inter-Module Linkages:**

No external linkages or imports from other directories.

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

No external linkages or imports from other directories.

---

### 📄 `AgentRightPanel.tsx`

Right-bar dashboard capturing quick order records, transaction metadata, and logs.

**Inter-Module Linkages:**

No external linkages or imports from other directories.

---

### 📄 `types.ts`

Enums and interfaces organizing inbox states.

**Inter-Module Linkages:**

No external linkages or imports from other directories.

---

### 📄 `useInboxState.ts`

Helper managing react selectors, active state caches, and timeline messages.

**Inter-Module Linkages:**

No external linkages or imports from other directories.

---
