import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    path.join(__dirname, "./index.html"),
    path.join(__dirname, "./src/**/*.{js,ts,jsx,tsx}")
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Plus Jakarta Sans', 'Inter', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
      },
      colors: {
        brand: {
          navy: '#1E3A5F',
          'navy-light': '#2D4A7A',
          saffron: '#D4A843',
          'saffron-light': '#E8C96A',
          'saffron-soft': '#FFF8E7',
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
        },
        status: {
          success: '#16A34A',
          warning: '#F59E0B',
          danger: '#DC2626',
          info: '#0284C7',
        }
      },
      boxShadow: {
        'soft': 'var(--app-shadow-soft)',
        'md-custom': 'var(--app-shadow-md)',
        'lg-custom': 'var(--app-shadow-lg)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      }
    },
  },
  plugins: [],
}