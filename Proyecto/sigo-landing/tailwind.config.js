/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"Plus Jakarta Sans"',
          'Inter',
          'system-ui',
          'sans-serif',
        ],
      },
      colors: {
        sigo: {
          lime: '#A3E635',
          emerald: '#10B981',
          forest: '#047857',
          teal: '#14B8A6',
          cyan: '#06B6D4',
          deep: '#031A16',
        },
      },
      boxShadow: {
        'liquid': '0 24px 60px -12px rgba(2, 44, 34, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.65), inset 0 -1px 2px rgba(255, 255, 255, 0.15)',
        'liquid-sm': '0 10px 30px -8px rgba(2, 44, 34, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.55)',
        'liquid-glow': '0 0 40px rgba(163, 230, 53, 0.35), 0 16px 40px -10px rgba(6, 182, 212, 0.35)',
      },
    },
  },
  plugins: [],
};
