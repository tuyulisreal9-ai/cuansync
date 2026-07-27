import {
  DEFAULT_BASE_CURRENCY,
  formatCurrency,
  normalizeCurrencyCode,
} from "../lib/currency.js";
import { getLocalDayKey, getMonthKey } from "../lib/dates.js";
import { resolveTransactionCurrentBaseValue } from "./exchange.js";
import {
  getTransactionAmountValue,
  getTransactionCurrency,
} from "./transactions.js";

export const CATEGORY_OPTIONS = [
  {
    value: "Makan",
    label: "Makan Harian",
    chip:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    bar: "from-emerald-400 to-emerald-500",
  },
  {
    value: "Belanja",
    label: "Belanja Kebutuhan",
    chip: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
    bar: "from-sky-300 to-indigo-500",
  },
  {
    value: "Transport",
    label: "Transport",
    chip:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    bar: "from-amber-300 to-orange-500",
  },
  {
    value: "Tagihan",
    label: "Tagihan",
    chip:
      "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
    bar: "from-violet-300 to-fuchsia-500",
  },
  {
    value: "Kesehatan",
    label: "Kesehatan",
    chip: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    bar: "from-rose-300 to-pink-500",
  },
  {
    value: "Internet",
    label: "Internet & Pulsa",
    chip: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300",
    bar: "from-cyan-300 to-blue-500",
  },
  {
    value: "Tempat Tinggal",
    label: "Tempat Tinggal",
    chip: "bg-lime-100 text-lime-700 dark:bg-lime-500/15 dark:text-lime-300",
    bar: "from-lime-300 to-emerald-500",
  },
  {
    value: "Lainnya",
    label: "Lainnya",
    chip:
      "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
    bar: "from-slate-400 to-slate-700",
  },
];

const CATEGORY_LOOKUP = Object.fromEntries(
  CATEGORY_OPTIONS.map((item) => [item.value, item]),
);

export const DEFAULT_CATEGORY = "Makan";
export const UNIVERSAL_BUDGET_GROUP = "needs";

export function getCategoryMeta(category) {
  return (
    CATEGORY_LOOKUP[category] || {
      value: category || "Lainnya",
      label: category || "Lainnya",
      chip:
        "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
      bar: "from-slate-400 to-slate-700",
    }
  );
}

export function normalizeBudgetCategory(
  category,
  groupKey = UNIVERSAL_BUDGET_GROUP,
) {
  const raw = String(category || groupKey || UNIVERSAL_BUDGET_GROUP).trim();
  return raw || UNIVERSAL_BUDGET_GROUP;
}

export function getBudgetCategoryKey(
  category,
  groupKey = UNIVERSAL_BUDGET_GROUP,
) {
  return normalizeBudgetCategory(category, groupKey).toLowerCase();
}

export function getBudgetCategoryLabel(
  category,
  groupKey = UNIVERSAL_BUDGET_GROUP,
) {
  const normalized = normalizeBudgetCategory(category, groupKey);
  const groupLabels = {
    needs: "Kebutuhan",
    wants: "Gaya hidup",
    invest: "Investasi",
  };
  return groupLabels[normalized] || getCategoryMeta(normalized).label;
}

export function getBudgetCategoryMeta(
  category,
  groupKey = UNIVERSAL_BUDGET_GROUP,
) {
  const normalized = normalizeBudgetCategory(category, groupKey);
  const groupMeta = {
    needs: {
      label: "Kebutuhan",
      chip:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
      bar: "from-emerald-400 to-emerald-500",
    },
    wants: {
      label: "Gaya hidup",
      chip: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
      bar: "from-sky-300 to-indigo-500",
    },
    invest: {
      label: "Investasi",
      chip:
        "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
      bar: "from-violet-300 to-fuchsia-500",
    },
  };
  return groupMeta[normalized] || getCategoryMeta(normalized);
}

export function getDefaultGroupForCategory(category) {
  const value = normalizeBudgetCategory(category);
  if (["Hiburan", "Belanja", "Ngopi", "Hadiah", "Travel"].includes(value)) {
    return "wants";
  }
  if (
    ["Dana Darurat", "Tabungan", "Reksa Dana", "Emas", "Bisnis"].includes(value)
  ) {
    return "invest";
  }
  return UNIVERSAL_BUDGET_GROUP;
}

export function normalizeBudget(
  row,
  baseCurrency = DEFAULT_BASE_CURRENCY,
) {
  const currency = normalizeCurrencyCode(
    row.currency || (row.limit_thb != null ? "THB" : baseCurrency),
  );
  const limitAmount = Number(
    row.limit_amount ?? row.limitAmount ?? row.limit_thb ?? 0,
  );
  const groupKey = row.group_key || getDefaultGroupForCategory(row.category);
  const category = normalizeBudgetCategory(row.category, groupKey);
  const categoryKey = getBudgetCategoryKey(category, groupKey);
  return {
    ...row,
    group_key: groupKey,
    category,
    categoryKey,
    categoryLabel: getBudgetCategoryLabel(category, groupKey),
    currency,
    limit_amount: limitAmount,
    limitAmount,
    limit_thb: Number(
      row.limit_thb ?? (currency === "THB" ? limitAmount : 0) ?? 0,
    ),
  };
}

export function resolveBudgetActivityAmount(
  transaction,
  budgetCurrency,
  baseCurrency = DEFAULT_BASE_CURRENCY,
  globalRateSnapshot = null,
) {
  if (transaction?.type !== "expense") return null;
  const code = normalizeCurrencyCode(budgetCurrency);
  const transactionCurrency = getTransactionCurrency(transaction);
  if (code === transactionCurrency) {
    const amount = getTransactionAmountValue(transaction);
    return amount > 0 ? amount : null;
  }

  const base = normalizeCurrencyCode(baseCurrency);
  if (code === base) {
    const baseAmount = Number(transaction.base_amount || 0);
    if (baseAmount > 0) return baseAmount;
    const fallbackBaseValue = resolveTransactionCurrentBaseValue(
      transaction,
      globalRateSnapshot,
      base,
    );
    return fallbackBaseValue > 0 ? fallbackBaseValue : null;
  }

  return null;
}

export function computeBudgetInsights(
  monthlyExpenses,
  budgets,
  monthKey,
  baseCurrency = DEFAULT_BASE_CURRENCY,
  globalRateSnapshot = null,
) {
  const now = new Date();
  const [year, month] = String(monthKey).split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const isCurrentMonth = monthKey === getMonthKey(now);
  const currentDay = isCurrentMonth ? now.getDate() : daysInMonth;
  const todayDate = new Date(year, month - 1, currentDay);
  const todayKey = getLocalDayKey(todayDate);

  const remainingDaysIncludingToday = Math.max(daysInMonth - currentDay + 1, 1);
  const remainingDaysAfterToday = Math.max(remainingDaysIncludingToday - 1, 0);
  const statusOrder = { over: 0, warning: 1, healthy: 2 };
  const normalizedBaseCurrency = normalizeCurrencyCode(baseCurrency);

  return budgets
    .filter(
      (item) =>
        item.month_key === monthKey &&
        normalizeCurrencyCode(item.currency || normalizedBaseCurrency) ===
          normalizedBaseCurrency,
    )
    .map((item) => normalizeBudget(item, normalizedBaseCurrency))
    .map((budget) => {
      const currency = normalizedBaseCurrency;
      const budgetCategoryKey = getBudgetCategoryKey(
        budget.category,
        budget.group_key,
      );
      const currencyExpenses = monthlyExpenses.filter(
        (item) =>
          item.type === "expense" &&
          Boolean(item.category) &&
          getBudgetCategoryKey(item.category, item.category_group) ===
            budgetCategoryKey &&
          resolveBudgetActivityAmount(
            item,
            currency,
            normalizedBaseCurrency,
            globalRateSnapshot,
          ) != null,
      );
      const spentAmount = currencyExpenses.reduce(
        (sum, item) =>
          sum +
          Number(
            resolveBudgetActivityAmount(
              item,
              currency,
              normalizedBaseCurrency,
              globalRateSnapshot,
            ) || 0,
          ),
        0,
      );
      let spentBeforeToday = 0;
      let spentToday = 0;
      currencyExpenses.forEach((item) => {
        const amount = Number(
          resolveBudgetActivityAmount(
            item,
            currency,
            normalizedBaseCurrency,
            globalRateSnapshot,
          ) || 0,
        );
        const dayKey = getLocalDayKey(item.occurred_at);
        if (dayKey < todayKey) {
          spentBeforeToday += amount;
          return;
        }
        if (dayKey === todayKey) spentToday += amount;
      });

      const limitAmount = Number(budget.limit_amount || budget.limitAmount || 0);
      const remainingAmount = limitAmount - spentAmount;
      const usage = limitAmount > 0 ? spentAmount / limitAmount : 0;
      const baselineDailyLimit = daysInMonth > 0 ? limitAmount / daysInMonth : 0;
      const dynamicDailyLimit =
        remainingDaysIncludingToday > 0
          ? Math.max(
              (limitAmount - spentBeforeToday) / remainingDaysIncludingToday,
              0,
            )
          : 0;
      const todayRemainingSafe = dynamicDailyLimit - spentToday;
      const projectedNextDailyLimit =
        remainingDaysAfterToday > 0
          ? Math.max(
              (limitAmount - spentBeforeToday - spentToday) /
                remainingDaysAfterToday,
              0,
            )
          : 0;
      const dailyAdjustment = dynamicDailyLimit - baselineDailyLimit;

      let status = "healthy";
      let statusLabel = "Aman";
      let tone =
        "border-emerald-300/20 bg-emerald-400/10 text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200";
      let barClass = "from-emerald-400 to-emerald-500";

      if (usage > 1) {
        status = "over";
        statusLabel = "Lewat anggaran bulanan";
        tone =
          "border-rose-300/20 bg-rose-400/10 text-rose-900 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200";
        barClass = "from-rose-400 to-rose-500";
      } else if (todayRemainingSafe < 0) {
        status = "warning";
        statusLabel = "Lewat batas harian";
        tone =
          "border-rose-300/20 bg-rose-400/10 text-rose-900 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200";
        barClass = "from-rose-400 to-rose-500";
      } else if (usage >= 0.85) {
        status = "warning";
        statusLabel = "Mendekati batas";
        tone =
          "border-amber-300/20 bg-amber-400/10 text-amber-900 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200";
        barClass = "from-amber-300 to-orange-500";
      }

      return {
        ...budget,
        group_key:
          budget.group_key || getDefaultGroupForCategory(budget.category),
        category: budget.category,
        categoryKey: budgetCategoryKey,
        categoryLabel: getBudgetCategoryLabel(
          budget.category,
          budget.group_key,
        ),
        currency,
        limitAmount,
        spentAmount,
        remainingAmount,
        usage,
        daysInMonth,
        currentDay,
        remainingDaysIncludingToday,
        remainingDaysAfterToday,
        spentBeforeToday,
        spentToday,
        baselineDailyLimit,
        dynamicDailyLimit,
        todayRemainingSafe,
        projectedNextDailyLimit,
        dailyAdjustment,
        spentThb: currency === "THB" ? spentAmount : 0,
        remainingThb: currency === "THB" ? remainingAmount : 0,
        spentTodayThb: currency === "THB" ? spentToday : 0,
        dynamicDailyLimitThb: currency === "THB" ? dynamicDailyLimit : 0,
        todayRemainingSafeThb: currency === "THB" ? todayRemainingSafe : 0,
        projectedNextDailyLimitThb:
          currency === "THB" ? projectedNextDailyLimit : 0,
        dailyAdjustmentThb: currency === "THB" ? dailyAdjustment : 0,
        status,
        statusLabel,
        tone,
        barClass,
        meta: getBudgetCategoryMeta(budget.category, budget.group_key),
      };
    })
    .sort(
      (a, b) =>
        statusOrder[a.status] - statusOrder[b.status] ||
        a.categoryLabel.localeCompare(b.categoryLabel) ||
        a.currency.localeCompare(b.currency),
    );
}

export function buildBudgetOverspendWarning(
  transaction,
  transactionsForBudget,
  budgets,
  baseCurrency = DEFAULT_BASE_CURRENCY,
  globalRateSnapshot = null,
) {
  if (transaction?.type !== "expense" || !transaction.category) return null;
  const monthKey = getMonthKey(transaction.occurred_at);
  const categoryKey = getBudgetCategoryKey(
    transaction.category,
    transaction.category_group,
  );
  const normalizedBaseCurrency = normalizeCurrencyCode(baseCurrency);
  const insights = computeBudgetInsights(
    transactionsForBudget.filter(
      (item) =>
        item.type === "expense" &&
        getMonthKey(item.occurred_at) === monthKey,
    ),
    budgets,
    monthKey,
    normalizedBaseCurrency,
    globalRateSnapshot,
  );
  const budget = insights.find(
    (item) =>
      item.categoryKey === categoryKey &&
      item.currency === normalizedBaseCurrency &&
      item.remainingAmount < 0,
  );
  if (!budget) return null;
  return {
    categoryLabel: budget.categoryLabel,
    amount: Math.abs(budget.remainingAmount),
    currency: budget.currency,
    message: `Transaksi ini melewati anggaran ${budget.categoryLabel} sebesar ${formatCurrency(
      Math.abs(budget.remainingAmount),
      budget.currency,
    )}.`,
  };
}
