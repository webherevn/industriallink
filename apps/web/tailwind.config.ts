import type { Config } from 'tailwindcss';

/**
 * Brand navy chính: #072348 (theo brand iLink).
 * Chỉ đổi thang brand — emerald / amber / slate / sky giữ nguyên.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#eef1f6',
          100: '#d8e0eb',
          200: '#b4c3d7',
          300: '#869ebc',
          400: '#52749a',
          500: '#0f3d6e',
          600: '#072348',
          700: '#051b38',
          800: '#04142a',
          900: '#020c1a',
        },
      },
      keyframes: {
        'soft-rise': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'step-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(7, 35, 72, 0.35)' },
          '50%': { boxShadow: '0 0 0 6px rgba(7, 35, 72, 0)' },
        },
        'chip-pop': {
          '0%': { opacity: '0', transform: 'scale(0.92)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'bar-grow': {
          '0%': { transform: 'scaleX(0)' },
          '100%': { transform: 'scaleX(1)' },
        },
        'search-shimmer': {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
      },
      animation: {
        'soft-rise': 'soft-rise 0.35s ease-out both',
        'step-pulse': 'step-pulse 2s ease-in-out infinite',
        'chip-pop': 'chip-pop 0.22s cubic-bezier(0.22, 1, 0.36, 1) both',
        'bar-grow': 'bar-grow 0.55s cubic-bezier(0.22, 1, 0.36, 1) both',
        'search-shimmer': 'search-shimmer 1.4s linear infinite',
      },
      transitionTimingFunction: {
        soft: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
