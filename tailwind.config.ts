import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#172026",
        muted: "#62707c",
        line: "#d7dde3",
        panel: "#f7f9fb",
        cobalt: "#2457a6",
        teal: "#0f766e",
        amber: "#b7791f",
        danger: "#b42318"
      },
      boxShadow: {
        soft: "0 8px 24px rgba(16, 24, 40, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
