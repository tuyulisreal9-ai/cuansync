import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const baca = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

/* Halaman yang memakai grid dua kolom di desktop. Pembungkus kolomnya menjadi
   grid item, dan grid item memakai min-width: auto secara bawaan sehingga
   kolomnya tidak dapat menyusut di bawah min-content isinya.

   Di layar sempit, satu nominal panjang seperti "Rp 1.871.642 / Rp 3.200.000"
   sudah cukup mendorong kolom melewati lebar layar. Karena app-shell memakai
   overflow-x: clip, kelebihannya terpotong diam diam: pengguna melihat angka
   terpenggal tanpa bisa menggulir untuk melihat sisanya. */
const HALAMAN = [
  "src/components/budget/BudgetWorkspacePage.js",
  "src/components/control/ControlCenterPage.js",
  "src/components/home/HomeDashboardPage.js",
];

test("pembungkus kolom grid selalu boleh menyusut", () => {
  for (const path of HALAMAN) {
    const sumber = baca(path);

    /* Cari pembungkus kolom: div atau aside yang hanya berisi kelas tata
       letak kolom. Tiap satu wajib membawa min-w-0. */
    const pembungkus =
      sumber.match(/className="[^"]*flex[^"]*flex-col[^"]*gap-\d[^"]*lg:gap-6"/g) || [];
    assert.ok(
      pembungkus.length > 0,
      `${path}: pembungkus kolom tidak ditemukan, tes ini perlu diperbarui`,
    );

    pembungkus.forEach((kelas) => {
      assert.match(
        kelas,
        /min-w-0/,
        `${path}: pembungkus kolom tanpa min-w-0 akan memotong isinya di layar sempit -> ${kelas}`,
      );
    });
  }
});

test("kolom kanan beranda juga boleh menyusut", () => {
  const home = baca("src/components/home/HomeDashboardPage.js");
  const aside = home.match(/<aside className="[^"]*"/)?.[0];
  assert.ok(aside, "aside kolom kanan harus ada");
  assert.match(aside, /min-w-0/, aside);
});

test("app-shell memotong luapan, jadi luapan tidak boleh dibiarkan", () => {
  // overflow-x: clip dipilih karena hidden mematikan gestur sentuh, dan itu
  // sudah terdokumentasi. Konsekuensinya, luapan horizontal tidak pernah bisa
  // digulir dan langsung hilang dari layar, jadi tidak ada jaring pengaman.
  const main = baca("src/main.js");
  assert.match(main, /app-shell[^\n]*overflow-x-clip/);
  assert.doesNotMatch(main, /app-shell[^\n]*overflow-x-auto/);
});
