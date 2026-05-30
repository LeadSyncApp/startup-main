# Frontend Module: `src/components/conversations`

Houses UI views, states interfaces, layout modules, and sub-components for the **COMPONENTS/CONVERSATIONS** domain layer.

## Files and Responsibilities

### 📄 `ChatPanel.tsx`

Core chat display pane outputting typing indicators, incoming channels, and interactive text timeline.

**Inter-Module Linkages:**

This component is currently not imported or used anywhere in the application (unused file).

---

### 📄 `ConversationTags.tsx`

Small widget lists assigning status priorities and labels to specific conversion rows.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **frontend: pages/dashboard/conversations/Conversations.tsx** (Line 8):

  ```typescript

  import{TagChips,TagButton}from'../../../components/conversations/ConversationTags';

  ```

---

### 📄 `NotesPanel.tsx`

Sidebar box accepting persistent notes shared strictly across HUMAN operators.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **frontend: pages/dashboard/conversations/Conversations.tsx** (Line 9):

  ```typescript

  import{NotesPanel}from'../../../components/conversations/NotesPanel';

  ```

---

### 📄 `SavedReplies.tsx`

Macros panel injecting predefined responses under specific template shortcuts.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **frontend: pages/dashboard/conversations/Conversations.tsx** (Line 6):

  ```typescript

  import{SavedRepliesPopup}from'../../../components/conversations/SavedReplies';

  ```

---
