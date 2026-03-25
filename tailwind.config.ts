import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cursor: {
          purple: "#7c3aed",
          "purple-dark": "#5b21b6",
          "purple-light": "#a78bfa",
          bg: "#14120b",
          "bg-dark": "#0f0d06",
          surface: "#1c1a12",
          "surface-raised": "#262318",
          text: "#edecec",
          "text-secondary": "rgba(237, 236, 236, 0.75)",
          "text-muted": "rgba(237, 236, 236, 0.55)",
          "text-faint": "rgba(237, 236, 236, 0.35)",
          border: "rgba(237, 236, 236, 0.08)",
          "border-emphasis": "rgba(237, 236, 236, 0.15)",
          overlay: "rgba(237, 236, 236, 0.05)",
          "accent-blue": "#a8b4c8",
          "accent-green": "#a8c4a0",
          "accent-red": "#c4a0a0",
          "accent-purple": "#b8a8c8",
          "accent-yellow": "#c8bfa0",
          "accent-orange": "#c8b4a0",
          "accent-blue-bg": "rgba(26, 29, 46, 0.3)",
          "accent-green-bg": "rgba(26, 36, 24, 0.3)",
          "accent-red-bg": "rgba(42, 26, 24, 0.3)",
          "accent-purple-bg": "rgba(34, 26, 46, 0.3)",
          "accent-yellow-bg": "rgba(42, 36, 24, 0.3)",
          "accent-orange-bg": "rgba(42, 32, 24, 0.3)",
        },
      },
      boxShadow: {
        "glow": "0 0 20px rgba(255, 255, 255, 0.1)",
        "glow-lg": "0 0 30px rgba(255, 255, 255, 0.15)",
        "inner-glow": "inset 0 1px 0 rgba(255, 255, 255, 0.1)",
        "glass": "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out forwards",
        "slide-up": "slideUp 0.25s ease-out forwards",
        "slide-down": "slideDown 0.25s ease-out forwards",
        "slide-right": "slideRight 0.25s ease-out forwards",
        "scale-in": "scaleIn 0.2s ease-out forwards",
        "reveal": "reveal 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards",
        "float": "float 6s ease-in-out infinite",
        "shimmer": "shimmer 2s linear infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideDown: {
          "0%": { opacity: "0", transform: "translateY(-20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideRight: {
          "0%": { opacity: "0", transform: "translateX(-20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        reveal: {
          "0%": { opacity: "0", transform: "translateY(40px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
