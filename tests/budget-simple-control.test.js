import test from "node:test";
import assert from "node:assert/strict";
import { buildBudgetControlSummary } from "../src/domain/control.js";
import {
  MONTHLY_BUDGET_CATEGORY,
  MONTHLY_BUDGET_LABEL,
} from "../src/domain/budgets.js";

const NOW = new Date("2026-09-22T05:00:00.000Z");
const TIME_ZONE = "Asia/Jakarta";

function ringkasan(budgetInsights) {
  return buildBudgetControlSummary({
    metrics: {
      budgetInsights,
      assetAccountInsights: [],
      goalAllocationSummaries: {},
      foreignBalanceItems: [],
    },
    transactions: [],
    baseCurrency: "IDR",
    currentDate: NOW,
    timeZone: TIME_ZONE,
  });
}

function jatahBulanan(limitAmount, spentAmount) {
  return {
    id: "budget-bulanan",
    category: MONTHLY_BUDGET_CATEGORY,
    categoryKey: MONTHLY_BUDGET_CATEGORY,
    categoryLabel: MONTHLY_BUDGET_LABEL,
    scope: "month",
    currency: "IDR",
    limitAmount,
    spentAmount,
    remainingAmount: limitAmount - spentAmount,
    transactionCount: 6,
  };
}

function jatahKategori(category, limitAmount, spentAmount) {
  return {
    id: "budget-" + category,
    category,
    categoryKey: category.toLowerCase(),
    categoryLabel: category,
    scope: "category",
    currency: "IDR",
    limitAmount,
    spentAmount,
    remainingAmount: limitAmount - spentAmount,
    transactionCount: 4,
  };
}

/* Di mode simpel hanya ada satu baris jatah, jadi kalimat yang menghitung
   kategori akan berbunyi "1 kategori melewati batas" dan menyesatkan. */
test("pilar anggaran menilai satu jatah bulan, bukan daftar kategori", () => {
  const summary = ringkasan([jatahBulanan(6_000_000, 7_000_000)]);

  assert.equal(summary.budget.mode, "simple");
  assert.equal(summary.budget.categories.length, 1);
  assert.equal(summary.budget.categories[0].scope, "month");
  assert.equal(summary.budget.overCount, 1);

  const pilar = summary.scoring.pillars.find((item) => item.key === "budget");
  assert.doesNotMatch(pilar.metric, /kategori/);
  assert.equal(pilar.metric, "Jatah bulan ini terlewati");
});

test("mode rinci tetap menyebut jumlah kategori", () => {
  const summary = ringkasan([
    jatahKategori("Makan", 1_500_000, 1_900_000),
    jatahKategori("Transportasi", 500_000, 100_000),
  ]);

  assert.equal(summary.budget.mode, "category");
  const pilar = summary.scoring.pillars.find((item) => item.key === "budget");
  assert.equal(pilar.metric, "1 kategori melewati batas");
});
