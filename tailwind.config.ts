import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class", "[data-theme='dark']"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        text: "var(--text)",
        "muted-text": "var(--muted-text)",
        border: "var(--border)",
        brand: "var(--brand)",
        "brand-soft": "var(--brand-soft)",
        "brand-accent": "var(--brand-accent)",
        danger: "var(--danger)"
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)"
      },
      fontFamily: {
        sans: ["var(--font-brand)", "Inter", "sans-serif"]
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        subtle: "var(--shadow-subtle)"
      }
    }
  },
  plugins: []
};

export default config;
