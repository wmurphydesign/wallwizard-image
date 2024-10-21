/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#FF165D',
        secondary: '#FF9A00',
        tertiary: '#FAF2E5',
        background: {
          light: '#FFFFFF',
          dark: '#E9F1F6',
        },
      },
    },
  },
  plugins: [],
};