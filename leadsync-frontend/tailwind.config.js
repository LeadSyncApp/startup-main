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
  /* Arbitrary values inside ternaries/template literals can't be detected by
     Tailwind's JIT scanner. Safelist them so they're always emitted. */
  safelist: [
    "pt-[596px]",
    "h-[564px]",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Plus Jakarta Sans', 'Inter', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
      },
      colors: {
        /* SOURCE OF TRUTH IS src/index.css. These literals mirror the light-mode
           values of the matching CSS custom properties.
           They used to hold the pre-rebrand gold/navy palette, which meant a
           class like `text-brand-saffron` silently rendered GOLD while the rest
           of the app rendered terracotta. Keep them in sync when index.css
           changes. Names kept for backwards compatibility — `navy` is no longer
           navy, it is the terracotta accent. */
        brand: {
          navy: '#D36B46',          // --brand-navy
          'navy-light': '#E48F71',  // --brand-navy-light
          saffron: '#D36B46',       // --brand-saffron (terracotta)
          'saffron-light': '#E48F71',
          'saffron-soft': 'rgba(211, 107, 70, 0.08)',
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
        /* Mirrors --success-green / --warning-amber / --danger-red / --info-blue */
        status: {
          success: '#86C232',
          warning: '#D36B46',
          danger: '#a63232',
          info: '#3A4B46',
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