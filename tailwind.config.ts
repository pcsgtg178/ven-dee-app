import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./types/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Background Palette (โทนสะอาด สบายตา อบอุ่น)
        "app-bg": "#F8FAF6",
        "card-bg": "#FFFFFF",
        "surface-subtle": "#EEF4EC",

        // Primary (เขียวสุขภาพ / งานบริการลูกค้า)
        primary: {
          light: "#DCFCE7",
          DEFAULT: "#16A34A",
          dark: "#14532D",
        },
        "primary-light": "#DCFCE7",
        "primary-dark": "#14532D",

        // Secondary (ฟ้าน้ำทะเล / ระบบเวรและการแพทย์)
        secondary: {
          light: "#E0F2FE",
          DEFAULT: "#0284C7",
          dark: "#0369A1",
        },
        "secondary-light": "#E0F2FE",
        "secondary-dark": "#0369A1",

        // Shift Category (เวรดำ / เวรแดง OT)
        "shift-black": "#1E293B",
        "shift-black-badge": "#F1F5F9",
        "shift-black-text": "#0F172A",
        "shift-red": "#EF4444",
        "shift-red-badge": "#FEE2E2",
        "shift-red-text": "#B91C1C",

        // Text Colors (อ่านง่าย คมชัด มินิมอล)
        "text-main": "#0F172A",
        "text-muted": "#64748B",
      },
    },
  },
  plugins: [],
};

export default config;
