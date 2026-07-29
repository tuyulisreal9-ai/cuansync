export function readStorage(key, fallback, legacyKey = null) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
    if (!legacyKey) return fallback;

    const legacyRaw = window.localStorage.getItem(legacyKey);
    if (!legacyRaw) return fallback;

    const parsedLegacy = JSON.parse(legacyRaw);
    window.localStorage.setItem(key, JSON.stringify(parsedLegacy));
    return parsedLegacy;
  } catch {
    return fallback;
  }
}

export function writeStorage(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}
