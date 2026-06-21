import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["Cormorant Garamond", "Iowan Old Style", "Georgia", "serif"],
      },
      colors: {
        ink: "#251f19",
        dusk: "#13110f",
        cream: "#f6efe3",
        sage: "#7f8d75",
        rose: "#b77b72",
      },
      boxShadow: {
        soft: "0 24px 80px rgba(37, 31, 25, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
