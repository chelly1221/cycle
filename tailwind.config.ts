import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        strava: "#ff6b8a",
        "road-gray": "#1a1a1a",
        "summit-white": "#f5f5f0",
      },
      fontFamily: {
        mono: ["var(--font-mono)", "monospace"],
        sans: ["var(--font-sans)", "sans-serif"],
        "ride-title": [
          "var(--font-noto-kr)",
          "var(--font-noto-sc)",
          "var(--font-noto-tc)",
          "var(--font-sans)",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
export default config;
