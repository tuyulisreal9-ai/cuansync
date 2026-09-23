import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  applyTransactionRateToRecord,
  resolveTransactionRateInfo,
} from "../src/domain/transactionRates.js";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

const SNAPSHOT = { baseCurrency: "IDR", rates: { USD: 17543.86 } };
const TUKAR = {
  id: "tukar-1",
  type: "exchange",
  occurred_at: "2026-09-01T05:00:00.000Z",
  from_currency: "IDR",
  to_currency: "USD",
  from_amount: 160000,
  to_amount: 10,
};

function catat(amount, options) {
  const info = resolveTransactionRateInfo({
    baseCurrency: "IDR",
    occurredAt: new Date("2026-09-11T05:00:00.000Z"),
    ...options,
  });
  const record = {};
  applyTransactionRateToRecord(record, amount, info);
  return record;
}

/* Pemasukan USD 20,50 pernah tersimpan tanpa kurs sama sekali: Beranda
   menilainya dengan kurs hari ini sementara Kondisi keuanganmu menghitungnya
   Rp 0 dan menyimpulkan defisit. */
test("pemasukan valas menyimpan kurs beserta nilai rupiahnya", () => {
  const record = catat(20.5, {
    currency: "USD",
    transactions: [TUKAR],
    globalRateSnapshot: SNAPSHOT,
  });
  assert.equal(record.rate, 16000);
  assert.equal(record.locked_rate, 16000);
  assert.equal(record.rate_type, "historical");
  assert.equal(record.base_amount, 328000);
  assert.equal(record.amount_idr, 328000);
});

test("kurs tukar terakhir dipakai lebih dulu daripada kurs global", () => {
  const denganTukar = catat(1, {
    currency: "USD",
    transactions: [TUKAR],
    globalRateSnapshot: SNAPSHOT,
  });
  assert.equal(denganTukar.rate, 16000);

  const tanpaTukar = catat(1, {
    currency: "USD",
    transactions: [],
    globalRateSnapshot: SNAPSHOT,
  });
  assert.equal(tanpaTukar.rate, 17543.86);
  assert.equal(tanpaTukar.rate_type, "realtime");
});

test("kurs yang diisi sendiri menang atas kurs mana pun", () => {
  const record = catat(1, {
    currency: "USD",
    transactions: [TUKAR],
    globalRateSnapshot: SNAPSHOT,
    explicitRate: 15500,
    preferCustom: true,
  });
  assert.equal(record.rate, 15500);
  assert.equal(record.rate_type, "custom");
});

test("kurs yang sudah terkunci tidak berubah saat transaksi diedit", () => {
  const record = catat(2, {
    currency: "USD",
    transactions: [TUKAR],
    globalRateSnapshot: SNAPSHOT,
    lockedRate: 15000,
    storedRateType: "custom",
  });
  assert.equal(record.rate, 15000);
  assert.equal(record.rate_type, "custom");
  assert.equal(record.base_amount, 30000);
});

/* Tanpa kurs mana pun, nilainya memang belum diketahui. Menyimpan 0 akan
   membuat transaksi ikut terhitung sebagai nol di ringkasan. */
test("tanpa kurs sama sekali, nilai rupiah dibiarkan kosong", () => {
  const record = catat(20.5, {
    currency: "USD",
    transactions: [],
    globalRateSnapshot: null,
  });
  assert.equal(record.rate, null);
  assert.equal(record.rate_type, null);
  assert.equal(record.base_amount, null);
  assert.notEqual(record.base_amount, 0);
});

test("pemasukan rupiah tersimpan apa adanya", () => {
  const record = catat(250000, {
    currency: "IDR",
    transactions: [TUKAR],
    globalRateSnapshot: SNAPSHOT,
  });
  assert.equal(record.rate, null);
  assert.equal(record.rate_type, "base");
  assert.equal(record.base_amount, 250000);
});

test("pemasukan dan pengeluaran memakai jalur kurs yang sama", async () => {
  const main = await source("src/main.js");

  // Lima cabang: catat dan edit, masing-masing untuk pemasukan dan
  // pengeluaran, ditambah Catat banyak yang menyimpan batch lewat jalur
  // sendiri tetapi tetap memakai resolusi kurs yang sama.
  const pemakaian = main.match(/applyTransactionRateToRecord\(/g) || [];
  assert.equal(pemakaian.length, 5);

  // Cabang pemasukan dulu mengunci kursnya ke null.
  assert.doesNotMatch(main, /record\.rate = null;/);
  assert.doesNotMatch(main, /record\.locked_rate = null;/);
});
