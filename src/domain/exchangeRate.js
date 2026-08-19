import {
  getCurrencyMeta,
  normalizeCurrencyCode,
} from "../lib/currency.js";

export const EXCHANGE_RATE_SCALE_DIGITS = 12;
const EXCHANGE_RATE_SCALE = 10n ** BigInt(EXCHANGE_RATE_SCALE_DIGITS);

function expandExponential(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "";
  return numeric
    .toFixed(EXCHANGE_RATE_SCALE_DIGITS)
    .replace(/\.?0+$/, "");
}

export function parseExchangeDecimal(value) {
  const raw = String(value ?? "").trim().replace(/,/g, "");
  if (!raw) return null;
  const plain = /e/i.test(raw) ? expandExponential(raw) : raw;
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(plain)) return null;

  const negative = plain.startsWith("-");
  const unsigned = plain.replace(/^[+-]/, "");
  const [integerPart = "0", fractionPart = ""] = unsigned.split(".");
  const fraction = fractionPart
    .slice(0, EXCHANGE_RATE_SCALE_DIGITS)
    .padEnd(EXCHANGE_RATE_SCALE_DIGITS, "0");
  const scaled =
    BigInt(integerPart || "0") * EXCHANGE_RATE_SCALE + BigInt(fraction || "0");
  return negative ? -scaled : scaled;
}

export function decimalToString(value, { trim = true } = {}) {
  const scaled = typeof value === "bigint" ? value : parseExchangeDecimal(value);
  if (scaled == null) return "";
  const negative = scaled < 0n;
  const absolute = negative ? -scaled : scaled;
  const integer = absolute / EXCHANGE_RATE_SCALE;
  const fraction = String(absolute % EXCHANGE_RATE_SCALE).padStart(
    EXCHANGE_RATE_SCALE_DIGITS,
    "0",
  );
  const normalizedFraction = trim ? fraction.replace(/0+$/, "") : fraction;
  return `${negative ? "-" : ""}${integer}${
    normalizedFraction ? `.${normalizedFraction}` : ""
  }`;
}

function divideRounded(numerator, denominator) {
  if (denominator === 0n) return null;
  const negative = (numerator < 0n) !== (denominator < 0n);
  const absoluteNumerator = numerator < 0n ? -numerator : numerator;
  const absoluteDenominator = denominator < 0n ? -denominator : denominator;
  let quotient = absoluteNumerator / absoluteDenominator;
  const remainder = absoluteNumerator % absoluteDenominator;
  if (remainder * 2n >= absoluteDenominator) quotient += 1n;
  return negative ? -quotient : quotient;
}

export function multiplyExchangeDecimals(left, right) {
  const leftScaled = parseExchangeDecimal(left);
  const rightScaled = parseExchangeDecimal(right);
  if (leftScaled == null || rightScaled == null) return "";
  const result = divideRounded(leftScaled * rightScaled, EXCHANGE_RATE_SCALE);
  return result == null ? "" : decimalToString(result);
}

export function divideExchangeDecimals(left, right) {
  const leftScaled = parseExchangeDecimal(left);
  const rightScaled = parseExchangeDecimal(right);
  if (leftScaled == null || rightScaled == null || rightScaled === 0n) return "";
  const result = divideRounded(leftScaled * EXCHANGE_RATE_SCALE, rightScaled);
  return result == null ? "" : decimalToString(result);
}

export function addExchangeDecimals(left, right) {
  const leftScaled = parseExchangeDecimal(left);
  const rightScaled = parseExchangeDecimal(right);
  if (leftScaled == null || rightScaled == null) return "";
  return decimalToString(leftScaled + rightScaled);
}

export function compareExchangeDecimals(left, right) {
  const leftScaled = parseExchangeDecimal(left);
  const rightScaled = parseExchangeDecimal(right);
  if (leftScaled == null || rightScaled == null) return null;
  if (leftScaled === rightScaled) return 0;
  return leftScaled > rightScaled ? 1 : -1;
}

export function getExchangeAmountDigits(currency) {
  return getCurrencyMeta(normalizeCurrencyCode(currency)).fractionDigits ?? 2;
}

export function roundExchangeDecimal(value, digits = 2) {
  const scaled = parseExchangeDecimal(value);
  if (scaled == null) return "";
  const safeDigits = Math.max(
    0,
    Math.min(Number(digits) || 0, EXCHANGE_RATE_SCALE_DIGITS),
  );
  const factor = 10n ** BigInt(EXCHANGE_RATE_SCALE_DIGITS - safeDigits);
  const roundedUnits = divideRounded(scaled, factor);
  if (roundedUnits == null) return "";
  return decimalToString(roundedUnits * factor);
}

export function serializeExchangeRate(value) {
  const scaled = parseExchangeDecimal(value);
  if (scaled == null || scaled <= 0n) return "";
  return decimalToString(scaled);
}

export function validateExchangeRate(value) {
  if (String(value ?? "").trim() === "") {
    return { valid: false, message: "Masukkan kurs money changer." };
  }
  const scaled = parseExchangeDecimal(value);
  if (scaled == null) {
    return { valid: false, message: "Kurs tidak valid." };
  }
  if (scaled <= 0n) {
    return { valid: false, message: "Kurs harus lebih besar dari nol." };
  }
  return { valid: true, message: "" };
}

export function normalizeExchangeRateOrientation(
  rawRate,
  sourceCurrency,
  targetCurrency,
) {
  const source = normalizeCurrencyCode(sourceCurrency);
  const target = normalizeCurrencyCode(targetCurrency);
  const raw = serializeExchangeRate(rawRate);
  if (!raw || source === target) {
    return {
      rateBaseCurrency: source,
      rateQuoteCurrency: target,
      exchangeRate: source === target ? "1" : "",
      normalizedRate: source === target ? 1 : 0,
    };
  }

  const rawComparedToOne = compareExchangeDecimals(raw, "1");
  const inverted = rawComparedToOne < 0;
  const exchangeRate = inverted ? divideExchangeDecimals("1", raw) : raw;
  return {
    rateBaseCurrency: inverted ? target : source,
    rateQuoteCurrency: inverted ? source : target,
    exchangeRate,
    normalizedRate: Number(exchangeRate),
  };
}

export function calculateExchangeTargetAmount({
  sourceCurrency,
  targetCurrency,
  sourceAmount,
  rateBaseCurrency,
  rateQuoteCurrency,
  exchangeRate,
  targetDigits = getExchangeAmountDigits(targetCurrency),
}) {
  const source = normalizeCurrencyCode(sourceCurrency);
  const target = normalizeCurrencyCode(targetCurrency);
  const rateBase = normalizeCurrencyCode(rateBaseCurrency);
  const rateQuote = normalizeCurrencyCode(rateQuoteCurrency);
  const rateValidation = validateExchangeRate(exchangeRate);
  if (!rateValidation.valid || compareExchangeDecimals(sourceAmount, "0") <= 0) {
    return "";
  }

  const converted =
    source === rateBase && target === rateQuote
      ? multiplyExchangeDecimals(sourceAmount, exchangeRate)
      : source === rateQuote && target === rateBase
        ? divideExchangeDecimals(sourceAmount, exchangeRate)
        : "";
  return converted ? roundExchangeDecimal(converted, targetDigits) : "";
}

export function calculateExchangeSourceAmount({
  sourceCurrency,
  targetCurrency,
  targetAmount,
  rateBaseCurrency,
  rateQuoteCurrency,
  exchangeRate,
  sourceDigits = getExchangeAmountDigits(sourceCurrency),
}) {
  const source = normalizeCurrencyCode(sourceCurrency);
  const target = normalizeCurrencyCode(targetCurrency);
  const rateBase = normalizeCurrencyCode(rateBaseCurrency);
  const rateQuote = normalizeCurrencyCode(rateQuoteCurrency);
  const rateValidation = validateExchangeRate(exchangeRate);
  if (!rateValidation.valid || compareExchangeDecimals(targetAmount, "0") <= 0) {
    return "";
  }

  const converted =
    source === rateBase && target === rateQuote
      ? divideExchangeDecimals(targetAmount, exchangeRate)
      : source === rateQuote && target === rateBase
        ? multiplyExchangeDecimals(targetAmount, exchangeRate)
        : "";
  return converted ? roundExchangeDecimal(converted, sourceDigits) : "";
}

export function getDirectionalExchangeRate({
  sourceCurrency,
  targetCurrency,
  rateBaseCurrency,
  rateQuoteCurrency,
  exchangeRate,
}) {
  const source = normalizeCurrencyCode(sourceCurrency);
  const target = normalizeCurrencyCode(targetCurrency);
  const rateBase = normalizeCurrencyCode(rateBaseCurrency);
  const rateQuote = normalizeCurrencyCode(rateQuoteCurrency);
  if (source === rateBase && target === rateQuote) {
    return serializeExchangeRate(exchangeRate);
  }
  if (source === rateQuote && target === rateBase) {
    return divideExchangeDecimals("1", exchangeRate);
  }
  return "";
}

export function deriveStoredExchangeRateOrientation(transaction) {
  const sourceCurrency = normalizeCurrencyCode(transaction?.from_currency);
  const targetCurrency = normalizeCurrencyCode(transaction?.to_currency);
  const explicitRate = serializeExchangeRate(transaction?.exchange_rate);
  const explicitBase = transaction?.rate_base_currency
    ? normalizeCurrencyCode(transaction.rate_base_currency)
    : "";
  const explicitQuote = transaction?.rate_quote_currency
    ? normalizeCurrencyCode(transaction.rate_quote_currency)
    : "";
  const explicitPairMatches =
    explicitBase &&
    explicitQuote &&
    new Set([explicitBase, explicitQuote]).size === 2 &&
    [explicitBase, explicitQuote].includes(sourceCurrency) &&
    [explicitBase, explicitQuote].includes(targetCurrency);

  if (explicitRate && explicitPairMatches) {
    return {
      rateBaseCurrency: explicitBase,
      rateQuoteCurrency: explicitQuote,
      exchangeRate: explicitRate,
      normalizedRate: Number(explicitRate),
    };
  }

  const fromAmount = serializeExchangeRate(transaction?.from_amount);
  const toAmount = serializeExchangeRate(transaction?.to_amount);
  if (fromAmount && toAmount) {
    const targetIsHigher = compareExchangeDecimals(toAmount, fromAmount) >= 0;
    const exchangeRate = targetIsHigher
      ? divideExchangeDecimals(toAmount, fromAmount)
      : divideExchangeDecimals(fromAmount, toAmount);
    return {
      rateBaseCurrency: targetIsHigher ? sourceCurrency : targetCurrency,
      rateQuoteCurrency: targetIsHigher ? targetCurrency : sourceCurrency,
      exchangeRate,
      normalizedRate: Number(exchangeRate),
    };
  }

  const directionalRate = serializeExchangeRate(
    transaction?.rate || transaction?.locked_rate,
  );
  return normalizeExchangeRateOrientation(
    directionalRate,
    sourceCurrency,
    targetCurrency,
  );
}
