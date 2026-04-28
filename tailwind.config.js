/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#FFFFFF',
        surface: '#FAFAF8',
        'surface-raised': '#FFFFFF',
        ink: {
          DEFAULT: '#1A1A1A',
          muted: '#6B6B6B',
          subtle: '#9A9A9A',
        },
        accent: {
          DEFAULT: '#B08A3E',
          deep: '#8C6A28',
          subtle: '#E0CFA6',
          glow: '#D9BD7C',
        },
        border: {
          DEFAULT: '#E5E5E5',
          strong: '#CCCCCC',
        },
        overlay: 'rgba(26, 26, 26, 0.55)',
        success: { DEFAULT: '#5C7A4A', bg: '#E3E8D5' },
        warning: { DEFAULT: '#B8761F', bg: '#F1E2C2' },
        error:   { DEFAULT: '#9A2A2A', bg: '#EFD8D2' },
        info:    { DEFAULT: '#3F5A6E', bg: '#DCE3E8' },
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        'serif-sc': ['"Cormorant SC"', '"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display-xl': ['clamp(2.5rem, 5vw + 1rem, 4.5rem)', { lineHeight: '1.05', letterSpacing: '-0.01em', fontWeight: '500' }],
        'display-lg': ['clamp(2rem, 3.5vw + 0.5rem, 3.25rem)', { lineHeight: '1.10', letterSpacing: '-0.005em', fontWeight: '500' }],
        'display-md': ['clamp(1.625rem, 2vw + 0.5rem, 2.25rem)', { lineHeight: '1.15', fontWeight: '500' }],
        'display-sm': ['clamp(1.25rem, 1.5vw + 0.25rem, 1.5rem)', { lineHeight: '1.20', letterSpacing: '0.01em', fontWeight: '600' }],
        'eyebrow': ['clamp(0.75rem, 0.8vw, 0.8125rem)', { lineHeight: '1.0', letterSpacing: '0.18em', fontWeight: '600', textTransform: 'uppercase' }],
        'body-lg': ['clamp(1.0625rem, 1vw + 0.25rem, 1.125rem)', { lineHeight: '1.65', letterSpacing: '0.005em' }],
        'body': ['clamp(0.9375rem, 0.9vw + 0.1rem, 1rem)', { lineHeight: '1.60' }],
        'body-sm': ['clamp(0.8125rem, 0.8vw, 0.875rem)', { lineHeight: '1.50', letterSpacing: '0.01em' }],
        'label': ['clamp(0.8125rem, 0.8vw, 0.875rem)', { lineHeight: '1.0', letterSpacing: '0.08em', fontWeight: '600', textTransform: 'uppercase' }],
      },
    },
  },
  plugins: [],
}
