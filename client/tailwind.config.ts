import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#05080b',
        abyss: '#070c11',
        panel: '#0b1219',
        raised: '#101a22',
        edge: '#1b2a34',
        accent: {
          DEFAULT: '#34d399',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Unbounded', 'Inter', 'sans-serif'],
        pixel: ['"Press Start 2P"', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 50px -18px rgba(52, 211, 153, 0.55)',
        'glow-sm': '0 0 26px -12px rgba(52, 211, 153, 0.6)',
        card: '0 24px 60px -32px rgba(0, 0, 0, 0.9)',
      },
      backgroundImage: {
        'hero-glow':
          'radial-gradient(ellipse 70% 60% at 50% 0%, rgba(52, 211, 153, 0.12), transparent 70%)',
      },
      animation: {
        'fade-up': 'fadeUp 0.55s cubic-bezier(0.16, 1, 0.3, 1) both',
        'toast-in': 'toastIn 0.25s ease-out both',
        'pulse-soft': 'pulseSoft 3s ease-in-out infinite',
        float: 'float 7s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        toastIn: {
          from: { opacity: '0', transform: 'translateX(24px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateX(0) scale(1)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.45' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
