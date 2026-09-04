import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";

const nav = await readFile(
  new URL("../src/components/navigation/AppNavigation.js", import.meta.url),
  "utf8",
);

test("sidebar memakai logo aplikasi, bukan ikon umum", () => {
  assert.match(nav, /src="\/branding\/logo-mark-96\.png"/);

  const logo = new URL("../public/branding/logo-mark-96.png", import.meta.url);
  assert.ok(existsSync(logo), "berkas logo harus ada di public/branding");

  // logo-app.png aslinya 1254px dan 1,1MB. Memuat itu untuk lencana selebar
  // 38px membuang kuota tanpa menambah ketajaman sedikit pun.
  const ukuran = statSync(logo).size;
  assert.ok(
    ukuran < 60 * 1024,
    `logo sidebar harus di bawah 60KB, sekarang ${Math.round(ukuran / 1024)}KB`,
  );
});

test("logo tidak diberi latar yang ikut berubah tema", () => {
  // Berkasnya sudah membawa kotak membulat gelapnya sendiri. Menaruhnya di
  // atas var(--cs-acc) membuat kotak itu jadi terang di mode gelap, dan glow
  // sian di atas nyaris putih terbaca kotor.
  const blokMerek = nav.slice(
    nav.indexOf('<div className="flex items-center gap-3 px-2">'),
    nav.indexOf("CUANSYNC</span>"),
  );
  assert.ok(blokMerek.length > 0, "blok merek harus ditemukan");
  assert.doesNotMatch(blokMerek, /var\(--cs-acc\)/);
  assert.match(blokMerek, /rounded-\[12px\]/);
});

test("tipografi sidebar desktop cukup besar untuk jarak baca desktop", () => {
  assert.match(nav, /text-\[16\.5px\] font-bold tracking-\[0\.3px\]">CUANSYNC/);
  assert.match(nav, /flex-1 text-\[15px\] \$\{active \? "font-bold" : "font-medium"\}/);
  assert.match(nav, /min-h-\[48px\] items-center gap-3 rounded-\[14px\]/);
});

test("perubahan sidebar tidak menyentuh navigasi ponsel", () => {
  // Sidebar hanya muncul dari lg ke atas, jadi ponsel tidak pernah melihatnya.
  const sidebar = nav.slice(
    nav.indexOf("cs-desktop-sidebar"),
    nav.indexOf("export function MobileNavigation"),
  );
  assert.match(sidebar, /hidden h-screen w-\[264px\][^"]*lg:flex/);

  const mobile = nav.slice(nav.indexOf("export function MobileNavigation"));
  assert.doesNotMatch(mobile, /logo-mark-96/);
  assert.doesNotMatch(mobile, /text-\[16\.5px\]/);
});

test("tombol tema sidebar ikut menyimpan, bukan hanya mengubah tampilan", async () => {
  const main = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
  const penugasan = main.match(/onToggleTheme=\$\{[\s\S]*?\n\s*isDark=/);
  assert.ok(penugasan, "prop onToggleTheme sidebar tidak ditemukan");

  // setTheme hanya mengubah state layar. Tanpa handleThemeChange, profil dan
  // salinan server tetap memuat tema lama, lalu pemulihan sesi saat tab
  // difokuskan kembali membatalkan pilihan pengguna.
  assert.match(penugasan[0], /handleThemeChange\(/);
  assert.doesNotMatch(
    penugasan[0],
    /\bsetTheme\(/,
    "sidebar tidak boleh memanggil setTheme langsung",
  );
});
