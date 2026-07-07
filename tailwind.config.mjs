/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        gleams: {
          50: '#fff0f7',
          100: '#ffe3ef',
          200: '#ffc6e0',
          300: '#ff97c3',
          400: '#ff5c9f',
          500: '#ff277e',
          600: '#f0005c',
          700: '#cc0048',
          800: '#a8003c',
          900: '#8c0335',
          950: '#57001c',
        },
        dream: {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c06cff',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7e22ce',
          800: '#6b21a8',
          900: '#581c87',
          950: '#3b0764',
        },
      },
      fontFamily: {
        sans: ['"Noto Sans SC"', '"Noto Sans JP"', 'sans-serif'],
        display: ['"M PLUS Rounded 1c"', '"Noto Sans SC"', 'sans-serif'],
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'float-delayed': 'float 6s ease-in-out 3s infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'slide-up': 'slideUp 0.6s ease-out',
        'slide-up-delayed': 'slideUp 0.6s ease-out 0.2s both',
        'fade-in': 'fadeIn 0.8s ease-out',
        'shimmer': 'shimmer 2s linear infinite',
        'star-move': 'starMove 20s linear infinite',
        'star-move-reverse': 'starMove 25s linear infinite reverse',
        'bounce-gentle': 'bounceGentle 2s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(192, 108, 255, 0.3), 0 0 40px rgba(255, 39, 126, 0.1)' },
          '100%': { boxShadow: '0 0 30px rgba(192, 108, 255, 0.5), 0 0 60px rgba(255, 39, 126, 0.2)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(40px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        starMove: {
          '0%': { transform: 'translateY(0) rotate(0deg)' },
          '100%': { transform: 'translateY(-100vh) rotate(360deg)' },
        },
        bounceGentle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      backgroundImage: {
        'gleams-gradient': 'linear-gradient(135deg, #ff277e, #c06cff, #7e22ce)',
        'gleams-gradient-subtle': 'linear-gradient(135deg, rgba(255,39,126,0.1), rgba(192,108,255,0.1))',
        'glass-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
