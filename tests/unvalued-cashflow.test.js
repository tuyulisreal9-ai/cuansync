import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildBudgetControlSummary } from "../src/domain/control.js";
import { buildSavingsAdvice } from "../src/domain/savingsAdvice.js";

const NOW = new Date("2026-07-20T05:00:00.000Z");
const TIME_ZONE = "Asia/Jakarta";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

function transaksi(overrides) {
  return {
    id: "tx",
    type: "expense",
    amount: 100_000,
    currency: "IDR",
    base_currency: "IDR",
    category: "Makan Harian",
    occurred_at: "2026-07-10T05:00:00.000Z",
    ...overrides,
  };
}

function ringkasan(transactions) {
  return buildBudgetControlSummary({
    metrics: {
      budgetInsights: [],
      assetAccountInsights: [],
      goalAllocationSummaries: {},
      foreignBalanceItems: [],
    },
    transactions,
    baseCurrency: "IDR",
    currentDate: NOW,
    timeZone: TIME_ZONE,
  });
}

/* Pemasukan USD tanpa kurs dulu dihitung nol: Kondisi keuanganmu menampilkan
   pemasukan Rp 0 dan sisa bulan minus, seolah-olah pengguna defisit. */
test("pemasukan yang belum dapat dinilai tidak dihitung nol", () => {
  const summary = ringkasan([
    transaksi({ id: "masuk-usd", type: "income", amount: 20.5, currency: "USD" }),
    transaksi({ id: "keluar-idr", amount: 30_000 }),
  ]);

  assert.equal(summary.cashFlow.missingIncomeCount, 1);
  assert.equal(summary.cashFlow.missingExpenseCount, 0);
  assert.equal(summary.cashFlow.complete, false);
  assert.equal(summary.cashFlow.evaluable, false);
  assert.equal(summary.cashFlow.blockedReason, "missing_valuation");
  assert.equal(summary.cashFlow.incomeRecorded, true);
  assert.equal(summary.cashFlow.status, "Belum dapat dinilai");
});

test("bulan tanpa pemasukan tetap dibedakan dari pemasukan yang belum dinilai", () => {
  const summary = ringkasan([transaksi({ amount: 30_000 })]);

  assert.equal(summary.cashFlow.complete, true);
  assert.equal(summary.cashFlow.blockedReason, "no_income");
  assert.equal(summary.cashFlow.incomeRecorded, false);
});

test("pemasukan valas dengan kurs tersimpan dihitung penuh", () => {
  const summary = ringkasan([
    transaksi({
      id: "masuk-usd",
      type: "income",
      amount: 20.5,
      currency: "USD",
      base_amount: 328_000,
      rate: 16_000,
    }),
    transaksi({ id: "keluar-idr", amount: 30_000 }),
  ]);

  assert.equal(summary.cashFlow.income, 328_000);
  assert.equal(summary.cashFlow.netCashFlow, 298_000);
  assert.equal(summary.cashFlow.complete, true);
  assert.equal(summary.cashFlow.evaluable, true);
  assert.equal(summary.cashFlow.blockedReason, null);
});

test("saran menyuruh melengkapi kurs, bukan mencatat pemasukan", () => {
  const summary = ringkasan([
    transaksi({ id: "masuk-usd", type: "income", amount: 20.5, currency: "USD" }),
  ]);
  const advice = buildSavingsAdvice(summary);
  const kunci = advice.items.map((item) => item.key);

  assert.ok(kunci.includes("need_valuation"));
  assert.ok(!kunci.includes("need_income"));

  const item = advice.items.find((entry) => entry.key === "need_valuation");
  assert.equal(item.actionTarget, "history");
});

test("bulan tanpa pemasukan tetap menyuruh mencatat pemasukan", () => {
  const advice = buildSavingsAdvice(ringkasan([transaksi({ amount: 30_000 })]));
  const kunci = advice.items.map((item) => item.key);

  assert.ok(kunci.includes("need_income"));
  assert.ok(!kunci.includes("need_valuation"));
});

test("rincian arus kas menahan angka yang belum lengkap", async () => {
  const pilar = await source("src/components/control/ControlPillars.js");

  assert.match(pilar, /Belum dapat dinilai/);
  // Sisa bulan tidak boleh merah hanya karena valuasinya belum lengkap.
  assert.match(pilar, /netIncomplete[\s\S]{0,120}text-rose-500/);

  // Kartu pilarnya tidak lagi menyuruh mencatat pemasukan yang sudah tercatat.
  assert.match(pilar, /blockedReason === "missing_valuation"/);
  assert.match(pilar, /Isi kursnya lewat Riwayat/);
  // Tombolnya pun mengarah ke Riwayat, bukan menyuruh mencatat pemasukan lagi.
  assert.match(pilar, /"missing_valuation"\s*\?\s*"Buka riwayat"/);
});
