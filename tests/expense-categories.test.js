import test from "node:test";
import assert from "node:assert/strict";
import {
  CATEGORY_OPTIONS,
  computeBudgetInsights,
  getBudgetCategoryLabel,
  normalizeBudget,
  normalizeBudgets,
} from "../src/domain/budgets.js";
import {
  getTransactionAmountValue,
  normalizeTransaction,
  normalizeTransactions,
} from "../src/domain/transactions.js";

const FINAL_LABELS = [
  "Makan Harian",
  "Belanja Kebutuhan",
  "Transportasi",
  "Tagihan",
  "Kesehatan",
  "Tempat Tinggal",
  "Hiburan & Gaya Hidup",
  "Lainnya",
];

function expense(category, amount = 100_000, overrides = {}) {
  return {
    id: `expense-${category}-${amount}`,
    user_id: "user-test",
    type: "expense",
    category,
    currency: "IDR",
    amount,
    base_currency: "IDR",
    base_amount: amount,
    occurred_at: "2026-07-10T12:00:00.000Z",
    created_at: "2026-07-10T12:00:00.000Z",
    ...overrides,
  };
}

function budget(id, category, limitAmount, overrides = {}) {
  return {
    id,
    user_id: "user-test",
    month_key: "2026-07",
    group_key: "needs",
    category,
    currency: "IDR",
    limit_amount: limitAmount,
    limit_thb: 0,
    created_at: `2026-07-0${id === "budget-internet" ? 1 : 2}T00:00:00.000Z`,
    ...overrides,
  };
}

test("pengguna baru mendapatkan tepat delapan kategori final", () => {
  assert.equal(CATEGORY_OPTIONS.length, 8);
  assert.deepEqual(
    CATEGORY_OPTIONS.map((category) => category.label),
    FINAL_LABELS,
  );
  assert.equal(
    new Set(CATEGORY_OPTIONS.map((category) => category.value)).size,
    8,
  );
});

test("Internet & Pulsa tidak muncul sebagai kategori aktif", () => {
  const labels = CATEGORY_OPTIONS.map((category) => category.label);
  const values = CATEGORY_OPTIONS.map((category) => category.value);
  assert.equal(labels.includes("Internet & Pulsa"), false);
  assert.equal(values.includes("Internet"), false);
});

test("Hiburan & Gaya Hidup dapat dipilih dan disimpan", () => {
  const option = CATEGORY_OPTIONS.find(
    (category) => category.label === "Hiburan & Gaya Hidup",
  );
  assert.ok(option);
  const normalized = normalizeTransaction(expense(option.value));
  assert.equal(normalized.category, "Hiburan & Gaya Hidup");
});

test("transaksi lama Internet & Pulsa tampil sebagai Tagihan", () => {
  const normalized = normalizeTransaction(expense("Internet & Pulsa"));
  assert.equal(normalized.category, "Tagihan");
  assert.equal(getBudgetCategoryLabel(normalized.category), "Tagihan");
});

test("nominal transaksi historis tidak berubah setelah normalisasi", () => {
  const original = expense("Internet", 275_000);
  const normalized = normalizeTransaction(original);
  assert.equal(getTransactionAmountValue(normalized), 275_000);
  assert.equal(normalized.base_amount, original.base_amount);
});

test("budget lama Internet & Pulsa berpindah ke Tagihan", () => {
  const normalized = normalizeBudget(
    budget("budget-internet", "Internet & Pulsa", 300_000),
    "IDR",
  );
  assert.equal(normalized.category, "Tagihan");
  assert.equal(normalized.categoryLabel, "Tagihan");
  assert.equal(normalized.limitAmount, 300_000);
});

test("budget Tagihan dan Internet digabung tanpa duplikasi", () => {
  const normalized = normalizeBudgets(
    [
      budget("budget-internet", "Internet & Pulsa", 300_000),
      budget("budget-tagihan", "Tagihan", 700_000),
    ],
    "IDR",
  );
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].category, "Tagihan");
  assert.equal(normalized[0].limitAmount, 1_000_000);
  assert.deepEqual(
    new Set(normalized[0].sourceBudgetIds),
    new Set(["budget-internet", "budget-tagihan"]),
  );
});

test("Transport lama ditampilkan sebagai Transportasi", () => {
  const normalized = normalizeTransaction(expense("Transport"));
  assert.equal(normalized.category, "Transportasi");
  assert.equal(getBudgetCategoryLabel(normalized.category), "Transportasi");
});

test("transfer antar-dompet tidak masuk perhitungan anggaran", () => {
  const insights = computeBudgetInsights(
    [
      {
        id: "transfer-idr",
        type: "exchange",
        category: "Tagihan",
        from_currency: "IDR",
        to_currency: "IDR",
        from_amount: 500_000,
        to_amount: 500_000,
        occurred_at: "2026-07-10T12:00:00.000Z",
      },
    ],
    [budget("budget-tagihan", "Tagihan", 1_000_000)],
    "2026-07",
    "IDR",
  );
  assert.equal(insights.length, 1);
  assert.equal(insights[0].spentAmount, 0);
});

test("total pengeluaran tetap sama sebelum dan sesudah migrasi", () => {
  const rows = [
    expense("Internet & Pulsa", 125_000),
    expense("Transport", 75_000),
    expense("Hiburan", 200_000),
  ];
  const before = rows.reduce(
    (sum, transaction) => sum + Number(transaction.amount || 0),
    0,
  );
  const normalized = normalizeTransactions(rows);
  const after = normalized.reduce(
    (sum, transaction) => sum + getTransactionAmountValue(transaction),
    0,
  );

  assert.equal(after, before);
  assert.deepEqual(
    normalized.map((transaction) => transaction.category),
    ["Tagihan", "Transportasi", "Hiburan & Gaya Hidup"],
  );
});
