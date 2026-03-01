/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        'premium': '0 20px 50px rgba(0, 0, 0, 0.04)',
        'premium-hover': '0 30px 70px rgba(0, 0, 0, 0.06)',
        'premium-inset': 'inset 0 2px 10px rgba(0, 0, 0, 0.02)',
      }
    },
  },
  plugins: [],
}