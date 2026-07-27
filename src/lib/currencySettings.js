import {
  DEFAULT_BASE_CURRENCY,
  DEFAULT_SELECTED_CURRENCIES,
  normalizeCurrencyCode,
  normalizeCurrencyList,
} from "./currency.js";

export function normalizeCurrencySettings(settings, { configured = false } = {}) {
  const baseCurrency = normalizeCurrencyCode(
    settings?.baseCurrency || settings?.base_currency || DEFAULT_BASE_CURRENCY,
  );
  const source = Array.isArray(settings)
    ? settings
    : settings?.activeCurrencies || settings?.currencies || DEFAULT_SELECTED_CURRENCIES;
  const activeCurrencies = normalizeCurrencyList(source, { baseCurrency });
  const normalizedActiveCurrencies = normalizeCurrencyList(
    [baseCurrency, ...activeCurrencies],
    { baseCurrency },
  );
  const requestedDailyCurrency = normalizeCurrencyCode(
    settings?.dailyCurrency ||
      settings?.daily_currency ||
      settings?.defaultExpenseCurrency ||
      settings?.default_expense_currency ||
      normalizedActiveCurrencies[0] ||
      baseCurrency,
  );
  const dailyCurrency = normalizedActiveCurrencies.includes(requestedDailyCurrency)
    ? requestedDailyCurrency
    : normalizedActiveCurrencies[0] || baseCurrency;

  return {
    baseCurrency,
    activeCurrencies: normalizedActiveCurrencies,
    dailyCurrency,
    configured: Boolean(settings?.configured || configured),
  };
}
