import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Preferences } from "@capacitor/preferences";
import { StatusBar, Style } from "@capacitor/status-bar";

export const NATIVE_AUTH_REDIRECT_URL =
  "com.cuansync.app://auth/callback";

export function isNativeMobileApp() {
  return Capacitor.isNativePlatform();
}

if (isNativeMobileApp() && typeof document !== "undefined") {
  document.documentElement.classList.add("is-native-app");
}

/* PWA yang dipasang ke Layar Utama berjalan tanpa bilah peramban.
   Capacitor.isNativePlatform() bernilai false di sana, jadi is-native-app
   tidak terpasang dan padding area aman yang selama ini hanya ditulis untuk
   aplikasi native tidak pernah berlaku. Di iPhone berponi, dengan
   apple-mobile-web-app-status-bar-style black-translucent, akibatnya konten
   masuk ke belakang poni. */
export function isStandaloneWebApp() {
  if (typeof window === "undefined") return false;
  /* navigator.standalone khusus Safari iOS dan sudah ada jauh sebelum media
     query display-mode didukung di sana, jadi diperiksa lebih dulu. */
  if (window.navigator?.standalone === true) return true;
  try {
    return window.matchMedia("(display-mode: standalone)").matches;
  } catch {
    return false;
  }
}

if (
  typeof document !== "undefined" &&
  !isNativeMobileApp() &&
  isStandaloneWebApp()
) {
  document.documentElement.classList.add("is-standalone");
}

/* Aplikasi punya sakelar tema sendiri, sedangkan tag theme-color di index.html
   hanya mengikuti prefers-color-scheme milik sistem. Kalau sistem gelap tetapi
   pengguna memilih terang, area status bar PWA tetap gelap sementara halaman
   sudah krem. Kedua tag ditulis dengan warna yang sama supaya mana pun yang
   dipakai peramban hasilnya benar. */
export function syncThemeColorMeta(darkTheme) {
  if (typeof document === "undefined") return;
  const warna = darkTheme ? "#080d0c" : "#faf7f1";
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((meta) => meta.setAttribute("content", warna));
}

export const nativeAuthStorage = isNativeMobileApp()
  ? {
      async getItem(key) {
        const { value } = await Preferences.get({ key });
        return value;
      },
      async setItem(key, value) {
        await Preferences.set({ key, value });
      },
      async removeItem(key) {
        await Preferences.remove({ key });
      },
    }
  : undefined;

function getCallbackParams(url) {
  const parsed = new URL(url);
  const params = new URLSearchParams(parsed.search);
  const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ""));
  for (const [key, value] of hashParams.entries()) {
    if (!params.has(key)) params.set(key, value);
  }
  return params;
}

export function getAuthSessionFromCallback(url) {
  const params = getCallbackParams(url);
  const errorDescription =
    params.get("error_description") || params.get("error");
  if (errorDescription) {
    throw new Error(decodeURIComponent(errorDescription.replaceAll("+", " ")));
  }

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) return null;
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
  };
}

export function getAuthCallbackFromUrl(url) {
  const params = getCallbackParams(url);
  const errorDescription =
    params.get("error_description") || params.get("error");
  if (errorDescription) {
    throw new Error(decodeURIComponent(errorDescription.replaceAll("+", " ")));
  }

  const code = params.get("code");
  if (code) return { type: "pkce", code };

  const session = getAuthSessionFromCallback(url);
  return session ? { type: "tokens", session } : null;
}

export async function openNativeAuthBrowser(url) {
  await Browser.open({
    url,
    presentationStyle: "popover",
  });
}

export async function closeNativeAuthBrowser() {
  try {
    await Browser.close();
  } catch {
    // Browser may already be closed by the operating system.
  }
}

export async function addNativeUrlListener(listener) {
  if (!isNativeMobileApp()) return null;
  return App.addListener("appUrlOpen", ({ url }) => listener(url));
}

export async function getNativeLaunchUrl() {
  if (!isNativeMobileApp()) return null;
  const launch = await App.getLaunchUrl();
  return launch?.url || null;
}

export async function getNativeAppState() {
  if (!isNativeMobileApp()) return { isActive: true };
  return App.getState();
}

export async function addNativeAppStateListener(listener) {
  if (!isNativeMobileApp()) return null;
  return App.addListener("appStateChange", listener);
}

export async function addNativeBackButtonListener(listener) {
  if (!isNativeMobileApp()) return null;
  return App.addListener("backButton", listener);
}

export async function minimizeNativeApp() {
  if (!isNativeMobileApp()) return;
  await App.minimizeApp();
}

export async function updateNativeStatusBar(darkTheme) {
  if (!isNativeMobileApp()) return;
  await StatusBar.setOverlaysWebView({ overlay: false });
  // Warna diambil dari token desain --cs-bg, bukan palet slate warisan,
  // supaya status bar menyatu dengan latar halaman di kedua mode.
  await StatusBar.setBackgroundColor({
    color: darkTheme ? "#080d0c" : "#faf7f1",
  });
  await StatusBar.setStyle({
    style: darkTheme ? Style.Dark : Style.Light,
  });
}
