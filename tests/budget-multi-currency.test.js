import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  calculateBudgetBaseAmount,
  computeBudgetInsights,
  normalizeBudget,
  resolveAutomaticBudgetRate,
} from "../src/domain/budgets.js";

const MONTH_KEY = "2026-07";
const BASE_CURRENCY = "IDR";

function budget(overrides = {}) {
  return {
    id: "budget-makan",
    user_id: "user-a",
    month_key: MONTH_KEY,
    group_key: "needs",
    category: "Makan Harian",
    input_amount: 8_000,
    input_currency: "THB",
    base_amount: 3_597_920,
    base_currency: BASE_CURRENCY,
    planning_rate: 449.74,
    rate_source: "automatic",
    rate_date: "2026-07-01",
    rate_from_currency: "THB",
    rate_to_currency: BASE_CURRENCY,
    currency: BASE_CURRENCY,
    limit_amount: 3_597_920,
    created_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function expense({
  id,
  amount,
  currency,
  baseAmount,
  category = "Makan Harian",
  occurredAt = "2026-07-10T12:00:00.000Z",
}) {
  return {
    id,
    user_id: "user-a",
    type: "expense",
    category,
    category_group: "needs",
    amount,
    currency,
    base_amount: baseAmount,
    base_currency: BASE_CURRENCY,
    occurred_at: occurredAt,
  };
}

test("anggaran IDR memakai kurs satu dan nilai resmi yang sama", () => {
  assert.equal(
    calculateBudgetBaseAmount({
      inputAmount: 2_000_000,
      inputCurrency: "IDR",
      baseCurrency: BASE_CURRENCY,
      planningRate: 99,
    }),
    2_000_000,
  );
});

test("anggaran THB memakai snapshot kurs otomatis ke IDR", () => {
  const automatic = resolveAutomaticBudgetRate(
    {
      baseCurrency: BASE_CURRENCY,
      rates: { THB: 449.74 },
      sourceDate: "2026-07-01",
    },
    "THB",
    BASE_CURRENCY,
  );
  assert.deepEqual(
    {
      rate: automatic.rate,
      source: automatic.source,
      from: automatic.rateFromCurrency,
      to: automatic.rateToCurrency,
    },
    {
      rate: 449.74,
      source: "automatic",
      from: "THB",
      to: "IDR",
    },
  );
  assert.equal(
    calculateBudgetBaseAmount({
      inputAmount: 8_000,
      inputCurrency: "THB",
      baseCurrency: BASE_CURRENCY,
      planningRate: automatic.rate,
    }),
    3_597_920,
  );
});

test("kurs custom menghasilkan nilai resmi tanpa memakai kurs global", () => {
  assert.equal(
    calculateBudgetBaseAmount({
      inputAmount: 8_000,
      inputCurrency: "THB",
      baseCurrency: BASE_CURRENCY,
      planningRate: 500,
    }),
    4_000_000,
  );
});

test("edit anggaran mempertahankan nominal input dan snapshot tersimpan", () => {
  const normalized = normalizeBudget(budget(), BASE_CURRENCY);
  assert.equal(normalized.inputAmount, 8_000);
  assert.equal(normalized.inputCurrency, "THB");
  assert.equal(normalized.baseAmount, 3_597_920);
  assert.equal(normalized.planningRate, 449.74);
  assert.equal(normalized.rateSource, "automatic");
  assert.equal(normalized.rateDate, "2026-07-01");
});

test("kurs anggaran berubah hanya setelah snapshot pengganti diterapkan", () => {
  const original = normalizeBudget(budget(), BASE_CURRENCY);
  const availableAutomaticRate = resolveAutomaticBudgetRate(
    {
      baseCurrency: BASE_CURRENCY,
      rates: { THB: 500 },
      sourceDate: "2026-07-20",
    },
    "THB",
    BASE_CURRENCY,
  );

  assert.equal(original.planningRate, 449.74);
  assert.equal(original.baseAmount, 3_597_920);

  const updated = normalizeBudget(
    budget({
      base_amount: calculateBudgetBaseAmount({
        inputAmount: original.inputAmount,
        inputCurrency: original.inputCurrency,
        baseCurrency: BASE_CURRENCY,
        planningRate: availableAutomaticRate.rate,
      }),
      planning_rate: availableAutomaticRate.rate,
      rate_date: availableAutomaticRate.rateDate,
    }),
    BASE_CURRENCY,
  );
  assert.equal(updated.planningRate, 500);
  assert.equal(updated.baseAmount, 4_000_000);
});

test("kurs global baru tidak mengubah batas resmi tersimpan", () => {
  const insights = computeBudgetInsights(
    [],
    [budget()],
    MONTH_KEY,
    BASE_CURRENCY,
    {
      baseCurrency: BASE_CURRENCY,
      rates: { THB: 999 },
      sourceDate: "2026-07-31",
    },
  );
  assert.equal(insights[0].limitAmount, 3_597_920);
});

test("pengeluaran IDR mengurangi anggaran yang dimasukkan melalui THB", () => {
  const insights = computeBudgetInsights(
    [
      expense({
        id: "expense-idr",
        amount: 100_000,
        currency: "IDR",
        baseAmount: 100_000,
      }),
    ],
    [budget()],
    MONTH_KEY,
    BASE_CURRENCY,
  );
  assert.equal(insights[0].spentAmount, 100_000);
  assert.equal(insights[0].remainingAmount, 3_497_920);
});

test("pengeluaran THB dan USD dalam kategori sama dijumlahkan dalam IDR", () => {
  const insights = computeBudgetInsights(
    [
      expense({
        id: "expense-thb",
        amount: 500,
        currency: "THB",
        baseAmount: 225_000,
      }),
      expense({
        id: "expense-usd",
        amount: 5,
        currency: "USD",
        baseAmount: 82_500,
      }),
    ],
    [budget()],
    MONTH_KEY,
    BASE_CURRENCY,
  );
  assert.equal(insights[0].spentAmount, 307_500);
  assert.equal(insights[0].transactionCount, 2);
});

test("progress memakai total base_amount", () => {
  const insights = computeBudgetInsights(
    [
      expense({
        id: "expense-progress",
        amount: 899_480,
        currency: "IDR",
        baseAmount: 899_480,
      }),
    ],
    [budget()],
    MONTH_KEY,
    BASE_CURRENCY,
  );
  assert.equal(insights[0].usage, 0.25);
});

test("transfer internal tidak dihitung sebagai pemakaian anggaran", () => {
  const insights = computeBudgetInsights(
    [
      {
        id: "transfer",
        type: "exchange",
        category: "Makan Harian",
        category_group: "needs",
        from_currency: "IDR",
        to_currency: "IDR",
        from_amount: 500_000,
        to_amount: 500_000,
        fee_amount: null,
        occurred_at: "2026-07-10T12:00:00.000Z",
      },
    ],
    [budget()],
    MONTH_KEY,
    BASE_CURRENCY,
  );
  assert.equal(insights[0].spentAmount, 0);
});

test("tukar valas internal tidak menghitung pokok sebagai pengeluaran", () => {
  const insights = computeBudgetInsights(
    [
      {
        id: "exchange",
        type: "exchange",
        category: "Makan Harian",
        category_group: "needs",
        from_currency: "IDR",
        to_currency: "THB",
        from_amount: 1_000_000,
        to_amount: 2_000,
        fee_amount: null,
        occurred_at: "2026-07-10T12:00:00.000Z",
      },
    ],
    [budget()],
    MONTH_KEY,
    BASE_CURRENCY,
  );
  assert.equal(insights[0].spentAmount, 0);
});

test("biaya admin berkategori tetap dihitung tanpa menghitung pokok exchange", () => {
  const insights = computeBudgetInsights(
    [
      {
        id: "exchange-fee",
        type: "exchange",
        category: "Makan Harian",
        category_group: "needs",
        from_currency: "USD",
        to_currency: "IDR",
        from_amount: 100,
        to_amount: 1_600_000,
        base_currency: "IDR",
        base_amount: 1_600_000,
        fee_amount: 2,
        fee_currency: "USD",
        occurred_at: "2026-07-10T12:00:00.000Z",
      },
    ],
    [budget()],
    MONTH_KEY,
    BASE_CURRENCY,
  );
  assert.equal(insights[0].spentAmount, 32_000);
});

test("base_amount transaksi historis tidak berubah oleh kurs hari ini", () => {
  const storedExpense = expense({
    id: "historical-usd",
    amount: 5,
    currency: "USD",
    baseAmount: 82_500,
  });
  const insights = computeBudgetInsights(
    [storedExpense],
    [budget()],
    MONTH_KEY,
    BASE_CURRENCY,
    {
      baseCurrency: BASE_CURRENCY,
      rates: { USD: 99_000 },
    },
  );
  assert.equal(insights[0].spentAmount, 82_500);
});

test("anggaran lama IDR tetap dapat dibaca sebagai snapshot legacy", () => {
  const legacy = normalizeBudget(
    {
      id: "legacy-budget",
      user_id: "user-a",
      month_key: MONTH_KEY,
      group_key: "needs",
      category: "Tagihan",
      currency: "IDR",
      limit_amount: 750_000,
      created_at: "2026-07-01T00:00:00.000Z",
    },
    BASE_CURRENCY,
  );
  assert.equal(legacy.inputAmount, 750_000);
  assert.equal(legacy.inputCurrency, "IDR");
  assert.equal(legacy.baseAmount, 750_000);
  assert.equal(legacy.planningRate, 1);
  assert.equal(legacy.rateSource, "legacy");
});

test("migration tidak menghapus data dan menghentikan duplikasi", async () => {
  const migration = await readFile(
    new URL(
      "../supabase/manual_migrations/20260731_add_budget_planning_snapshot.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.equal(/\btruncate\b/i.test(migration), false);
  assert.equal(/\bdelete\s+from\s+public\.budgets\b/i.test(migration), false);
  assert.match(migration, /raise exception/i);
  assert.match(migration, /budgets_user_month_category_idx/i);
  const uniqueIndex = migration.match(
    /create unique index if not exists budgets_user_month_category_idx[\s\S]*?;/i,
  )?.[0];
  assert.ok(uniqueIndex);
  assert.doesNotMatch(uniqueIndex, /input_currency/i);
  assert.doesNotMatch(uniqueIndex, /\bcurrency\b/i);
});

test("RLS anggaran tetap membatasi operasi ke auth.uid", async () => {
  const schema = await readFile(
    new URL("../supabase/schema.sql", import.meta.url),
    "utf8",
  );
  assert.match(
    schema,
    /alter table public\.budgets enable row level security/i,
  );
  assert.match(
    schema,
    /Users can read own budgets[\s\S]*auth\.uid\(\) = user_id/i,
  );
  assert.match(
    schema,
    /Users can update own budgets[\s\S]*auth\.uid\(\) = user_id[\s\S]*with check \(auth\.uid\(\) = user_id\)/i,
  );
});
