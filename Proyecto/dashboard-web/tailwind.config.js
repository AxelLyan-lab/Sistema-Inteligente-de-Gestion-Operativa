/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        'sigo-bg':       '#0a0e1a',
        'sigo-surface':  '#111827',
        'sigo-surface2': '#1a2235',
        'sigo-border':   '#1f2937',
        'sigo-accent':   '#00d4ff',
        'sigo-accent2':  '#0ea5e9',
        'sigo-text':     '#e2e8f0',
        'sigo-muted':    '#64748b',
        'disponible':    '#10b981',
        'en-ruta':       '#3b82f6',
        'patrullando':   '#f59e0b',
        'emergencia':    '#ef4444',
        'inactivo':      '#6b7280',
        'completada':    '#10b981',
        'incumplido':    '#f97316',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-red':    'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-in-r':   'slideInRight 0.3s ease-out',
        'slide-in-l':   'slideInLeft 0.3s ease-out',
        'fade-in':      'fadeIn 0.2s ease-out',
        'ping-slow':    'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
      keyframes: {
        slideInRight: {
          from: { transform: 'translateX(100%)', opacity: '0' },
          to:   { transform: 'translateX(0)',    opacity: '1' },
        },
        slideInLeft: {
          from: { transform: 'translateX(-100%)', opacity: '0' },
          to:   { transform: 'translateX(0)',     opacity: '1' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
      },
      boxShadow: {
        'glow-accent':  '0 0 20px rgba(0, 212, 255, 0.3)',
        'glow-red':     '0 0 20px rgba(239, 68, 68, 0.4)',
        'glow-green':   '0 0 15px rgba(16, 185, 129, 0.3)',
        'card':         '0 4px 24px rgba(0, 0, 0, 0.4)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
