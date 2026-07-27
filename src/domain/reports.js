import { computeBudgetInsights, getCategoryMeta, normalizeBudget } from "./budgets.js";
import { getExchangeBaseVolume, getLatestRateForCurrencyUntil } from "./exchange.js";
import {
  getTransactionAmountValue,
  getTransactionCurrency,
  orderTransactions,
  resolveTransactionBaseValue,
} from "./transactions.js";
import {
  DEFAULT_BASE_CURRENCY,
  normalizeCurrencyCode,
  normalizeCurrencyList,
} from "../lib/currency.js";
import {
  formatDay,
  getLocalDayKey,
  getMonthKey,
  getMonthMeta,
  shiftMonthKey,
} from "../lib/dates.js";

export function getAvailableReportMonths(transactions, selectedMonthKey) {
  const months = new Set([selectedMonthKey, getMonthKey(new Date())]);
  transactions.forEach((transaction) => {
    if (transaction.occurred_at) {
      months.add(getMonthKey(transaction.occurred_at));
    }
  });

  return [...months].sort((a, b) => b.localeCompare(a));
}

export function getLatestReportRateUntil(transactions, endDate, baseCurrency = DEFAULT_BASE_CURRENCY) {
  return getLatestRateForCurrencyUntil(
    transactions,
    "THB",
    endDate,
    baseCurrency,
  );
}

function resolveReportValueIdr(transaction, rateSource = 0, baseCurrency = DEFAULT_BASE_CURRENCY) {
  const fallbackRate = Array.isArray(rateSource)
    ? getLatestRateForCurrencyUntil(
        rateSource,
        getTransactionCurrency(transaction),
        new Date(transaction.occurred_at || Date.now()),
        baseCurrency,
      )
    : Number(rateSource || 0);
  return resolveTransactionBaseValue(transaction, fallbackRate);
}

function addCurrencyTotal(target, currency, amount) {
  const code = normalizeCurrencyCode(currency);
  target[code] = Number(target[code] || 0) + Number(amount || 0);
}

function getReportExchangeVolumeIdr(transaction, transactions, fallbackRate = 0, baseCurrency = DEFAULT_BASE_CURRENCY) {
  if (transaction.type !== "exchange") return 0;
  const rate =
    Number(fallbackRate || 0) ||
    getLatestRateForCurrencyUntil(
      transactions,
      normalizeCurrencyCode(transaction.from_currency),
      new Date(transaction.occurred_at || Date.now()),
      baseCurrency,
    );
  return getExchangeBaseVolume(transaction, rate);
}

function summarizeReportMonth(transactions, monthKey, baseCurrency = DEFAULT_BASE_CURRENCY) {
  const monthTransactions = orderTransactions(transactions).filter(
    (item) => getMonthKey(item.occurred_at) === monthKey,
  );

  return monthTransactions.reduce(
    (summary, transaction) => {
      const valueIdr = resolveReportValueIdr(transaction, transactions, baseCurrency);
      const currency = getTransactionCurrency(transaction);
      const amount = getTransactionAmountValue(transaction);

      if (transaction.type === "income") {
        summary.externalIncomeIdr += valueIdr;
        addCurrencyTotal(summary.incomeByCurrency, currency, amount);
        if (currency !== baseCurrency && valueIdr <= 0) {
          summary.unvaluedIncomeCount += 1;
        }
      }

      if (transaction.type === "exchange") {
        const fromCurrency = normalizeCurrencyCode(transaction.from_currency);
        const toCurrency = normalizeCurrencyCode(transaction.to_currency);
        const fromAmount = Math.abs(Number(transaction.from_amount || 0));
        const toAmount = Math.abs(Number(transaction.to_amount || 0));
        const volumeIdr = getReportExchangeVolumeIdr(transaction, transactions, 0, baseCurrency);
        const pairKey = `${fromCurrency}->${toCurrency}`;

        addCurrencyTotal(summary.exchangeOutByCurrency, fromCurrency, fromAmount);
        addCurrencyTotal(summary.exchangeInByCurrency, toCurrency, toAmount);
        summary.exchangePairs[pairKey] = summary.exchangePairs[pairKey] || {
          key: pairKey,
          fromCurrency,
          toCurrency,
          fromAmount: 0,
          toAmount: 0,
          volumeIdr: 0,
          count: 0,
        };
        summary.exchangePairs[pairKey].fromAmount += fromAmount;
        summary.exchangePairs[pairKey].toAmount += toAmount;
        summary.exchangePairs[pairKey].volumeIdr += volumeIdr;
        summary.exchangePairs[pairKey].count += 1;
        summary.exchangeVolumeIdr += volumeIdr;
        summary.exchangeCount += 1;
        if (toCurrency !== baseCurrency) {
          addCurrencyTotal(summary.foreignReceivedByCurrency, toCurrency, toAmount);
          summary.foreignExchangeCostIdr += volumeIdr;
        }
        if (toCurrency === "THB") {
          summary.thbReceived += toAmount;
          summary.thbTopupCostIdr += volumeIdr;
        } else if (fromCurrency === "THB") {
          summary.thbReceived -= fromAmount;
        }
      }

      if (transaction.type === "expense") {
        summary.expenseIdr += valueIdr;
        addCurrencyTotal(summary.expenseByCurrency, currency, amount);
        if (currency === "THB") {
          summary.expenseThb += amount;
        }
        if (currency !== baseCurrency && valueIdr <= 0) {
          summary.unvaluedExpenseCount += 1;
        }
        if (currency !== baseCurrency) {
          summary.foreignExpenseValueIdr += valueIdr;
        } else {
          summary.directExpenseIdr += valueIdr;
        }
      }

      summary.count += 1;
      summary.netCashflowIdr = summary.externalIncomeIdr - summary.expenseIdr;
      return summary;
    },
    {
      monthKey,
      count: 0,
      externalIncomeIdr: 0,
      expenseIdr: 0,
      directExpenseIdr: 0,
      foreignExpenseValueIdr: 0,
      expenseThb: 0,
      thbReceived: 0,
      thbTopupCostIdr: 0,
      incomeByCurrency: {},
      expenseByCurrency: {},
      exchangeInByCurrency: {},
      exchangeOutByCurrency: {},
      exchangePairs: {},
      foreignReceivedByCurrency: {},
      foreignExchangeCostIdr: 0,
      exchangeVolumeIdr: 0,
      exchangeCount: 0,
      unvaluedIncomeCount: 0,
      unvaluedExpenseCount: 0,
      netCashflowIdr: 0,
    },
  );
}

function buildReportDailySeries(transactions, monthKey, baseCurrency = DEFAULT_BASE_CURRENCY) {
  const meta = getMonthMeta(monthKey);
  const days = [];

  for (let day = 1; day <= meta.daysInMonth; day += 1) {
    const date = new Date(meta.year, meta.month - 1, day);
    days.push({
      key: getLocalDayKey(date),
      label: String(day).padStart(2, "0"),
      tooltipLabel: formatDay(date),
      incomeIdr: 0,
      expenseIdr: 0,
      netIdr: 0,
      transactionCount: 0,
    });
  }

  const map = new Map(days.map((item) => [item.key, item]));
  transactions
    .filter((transaction) => getMonthKey(transaction.occurred_at) === monthKey)
    .forEach((transaction) => {
      const bucket = map.get(getLocalDayKey(transaction.occurred_at));
      if (!bucket) return;

      const valueIdr = resolveReportValueIdr(transaction, transactions, baseCurrency);
      const isIncome = transaction.type === "income";

      if (isIncome) bucket.incomeIdr += valueIdr;
      if (transaction.type === "expense") bucket.expenseIdr += valueIdr;
      bucket.netIdr = bucket.incomeIdr - bucket.expenseIdr;
      bucket.transactionCount += 1;
    });

  return days;
}

export function buildMonthlyReport(transactions, budgets, selectedMonthKey, baseCurrency = DEFAULT_BASE_CURRENCY) {
  const monthKey = selectedMonthKey || getMonthKey(new Date());
  const meta = getMonthMeta(monthKey);
  const previousMonthKey = shiftMonthKey(monthKey, -1);
  const fallbackRate = getLatestReportRateUntil(transactions, meta.end, baseCurrency);
  const summary = summarizeReportMonth(transactions, monthKey, baseCurrency);
  const previousSummary = summarizeReportMonth(
    transactions,
    previousMonthKey,
    baseCurrency,
  );
  const monthTransactions = orderTransactions(transactions).filter(
    (item) => getMonthKey(item.occurred_at) === monthKey,
  );
  const expenseTransactions = monthTransactions.filter(
    (item) => item.type === "expense",
  );
  const dailySeries = buildReportDailySeries(transactions, monthKey, baseCurrency);
  const categoryAccumulator = {};

  expenseTransactions.forEach((transaction) => {
    const category = transaction.category || "Lainnya";
    const valueIdr = resolveReportValueIdr(transaction, transactions, baseCurrency);
    const currency = getTransactionCurrency(transaction);
    if (!categoryAccumulator[category]) {
      categoryAccumulator[category] = {
        valueIdr: 0,
        valueThb: 0,
        valueByCurrency: {},
        count: 0,
      };
    }

    categoryAccumulator[category].valueIdr += valueIdr;
    addCurrencyTotal(categoryAccumulator[category].valueByCurrency, currency, getTransactionAmountValue(transaction));
    categoryAccumulator[category].valueThb +=
      currency === "THB"
        ? getTransactionAmountValue(transaction)
        : 0;
    categoryAccumulator[category].count += 1;
  });

  const categoryBreakdown = Object.entries(categoryAccumulator)
    .map(([category, data]) => ({
      key: category,
      label: getCategoryMeta(category).label,
      meta: getCategoryMeta(category),
      valueIdr: data.valueIdr,
      valueThb: data.valueThb,
      valueByCurrency: data.valueByCurrency,
      count: data.count,
      share: summary.expenseIdr > 0 ? data.valueIdr / summary.expenseIdr : 0,
    }))
    .sort((a, b) => b.valueIdr - a.valueIdr);

  const budgetInsights = computeBudgetInsights(
    expenseTransactions,
    budgets,
    monthKey,
    baseCurrency,
  );
  const budgetBaseValues = budgetInsights.map((budget) => {
    const rate = getLatestRateForCurrencyUntil(
      transactions,
      budget.currency,
      meta.end,
      baseCurrency,
    );
    return {
      limitBase:
        budget.currency === baseCurrency
          ? budget.limitAmount
          : rate > 0
            ? budget.limitAmount * rate
            : 0,
      spentBase:
        budget.currency === baseCurrency
          ? budget.spentAmount
          : rate > 0
            ? budget.spentAmount * rate
            : 0,
    };
  });
  const budgetLimitBaseIdr = budgetBaseValues.reduce(
    (sum, item) => sum + Number(item.limitBase || 0),
    0,
  );
  const budgetSpentBaseIdr = budgetBaseValues.reduce(
    (sum, item) => sum + Number(item.spentBase || 0),
    0,
  );
  const budgetRemainingBaseIdr = budgetLimitBaseIdr - budgetSpentBaseIdr;
  const budgetUsage =
    budgetLimitBaseIdr > 0
      ? budgetSpentBaseIdr / budgetLimitBaseIdr
      : budgetInsights.length
        ? Math.max(...budgetInsights.map((budget) => budget.usage))
        : 0;
  const thbBudget = budgetInsights.find((budget) => budget.currency === "THB");
  const budgetLimitThb = Number(thbBudget?.limitAmount || 0);
  const budgetSpentThb = Number(thbBudget?.spentAmount || 0);
  const budgetRemainingThb = Number(thbBudget?.remainingAmount || 0);
  const budgetStatus =
    !budgetInsights.length
      ? "none"
      : budgetInsights.some((budget) => budget.status === "over")
        ? "over"
        : budgetInsights.some((budget) => budget.status === "warning")
          ? "warning"
          : "safe";
  const budgetStatusLabel =
    budgetStatus === "none"
      ? "Belum ada anggaran"
      : budgetStatus === "over"
        ? "Melewati batas"
        : budgetStatus === "warning"
          ? "Hati-hati"
          : "Aman";
  const dailyAverageExpenseIdr =
    meta.elapsedDays > 0 ? summary.expenseIdr / meta.elapsedDays : 0;
  const projectedExpenseIdr = meta.isCurrentMonth
    ? dailyAverageExpenseIdr * meta.daysInMonth
    : summary.expenseIdr;
  const savingsRatio =
    summary.externalIncomeIdr > 0
      ? summary.netCashflowIdr / summary.externalIncomeIdr
      : 0;
  const previousDeltaIdr =
    previousSummary.count > 0
      ? summary.netCashflowIdr - previousSummary.netCashflowIdr
      : null;
  const strongestDay = [...dailySeries].sort(
    (a, b) => b.expenseIdr - a.expenseIdr,
  )[0];
  const topCategory = categoryBreakdown[0] || null;
  const recentTransactions = [...monthTransactions].reverse().slice(0, 5);
  const reportCurrencies = normalizeCurrencyList(
    [
      ...Object.keys(summary.incomeByCurrency),
      ...Object.keys(summary.expenseByCurrency),
      ...Object.keys(summary.exchangeInByCurrency),
      ...Object.keys(summary.exchangeOutByCurrency),
      ...budgets.map(
        (budget) => normalizeBudget(budget, baseCurrency).currency,
      ),
    ],
    { baseCurrency },
  );
  const currencyBreakdown = reportCurrencies.map((currency) => ({
    currency,
    income: Number(summary.incomeByCurrency[currency] || 0),
    expense: Number(summary.expenseByCurrency[currency] || 0),
    exchangeIn: Number(summary.exchangeInByCurrency[currency] || 0),
    exchangeOut: Number(summary.exchangeOutByCurrency[currency] || 0),
  }));

  return {
    monthKey,
    previousMonthKey,
    meta,
    fallbackRate,
    summary,
    previousSummary,
    previousDeltaIdr,
    dailySeries,
    categoryBreakdown,
    topCategory,
    strongestDay,
    recentTransactions,
    currencyBreakdown,
    exchangePairs: Object.values(summary.exchangePairs),
    budgetInsights,
    budgetLimitBaseIdr,
    budgetSpentBaseIdr,
    budgetRemainingBaseIdr,
    budgetLimitThb,
    budgetSpentThb,
    budgetUsage,
    budgetRemainingThb,
    budgetStatus,
    budgetStatusLabel,
    dailyAverageExpenseIdr,
    projectedExpenseIdr,
    savingsRatio,
    hasTransactions: monthTransactions.length > 0,
  };
}
