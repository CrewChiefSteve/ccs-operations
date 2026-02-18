import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // CCS Operations palette — industrial/mission control
        surface: {
          0: "#0a0a0c",    // deepest background
          1: "#111114",    // sidebar, cards
          2: "#1a1a1f",    // elevated cards
          3: "#232329",    // hover states
          4: "#2e2e36",    // borders, dividers
        },
        accent: {
          DEFAULT: "#e85d26", // CCS racing orange
          muted: "#e85d2633",
          hover: "#f06a33",
        },
        text: {
          primary: "#e8e8ec",
          secondary: "#8b8b96",
          tertiary: "#5c5c66",
        },
        status: {
          success: "#34d399",
          warning: "#fbbf24",
          danger: "#f87171",
          info: "#60a5fa",
        },
      },
      fontFamily: {
        sans: ['"DM Sans"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', '"Fira Code"', "monospace"],
      },
      fontSize: {
        "2xs": ["0.65rem", { lineHeight: "0.9rem" }],
      },
    },
  },
  plugins: [],
};

export default config;
