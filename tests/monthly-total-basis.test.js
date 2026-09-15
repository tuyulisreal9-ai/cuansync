import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sumHistoricalBaseValues } from "../src/domain/transactions.js";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

const PENGELUARAN_IDR = {
  id: "keluar-idr",
  type: "expense",
  amount: 30_000,
  currency: "IDR",
  base_currency: "IDR",
  occurred_at: "2026-09-11T05:00:00.000Z",
};
const PENGELUARAN_USD = {
  id: "keluar-usd",
  type: "expense",
  amount: 1,
  currency: "USD",
  base_currency: "IDR",
  base_amount: 16_000,
  rate: 16_000,
  occurred_at: "2026-09-11T06:00:00.000Z",
};
const PENGELUARAN_TANPA_KURS = {
  id: "keluar-eur",
  type: "expense",
  amount: 5,
  currency: "EUR",
  base_currency: "IDR",
  occurred_at: "2026-09-11T07:00:00.000Z",
};

/* Total "Keluar" di Beranda dan Riwayat dulu dinilai ulang dengan kurs hari
   ini (Rp 47.544) sementara Jatah memakai nilai tersimpan (Rp 46.000), jadi
   pengguna melihat dua total untuk data yang sama. */
test("total bulanan memakai nilai yang tersimpan bersama transaksinya", () => {
  const hasil = sumHistoricalBaseValues(
    [PENGELUARAN_IDR, PENGELUARAN_USD],
    "IDR",
  );

  assert.equal(hasil.total, 46_000);
  assert.equal(hasil.missingCount, 0);
});

test("transaksi yang belum dapat dinilai dihitung terpisah, bukan nol", () => {
  const hasil = sumHistoricalBaseValues(
    [PENGELUARAN_IDR, PENGELUARAN_TANPA_KURS],
    "IDR",
  );

  assert.equal(hasil.total, 30_000);
  assert.equal(hasil.missingCount, 1);
});

test("ringkasan bulanan tidak lagi memakai kurs hari ini", async () => {
  const main = await source("src/main.js");
  const blok = main.slice(
    main.indexOf("const monthlyIncome = sumHistoricalBaseValues("),
    main.indexOf("const monthlyNetChangeIdr"),
  );

  assert.ok(blok.length > 0, "blok ringkasan bulanan harus ada");
  assert.doesNotMatch(blok, /resolveIdrValue/);
  assert.match(main, /monthlyUnvaluedCount/);
});

test("jumlah transaksi tak bernilai disebutkan di Beranda dan Riwayat", async () => {
  const beranda = await source("src/components/home/HomeDashboardPage.js");
  const riwayat = await source(
    "src/components/transactions/TransactionHistoryPage.js",
  );

  for (const [nama, berkas] of [
    ["beranda", beranda],
    ["riwayat", riwayat],
  ]) {
    assert.match(berkas, /unvaluedCount/, `${nama}: catatan harus diteruskan`);
    assert.match(
      berkas,
      /belum dapat dinilai/,
      `${nama}: catatan harus terbaca pengguna`,
    );
    /* htm membuang spasi dan baris baru di batas teks dan ${...}. Kalau kata
       "dalam" diakhiri baris baru, catatannya terbaca "dalamIDR". */
    assert.doesNotMatch(
      berkas,
      /dinilai dalam\s*\r?\n\s*\$\{/,
      `${nama}: kata "dalam" tidak boleh menempel ke mata uang`,
    );
  }
});

test("kartu harian memakai satu cakupan untuk terpakai dan sisa aman", async () => {
  const panel = await source("src/components/layout/DesktopWorkspace.js");
  const main = await source("src/main.js");

  // Terpakai mengikuti jatah yang sama dengan Sisa aman selama jatahnya ada.
  assert.match(panel, /const spentToday = budget\s*\n?\s*\? Number\(budget\.spentToday \|\| 0\)/);
  assert.match(main, /const todaySpentToday = budget\s*\n?\s*\? Number\(budget\.spentToday \|\| 0\)/);

  // Cakupannya disebutkan supaya angkanya tidak ambigu.
  assert.match(panel, /spentHelper/);
  assert.match(main, /todaySpentScopeLabel/);
});
