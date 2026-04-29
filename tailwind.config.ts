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
        // Existing brand palette (kept for backward compatibility)
        farm: {
          green: "#00774A",
          "green-dark": "#005a38",
          "green-light": "#e6f4ed",
          gold: "#F0B530",
          orange: "#F37441",
          cream: "#faf7f0",
          "cream-dark": "#f0ebe0",
          dark: "#1a1a1a",
          muted: "#6b6b6b",
        },
        // PressFarm OS design tokens
        pf: {
          cream: {
            50: "#fffdf8",
            100: "#fbf8f1",
            200: "#f7f1e7",
            300: "#efe6d6",
          },
          green: {
            900: "#0f1a14",
            800: "#162016",
            700: "#17351f",
            600: "#234d2e",
            500: "#365a3a",
            300: "#7f9275",
          },
          gold: {
            700: "#7a6a43",
            600: "#9b7c35",
            500: "#b99a46",
            300: "#d8c9a7",
            200: "#e2d7c4",
          },
          ink: {
            900: "#111411",
            700: "#2b302a",
            500: "#5b6258",
            300: "#9ca195",
          },
          // Crop signal colors — one per bundled flower
          crop: {
            squash: "#f4c75f",
            marigold: "#d97706",
            "gem-marigold": "#9a3412",
            nasturtium: "#ea580c",
            "bachelor-button": "#3b5bbb",
            pansy: "#7c3aed",
            "pea-flower": "#7c3aed",
            "chive-blossom": "#a855f7",
            mustard: "#dcae23",
            alyssum: "#f4efe3",
            viola: "#5b21b6",
            fava: "#f7f4ea",
            "hairy-vetch": "#8b5cf6",
            "leaf": "#556B2F",
            // Extended chef-garden
            borage: "#3b5bbb",
            calendula: "#ea580c",
            chamomile: "#fdf6c4",
            lavender: "#7c3aed",
            "anise-hyssop": "#7c3aed",
            chervil: "#f4efe3",
            dill: "#dcae23",
            fennel: "#dcae23",
            "garlic-chive": "#f7f4ea",
            rosemary: "#b8c5e0",
            thyme: "#c08a9a",
            "thai-basil": "#7c3aed",
            "nasturtium-leaf": "#556B2F",
            "squash-bud": "#f4c75f",
            buttercup: "#f4d03f",
            "california-poppy": "#ea580c",
            allium: "#5e2b7a",
          },
        },
      },
      fontFamily: {
        sans: ["var(--font-roboto)", "system-ui", "sans-serif"],
        display: ["var(--font-baskervville)", "Georgia", "serif"],
        // PressFarm OS design system fonts
        "pf-brand": ["Bank Gothic LT", "BankGothic Md BT", "Arial Narrow", "sans-serif"],
        "pf-sans": ["var(--font-inter)", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        "pf-serif": ["var(--font-cormorant)", "Cormorant Garamond", "Georgia", "serif"],
        "pf-mono": ["var(--font-jetbrains)", "JetBrains Mono", "Consolas", "monospace"],
      },
      borderRadius: {
        pf: "1.5rem",
      },
      boxShadow: {
        card: "0 1px 4px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.03)",
        "card-hover": "0 6px 16px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)",
        "card-active": "0 1px 2px rgba(0,0,0,0.06)",
        "nav": "0 -2px 8px rgba(0,0,0,0.06)",
        // PressFarm OS elevation
        "pf-soft": "0 10px 30px rgba(15, 26, 20, 0.06)",
        "pf-card": "0 16px 40px rgba(15, 26, 20, 0.08)",
        "pf-lifted": "0 24px 70px rgba(15, 26, 20, 0.12)",
      },
      letterSpacing: {
        "pf-brand": "0.18em",
        "pf-label": "0.24em",
        "pf-tagline": "0.32em",
      },
    },
  },
  plugins: [],
};

export default config;
