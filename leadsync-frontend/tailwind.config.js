/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        leadsync: {
          accent: '#0ea5e9',
          dark: '#0f172a',
        },
        app: {
          bg: 'var(--app-bg)',
          'bg-soft': 'var(--app-bg-soft)',
          surface: 'var(--app-surface)',
          'surface-alt': 'var(--app-surface-alt)',
          text: 'var(--app-text)',
          'text-muted': 'var(--app-text-muted)',
          border: 'var(--app-border)',
          'border-strong': 'var(--app-border-strong)',
          primary: 'var(--app-primary)',
          'primary-strong': 'var(--app-primary-strong)'
        }
      },
    },
  },
  plugins: [],
}