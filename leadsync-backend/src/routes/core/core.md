# Route Module: `routes/core`

Responsible for handling HTTP traffic regarding the **CORE** domain context.

## Files and Responsibilities

### 📄 `analytics.routes.ts`

Serves processed charts, conversation funnel conversions, and revenue logs directly to the frontend widgets.

**Defined Endpoints:**

- `GET``/dashboard` (Line 12)
- `GET``/revenue` (Line 137)
- `GET``/export` (Line 271)
- `GET``/export-leads` (Line 341)

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **backend: app.ts** (Line 25):

  ```typescript

  import analyticsRoutes from"./routes/core/analytics.routes";

  ```
- **frontend: pages/dashboard/dashboard-home/DashboardHome.tsx** (Line 81):

  ```typescript

  (FrontendAPICall) api.get("/analytics/dashboard").catch(()=>null),

  ```
- **frontend: pages/dashboard/reports/Reports.tsx** (Line 29):

  ```typescript

  (FrontendAPICall) api.get("/analytics/revenue").then(setStats).catch(console.error);

  ```
- **frontend: pages/dashboard/revenue/Revenue.tsx** (Line 41):

  ```typescript

  (FrontendAPICall) api.get("/analytics/revenue"),

  ```

---

### 📄 `dashboard.routes.ts`

Core aggregator supplying global state KPIs, alert statistics, user logs, and facilitating catalog excel file uploads.

**Defined Endpoints:**

- `GET``/funnel` (Line 588)
- `GET``/forecast` (Line 622)
- `GET``/agent-stats` (Line 683)

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **backend: app.ts** (Line 23):

  ```typescript

  import dashboardRoutes from"./routes/core/dashboard.routes";

  ```
- **frontend: pages/dashboard/revenue/Revenue.tsx** (Line 42):

  ```typescript

  (FrontendAPICall) api.get("/dashboard/funnel").catch(()=>null),

  ```
- **frontend: pages/dashboard/revenue/Revenue.tsx** (Line 43):

  ```typescript

  (FrontendAPICall) api.get("/dashboard/forecast").catch(()=>null),

  ```
- **frontend: pages/dashboard/revenue/Revenue.tsx** (Line 44):

  ```typescript

  (FrontendAPICall) api.get("/dashboard/agent-stats").catch(()=>[]),

  ```

---

### 📄 `notification.routes.ts`

Standard endpoints listening to agent notification actions (e.g., listing updates or marking highlights read).

**Defined Endpoints:**

- `GET``/` (Line 11)
- `PATCH``/:id/read` (Line 40)
- `PATCH``/read-all` (Line 61)

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **backend: app.ts** (Line 26):

  ```typescript

  import notificationRoutes from"./routes/core/notification.routes";

  ```
- **frontend: components/layout/NotificationBell.tsx** (Line 104):

  ```typescript

  (FrontendAPICall)await api.patch("/notifications/read-all",{});

  ```

---

### 📄 `users.routes.ts`

Integrates with multi-role user schemas, regulating team member lists, invitations, deleted accounts, and assignments.

**Defined Endpoints:**

- `GET``/list` (Line 26)
- `GET``/` (Line 146)
- `POST``/` (Line 180)

**Inter-Module Linkages:**

Called or imported by files in other folders:

- **backend: app.ts** (Line 24):

  ```typescript

  import usersRoutes from"./routes/core/users.routes";

  ```
- **frontend: components/conversations/NotesPanel.tsx** (Line 49):

  ```typescript

  (FrontendAPICall) api.get("/users/list")

  ```
- **frontend: pages/dashboard/owner-dashboard/OwnerDashboard.tsx** (Line 55):

  ```typescript

  (FrontendAPICall)const res =await api.get("/users/owner-dashboard");

  ```

---
