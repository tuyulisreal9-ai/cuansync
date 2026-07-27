import {
  DEFAULT_BASE_CURRENCY,
  formatAutoNumericValue,
  normalizeCurrencyCode,
  normalizeNumericInput,
} from "../lib/currency.js";
import { getCurrentValuationRateForCurrency } from "./assets.js";
import {
  getTransactionAmountValue,
  getTransactionCurrency,
  getTransactionFlow,
  orderTransactions,
  resolveTransactionBaseValue,
} from "./transactions.js";

export function settleExchangeCalculation(
  form,
  changedField,
  { rateField = "exchange_rate", preferredTarget = null } = {},
) {
  const next = { ...form };
  const fromAmount = Number(normalizeNumericInput(next.from_amount));
  const toAmount = Number(normalizeNumericInput(next.to_amount));
  const rate = Number(normalizeNumericInput(next[rateField]));

  function setAutoValue(field, value) {
    const formatted = formatAutoNumericValue(value);
    if (formatted) next[field] = formatted;
  }

  if (changedField === rateField) {
    if (rate <= 0) return next;
    if (preferredTarget === "from_amount" && toAmount > 0) {
      setAutoValue("from_amount", toAmount * rate);
      return next;
    }
    if (preferredTarget === "to_amount" && fromAmount > 0) {
      setAutoValue("to_amount", fromAmount / rate);
      return next;
    }
    if (toAmount > 0) {
      setAutoValue("from_amount", toAmount * rate);
      return next;
    }
    if (fromAmount > 0) {
      setAutoValue("to_amount", fromAmount / rate);
    }
    return next;
  }

  if (changedField === "from_amount") {
    if (fromAmount <= 0) return next;
    if (toAmount > 0) {
      setAutoValue(rateField, fromAmount / toAmount);
      return next;
    }
    if (rate > 0) {
      setAutoValue("to_amount", fromAmount / rate);
    }
    return next;
  }

  if (changedField === "to_amount") {
    if (toAmount <= 0) return next;
    if (fromAmount > 0) {
      setAutoValue(rateField, fromAmount / toAmount);
      return next;
    }
    if (rate > 0) {
      setAutoValue("from_amount", toAmount * rate);
    }
  }

  return next;
}

export function getLockedExchange(transactions, occurredAt) {
  const target = new Date(occurredAt).getTime();
  return orderTransactions(transactions)
    .filter(
      (item) =>
        item.type === "exchange" &&
        (item.to_currency === "THB" ||
          item.from_currency === "THB" ||
          Number(item.amount_thb || 0) !== 0) &&
        Number(item.rate || item.locked_rate || 0) > 0 &&
        new Date(item.occurred_at).getTime() <= target,
    )
    .at(-1);
}

export function getExchangeRateToBase(
  transaction,
  currency,
  baseCurrency = DEFAULT_BASE_CURRENCY,
) {
  if (!transaction || transaction.type !== "exchange") return null;
  const code = normalizeCurrencyCode(currency);
  const base = normalizeCurrencyCode(baseCurrency);
  const fromCurrency = normalizeCurrencyCode(transaction.from_currency);
  const toCurrency = normalizeCurrencyCode(transaction.to_currency);
  const fromAmount = Number(transaction.from_amount || 0);
  const toAmount = Number(transaction.to_amount || 0);

  if (fromAmount <= 0 || toAmount <= 0) return null;
  if (fromCurrency === base && toCurrency === code) return fromAmount / toAmount;
  if (fromCurrency === code && toCurrency === base) return toAmount / fromAmount;
  return null;
}

export function getLatestRateForCurrencyUntil(
  transactions,
  currency,
  endDate,
  baseCurrency = DEFAULT_BASE_CURRENCY,
) {
  const code = normalizeCurrencyCode(currency);
  const base = normalizeCurrencyCode(baseCurrency);
  if (code === base) return 1;
  const endTime = new Date(endDate).getTime();
  const exchange = orderTransactions(transactions)
    .filter(
      (item) =>
        item.type === "exchange" &&
        new Date(item.occurred_at).getTime() <= endTime &&
        getExchangeRateToBase(item, code, base) != null,
    )
    .at(-1);
  return getExchangeRateToBase(exchange, code, base) || 0;
}

export function getLatestExchangeForCurrencyUntil(
  transactions,
  currency,
  endDate,
  baseCurrency = DEFAULT_BASE_CURRENCY,
) {
  const code = normalizeCurrencyCode(currency);
  const base = normalizeCurrencyCode(baseCurrency);
  if (code === base) return null;
  const endTime = new Date(endDate).getTime();

  return (
    orderTransactions(transactions)
      .filter(
        (item) =>
          item.type === "exchange" &&
          new Date(item.occurred_at).getTime() <= endTime &&
          getExchangeRateToBase(item, code, base) != null,
      )
      .at(-1) || null
  );
}

export function getExchangeBaseVolume(transaction, fallbackRate = 0) {
  if (transaction?.type !== "exchange") return 0;
  const baseCurrency = normalizeCurrencyCode(transaction.base_currency);
  const fromCurrency = normalizeCurrencyCode(transaction.from_currency);
  const toCurrency = normalizeCurrencyCode(transaction.to_currency);
  const fromAmount = Math.abs(Number(transaction.from_amount || 0));
  const toAmount = Math.abs(Number(transaction.to_amount || 0));
  const rate = Number(
    transaction.rate || transaction.locked_rate || fallbackRate || 0,
  );

  if (fromCurrency === baseCurrency) return fromAmount;
  if (toCurrency === baseCurrency) return toAmount;
  return fromAmount > 0 && rate > 0 ? fromAmount * rate : 0;
}

export function resolveTransactionCurrentBaseValue(
  transaction,
  globalRateSnapshot = null,
  baseCurrency = DEFAULT_BASE_CURRENCY,
) {
  const normalizedBaseCurrency = normalizeCurrencyCode(baseCurrency);
  const flow = getTransactionFlow(transaction);
  if (flow === "exchange") {
    const fromCurrency = normalizeCurrencyCode(transaction.from_currency);
    const rateInfo = getCurrentValuationRateForCurrency(
      globalRateSnapshot,
      fromCurrency,
      normalizedBaseCurrency,
    );
    return getExchangeBaseVolume(transaction, rateInfo.rate);
  }

  const currency = getTransactionCurrency(transaction);
  const amount = getTransactionAmountValue(transaction);
  if (currency === normalizedBaseCurrency) return amount;

  const rateInfo = getCurrentValuationRateForCurrency(
    globalRateSnapshot,
    currency,
    normalizedBaseCurrency,
  );
  return rateInfo.rate > 0
    ? amount * rateInfo.rate
    : resolveTransactionBaseValue(transaction, 0);
}
