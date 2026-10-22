import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        blue: {
          DEFAULT: "#0ea5a0",
          dark: "#0d7a8a",
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
