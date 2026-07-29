import {
  DEFAULT_BASE_CURRENCY,
  formatCurrency,
  formatPercent,
  normalizeCurrencyCode,
  normalizeCurrencyList,
} from "../lib/currency.js";
import { getMonthMeta } from "../lib/dates.js";

export function getControlCurrency(metrics, selectedCurrency) {
  const activeCurrencies = normalizeCurrencyList(metrics.activeCurrencies, {
    baseCurrency: DEFAULT_BASE_CURRENCY,
  });
  const requested = normalizeCurrencyCode(selectedCurrency || activeCurrencies[0]);
  return activeCurrencies.includes(requested) ? requested : activeCurrencies[0];
}

export function buildControlCenter(
  metrics,
  selectedCurrency = DEFAULT_BASE_CURRENCY,
) {
  const monthMeta = getMonthMeta(metrics.currentMonthKey);
  const remainingDays = Math.max(
    monthMeta.daysInMonth - monthMeta.elapsedDays,
    0,
  );
  const currency = getControlCurrency(metrics, selectedCurrency);
  const activeBudget =
    metrics.budgetInsights.find((item) => item.currency === currency) || null;
  const currencyBalance =
    currency === DEFAULT_BASE_CURRENCY
      ? metrics.balanceIdr
      : Number(metrics.currencyBalances?.[currency] || 0);
  const currencySpent = Number(
    metrics.monthlyExpenseByCurrency?.[currency] || 0,
  );
  const currencyDailyAverage =
    monthMeta.elapsedDays > 0 ? currencySpent / monthMeta.elapsedDays : 0;
  const currencyRunwayDays =
    currencyDailyAverage > 0
      ? Math.floor(currencyBalance / currencyDailyAverage)
      : null;
  const projectedExpenseIdr =
    metrics.averageDailyExpenseIdr * monthMeta.daysInMonth;
  const projectedNetIdr =
    metrics.monthlyExternalIncomeIdr - projectedExpenseIdr;
  const projectedCurrencyNeed = currencyDailyAverage * remainingDays;
  const projectedCurrencyGap = Math.max(
    projectedCurrencyNeed - currencyBalance,
    0,
  );
  const topCategory = metrics.topExpenseCategory;

  let score = 100;
  if (!activeBudget) score -= 8;
  if (activeBudget?.status === "warning") score -= 16;
  if (activeBudget?.status === "over") score -= 30;
  if (metrics.monthlyNetChangeIdr < 0) score -= 14;
  if (projectedNetIdr < 0) score -= 12;
  if (
    currency === DEFAULT_BASE_CURRENCY &&
    currencyBalance < metrics.averageDailyExpenseIdr * 7
  ) {
    score -= 10;
  }
  if (currencyRunwayDays != null && currencyRunwayDays < 3) score -= 18;
  else if (currencyRunwayDays != null && currencyRunwayDays < 7) score -= 10;
  if (topCategory?.share > 0.45) score -= 6;

  const controlScore = Math.max(Math.min(Math.round(score), 100), 0);
  const controlLabel =
    controlScore >= 82
      ? "Terkendali"
      : controlScore >= 66
        ? "Perlu dijaga"
        : controlScore >= 45
          ? "Waspada"
          : "Butuh tindakan";
  const controlTone =
    controlScore >= 82
      ? "text-brand-700 dark:text-brand-300"
      : controlScore >= 66
        ? "text-amber-700 dark:text-amber-300"
        : "text-rose-700 dark:text-rose-300";

  const alerts = [];
  if (!activeBudget) {
    alerts.push({
      title: `Anggaran ${currency} belum aktif`,
      body: `Buat batas ${currency} untuk menghitung sisa harian.`,
      tone: "amber",
    });
  } else if (activeBudget.status === "over") {
    alerts.push({
      title: `Anggaran ${currency} melewati batas`,
      body: `Pengeluaran ${currency} sudah ${formatPercent(activeBudget.usage)} dari anggaran bulan ini.`,
      tone: "rose",
    });
  } else if (activeBudget.status === "warning") {
    alerts.push({
      title: `Anggaran ${currency} mendekati batas`,
      body: `Sisa anggaran sekitar ${formatCurrency(Math.max(activeBudget.remainingAmount, 0), currency)}.`,
      tone: "amber",
    });
  }

  if (currencyRunwayDays != null && currencyRunwayDays <= 7) {
    alerts.push({
      title: `Saldo ${currency} perlu dipantau`,
      body: `Dengan ritme sekarang, saldo ${currency} cukup sekitar ${Math.max(currencyRunwayDays, 0)} hari.`,
      tone: currencyRunwayDays <= 3 ? "rose" : "amber",
    });
  }

  if (projectedNetIdr < 0) {
    alerts.push({
      title: "Arus kas negatif",
      body: `Jika ritme sama, bulan ini bisa ${formatCurrency(projectedNetIdr, "idr")}.`,
      tone: "rose",
    });
  }

  if (topCategory?.share > 0.45) {
    alerts.push({
      title: "Kategori dominan",
      body: `${topCategory.label} mengambil ${formatPercent(topCategory.share)} dari pengeluaran bulan ini.`,
      tone: "amber",
    });
  }

  if (!alerts.length) {
    alerts.push({
      title: "Tidak ada risiko besar",
      body: "Arus kas, anggaran, dan saldo masih terlihat terkendali untuk saat ini.",
      tone: "emerald",
    });
  }

  const nextActions = [];
  if (!activeBudget) {
    nextActions.push({
      title: `Buat anggaran ${currency}`,
      body: "Agar sisa harian bisa dihitung.",
      target: "control-budget",
    });
  }
  if (
    projectedCurrencyGap > 0 &&
    currency !== DEFAULT_BASE_CURRENCY
  ) {
    nextActions.push({
      title: `Rencanakan tukar ke ${currency}`,
      body: `Estimasi kurang ${formatCurrency(projectedCurrencyGap, currency)} sampai akhir bulan.`,
      target: "add",
    });
  }
  if (
    activeBudget?.todayRemainingSafe != null &&
    activeBudget.todayRemainingSafe < 0
  ) {
    nextActions.push({
      title: `Tahan belanja ${currency} hari ini`,
      body: `Hari ini lewat ${formatCurrency(Math.abs(activeBudget.todayRemainingSafe), currency)} dari batas aman.`,
      target: "history",
    });
  }
  if (topCategory) {
    nextActions.push({
      title: `Cek ${topCategory.label}`,
      body: "Kategori terbesar bulan ini.",
      target: "history",
    });
  }
  if (!nextActions.length) {
    nextActions.push({
      title: "Catat transaksi",
      body: "Jaga ringkasan tetap akurat dengan pencatatan langsung.",
      target: "add",
    });
  }

  return {
    activeBudget,
    alerts: alerts.slice(0, 4),
    controlLabel,
    controlScore,
    controlTone,
    currency,
    currencyBalance,
    currencyDailyAverage,
    currencyRunwayDays,
    currencySpent,
    nextActions: nextActions.slice(0, 4),
    projectedCurrencyGap,
    projectedExpenseIdr,
    projectedNetIdr,
    remainingDays,
  };
}
