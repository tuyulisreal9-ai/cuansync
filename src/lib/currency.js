export const DEFAULT_BASE_CURRENCY = "IDR";

export const DEFAULT_ACTIVE_CURRENCIES = [
  "IDR",
  "THB",
  "USD",
  "AUD",
  "KRW",
  "JPY",
  "SGD",
  "MYR",
  "EUR",
  "GBP",
];

export const DEFAULT_SELECTED_CURRENCIES = ["IDR"];

export const CURRENCY_META = {
  IDR: { label: "IDR", locale: "id-ID", digits: 0 },
  THB: { label: "THB", locale: "th-TH", digits: 0 },
  USD: { label: "USD", locale: "en-US", digits: 0 },
  AUD: { label: "AUD", locale: "en-AU", digits: 0 },
  KRW: { label: "KRW", locale: "ko-KR", digits: 0 },
  JPY: { label: "JPY", locale: "ja-JP", digits: 0 },
  SGD: { label: "SGD", locale: "en-SG", digits: 0 },
  MYR: { label: "MYR", locale: "ms-MY", digits: 0 },
  EUR: { label: "EUR", locale: "de-DE", digits: 0 },
  GBP: { label: "GBP", locale: "en-GB", digits: 0 },
};

export const HIDDEN_BALANCE_TEXT = "\u2022\u2022\u2022\u2022\u2022\u2022";

export const numberFormatter = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const currencyFormatters = {};
const moneyFormatters = {};

export function normalizeCurrencyCode(currency, fallback = DEFAULT_BASE_CURRENCY) {
  const code = String(currency || fallback || DEFAULT_BASE_CURRENCY)
    .trim()
    .toUpperCase();
  return code || DEFAULT_BASE_CURRENCY;
}

export function getCurrencyMeta(currency) {
  const code = normalizeCurrencyCode(currency);
  return CURRENCY_META[code] || { label: code, locale: "en-US", digits: 0 };
}

export function formatCurrency(value, currency) {
  const code = normalizeCurrencyCode(currency);
  if (!currencyFormatters[code]) {
    const meta = getCurrencyMeta(code);
    currencyFormatters[code] = new Intl.NumberFormat(meta.locale, {
      style: "currency",
      currency: code,
      minimumFractionDigits: meta.digits,
      maximumFractionDigits: meta.digits,
    });
  }
  return currencyFormatters[code].format(Number(value || 0));
}

export function formatCurrencyCompact(value, currency) {
  const code = normalizeCurrencyCode(currency);
  const numeric = Number(value || 0);
  const absolute = Math.abs(numeric);
  if (absolute < 10000) return formatCurrency(numeric, code);

  const meta = getCurrencyMeta(code);
  return new Intl.NumberFormat(meta.locale, {
    style: "currency",
    currency: code,
    notation: "compact",
    minimumFractionDigits: 0,
    maximumFractionDigits: absolute >= 1000000 ? 1 : 0,
  }).format(numeric);
}

export function formatMoney(value, currency, options = {}) {
  const code = normalizeCurrencyCode(currency);
  const meta = getCurrencyMeta(code);
  const numeric = Number(value || 0);
  const formatOptions = {
    style: "currency",
    currency: code,
    currencyDisplay: options.currencyDisplay || "narrowSymbol",
  };

  if (options.notation) formatOptions.notation = options.notation;
  if (typeof options.minimumFractionDigits === "number") {
    formatOptions.minimumFractionDigits = options.minimumFractionDigits;
  }
  if (typeof options.maximumFractionDigits === "number") {
    formatOptions.maximumFractionDigits = options.maximumFractionDigits;
  }

  const cacheKey = JSON.stringify([meta.locale, code, formatOptions]);
  try {
    if (!moneyFormatters[cacheKey]) {
      moneyFormatters[cacheKey] = new Intl.NumberFormat(meta.locale, formatOptions);
    }
    return moneyFormatters[cacheKey].format(numeric);
  } catch {
    return `${code} ${numberFormatter.format(numeric)}`;
  }
}

export function formatMoneyCompact(value, currency) {
  const numeric = Number(value || 0);
  const absolute = Math.abs(numeric);
  if (absolute < 10000) return formatMoney(numeric, currency);

  return formatMoney(numeric, currency, {
    notation: "compact",
    maximumFractionDigits: absolute >= 1000000 ? 1 : 0,
  });
}

export function normalizeCurrencyList(
  currencies,
  { ensureBase = true, baseCurrency = DEFAULT_BASE_CURRENCY } = {},
) {
  const source = Array.isArray(currencies) ? currencies : [];
  const selected = [];
  const seen = new Set();
  const requiredBase = normalizeCurrencyCode(baseCurrency);

  function addCurrency(currency) {
    const code = normalizeCurrencyCode(currency);
    if (!code || seen.has(code)) return;
    seen.add(code);
    selected.push(code);
  }

  if (ensureBase) addCurrency(requiredBase);
  source.forEach(addCurrency);

  const order = new Map(DEFAULT_ACTIVE_CURRENCIES.map((code, index) => [code, index]));
  selected.sort((left, right) => {
    const leftOrder = order.has(left) ? order.get(left) : Number.MAX_SAFE_INTEGER;
    const rightOrder = order.has(right) ? order.get(right) : Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder || left.localeCompare(right);
  });

  return selected.length ? selected : [DEFAULT_BASE_CURRENCY];
}

export function getCurrencyOptions(currencies) {
  const source = Array.isArray(currencies) ? currencies : normalizeCurrencyList(currencies);
  return source.map((currency) => {
    const code = normalizeCurrencyCode(currency);
    return { value: code, label: getCurrencyMeta(code).label };
  });
}
