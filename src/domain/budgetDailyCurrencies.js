import { getGlobalRateForCurrency } from "../lib/exchangeRates.js";
import { DEFAULT_BASE_CURRENCY, normalizeCurrencyCode } from "../lib/currency.js";

/* Jatah tetap dihitung sekali dalam mata uang utama. Mata uang lain hanya
   menampilkan nilai setaranya dengan kurs terbaru yang tersedia; angka ini
   bukan jatah terpisah yang boleh dijumlahkan lagi. */
export function buildDailyBudgetCurrencyViews({
  remaining = 0,
  daysLeft = 0,
  baseCurrency = DEFAULT_BASE_CURRENCY,
  activeCurrencies = [],
  globalRateSnapshot = null,
} = {}) {
  const base = normalizeCurrencyCode(baseCurrency);
  const safeRemaining = Math.max(0, Number(remaining) || 0);
  const days = Math.max(1, Math.floor(Number(daysLeft) || 0));
  const dailyBase = safeRemaining / days;
  const currencies = [
    ...new Set([base, ...activeCurrencies.map((code) => normalizeCurrencyCode(code))]),
  ];

  return currencies.flatMap((currency) => {
    const rate = currency === base
      ? 1
      : Number(getGlobalRateForCurrency(globalRateSnapshot, currency, base).rate || 0);
    if (!Number.isFinite(rate) || rate <= 0) return [];
    return [{ currency, amount: dailyBase / rate, isEstimate: currency !== base }];
  });
}
