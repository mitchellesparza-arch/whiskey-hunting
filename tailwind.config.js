/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bourbon: {
          50:  '#fdf6ec',
          100: '#faebd3',
          200: '#f5d2a0',
          300: '#efb365',
          400: '#e8943a',
          500: '#e2771d',
          600: '#cb5c14',
          700: '#a84312',
          800: '#873516',
          900: '#6e2d15',
        },
      },
    },
  },
  plugins: [],
}
