/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      screens: {
        'xs': '420px',
      },
      screens: {
        'xs': '420px',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      colors: {
        bg:          'var(--bg)',
        'bg-2':      'var(--bg-2)',
        surface:     'var(--surface)',
        'surface-2': 'var(--surface-2)',
        'surface-3': 'var(--surface-3)',
        glass:       'var(--glass)',
        line:        'var(--line)',
        'line-2':    'var(--line-2)',
        'line-3':    'var(--line-3)',
        ink:         'var(--ink)',
        'ink-2':     'var(--ink-2)',
        'ink-3':     'var(--ink-3)',
        'ink-4':     'var(--ink-4)',
        primary: {
          DEFAULT: 'var(--primary)',
          hover:   'var(--primary-h)',
          soft:    'var(--primary-soft)',
        },
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger:  'var(--danger)',
        info:    'var(--info)',
      },
      fontSize: {
        '2xs': '10.5px',
        'xs':  '11.5px',
        'sm':  '13px',
        'base':'14px',
        'md':  '15px',
        'lg':  '17px',
        'xl':  '20px',
        '2xl': '24px',
        '3xl': '30px',
        '4xl': '38px',
        '5xl': '48px',
      },
      borderRadius: {
        DEFAULT: '6px',
        md: '8px',
        lg: '10px',
        xl: '12px',
        '2xl': '16px',
        '3xl': '20px',
      },
      boxShadow: {
        // Multi-layer shadows for premium feel
        'xs':  '0 1px 1px rgba(10,15,26,0.03), 0 2px 4px rgba(10,15,26,0.03)',
        'sm':  '0 1px 1px rgba(10,15,26,0.03), 0 2px 4px rgba(10,15,26,0.03), 0 4px 8px rgba(10,15,26,0.02)',
        'md':  '0 1px 2px rgba(10,15,26,0.04), 0 2px 4px rgba(10,15,26,0.03), 0 4px 8px rgba(10,15,26,0.03), 0 8px 16px rgba(10,15,26,0.03)',
        'lg':  '0 2px 4px rgba(10,15,26,0.04), 0 4px 8px rgba(10,15,26,0.04), 0 8px 16px rgba(10,15,26,0.04), 0 16px 32px rgba(10,15,26,0.05)',
        'xl':  '0 4px 8px rgba(10,15,26,0.05), 0 8px 16px rgba(10,15,26,0.05), 0 16px 32px rgba(10,15,26,0.06), 0 32px 64px rgba(10,15,26,0.07)',
        'modal': '0 8px 16px rgba(10,15,26,0.08), 0 16px 32px rgba(10,15,26,0.08), 0 32px 64px rgba(10,15,26,0.12)',
        'float': '0 4px 8px rgba(10,15,26,0.06), 0 8px 24px rgba(10,15,26,0.08), 0 16px 48px rgba(10,15,26,0.06)',
        // Colored shadows for hover states
        'glow-primary': '0 8px 32px -8px rgba(13,125,111,0.35)',
        'glow-violet':  '0 8px 32px -8px rgba(124,58,237,0.30)',
        'glow-amber':   '0 8px 32px -8px rgba(217,119,6,0.30)',
        'glow-rose':    '0 8px 32px -8px rgba(220,38,38,0.30)',
        'glow-sky':     '0 8px 32px -8px rgba(2,132,199,0.30)',
      },
      keyframes: {
        'draw-v': {
          '0%':   { strokeDashoffset: '140', opacity: '0.3' },
          '50%':  { strokeDashoffset: '0',   opacity: '1' },
          '100%': { strokeDashoffset: '-140',opacity: '0.3' },
        },
        'fade-up': {
          '0%':   { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%':   { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'shimmer': {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-6px)' },
        },
      },
      animation: {
        'draw-v':     'draw-v 1.4s ease-in-out infinite',
        'fade-up':    'fade-up 0.4s cubic-bezier(0.16,1,0.3,1)',
        'fade-in':    'fade-in 0.3s ease-out',
        'scale-in':   'scale-in 0.2s cubic-bezier(0.16,1,0.3,1)',
        'shimmer':    'shimmer 2s linear infinite',
        'float-slow': 'float-slow 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
