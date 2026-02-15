# Frontend Styling & Configuration

Tailwind CSS, PostCSS, Vite configuration, and design system.

## Styling Architecture

### Tailwind CSS

**Framework:** Utility-first CSS framework

**Location:** `tailwind.config.js`

#### TailwindCSS Configuration

```javascript
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Custom colors
      colors: {
        // Brand colors
        primary: '#...',
        secondary: '#...',
        // Status colors
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6',
      },
      // Custom spacing
      spacing: {
        // Extends default spacing
      },
      // Custom fonts
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
```

### Global Styles

**Location:** `src/index.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Custom base styles */
html {
  scroll-behavior: smooth;
}

/* Component utilities */
@layer components {
  .btn-primary {
    @apply px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition
  }
}
```

---

## PostCSS Configuration

**Location:** `postcss.config.js`

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  }
}
```

**Purpose:**
- Autoprefixer: Adds vendor prefixes to CSS
- Tailwind: Processes Tailwind directives

---

## Vite Configuration

**Location:** `vite.config.ts`

### Key Configuration

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  
  // Path aliases for imports
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  
  // Dev server
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      }
    }
  },
  
  // Build optimization
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
  }
})
```

---

## TypeScript Configuration

**Location:** `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

---

## Design System / Utility Classes

### Common Tailwind Utilities

#### Spacing (Padding/Margin)

```html
<!-- 1rem (16px) increments -->
<div class="p-4">Padding</div>        <!-- All sides -->
<div class="px-6">Horizontal padding</div>
<div class="py-8">Vertical padding</div>
<div class="pt-4">Padding top</div>

<div class="m-4">Margin</div>
<div class="mt-6">Margin top</div>
```

#### Colors

```html
<!-- Text colors -->
<div class="text-gray-700">Text</div>
<div class="text-blue-600">Primary text</div>

<!-- Background colors -->
<div class="bg-white">Light background</div>
<div class="bg-gray-50">Subtle background</div>
<div class="bg-blue-500">Primary background</div>

<!-- Border colors -->
<div class="border border-gray-200">Border</div>
<div class="border-2 border-blue-500">Strong border</div>
```

#### Typography

```html
<!-- Font sizes -->
<h1 class="text-3xl font-bold">Heading 1</h1>
<h2 class="text-2xl font-semibold">Heading 2</h2>
<p class="text-base">Paragraph</p>
<span class="text-sm text-gray-600">Small text</span>

<!-- Font weights -->
<div class="font-thin">100</div>
<div class="font-normal">400</div>
<div class="font-bold">700</div>
```

#### Flexbox/Grid

```html
<!-- Flex layouts -->
<div class="flex items-center justify-between gap-4">
  <div>Item 1</div>
  <div>Item 2</div>
</div>

<!-- Grid layouts -->
<div class="grid grid-cols-3 gap-4">
  <div>Column 1</div>
  <div>Column 2</div>
  <div>Column 3</div>
</div>
```

#### Responsive Design

```html
<!-- Mobile-first responsive -->
<div class="w-full md:w-1/2 lg:w-1/3">
  Responsive width
</div>

<!-- Breakpoints -->
<!-- sm: 640px -->
<!-- md: 768px -->
<!-- lg: 1024px -->
<!-- xl: 1280px -->
<!-- 2xl: 1536px -->
```

#### States

```html
<!-- Hover states -->
<button class="bg-blue-500 hover:bg-blue-600">Button</button>

<!-- Focus states -->
<input class="border focus:border-blue-500 focus:ring-2 focus:ring-blue-200" />

<!-- Disabled states -->
<button class="opacity-50 cursor-not-allowed disabled:opacity-50">Disabled</button>
```

---

## Common Component Classes

### Button Patterns

```tsx
// Primary button
<button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
  Action
</button>

// Secondary button
<button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
  Cancel
</button>

// Disabled button
<button className="px-4 py-2 bg-gray-300 text-gray-500 cursor-not-allowed opacity-50">
  Disabled
</button>
```

### Card Pattern

```tsx
<div className="bg-white rounded-lg shadow p-6">
  <h3 className="text-lg font-semibold mb-4">Card Title</h3>
  <p className="text-gray-600">Card content</p>
</div>
```

### Modal Pattern

```tsx
<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
  <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
    <h2 className="text-xl font-bold mb-4">Modal Title</h2>
    <p className="text-gray-600 mb-6">Modal content</p>
    <div className="flex gap-3 justify-end">
      <button className="px-4 py-2 text-gray-700 border rounded-lg">
        Cancel
      </button>
      <button className="px-4 py-2 bg-blue-600 text-white rounded-lg">
        Confirm
      </button>
    </div>
  </div>
</div>
```

---

## Asset Configuration

### Public Assets

- **Location:** `public/`
- **Accessible via:** `/filename`
- Examples: Favicon, static images

### Imported Assets

```typescript
import logo from '@/assets/logo.png'

export function Header() {
  return <img src={logo} alt="Logo" />
}
```

---

## CSS Best Practices

1. **Use Tailwind First** - Minimize custom CSS
2. **Responsive Design** - Mobile-first approach
3. **Consistent Colors** - Use theme colors
4. **Accessible Colors** - Sufficient contrast
5. **Semantic HTML** - Proper element usage
6. **No Inline Styles** - Use Tailwind classes
7. **Component Classes** - Create reusable patterns

---

## Performance Considerations

### Tree Shaking

- Remove unused Tailwind classes (configure content paths)
- Dead code elimination by Vite

### Minification

Vite automatically minifies production builds

### Image Optimization

- Lazy load images
- Use appropriate formats (webp, png, jpg)
- Compress before deployment

### CSS Optimization

Tailwind purges unused styles in production

