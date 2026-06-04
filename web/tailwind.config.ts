import type { Config } from 'tailwindcss';

// "Warm Obsidian" — dark obsidian base, gold accents. Platform brand colors.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        obsidian: {
          900: '#0a0a0b',
          800: '#121214',
          700: '#1b1b1e',
          600: '#26262a',
          500: '#323236',
        },
        gold: {
          DEFAULT: '#e9e9e6',
          soft: '#ffffff',
          deep: '#9a9a97',
        },
        twitch: '#9146FF',
        kick: '#53FC18',
        x: '#E7E9EA',
        bull: '#2ecc71',
        bear: '#ff5252',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      keyframes: {
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'hype-pulse': {
          '0%,100%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(235, 235, 232,0.6)' },
          '50%': { transform: 'scale(1.04)', boxShadow: '0 0 24px 4px rgba(235, 235, 232,0.5)' },
        },
        'pop': {
          '0%': { transform: 'scale(0.85)' },
          '60%': { transform: 'scale(1.08)' },
          '100%': { transform: 'scale(1)' },
        },
      },
      animation: {
        'slide-in': 'slide-in 0.18s ease-out',
        'hype-pulse': 'hype-pulse 0.9s ease-in-out infinite',
        'pop': 'pop 0.3s ease-out',
      },
    },
  },
  plugins: [],
};
export default config;
