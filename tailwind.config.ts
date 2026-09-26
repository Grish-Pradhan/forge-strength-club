import type { Config } from 'tailwindcss';

/**
 * Forge Strength Club — design tokens.
 * Brand: deep "iron" blacks + ember orange / gold accents (carried over from v1 brand).
 * Fonts are injected by next/font as CSS variables in app/layout.tsx.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#17181A',
          900: '#101113',
          800: '#17181A',
          700: '#1E2023',
          600: '#26282C',
          500: '#31343A',
          400: '#3A3D42',
        },
        ember: {
          DEFAULT: '#FF5A1F',
          600: '#E8481A',
          700: '#C93A12',
          soft: 'rgba(255, 90, 31, 0.14)',
        },
        gold: {
          DEFAULT: '#E8A33D',
          soft: 'rgba(232, 163, 61, 0.12)',
        },
        bone: {
          DEFAULT: '#F4F1EA',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        ember: '0 10px 24px -10px rgba(255, 90, 31, 0.65)',
        'ember-lg': '0 18px 40px -12px rgba(255, 90, 31, 0.55)',
        glass: '0 8px 32px rgba(0, 0, 0, 0.35)',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(255, 90, 31, 0.35)' },
          '50%': { boxShadow: '0 0 42px rgba(255, 90, 31, 0.6)' },
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
