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
        "surface-3": "var(--surface-3)",
        text: "var(--text)",
        "text-2": "var(--text-2)",
        muted: "var(--muted)",
        "muted-2": "var(--muted-2)",
        border: "var(--border)",
        "border-2": "var(--border-2)",
        brand: "var(--brand)",
        "brand-2": "var(--brand-2)",
        "brand-soft": "var(--brand-soft)",
        "brand-soft-2": "var(--brand-soft-2)",
        accent: "var(--accent)",
        "accent-soft": "var(--accent-soft)",
        pos: "var(--pos)",
        "pos-soft": "var(--pos-soft)",
        neg: "var(--neg)",
        "neg-soft": "var(--neg-soft)",
        warn: "var(--warn)",
        "warn-soft": "var(--warn-soft)"
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)"
      },
      fontFamily: {
        sans: ["var(--font-sans)", "sans-serif"],
        display: ["var(--font-display)", "serif"],
        mono: ["var(--font-mono)", "monospace"]
      },
      boxShadow: {
        subtle: "var(--shadow-1)",
        soft: "var(--shadow-2)",
        pop: "var(--shadow-pop)"
      }
    }
  },
  plugins: []
};

export default config;
