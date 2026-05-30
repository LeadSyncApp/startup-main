# LeadSync Frontend Layer (`src/`)

Welcome to the frontend directory of LeadSync. Built on **React 18** with **Vite**, this application offers real-time, highly polished interfaces designed to streamline conversational commerce, order tracking, and integration settings for merchants.

All views are styled elegantly using **Tailwind CSS** guidelines and enhanced with smooth interactive transitions powered by **Framer Motion**.

## Application Directories & Modules

To explore detailed component breakdowns, exact design responsibilities, and code call-hierarchies, visit the dedicated README inside each respective domain directory:

### 🧩 Core Components

- **💼 [components/leads](./components/leads/README.md)**: Main kanban boards, lead search matrices, interactive modals, profile sheets, and bulk-action controllers.
- **💬 [components/conversations](./components/conversations/README.md)**: Timelines, operators notes panels, language translators selector, quick reply macro cards.
- **⚙️ [components/settings](./components/settings/README.md)**: Managers for AI thresholds configs, team assignment rule forms, trigger actions selectors.
- **🖼️ [components/layout](./components/layout/README.md)**: Unified headers, side navigation controls, dynamic warning badges, active workspace drawers.
- **🔧 [components/ui](./components/ui/README.md)**: Base primitives including spinners, custom tabs animations, skeletal placeholders, modals foundations, and alert notifications.

### 🏛️ Context & Services Layer

- **🔐 [context](./context/README.md)**: Operators login status session loaders, app sockets reconnect mechanisms, layout theme managers.
- **🔌 [lib](./lib/README.md)**: Central client wrapper configuration routing REST API payloads.
- **🎨 [utils](./utils/README.md)**: Formatting procedures, INRs selectors, and category configurations.

### 📈 Primary Pages & Cockpits

- **📊 [pages/dashboard/dashboard-home](./pages/dashboard/dashboard-home/README.md)**: Cockpit tracking status overview counters, live KPI gauges, activity trends.
- **📬 [pages/dashboard/agent-inbox](./pages/dashboard/agent-inbox/README.md)**: Split-pane chat workspace grouping message bubbles, translations shortcuts, metadata cards.
- **🔔 [pages/dashboard/new-order-arrivals](./pages/dashboard/new-order-arrivals/README.md)**: High-priority queues tracking checkout cards awaiting manual claims.
- **🛍️ [pages/dashboard/orders](./pages/dashboard/orders/README.md)**: State dashboard for monitoring, modifying, and transitioning orders lifecycles.
- **🔐 [pages/dashboard/user-management](./pages/dashboard/user-management/README.md)**: Directory control center managing team invites, and performance reviews.
- **📢 [pages/dashboard/broadcasts](./pages/dashboard/broadcasts/README.md)**: Console organizing segment marketing campaigns.
- **🛠️ [pages/dashboard/settings](./pages/dashboard/settings/README.md)**: Central system hub loading catalogue excel tables, webhook tokens, and prompt rules.
- **📂 Other Dashboard Pages**: Include **[pages/dashboard/leads](./pages/dashboard/leads/README.md)**, **[pages/dashboard/revenue](./pages/dashboard/revenue/README.md)**, **[pages/dashboard/reports](./pages/dashboard/reports/README.md)**, **[pages/dashboard/internal-note](./pages/dashboard/internal-note/README.md)**, and **[pages/dashboard/owner-dashboard](./pages/dashboard/owner-dashboard/README.md)**.
- **🌍 General Pages**: Include **[pages](./pages/README.md)** (Home, Login, Signup, OrderTracking).

---

## Code Quality Foundations

1. **State Isolation**: Complex states are encapsulated using specialized hooks (e.g. `useInboxState.ts`) or global React Context providers rather than swelling rendering files.
2. **Type Security**: Common data variables (such as lead stages, channel origins, or user clearance groups) are governed strictly by named TypeScript schemas located inside `types/`.
3. **Responsive Sizing**: Interlocking tables and timelines adapt layout grids from compact mobile sheets to bento desktop monitors fluidly.
