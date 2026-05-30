# Frontend Module: `src/context`

Houses UI views, states interfaces, layout modules, and sub-components for the **CONTEXT** domain layer.

## Files and Responsibilities

### 📄 `AuthContext.tsx`

Manages tenant tokens, current operator object roles, and stores session state.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **frontend: components/ProtectedRoute.tsx** (Line 3):

  ```typescript

  import{ useAuth }from"../context/AuthContext";

  ```
- **frontend: components/ProtectedRoute.tsx** (Line 4):

  ```typescript

  import{Role}from"../context/AuthContext";

  ```
- **frontend: components/PublicRoute.tsx** (Line 3):

  ```typescript

  import{ useAuth }from"../context/AuthContext";

  ```
- **frontend: components/conversations/NotesPanel.tsx** (Line 7):

  ```typescript

  import{ useAuth }from"../../context/AuthContext";

  ```
- **frontend: components/layout/DashboardLayout.tsx** (Line 9):

  ```typescript

  import{ useAuth }from"../../context/AuthContext";

  ```
- **frontend: components/layout/MarketingNav.tsx** (Line 7):

  ```typescript

  import{ useAuth }from"../../context/AuthContext";

  ```
- **frontend: components/layout/NotificationBell.tsx** (Line 6):

  ```typescript

  import{ useAuth }from"../../context/AuthContext";

  ```
- **frontend: components/layout/Sidebar.tsx** (Line 17):

  ```typescript

  import{ useAuth }from"../../context/AuthContext";

  ```
- **frontend: components/settings/AssignmentStrategyManager.tsx** (Line 4):

  ```typescript

  import{ useAuth }from"../../context/AuthContext";

  ```
- **frontend: components/settings/AutomationManager.tsx** (Line 6):

  ```typescript

  import{ useAuth }from"../../context/AuthContext";

  ```
- **frontend: components/settings/BotKnowledgeManager.tsx** (Line 6):

  ```typescript

  import{ useAuth }from"../../context/AuthContext";

  ```
- **frontend: components/ui/GlobalSearch.tsx** (Line 6):

  ```typescript

  import{ useAuth }from"../../context/AuthContext";

  ```
- **frontend: main.tsx** (Line 4):

  ```typescript

  import{AuthProvider}from'./context/AuthContext'

  ```
- **frontend: pages/Login.tsx** (Line 5):

  ```typescript

  import{ useAuth }from"../context/AuthContext";

  ```
- **frontend: pages/Signup.tsx** (Line 5):

  ```typescript

  import{ useAuth }from"../context/AuthContext";

  ```
- **frontend: pages/dashboard/agent-inbox/useInboxState.ts** (Line 3):

  ```typescript

  import{ useAuth }from"../../../context/AuthContext";

  ```
- **frontend: pages/dashboard/conversations/Conversations.tsx** (Line 7):

  ```typescript

  import{ useAuth }from'../../../context/AuthContext';

  ```

---

### 📄 `SocketContext.tsx`

Bridges the websocket connection directly to keep real-time views in sync.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **frontend: components/conversations/NotesPanel.tsx** (Line 6):

  ```typescript

  import{ useSocket }from"../../context/SocketContext";

  ```
- **frontend: components/layout/DashboardLayout.tsx** (Line 8):

  ```typescript

  import{ useSocket }from"../../context/SocketContext";

  ```
- **frontend: components/layout/NotificationBell.tsx** (Line 5):

  ```typescript

  import{ useSocket }from"../../context/SocketContext";

  ```
- **frontend: main.tsx** (Line 6):

  ```typescript

  import{SocketProvider}from'./context/SocketContext'

  ```
- **frontend: pages/dashboard/agent-inbox/useInboxState.ts** (Line 4):

  ```typescript

  import{ useSocket }from"../../../context/SocketContext";

  ```
- **frontend: pages/dashboard/conversations/Conversations.tsx** (Line 3):

  ```typescript

  import{ useSocket }from'../../../context/SocketContext';

  ```

---

### 📄 `ThemeContext.tsx`

Manages client layout theme states.

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **frontend: components/ui/ThemeToggle.tsx** (Line 2):

  ```typescript

  import{ useTheme }from"../../context/ThemeContext";

  ```
- **frontend: main.tsx** (Line 5):

  ```typescript

  import{ThemeProvider}from'./context/ThemeContext'

  ```

---
