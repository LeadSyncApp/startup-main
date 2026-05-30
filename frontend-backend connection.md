# LeadSync Client-Server Connectivity Matrix

This configuration map details all direct communication interfaces linking the React frontend web interface (`leadsync-frontend`) with the Node.js Express backend service (`leadsync-backend`), including the exact lines of code where these connections occur.

---

## 1. Direct API Connections Matrix (With Lines of Code)

Below is an exhaustive breakdown of every frontend file making calls to the backend, showing:

1. **The Caller file and the exact line of code** invoking the endpoint.
2. **The Receiver file and the precise API route registration line** in the backend.

### 🖥️ Frontend File: `components/conversations/NotesPanel.tsx`

This file initiates the following requests to the backend:

#### Connection 1: `GET` `/api/users/list`

- **Frontend Call point** (Line 49):

  ```typescript

  // Line 49 inside leadsync-frontend/src/components/conversations/NotesPanel.tsx

  api.get("/users/list")

  ```
- **Backend Route handler** (`leadsync-backend/src/routes/core/users.routes.ts` at Line 26):

  ```typescript

  // Line 26 inside leadsync-backend/src/routes/core/users.routes.ts

  router.get("/list", authMiddleware,async(req:AuthRequest, res:Response)=>{

  ```

---

### 🖥️ Frontend File: `components/layout/NotificationBell.tsx`

This file initiates the following requests to the backend:

#### Connection 1: `PATCH` `/api/notifications/read-all`

- **Frontend Call point** (Line 104):

  ```typescript

  // Line 104 inside leadsync-frontend/src/components/layout/NotificationBell.tsx

  await api.patch("/notifications/read-all",{});

  ```
- **Backend Route handler** (`leadsync-backend/src/routes/core/notification.routes.ts` at Line 61):

  ```typescript

  // Line 61 inside leadsync-backend/src/routes/core/notification.routes.ts

  router.patch("/read-all", authMiddleware,async(req:AuthRequest, res:Response)=>{

  ```

---

### 🖥️ Frontend File: `pages/dashboard/dashboard-home/DashboardHome.tsx`

This file initiates the following requests to the backend:

#### Connection 1: `GET` `/api/analytics/dashboard`

- **Frontend Call point** (Line 81):

  ```typescript

  // Line 81 inside leadsync-frontend/src/pages/dashboard/dashboard-home/DashboardHome.tsx

  api.get("/analytics/dashboard").catch(()=>null),

  ```
- **Backend Route handler** (`leadsync-backend/src/routes/core/analytics.routes.ts` at Line 12):

  ```typescript

  // Line 12 inside leadsync-backend/src/routes/core/analytics.routes.ts

  router.get("/dashboard", authMiddleware,async(req:AuthRequest, res:Response)=>{

  ```

---

### 🖥️ Frontend File: `pages/dashboard/owner-dashboard/OwnerDashboard.tsx`

This file initiates the following requests to the backend:

#### Connection 1: `GET` `/api/users/`

- **Frontend Call point** (Line 55):

  ```typescript

  // Line 55 inside leadsync-frontend/src/pages/dashboard/owner-dashboard/OwnerDashboard.tsx

  const res =await api.get("/users/owner-dashboard");

  ```
- **Backend Route handler** (`leadsync-backend/src/routes/core/users.routes.ts` at Line 146):

  ```typescript

  // Line 146 inside leadsync-backend/src/routes/core/users.routes.ts

  router.get("/", authMiddleware,async(req:AuthRequest, res:Response)=>{

  ```

---

### 🖥️ Frontend File: `pages/dashboard/reports/Reports.tsx`

This file initiates the following requests to the backend:

#### Connection 1: `GET` `/api/analytics/revenue`

- **Frontend Call point** (Line 29):

  ```typescript

  // Line 29 inside leadsync-frontend/src/pages/dashboard/reports/Reports.tsx

  api.get("/analytics/revenue").then(setStats).catch(console.error);

  ```
- **Backend Route handler** (`leadsync-backend/src/routes/core/analytics.routes.ts` at Line 137):

  ```typescript

  // Line 137 inside leadsync-backend/src/routes/core/analytics.routes.ts

  router.get("/revenue", authMiddleware,async(req:AuthRequest, res:Response)=>{

  ```

---

### 🖥️ Frontend File: `pages/dashboard/revenue/Revenue.tsx`

This file initiates the following requests to the backend:

#### Connection 1: `GET` `/api/analytics/revenue`

- **Frontend Call point** (Line 41):

  ```typescript

  // Line 41 inside leadsync-frontend/src/pages/dashboard/revenue/Revenue.tsx

  api.get("/analytics/revenue"),

  ```
- **Backend Route handler** (`leadsync-backend/src/routes/core/analytics.routes.ts` at Line 137):

  ```typescript

  // Line 137 inside leadsync-backend/src/routes/core/analytics.routes.ts

  router.get("/revenue", authMiddleware,async(req:AuthRequest, res:Response)=>{

  ```

#### Connection 2: `GET` `/api/dashboard/funnel`

- **Frontend Call point** (Line 42):

  ```typescript

  // Line 42 inside leadsync-frontend/src/pages/dashboard/revenue/Revenue.tsx

  api.get("/dashboard/funnel").catch(()=>null),

  ```
- **Backend Route handler** (`leadsync-backend/src/routes/core/dashboard.routes.ts` at Line 588):

  ```typescript

  // Line 588 inside leadsync-backend/src/routes/core/dashboard.routes.ts

  router.get("/funnel", authMiddleware,async(req:AuthRequest, res:Response)=>{

  ```

#### Connection 3: `GET` `/api/dashboard/forecast`

- **Frontend Call point** (Line 43):

  ```typescript

  // Line 43 inside leadsync-frontend/src/pages/dashboard/revenue/Revenue.tsx

  api.get("/dashboard/forecast").catch(()=>null),

  ```
- **Backend Route handler** (`leadsync-backend/src/routes/core/dashboard.routes.ts` at Line 622):

  ```typescript

  // Line 622 inside leadsync-backend/src/routes/core/dashboard.routes.ts

  router.get("/forecast", authMiddleware,async(req:AuthRequest, res:Response)=>{

  ```

#### Connection 4: `GET` `/api/dashboard/agent-stats`

- **Frontend Call point** (Line 44):

  ```typescript

  // Line 44 inside leadsync-frontend/src/pages/dashboard/revenue/Revenue.tsx

  api.get("/dashboard/agent-stats").catch(()=>[]),

  ```
- **Backend Route handler** (`leadsync-backend/src/routes/core/dashboard.routes.ts` at Line 683):

  ```typescript

  // Line 683 inside leadsync-backend/src/routes/core/dashboard.routes.ts

  router.get("/agent-stats", authMiddleware,async(req:AuthRequest, res:Response)=>{

  ```

---

## 2. Real-Time Bidirectional Event Streaming (WebSockets)

Bi-directional real-time push synchronization operates over Socket.io. Sockets are initialized directly inside **`context/SocketContext.tsx`** and managed via server emitters in **`lib/socket.ts`**:

### 📥 Backend to Frontend Signals (Subscribed Events)

Frontend blocks listen to socket streams to trigger instant reactivity without reloading views:

- **`new_message`**

  - **Emitters**: Inside web adapters (Telegram, Instagram) and manual agents composing layouts (`conversations.routes.ts`).
  - **Subscribed By**: `pages/dashboard/agent-inbox/useInboxState.ts` to immediately scroll down and inject chat bubble.
- **`conversation_updated`**

  - **Emitters**: Emitted over assignment modifiers and claiming events (`leads.routes.ts`, `conversations.routes.ts`).
  - **Subscribed By**: Updates active metrics panels and adjusts navigation badges layout.
- **`new_order_arrival`**

  - **Emitters**: Dispatched during bot shopping actions (`newOrderArrival.service.ts`).
  - **Subscribed By**: Prompts visual alerts and animations on `pages/dashboard/new-order-arrivals/NewOrderArrivals.tsx`.
- **`agent_assignment`**

  - **Emitters**: Emitted inside core assignment routers (`assignment.service.ts`).
  - **Subscribed By**: Pushes dynamic toast highlights to notified staff operators.

### 📤 Frontend to Backend Signals (Triggered Events)

We communicate key contextual signals back to backend threads:

- **`join`** (room: `company_:[companyId]`)

  - **Subscribed Room**: Connects individual operators into the secure tenant room matrix so they only hear their company updates.
- **`join_conversation`** (room: `conversation_:[convoId]`)

  - **Subscribed Room**: Locks visual timeline changes into the active customer thread, disabling background collision.

---

## 3. High-Level Data Flow Architecture

```

  +------------------------------------------------------------+

  |                   leadsync-frontend (React)                |

  +------------------------------------------------------------+

      | (REST via Axios proxy)                ^ (Real-Time WS)

      v                                       |

  +------------------------------------------------------------+

  |              leadsync-backend (Express v4 Router)          |

  +------------------------------------------------------------+

      | (SQL Queries)                         ^ (Change Streams)

      v                                       |

  +------------------------------------------------------------+

  |               Prisma Client + PostgreSQL (DB)              |

  +------------------------------------------------------------+

```

1. **Proxy Resolution**: Client routes call the backend using a unified `api.ts` wrapper. The wrapper automatically resolves the base container address and appends the operator's JWT bearer authorization token.
2. **Controller Decoupling**: Backend controller routers under `src/routes/` quickly authorize tokens using `authMiddleware` and hand the transaction payload to specialized services (e.g. `orderWorkflow.service.ts`), protecting database integrity.
3. **Database Change Hooking**: Services commit updates to PG via Prisma schemas, and then fire Socket.io notifications back to the frontend layer room structures to guarantee responsive state updates.
