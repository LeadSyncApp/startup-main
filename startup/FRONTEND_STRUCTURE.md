# Frontend Structure

Complete directory and file organization for the React frontend.

## Directory Tree

```
src/
├── components/
│   ├── conversations/
│   │   └── ChatPanel.tsx              # Chat interface for conversations
│   ├── dashboard/
│   │   └── SectionSummary.tsx         # Summary section component for dashboard
│   ├── layout/
│   │   ├── DashboardLayout.tsx        # Main dashboard layout wrapper
│   │   ├── MarketingNav.tsx           # Navigation for marketing pages
│   │   └── Sidebar.tsx                # Sidebar navigation component
│   ├── leads/
│   │   ├── LeadDetailModal.tsx        # Modal for detailed lead information
│   │   └── LeadsTable.tsx             # Table component to display leads
│   └── ui/
│       ├── Modal.tsx                  # Reusable modal component
│       ├── Spinner.tsx                # Loading spinner component
│       ├── Toast.tsx                  # Toast notification component
│       └── ToastContainer.tsx         # Container for toast notifications
├── pages/
│   ├── Home.tsx                       # Landing/home page
│   ├── Login.tsx                      # User login page
│   ├── Signup.tsx                     # User registration page
│   └── dashboard/
│       ├── DashboardHome.tsx          # Dashboard home/overview page
│       ├── Leads.tsx                  # Leads management page
│       ├── Conversations.tsx          # Chat/conversations page
│       ├── Deals.tsx                  # Deals management page
│       ├── Revenue.tsx                # Revenue analytics page
│       ├── Reports.tsx                # Reports page
│       └── Settings.tsx               # User settings page
├── context/
│   └── AuthContext.tsx                # Authentication context provider
├── data/
│   └── mockData.ts                    # Mock data for development
├── types/
│   └── index.ts                       # TypeScript type definitions
├── utils/
│   └── formatINR.ts                   # INR currency formatting utility
├── App.tsx                            # Root application component
├── main.tsx                           # Application entry point
├── index.css                          # Global styles
└── vite-env.d.ts                      # Vite environment type definitions
```

## File Organization Rules

### Components (`src/components/`)
- Organizational folders group related components
- Each folder represents a feature or section
- UI components kept in `ui/` subfolder
- Typically contains only `.tsx` files (no logic-heavy files)

### Pages (`src/pages/`)
- One component per file
- Represents route-level components
- Dashboard pages grouped in `dashboard/` subfolder
- Should map to application routes

### Context (`src/context/`)
- React Context API providers
- Global state management
- Currently contains authentication context

### Types (`src/types/`)
- Centralized TypeScript type definitions
- Shared interfaces used across components
- Prevents circular dependencies

### Utils (`src/utils/`)
- Pure utility functions
- Reusable helper functions
- Specific utilities for formatting, calculations, etc.

### Data (`src/data/`)
- Mock data for development
- Test fixtures
- Placeholder content

## Root Files

- **App.tsx** - Main application component (routing setup, provider wrappers)
- **main.tsx** - Entry point (mounts React app to DOM)
- **index.css** - Global CSS styles and Tailwind imports
- **vite-env.d.ts** - TypeScript definitions for Vite environment

## Naming Conventions

- Components: PascalCase (e.g., `ChatPanel.tsx`)
- Pages: PascalCase (e.g., `DashboardHome.tsx`)
- Utilities: camelCase (e.g., `formatINR.ts`)
- Directories: camelCase (e.g., `components/`, `pages/`)

## Module Imports

```
// Relative imports for components
import ChatPanel from '@/components/conversations/ChatPanel'

// Absolute imports (configured in vite.config.ts)
import { formatINR } from '@/utils/formatINR'
```

