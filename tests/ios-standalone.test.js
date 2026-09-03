import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const baca = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const mobile = baca("src/lib/mobile.js");
const styles = baca("src/styles.css");
const main = baca("src/main.js");
const pdf = baca("src/lib/monthlyStatementPdf.js");
const sheet = baca("src/components/settings/MonthlyStatementExportSheet.js");

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

test("ekspor PDF punya jalur berbagi untuk peramban", () => {
  // iOS Safari mengabaikan atribut download, jadi jalur unduhan tidak
  // menghasilkan berkas di iPhone.
  assert.match(pdf, /async function sharePdfViaWebShare/);
  assert.match(pdf, /navigator\.canShare\(\{ files: \[berkas\] \}\)/);
  assert.match(pdf, /method: "web-share"/);

  // Urutannya: native dulu, lalu Web Share, baru unduhan biasa.
  const iNative = pdf.indexOf('method: "share"');
  const iWeb = pdf.indexOf('method: "web-share"');
  const iUnduh = pdf.indexOf('method: "download"');
  assert.ok(iNative < iWeb && iWeb < iUnduh, "urutan jalur ekspor salah");
});

test("membatalkan lembar berbagi tidak diulang jadi unduhan", () => {
  // Menutup lembar berbagi adalah keputusan pengguna, bukan kegagalan.
  assert.match(pdf, /if \(error\?\.name === "AbortError"\) return true;/);
});

test("pesan hasil tidak mengaku mengunduh saat yang terbuka lembar berbagi", () => {
  assert.match(sheet, /result\.method === "share" \|\| result\.method === "web-share"/);
});
