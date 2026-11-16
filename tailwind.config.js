/** @type {import('tailwindcss').Config} */
// Brand palette sampled from the physical product (assets-src/foto-referencia.webp):
// matte black PLA body + the cyan/teal stacked-tile logo. Accent colours are CSS variables
// (src/index.css) so arbitrary shadows/gradients can reuse them with alpha.
const rgbVar = (name) => `rgb(var(${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        ink: {
          950: '#09090b',
          900: '#111214',
          800: '#18191c',
          700: '#202226',
          600: '#2a2c31',
          500: '#383b42',
        },
        fg: { DEFAULT: '#e7e9ec', muted: '#9ca1a9', dim: '#666b74' },
        accent: { DEFAULT: rgbVar('--accent'), soft: rgbVar('--accent-soft'), deep: rgbVar('--accent-deep') },
        brand: { tile: rgbVar('--brand-tile'), tileDeep: rgbVar('--brand-tile-deep'), deck: '#8d9299' },
        pla: { DEFAULT: '#0e0f11', edge: '#1b1d21', hi: '#2a2d33' },
        oled: { fg: '#e8f6ff', bg: '#000000' },
        pcb: { board: '#0c0d0f', edge: '#1d1f23', gold: '#c8a24a', goldDeep: '#8a6a24', silk: '#e9eaec', metal: '#b8bdc4', metalDeep: '#7d838c', chip: '#18191c' },
        ok: '#3ddc97',
        warn: '#ffb020',
        danger: '#ff5468',
      },
      borderColor: { DEFAULT: 'rgba(255,255,255,0.06)', strong: 'rgba(255,255,255,0.12)' },
      boxShadow: {
        panel: '0 1px 0 rgba(255,255,255,0.04) inset, 0 12px 32px -12px rgba(0,0,0,0.6)',
        glow: '0 0 0 1px rgb(var(--accent) / 0.7), 0 0 22px rgb(var(--accent) / 0.32)',
        led: '0 0 8px rgb(var(--accent) / 0.75)',
        pop: '0 24px 64px -16px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.07)',
        key: '0 1px 0 rgba(255,255,255,0.07) inset, 0 -2px 0 rgba(0,0,0,0.5) inset, 0 10px 18px -8px rgba(0,0,0,0.9)',
      },
      keyframes: {
        pulseDot: {
          '0%,100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.45', transform: 'scale(0.8)' },
        },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        breathe: { '0%,100%': { opacity: '0.55' }, '50%': { opacity: '1' } },
      },
      animation: {
        pulseDot: 'pulseDot 1.6s ease-in-out infinite',
        shimmer: 'shimmer 2s linear infinite',
        breathe: 'breathe 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
