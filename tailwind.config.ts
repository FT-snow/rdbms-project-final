import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F7F6F3",
        surface: "#FFFFFF",
        ink: "#111111",
        mute: "#787774",
        line: "#EAEAEA",
        bone: "#FBFBFA",
        card: "#FFFFFF",
        "card-foreground": "#111111",
        foreground: "#111111",
        border: "#EAEAEA",
        ring: "#111111",
        "muted-foreground": "#787774",
        redsoft: "#FDEBEC",
        redtext: "#9F2F2D",
        bluesoft: "#E1F3FE",
        bluetext: "#1F6C9F",
        greensoft: "#EDF3EC",
        greentext: "#346538",
        yellowsoft: "#FBF3DB",
        yellowtext: "#956400",
      },
      fontFamily: {
        sans: ["Geist Sans", "Helvetica Neue", "system-ui", "sans-serif"],
        serif: ["var(--font-newsreader)", "Newsreader", "Georgia", "serif"],
        mono: ["JetBrains Mono", "SF Mono", "Menlo", "monospace"],
      },
      borderRadius: { card: "12px" },
    },
  },
  plugins: [],
};
export default config;
