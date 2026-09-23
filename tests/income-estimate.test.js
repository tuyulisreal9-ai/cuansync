import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildBudgetControlSummary } from "../src/domain/control.js";
import { buildSavingsAdvice } from "../src/domain/savingsAdvice.js";
import { buildControlCoach } from "../src/domain/controlGuidance.js";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

// 20 Juli 2026 pukul 12.00 WIB: hari ke-20 dari 31 hari.
const NOW = new Date("2026-07-20T05:00:00.000Z");
const TIME_ZONE = "Asia/Jakarta";

function jatah(category, limitAmount, spentAmount, transactionCount = 2) {
  return {
    id: `budget-${category}`,
    category,
    categoryKey: category.toLowerCase().replace(/\s+/g, "-"),
    categoryLabel: category,
    currency: "IDR",
    limitAmount,
    spentAmount,
    remainingAmount: limitAmount - spentAmount,
    transactionCount,
  };
}

const DOMPET = {
  id: "account-idr",
  name: "BCA",
  currency: "IDR",
  account_type: "bank",
  balanceAmount: 10_000_000,
  balance_amount: 10_000_000,
  rate: 1,
  valuationIdr: 10_000_000,
  is_allocatable: true,
};

function transaksi(overrides) {
  return {
    type: "expense",
    amount: 100_000,
    currency: "IDR",
    base_currency: "IDR",
    category: "Makan Harian",
    occurred_at: "2026-07-10T05:00:00.000Z",
    ...overrides,
  };
}

function ringkasan({
  transactions = [],
  incomeEstimate = null,
  budgetInsights = [jatah("Makan Harian", 3_000_000, 1_000_000)],
} = {}) {
  return buildBudgetControlSummary({
    metrics: {
      budgetInsights,
      assetAccountInsights: [DOMPET],
      goalAllocationSummaries: {},
      foreignBalanceItems: [],
    },
    transactions,
    baseCurrency: "IDR",
    currentDate: NOW,
    timeZone: TIME_ZONE,
    incomeEstimate,
  });
}

const GAJI = { amount: 8_000_000, currency: "IDR", baseAmount: 8_000_000 };

/* Arus kas dulu baru terbaca setelah pemasukan dicatat, sehingga orang
   bergaji yang gajinya belum masuk hanya melihat "Belum cukup data". */
test("perkiraan pemasukan membuat arus kas terbaca walau gaji belum tercatat", () => {
  const summary = ringkasan({
    transactions: [transaksi({ id: "makan", amount: 1_000_000 })],
    incomeEstimate: GAJI,
  });
  const { cashFlow } = summary;

  assert.equal(cashFlow.income, 0);
  assert.equal(cashFlow.incomeSource, "estimate");
  assert.equal(cashFlow.incomeBasis, 8_000_000);
  assert.equal(cashFlow.evaluable, true);
  assert.equal(cashFlow.blockedReason, null);
  // Satu transaksi belum cukup untuk dihitung lajunya, jadi anggaran jadi acuan.
  assert.ok(summary.budget.limitAmount > 0);
  assert.equal(cashFlow.expenseBasisSource, "budget");
  assert.equal(
    cashFlow.expenseBasis,
    Math.max(1_000_000, summary.budget.limitAmount),
  );
  assert.equal(cashFlow.netCashFlow, 8_000_000 - cashFlow.expenseBasis);
});

test("pemasukan tercatat dipakai begitu melampaui perkiraan", () => {
  const summary = ringkasan({
    transactions: [
      transaksi({ id: "gaji", type: "income", amount: 9_000_000, category: null }),
      transaksi({ id: "makan", amount: 1_000_000 }),
    ],
    incomeEstimate: GAJI,
  });

  assert.equal(summary.cashFlow.incomeSource, "recorded");
  assert.equal(summary.cashFlow.incomeBasis, 9_000_000);
  assert.equal(summary.cashFlow.expenseBasis, 1_000_000);
  assert.equal(summary.cashFlow.netCashFlow, 8_000_000);
});

/* Sewa kos di awal bulan tidak boleh ikut dikalikan sampai akhir bulan:
   3,2 juta dalam 20 hari setara 4,96 juta sebulan kalau dihitung lurus. */
test("pengeluaran besar di awal bulan tidak dikalikan melewati anggaran", () => {
  const transactions = [
    transaksi({ id: "kos", amount: 3_000_000, occurred_at: "2026-07-02T05:00:00.000Z" }),
    transaksi({ id: "makan", amount: 200_000, occurred_at: "2026-07-05T05:00:00.000Z" }),
  ];

  const denganJatah = ringkasan({
    transactions,
    incomeEstimate: GAJI,
    budgetInsights: [jatah("Makan Harian", 4_000_000, 3_200_000)],
  });
  assert.equal(denganJatah.cashFlow.expenseBasisSource, "budget");
  assert.equal(
    denganJatah.cashFlow.expenseBasis,
    Math.max(3_200_000, Math.min(denganJatah.budget.limitAmount, 4_960_000)),
  );

  const tanpaJatah = ringkasan({
    transactions,
    incomeEstimate: GAJI,
    budgetInsights: [],
  });
  assert.equal(tanpaJatah.cashFlow.expenseBasisSource, "pace");
  assert.equal(Math.round(tanpaJatah.cashFlow.expenseBasis), 4_960_000);
});

test("perkiraan valas tanpa kurs tidak dipakai dan disebutkan", () => {
  const summary = ringkasan({
    transactions: [transaksi({ id: "makan", amount: 100_000 })],
    incomeEstimate: { amount: 30_000, currency: "THB", baseAmount: null },
  });

  assert.equal(summary.cashFlow.evaluable, false);
  assert.equal(summary.cashFlow.blockedReason, "no_income");
  assert.equal(summary.cashFlow.estimateUnvalued, true);
  assert.equal(summary.cashFlow.estimate.currency, "THB");
});

test("transaksi tanpa nilai tetap menahan arus kas walau ada perkiraan", () => {
  const summary = ringkasan({
    transactions: [
      transaksi({ id: "usd", type: "income", amount: 20.5, currency: "USD", category: null }),
    ],
    incomeEstimate: GAJI,
  });

  assert.equal(summary.cashFlow.evaluable, false);
  assert.equal(summary.cashFlow.blockedReason, "missing_valuation");
});

/* Pilar Komitmen Rutin & Remittance belum didukung skema, dan dulu membuat
   skor total mustahil muncul. Skor sementara dihitung dari pilar lainnya. */
test("skor sementara dihitung dari pilar yang sudah didukung", () => {
  const summary = ringkasan({
    transactions: [transaksi({ id: "makan", amount: 1_000_000 })],
    incomeEstimate: GAJI,
  });
  const { scoring } = summary;
  const didukung = scoring.pillars.filter((pillar) => pillar.supported !== false);

  assert.ok(
    didukung.every((pillar) => pillar.evaluable),
    "anggaran, arus kas, dan daya tahan dana harus terbaca",
  );
  assert.equal(scoring.provisional, true);
  assert.equal(scoring.scoredPillarCount, 3);
  assert.equal(scoring.totalPillarCount, 4);
  assert.deepEqual(scoring.unscoredPillars, ["Komitmen Rutin & Remittance"]);

  const bobot = didukung.reduce((sum, pillar) => sum + pillar.weight, 0);
  const harapan = Math.round(
    didukung.reduce((sum, pillar) => sum + pillar.score * pillar.weight, 0) / bobot,
  );
  assert.equal(scoring.score, harapan);
});

test("tanpa perkiraan dan pemasukan, skor belum dapat dinilai", () => {
  const summary = ringkasan({
    transactions: [transaksi({ id: "makan", amount: 1_000_000 })],
  });

  assert.equal(summary.scoring.score, null);
  assert.equal(summary.scoring.provisional, false);
});

test("saran dan coach mengarah ke perkiraan pemasukan", () => {
  const tanpaPerkiraan = ringkasan({
    transactions: [transaksi({ id: "makan", amount: 100_000 })],
  });
  const saran = buildSavingsAdvice(tanpaPerkiraan).items.find(
    (entry) => entry.key === "need_income",
  );
  assert.equal(saran.actionTarget, "income_estimate");
  assert.equal(buildControlCoach(tanpaPerkiraan).actionTarget, "income_estimate");

  const denganPerkiraan = ringkasan({
    transactions: [transaksi({ id: "makan", amount: 100_000 })],
    incomeEstimate: GAJI,
  });
  assert.ok(
    !buildSavingsAdvice(denganPerkiraan).items.some(
      (entry) => entry.key === "need_income",
    ),
  );
});

test("rasio tabungan dari perkiraan disebut sebagai perkiraan", () => {
  const summary = ringkasan({
    transactions: [transaksi({ id: "makan", amount: 1_000_000 })],
    incomeEstimate: { amount: 3_500_000, currency: "IDR", baseAmount: 3_500_000 },
  });
  const rasio = buildSavingsAdvice(summary).items.find(
    (entry) => entry.key === "savings_ratio",
  );

  assert.ok(rasio, "rasio di bawah 20% harus memunculkan saran");
  assert.match(rasio.detail, /perkiraan pemasukan/);
});

test("perkiraan disimpan di profil dengan cadangan lokal", async () => {
  const migrasi = await source(
    "supabase/migrations/20260915090000_profile_monthly_income_estimate.sql",
  );
  const main = await source("src/main.js");
  const halaman = await source("src/components/control/ControlCenterPage.js");
  const sheet = await source("src/components/control/IncomeEstimateSheet.js");

  assert.match(migrasi, /add column if not exists monthly_income_estimate numeric/);
  assert.match(migrasi, /add column if not exists monthly_income_estimate_currency text/);

  // Kunci penyimpanan terdaftar, bukan jatuh ke kunci "undefined".
  assert.match(main, /incomeEstimates: "cuansync-income-estimates"/);
  assert.match(main, /buildBudgetControlSummary\(\{[\s\S]{0,160}incomeEstimate,/);
  assert.match(
    main,
    /from\("profiles"\)\.upsert\(\s*\{\s*id: user\.id,\s*monthly_income_estimate:/,
  );
  assert.match(main, /isMissingIncomeEstimateColumn\(error\)/);

  assert.match(halaman, /item\.actionTarget === "income_estimate"/);
  assert.match(halaman, /<\$\{IncomeEstimateSheet\}/);
  assert.match(sheet, /getNumericInputOptions\(currency\)/);
});
