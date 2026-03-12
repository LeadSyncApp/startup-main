# Frontend Pages Reference

Complete documentation of all page-level components and routing.

## Page Hierarchy

### Public Pages

#### Home.tsx (`src/pages/Home.tsx`)
- **Route:** `/`
- **Purpose:** Landing page / Marketing page
- **Navigation:** MarketingNav component
- **Accessibility:** Public (no authentication required)
- **Features:**
  - Hero section
  - Product overview
  - Call-to-action buttons
  - Link to Login/Signup
- **Related Components:** MarketingNav

#### Login.tsx (`src/pages/Login.tsx`)
- **Route:** `/login`
- **Purpose:** User authentication
- **Navigation:** MarketingNav or minimal nav
- **Accessibility:** Public (redirects if already authenticated)
- **Features:**
  - Email/password form
  - Form validation
  - Remember me option
  - Link to Signup
  - Error handling
- **FormData:**
  ```typescript
  {
    email: string
    password: string
    rememberMe?: boolean
  }
  ```

#### Signup.tsx (`src/pages/Signup.tsx`)
- **Route:** `/signup`
- **Purpose:** User registration
- **Navigation:** MarketingNav or minimal nav
- **Accessibility:** Public (redirects if already authenticated)
- **Features:**
  - User registration form
  - Email validation
  - Password requirements
  - Terms acceptance
  - Link to Login
- **FormData:**
  ```typescript
  {
    email: string
    name: string
    password: string
    confirmPassword: string
    agreeToTerms: boolean
  }
  ```

---

### Protected Dashboard Pages

All dashboard pages require authentication and use `DashboardLayout` wrapper.

**Base Route:** `/dashboard`

**Navigation:** Sidebar component + MarketingNav

---

#### DashboardHome.tsx (`src/pages/dashboard/DashboardHome.tsx`)
- **Route:** `/dashboard` or `/dashboard/home`
- **Purpose:** Main dashboard overview
- **Layout:** DashboardLayout
- **Features:**
  - Welcome message
  - Key metrics/KPIs
  - Recent activity
  - Quick action buttons
  - SectionSummary components for stats
- **Data:** Aggregated from all modules
- **Refresh Rate:** Auto-refresh or manual refresh

#### Leads.tsx (`src/pages/dashboard/Leads.tsx`)
- **Route:** `/dashboard/leads`
- **Purpose:** Leads management and CRM
- **Layout:** DashboardLayout
- **Components Used:**
  - LeadsTable
  - LeadDetailModal
  - Sidebar (for filters/navigation)
- **Features:**
  - View all leads in table
  - Sort by column
  - Filter leads (status, source, etc.)
  - Search functionality
  - Create new lead
  - Edit lead details
  - Delete lead
  - Lead scoring/status
- **Key Actions:**
  - Click lead row → open LeadDetailModal
  - Add Lead button → create form
  - Bulk actions (if needed)

#### Conversations.tsx (`src/pages/dashboard/Conversations.tsx`)
- **Route:** `/dashboard/conversations`
- **Purpose:** Chat and messaging interface
- **Layout:** DashboardLayout
- **Components Used:**
  - ChatPanel
  - Sidebar (conversation list)
- **Features:**
  - List of conversations
  - Chat interface
  - Message history
  - Real-time messaging (if integrated with Telegram)
  - Telegram webhook integration
- **Integration:** Telegram service for message sync

#### Deals.tsx (`src/pages/dashboard/Deals.tsx`)
- **Route:** `/dashboard/deals`
- **Purpose:** Sales pipeline and deal management
- **Layout:** DashboardLayout
- **Features:**
  - Deal list/Kanban board
  - Deal stages/pipeline
  - Deal amount tracking
  - Close date tracking
  - Deal forecasting
  - Create/edit deals
- **Data Structure:**
  ```typescript
  interface Deal {
    id: string
    name: string
    amount: number
    stage: 'prospect' | 'proposal' | 'negotiation' | 'closed'
    closeDate: Date
    leadId: string
  }
  ```

#### Revenue.tsx (`src/pages/dashboard/Revenue.tsx`)
- **Route:** `/dashboard/revenue`
- **Purpose:** Revenue analytics and reporting
- **Layout:** DashboardLayout
- **Features:**
  - Revenue overview
  - Charts and graphs
  - Period comparison
  - Revenue by source
  - Forecast
  - Export reports
- **Visualizations:**
  - Line charts (trend)
  - Bar charts (comparison)
  - Pie charts (distribution)

#### Reports.tsx (`src/pages/dashboard/Reports.tsx`)
- **Route:** `/dashboard/reports`
- **Purpose:** Custom reporting and analytics
- **Layout:** DashboardLayout
- **Features:**
  - Predefined reports
  - Custom report builder
  - Report scheduling
  - Export options (PDF, CSV)
  - Report history
  - Share reports
- **Report Types:**
  - Sales reports
  - Lead reports
  - Activity reports
  - Forecast reports

#### Settings.tsx (`src/pages/dashboard/Settings.tsx`)
- **Route:** `/dashboard/settings`
- **Purpose:** User and application settings
- **Layout:** DashboardLayout
- **Features:**
  - Profile settings
  - Account preferences
  - Notification settings
  - Integration settings (Telegram, webhooks)
  - Team/user management
  - API keys management
  - Security settings (2FA, etc.)
- **Sections:**
  - Account Information
  - Preferences
  - Integrations
  - Security
  - Notifications

---

## Routing Structure

```
/
├── /login                    [Public]
├── /signup                   [Public]
├── /                         [Public]
└── /dashboard                [Protected]
    ├── /                     DashboardHome
    ├── /leads                Leads
    ├── /conversations        Conversations
    ├── /deals                Deals
    ├── /revenue              Revenue
    ├── /reports              Reports
    └── /settings             Settings
```

## Authentication Flow

```
Public Pages → No Auth Required
  ↓
Login/Signup → Get Auth Token
  ↓
Dashboard Pages ← Auth Token Required (Protected Route)
```

## Protected Route Implementation

Example pattern:

```typescript
interface PrivateRouteProps {
  children: React.ReactNode
}

function PrivateRoute({ children }: PrivateRouteProps) {
  const { isAuthenticated } = useAuth()
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  
  return children
}
```

## Page Props Pattern

Dashboard pages typically receive:

```typescript
// From Router
- location: Location
- navigate: NavigateFunction

// From Auth Context
- user: User
- isAuthenticated: boolean
- logout: () => void

// From parent layout
- children?: React.ReactNode
```

