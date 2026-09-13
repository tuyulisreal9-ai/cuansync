import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createTransactionFallbackRate } from "../src/domain/exchange.js";
import { resolveTransactionBaseValue } from "../src/domain/transactions.js";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

const TUKAR_USD = {
  id: "tukar-usd",
  type: "exchange",
  occurred_at: "2026-09-01T05:00:00.000Z",
  from_currency: "IDR",
  to_currency: "USD",
  from_amount: 160000,
  to_amount: 10,
};
const TUKAR_THB = {
  id: "tukar-thb",
  type: "exchange",
  occurred_at: "2026-09-05T05:00:00.000Z",
  from_currency: "IDR",
  to_currency: "THB",
  from_amount: 50000,
  to_amount: 100,
};

/* Satu tukar ke baht dulu membuat pemasukan USD 20,50 dinilai Rp 10.250
   (20,50 x 500), karena kurs cadangan selalu diambil dari tukar THB. */
test("kurs cadangan mengikuti mata uang transaksinya", () => {
  const cariKurs = createTransactionFallbackRate([TUKAR_USD, TUKAR_THB], "IDR");
  assert.equal(cariKurs({ currency: "USD", occurred_at: "2026-09-11T00:00:00.000Z" }), 16000);
  assert.equal(cariKurs({ currency: "THB", occurred_at: "2026-09-11T00:00:00.000Z" }), 500);
  assert.equal(cariKurs({ currency: "IDR", occurred_at: "2026-09-11T00:00:00.000Z" }), 1);
});

test("mata uang tanpa tukar tidak meminjam kurs mata uang lain", () => {
  const cariKurs = createTransactionFallbackRate([TUKAR_THB], "IDR");
  assert.equal(cariKurs({ currency: "USD", occurred_at: "2026-09-11T00:00:00.000Z" }), 0);
});

test("kurs cadangan tidak memakai tukar yang terjadi setelah transaksinya", () => {
  const cariKurs = createTransactionFallbackRate([TUKAR_USD], "IDR");
  assert.equal(cariKurs({ currency: "USD", occurred_at: "2026-08-20T00:00:00.000Z" }), 0);
});

test("nilai transaksi memakai kurs cadangan per transaksi", () => {
  const cariKurs = createTransactionFallbackRate([TUKAR_USD, TUKAR_THB], "IDR");
  const pemasukanUsd = {
    type: "income",
    currency: "USD",
    amount: 20.5,
    occurred_at: "2026-09-11T00:00:00.000Z",
  };
  assert.equal(resolveTransactionBaseValue(pemasukanUsd, cariKurs), 328000);

  // base_amount yang sudah tersimpan tetap menang atas kurs cadangan.
  assert.equal(
    resolveTransactionBaseValue({ ...pemasukanUsd, base_amount: 359649 }, cariKurs),
    359649,
  );
});

test("daftar riwayat dan laporan tidak lagi mengunci kurs ke baht", async () => {
  const history = await source("src/components/transactions/TransactionHistoryPage.js");
  const reports = await source("src/domain/reports.js");
  const main = await source("src/main.js");

  for (const [nama, berkas] of [
    ["riwayat", history],
    ["laporan", reports],
    ["beranda", main],
  ]) {
    assert.doesNotMatch(
      berkas,
      /getLatestRateForCurrencyUntil\(\s*\w+,\s*"THB"/,
      `${nama}: kurs cadangan tidak boleh dikunci ke THB`,
    );
  }
  assert.match(history, /createTransactionFallbackRate\(/);
  assert.match(main, /createTransactionFallbackRate\(/);
});
