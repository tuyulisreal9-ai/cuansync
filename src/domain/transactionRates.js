import { normalizeCurrencyCode } from "../lib/currency.js";
import { getCurrentValuationRateForCurrency } from "./assets.js";
import { getLatestRateForCurrencyUntil } from "./exchange.js";

/* Kurs sebuah transaksi valas dicari berurutan: kurs yang sudah terkunci di
   transaksi lama, kurs yang diisi pengguna, kurs tukar terakhir sebelum
   tanggalnya, lalu kurs global hari ini. Pemasukan dan pengeluaran memakai
   jalur yang sama supaya pemasukan valas tidak pernah tersimpan tanpa kurs
   lalu hilang dari analitik. */
export function resolveTransactionRateInfo({
  currency,
  baseCurrency,
  occurredAt,
  transactions = [],
  globalRateSnapshot = null,
  explicitRate = 0,
  lockedRate = 0,
  storedRateType = null,
  preferCustom = false,
}) {
  const code = normalizeCurrencyCode(currency);
  const base = normalizeCurrencyCode(baseCurrency);
  if (code === base) return { rate: 1, rateType: "base", isBaseCurrency: true };

  if (Number(lockedRate) > 0) {
    return {
      rate: Number(lockedRate),
      rateType:
        storedRateType === "custom" ? "custom" : storedRateType || "historical",
      isBaseCurrency: false,
    };
  }
  if (Number(explicitRate) > 0) {
    return {
      rate: Number(explicitRate),
      rateType: preferCustom ? "custom" : "realtime",
      isBaseCurrency: false,
    };
  }

  const historicalRate = getLatestRateForCurrencyUntil(
    transactions,
    code,
    occurredAt,
    base,
  );
  if (historicalRate > 0) {
    return { rate: historicalRate, rateType: "historical", isBaseCurrency: false };
  }

  const automaticRate = getCurrentValuationRateForCurrency(
    globalRateSnapshot,
    code,
    base,
  ).rate;
  if (automaticRate > 0) {
    return { rate: automaticRate, rateType: "realtime", isBaseCurrency: false };
  }
  return { rate: 0, rateType: null, isBaseCurrency: false };
}

/* Nilai ekuivalen mata uang dasar disimpan bersama kursnya supaya histori
   tetap konsisten meski kurs berubah setelahnya. */
export function applyTransactionRateToRecord(record, amount, rateInfo) {
  const usableRate = rateInfo.rate > 0;
  record.rate = rateInfo.isBaseCurrency || !usableRate ? null : rateInfo.rate;
  record.locked_rate = record.rate;
  record.rate_type = rateInfo.rateType;
  record.base_amount = rateInfo.isBaseCurrency
    ? amount
    : usableRate
      ? amount * rateInfo.rate
      : null;
  record.amount_idr = record.base_amount;
  return record;
}
