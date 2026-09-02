import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildBudgetPaceSentence,
  getBudgetPaceTone,
} from "../src/domain/budgetPace.js";
import { formatCurrency } from "../src/lib/currency.js";

/* Intl menyisipkan spasi tak-putus setelah "Rp", jadi ekspektasi dirakit
   lewat formatCurrency ketimbang mengunci karakter pemisahnya. */
const rp = (nilai) => formatCurrency(nilai, "IDR");

const kalimat = (pace) => buildBudgetPaceSentence(pace, "IDR");

test("kategori yang lewat batas menyebutkan selisihnya", () => {
  const hasil = kalimat({
    statusLabel: "Melewati batas",
    paceStatus: "over",
    limitAmount: 1500000,
    spentAmount: 1700000,
  });
  assert.equal(hasil.label, "Melewati batas");
  assert.equal(hasil.detail, `lewat ${rp(200000)}`);
});

test("perkiraan lewat batas memakai angka proyeksi, bukan yang sudah terpakai", () => {
  const hasil = kalimat({
    statusLabel: "Diperkirakan melewati batas",
    paceStatus: "projected_over",
    limitAmount: 750000,
    spentAmount: 400000,
    projectedSpending: 980000,
  });
  assert.equal(hasil.detail, `perkiraan ${rp(980000)} sampai tutup bulan`);
});

test("pemakaian terlalu cepat menyebutkan berapa hari lebih awal habisnya", () => {
  const hasil = kalimat({
    statusLabel: "Pemakaian terlalu cepat",
    paceStatus: "too_fast",
    limitAmount: 750000,
    spentAmount: 620000,
    daysEarly: 6,
  });
  assert.equal(hasil.detail, "habis 6 hari lebih awal");
});

test("nol hari lebih awal tidak ditampilkan sebagai angka nol", () => {
  // daysEarly 0 berarti jatahnya justru pas sampai akhir bulan. "habis 0 hari
  // lebih awal" tidak memberi tahu apa apa, jadi jatuh ke sisa saldonya.
  const hasil = kalimat({
    statusLabel: "Pemakaian terlalu cepat",
    paceStatus: "too_fast",
    limitAmount: 750000,
    spentAmount: 620000,
    daysEarly: 0,
  });
  assert.equal(hasil.detail, `sisa ${rp(130000)}`);
});

test("ritme tidak diklaim aman ketika datanya belum cukup", () => {
  // getBudgetPace menetapkan on_track sebagai keadaan bawaan, termasuk saat
  // baru dua hari berjalan. Menjanjikan "sisa sekian" dari data sependek itu
  // adalah klaim yang tidak bisa dipertanggungjawabkan.
  const kurang = kalimat({
    statusLabel: "Sesuai ritme",
    paceStatus: "on_track",
    limitAmount: 2000000,
    spentAmount: 54000,
    enoughPaceData: false,
  });
  assert.equal(kurang.detail, "belum cukup data untuk menilai ritme");

  const cukup = kalimat({
    statusLabel: "Sesuai ritme",
    paceStatus: "on_track",
    limitAmount: 2000000,
    spentAmount: 54000,
    enoughPaceData: true,
  });
  assert.equal(cukup.detail, `sisa ${rp(1946000)}`);
});

test("kategori tanpa transaksi tidak diberi akibat apa apa", () => {
  const hasil = kalimat({
    statusLabel: "Belum ada transaksi",
    paceStatus: "no_transactions",
    limitAmount: 750000,
    spentAmount: 0,
  });
  assert.equal(hasil.detail, "");
});

test("pace yang tidak ada menghasilkan null, bukan kalimat kosong", () => {
  assert.equal(buildBudgetPaceSentence(null, "IDR"), null);
  assert.equal(buildBudgetPaceSentence(undefined, "IDR"), null);
});

test("nada mengikuti tingkat keseriusannya", () => {
  assert.equal(getBudgetPaceTone("over"), "danger");
  assert.equal(getBudgetPaceTone("projected_over"), "danger");
  assert.equal(getBudgetPaceTone("too_fast"), "warn");
  assert.equal(getBudgetPaceTone("near_limit"), "warn");
  assert.equal(getBudgetPaceTone("on_track"), "mut");
  // Status yang tidak dikenal jatuh ke nada paling netral, bukan merah.
  assert.equal(getBudgetPaceTone("status_baru"), "mut");
  assert.equal(getBudgetPaceTone(undefined), "mut");
});

test("halaman Jatah memakai ritme dari control summary, bukan hitungan sendiri", async () => {
  const page = await readFile(
    new URL("../src/components/budget/BudgetWorkspacePage.js", import.meta.url),
    "utf8",
  );
  const main = await readFile(
    new URL("../src/main.js", import.meta.url),
    "utf8",
  );

  // controlSummary.budget.categories memakai penyaring mata uang yang sama
  // dengan daftar di halaman, jadi tiap baris pasti ketemu pasangannya.
  assert.match(main, /<\$\{BudgetWorkspacePage\}[\s\S]{0,120}controlSummary=\$\{controlSummary\}/);
  assert.match(page, /controlSummary\?\.budget\?\.categories/);
  assert.match(page, /paceByCategory\?\.get\(budget\.categoryKey\)/);

  // Barisnya hanya di desktop; ponsel sudah padat.
  assert.match(page, /className="hidden items-center gap-1\.5 text-\[11\.5px\] lg:flex"/);
});

test("halaman Jatah tidak lagi terkunci lebar ponsel di desktop", async () => {
  const page = await readFile(
    new URL("../src/components/budget/BudgetWorkspacePage.js", import.meta.url),
    "utf8",
  );
  const main = await readFile(
    new URL("../src/main.js", import.meta.url),
    "utf8",
  );

  // max-w-md adalah 448px. Tanpa penyesuaian lg, halaman ini hanya memakai
  // 30% ruang yang ada pada layar 1748px.
  assert.match(page, /max-w-md[^"]*lg:max-w-none/);
  assert.match(page, /lg:grid-cols-\[minmax\(0,1fr\)_360px\]/);

  // Shell tidak lagi mematok budget selebar form Kirim/Tukar.
  assert.doesNotMatch(main, /activeTab === "movement" \|\| activeTab === "budget"/);
});

test("kartu rincian ada di kolom kanan bersama Kondisi keuanganmu", async () => {
  const page = await readFile(
    new URL("../src/components/budget/BudgetWorkspacePage.js", import.meta.url),
    "utf8",
  );

  assert.match(page, /<\$\{SpendingBreakdownCard\}/);
  assert.match(page, /buildSpendingBreakdown\(\{/);

  // Kedua kolom dibungkus. Tanpa wadah, penempatan otomatis melempar kartu
  // kedua kembali ke kolom kiri baris berikutnya, selebar penuh.
  const wadah = page.match(/<div className="flex flex-col gap-4 lg:gap-6">/g) || [];
  assert.equal(wadah.length, 2, "kolom kiri dan kanan sama sama dibungkus");
});
