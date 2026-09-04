export const NATIVE_APP_SCHEME = "com.cuansync.app";
export const NATIVE_AUTH_CALLBACK_URL = `${NATIVE_APP_SCHEME}://auth/callback`;

const QUICK_ENTRY_TYPES = new Set(["expense", "income"]);
const MOVEMENT_TYPES = new Set(["transfer", "exchange"]);

function parseUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function hasSafeAuthority(url) {
  return !url.username && !url.password && !url.port;
}

function hasRootPath(url) {
  return url.pathname === "" || url.pathname === "/";
}

function getOnlyTypeParam(url) {
  const entries = [...url.searchParams.entries()];
  if (entries.length !== 1 || entries[0][0] !== "type") return null;
  return entries[0][1];
}

/*
 * Deep link hanya memilih layar dan mode awal. Nominal, catatan, maupun aksi
 * simpan sengaja tidak menjadi bagian kontrak supaya URL dari luar aplikasi
 * tidak pernah dapat membuat transaksi secara otomatis.
 */
export function parseNativeAppRoute(value) {
  const url = parseUrl(value);
  if (
    !url ||
    url.protocol !== `${NATIVE_APP_SCHEME}:` ||
    !hasSafeAuthority(url)
  ) {
    return null;
  }

  if (url.hostname === "auth" && url.pathname === "/callback") {
    return {
      kind: "auth-callback",
      url: value,
    };
  }

  if (!hasRootPath(url) || url.hash) return null;

  const requestedType = getOnlyTypeParam(url);
  if (url.hostname === "quick-entry" && QUICK_ENTRY_TYPES.has(requestedType)) {
    return {
      kind: "quick-entry",
      entryType: requestedType,
    };
  }

  if (url.hostname === "movement" && MOVEMENT_TYPES.has(requestedType)) {
    return {
      kind: "movement",
      movementType: requestedType,
    };
  }

  return null;
}

export function buildQuickEntryUrl(entryType = "expense") {
  if (!QUICK_ENTRY_TYPES.has(entryType)) {
    throw new TypeError("Jenis catat cepat harus expense atau income.");
  }
  return `${NATIVE_APP_SCHEME}://quick-entry?type=${entryType}`;
}

export function buildMovementUrl(movementType = "transfer") {
  if (!MOVEMENT_TYPES.has(movementType)) {
    throw new TypeError("Jenis pergerakan harus transfer atau exchange.");
  }
  return `${NATIVE_APP_SCHEME}://movement?type=${movementType}`;
}
