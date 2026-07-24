# Dashboard Real-Time Report for LeadSync Project

## 1. Summary

The current dashboard is only partially real-time. The app already has a live notification layer through Socket.IO, but the main business cards and activity widgets are still mostly static or one-time loaded from the backend.

This means the dashboard is functional as a shell, but it is not yet a fully live operations dashboard for users.

## 2. What is currently working in real time

### 2.1 Live notifications
Status: Yes, real-time

Implementation:
- Socket.IO connection is initialized in [startup-main/leadsync-frontend/src/App.tsx](startup-main/leadsync-frontend/src/App.tsx)
- Socket client logic is in [startup-main/leadsync-frontend/src/lib/socketClient.ts](startup-main/leadsync-frontend/src/lib/socketClient.ts)
- Notification store listens to incoming events in [startup-main/leadsync-frontend/src/features/notifications/useNotificationStore.ts](startup-main/leadsync-frontend/src/features/notifications/useNotificationStore.ts)

Behavior:
- The frontend connects to the backend socket.
- When the backend emits `notification_new`, the UI shows a toast and updates the notification store.
- This is the clearest real-time feature currently available.

### 2.2 Authenticated app state and navigation
Status: Working, but not dashboard-data real-time

Implementation:
- [startup-main/leadsync-frontend/src/App.tsx](startup-main/leadsync-frontend/src/App.tsx)

Behavior:
- User login, routing, onboarding, and socket lifecycle are managed correctly.
- This supports real-time dashboard access, but it does not mean the dashboard metrics themselves are live.

## 3. What is not real time

### 3.1 Daily collection stats card
Status: Not truly real-time

Implementation:
- [startup-main/leadsync-frontend/src/features/dashboard/DailyCollectionStats.tsx](startup-main/leadsync-frontend/src/features/dashboard/DailyCollectionStats.tsx)

Current behavior:
- The widget fetches `/api/orders` once on mount.
- It calculates today’s collection, pending payments, paid orders, and pending orders from the response.
- It does not subscribe to WebSocket events and does not poll for updates.

Conclusion:
- This card is live only at page load.
- It becomes stale after new orders or status changes unless the page is refreshed.

### 3.2 Daily pulse / activity widget
Status: Static / placeholder

Implementation:
- [startup-main/leadsync-frontend/src/features/dashboard/DailyPulseAdaptiveWidget.tsx](startup-main/leadsync-frontend/src/features/dashboard/DailyPulseAdaptiveWidget.tsx)

Current behavior:
- The progress value is hard-coded as `4200`.
- The chart bars are static sample values.
- There is no live backend data source connected to it.

Conclusion:
- This widget is visual UI, not a real business metric display.

### 3.3 Quick actions and getting-started area
Status: Static UI

Implementation:
- [startup-main/leadsync-frontend/src/App.tsx](startup-main/leadsync-frontend/src/App.tsx)

Current behavior:
- The cards are present as navigation/engagement UI.
- They do not reflect live shop activity.

Conclusion:
- These blocks are not real-time dashboard data components.

### 3.4 Team invite and onboarding cards
Status: Interactive but not live business data

Implementation:
- [startup-main/leadsync-frontend/src/App.tsx](startup-main/leadsync-frontend/src/App.tsx)

Current behavior:
- They accept user input and show local toast feedback.
- They do not represent live dashboard metrics.

## 4. Backend dashboard support that exists

### 4.1 Dashboard routes
File:
- [startup-main/leadsync-backend/src/routes/core/dashboard.routes.ts](startup-main/leadsync-backend/src/routes/core/dashboard.routes.ts)

Available endpoints include:
- `/api/dashboard/kpis`
- `/api/dashboard/metrics`
- `/api/dashboard/alerts`
- `/api/dashboard/funnel`
- `/api/dashboard/forecast`
- `/api/dashboard/agent-stats`

These endpoints already exist and are ready to power dashboard cards.

### 4.2 Analytics endpoints
File:
- [startup-main/leadsync-backend/src/routes/core/analytics.routes.ts](startup-main/leadsync-backend/src/routes/core/analytics.routes.ts)

Available endpoints include:
- `/analytics/dashboard`
- `/analytics/revenue`

These endpoints already calculate:
- revenue chart
- top products
- top agents
- aggregate revenue and order counts

### 4.3 Fast metrics controller
File:
- [startup-main/leadsync-backend/src/controllers/dashboard.controller.ts](startup-main/leadsync-backend/src/controllers/dashboard.controller.ts)

This returns rollup metrics such as:
- total revenue
- total orders
- total leads

## 5. Current project status matrix

| Area | Status | Notes |
|---|---|---|
| Socket notifications | Live | Works through Socket.IO |
| Dashboard shell | Working | UI navigation is ready |
| Daily stats card | Partial | One-time fetch only |
| Activity chart | Not live | Static demo values |
| KPI/analytics backend | Present | Ready for frontend connection |
| Real-time order updates | Not implemented | No live subscription wired yet |
| Live revenue trend | Not implemented | No live chart refresh path |

## 6. What needs to be changed to make the dashboard truly real-time

### Priority 1: Connect real dashboard data to the UI
- Replace the static values in the activity widget with data from backend analytics endpoints.
- Use the backend KPI or metrics endpoints instead of hard-coded numbers.

### Priority 2: Add live updates for orders and payments
- Subscribe to backend events when orders are created, updated, paid, or cancelled.
- Update the stats cards immediately when these events happen.

### Priority 3: Add polling fallback for reliability
- If WebSocket is unavailable, poll the backend every 15–30 seconds.
- This gives the dashboard a reliable fallback.

### Priority 4: Add a live timestamp and refresh indicator
- Show “Last updated: 2s ago” or “Live” badge.
- Improve user confidence that the data is current.

### Priority 5: Build a real-time analytics panel
- Replace placeholder charts with real revenue, orders, leads, and agent activity data.
- Use the analytics endpoints in [startup-main/leadsync-backend/src/routes/core/analytics.routes.ts](startup-main/leadsync-backend/src/routes/core/analytics.routes.ts).

## 7. Recommended implementation plan for new updates

### Phase 1 – Make the core cards live
1. Create a dashboard data hook in the frontend.
2. Fetch `/api/dashboard/kpis` or `/api/dashboard/metrics` on load.
3. Refresh every 15 seconds.
4. Update the existing stats card with real values.

### Phase 2 – Add WebSocket events for business updates
1. Add backend event emission for order/payment updates.
2. Listen to those events in the frontend.
3. Update the metric cards instantly without reload.

### Phase 3 – Replace demo activity widgets
1. Connect the pulse widget to revenue and order data.
2. Replace hard-coded bars with real recent performance data.
3. Add a trend indicator and progress target.

### Phase 4 – Add admin / owner dashboard polish
1. Add “Live” status badge.
2. Add last-refresh timestamp.
3. Add empty-state and error-state handling.
4. Improve socket reconnect handling.

## 8. Final verdict

The dashboard currently has one real-time feature: notifications.

The main business widgets are not yet truly live. They are either one-time fetched, static, or demo-style.

If the goal is to make this a real production dashboard for users, the next updates should focus on:
- real backend KPI wiring,
- live order/payment event updates,
- automatic refresh,
- and replacing static charts with data-driven visuals.
