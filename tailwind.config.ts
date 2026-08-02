import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Pax brand color — extracted from the favicon swoosh. Minimal color palette: orange, white, black.
        pax: {
          50: "#FEF3EE",
          100: "#FDE5DA",
          200: "#FBC8B3",
          300: "#F8A283",
          400: "#F47B52",
          500: "#EF5728",
          600: "#E04A1F",
          700: "#C43F18",
          800: "#9C3316",
          900: "#7E2C16",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)"],
        mono: ["var(--font-geist-mono)"],
      },
      animation: {
        blob: "blob 7s infinite",
      },
      keyframes: {
        blob: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "33%": { transform: "translate(30px, -50px) scale(1.1)" },
          "66%": { transform: "translate(-20px, 20px) scale(0.9)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
