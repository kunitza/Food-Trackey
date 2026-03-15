/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          purple: '#846075',
          tan: '#D4AA7D',
          green: '#87D68D',
          dark: '#082900',
          mauve: '#DBD3D8',
          plum: '#2F222A',
          sage: '#727E6C',
        }
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        display: ['"Outfit"', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
