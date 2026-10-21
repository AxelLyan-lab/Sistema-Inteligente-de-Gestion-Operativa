/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        'sigo-bg':       'var(--sigo-bg)',
        'sigo-surface':  'var(--sigo-surface)',
        'sigo-surface2': 'var(--sigo-surface2)',
        'sigo-border':   'var(--sigo-border)',
        'sigo-accent':   'var(--sigo-accent)',
        'sigo-accent2':  'var(--sigo-accent2)',
        'sigo-text':     'var(--sigo-text)',
        'sigo-muted':    'var(--sigo-muted)',
        'disponible':    'var(--sigo-disponible)',
        'en-ruta':       'var(--sigo-en-ruta)',
        'patrullando':   'var(--sigo-patrullando)',
        'emergencia':    'var(--sigo-emergencia)',
        'inactivo':      'var(--sigo-inactivo)',
        'completada':    'var(--sigo-disponible)',
        'incumplido':    'var(--sigo-patrullando)',
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
        'glow-accent':  '0 0 16px rgba(27, 59, 43, 0.45)',
        'glow-red':     '0 0 16px rgba(239, 68, 68, 0.4)',
        'glow-green':   '0 0 14px rgba(47, 125, 82, 0.35)',
        'card':         '0 2px 12px var(--sigo-shadow)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
