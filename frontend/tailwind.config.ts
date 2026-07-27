import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#121212",
        paper: "#fbfaf6",
        coral: "#f97316",
        sage: "#0f766e",
        fog: "#f1f0ea",
        "fog-2": "#f5f4f0",
        midnight: "#10172a",
        lavender: "#bca7ff",
        butter: "#ffd95a",
        berry: "#7c3aed"
      },
      fontFamily: {
        sans: ["Inter Tight", "Inter", "Arial", "sans-serif"],
        display: ["Space Grotesk", "Inter Tight", "Arial", "sans-serif"]
      },
      spacing: {
        "13": "3.25rem",
        "18": "4.5rem",
        "38": "9.5rem"
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem"
      },
      boxShadow: {
        lift: "0 22px 50px rgba(18, 18, 18, 0.14)",
        card: "0 2px 0 rgba(18, 18, 18, 0.07), 0 20px 46px rgba(18, 18, 18, 0.11)",
        deep: "0 4px 0 rgba(18, 18, 18, 0.08), 0 28px 60px rgba(18, 18, 18, 0.15)",
        "float": "0 4px 0 rgba(18, 18, 18, 0.07), 0 24px 52px rgba(18, 18, 18, 0.13)",
        glow: "0 14px 32px rgba(255, 217, 90, 0.35)",
        "glow-lavender": "0 14px 32px rgba(188, 167, 255, 0.35)",
        inner: "inset 0 2px 6px rgba(18, 18, 18, 0.07)"
      },
      animation: {
        "fade-up": "fadeUp .5s cubic-bezier(.2,.8,.2,1) both",
        shimmer: "shimmer 1.8s linear infinite",
        float: "float 6s ease-in-out infinite",
        bob: "bob 3.5s ease-in-out infinite",
        "mascot-bob": "mascot-bob 4s ease-in-out infinite",
        "float-card": "float-card 5s ease-in-out infinite",
        spin: "spin 1s linear infinite"
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" }
        },
        float: {
          "0%, 100%": { transform: "translate3d(0,0,0) rotate(-2deg)" },
          "50%": { transform: "translate3d(0,-12px,0) rotate(2deg)" }
        },
        bob: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-5px)" }
        },
        "mascot-bob": {
          "0%, 100%": { transform: "translateY(0) rotate(-1deg)" },
          "50%": { transform: "translateY(-8px) rotate(1deg)" }
        },
        "float-card": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" }
        },
        spin: {
          to: { transform: "rotate(360deg)" }
        }
      }
    }
  },
  plugins: []
};

export default config;
