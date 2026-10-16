import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const baca = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const mobile = baca("src/lib/mobile.js");
const styles = baca("src/styles.css");
const main = baca("src/main.js");
const pdf = baca("src/lib/monthlyStatementPdf.js");
const sheet = baca("src/components/settings/MonthlyStatementExportSheet.js");
const savePdf = baca("src/lib/savePdfFile.js");

test("mode terpasang ke Layar Utama dikenali terpisah dari aplikasi native", () => {
  // Capacitor.isNativePlatform() bernilai false di PWA, jadi is-native-app
  // tidak pernah terpasang di sana dan aturan area amannya tidak berlaku.
  assert.match(mobile, /export function isStandaloneWebApp/);
  assert.match(mobile, /navigator\?\.standalone === true/);
  assert.match(mobile, /matchMedia\("\(display-mode: standalone\)"\)/);
  assert.match(mobile, /classList\.add\("is-standalone"\)/);

  // Aplikasi native tetap memakai jalurnya sendiri.
  assert.match(mobile, /!isNativeMobileApp\(\)\s*&&\s*isStandaloneWebApp\(\)/);
});

test("area aman atas berlaku juga saat dipasang dari Safari", () => {
  // Tanpa ini, apple-mobile-web-app-status-bar-style black-translucent membuat
  // bagian atas konten masuk ke belakang poni iPhone.
  assert.match(styles, /html\.is-standalone \.app-shell/);
  const blok = styles.slice(styles.indexOf("html.is-standalone .app-shell"));
  assert.match(blok.slice(0, 200), /padding-top: calc\(0\.5rem \+ env\(safe-area-inset-top\)\)/);

  // Dibatasi di bawah lg: dari lg ke atas app-shell memang tanpa padding.
  const sebelum = styles.slice(0, styles.indexOf("html.is-standalone .app-shell"));
  assert.match(sebelum.slice(-220), /@media \(max-width: 1023\.98px\)/);
});

test("theme-color mengikuti sakelar tema aplikasi, bukan hanya sistem", () => {
  // Tag di index.html hanya bereaksi pada prefers-color-scheme. Kalau sistem
  // gelap tetapi pengguna memilih terang, area status bar PWA tidak cocok.
  assert.match(mobile, /export function syncThemeColorMeta/);
  assert.match(mobile, /querySelectorAll\('meta\[name="theme-color"\]'\)/);
  assert.match(main, /syncThemeColorMeta\(resolvedTheme === "dark"\)/);

  // Warnanya sama dengan yang dipakai status bar native.
  const warnaNative = mobile.match(/color: darkTheme \? "([^"]+)" : "([^"]+)"/);
  const warnaMeta = mobile.match(/const warna = darkTheme \? "([^"]+)" : "([^"]+)"/);
  assert.ok(warnaNative && warnaMeta, "kedua pasangan warna harus ada");
  assert.equal(warnaMeta[1], warnaNative[1]);
  assert.equal(warnaMeta[2], warnaNative[2]);
});

test("ekspor PDF di peramban memprioritaskan unduhan tanpa membuka berbagi", () => {
  assert.match(pdf, /return savePdfFile\(doc, filename\)/);
  assert.match(savePdf, /platform === "web"/);
  assert.match(savePdf, /link.download = filename/);
  assert.doesNotMatch(pdf + savePdf, /navigator\.share|navigator\.canShare|web-share/);
});

test("PDF iOS native disimpan di Documents yang bisa dibuka dari Files", () => {
  assert.match(savePdf, /platform === "ios"/);
  assert.match(savePdf, /directory: Directory.Documents/);
  const plist = baca("ios/App/App/Info.plist");
  assert.match(plist, /<key>UIFileSharingEnabled<\/key>\s*<true\/>/);
  assert.match(plist, /<key>LSSupportsOpeningDocumentsInPlace<\/key>\s*<true\/>/);
});

test("hasil unduhan hanya mengaku dimulai dan memberi petunjuk pratinjau browser", () => {
  assert.match(sheet, /getPdfSaveMessage\(result\)/);
  assert.match(savePdf, /Unduhan PDF dimulai/);
  assert.match(savePdf, /Jika muncul pratinjau/);
});
