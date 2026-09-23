import {
  DEFAULT_BASE_CURRENCY,
  getCurrencyMeta,
  normalizeCurrencyCode,
} from "../lib/currency.js";
import { getMonthKey } from "../lib/dates.js";
import {
  getBudgetCategoryKey,
  getBudgetCategoryLabel,
  normalizeBudgetCategory,
  normalizeBudgets,
  resolveBudgetActivityAmount,
} from "./budgets.js";

/* Dua mode jatah, satu sumber data.

   Mode simpel menyimpan satu baris jatah untuk sebulan penuh, mode rinci
   menyimpan satu baris per kategori seperti sebelumnya. Modenya tidak
   disimpan sebagai penanda tersendiri melainkan dibaca dari baris yang ada,
   supaya tidak mungkin ada dua sumber kebenaran yang saling bertentangan
   ketika pengguna berpindah mode atau membuka bulan lama. */

export const BUDGET_MODES = Object.freeze({
  simple: "simple",
  category: "category",
  none: "none",
});

/* Tagihan yang biasanya datang sekali sebulan dan nominalnya besar. Dipakai
   untuk menyisihkan jatah supaya angka harian tidak tampak lega di awal bulan
   lalu jatuh begitu sewa dan listrik dibayar. */
export const RECURRING_BILL_CATEGORIES = Object.freeze([
  "Tagihan",
  "Tempat Tinggal",
]);

const RECURRING_BILL_KEYS = new Set(
  RECURRING_BILL_CATEGORIES.map((category) => getBudgetCategoryKey(category)),
);
const BILL_HISTORY_MONTHS = 3;
/* Satu bulan riwayat bukan pola, itu kebetulan. Di bawah dua bulan berisi
   catatan, perkiraan tagihan tidak ditampilkan sama sekali. */
const MIN_BILL_HISTORY_MONTHS = 2;
const SPLIT_HISTORY_MONTHS = 3;

function shiftMonthKey(monthKey, offset) {
  const [year, month] = String(monthKey).split("-").map(Number);
  const shifted = new Date(year, month - 1 + offset, 1);
  const shiftedMonth = String(shifted.getMonth() + 1).padStart(2, "0");
  return `${shifted.getFullYear()}-${shiftedMonth}`;
}

function getRoundingStep(currency) {
  const digits = Number(getCurrencyMeta(currency).fractionDigits);
  /* Rupiah dibulatkan ke ribuan supaya usulan pembagian terbaca seperti angka
     yang memang diketik orang, bukan hasil bagi mentah. */
  return Number.isFinite(digits) && digits > 0 ? 1 : 1000;
}

function getMonthRows(budgets, monthKey, baseCurrency) {
  return normalizeBudgets(budgets, baseCurrency).filter(
    (budget) =>
      budget.month_key === monthKey &&
      normalizeCurrencyCode(budget.baseCurrency || budget.currency) ===
        baseCurrency,
  );
}

function getBudgetAmount(budget) {
  return Number(budget?.baseAmount || budget?.limitAmount || 0);
}

/* Mode bulan berjalan beserta usulan mode untuk bulan yang masih kosong.
   Bulan kosong mengikuti mode bulan sebelumnya supaya pengguna tidak perlu
   memilih ulang tiap tanggal 1. */
export function resolveBudgetMode(
  budgets = [],
  monthKey = getMonthKey(new Date()),
  baseCurrency = DEFAULT_BASE_CURRENCY,
) {
  const base = normalizeCurrencyCode(baseCurrency);
  const rows = getMonthRows(budgets, monthKey, base);
  const monthlyBudget = rows.find((row) => row.scope === "month") || null;
  const categoryBudgets = rows.filter((row) => row.scope !== "month");

  const previousMonthKey = shiftMonthKey(monthKey, -1);
  const previousRows = getMonthRows(budgets, previousMonthKey, base);
  const previousMonthly =
    previousRows.find((row) => row.scope === "month") || null;
  const previousCategories = previousRows.filter((row) => row.scope !== "month");

  const mode = monthlyBudget
    ? BUDGET_MODES.simple
    : categoryBudgets.length
      ? BUDGET_MODES.category
      : BUDGET_MODES.none;

  return {
    mode,
    /* Mode yang ditampilkan ketika bulan ini belum punya jatah sama sekali.
       Pengguna baru mulai dari yang simpel. */
    suggestedMode:
      mode !== BUDGET_MODES.none
        ? mode
        : previousMonthly
          ? BUDGET_MODES.simple
          : previousCategories.length
            ? BUDGET_MODES.category
            : BUDGET_MODES.simple,
    monthlyBudget,
    categoryBudgets,
    previousMonthKey,
    previousMonthlyAmount: previousMonthly
      ? getBudgetAmount(previousMonthly)
      : 0,
    previousCategoryTotal: previousCategories.reduce(
      (sum, budget) => sum + getBudgetAmount(budget),
      0,
    ),
  };
}

function sumMonth(transactions, monthKey, baseCurrency, filter) {
  let amount = 0;
  let hasExpense = false;
  transactions.forEach((item) => {
    if (getMonthKey(item?.occurred_at) !== monthKey) return;
    const value = resolveBudgetActivityAmount(
      item,
      baseCurrency,
      baseCurrency,
      null,
    );
    if (value == null) return;
    hasExpense = true;
    if (filter(item)) amount += value;
  });
  return { amount, hasExpense };
}

function isRecurringBill(item) {
  return (
    Boolean(item?.category) &&
    RECURRING_BILL_KEYS.has(
      getBudgetCategoryKey(item.category, item.category_group),
    )
  );
}

/* Perkiraan tagihan rutin sebulan, dihitung dari catatan pengguna sendiri.
   Ini bukan deteksi tagihan berulang: skema belum membedakannya, jadi yang
   dipakai adalah rata-rata kategori Tagihan dan Tempat Tinggal pada bulan
   bulan terakhir. Bulan tanpa catatan sama sekali tidak ikut dirata-rata,
   karena nol di situ berarti belum dicatat, bukan tidak ada tagihan. */
export function estimateRecurringBills({
  transactions = [],
  monthKey = getMonthKey(new Date()),
  baseCurrency = DEFAULT_BASE_CURRENCY,
} = {}) {
  const base = normalizeCurrencyCode(baseCurrency);
  const months = [];
  for (let offset = 1; offset <= BILL_HISTORY_MONTHS; offset += 1) {
    const key = shiftMonthKey(monthKey, -offset);
    const { amount, hasExpense } = sumMonth(
      transactions,
      key,
      base,
      isRecurringBill,
    );
    if (hasExpense) months.push({ monthKey: key, amount });
  }
  if (months.length < MIN_BILL_HISTORY_MONTHS) return null;

  const amount =
    months.reduce((sum, month) => sum + month.amount, 0) / months.length;
  if (!(amount > 0)) return null;

  const paidThisMonth = sumMonth(
    transactions,
    monthKey,
    base,
    isRecurringBill,
  ).amount;

  return {
    amount,
    monthCount: months.length,
    monthKeys: months.map((month) => month.monthKey),
    paidThisMonth,
    /* Yang perlu disisihkan tinggal sisanya: tagihan yang sudah dibayar bulan
       ini otomatis sudah mengurangi jatah lewat transaksinya sendiri. */
    remaining: Math.max(amount - paidThisMonth, 0),
    categories: [...RECURRING_BILL_CATEGORIES],
  };
}

/* Angka yang ditampilkan mode simpel. Semuanya diturunkan dari satu baris
   jatah bulanan, ditambah dana yang disisihkan untuk tagihan rutin. */
export function buildSimpleBudgetView({ insight, reservedAmount = 0 } = {}) {
  if (!insight) return null;
  const limitAmount = Number(insight.limitAmount || 0);
  const spentAmount = Number(insight.spentAmount || 0);
  const spentBeforeToday = Number(insight.spentBeforeToday || 0);
  const spentToday = Number(insight.spentToday || 0);
  const remainingDays = Math.max(
    Number(insight.remainingDaysIncludingToday || 1),
    1,
  );
  const reserved = Math.max(Number(reservedAmount || 0), 0);
  const remainingAmount = limitAmount - spentAmount;
  const dailyLimit = Math.max(
    (limitAmount - spentBeforeToday - reserved) / remainingDays,
    0,
  );

  return {
    status: insight.status || "healthy",
    limitAmount,
    spentAmount,
    remainingAmount,
    reservedAmount: reserved,
    /* Sisa yang benar benar bebas dipakai setelah tagihan disisihkan. Bisa
       negatif, dan memang harus terlihat negatif. */
    spendableRemaining: remainingAmount - reserved,
    dailyLimit,
    todayRemaining: dailyLimit - spentToday,
    spentToday,
    remainingDays,
    usage: limitAmount > 0 ? spentAmount / limitAmount : 0,
  };
}

/* Usulan pembagian jatah per kategori dari pola belanja pengguna sendiri.
   Tanpa riwayat tidak ada usulan sama sekali: persentase karangan pada layar
   keuangan lebih berbahaya daripada kolom kosong. */
export function suggestCategorySplit({
  transactions = [],
  monthKey = getMonthKey(new Date()),
  baseCurrency = DEFAULT_BASE_CURRENCY,
  totalAmount = 0,
} = {}) {
  const base = normalizeCurrencyCode(baseCurrency);
  const total = Number(totalAmount || 0);
  if (!(total > 0)) return null;

  const buckets = new Map();
  const monthsWithData = new Set();
  let historyTotal = 0;

  for (let offset = 1; offset <= SPLIT_HISTORY_MONTHS; offset += 1) {
    const key = shiftMonthKey(monthKey, -offset);
    transactions.forEach((item) => {
      if (getMonthKey(item?.occurred_at) !== key) return;
      if (!item?.category) return;
      const value = resolveBudgetActivityAmount(item, base, base, null);
      if (value == null) return;

      const category = normalizeBudgetCategory(
        item.category,
        item.category_group,
      );
      const categoryKey = getBudgetCategoryKey(category);
      const bucket = buckets.get(categoryKey) || {
        category,
        categoryKey,
        label: getBudgetCategoryLabel(category),
        amount: 0,
      };
      bucket.amount += value;
      buckets.set(categoryKey, bucket);
      monthsWithData.add(key);
      historyTotal += value;
    });
  }

  if (!monthsWithData.size || !(historyTotal > 0)) return null;

  const step = getRoundingStep(base);
  const rows = [...buckets.values()]
    .map((bucket) => ({ ...bucket, share: bucket.amount / historyTotal }))
    .sort((a, b) => b.share - a.share)
    .map((row) => ({
      category: row.category,
      categoryKey: row.categoryKey,
      label: row.label,
      share: row.share,
      amount: Math.max(Math.round((row.share * total) / step) * step, 0),
    }))
    .filter((row) => row.amount > 0);

  if (!rows.length) return null;

  /* Pembulatan membuat jumlahnya meleset sedikit. Selisihnya ditambahkan ke
     porsi terbesar supaya totalnya persis sama dengan jatah yang diisi. */
  const rounded = rows.reduce((sum, row) => sum + row.amount, 0);
  rows[0].amount += total - rounded;
  if (!(rows[0].amount > 0)) return null;

  return {
    rows,
    total,
    monthCount: monthsWithData.size,
    monthKeys: [...monthsWithData].sort(),
  };
}
