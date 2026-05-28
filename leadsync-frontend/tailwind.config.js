/** @type {import('tailwindcss').Config} */
const withAlpha = (cssVar) => `rgb(var(${cssVar}) / <alpha-value>)`;

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
          bg: withAlpha('--app-bg-rgb'),
          'bg-soft': withAlpha('--app-bg-soft-rgb'),
          surface: withAlpha('--app-surface-rgb'),
          'surface-alt': withAlpha('--app-surface-alt-rgb'),
          text: withAlpha('--app-text-rgb'),
          'text-muted': withAlpha('--app-text-muted-rgb'),
          border: withAlpha('--app-border-rgb'),
          'border-strong': withAlpha('--app-border-strong-rgb'),
          primary: withAlpha('--app-primary-rgb'),
          'primary-strong': withAlpha('--app-primary-strong-rgb'),
          input: withAlpha('--app-input-bg-rgb'),
          placeholder: withAlpha('--app-input-placeholder-rgb'),
        }
      },
    },
  },
  plugins: [],
}