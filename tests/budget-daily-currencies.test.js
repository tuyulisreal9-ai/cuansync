import test from "node:test";
import assert from "node:assert/strict";
import { buildDailyBudgetCurrencyViews } from "../src/domain/budgetDailyCurrencies.js";

const rates = {
  baseCurrency: "IDR",
  rates: { USD: 17_000, THB: 500 },
};

test("jatah harian diputar hanya untuk mata uang aktif dengan kurs tersedia", () => {
  const views = buildDailyBudgetCurrencyViews({
    remaining: 1_260_000,
    daysLeft: 7,
    baseCurrency: "IDR",
    activeCurrencies: ["IDR", "USD", "THB", "EUR", "USD"],
    globalRateSnapshot: rates,
  });

  assert.deepEqual(views.map((item) => item.currency), ["IDR", "USD", "THB"]);
  assert.equal(views[0].amount, 180_000);
  assert.ok(Math.abs(views[1].amount - 180_000 / 17_000) < 0.000001);
  assert.equal(views[2].amount, 360);
  assert.deepEqual(views.map((item) => item.isEstimate), [false, true, true]);
});

test("tanpa kurs tidak menebak nilai valas atau mengubah jatah utama", () => {
  const views = buildDailyBudgetCurrencyViews({
    remaining: 180_000,
    daysLeft: 1,
    baseCurrency: "IDR",
    activeCurrencies: ["USD"],
    globalRateSnapshot: null,
  });

  assert.deepEqual(views, [{ currency: "IDR", amount: 180_000, isEstimate: false }]);
});

test("jatah yang habis tidak menghasilkan angka negatif dan hari terakhir aman", () => {
  const views = buildDailyBudgetCurrencyViews({
    remaining: -10_000,
    daysLeft: 0,
    baseCurrency: "IDR",
    activeCurrencies: ["USD"],
    globalRateSnapshot: rates,
  });

  assert.deepEqual(views.map((item) => item.amount), [0, 0]);
});
