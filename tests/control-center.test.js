import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildBudgetControlSummary,
  formatControlMoney,
  getControlMonthKey,
} from "../src/domain/control.js";
import {
  resolveTransactionFeeHistoricalBaseValue,
  resolveTransactionHistoricalBaseValue,
} from "../src/domain/transactions.js";

const NOW = new Date("2026-07-20T05:00:00.000Z");
const TIME_ZONE = "Asia/Jakarta";

function budget(category, limitAmount, spentAmount, transactionCount = 2) {
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

function account({
  id = "account-idr",
  currency = "IDR",
  balance = 10_000_000,
  rate = 1,
  type = "bank",
  allocatable = true,
} = {}) {
  return {
    id,
    name: id,
    currency,
    account_type: type,
    balanceAmount: balance,
    balance_amount: balance,
    rate,
    valuationIdr: currency === "IDR" ? balance : balance * rate,
    is_allocatable: allocatable,
  };
}

function transaction({
  id,
  type = "expense",
  amount,
  currency = "IDR",
  baseAmount = null,
  baseCurrency = "IDR",
  category = "Makan Harian",
  occurredAt = "2026-07-10T05:00:00.000Z",
  ...overrides
}) {
  return {
    id: id || `${type}-${currency}-${amount}`,
    type,
    amount,
    currency,
    base_amount: baseAmount,
    base_currency: baseCurrency,
    category,
    occurred_at: occurredAt,
    ...overrides,
  };
}

function metrics(overrides = {}) {
  return {
    budgetInsights: [
      budget("Makan Harian", 3_000_000, 1_000_000),
      budget("Transportasi", 1_000_000, 250_000),
    ],
    assetAccountInsights: [account()],
    goalAllocationSummaries: {},
    foreignBalanceItems: [],
    ...overrides,
  };
}

function build(overrides = {}) {
  return buildBudgetControlSummary({
    metrics: metrics(),
    transactions: [],
    baseCurrency: "IDR",
    currentDate: NOW,
    timeZone: TIME_ZONE,
    ...overrides,
  });
}

test("tanpa anggaran, sisa aman dan pilar anggaran tidak dipaksakan", () => {
  const summary = build({
    metrics: metrics({ budgetInsights: [] }),
  });

  assert.equal(summary.budget.available, false);
  assert.equal(summary.safeToSpend.available, false);
  assert.equal(summary.safeToSpend.amount, null);
  assert.equal(summary.scoring.score, null);
});

test("semua kategori mata uang utama digabung dalam satu ringkasan", () => {
  const summary = build();

  assert.equal(summary.budget.categories.length, 2);
  assert.equal(summary.budget.limitAmount, 4_000_000);
  assert.equal(summary.budget.spentAmount, 1_250_000);
  assert.equal(summary.budget.remainingAmount, 2_750_000);
  assert.equal(summary.safeToSpend.amount, 2_750_000);
});

test("kategori lewat batas menjadi perhatian pertama", () => {
  const summary = build({
    metrics: metrics({
      budgetInsights: [
        budget("Makan Harian", 1_000_000, 1_200_000),
        budget("Transportasi", 1_000_000, 900_000),
      ],
    }),
  });

  assert.equal(summary.budget.overCount, 1);
  assert.equal(summary.budget.attentionCategories[0].categoryLabel, "Makan Harian");
  assert.equal(summary.budget.attentionCategories[0].paceStatus, "over");
  assert.equal(summary.recommendation.categoryKey, "makan-harian");
});

test("ritme yang diproyeksikan melewati batas diberi peringatan", () => {
  const summary = build({
    metrics: metrics({
      budgetInsights: [budget("Makan Harian", 1_000_000, 800_000, 4)],
    }),
  });

  assert.equal(summary.budget.projectedOverCount, 1);
  assert.equal(
    summary.budget.attentionCategories[0].paceStatus,
    "projected_over",
  );
});

test("pemasukan nol tidak menghasilkan rasio tabungan palsu", () => {
  const summary = build({
    transactions: [transaction({ amount: 500_000 })],
  });

  assert.equal(summary.cashFlow.income, 0);
  assert.equal(summary.cashFlow.savingsRatio, null);
  assert.equal(summary.cashFlow.evaluable, false);
  assert.equal(summary.scoring.score, null);
});

test("arus kas negatif dihitung dari transaksi eksternal", () => {
  const summary = build({
    transactions: [
      transaction({ id: "income", type: "income", amount: 1_000_000 }),
      transaction({ id: "expense", amount: 1_500_000 }),
    ],
  });

  assert.equal(summary.cashFlow.netCashFlow, -500_000);
  assert.equal(summary.cashFlow.savingsRatio, -0.5);
  assert.equal(summary.cashFlow.status, "Defisit");
});

test("pokok transfer dan tukar valas tidak dihitung sebagai pengeluaran", () => {
  const summary = build({
    transactions: [
      transaction({
        id: "transfer",
        type: "exchange",
        amount: null,
        currency: null,
        category: null,
        from_currency: "IDR",
        to_currency: "IDR",
        from_amount: 2_000_000,
        to_amount: 2_000_000,
        rate_type: "transfer",
      }),
      transaction({
        id: "exchange",
        type: "exchange",
        amount: null,
        currency: null,
        category: null,
        from_currency: "IDR",
        to_currency: "THB",
        from_amount: 1_000_000,
        to_amount: 2_000,
      }),
    ],
  });

  assert.equal(summary.cashFlow.externalExpenses, 0);
  assert.equal(summary.cashFlow.expenseCount, 0);
});

test("biaya tukar valas dihitung sebagai pengeluaran eksternal", () => {
  const summary = build({
    transactions: [
      transaction({
        id: "exchange-fee",
        type: "exchange",
        amount: null,
        currency: null,
        category: null,
        from_currency: "IDR",
        to_currency: "THB",
        from_amount: 1_000_000,
        to_amount: 2_000,
        fee_amount: 10_000,
        fee_currency: "IDR",
      }),
    ],
  });

  assert.equal(summary.cashFlow.externalExpenses, 10_000);
  assert.equal(summary.cashFlow.feeExpenses, 10_000);
  assert.equal(summary.cashFlow.feeCount, 1);
});

test("alokasi target mengurangi dana likuid bebas", () => {
  const summary = build({
    metrics: metrics({
      assetAccountInsights: [account({ balance: 10_000_000 })],
      goalAllocationSummaries: {
        IDR: {
          currency: "IDR",
          allocatedAmount: 4_000_000,
        },
      },
    }),
  });

  assert.equal(summary.liquidity.eligibleLiquidFunds, 10_000_000);
  assert.equal(summary.liquidity.reservedTargetFunds, 4_000_000);
  assert.equal(summary.liquidity.freeLiquidFunds, 6_000_000);
});

test("target terdekat masuk ke kondisi keuangan", () => {
  const summary = build({
    metrics: metrics({
      nextGoal: {
        name: "Dana Darurat",
        currency: "IDR",
        targetAmount: 30_000_000,
        savedAmount: 5_000_000,
      },
    }),
  });

  assert.equal(summary.goal.available, true);
  assert.equal(summary.goal.name, "Dana Darurat");
  assert.equal(summary.goal.savedAmount, 5_000_000);
  assert.equal(summary.goal.remainingAmount, 25_000_000);
  assert.equal(Math.round(summary.goal.progress * 100), 17);
});

test("kondisi keuangan tidak menampilkan bahasa teknis internal", async () => {
  const source = await readFile(
    new URL(
      "../src/components/control/ControlPillars.js",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(source, /Kondisi keuangan/);
  assert.doesNotMatch(source, /Remittance/i);
  assert.doesNotMatch(source, /terverifikasi/i);
  assert.doesNotMatch(source, /database/i);
});

test("investasi dan akun yang tidak dapat dialokasikan tidak dianggap dana bebas", () => {
  const summary = build({
    metrics: metrics({
      assetAccountInsights: [
        account({ id: "bank", balance: 5_000_000 }),
        account({ id: "investment", balance: 50_000_000, type: "investment" }),
        account({ id: "locked", balance: 20_000_000, allocatable: false }),
      ],
    }),
  });

  assert.equal(summary.liquidity.eligibleAccountCount, 1);
  assert.equal(summary.liquidity.eligibleLiquidFunds, 5_000_000);
});

test("transaksi valas memakai base_amount historis tersimpan", () => {
  const foreignExpense = transaction({
    amount: 100,
    currency: "USD",
    baseAmount: 1_600_000,
  });
  const summary = build({ transactions: [foreignExpense] });

  assert.equal(
    resolveTransactionHistoricalBaseValue(foreignExpense, "IDR"),
    1_600_000,
  );
  assert.equal(summary.cashFlow.externalExpenses, 1_600_000);
  assert.equal(summary.cashFlow.missingValuationCount, 0);
});

test("transaksi valas tanpa nilai historis tidak memakai kurs global saat ini", () => {
  const foreignExpense = transaction({
    amount: 100,
    currency: "USD",
    baseAmount: null,
    rate: null,
  });
  const summary = build({
    metrics: metrics({
      assetAccountInsights: [
        account({
          id: "usd",
          currency: "USD",
          balance: 1_000,
          rate: 20_000,
        }),
      ],
    }),
    transactions: [foreignExpense],
  });

  assert.equal(
    resolveTransactionHistoricalBaseValue(foreignExpense, "IDR"),
    null,
  );
  assert.equal(summary.cashFlow.externalExpenses, 0);
  assert.equal(summary.cashFlow.missingValuationCount, 1);
  assert.equal(summary.cashFlow.evaluable, false);
});

test("biaya valas dapat memakai orientasi kurs historis transaksi", () => {
  const exchange = transaction({
    type: "exchange",
    amount: null,
    currency: null,
    from_currency: "USD",
    to_currency: "IDR",
    from_amount: 100,
    to_amount: 1_600_000,
    fee_amount: 2,
    fee_currency: "USD",
  });

  assert.equal(
    resolveTransactionFeeHistoricalBaseValue(exchange, "IDR"),
    32_000,
  );
});

test("komitmen rutin dan remittance tidak diberi skor tanpa dukungan schema", () => {
  const summary = build({
    transactions: [
      transaction({
        id: "tagihan",
        amount: 500_000,
        category: "Tagihan",
      }),
    ],
  });

  assert.equal(summary.commitments.tagihanSpent, 500_000);
  assert.equal(summary.commitments.evaluable, false);
  assert.equal(summary.limitations.recurringCommitments, false);
  assert.equal(summary.limitations.externalRemittance, false);
  assert.equal(summary.scoring.score, null);
});

test("privasi menyembunyikan nominal tanpa mengubah nilai domain", () => {
  const summary = build();

  assert.equal(formatControlMoney(summary.safeToSpend.amount, "IDR", false), "••••••");
  assert.notEqual(formatControlMoney(summary.safeToSpend.amount, "IDR", true), "••••••");
  assert.equal(summary.safeToSpend.amount, 2_750_000);
});

test("batas bulan mengikuti zona waktu pengguna", () => {
  const nearMidnightUtc = new Date("2026-07-31T18:30:00.000Z");

  assert.equal(getControlMonthKey(nearMidnightUtc, "UTC"), "2026-07");
  assert.equal(getControlMonthKey(nearMidnightUtc, "Asia/Jakarta"), "2026-08");
});
