import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          DEFAULT: "#2563eb",
        },
        /* Alias legacy "blue" supaya file lama tidak langsung patah */
        blue: {
          DEFAULT: "#2563eb",
          dark: "#1d4ed8",
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
