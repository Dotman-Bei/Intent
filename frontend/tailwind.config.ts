import type { Config } from "tailwindcss";

/**
 * Token bridge. The canonical values live as CSS custom properties in globals.css (one file, not
 * duplicated per page); this maps them into Tailwind so utilities and the hand-written component
 * classes can never drift apart.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ground: "var(--ground)",
        col: "var(--col)",
        ink: "var(--ink)",
        body: "var(--body)",
        faint: "var(--faint)",
        line: "var(--line)",
        line2: "var(--line-2)",
        tint: "var(--tint)",
        tint2: "var(--tint-2)",
        gold: "var(--gold)",
        term: "var(--term)",
        term2: "var(--term-2)",
        termfg: "var(--term-fg)",
        termdim: "var(--term-dim)",
        ok: "var(--ok)",
      },
      fontFamily: {
        sans: ["Geist", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SF Mono", "monospace"],
      },
      boxShadow: {
        term: "0 1px 2px rgba(25,24,23,.05), 0 16px 40px -24px rgba(25,24,23,.30)",
        pill: "0 2px 6px rgba(25,24,23,.07), 0 10px 24px -14px rgba(25,24,23,.22)",
        tile: "0 1px 2px rgba(25,24,23,.06), 0 4px 10px -6px rgba(25,24,23,.18)",
      },
      borderRadius: {
        tile: "6px",
        btn: "8px",
        card: "10px",
        bed: "12px",
        chip: "14px",
      },
      maxWidth: {
        shell: "var(--shell)",
      },
    },
  },
  plugins: [],
};

export default config;
