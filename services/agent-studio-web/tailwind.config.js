/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#fdf6ee',
          100: '#f9e8d2',
          200: '#f2cfa0',
          300: '#e9ae65',
          400: '#e08e38',
          500: '#d4711a',
          600: '#bc5710',
          700: '#9c420f',
          800: '#7c3410',
          900: '#632a0e',
        },
      },
    },
  },
  plugins: [],
}
