import type { Config } from 'tailwindcss';

/**
 * Forge Strength Club — design tokens.
 * Semantic tokens resolve at runtime for every global festival theme.
 * Fonts are injected by next/font as CSS variables in app/layout.tsx.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: 'rgb(var(--bg-primary-rgb) / <alpha-value>)',
          900: 'rgb(var(--bg-deep-rgb) / <alpha-value>)',
          800: 'rgb(var(--bg-primary-rgb) / <alpha-value>)',
          700: 'rgb(var(--card-bg-rgb) / <alpha-value>)',
          600: 'rgb(var(--bg-secondary-rgb) / <alpha-value>)',
          500: 'rgb(var(--surface-raised-rgb) / <alpha-value>)',
          400: 'rgb(var(--surface-muted-rgb) / <alpha-value>)',
        },
        ember: {
          DEFAULT: 'rgb(var(--accent-rgb) / <alpha-value>)',
          600: 'rgb(var(--accent-strong-rgb) / <alpha-value>)',
          700: 'rgb(var(--accent-deep-rgb) / <alpha-value>)',
          soft: 'rgb(var(--accent-rgb) / 0.14)',
        },
        gold: {
          DEFAULT: 'rgb(var(--gold-rgb) / <alpha-value>)',
          soft: 'rgb(var(--gold-rgb) / 0.12)',
        },
        bone: {
          DEFAULT: 'rgb(var(--text-main-rgb) / <alpha-value>)',
        },
        'theme-border': 'rgb(var(--border-rgb) / <alpha-value>)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        ember: '0 10px 24px -10px rgb(var(--accent-rgb) / 0.65)',
        'ember-lg': '0 18px 40px -12px rgb(var(--accent-rgb) / 0.55)',
        glass: '0 8px 32px rgba(0, 0, 0, 0.35)',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 20px rgb(var(--accent-rgb) / 0.35)' },
          '50%': { boxShadow: '0 0 42px rgb(var(--accent-rgb) / 0.6)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        'pulse-glow': 'pulse-glow 2.6s ease-in-out infinite',
        marquee: 'marquee 28s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
