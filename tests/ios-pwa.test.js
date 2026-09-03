import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const manifest = JSON.parse(
  readFileSync(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
);
const sw = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");

const ikon = (nama) => new URL(`../public/icons/${nama}`, import.meta.url);

test("apple-touch-icon memakai PNG, bukan WebP", () => {
  // iOS tidak membaca WebP untuk keperluan ini. Dengan WebP, ikon di Layar
  // Utama iPhone jatuh ke cuplikan halaman alih-alih logo aplikasi.
  const tautan = [...html.matchAll(/<link rel="apple-touch-icon"[^>]*>/g)].map(
    (m) => m[0],
  );
  assert.ok(tautan.length >= 4, "harus ada beberapa ukuran apple-touch-icon");
  tautan.forEach((baris) => {
    assert.match(baris, /\.png"/, baris);
    assert.doesNotMatch(baris, /\.webp/, baris);
    assert.match(baris, /sizes="\d+x\d+"/, baris);
  });
});

test("berkas ikon iOS benar benar ada dan berformat PNG", () => {
  for (const ukuran of [120, 152, 167, 180]) {
    const berkas = ikon(`apple-touch-icon-${ukuran}.png`);
    assert.ok(existsSync(berkas), `apple-touch-icon-${ukuran}.png harus ada`);

    // Delapan bita pertama PNG selalu sama; ini menangkap berkas yang cuma
    // berganti ekstensi tanpa benar benar dikonversi.
    const kepala = readFileSync(berkas).subarray(0, 8);
    assert.deepEqual(
      [...kepala],
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      `apple-touch-icon-${ukuran}.png bukan PNG sungguhan`,
    );
    assert.ok(statSync(berkas).size > 1024, "ikon tidak boleh kosong");
  }
});

test("manifest memakai warna aplikasi yang sekarang", () => {
  // #020617 adalah slate lama. Warna native sudah dipindah ke #080d0c, dan
  // manifest yang tertinggal membuat layar pembuka PWA berkedip beda warna.
  assert.equal(manifest.theme_color, "#080d0c");
  assert.equal(manifest.background_color, "#080d0c");
});

test("manifest menyediakan ikon PNG di samping WebP", () => {
  const png = manifest.icons.filter((item) => item.type === "image/png");
  assert.ok(png.length >= 2, "harus ada ikon PNG");
  assert.ok(
    png.some((item) => item.sizes === "512x512" && item.purpose === "maskable"),
    "butuh 512 maskable",
  );
  png.forEach((item) => {
    const nama = item.src.replace("/icons/", "");
    assert.ok(existsSync(ikon(nama)), `${item.src} harus ada`);
  });
});

test("meta khusus iOS tetap lengkap", () => {
  assert.match(html, /name="apple-mobile-web-app-capable" content="yes"/);
  assert.match(html, /name="apple-mobile-web-app-title" content="CUANSYNC"/);
  assert.match(html, /name="apple-mobile-web-app-status-bar-style"/);
  // viewport-fit=cover diperlukan supaya safe area iPhone terbaca.
  assert.match(html, /viewport-fit=cover/);
});

test("nama cache naik ketika isi app shell berubah", () => {
  // Manifest ikut di-precache. Tanpa penggantian nama, pemasangan lama terus
  // menyajikan manifest versi sebelumnya dan perbaikan ini tidak pernah
  // sampai ke pengguna yang sudah memasang.
  assert.match(sw, /const CACHE_NAME = "cuansync-shell-v3"/);
  assert.match(sw, /apple-touch-icon-180\.png/);
  assert.match(sw, /\.filter\(\(key\) => key !== CACHE_NAME\)/);
});
