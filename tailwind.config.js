import forms from "@tailwindcss/forms";

export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#f3faf7",
          100: "#dbf2e8",
          500: "#2aa876",
          600: "#1f8a61",
          700: "#18674a",
          900: "#11352a",
        },
        midnight: "#0e1726",
        ink: "#111827",
        mist: "#f7faf9",
      },
      boxShadow: {
        float: "0 18px 50px rgba(17, 24, 39, 0.12)",
      },
    },
  },
  plugins: [forms],
};
