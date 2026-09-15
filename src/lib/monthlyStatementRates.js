import {
  fetchGlobalCurrencyRates,
  hasGlobalRatesForCurrencies,
} from "./exchangeRates.js";
import { getStatementMissingRateCurrencies } from "../components/transactions/monthlyStatement.js";

// Only currency codes leave the device; no amounts, accounts, or transactions.
export async function loadMonthlyStatementRates(statement, {
  fetchRates = fetchGlobalCurrencyRates,
  timeoutMs = 12_000,
} = {}) {
  const currencies = getStatementMissingRateCurrencies(statement);
  if (!currencies.length) return null;
  const controller = new AbortController();
  let timeout;
  try {
    const snapshot = await Promise.race([
      fetchRates({
        baseCurrency: statement.baseCurrency,
        currencies,
        fetchImpl: (url) => globalThis.fetch(url, { signal: controller.signal }),
      }),
      new Promise((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new Error("Pengambilan kurs terlalu lama."));
        }, timeoutMs);
      }),
    ]);
    if (!hasGlobalRatesForCurrencies(snapshot, currencies, statement.baseCurrency) ||
        currencies.some((currency) => !Number.isFinite(Number(snapshot.rates?.[currency]))) ||
        !snapshot.sourceDate || !Number.isFinite(new Date(snapshot.sourceDate).getTime())) {
      throw new Error("Data kurs belum lengkap.");
    }
    return snapshot;
  } catch {
    throw new Error(
      `Kurs terbaru ${currencies.join(", ")} belum bisa dimuat. Periksa koneksi lalu coba lagi agar total ${statement.baseCurrency} lengkap.`,
    );
  } finally {
    clearTimeout(timeout);
  }
}
