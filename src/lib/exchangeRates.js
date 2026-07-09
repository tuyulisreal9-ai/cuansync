import {
  DEFAULT_ACTIVE_CURRENCIES,
  DEFAULT_BASE_CURRENCY,
  normalizeCurrencyCode,
  normalizeCurrencyList,
} from "./currency.js";

export const GLOBAL_EXCHANGE_RATES_STORAGE_KEY = "cuansync-global-exchange-rates";
export const GLOBAL_EXCHANGE_RATES_PROVIDER = "exchangerate-api-open";
export const GLOBAL_EXCHANGE_RATES_TTL_MS = 1000 * 60 * 60 * 6;

export function normalizeGlobalRateSnapshot(snapshot, baseCurrency = DEFAULT_BASE_CURRENCY) {
  const base = normalizeCurrencyCode(snapshot?.baseCurrency || snapshot?.base || baseCurrency);
  const rates = Object.entries(snapshot?.rates || {}).reduce((acc, [currency, rate]) => {
    const code = normalizeCurrencyCode(currency);
    const numericRate = Number(rate || 0);
    if (code !== base && numericRate > 0) acc[code] = numericRate;
    return acc;
  }, {});

  return {
    provider: snapshot?.provider || GLOBAL_EXCHANGE_RATES_PROVIDER,
    baseCurrency: base,
    rates,
    fetchedAt: snapshot?.fetchedAt || snapshot?.fetched_at || null,
    sourceDate: snapshot?.sourceDate || snapshot?.date || snapshot?.source_date || null,
  };
}

export function isGlobalRateSnapshotFresh(snapshot, now = Date.now()) {
  if (!snapshot?.fetchedAt) return false;
  const fetchedAt = new Date(snapshot.fetchedAt).getTime();
  if (!Number.isFinite(fetchedAt)) return false;
  return now - fetchedAt < GLOBAL_EXCHANGE_RATES_TTL_MS;
}

export function hasGlobalRatesForCurrencies(
  snapshot,
  currencies = DEFAULT_ACTIVE_CURRENCIES,
  baseCurrency = DEFAULT_BASE_CURRENCY,
) {
  const normalized = normalizeGlobalRateSnapshot(snapshot, baseCurrency);
  const base = normalizeCurrencyCode(baseCurrency);
  if (normalized.baseCurrency !== base) return false;

  return normalizeCurrencyList(currencies, {
    ensureBase: false,
    baseCurrency: base,
  }).every((currency) => {
    const code = normalizeCurrencyCode(currency);
    return code === base || Number(normalized.rates?.[code] || 0) > 0;
  });
}

export function getGlobalRateForCurrency(
  snapshot,
  currency,
  baseCurrency = DEFAULT_BASE_CURRENCY,
) {
  const normalized = normalizeGlobalRateSnapshot(snapshot, baseCurrency);
  const code = normalizeCurrencyCode(currency);
  const base = normalizeCurrencyCode(baseCurrency);
  if (code === base) return { rate: 1, source: "base" };
  if (normalized.baseCurrency !== base) return { rate: 0, source: null };

  const rate = Number(normalized.rates?.[code] || 0);
  return {
    rate,
    source: rate > 0 ? "global" : null,
  };
}

export async function fetchGlobalCurrencyRates({
  baseCurrency = DEFAULT_BASE_CURRENCY,
  currencies = DEFAULT_ACTIVE_CURRENCIES,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("Fetch API tidak tersedia.");
  }

  const base = normalizeCurrencyCode(baseCurrency);
  const quoteCurrencies = normalizeCurrencyList(currencies, {
    ensureBase: false,
    baseCurrency: base,
  }).filter((currency) => currency !== base);

  if (!quoteCurrencies.length) {
    return normalizeGlobalRateSnapshot({
      baseCurrency: base,
      rates: {},
      fetchedAt: new Date().toISOString(),
    });
  }

  const response = await fetchImpl(`https://open.er-api.com/v6/latest/${base}`);
  if (!response.ok) {
    throw new Error(`Gagal mengambil global rate (${response.status}).`);
  }

  const data = await response.json();
  if (data.result && data.result !== "success") {
    throw new Error(data["error-type"] || "Global rate API gagal.");
  }

  const rates = {};
  Object.entries(data.rates || {})
    .filter(([currency]) => quoteCurrencies.includes(normalizeCurrencyCode(currency)))
    .forEach(([currency, quotePerBase]) => {
      const code = normalizeCurrencyCode(currency);
      const numericQuote = Number(quotePerBase || 0);
      if (code !== base && numericQuote > 0) {
        rates[code] = 1 / numericQuote;
      }
    });

  return normalizeGlobalRateSnapshot({
    provider: GLOBAL_EXCHANGE_RATES_PROVIDER,
    baseCurrency: base,
    rates,
    fetchedAt: new Date().toISOString(),
    sourceDate: data.time_last_update_utc || data.date,
  });
}
