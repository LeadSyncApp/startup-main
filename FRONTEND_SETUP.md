# Frontend Setup & Running Guide

Installation, development setup, and running instructions.

## Prerequisites

- **Node.js** v16 or higher
- **npm** v8 or higher
- **Git** for version control

## Project Setup

### Installation Steps

1. **Navigate to project root**
   ```bash
   cd d:\startup
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Install Tailwind CSS** (if not already included)
   ```bash
   npm install -D tailwindcss postcss autoprefixer
   npx tailwindcss init -p
   ```

---

## Configuration Files

### Environment Setup

Create `.env` file in root directory:

```env
# API Configuration
VITE_API_BASE_URL=http://localhost:4000
VITE_API_TIMEOUT=10000

# App Settings
VITE_APP_NAME=LeadSync
VITE_APP_VERSION=1.0.0

# Debug
DEBUG=true
```

### Package.json Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint src --ext ts,tsx --report-unused-disable-directives",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.0.0",
    "tailwindcss": "^3.3.0",
    "typescript": "^5.0.0",
    "vite": "^4.3.0"
  }
}
```

---

## Development Server

### Start Development Server

```bash
npm run dev
```

**Output:**
```
  VITE v4.3.0  ready in 234 ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

**Access Application:**
- Open browser → `http://localhost:5173/`
- Hot Module Replacement (HMR) enabled
- Changes auto-reload

### Development Server Options

```bash
# Run on specific port
npm run dev -- --port 3000

# Run with host access
npm run dev -- --host

# Run with specific host and port
npm run dev -- --host 0.0.0.0 --port 5173
```

---

## Building for Production

### Build Command

```bash
npm run build
```

**Process:**
1. TypeScript compilation check
2. Vite bundling and optimization
3. Code splitting
4. CSS minification
5. Asset optimization

**Output Directory:** `dist/`

### Preview Production Build

```bash
npm run preview
```

Opens local preview of production build (testing only)

---

## Type Checking

### TypeScript Compilation

```bash
npm run type-check
```

**Purpose:** Verify TypeScript types without emitting code

**Run Before:**
- Committing code
- Creating a build
- Production deployment

---

## Linting (Optional)

If ESLint is configured:

```bash
npm run lint
```

---

## Development Workflow

### 1. Start Backend
```bash
cd leadsync-backend
npm run dev
```
Runs on `http://localhost:4000`

### 2. Start Frontend
```bash
cd ..
npm run dev
```
Runs on `http://localhost:5173`

### 3. Optional: Ngrok for Telegram Webhook
```bash
ngrok http 4000
```
Provides public URL for webhook testing

### 4. Access Application
```
http://localhost:5173/
```

### 5. Login/Signup
- Navigate to signup or login page
- Test authentication flow
- Access dashboard

---

## Troubleshooting

### Port Already in Use

```bash
# Windows - Find and kill process on port 5173
netstat -ano | findstr :5173
taskkill /PID <PID> /F

# macOS/Linux
lsof -i :5173
kill -9 <PID>

# Run on different port
npm run dev -- --port 3000
```

### Vite Not Detecting Changes

1. Check file watchers limit on Linux:
   ```bash
   cat /proc/sys/fs/inotify/max_user_watches
   # If low, increase:
   echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
   ```

2. Restart dev server:
   ```bash
   # Stop with Ctrl+C, then run again
   npm run dev
   ```

### Module Not Found Errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules
npm install
```

### TypeScript Errors

```bash
# Clear TypeScript cache
rm -rf node_modules/.vite

# Restart dev server
npm run dev
```

### CORS Errors

Ensure backend is running and vite.config.ts proxy is configured:

```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:4000',
      changeOrigin: true,
    }
  }
}
```

---

## File Structure After Setup

```
d:\startup\
├── node_modules/          (installed packages)
├── dist/                  (production build output)
├── src/                   (source code)
├── .env                   (environment variables - add this)
├── .gitignore
├── package.json
├── package-lock.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
└── index.html
```

---

## Deployment Preparation

### Pre-deployment Checklist

- [ ] Run `npm run type-check` - no errors
- [ ] Run `npm run build` - successful build
- [ ] Test production build with `npm run preview`
- [ ] All environment variables configured
- [ ] Backend API accessible
- [ ] Test critical user flows (login, create lead, etc.)

### Building for Deployment

```bash
npm run build
```

**Output:** `dist/` directory ready for deployment

### Deployment Targets

**Option 1: Vercel**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

**Option 2: Netlify**
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy
```

**Option 3: Traditional Server**
- Upload `dist/` contents to web server
- Configure server for SPA (redirect 404 to index.html)
- Set environment variables on server

---

## Performance Optimization

### Bundle Analysis

```bash
# Install rollup-plugin-visualizer
npm install --save-dev rollup-plugin-visualizer

# Add to vite.config.ts and build
npm run build
```

Opens visualization of bundle size by module

### Code Splitting

Vite automatically creates chunks for:
- Vendor libraries
- Page components (with dynamic imports)
- Shared components

### Lazy Loading Pages

```typescript
import { lazy, Suspense } from 'react'

const DashboardHome = lazy(() => 
  import('@/pages/dashboard/DashboardHome')
)

<Suspense fallback={<Spinner />}>
  <DashboardHome />
</Suspense>
```

---

## Testing (Optional)

If testing framework is added:

```bash
# Run tests
npm run test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

---

## Continuous Integration

Typical CI pipeline steps:

1. Install dependencies
2. Type checking: `npm run type-check`
3. Linting: `npm run lint`
4. Build: `npm run build`
5. Run tests (if configured)
6. Deploy to staging/production

