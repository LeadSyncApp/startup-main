# Frontend Components Guide

Complete inventory and documentation of all React components.

## Component Categories

### Layout Components (`src/components/layout/`)

#### DashboardLayout.tsx
- **Purpose:** Main layout wrapper for dashboard pages
- **Type:** Layout/Wrapper component
- **Usage:** Wraps dashboard pages to provide consistent layout
- **Props:** Typically wraps children pages
- **Features:** Navigation wrapper, sidebar integration

#### Sidebar.tsx
- **Purpose:** Navigation sidebar for dashboard
- **Type:** Navigation component
- **Usage:** Displays in main dashboard area
- **Props:** Likely accepts navigation items or sections
- **Features:** User navigation, link routing

#### MarketingNav.tsx
- **Purpose:** Navigation bar for non-dashboard pages
- **Type:** Navigation component
- **Usage:** Header navigation for landing pages
- **Props:** Configurable nav links
- **Features:** Logo, links, auth buttons

---

### UI Components (`src/components/ui/`)

Core reusable UI components for the application.

#### Modal.tsx
- **Purpose:** Reusable modal dialog component
- **Type:** UI/Dialog component
- **Props:**
  - `isOpen: boolean` - Controls modal visibility
  - `onClose: () => void` - Callback when modal closes
  - `children: React.ReactNode` - Modal content
  - `title?: string` - Optional modal title
- **Usage:** Wrap content for modal dialogs
- **Features:** Overlay, close button, animations

#### Toast.tsx
- **Purpose:** Individual notification toast
- **Type:** UI/Notification component
- **Props:**
  - `message: string` - Toast message content
  - `type: 'success' | 'error' | 'info' | 'warning'` - Toast type
  - `onClose: () => void` - Dismiss callback
  - `duration?: number` - Auto-dismiss duration
- **Usage:** Display temporary notifications
- **Features:** Auto-dismiss, styling by type

#### ToastContainer.tsx
- **Purpose:** Container for managing multiple toasts
- **Type:** Container component
- **Props:** Manages toast queue
- **Usage:** Place once in app wrapper
- **Features:** Stacks multiple toasts

#### Spinner.tsx
- **Purpose:** Loading indicator component
- **Type:** UI/Loader component
- **Props:**
  - `size?: 'sm' | 'md' | 'lg'` - Spinner size
  - `color?: string` - Spinner color
- **Usage:** Display loading state
- **Features:** Animated loading indicator

---

### Lead Components (`src/components/leads/`)

#### LeadsTable.tsx
- **Purpose:** Display leads in table format
- **Type:** Data/Table component
- **Props:**
  - `leads: Lead[]` - Array of lead objects
  - `onSelectLead: (lead: Lead) => void` - Selection handler
  - `isLoading?: boolean` - Loading state
- **Usage:** Main leads listing view
- **Features:** Sortable columns, pagination, filtering

#### LeadDetailModal.tsx
- **Purpose:** Modal showing detailed lead information
- **Type:** Modal component
- **Props:**
  - `lead: Lead | null` - Lead to display
  - `isOpen: boolean` - Modal visibility
  - `onClose: () => void` - Close handler
- **Usage:** Display lead details in modal
- **Features:** Edit capability, related info

---

### Conversation Components (`src/components/conversations/`)

#### ChatPanel.tsx
- **Purpose:** Chat interface for conversations
- **Type:** Communication component
- **Props:**
  - `conversation: Conversation` - Current conversation
  - `onSendMessage: (msg: string) => void` - Message handler
- **Usage:** Display conversations and messages
- **Features:** Message list, input field, scroll to latest

---

### Dashboard Components (`src/components/dashboard/`)

#### SectionSummary.tsx
- **Purpose:** Summary statistics for dashboard sections
- **Type:** Data/Summary component
- **Props:**
  - `title: string` - Section title
  - `value: number | string` - Main statistic
  - `change?: number` - Percentage change
  - `icon?: React.ReactNode` - Section icon
  - `trend?: 'up' | 'down'` - Trend direction
- **Usage:** Display KPIs and metrics
- **Features:** Icon support, trend indicator

---

## Component Import Patterns

```typescript
// Layout imports
import DashboardLayout from '@/components/layout/DashboardLayout'
import Sidebar from '@/components/layout/Sidebar'

// UI component imports
import Modal from '@/components/ui/Modal'
import Toast from '@/components/ui/Toast'
import Spinner from '@/components/ui/Spinner'

// Feature component imports
import LeadsTable from '@/components/leads/LeadsTable'
import ChatPanel from '@/components/conversations/ChatPanel'
import SectionSummary from '@/components/dashboard/SectionSummary'
```

## Component Props Interface

All components should have TypeScript interfaces defined. Example pattern:

```typescript
interface ComponentProps {
  // Required props first
  requiredProp: string
  
  // Optional props
  optionalProp?: string
  
  // Event handlers
  onAction?: (value: any) => void
  
  // Styling
  className?: string
}

export default function Component(props: ComponentProps) {
  // Component implementation
}
```

## Best Practices

1. **Single Responsibility** - Each component has one primary purpose
2. **Props Over State** - Prefer props for configuration when possible
3. **No Prop Drilling** - Use Context for deeply nested data
4. **Accessibility** - Semantic HTML, ARIA labels
5. **Type Safety** - Define interfaces for all props
6. **Reusability** - Keep components generic and composable

