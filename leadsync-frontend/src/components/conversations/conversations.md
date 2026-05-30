# Frontend Module: `src/components/conversations`

Houses UI views, states interfaces, layout modules, and sub-components for the **COMPONENTS/CONVERSATIONS** domain layer.

## Files and Responsibilities

---

### 📄 `Conversations.tsx`

The core Inbox and workspace interface. It manages customer conversation lists, chat timelines, active orders, and live-chat inputs.

**Responsibilities & Features:**

- Displays unified customer listing with quick sub-filtering (Channel vs Manual leads).
- Houses state management for real-time WebSocket messaging and automated background polling.
- Orchestrates conversational flow tracking, agent claim overrides, and direct order workflows.

**Inter-Module Linkages:**

- Imported by `src/App.tsx` as the main Route-level dashboard view.
- Leverages types from `./types.ts` and formatting hooks/utilities from `./helpers.ts`.

---

### 📄 `ContactIntelligence.tsx`

Right-side user insight and analytics layout panel that reveals CRM transactions and engagement analytics.

**Responsibilities & Features:**

- Parses active customer segments, transaction histories, total spends, and AI recommendation metrics.
- Provides triggers for voice stream calling (`window.open("tel:...")`).
- Transitions gracefully to display contextual operator internal notes.

**Inter-Module Linkages:**

- Rendered conditionally inside `./Conversations.tsx`.
- Instantiates `./NotesPanel.tsx` inside its modular internal notes tab.

---

### 📄 `ConversationTags.tsx`

Lightweight, localStorage-based tag coloring and selector subscription model.

**Responsibilities & Features:**

- Exports the `TagChips` read-only indicator for visual cards on the inbox list directory.
- Exports `TagButton` and `TagPicker` dynamic popup panels to assign label descriptors (e.g., VIP, Escalated).
- Uses standard singleton notifier listeners to synchronize tags instantaneously across multiple sub-view tabs.

---

### 📄 `NotesPanel.tsx`

Operators' notepad designed for collaborative context building.

**Responsibilities & Features:**

- Stores operator notes and critical sync information securely by customer thread.
- Interchanges smoothly with standard profile detail cards.

---

### 📄 `SavedReplies.tsx`

Intelligent macros selector facilitating repeatable canned shortcuts.

**Responsibilities & Features:**

- Renders pre-defined template replies contextually.
- Triggers typing overlays dynamically whenever an operator enters `/` during live input.

---

### 📄 `types.ts`

Centralized TypeScript interfaces for strict typing guidelines.

**Responsibilities & Features:**

- Standardizes the `Conversation` data model representation.
- Standardizes the `Message` structures across sockets, APIs, and timeline elements.

---

### 📄 `helpers.ts`

Core visual and data parsing utilities.

**Responsibilities & Features:**

- Generates dynamic, deterministic background color gradients from lead names.
- Computes standard character initials, timestamp strings, relative duration formats, and system log message overrides.
