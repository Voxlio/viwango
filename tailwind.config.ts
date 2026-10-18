import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Near-black palette lifted from the reference screens
        ink: {
          950: '#07070A',
          900: '#0B0B0F',
          850: '#101014',
          800: '#141418',
        },
        floor: '#22C77E',
        ceiling: '#F2555A',
        amber: '#F2A03D',
        muted: '#8B8B94',
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        display: [
          'Inter Tight',
          'Inter',
          'ui-sans-serif',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
      },
      borderRadius: {
        card: '26px',
        pill: '999px',
      },
      boxShadow: {
        glass:
          '0 1px 0 0 rgba(255,255,255,0.06) inset, 0 18px 40px -24px rgba(0,0,0,0.9)',
        glow: '0 0 0 1px rgba(255,255,255,0.08), 0 12px 40px -12px rgba(34,199,126,0.35)',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        rise: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.6s linear infinite',
        rise: 'rise 260ms ease-out both',
      },
    },
  },
  plugins: [],
};

export default config;
