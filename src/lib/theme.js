export const THEME_MODE_OPTIONS = [
  { key: "system", label: "Sistem" },
  { key: "light", label: "Terang" },
  { key: "dark", label: "Gelap" },
];

export function normalizeThemeMode(value) {
  return ["system", "light", "dark"].includes(value) ? value : "system";
}

export function resolveThemeMode(themeMode, systemPrefersDark = false) {
  const normalized = normalizeThemeMode(themeMode);
  if (normalized === "system") return systemPrefersDark ? "dark" : "light";
  return normalized;
}
