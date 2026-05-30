/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Outfit', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
      },
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#0891b2', // Updated to match LeadSync brand cyan
          600: '#0e7490',
          700: '#155e75',
          800: '#164e63',
          900: '#164e63',
        },
        leadsync: {
          accent: '#22d3ee',
          dark: '#020617',
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
          'primary-strong': 'var(--app-primary-strong)',
          'primary-soft': 'var(--app-primary-soft)',
        }
      },
    },
  },
  plugins: [],
}