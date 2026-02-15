# Frontend Quick Reference

Quick lookup guide for common tasks and patterns.

## File Locations

| File/Folder | Purpose |
|-----------|---------|
| `src/components/` | Reusable UI components |
| `src/pages/` | Route-level components |
| `src/context/` | Global state (AuthContext) |
| `src/types/` | TypeScript type definitions |
| `src/utils/` | Utility functions |
| `src/data/` | Mock data and fixtures |
| `src/App.tsx` | Root component and router |
| `src/main.tsx` | Application entry point |
| `index.html` | HTML template |
| `vite.config.ts` | Vite configuration |
| `tailwind.config.js` | Tailwind CSS theme |
| `tsconfig.json` | TypeScript settings |
| `.env` | Environment variables |

## Import Shortcuts

```typescript
// Use @ alias for absolute imports
import Button from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'
import type { User } from '@/types'
```

## Common Commands

```bash
# Development
npm run dev              # Start dev server

# Production
npm run build            # Build for production
npm run preview          # Preview production build

# Code Quality
npm run type-check       # Run TypeScript checks
npm run lint            # Run ESLint (if configured)

# Dependencies
npm install             # Install dependencies
npm update              # Update packages
npm list               # List installed packages
```

## Component Template

```typescript
import React from 'react'

interface ComponentProps {
  title: string
  onAction?: (value: any) => void
  className?: string
}

export default function Component({ 
  title, 
  onAction, 
  className 
}: ComponentProps) {
  return (
    <div className={className}>
      <h3>{title}</h3>
    </div>
  )
}
```

## Page Template

```typescript
import { useAuth } from '@/context/AuthContext'
import DashboardLayout from '@/components/layout/DashboardLayout'

export default function PageName() {
  const { user } = useAuth()

  if (!user) {
    return <div>Loading...</div>
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        <h1 className="text-3xl font-bold">Page Title</h1>
        {/* Page content */}
      </div>
    </DashboardLayout>
  )
}
```

## Hooks Reference

### useAuth
```typescript
const { user, isAuthenticated, login, logout } = useAuth()
```

### useState
```typescript
const [state, setState] = useState<Type>(initialValue)
```

### useEffect
```typescript
useEffect(() => {
  // Side effect
  return () => {
    // Cleanup
  }
}, [dependencies])
```

### useCallback
```typescript
const callback = useCallback(() => {
  // Memoized function
}, [dependencies])
```

### useContext
```typescript
const context = useContext(AuthContext)
```

## Tailwind Classes Cheat Sheet

### Layout
```
flex | grid | block | inline | relative | absolute | fixed
justify-center | items-center | gap-4
w-full | h-screen | max-w-md
```

### Spacing
```
p-4 | m-4 | pt-6 | mb-8
px-4 | py-2 | mx-auto | my-0
```

### Typography
```
text-lg | text-base | text-sm
font-bold | font-semibold | font-normal
text-gray-700 | text-white
```

### Colors
```
bg-blue-500 | bg-white | bg-gray-50
border | border-gray-200 | border-2
text-red-600 | text-green-500
```

### States
```
hover:bg-blue-600 | focus:ring-2 | disabled:opacity-50
```

### Responsive
```
md:w-1/2 | lg:grid-cols-3 | sm:text-lg
```

## API Patterns

### Fetch Data
```typescript
const [data, setData] = useState(null)
const [loading, setLoading] = useState(true)

useEffect(() => {
  fetch('/api/endpoint')
    .then(res => res.json())
    .then(data => setData(data))
    .finally(() => setLoading(false))
}, [])
```

### Post Request
```typescript
const handleSubmit = async (formData) => {
  try {
    const response = await fetch('/api/endpoint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    })
    const result = await response.json()
  } catch (error) {
    console.error('Error:', error)
  }
}
```

## Component Patterns

### Modal Pattern
```tsx
<Modal isOpen={open} onClose={() => setOpen(false)}>
  <div className="p-6">
    <h2>Modal Title</h2>
  </div>
</Modal>
```

### Toast Pattern
```tsx
const showToast = (message, type = 'success') => {
  // Implement toast notification
}

showToast('Success!', 'success')
showToast('Error occurred', 'error')
```

### Form Pattern
```tsx
const [formData, setFormData] = useState({ email: '', password: '' })

const handleChange = (e) => {
  const { name, value } = e.target
  setFormData(prev => ({ ...prev, [name]: value }))
}

const handleSubmit = (e) => {
  e.preventDefault()
  // Process form
}

<form onSubmit={handleSubmit} className="space-y-4">
  <input
    name="email"
    type="email"
    value={formData.email}
    onChange={handleChange}
    className="w-full px-4 py-2 border rounded-lg"
  />
</form>
```

## Debugging Tips

### Log State Changes
```typescript
useEffect(() => {
  console.log('State changed:', user)
}, [user])
```

### Check Component Renders
```typescript
export default function Component(props) {
  console.log('Component rendered')
  return <div>Content</div>
}
```

### Network Requests
Open DevTools → Network tab to inspect API calls

### React DevTools
Browser extension for inspecting component tree and props

## Folder Navigation

```bash
# Go to frontend root
cd d:\startup

# Go to backend
cd leadsync-backend

# Go back to frontend
cd ..
```

## Environment Variables

Common variables to set:

```env
VITE_API_BASE_URL=http://localhost:4000
VITE_APP_NAME=LeadSync
DEBUG=true
```

Access in code:
```typescript
const apiUrl = import.meta.env.VITE_API_BASE_URL
```

## Type System Quick Reference

### Define Interface
```typescript
interface User {
  id: string
  email: string
  name: string
}
```

### Define Type
```typescript
type Status = 'pending' | 'active' | 'inactive'
```

### Generic Components
```typescript
interface Props<T> {
  items: T[]
  onSelect: (item: T) => void
}
```

## Code Style

### Naming
- Components: `PascalCase` → `UserProfile.tsx`
- Functions: `camelCase` → `getUserData()`
- Constants: `UPPER_SNAKE_CASE` → `API_BASE_URL`
- Files: Match exported component name

### Imports Organization
```typescript
// React and external libraries first
import React, { useState } from 'react'

// Internal imports
import Button from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'
import type { User } from '@/types'
```

## Key Concepts

**Components** - Reusable UI building blocks
**Props** - Component configuration passed from parent
**State** - Component data that changes over time
**Context** - Global state without prop drilling
**Hooks** - Functions to use state and effects
**Effects** - Side effects and data fetching
**Types** - TypeScript interfaces for type safety

## Routing Structure

```
/                    → Home.tsx
/login               → Login.tsx
/signup              → Signup.tsx
/dashboard           → DashboardHome.tsx
/dashboard/leads     → Leads.tsx
/dashboard/conversations → Conversations.tsx
/dashboard/deals     → Deals.tsx
/dashboard/revenue   → Revenue.tsx
/dashboard/reports   → Reports.tsx
/dashboard/settings  → Settings.tsx
```

## Getting Help

1. Check [FRONTEND_STRUCTURE.md](FRONTEND_STRUCTURE.md) for file organization
2. Check [FRONTEND_COMPONENTS.md](FRONTEND_COMPONENTS.md) for component details
3. Check [FRONTEND_PAGES.md](FRONTEND_PAGES.md) for page structure
4. Check [FRONTEND_SETUP.md](FRONTEND_SETUP.md) for running instructions
5. Check [FRONTEND_ARCHITECTURE.md](FRONTEND_ARCHITECTURE.md) for patterns
6. Check [FRONTEND_STYLING.md](FRONTEND_STYLING.md) for styling guide

