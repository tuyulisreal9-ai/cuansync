import { getMonthKey } from "../lib/dates.js";
import {
  DEFAULT_BASE_CURRENCY,
  normalizeCurrencyCode,
} from "../lib/currency.js";
import {
  getBudgetCategoryKey,
  getBudgetCategoryLabel,
  resolveBudgetActivityAmount,
} from "./budgets.js";

/* Rincian ke mana uang keluar bulan ini, per kategori.

   Sengaja tidak memakai metrics.categoryBreakdown yang sudah ada. Rincian itu
   menilai transaksi valas dengan kurs saat ini, sedangkan baris jatah memakai
   kurs historis lewat resolveBudgetActivityAmount. Kalau keduanya ditaruh
   berdampingan dengan cara hitung yang berbeda, angka kategori yang sama akan
   tampil dua nilai dan itu terbaca sebagai bug, bukan sebagai dua sudut
   pandang. Di sini dipakai fungsi yang sama persis dengan baris jatah.

   Gunanya menutup titik buta: BudgetSection hanya membaca budgetInsights,
   jadi belanja di kategori yang belum punya jatah tidak terlihat sama sekali
   di halaman Jatah. */

export const UNCATEGORIZED_KEY = "__tanpa_kategori__";

export function buildSpendingBreakdown({
  transactions = [],
  budgetInsights = [],
  baseCurrency = DEFAULT_BASE_CURRENCY,
  monthKey = getMonthKey(new Date()),
  limit = 6,
} = {}) {
  const base = normalizeCurrencyCode(baseCurrency);
  const berjatah = new Set(
    budgetInsights
      .filter(
        (budget) =>
          normalizeCurrencyCode(
            budget.baseCurrency || budget.base_currency || budget.currency,
          ) === base,
      )
      .map((budget) => budget.categoryKey),
  );

  const ember = new Map();
  let total = 0;

  transactions.forEach((item) => {
    if (getMonthKey(item?.occurred_at) !== monthKey) return;
    const nilai = resolveBudgetActivityAmount(item, base, base, null);
    if (nilai == null || !(nilai > 0)) return;

    /* computeBudgetInsights menyaring Boolean(item.category), jadi belanja
       tanpa kategori tidak pernah masuk hitungan jatah mana pun. Dipisah ke
       embernya sendiri supaya tidak salah dihitung sebagai kategori yang
       sudah punya jatah. */
    const tanpaKategori = !item?.category;
    const key = tanpaKategori
      ? UNCATEGORIZED_KEY
      : getBudgetCategoryKey(item.category, item.category_group);
    const label = tanpaKategori
      ? "Tanpa kategori"
      : getBudgetCategoryLabel(item.category, item.category_group);

    if (!ember.has(key)) {
      ember.set(key, {
        key,
        label,
        amount: 0,
        count: 0,
        hasBudget: tanpaKategori ? false : berjatah.has(key),
      });
    }
    const baris = ember.get(key);
    baris.amount += nilai;
    baris.count += 1;
    total += nilai;
  });

  const semua = [...ember.values()]
    .map((baris) => ({
      ...baris,
      share: total > 0 ? baris.amount / total : 0,
    }))
    .sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label));

  const rows = semua.slice(0, limit);
  const sisa = semua.slice(limit);
  const tanpaJatah = semua.filter((baris) => !baris.hasBudget);

  return {
    total,
    rows,
    /* Sisanya diringkas, bukan dibuang, supaya jumlah baris yang tampil tidak
       membuat totalnya terlihat tidak nyambung. */
    rest: {
      count: sisa.length,
      amount: sisa.reduce((sum, baris) => sum + baris.amount, 0),
    },
    unbudgeted: {
      count: tanpaJatah.length,
      amount: tanpaJatah.reduce((sum, baris) => sum + baris.amount, 0),
      share:
        total > 0
          ? tanpaJatah.reduce((sum, baris) => sum + baris.amount, 0) / total
          : 0,
    },
    hasData: total > 0,
  };
}
