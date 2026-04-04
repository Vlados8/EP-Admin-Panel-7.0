/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#0a0a0c',
          800: '#121214',
          700: '#1a1a1e',
          DEFAULT: '#0a0a0c',
        },
        brand: {
          blue: '#3B82F6',
          gold: '#F59E0B',
        }
      },
    },
  },
  plugins: [],
}
