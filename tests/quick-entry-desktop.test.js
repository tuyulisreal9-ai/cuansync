import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

const SHEET = "src/components/transactions/QuickEntrySheet.js";

test("papan ketik fisik bisa mengisi nominal", async () => {
  const sheet = await source(SHEET);

  // Sheet ini tidak punya kolom isian untuk nominal, jadi pendengarnya
  // dipasang di window.
  assert.match(sheet, /window\.addEventListener\("keydown", handleKeyDown\)/);
  assert.match(sheet, /window\.removeEventListener\("keydown", handleKeyDown\)/);

  // Angka, pemisah desimal, hapus, simpan, dan tutup.
  assert.match(sheet, /event\.key >= "0" && event\.key <= "9"/);
  assert.match(sheet, /event\.key === "\." \|\| event\.key === ","/);
  assert.match(sheet, /event\.key === "Backspace" \|\| event\.key === "Delete"/);
  assert.match(sheet, /event\.key === "Enter"/);
  assert.match(sheet, /event\.key === "Escape"/);
});

test("mengetik di kolom catatan tidak dibajak keypad", async () => {
  const sheet = await source(SHEET);

  // Tanpa penjagaan ini, mengetik "kopi 25" akan menambahkan 25 ke nominal.
  assert.match(sheet, /target\.tagName === "INPUT"/);
  assert.match(sheet, /target\.tagName === "TEXTAREA"/);
  assert.match(sheet, /target\.isContentEditable/);
  assert.match(sheet, /if \(mengetikDiKolom\) return;/);

  // Pintasan peramban harus tetap jalan.
  assert.match(sheet, /if \(event\.ctrlKey \|\| event\.metaKey \|\| event\.altKey\) return;/);
});

test("hook papan ketik berada di atas early return", async () => {
  const sheet = await source(SHEET);
  const baris = sheet.split(/\r?\n/);

  // Memanggil useEffect setelah "return null" membuat jumlah hook berubah
  // antar render, dan React melempar galat begitu sheet dibuka lagi.
  const earlyReturn = baris.findIndex((line) => line.includes("if (!open) return null;"));
  assert.ok(earlyReturn > 0, "early return tidak ditemukan");

  baris.forEach((line, index) => {
    if (/\buseEffect\(|\buseState\(|\buseSheetClose\(/.test(line)) {
      assert.ok(
        index < earlyReturn,
        `hook di baris ${index + 1} berada setelah early return`,
      );
    }
  });
});

test("desktop memakai dua kolom supaya muat di jendela pendek", async () => {
  const sheet = await source(SHEET);

  // Ditumpuk satu kolom, isinya 812px dan terpotong di jendela setengah layar.
  assert.match(sheet, /lg:grid\b/);
  // Kolom keypad dipatok, sisanya untuk kategori dan dompet yang butuh
  // ruang jauh lebih lebar supaya chip-nya cukup dua baris.
  assert.match(sheet, /lg:grid-cols-\[300px_minmax\(0,1fr\)\]/);
  assert.match(sheet, /lg:max-w-\[860px\]/);
  assert.match(sheet, /lg:max-h-\[calc\(100dvh-2rem\)\]/);

  // Nominal dan keypad di kolom kiri, sisanya satu sel di kolom kanan.
  assert.match(sheet, /lg:col-start-1/);
  assert.match(sheet, /lg:col-start-2 lg:row-span-2 lg:self-start/);
});

test("bentuk ponsel tidak ikut berubah", async () => {
  const sheet = await source(SHEET);

  // Semua penyesuaian desktop ada di balik lg, dan sheet bawah tetap utuh.
  assert.match(sheet, /absolute inset-x-0 bottom-0 flex max-h-\[92svh\] flex-col gap-4/);
  // Tombol keypad tetap 50px di ponsel, hanya mengecil di desktop.
  assert.match(sheet, /min-h-\[50px\][^"]*lg:min-h-\[44px\]/);

  // Wadah kolom kanan harus netral di ponsel: kolom biasa dengan jarak sama
  // seperti blok lainnya, supaya urutan dan spasinya tidak bergeser.
  assert.match(sheet, /className="flex flex-col gap-4 lg:col-start-2/);
});

test("chip kategori dan dompet membungkus ke bawah di desktop", async () => {
  const sheet = await source(SHEET);

  // Roda mouse hanya menggulir ke bawah. Deret yang digulir ke samping
  // menyembunyikan sebagian besar kategori dan menyulitkan pengguna desktop,
  // jadi di sana chip-nya membungkus dan memakai ruang kosong yang ada.
  const deret = sheet.match(/className="dc-scroll-x[^"]*"/g) || [];
  assert.equal(deret.length, 2, "harus ada dua deret chip: kategori dan dompet");
  deret.forEach((kelas) => {
    // Di ponsel tetap digulir ke samping, karena di layar sentuh itu wajar.
    assert.match(kelas, /overflow-x-auto/, kelas);
    assert.match(kelas, /lg:flex-wrap/, kelas);
    assert.match(kelas, /lg:overflow-x-visible/, kelas);
  });
});
