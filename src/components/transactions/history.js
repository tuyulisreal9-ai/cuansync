import {
  CATEGORY_OPTIONS,
  getBudgetCategoryKey,
} from "../../domain/budgets.js";
import {
  getTransactionAmountValue,
  getTransactionCurrency,
  getTransactionFlow,
  getTransactionMainAmount,
  orderTransactions,
  resolveTransactionBaseValue,
} from "../../domain/transactions.js";
import {
  getCurrencyOptions,
  normalizeCurrencyCode,
  normalizeNumericInput,
} from "../../lib/currency.js";
import {
  formatDateTime,
  formatDay,
  formatLongDate,
  getLocalDayKey,
  getMonthKey,
} from "../../lib/dates.js";
import {
  getTransactionCategoryKey,
  getTransactionCategoryLabel,
  getTransactionDisplayTitle,
  getTransactionTypeLabel,
} from "./presentation.js";
export const HISTORY_VISIBLE_LIMIT = 30;

export const DEFAULT_TRANSACTION_FILTERS = {
  startDate: "",
  endDate: "",
  type: "all",
  category: "all",
  currency: "all",
  minAmount: "",
  maxAmount: "",
  search: "",
  sortBy: "newest",
};

export function getHistoryCurrencyOptions(activeCurrencies = []) {
  return [
    { value: "all", label: "Semua mata uang" },
    ...getCurrencyOptions(activeCurrencies),
  ];
}

function getTransactionIdrValuation(transaction) {
  const valuation = resolveTransactionBaseValue(transaction);
  return valuation > 0 ? valuation : null;
}

function getTransactionIdrValuationWithRate(transaction, fallbackRate = 0) {
  const valuation = resolveTransactionBaseValue(transaction, fallbackRate);
  return valuation > 0 ? valuation : null;
}

function getTransactionComparableAmount(transaction) {
  return getTransactionIdrValuation(transaction) ?? getTransactionMainAmount(transaction);
}

export function getHistoryCategoryOptions(transactions) {
  return [
    { value: "all", label: "Semua kategori" },
    { value: "income", label: "Pemasukan" },
    { value: "exchange", label: "Transfer / Exchange" },
    ...CATEGORY_OPTIONS.map((category) => ({
      value: getBudgetCategoryKey(category.value),
      label: category.label,
    })),
  ];
}

function getTransactionTimestamp(transaction) {
  const occurredAt = new Date(transaction.occurred_at).getTime();
  const createdAt = new Date(transaction.created_at || transaction.occurred_at).getTime();
  return {
    occurredAt: Number.isFinite(occurredAt) ? occurredAt : 0,
    createdAt: Number.isFinite(createdAt) ? createdAt : 0,
  };
}

function compareTransactionsByDate(a, b) {
  const aTime = getTransactionTimestamp(a);
  const bTime = getTransactionTimestamp(b);
  const occurredDiff = aTime.occurredAt - bTime.occurredAt;
  if (occurredDiff !== 0) return occurredDiff;
  return aTime.createdAt - bTime.createdAt;
}

function getTransactionGroupLabel(dayKey) {
  const todayKey = getLocalDayKey(new Date());
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayKey = getLocalDayKey(yesterdayDate);
  const dateLabel = formatLongDate(`${dayKey}T00:00:00`);

  if (dayKey === todayKey) return `Hari ini \u00b7 ${dateLabel}`;
  if (dayKey === yesterdayKey) return `Kemarin \u00b7 ${dateLabel}`;
  return dateLabel;
}

export function getTransactionRangeLabel(filters) {
  if (filters.startDate && filters.endDate) {
    return `${formatDay(`${filters.startDate}T00:00:00`)} - ${formatDay(`${filters.endDate}T00:00:00`)}`;
  }
  if (filters.startDate) return `Mulai ${formatDay(`${filters.startDate}T00:00:00`)}`;
  if (filters.endDate) return `Sampai ${formatDay(`${filters.endDate}T00:00:00`)}`;
  return "Semua tanggal";
}

export function groupTransactionsByDay(transactions) {
  const groups = [];
  const groupMap = new Map();

  transactions.forEach((transaction) => {
    const dayKey = getLocalDayKey(transaction.occurred_at);
    if (!groupMap.has(dayKey)) {
      const group = {
        key: dayKey,
        label: getTransactionGroupLabel(dayKey),
        transactions: [],
      };
      groupMap.set(dayKey, group);
      groups.push(group);
    }
    groupMap.get(dayKey).transactions.push(transaction);
  });

  return groups;
}

export function hasActiveTransactionFilters(filters) {
  const defaults = DEFAULT_TRANSACTION_FILTERS;
  return Object.keys(defaults).some(
    (key) => filters[key] !== defaults[key],
  );
}

function escapeCsvValue(value) {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function formatCsvNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number !== 0 ? String(number) : "";
}

function getMonthlyStatementRows(transactions, monthKey, fallbackRate = 0) {
  return orderTransactions(transactions)
    .filter((transaction) => getMonthKey(transaction.occurred_at) === monthKey)
    .sort(compareTransactionsByDate)
    .map((transaction) => {
      const flow = getTransactionFlow(transaction);
      const valuationIdr = getTransactionIdrValuationWithRate(transaction, fallbackRate);
      const rate = Number(transaction.rate || transaction.locked_rate || 0);
      const fromAmount = Math.abs(Number(transaction.from_amount || 0));
      const toAmount = Math.abs(Number(transaction.to_amount || 0));
      const amount = getTransactionAmountValue(transaction);
      return {
        tanggal: formatDateTime(transaction.occurred_at),
        tipe: getTransactionTypeLabel(transaction),
        deskripsi: getTransactionDisplayTitle(transaction),
        kategori: getTransactionCategoryLabel(transaction),
        mataUang:
          flow === "exchange"
            ? `${normalizeCurrencyCode(transaction.from_currency)} -> ${normalizeCurrencyCode(transaction.to_currency)}`
            : getTransactionCurrency(transaction),
        masuk: flow === "income" ? formatCsvNumber(amount) : "",
        keluar: flow === "expense" ? formatCsvNumber(amount) : "",
        tukarKeluar: flow === "exchange" ? formatCsvNumber(fromAmount) : "",
        tukarMasuk: flow === "exchange" ? formatCsvNumber(toAmount) : "",
        rate: formatCsvNumber(rate),
        valuasiIdr: valuationIdr != null ? formatCsvNumber(valuationIdr) : "",
      };
    });
}

export function downloadMonthlyStatement(transactions, monthKey, fallbackRate = 0) {
  const rows = getMonthlyStatementRows(transactions, monthKey, fallbackRate);
  const headers = [
    "Tanggal",
    "Tipe",
    "Deskripsi",
    "Kategori",
    "Mata uang",
    "Masuk",
    "Keluar",
    "Tukar keluar",
    "Tukar masuk",
    "Kurs",
    "Valuasi IDR",
  ];
  const csvRows = [
    headers,
    ...rows.map((row) => [
      row.tanggal,
      row.tipe,
      row.deskripsi,
      row.kategori,
      row.mataUang,
      row.masuk,
      row.keluar,
      row.tukarKeluar,
      row.tukarMasuk,
      row.rate,
      row.valuasiIdr,
    ]),
  ];
  const csv = `\uFEFF${csvRows
    .map((row) => row.map(escapeCsvValue).join(","))
    .join("\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `cuansync-mutasi-${monthKey}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function filterAndSortTransactions(transactions, filters) {
  const normalizedSearch = filters.search.trim().toLowerCase();
  const minAmount = Number(normalizeNumericInput(filters.minAmount));
  const maxAmount = Number(normalizeNumericInput(filters.maxAmount));

  return transactions
    .filter((transaction) => {
      const dayKey = getLocalDayKey(transaction.occurred_at);
      const flow = getTransactionFlow(transaction);
      const categoryKey = getTransactionCategoryKey(transaction);
      const comparableAmount = getTransactionComparableAmount(transaction);
      const selectedCurrency = normalizeCurrencyCode(filters.currency, "all");
      const transactionCurrency = getTransactionCurrency(transaction);
      const exchangeFromCurrency = normalizeCurrencyCode(transaction.from_currency);
      const exchangeToCurrency = normalizeCurrencyCode(transaction.to_currency);
      const currencyMatches =
        filters.currency === "all" ||
        transactionCurrency === selectedCurrency ||
        (flow === "exchange" &&
          (exchangeFromCurrency === selectedCurrency ||
            exchangeToCurrency === selectedCurrency));
      const filterAmount =
        filters.currency !== "all"
          ? flow === "exchange" && exchangeFromCurrency === selectedCurrency
            ? Math.abs(Number(transaction.from_amount || 0))
            : flow === "exchange" && exchangeToCurrency === selectedCurrency
              ? Math.abs(Number(transaction.to_amount || 0))
              : transactionCurrency === selectedCurrency
                ? getTransactionAmountValue(transaction)
                : comparableAmount
          : comparableAmount;
      const description = String(transaction.description || "").toLowerCase();

      if (filters.startDate && dayKey < filters.startDate) return false;
      if (filters.endDate && dayKey > filters.endDate) return false;
      if (filters.type !== "all" && flow !== filters.type) return false;
      if (filters.category !== "all" && categoryKey !== filters.category) return false;
      if (!currencyMatches) return false;
      if (Number.isFinite(minAmount) && minAmount > 0 && filterAmount < minAmount) {
        return false;
      }
      if (Number.isFinite(maxAmount) && maxAmount > 0 && filterAmount > maxAmount) {
        return false;
      }
      if (normalizedSearch && !description.includes(normalizedSearch)) return false;

      return true;
    })
    .sort((a, b) => {
      if (filters.sortBy === "oldest") return compareTransactionsByDate(a, b);
      if (filters.sortBy === "largest") {
        return getTransactionComparableAmount(b) - getTransactionComparableAmount(a);
      }
      if (filters.sortBy === "smallest") {
        return getTransactionComparableAmount(a) - getTransactionComparableAmount(b);
      }
      return compareTransactionsByDate(b, a);
    });
}
