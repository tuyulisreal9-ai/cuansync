import forms from "@tailwindcss/forms";

export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["DM Sans", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["DM Sans", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["DM Mono", "ui-monospace", "SFMono-Regular", "monospace"],
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
        // ink dan mist dipakai di <body>; diarahkan ke palet baru agar seluruh
        // aplikasi berpindah tema sekaligus.
        ink: "var(--cs-ink)",
        mist: "var(--cs-bg)",
        // Warna semantik redesign. Memakai var() sehingga mode gelap ikut
        // otomatis; modifier opasitas Tailwind (bg-card/50) tidak berlaku.
        card: "var(--cs-card)",
        line: "var(--cs-line)",
        body: "var(--cs-body)",
        mut: "var(--cs-mut)",
        faint: "var(--cs-faint)",
        chip: "var(--cs-chip)",
        track: "var(--cs-track)",
        soft: "var(--cs-soft)",
        dim: "var(--cs-dim)",
        acc: "var(--cs-acc)",
        link: "var(--cs-link)",
        pos: "var(--cs-pos)",
        warn: "var(--cs-warn)",
      },
      borderRadius: {
        panel: "var(--cs-r-panel)",
        card: "var(--cs-r-card)",
        tile: "var(--cs-r-tile)",
      },
      boxShadow: {
        float: "0 18px 50px rgba(17, 24, 39, 0.12)",
      },
    },
  },
  plugins: [forms],
};
