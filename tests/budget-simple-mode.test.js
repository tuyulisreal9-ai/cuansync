import test from "node:test";
import assert from "node:assert/strict";
import {
  MONTHLY_BUDGET_CATEGORY,
  MONTHLY_BUDGET_LABEL,
  buildBudgetOverspendWarning,
  computeBudgetInsights,
  isMonthlyBudget,
  normalizeBudgets,
} from "../src/domain/budgets.js";
import {
  BUDGET_MODES,
  buildSimpleBudgetView,
  estimateRecurringBills,
  resolveBudgetMode,
  suggestCategorySplit,
} from "../src/domain/budgetPlan.js";

/* Bulan yang sudah lewat dipakai supaya hitungannya tidak bergantung pada
   tanggal hari ini saat tes dijalankan. */
const BULAN = "2026-01";

function jatahBulanan(amount, monthKey = BULAN) {
  return {
    id: `budget-bulanan-${monthKey}`,
    user_id: "demo-user",
    month_key: monthKey,
    group_key: "needs",
    category: MONTHLY_BUDGET_CATEGORY,
    input_amount: amount,
    input_currency: "IDR",
    base_amount: amount,
    base_currency: "IDR",
    planning_rate: 1,
    currency: "IDR",
    limit_amount: amount,
  };
}

function jatahKategori(category, amount, monthKey = BULAN) {
  return {
    id: `budget-${category}-${monthKey}`,
    user_id: "demo-user",
    month_key: monthKey,
    group_key: "needs",
    category,
    input_amount: amount,
    input_currency: "IDR",
    base_amount: amount,
    base_currency: "IDR",
    planning_rate: 1,
    currency: "IDR",
    limit_amount: amount,
  };
}

function belanja({ id, amount, category = "Makan", day = "05", monthKey = BULAN }) {
  return {
    id,
    type: "expense",
    amount,
    currency: "IDR",
    base_amount: amount,
    base_currency: "IDR",
    category,
    category_group: category ? "needs" : null,
    occurred_at: `${monthKey}-${day}T05:00:00.000Z`,
  };
}

test("jatah bulanan menampung seluruh pengeluaran, termasuk yang tanpa kategori", () => {
  const transaksi = [
    belanja({ id: "makan", amount: 1_000_000 }),
    belanja({ id: "lepas", amount: 500_000, category: null, day: "07" }),
  ];
  const insights = computeBudgetInsights(
    transaksi,
    [jatahBulanan(5_000_000)],
    BULAN,
    "IDR",
  );

  assert.equal(insights.length, 1);
  const [jatah] = insights;
  assert.equal(jatah.scope, "month");
  assert.equal(jatah.categoryLabel, MONTHLY_BUDGET_LABEL);
  assert.equal(jatah.limitAmount, 5_000_000);
  // Belanja tanpa kategori dulu tidak masuk jatah mana pun.
  assert.equal(jatah.spentAmount, 1_500_000);
  assert.equal(jatah.remainingAmount, 3_500_000);
});

test("jatah per kategori tetap hanya menghitung kategorinya sendiri", () => {
  const transaksi = [
    belanja({ id: "makan", amount: 1_000_000 }),
    belanja({ id: "lepas", amount: 500_000, category: null, day: "07" }),
    belanja({ id: "bensin", amount: 300_000, category: "Transportasi", day: "09" }),
  ];
  const insights = computeBudgetInsights(
    transaksi,
    [jatahKategori("Makan", 3_000_000)],
    BULAN,
    "IDR",
  );

  assert.equal(insights.length, 1);
  assert.equal(insights[0].scope, "category");
  assert.equal(insights[0].spentAmount, 1_000_000);
});

test("penanda jatah bulanan tidak berubah menjadi kategori Lainnya", () => {
  const [baris] = normalizeBudgets([jatahBulanan(4_000_000)], "IDR");

  assert.ok(isMonthlyBudget(baris));
  assert.equal(baris.category, MONTHLY_BUDGET_CATEGORY);
  assert.equal(baris.categoryKey, MONTHLY_BUDGET_CATEGORY);
  assert.notEqual(baris.categoryKey, "lainnya");
});

test("mode dibaca dari baris jatah bulan itu sendiri", () => {
  const simpel = resolveBudgetMode([jatahBulanan(5_000_000)], BULAN, "IDR");
  assert.equal(simpel.mode, BUDGET_MODES.simple);
  assert.equal(simpel.monthlyBudget.limitAmount, 5_000_000);
  assert.equal(simpel.categoryBudgets.length, 0);

  const rinci = resolveBudgetMode(
    [jatahKategori("Makan", 3_000_000), jatahKategori("Transportasi", 1_000_000)],
    BULAN,
    "IDR",
  );
  assert.equal(rinci.mode, BUDGET_MODES.category);
  assert.equal(rinci.categoryBudgets.length, 2);
});

test("bulan kosong mengikuti mode bulan sebelumnya", () => {
  const lanjutSimpel = resolveBudgetMode(
    [jatahBulanan(5_000_000, "2025-12")],
    BULAN,
    "IDR",
  );
  assert.equal(lanjutSimpel.mode, BUDGET_MODES.none);
  assert.equal(lanjutSimpel.suggestedMode, BUDGET_MODES.simple);
  assert.equal(lanjutSimpel.previousMonthlyAmount, 5_000_000);

  const lanjutRinci = resolveBudgetMode(
    [jatahKategori("Makan", 3_000_000, "2025-12")],
    BULAN,
    "IDR",
  );
  assert.equal(lanjutRinci.suggestedMode, BUDGET_MODES.category);

  // Pengguna baru belum punya apa pun, jadi mulai dari yang simpel.
  assert.equal(resolveBudgetMode([], BULAN, "IDR").suggestedMode, BUDGET_MODES.simple);
});

test("perkiraan tagihan rutin butuh dua bulan berisi catatan", () => {
  const satuBulan = [
    belanja({ id: "listrik", amount: 800_000, category: "Tagihan", monthKey: "2026-04" }),
  ];
  assert.equal(
    estimateRecurringBills({
      transactions: satuBulan,
      monthKey: "2026-05",
      baseCurrency: "IDR",
    }),
    null,
  );

  const duaBulan = [
    ...satuBulan,
    belanja({ id: "kos-4", amount: 1_200_000, category: "Tempat Tinggal", monthKey: "2026-04" }),
    belanja({ id: "listrik-3", amount: 700_000, category: "Tagihan", monthKey: "2026-03" }),
    belanja({ id: "kos-3", amount: 1_300_000, category: "Tempat Tinggal", monthKey: "2026-03" }),
    belanja({ id: "makan-3", amount: 900_000, monthKey: "2026-03" }),
    // Tagihan bulan ini yang sudah dibayar tidak perlu disisihkan lagi.
    belanja({ id: "listrik-5", amount: 750_000, category: "Tagihan", monthKey: "2026-05" }),
  ];
  const perkiraan = estimateRecurringBills({
    transactions: duaBulan,
    monthKey: "2026-05",
    baseCurrency: "IDR",
  });

  assert.equal(perkiraan.monthCount, 2);
  assert.equal(perkiraan.amount, 2_000_000);
  assert.equal(perkiraan.paidThisMonth, 750_000);
  assert.equal(perkiraan.remaining, 1_250_000);
});

test("angka harian menyisihkan tagihan yang belum dibayar", () => {
  const view = buildSimpleBudgetView({
    insight: {
      limitAmount: 5_000_000,
      spentAmount: 1_000_000,
      spentBeforeToday: 800_000,
      spentToday: 200_000,
      remainingDaysIncludingToday: 16,
    },
    reservedAmount: 1_500_000,
  });

  assert.equal(view.remainingAmount, 4_000_000);
  assert.equal(view.spendableRemaining, 2_500_000);
  // (5.000.000 - 800.000 - 1.500.000) / 16
  assert.equal(view.dailyLimit, 168_750);
  assert.equal(view.todayRemaining, -31_250);

  const tanpaSisih = buildSimpleBudgetView({
    insight: {
      limitAmount: 5_000_000,
      spentAmount: 1_000_000,
      spentBeforeToday: 800_000,
      spentToday: 200_000,
      remainingDaysIncludingToday: 16,
    },
  });
  assert.equal(tanpaSisih.dailyLimit, 262_500);
});

test("usulan pembagian mengikuti pola belanja dan jumlahnya persis", () => {
  const riwayat = [
    belanja({ id: "m1", amount: 2_000_000, monthKey: "2025-12" }),
    belanja({ id: "t1", amount: 1_000_000, category: "Transportasi", monthKey: "2025-12" }),
    belanja({ id: "m2", amount: 1_000_000, monthKey: "2025-11" }),
  ];
  const usulan = suggestCategorySplit({
    transactions: riwayat,
    monthKey: BULAN,
    baseCurrency: "IDR",
    totalAmount: 5_000_000,
  });

  assert.equal(usulan.rows.length, 2);
  assert.equal(usulan.rows[0].category, "Makan");
  assert.equal(usulan.rows[0].amount, 3_750_000);
  assert.equal(usulan.rows[1].amount, 1_250_000);
  assert.equal(
    usulan.rows.reduce((sum, row) => sum + row.amount, 0),
    5_000_000,
  );

  // Nominal yang tidak bulat pun harus berjumlah persis sama dengan jatahnya.
  const ganjil = suggestCategorySplit({
    transactions: riwayat,
    monthKey: BULAN,
    baseCurrency: "IDR",
    totalAmount: 5_111_111,
  });
  assert.equal(
    ganjil.rows.reduce((sum, row) => sum + row.amount, 0),
    5_111_111,
  );
});

test("tanpa riwayat belanja, pembagian tidak ditebak", () => {
  assert.equal(
    suggestCategorySplit({
      transactions: [],
      monthKey: BULAN,
      baseCurrency: "IDR",
      totalAmount: 5_000_000,
    }),
    null,
  );
});

test("peringatan lewat jatah memakai jatah bulanan untuk belanja tanpa kategori", () => {
  const transaksi = [
    belanja({ id: "makan", amount: 900_000 }),
    belanja({ id: "lepas", amount: 400_000, category: null, day: "08" }),
  ];
  const peringatan = buildBudgetOverspendWarning(
    transaksi[1],
    transaksi,
    [jatahBulanan(1_000_000)],
    "IDR",
  );

  assert.ok(peringatan);
  assert.equal(peringatan.categoryLabel, MONTHLY_BUDGET_LABEL);
  assert.equal(peringatan.amount, 300_000);
});
