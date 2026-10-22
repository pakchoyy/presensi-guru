import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0fdfa",
          100: "#ccfbf1",
          200: "#99f6e4",
          300: "#5eead4",
          400: "#2dd4bf",
          500: "#14b8a6",
          600: "#0d9488",
          700: "#0f766e",
          800: "#115e59",
          DEFAULT: "#0d9488",
        },
        /* Alias legacy "blue" supaya file lama tidak langsung patah */
        blue: {
          DEFAULT: "#0d9488",
          dark: "#0f766e",
        },
        hadir: {
          DEFAULT: "#16a34a",
          bg: "#dcfce7",
          "bg-dark": "#14532d",
        },
        sakit: {
          DEFAULT: "#b45309",
          bg: "#fef3c7",
          "bg-dark": "#78350f",
        },
        izin: {
          DEFAULT: "#1d4ed8",
          bg: "#dbeafe",
          "bg-dark": "#1e3a8a",
        },
        alpha: {
          DEFAULT: "#dc2626",
          bg: "#fee2e2",
          "bg-dark": "#7f1d1d",
        },
      },
      maxWidth: {
        app: "420px",
      },
      fontFamily: {
        sans: ["'Segoe UI'", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
