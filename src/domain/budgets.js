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
import {
  CATEGORY_OPTIONS,
  DEFAULT_CATEGORY,
  UNIVERSAL_BUDGET_GROUP,
  getDefaultCategoryGroup,
  getExpenseCategoryKey,
  getExpenseCategoryLabel,
  getExpenseCategoryMeta,
  normalizeExpenseCategory,
} from "./categories.js";

export {
  CATEGORY_OPTIONS,
  DEFAULT_CATEGORY,
  UNIVERSAL_BUDGET_GROUP,
} from "./categories.js";

export const getCategoryMeta = getExpenseCategoryMeta;

export function normalizeBudgetCategory(
  category,
  groupKey = UNIVERSAL_BUDGET_GROUP,
) {
  return normalizeExpenseCategory(category || groupKey, "Lainnya");
}

export function getBudgetCategoryKey(
  category,
  groupKey = UNIVERSAL_BUDGET_GROUP,
) {
  return getExpenseCategoryKey(
    normalizeBudgetCategory(category, groupKey),
  );
}

export function getBudgetCategoryLabel(
  category,
  groupKey = UNIVERSAL_BUDGET_GROUP,
) {
  return getExpenseCategoryLabel(
    normalizeBudgetCategory(category, groupKey),
  );
}

export function getBudgetCategoryMeta(
  category,
  groupKey = UNIVERSAL_BUDGET_GROUP,
) {
  return getExpenseCategoryMeta(
    normalizeBudgetCategory(category, groupKey),
  );
}

export function getDefaultGroupForCategory(category) {
  return getDefaultCategoryGroup(category);
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
  const sourceCategory = row.category || row.group_key;
  const category = normalizeBudgetCategory(sourceCategory, row.group_key);
  const groupKey = getDefaultGroupForCategory(category);
  const categoryKey = getBudgetCategoryKey(category, groupKey);
  return {
    ...row,
    source_category: row.source_category || sourceCategory || null,
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

function isCanonicalBudgetSource(budget) {
  return (
    String(budget.source_category || "").trim().toLocaleLowerCase("id-ID") ===
    String(budget.category || "").trim().toLocaleLowerCase("id-ID")
  );
}

export function normalizeBudgets(
  rows = [],
  baseCurrency = DEFAULT_BASE_CURRENCY,
) {
  const groups = new Map();

  rows.map((row) => normalizeBudget(row, baseCurrency)).forEach((budget) => {
    const key = [
      budget.user_id || "",
      budget.month_key || "",
      budget.currency,
      budget.categoryKey,
    ].join("|");
    const current = groups.get(key);
    const sourceBudgetIds = budget.id ? [budget.id] : [];
    if (!current) {
      groups.set(key, {
        ...budget,
        sourceBudgetIds,
        mergedBudgetCount: 1,
      });
      return;
    }

    const currentLimit = Number(current.limitAmount || 0);
    const nextLimit = Number(budget.limitAmount || 0);
    const preferred =
      !isCanonicalBudgetSource(current) && isCanonicalBudgetSource(budget)
        ? budget
        : current;
    groups.set(key, {
      ...preferred,
      category: budget.category,
      categoryKey: budget.categoryKey,
      categoryLabel: budget.categoryLabel,
      group_key: budget.group_key,
      currency: budget.currency,
      limit_amount: currentLimit + nextLimit,
      limitAmount: currentLimit + nextLimit,
      limit_thb:
        budget.currency === "THB" ? currentLimit + nextLimit : 0,
      sourceBudgetIds: [
        ...new Set([
          ...(current.sourceBudgetIds || []),
          ...sourceBudgetIds,
        ]),
      ],
      mergedBudgetCount:
        Number(current.mergedBudgetCount || 1) + 1,
    });
  });

  return [...groups.values()];
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

  return normalizeBudgets(budgets, normalizedBaseCurrency)
    .filter(
      (item) =>
        item.month_key === monthKey &&
        normalizeCurrencyCode(item.currency || normalizedBaseCurrency) ===
          normalizedBaseCurrency,
    )
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
