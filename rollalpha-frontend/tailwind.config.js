/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        navy: { 950: "#0A1226", 900: "#0E1B3D", 800: "#14275A", 700: "#20397A", 300: "#9FB0D6", 200: "#C9D3EA", 100: "#E8EDF7" },
        canvas: "#F3F5F9",
        accent: "#19B3A6",
        gain: { DEFAULT: "#0B8F73", soft: "#E1F5EF" },
        loss: { DEFAULT: "#C93445", soft: "#FBE8EA" },
        warn: { DEFAULT: "#8A5C06", soft: "#FFF3D6" },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ['"Public Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: { card: "0 1px 2px rgba(10,18,38,.06), 0 4px 16px rgba(10,18,38,.05)" },
    },
  },
  plugins: [],
};
