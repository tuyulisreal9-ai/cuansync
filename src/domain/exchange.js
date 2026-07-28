import {
  DEFAULT_BASE_CURRENCY,
  formatNumericInput,
  normalizeCurrencyCode,
  normalizeNumericInput,
} from "../lib/currency.js";
import { getCurrentValuationRateForCurrency } from "./assets.js";
import {
  calculateExchangeSourceAmount,
  calculateExchangeTargetAmount,
  deriveStoredExchangeRateOrientation,
  getDirectionalExchangeRate,
  normalizeExchangeRateOrientation,
  serializeExchangeRate,
  validateExchangeRate,
} from "./exchangeRate.js";
import {
  getTransactionAmountValue,
  getTransactionCurrency,
  getTransactionFlow,
  orderTransactions,
  resolveTransactionBaseValue,
} from "./transactions.js";

export {
  EXCHANGE_RATE_SCALE_DIGITS,
  addExchangeDecimals,
  calculateExchangeSourceAmount,
  calculateExchangeTargetAmount,
  compareExchangeDecimals,
  decimalToString,
  deriveStoredExchangeRateOrientation,
  divideExchangeDecimals,
  getDirectionalExchangeRate,
  getExchangeAmountDigits,
  multiplyExchangeDecimals,
  normalizeExchangeRateOrientation,
  parseExchangeDecimal,
  roundExchangeDecimal,
  serializeExchangeRate,
  validateExchangeRate,
} from "./exchangeRate.js";

export function settleExchangeCalculation(
  form,
  changedField,
  {
    rateField = "exchange_rate",
    preferredTarget = null,
    rateBaseCurrency = form.rate_base_currency,
    rateQuoteCurrency = form.rate_quote_currency,
  } = {},
) {
  const next = { ...form };
  const fromAmount = normalizeNumericInput(next.from_amount);
  const toAmount = normalizeNumericInput(next.to_amount);
  const rate = serializeExchangeRate(next[rateField]);

  function setAutoValue(field, value) {
    const formatted = value ? formatNumericInput(value) : "";
    if (formatted) next[field] = formatted;
  }

  if (changedField === rateField) {
    if (!rate) return next;
    if (preferredTarget === "from_amount" && Number(toAmount) > 0) {
      setAutoValue(
        "from_amount",
        calculateExchangeSourceAmount({
          sourceCurrency: next.from_currency,
          targetCurrency: next.to_currency,
          targetAmount: toAmount,
          rateBaseCurrency,
          rateQuoteCurrency,
          exchangeRate: rate,
        }),
      );
      return next;
    }
    if (preferredTarget === "to_amount" && Number(fromAmount) > 0) {
      setAutoValue(
        "to_amount",
        calculateExchangeTargetAmount({
          sourceCurrency: next.from_currency,
          targetCurrency: next.to_currency,
          sourceAmount: fromAmount,
          rateBaseCurrency,
          rateQuoteCurrency,
          exchangeRate: rate,
        }),
      );
      return next;
    }
    if (Number(toAmount) > 0) {
      setAutoValue(
        "from_amount",
        calculateExchangeSourceAmount({
          sourceCurrency: next.from_currency,
          targetCurrency: next.to_currency,
          targetAmount: toAmount,
          rateBaseCurrency,
          rateQuoteCurrency,
          exchangeRate: rate,
        }),
      );
      return next;
    }
    if (Number(fromAmount) > 0) {
      setAutoValue(
        "to_amount",
        calculateExchangeTargetAmount({
          sourceCurrency: next.from_currency,
          targetCurrency: next.to_currency,
          sourceAmount: fromAmount,
          rateBaseCurrency,
          rateQuoteCurrency,
          exchangeRate: rate,
        }),
      );
    }
    return next;
  }

  if (changedField === "from_amount") {
    if (Number(fromAmount) <= 0 || !rate) return next;
    setAutoValue(
      "to_amount",
      calculateExchangeTargetAmount({
        sourceCurrency: next.from_currency,
        targetCurrency: next.to_currency,
        sourceAmount: fromAmount,
        rateBaseCurrency,
        rateQuoteCurrency,
        exchangeRate: rate,
      }),
    );
    return next;
  }

  if (changedField === "to_amount") {
    if (Number(toAmount) <= 0 || !rate) return next;
    setAutoValue(
      "from_amount",
      calculateExchangeSourceAmount({
        sourceCurrency: next.from_currency,
        targetCurrency: next.to_currency,
        targetAmount: toAmount,
        rateBaseCurrency,
        rateQuoteCurrency,
        exchangeRate: rate,
      }),
    );
  }

  return next;
}

export function resolveNormalizedPairRate(
  globalRateSnapshot,
  fromCurrency,
  toCurrency,
  baseCurrency = DEFAULT_BASE_CURRENCY,
) {
  const pairRate = getGlobalPairRate(
    globalRateSnapshot,
    fromCurrency,
    toCurrency,
    baseCurrency,
  );
  const orientation = normalizeExchangeRateOrientation(
    pairRate.rate,
    fromCurrency,
    toCurrency,
  );
  return {
    ...pairRate,
    ...orientation,
    directionalRate: serializeExchangeRate(pairRate.rate),
  };
}

export function getTransactionDirectionalRate(transaction) {
  const orientation = deriveStoredExchangeRateOrientation(transaction);
  return getDirectionalExchangeRate({
    sourceCurrency: transaction?.from_currency,
    targetCurrency: transaction?.to_currency,
    ...orientation,
  });
}

export function getExchangeRateValidation(value) {
  return validateExchangeRate(value);
}

export function getGlobalPairRate(
  globalRateSnapshot,
  fromCurrency,
  toCurrency,
  baseCurrency = DEFAULT_BASE_CURRENCY,
) {
  const from = normalizeCurrencyCode(fromCurrency);
  const to = normalizeCurrencyCode(toCurrency);
  const base = normalizeCurrencyCode(baseCurrency);
  if (from === to) return { rate: 1, source: "same-currency" };

  const fromRate = getCurrentValuationRateForCurrency(
    globalRateSnapshot,
    from,
    base,
  );
  const toRate = getCurrentValuationRateForCurrency(
    globalRateSnapshot,
    to,
    base,
  );
  const rate = Number(fromRate.rate || 0) / Number(toRate.rate || 0);

  return Number.isFinite(rate) && rate > 0
    ? { rate, source: "global" }
    : { rate: 0, source: null };
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
