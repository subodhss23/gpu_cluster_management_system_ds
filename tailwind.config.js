/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "rgb(var(--ink-950) / <alpha-value>)",
          900: "rgb(var(--ink-900) / <alpha-value>)",
          850: "rgb(var(--ink-850) / <alpha-value>)",
          800: "rgb(var(--ink-800) / <alpha-value>)",
          750: "rgb(var(--ink-750) / <alpha-value>)",
          700: "rgb(var(--ink-700) / <alpha-value>)",
          600: "rgb(var(--ink-600) / <alpha-value>)",
          500: "rgb(var(--ink-500) / <alpha-value>)",
          400: "rgb(var(--ink-400) / <alpha-value>)",
          300: "rgb(var(--ink-300) / <alpha-value>)",
          200: "rgb(var(--ink-200) / <alpha-value>)",
          100: "rgb(var(--ink-100) / <alpha-value>)",
        },
        nv: {
          50: "rgb(var(--nv-50) / <alpha-value>)",
          100: "rgb(var(--nv-100) / <alpha-value>)",
          200: "rgb(var(--nv-200) / <alpha-value>)",
          300: "rgb(var(--nv-300) / <alpha-value>)",
          400: "rgb(var(--nv-400) / <alpha-value>)",
          500: "rgb(var(--nv-500) / <alpha-value>)",
          600: "rgb(var(--nv-600) / <alpha-value>)",
          700: "rgb(var(--nv-700) / <alpha-value>)",
          800: "rgb(var(--nv-800) / <alpha-value>)",
          900: "rgb(var(--nv-900) / <alpha-value>)",
        },
        vol: {
          teal: "rgb(var(--vol-teal) / <alpha-value>)",
          blue: "rgb(var(--vol-blue) / <alpha-value>)",
          indigo: "rgb(var(--vol-indigo) / <alpha-value>)",
          violet: "rgb(var(--vol-violet) / <alpha-value>)",
          amber: "rgb(var(--vol-amber) / <alpha-value>)",
          orange: "rgb(var(--vol-orange) / <alpha-value>)",
          rose: "rgb(var(--vol-rose) / <alpha-value>)",
          red: "rgb(var(--vol-red) / <alpha-value>)",
          emerald: "rgb(var(--vol-emerald) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Inter",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "SF Mono",
          "JetBrains Mono",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(118,185,0,0.28), 0 0 32px -8px rgba(118,185,0,0.45)",
        panel: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 12px 30px -18px rgba(0,0,0,0.9)",
      },
      backgroundImage: {
        "grid-fade":
          "radial-gradient(900px 500px at 12% -10%, rgba(118,185,0,0.10), transparent 60%), radial-gradient(800px 500px at 100% 0%, rgba(34,211,238,0.08), transparent 55%)",
      },
      keyframes: {
        pulseRing: {
          "0%": { transform: "scale(0.9)", opacity: "0.7" },
          "70%": { transform: "scale(1.6)", opacity: "0" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
        sweep: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        floaty: {
          "0%,100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-4px)" },
        },
      },
      animation: {
        pulseRing: "pulseRing 2.2s cubic-bezier(0.4,0,0.6,1) infinite",
        sweep: "sweep 2.6s linear infinite",
        floaty: "floaty 5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
