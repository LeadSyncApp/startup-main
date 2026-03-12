# Frontend Architecture & Context

State management, design patterns, and architectural decisions.

## State Management Strategy

### Context API (AuthContext)

Primary state management tool for authentication and user state.

**Location:** `src/context/AuthContext.tsx`

**Purpose:** Centralized authentication state

#### AuthContext Provider

```typescript
interface AuthContextType {
  // State
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  
  // Methods
  login: (email: string, password: string) => Promise<void>
  signup: (data: SignupData) => Promise<void>
  logout: () => void
  updateProfile: (data: ProfileData) => Promise<void>
  refreshToken: () => Promise<void>
}

// Usage in components
const { user, isAuthenticated, login, logout } = useAuth()
```

#### User Interface

```typescript
interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'user'
  phone?: string
  avatar?: string
  companyId?: string
  createdAt: Date
  updatedAt: Date
}
```

---

## Component State Patterns

### Local Component State

```typescript
// Use useState for component-specific state
const [isModalOpen, setIsModalOpen] = useState(false)
const [formData, setFormData] = useState<FormData>({})
const [loading, setLoading] = useState(false)
```

### Effects and Side Effects

```typescript
// Use useEffect for data fetching and subscriptions
useEffect(() => {
  // Fetch data
  // Subscribe to events
  // Set up timers
  
  return () => {
    // Cleanup
  }
}, [dependencies])
```

---

## Data Flow Architecture

### Component Communication

```
App (Root)
├── AuthContext Provider
│   ├── Layout Components
│   │   └── Sidebar
│   │
│   ├── Page Components (Protected by PrivateRoute)
│   │   ├── Dashboard
│   │   ├── Leads
│   │   └── Conversations
│   │
│   └── Toast/Notification Container
```

### API Communication Pattern

```typescript
// Services layer (if implemented)
src/services/
├── api.ts              // Axios/fetch setup
├── authService.ts      // Auth API calls
├── leadsService.ts     // Leads CRUD
└── telegramService.ts  // Telegram integration

// Component
↓
Service Function
↓
API Call
↓
Update Context/State
↓
Re-render Component
```

---

## Hooks Usage

### Custom Hooks Pattern

```typescript
// src/hooks/useAuth.ts
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

// Usage
const { user, login } = useAuth()
```

### Common React Hooks

- `useState` - Local state management
- `useEffect` - Side effects and data fetching
- `useContext` - Access global context (auth)
- `useCallback` - Memoize callbacks
- `useMemo` - Memoize expensive computations
- `useRef` - Direct DOM access (avoid if possible)

---

## Type System

### Central Type Definitions

**Location:** `src/types/index.ts`

```typescript
// User types
export interface User {
  id: string
  email: string
  name: string
  // ... other fields
}

// Lead types
export interface Lead {
  id: string
  name: string
  email: string
  phone?: string
  status: LeadStatus
  // ... other fields
}

// API Response types
export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
  error?: string
}

// Form types
export interface LoginFormData {
  email: string
  password: string
}
```

### Type Organization

- Entity types (User, Lead, Deal)
- API response types
- Form input types
- Component props interfaces
- Enum types (Status, Role, etc.)

---

## Error Handling

### Global Error Handling

```typescript
// API errors caught by interceptor
apiClient.interceptors.response.use(
  response => response,
  error => {
    // Handle 401 Unauthorized
    if (error.response?.status === 401) {
      // Clear auth and redirect to login
    }
    // Handle other errors
    return Promise.reject(error)
  }
)
```

### Component Error Handling

```typescript
try {
  const result = await login(email, password)
} catch (error) {
  // Show error toast
  // Update error state
}
```

---

## Performance Optimizations

### Code Splitting

Pages should be lazy-loaded:

```typescript
const DashboardHome = lazy(() => import('@/pages/dashboard/DashboardHome'))

<Suspense fallback={<Spinner />}>
  <Routes>
    <Route path="/dashboard" element={<DashboardHome />} />
  </Routes>
</Suspense>
```

### Memoization

```typescript
// Memoize expensive components
export default React.memo(DataTable)

// Memoize callbacks
const handleClick = useCallback(() => {
  // handler logic
}, [dependencies])
```

### Image Optimization

- Use appropriate image formats
- Implement lazy loading
- Compress images

---

## API Integration

### Backend Connection

Frontend connects to backend running on `http://localhost:4000`

**Backend Base URL:** Should be configurable

```typescript
// .env or config
VITE_API_BASE_URL=http://localhost:4000
VITE_API_TIMEOUT=10000
```

### API Endpoints Used

```
Authentication:
  POST /auth/login
  POST /auth/signup
  POST /auth/logout
  POST /auth/refresh

Leads:
  GET /leads
  GET /leads/:id
  POST /leads
  PUT /leads/:id
  DELETE /leads/:id

Conversations:
  GET /conversations
  POST /conversations/:id/messages
  
Telegram:
  POST /integrations/telegram/webhook
  GET /integrations/telegram/status
```

---

## Environment Configuration

### Development

```
VITE_API_BASE_URL=http://localhost:4000
VITE_APP_NAME=LeadSync
DEBUG=true
```

### Production

```
VITE_API_BASE_URL=https://api.leadsync.com
VITE_APP_NAME=LeadSync
DEBUG=false
```

---

## Folder Organization Philosophy

```
Separation of Concerns:
  - Components: UI only
  - Pages: Route handlers
  - Context: Global state
  - Services: API calls
  - Utils: Pure functions
  - Types: Type definitions
  - Data: Constants/mocks
```

