import {
  getTransactionAmountValue,
  getTransactionCurrency,
  getTransactionFlow,
  resolveTransactionFeeHistoricalBaseValue,
  resolveTransactionHistoricalBaseValue,
} from "../../domain/transactions.js";
import {
  DEFAULT_BASE_CURRENCY,
  normalizeCurrencyCode,
} from "../../lib/currency.js";
import {
  formatDay,
  formatLongDate,
  formatMonthKey,
  formatShortTime,
  getLocalDayKey,
  getMonthKey,
} from "../../lib/dates.js";
import {
  getTransactionCategoryLabel,
  getTransactionDisplayTitle,
  getTransactionTypeLabel,
} from "./presentation.js";

const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidStatementMonthKey(value) {
  return MONTH_KEY_PATTERN.test(String(value || ""));
}

function getTransactionTimestamp(transaction, field) {
  const timestamp = new Date(
    transaction?.[field] || transaction?.occurred_at || 0,
  ).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function compareTransactionsNewestFirst(left, right) {
  const occurredDifference =
    getTransactionTimestamp(right, "occurred_at") -
    getTransactionTimestamp(left, "occurred_at");
  if (occurredDifference !== 0) return occurredDifference;
  return (
    getTransactionTimestamp(right, "created_at") -
    getTransactionTimestamp(left, "created_at")
  );
}

function getAccountName(accountById, accountId, fallback) {
  if (!accountId) return fallback;
  const account = accountById.get(accountId);
  return String(account?.name || fallback);
}

export function isInternalAccountTransfer(transaction) {
  return (
    getTransactionFlow(transaction) === "exchange" &&
    normalizeCurrencyCode(transaction?.from_currency) ===
      normalizeCurrencyCode(transaction?.to_currency) &&
    Boolean(transaction?.source_account_id) &&
    Boolean(transaction?.destination_account_id)
  );
}

function getStatementAccountLabel(transaction, accountById) {
  const flow = getTransactionFlow(transaction);
  if (flow === "income") {
    return getAccountName(
      accountById,
      transaction.destination_account_id,
      "Dompet tujuan tidak tercatat",
    );
  }
  if (flow === "expense") {
    return getAccountName(
      accountById,
      transaction.source_account_id,
      "Dompet sumber tidak tercatat",
    );
  }

  const source = getAccountName(
    accountById,
    transaction.source_account_id,
    "Dompet asal tidak tercatat",
  );
  const destination = getAccountName(
    accountById,
    transaction.destination_account_id,
    "Dompet tujuan tidak tercatat",
  );
  return `${source} -> ${destination}`;
}

function getStatementAmounts(transaction) {
  const flow = getTransactionFlow(transaction);
  if (flow === "exchange") {
    return [
      {
        direction: "out",
        amount: Math.abs(Number(transaction.from_amount || 0)),
        currency: normalizeCurrencyCode(transaction.from_currency),
      },
      {
        direction: "in",
        amount: Math.abs(Number(transaction.to_amount || 0)),
        currency: normalizeCurrencyCode(transaction.to_currency),
      },
    ].filter((item) => item.amount > 0);
  }

  return [
    {
      direction: flow === "income" ? "in" : "out",
      amount: getTransactionAmountValue(transaction),
      currency: getTransactionCurrency(transaction),
    },
  ];
}

function createStatementRow(transaction, accountById, baseCurrency) {
  const flow = getTransactionFlow(transaction);
  const historicalValue =
    flow === "exchange"
      ? null
      : resolveTransactionHistoricalBaseValue(transaction, baseCurrency);
  const feeAmount = Math.abs(Number(transaction.fee_amount || 0));
  const feeCurrency = normalizeCurrencyCode(
    transaction.fee_currency || transaction.from_currency,
  );
  const feeBaseValue =
    flow === "exchange" && feeAmount > 0
      ? resolveTransactionFeeHistoricalBaseValue(transaction, baseCurrency)
      : 0;
  const occurredAt = new Date(transaction.occurred_at);

  return {
    id: transaction.id,
    transaction,
    occurredAt,
    dayKey: getLocalDayKey(occurredAt),
    dateLabel: formatLongDate(occurredAt),
    shortDateLabel: formatDay(occurredAt),
    timeLabel: formatShortTime(occurredAt),
    flow,
    tone:
      flow === "income"
        ? "income"
        : flow === "expense"
          ? "expense"
          : "movement",
    title: getTransactionDisplayTitle(transaction),
    typeLabel: getTransactionTypeLabel(transaction),
    categoryLabel: getTransactionCategoryLabel(transaction),
    accountLabel: getStatementAccountLabel(transaction, accountById),
    amounts: getStatementAmounts(transaction),
    historicalValue,
    feeAmount,
    feeCurrency,
    feeBaseValue,
    usesSavings: Boolean(transaction.target_id),
    internalTransfer: isInternalAccountTransfer(transaction),
  };
}

export function getMonthlyStatementTransactions(transactions, monthKey) {
  if (!isValidStatementMonthKey(monthKey)) return [];
  return [...(transactions || [])]
    .filter((transaction) => {
      if (!transaction?.occurred_at) return false;
      const date = new Date(transaction.occurred_at);
      return !Number.isNaN(date.getTime()) && getMonthKey(date) === monthKey;
    })
    .sort(compareTransactionsNewestFirst);
}

export function getMonthlyStatementMonthOptions(
  transactions,
  now = new Date(),
) {
  const counts = new Map();
  (transactions || []).forEach((transaction) => {
    if (!transaction?.occurred_at) return;
    const date = new Date(transaction.occurred_at);
    if (Number.isNaN(date.getTime())) return;
    const monthKey = getMonthKey(date);
    if (!isValidStatementMonthKey(monthKey)) return;
    counts.set(monthKey, Number(counts.get(monthKey) || 0) + 1);
  });

  const currentMonthKey = getMonthKey(now);
  if (!counts.has(currentMonthKey)) counts.set(currentMonthKey, 0);

  return [...counts.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([key, count]) => ({
      key,
      label: formatMonthKey(key),
      count,
    }));
}

export function buildMonthlyStatement({
  transactions = [],
  assetAccounts = [],
  monthKey,
  baseCurrency = DEFAULT_BASE_CURRENCY,
  ownerName = "Pengguna CUANSYNC",
  generatedAt = new Date(),
} = {}) {
  if (!isValidStatementMonthKey(monthKey)) {
    throw new Error("Bulan laporan tidak valid.");
  }

  const normalizedBaseCurrency = normalizeCurrencyCode(baseCurrency);
  const accountById = new Map(
    (assetAccounts || []).map((account) => [account.id, account]),
  );
  const monthTransactions = getMonthlyStatementTransactions(
    transactions,
    monthKey,
  );
  const rows = monthTransactions.map((transaction) =>
    createStatementRow(transaction, accountById, normalizedBaseCurrency),
  );
  const summary = rows.reduce(
    (totals, row) => {
      if (row.flow === "income") {
        if (row.historicalValue == null) totals.unvaluedCount += 1;
        else totals.income += Number(row.historicalValue || 0);
      } else if (row.flow === "expense") {
        if (row.historicalValue == null) totals.unvaluedCount += 1;
        else totals.expense += Number(row.historicalValue || 0);
      } else {
        totals.movementCount += 1;
        if (row.feeAmount > 0) {
          if (row.feeBaseValue == null) totals.unvaluedCount += 1;
          else {
            totals.feeExpense += Number(row.feeBaseValue || 0);
            totals.expense += Number(row.feeBaseValue || 0);
          }
        }
      }
      return totals;
    },
    {
      income: 0,
      expense: 0,
      feeExpense: 0,
      movementCount: 0,
      unvaluedCount: 0,
    },
  );
  summary.net = summary.income - summary.expense;
  summary.transactionCount = rows.length;
  summary.isValuationComplete = summary.unvaluedCount === 0;

  const groups = [];
  const groupByDay = new Map();
  rows.forEach((row) => {
    if (!groupByDay.has(row.dayKey)) {
      const group = {
        key: row.dayKey,
        label: row.dateLabel,
        rows: [],
      };
      groupByDay.set(row.dayKey, group);
      groups.push(group);
    }
    groupByDay.get(row.dayKey).rows.push(row);
  });

  const resolvedTimeZone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "Waktu perangkat";

  return {
    monthKey,
    monthLabel: formatMonthKey(monthKey),
    baseCurrency: normalizedBaseCurrency,
    ownerName: String(ownerName || "Pengguna CUANSYNC"),
    generatedAt: new Date(generatedAt),
    timeZone: resolvedTimeZone,
    rows,
    groups,
    summary,
  };
}
