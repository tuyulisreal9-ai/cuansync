import {
  DEFAULT_BASE_CURRENCY,
  formatCurrency,
  normalizeCurrencyCode,
} from "../lib/currency.js";
import { getGlobalRateForCurrency } from "../lib/exchangeRates.js";
import { getLocalDayKey, getMonthKey } from "../lib/dates.js";
import {
  resolveTransactionFeeHistoricalBaseValue,
  resolveTransactionHistoricalBaseValue,
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

export function calculateBudgetBaseAmount({
  inputAmount,
  inputCurrency,
  baseCurrency = DEFAULT_BASE_CURRENCY,
  planningRate,
}) {
  const amount = Number(inputAmount || 0);
  const rate = Number(planningRate || 0);
  const inputCode = normalizeCurrencyCode(inputCurrency, baseCurrency);
  const baseCode = normalizeCurrencyCode(baseCurrency);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (inputCode === baseCode) return amount;
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return amount * rate;
}

export function resolveAutomaticBudgetRate(
  snapshot,
  inputCurrency,
  baseCurrency = DEFAULT_BASE_CURRENCY,
) {
  const inputCode = normalizeCurrencyCode(inputCurrency, baseCurrency);
  const baseCode = normalizeCurrencyCode(baseCurrency);
  if (inputCode === baseCode) {
    return {
      rate: 1,
      source: "base",
      rateDate: null,
      rateFromCurrency: inputCode,
      rateToCurrency: baseCode,
    };
  }

  const rateInfo = getGlobalRateForCurrency(
    snapshot,
    inputCode,
    baseCode,
  );
  const rate = Number(rateInfo.rate || 0);
  return {
    rate: rate > 0 ? rate : 0,
    source: rate > 0 ? "automatic" : null,
    rateDate:
      snapshot?.sourceDate ||
      snapshot?.source_date ||
      snapshot?.fetchedAt ||
      snapshot?.fetched_at ||
      null,
    rateFromCurrency: inputCode,
    rateToCurrency: baseCode,
  };
}

function getBudgetLegacyLimit(row) {
  return Number(
    row.limit_amount ?? row.limitAmount ?? row.limit_thb ?? 0,
  );
}

export function normalizeBudget(
  row,
  baseCurrency = DEFAULT_BASE_CURRENCY,
) {
  const normalizedBaseCurrency = normalizeCurrencyCode(baseCurrency);
  const legacyCurrency = normalizeCurrencyCode(
    row.currency || (row.limit_thb != null ? "THB" : baseCurrency),
  );
  const inputCurrency = normalizeCurrencyCode(
    row.input_currency ?? row.inputCurrency ?? legacyCurrency,
    normalizedBaseCurrency,
  );
  const officialBaseCurrency = normalizeCurrencyCode(
    row.base_currency ?? row.baseCurrency ?? normalizedBaseCurrency,
    normalizedBaseCurrency,
  );
  const legacyLimit = getBudgetLegacyLimit(row);
  const inputAmount = Number(
    row.input_amount ?? row.inputAmount ?? legacyLimit,
  );
  const explicitBaseAmount =
    row.base_amount ?? row.baseAmount ?? null;
  const baseAmount =
    explicitBaseAmount != null
      ? Number(explicitBaseAmount)
      : legacyCurrency === officialBaseCurrency
        ? legacyLimit
        : inputCurrency === officialBaseCurrency
          ? inputAmount
          : 0;
  const planningRate = Number(
    row.planning_rate ??
      row.planningRate ??
      (inputCurrency === officialBaseCurrency
        ? 1
        : inputAmount > 0 && baseAmount > 0
          ? baseAmount / inputAmount
          : 0),
  );
  const sourceCategory = row.category || row.group_key;
  const category = normalizeBudgetCategory(sourceCategory, row.group_key);
  const groupKey = getDefaultGroupForCategory(category);
  const categoryKey = getBudgetCategoryKey(category, groupKey);
  const hasExplicitPlanningFields =
    row.input_amount != null ||
    row.inputAmount != null ||
    row.base_amount != null ||
    row.baseAmount != null ||
    row.planning_rate != null ||
    row.planningRate != null;
  const rateSource =
    row.rate_source ??
    row.rateSource ??
    (inputCurrency === officialBaseCurrency
      ? hasExplicitPlanningFields
        ? "base"
        : "legacy"
      : planningRate > 0
        ? "legacy"
        : "missing");
  return {
    ...row,
    source_category: row.source_category || sourceCategory || null,
    group_key: groupKey,
    category,
    categoryKey,
    categoryLabel: getBudgetCategoryLabel(category, groupKey),
    currency: officialBaseCurrency,
    legacy_currency: legacyCurrency,
    input_currency: inputCurrency,
    inputCurrency,
    input_amount: inputAmount,
    inputAmount,
    base_currency: officialBaseCurrency,
    baseCurrency: officialBaseCurrency,
    base_amount: baseAmount,
    baseAmount,
    planning_rate: planningRate,
    planningRate,
    rate_source: rateSource,
    rateSource,
    rate_date: row.rate_date ?? row.rateDate ?? row.created_at ?? null,
    rateDate: row.rate_date ?? row.rateDate ?? row.created_at ?? null,
    rate_from_currency: normalizeCurrencyCode(
      row.rate_from_currency ?? row.rateFromCurrency ?? inputCurrency,
      inputCurrency,
    ),
    rateFromCurrency: normalizeCurrencyCode(
      row.rate_from_currency ?? row.rateFromCurrency ?? inputCurrency,
      inputCurrency,
    ),
    rate_to_currency: normalizeCurrencyCode(
      row.rate_to_currency ?? row.rateToCurrency ?? officialBaseCurrency,
      officialBaseCurrency,
    ),
    rateToCurrency: normalizeCurrencyCode(
      row.rate_to_currency ?? row.rateToCurrency ?? officialBaseCurrency,
      officialBaseCurrency,
    ),
    limit_amount: baseAmount,
    limitAmount: baseAmount,
    limit_thb: Number(
      row.limit_thb ??
        (officialBaseCurrency === "THB" ? baseAmount : 0) ??
        0,
    ),
    hasPlanningSnapshot:
      inputCurrency === officialBaseCurrency ||
      (inputAmount > 0 && baseAmount > 0 && planningRate > 0),
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

    const currentLimit = Number(current.baseAmount || 0);
    const nextLimit = Number(budget.baseAmount || 0);
    const preferred =
      !isCanonicalBudgetSource(current) && isCanonicalBudgetSource(budget)
        ? budget
        : current;
    const sameInputCurrency =
      current.inputCurrency === budget.inputCurrency;
    const mergedBaseAmount = currentLimit + nextLimit;
    const mergedInputAmount = sameInputCurrency
      ? Number(current.inputAmount || 0) + Number(budget.inputAmount || 0)
      : mergedBaseAmount;
    const mergedInputCurrency = sameInputCurrency
      ? current.inputCurrency
      : budget.baseCurrency;
    groups.set(key, {
      ...preferred,
      category: budget.category,
      categoryKey: budget.categoryKey,
      categoryLabel: budget.categoryLabel,
      group_key: budget.group_key,
      currency: budget.baseCurrency,
      input_currency: mergedInputCurrency,
      inputCurrency: mergedInputCurrency,
      input_amount: mergedInputAmount,
      inputAmount: mergedInputAmount,
      base_currency: budget.baseCurrency,
      baseCurrency: budget.baseCurrency,
      base_amount: mergedBaseAmount,
      baseAmount: mergedBaseAmount,
      planning_rate:
        mergedInputAmount > 0 ? mergedBaseAmount / mergedInputAmount : 0,
      planningRate:
        mergedInputAmount > 0 ? mergedBaseAmount / mergedInputAmount : 0,
      rate_source: sameInputCurrency ? preferred.rateSource : "legacy",
      rateSource: sameInputCurrency ? preferred.rateSource : "legacy",
      limit_amount: mergedBaseAmount,
      limitAmount: mergedBaseAmount,
      limit_thb:
        budget.baseCurrency === "THB" ? mergedBaseAmount : 0,
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
  _budgetCurrency,
  baseCurrency = DEFAULT_BASE_CURRENCY,
  _globalRateSnapshot = null,
) {
  const base = normalizeCurrencyCode(baseCurrency);
  if (transaction?.type === "expense") {
    const historicalBaseValue = resolveTransactionHistoricalBaseValue(
      transaction,
      base,
    );
    return historicalBaseValue != null && historicalBaseValue > 0
      ? historicalBaseValue
      : null;
  }

  if (
    transaction?.type === "exchange" &&
    transaction.category &&
    Number(transaction.fee_amount || 0) > 0
  ) {
    const feeBaseValue = resolveTransactionFeeHistoricalBaseValue(
      transaction,
      base,
    );
    return feeBaseValue != null && feeBaseValue > 0
      ? feeBaseValue
      : null;
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
        normalizeCurrencyCode(item.baseCurrency || item.currency) ===
          normalizedBaseCurrency,
    )
    .map((budget) => {
      const currency = normalizedBaseCurrency;
      const budgetCategoryKey = getBudgetCategoryKey(
        budget.category,
        budget.group_key,
      );
      const budgetActivities = monthlyExpenses.filter(
        (item) =>
          ["expense", "exchange"].includes(item.type) &&
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
      const spentAmount = budgetActivities.reduce(
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
      const transactionCount = budgetActivities.length;
      let spentBeforeToday = 0;
      let spentToday = 0;
      budgetActivities.forEach((item) => {
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

      const limitAmount = Number(
        budget.baseAmount || budget.base_amount || budget.limitAmount || 0,
      );
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
        transactionCount,
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
  if (
    !["expense", "exchange"].includes(transaction?.type) ||
    !transaction.category
  ) {
    return null;
  }
  const monthKey = getMonthKey(transaction.occurred_at);
  const categoryKey = getBudgetCategoryKey(
    transaction.category,
    transaction.category_group,
  );
  const normalizedBaseCurrency = normalizeCurrencyCode(baseCurrency);
  const insights = computeBudgetInsights(
    transactionsForBudget.filter(
      (item) =>
        ["expense", "exchange"].includes(item.type) &&
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
