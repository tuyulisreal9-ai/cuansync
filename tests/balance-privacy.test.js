import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { HIDDEN_BALANCE_TEXT } from "../src/lib/currency.js";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

/* Membuang isi komentar tapi mempertahankan barisnya, supaya pemindaian di
   bawah tidak salah menganggap komentar yang menyebut money() sebagai
   pemanggilan sungguhan, sementara nomor barisnya tetap sejajar. */
function tanpaKomentar(kode) {
  return kode
    .replace(/\/\*[\s\S]*?\*\//g, (blok) => blok.replace(/[^\r\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\r\n]*/g, (baris, awal) => awal);
}

// Halaman yang ikut privasi. Riwayat dan form sengaja tidak masuk daftar ini.
const HALAMAN_PRIVAT = [
  "src/components/assets/WalletAccountsPage.js",
  "src/components/assets/WealthGoalsPage.js",
];

test("nominal di halaman Dompet tidak memanggil formatCurrency langsung", async () => {
  for (const path of HALAMAN_PRIVAT) {
    const page = await source(path);

    // formatCurrency melewati sakelar privasi, money() tidak. Impornya pun
    // harus hilang supaya tidak ada yang tanpa sadar memakainya lagi.
    assert.doesNotMatch(
      page,
      /formatCurrency/,
      `${path} masih memakai formatCurrency, nominalnya akan bocor saat privasi menyala`,
    );
    assert.match(page, /useMaskedCurrency/, `${path} belum memakai useMaskedCurrency`);
  }
});

test("setiap komponen yang menampilkan uang mengambil sendiri hook-nya", async () => {
  for (const path of HALAMAN_PRIVAT) {
    const page = await source(path);
    const baris = tanpaKomentar(page).split(/\r?\n/);

    // Kumpulkan fungsi tingkat atas beserta apakah ia memanggil money().
    const batas = [];
    baris.forEach((line, index) => {
      const cocok = line.match(/^(?:export )?function ([A-Za-z0-9_]+)/);
      if (cocok) batas.push({ nama: cocok[1], mulai: index });
    });

    batas.forEach((fn, i) => {
      const akhir = i + 1 < batas.length ? batas[i + 1].mulai : baris.length;
      const badan = baris.slice(fn.mulai, akhir);
      const pakaiMoney = badan.some((line) => /\bmoney\(/.test(line));
      const punyaHook = badan.some((line) => line.includes("useMaskedCurrency()"));
      if (pakaiMoney) {
        assert.ok(
          punyaHook,
          `${path}: ${fn.nama} memakai money() tanpa memanggil useMaskedCurrency()`,
        );
      }
    });
  }
});

test("baris aktivitas di Beranda ikut tertutup", async () => {
  const page = await source("src/components/home/HomeDashboardPage.js");

  // Nominal transaksi dan valuasinya sama sensitifnya dengan total saldo.
  assert.match(page, /useMaskedText/);
  assert.match(page, /\$\{maskText\(amount\.primary\)\}/);
  assert.match(page, /maskText\(amount\.secondary\) \|\| formatShortTime/);
});

test("privasi disiarkan dari App lewat provider", async () => {
  const main = await source("src/main.js");

  assert.match(main, /import \{ BalanceVisibilityProvider \}/);
  // Nilai dan sakelarnya sama sama disiarkan, supaya halaman mana pun bisa
  // membaca privasi sekaligus memasang tombol matanya sendiri.
  assert.match(main, /<\$\{BalanceVisibilityProvider\}[\s\S]{0,120}visible=\$\{balanceVisible\}/);
  assert.match(
    main,
    /<\$\{BalanceVisibilityProvider\}[\s\S]{0,160}onToggle=\$\{handleToggleBalanceVisibility\}/,
  );
});

test("teks penutup memakai konstanta yang sama di seluruh aplikasi", async () => {
  const lib = await source("src/lib/balanceVisibility.js");

  assert.match(lib, /HIDDEN_BALANCE_TEXT/);
  assert.equal(HIDDEN_BALANCE_TEXT, "\u2022".repeat(6));
});

test("form yang sedang diketik tetap menampilkan angkanya", async () => {
  // Menutup nominal di dalam form membuat pencatatan jadi buta, jadi
  // QuickEntrySheet dan TransactionForm sengaja tidak ikut privasi.
  for (const path of [
    "src/components/transactions/QuickEntrySheet.js",
    "src/components/transactions/TransactionForm.js",
  ]) {
    const form = await source(path);
    assert.doesNotMatch(form, /useMaskedCurrency|useMaskedText/, `${path} tidak boleh ikut privasi`);
  }
});

test("halaman Dompet punya tombol matanya sendiri", async () => {
  const page = await source("src/components/assets/WalletAccountsPage.js");

  // Tanpa tombol di halaman ini, saldo yang tertutup hanya bisa dibuka lagi
  // dengan berpindah ke Beranda.
  assert.match(page, /useToggleBalanceVisible/);
  assert.match(page, /aria-label=\$\{balanceVisible \? "Sembunyikan saldo" : "Tampilkan saldo"\}/);
  assert.match(page, /<\$\{balanceVisible \? Eye : EyeOff\}/);
});

test("simbol mata uang ikut tertutup, bukan hanya angkanya", async () => {
  const page = await source("src/components/assets/WalletAccountsPage.js");

  // Angka besar dipisah dari simbolnya di desain. Kalau hanya angkanya yang
  // ditutup, yang tersisa adalah "Rp ••••••" yang terbaca setengah terbuka.
  assert.match(page, /\$\{stripCurrencyPrefix\(money\(totalActualBase/);
  assert.match(
    page,
    /\$\{balanceVisible\s*\n?\s*\? html`<span/,
    "simbol mata uang harus ikut disembunyikan",
  );

  // Pembuang awalan tidak boleh menelan teks yang tidak punya angka sama
  // sekali, karena itulah bentuk nominal saat privasi menyala.
  const potong = page.match(/function stripCurrencyPrefix\(text\) \{([\s\S]*?)\n\}/);
  assert.ok(potong, "stripCurrencyPrefix tidak ditemukan");
  const jalankan = new Function("text", potong[1]);
  assert.equal(jalankan("Rp 8.928.571"), "8.928.571");
  assert.equal(jalankan("$496.50"), "496.50");
  assert.equal(jalankan(HIDDEN_BALANCE_TEXT), HIDDEN_BALANCE_TEXT);
});
