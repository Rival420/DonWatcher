/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark Cyber Theme
        cyber: {
          bg: {
            primary: '#0a0e17',
            secondary: '#111827',
            tertiary: '#1a2332',
            card: '#151d2b',
            hover: '#1e293b',
          },
          border: {
            DEFAULT: '#1e3a5f',
            light: '#2d4a6f',
            glow: '#00d4ff',
          },
          text: {
            primary: '#e2e8f0',
            secondary: '#94a3b8',
            muted: '#64748b',
          },
          accent: {
            cyan: '#00d4ff',
            blue: '#3b82f6',
            purple: '#8b5cf6',
            pink: '#ec4899',
            green: '#10b981',
            yellow: '#f59e0b',
            red: '#ef4444',
            orange: '#f97316',
          },
          glow: {
            cyan: '0 0 20px rgba(0, 212, 255, 0.3)',
            blue: '0 0 20px rgba(59, 130, 246, 0.3)',
            purple: '0 0 20px rgba(139, 92, 246, 0.3)',
            green: '0 0 20px rgba(16, 185, 129, 0.3)',
            red: '0 0 20px rgba(239, 68, 68, 0.3)',
          }
        }
      },
      fontFamily: {
        sans: ['JetBrains Mono', 'Fira Code', 'monospace'],
        display: ['Orbitron', 'sans-serif'],
      },
      boxShadow: {
        'cyber': '0 0 20px rgba(0, 212, 255, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        'cyber-lg': '0 0 40px rgba(0, 212, 255, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        'glow-cyan': '0 0 20px rgba(0, 212, 255, 0.4)',
        'glow-red': '0 0 20px rgba(239, 68, 68, 0.4)',
        'glow-green': '0 0 20px rgba(16, 185, 129, 0.4)',
        'glow-yellow': '0 0 20px rgba(245, 158, 11, 0.4)',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'scan-line': 'scan-line 3s linear infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'scan-line': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      backgroundImage: {
        'cyber-grid': 'linear-gradient(rgba(0, 212, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 212, 255, 0.03) 1px, transparent 1px)',
        'cyber-gradient': 'linear-gradient(135deg, #0a0e17 0%, #111827 50%, #0a0e17 100%)',
      },
      backgroundSize: {
        'grid': '50px 50px',
      },
    },
  },
  plugins: [],
}

