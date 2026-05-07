/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          0: "#070707",
          1: "#0B0B0B",
          2: "#111111",
          3: "#161616",
          4: "#1C1C1C",
        },
        line: {
          subtle: "rgba(255,255,255,0.05)",
          DEFAULT: "rgba(255,255,255,0.09)",
          strong: "rgba(255,255,255,0.16)",
          stark: "rgba(255,255,255,0.28)",
        },
        ink: {
          0: "#FFFFFF",
          1: "rgba(255,255,255,0.94)",
          2: "rgba(255,255,255,0.66)",
          3: "rgba(255,255,255,0.46)",
          4: "rgba(255,255,255,0.30)",
          5: "rgba(255,255,255,0.16)",
        },
        accent: {
          DEFAULT: "#D4A017",      /* mustard */
          bright: "#E8B92E",
          deep: "#8C6A0F",
          ink: "#0B0B0B",
          soft: "rgba(212,160,23,0.08)",
          line: "rgba(212,160,23,0.30)",
        },
        warn: { DEFAULT: "#E89B3D", soft: "rgba(232,155,61,0.10)" },
        danger: { DEFAULT: "#E5484D", soft: "rgba(229,72,77,0.10)" },
        ok: { DEFAULT: "#5BC97E" },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui"],
        display: ["var(--font-grotesk)", "var(--font-inter)", "ui-sans-serif"],
        serif: ["var(--font-serif)", "ui-serif", "Georgia"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular"],
      },
      letterSpacing: {
        tightest: "-0.045em",
        tighter: "-0.025em",
      },
      borderRadius: {
        none: "0",
        sm: "2px",
        DEFAULT: "0",
        md: "0",
        lg: "0",
        xl: "0",
        "2xl": "0",
        "3xl": "0",
        full: "9999px",
      },
      animation: {
        "fade-in": "fadeIn 220ms ease-out both",
        "fade-in-up": "fadeInUp 320ms cubic-bezier(0.2,0.7,0.2,1) both",
        "shimmer": "shimmer 1.6s linear infinite",
        "pulse-soft": "pulseSoft 2.4s ease-in-out infinite",
        "scale-in": "scaleIn 180ms cubic-bezier(0.2,0.7,0.2,1) both",
        "marquee": "marquee 32s linear infinite",
        "blink": "blink 1.05s step-end infinite",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: 0 }, "100%": { opacity: 1 } },
        fadeInUp: {
          "0%": { opacity: 0, transform: "translateY(8px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
        pulseSoft: {
          "0%,100%": { opacity: 0.55 },
          "50%": { opacity: 1 },
        },
        scaleIn: {
          "0%": { opacity: 0, transform: "scale(0.97)" },
          "100%": { opacity: 1, transform: "scale(1)" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        blink: {
          "0%, 50%": { opacity: 1 },
          "50.01%, 100%": { opacity: 0 },
        },
      },
    },
  },
  plugins: [],
};
