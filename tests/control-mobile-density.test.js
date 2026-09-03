import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const halaman = await readFile(
  new URL("../src/components/control/ControlCenterPage.js", import.meta.url),
  "utf8",
);
const seksi = await readFile(
  new URL("../src/components/control/ControlSummarySections.js", import.meta.url),
  "utf8",
);
const pilar = await readFile(
  new URL("../src/components/control/ControlPillars.js", import.meta.url),
  "utf8",
);

test("tidak ada dua kartu yang mengatakan hal yang sama", () => {
  // ControlCoachCard menampilkan satu saran, dan saran itu hampir selalu sama
  // dengan urutan pertama di daftar saran. Berdampingan, keduanya berbunyi
  // seperti dua hal berbeda padahal satu, dan itu yang membuat halaman ini
  // terasa membingungkan di layar sempit.
  assert.doesNotMatch(halaman, /<\$\{ControlCoachCard\}/);
  assert.doesNotMatch(seksi, /export function ControlCoachCard/);

  // Bagian yang benar benar hanya dimiliki coach diserap ke kartu saran.
  assert.match(halaman, /getControlReadiness\(summary\)/);
  assert.match(halaman, /buildControlCoach\(summary\)\?\.why/);
});

test("alasan hanya dibawa saran teratas", () => {
  // Diulang di tiap baris, penjelasan berubah jadi kebisingan.
  assert.match(halaman, /why=\$\{index === 0 \? why : ""\}/);
});

test("prosa penjelas disembunyikan di ponsel, angkanya tidak", () => {
  // Empat paragraf "kenapa pilar ini ada" menambah 240px pada halaman yang di
  // ponsel sudah lebih panjang dari dua layar penuh.
  assert.match(pilar, /mt-3 hidden text-\[11px\] leading-5 lg:block/);
  assert.match(halaman, /hidden text-\[11\.5px\] leading-\[1\.5\] lg:block/);

  // Yang disembunyikan hanya prosanya. Metrik dan statusnya tetap tampil.
  assert.match(pilar, /\$\{presentation\.metric\}/);
  assert.doesNotMatch(pilar, /hidden[^"]*lg:block[^"]*"\s*>\s*\$\{presentation\.metric\}/);
});

test("halaman menyebutkan dirinya sendiri sebelum menampilkan angka", () => {
  // Pembuka halaman ini sering berbunyi "—" dan "Belum cukup data" beserta
  // istilah teknis, jadi tanpa satu kalimat pembuka pembaca sampai di angka
  // kosong lebih dulu dan bertanya sedang melihat apa.
  assert.match(halaman.replace(/\s+/g, " "), /Ringkasan keuanganmu bulan ini/);
  const posisiKalimat = halaman.indexOf("Ringkasan keuanganmu bulan ini");
  const posisiSkor = halaman.indexOf("<${ScorePanel}");
  assert.ok(
    posisiKalimat < posisiSkor,
    "kalimat pembuka harus berada sebelum panel skor",
  );
});

test("aksi saran memakai tautan teks, bukan tombol pil", () => {
  // Di lebar ponsel tombol pil memakan satu baris penuh untuk tiap saran.
  assert.match(halaman, /self-start pt-0\.5 text-\[12px\] font-bold/);
  assert.doesNotMatch(halaman, /shrink-0 self-start rounded-full px-3\.5 py-2/);
});

test("impor yang ikut mati tidak ditinggalkan", () => {
  for (const nama of ["Sparkles", "Lightbulb", "Check", "Circle", "getCoachTone"]) {
    assert.doesNotMatch(seksi, new RegExp(`\b${nama}\b`), `${nama} sudah tidak dipakai`);
  }
});
