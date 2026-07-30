import {
  DEFAULT_BASE_CURRENCY,
  HIDDEN_BALANCE_TEXT,
  formatCurrency,
  normalizeCurrencyCode,
} from "../lib/currency.js";
import { formatMonthKey } from "../lib/dates.js";
import { isAllocatableAssetAccount } from "./assets.js";
import {
  getTransactionCurrency,
  resolveTransactionFeeHistoricalBaseValue,
  resolveTransactionHistoricalBaseValue,
} from "./transactions.js";

const LIQUID_ACCOUNT_TYPES = new Set(["bank", "cash", "ewallet"]);
const MIN_PACE_ELAPSED_DAYS = 3;
const MIN_PACE_TRANSACTION_COUNT = 2;
const FAST_PACE_MARGIN = 0.12;
const NEAR_LIMIT_USAGE = 0.85;

export const CONTROL_SCORING_SPEC = Object.freeze({
  version: 1,
  pillars: Object.freeze({
    budget: Object.freeze({
      key: "budget",
      label: "Anggaran & Ritme Belanja",
      weight: 30,
      availableWhen: "Ada anggaran kategori pada bulan berjalan.",
      unavailableWhen: "Belum ada anggaran bulan berjalan.",
      penalties: Object.freeze({
        overCategory: 40,
        projectedOverCategory: 25,
        fastPaceCategory: 12,
      }),
    }),
    cashFlow: Object.freeze({
      key: "cashFlow",
      label: "Arus Kas & Rasio Tabungan",
      weight: 30,
      availableWhen:
        "Ada pemasukan dan semua transaksi bulan berjalan dapat dinilai historis.",
      unavailableWhen:
        "Pemasukan nol atau ada transaksi yang tidak memiliki nilai historis aman.",
      thresholds: Object.freeze([
        { minimumRatio: 0.2, score: 100, status: "Sehat" },
        { minimumRatio: 0.1, score: 85, status: "Cukup sehat" },
        { minimumRatio: 0, score: 70, status: "Seimbang" },
        { minimumRatio: -0.1, score: 45, status: "Perlu perhatian" },
        { minimumRatio: Number.NEGATIVE_INFINITY, score: 20, status: "Defisit" },
      ]),
    }),
    runway: Object.freeze({
      key: "runway",
      label: "Daya Tahan Dana",
      weight: 25,
      availableWhen:
        "Dana likuid bebas dan rata-rata pengeluaran historis atau acuan anggaran tersedia.",
      unavailableWhen:
        "Dana likuid atau acuan pengeluaran belum dapat dihitung dengan aman.",
      thresholds: Object.freeze([
        { minimumMonths: 6, score: 100, status: "Kuat" },
        { minimumMonths: 3, score: 80, status: "Cukup" },
        { minimumMonths: 1, score: 55, status: "Terbatas" },
        { minimumMonths: 0, score: 25, status: "Rentan" },
      ]),
    }),
    commitments: Object.freeze({
      key: "commitments",
      label: "Komitmen Rutin & Remittance",
      weight: 15,
      availableWhen:
        "Komitmen rutin atau remittance eksternal memiliki penanda dan batas terverifikasi.",
      unavailableWhen:
        "Skema saat ini belum membedakan tagihan rutin dan remittance eksternal.",
    }),
  }),
  completeness: Object.freeze({
    budget: 25,
    cashFlow: 25,
    runway: 25,
    commitments: 15,
    explicitTimezone: 10,
  }),
});

function clamp(value, minimum = 0, maximum = 100) {
  return Math.min(Math.max(Number(value || 0), minimum), maximum);
}

function getZonedDateParts(value = new Date(), timeZone = null) {
  const date = new Date(value);
  if (!timeZone) {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
    };
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const lookup = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: lookup.year,
    month: lookup.month,
    day: lookup.day,
  };
}

export function getControlMonthKey(value = new Date(), timeZone = null) {
  const parts = getZonedDateParts(value, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}`;
}

function getControlMonthMeta(monthKey, now, timeZone) {
  const [year, month] = String(monthKey).split("-").map(Number);
  const currentParts = getZonedDateParts(now, timeZone);
  const currentKey = `${currentParts.year}-${String(currentParts.month).padStart(2, "0")}`;
  const daysInMonth = new Date(year, month, 0).getDate();
  const elapsedDays =
    currentKey === monthKey ? currentParts.day : daysInMonth;
  return {
    currentKey,
    daysInMonth,
    elapsedDays: Math.max(Math.min(elapsedDays, daysInMonth), 1),
    remainingDays: Math.max(daysInMonth - elapsedDays, 0),
    monthProgress: elapsedDays / daysInMonth,
  };
}

function shiftMonthKey(monthKey, offset) {
  const [year, month] = String(monthKey).split("-").map(Number);
  const shifted = new Date(year, month - 1 + offset, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}`;
}

function isInMonth(transaction, monthKey, timeZone) {
  return (
    transaction?.occurred_at &&
    getControlMonthKey(transaction.occurred_at, timeZone) === monthKey
  );
}

function getHistoricalFlowTotals(
  transactions,
  monthKey,
  baseCurrency,
  timeZone,
) {
  const totals = {
    income: 0,
    externalExpenses: 0,
    feeExpenses: 0,
    incomeCount: 0,
    expenseCount: 0,
    feeCount: 0,
    missingValuationCount: 0,
  };

  transactions
    .filter((transaction) => isInMonth(transaction, monthKey, timeZone))
    .forEach((transaction) => {
      if (transaction.type === "income") {
        const value = resolveTransactionHistoricalBaseValue(
          transaction,
          baseCurrency,
        );
        if (value == null) {
          totals.missingValuationCount += 1;
          return;
        }
        totals.income += value;
        totals.incomeCount += 1;
        return;
      }

      if (transaction.type === "expense") {
        const value = resolveTransactionHistoricalBaseValue(
          transaction,
          baseCurrency,
        );
        if (value == null) {
          totals.missingValuationCount += 1;
          return;
        }
        totals.externalExpenses += value;
        totals.expenseCount += 1;
        return;
      }

      if (transaction.type === "exchange") {
        const feeAmount = Math.abs(Number(transaction.fee_amount || 0));
        if (feeAmount <= 0) return;
        const feeValue = resolveTransactionFeeHistoricalBaseValue(
          transaction,
          baseCurrency,
        );
        if (feeValue == null) {
          totals.missingValuationCount += 1;
          return;
        }
        totals.externalExpenses += feeValue;
        totals.feeExpenses += feeValue;
        totals.feeCount += 1;
      }
    });

  return totals;
}

function getBudgetPace(budget, monthMeta) {
  const limit = Number(budget.limitAmount || 0);
  const spent = Number(budget.spentAmount || 0);
  const usage = limit > 0 ? spent / limit : 0;
  const transactionCount = Number(budget.transactionCount || 0);
  const enoughData =
    monthMeta.elapsedDays >= MIN_PACE_ELAPSED_DAYS &&
    transactionCount >= MIN_PACE_TRANSACTION_COUNT &&
    spent > 0;
  const projectedSpending = enoughData
    ? (spent / monthMeta.elapsedDays) * monthMeta.daysInMonth
    : null;

  let paceStatus = "on_track";
  let statusLabel = "Sesuai ritme";
  let attentionRank = 99;

  if (spent <= 0 || transactionCount <= 0) {
    paceStatus = "no_transactions";
    statusLabel = "Belum ada transaksi";
  } else if (usage > 1 || Number(budget.remainingAmount || 0) < 0) {
    paceStatus = "over";
    statusLabel = "Melewati batas";
    attentionRank = 1;
  } else if (projectedSpending != null && projectedSpending > limit) {
    paceStatus = "projected_over";
    statusLabel = "Diperkirakan melewati batas";
    attentionRank = 2;
  } else if (
    enoughData &&
    usage > monthMeta.monthProgress + FAST_PACE_MARGIN
  ) {
    paceStatus = "too_fast";
    statusLabel = "Pemakaian terlalu cepat";
    attentionRank = 3;
  } else if (usage >= NEAR_LIMIT_USAGE) {
    paceStatus = "near_limit";
    statusLabel = "Mendekati batas";
    attentionRank = 4;
  }

  const dailyAverage =
    monthMeta.elapsedDays > 0 ? spent / monthMeta.elapsedDays : 0;
  const daysUntilLimit =
    dailyAverage > 0 && limit > spent
      ? Math.floor((limit - spent) / dailyAverage)
      : paceStatus === "over"
        ? 0
        : null;
  const daysEarly =
    daysUntilLimit == null
      ? null
      : Math.max(monthMeta.remainingDays - daysUntilLimit, 0);
  const impact = Math.max(
    spent,
    spent - limit,
    projectedSpending == null ? 0 : projectedSpending - limit,
  );

  return {
    ...budget,
    limitAmount: limit,
    spentAmount: spent,
    usage,
    enoughPaceData: enoughData,
    projectedSpending,
    paceStatus,
    statusLabel,
    attentionRank,
    daysUntilLimit,
    daysEarly,
    impact,
  };
}

function buildBudgetSummary(metrics, baseCurrency, monthMeta) {
  const categories = (metrics.budgetInsights || [])
    .filter(
      (budget) =>
        normalizeCurrencyCode(
          budget.baseCurrency || budget.base_currency || budget.currency,
        ) === baseCurrency,
    )
    .map((budget) => getBudgetPace(budget, monthMeta));
  const limitAmount = categories.reduce(
    (sum, category) => sum + category.limitAmount,
    0,
  );
  const spentAmount = categories.reduce(
    (sum, category) => sum + category.spentAmount,
    0,
  );
  const remainingAmount = limitAmount - spentAmount;
  const attentionCategories = categories
    .filter((category) => category.attentionRank < 99)
    .sort(
      (a, b) =>
        a.attentionRank - b.attentionRank ||
        b.impact - a.impact ||
        a.categoryLabel.localeCompare(b.categoryLabel),
    );

  return {
    available: categories.length > 0,
    currency: baseCurrency,
    categories,
    attentionCategories: attentionCategories.slice(0, 3),
    attentionCount: attentionCategories.length,
    safeCount: categories.filter(
      (category) => category.attentionRank === 99,
    ).length,
    warningCount: categories.filter(
      (category) =>
        category.paceStatus === "too_fast" ||
        category.paceStatus === "near_limit",
    ).length,
    projectedOverCount: categories.filter(
      (category) => category.paceStatus === "projected_over",
    ).length,
    overCount: categories.filter(
      (category) => category.paceStatus === "over",
    ).length,
    limitAmount,
    spentAmount,
    remainingAmount,
    usage: limitAmount > 0 ? spentAmount / limitAmount : 0,
  };
}

function buildCurrencyRateMap(metrics, baseCurrency) {
  const rates = { [baseCurrency]: 1 };
  (metrics.assetAccountInsights || []).forEach((account) => {
    const currency = normalizeCurrencyCode(account.currency);
    const rate = Number(account.rate || 0);
    if (currency !== baseCurrency && rate > 0) rates[currency] = rate;
  });
  (metrics.foreignBalanceItems || []).forEach((item) => {
    const currency = normalizeCurrencyCode(item.currency);
    const rate = Number(item.rate || 0);
    if (currency !== baseCurrency && rate > 0) rates[currency] = rate;
  });
  return rates;
}

function buildLiquiditySummary(metrics, baseCurrency) {
  const rates = buildCurrencyRateMap(metrics, baseCurrency);
  let eligibleLiquidFunds = 0;
  let missingAccountValuations = 0;
  let eligibleAccountCount = 0;

  (metrics.assetAccountInsights || []).forEach((account) => {
    const liquidType = LIQUID_ACCOUNT_TYPES.has(account.account_type);
    if (!liquidType || !isAllocatableAssetAccount(account)) return;
    eligibleAccountCount += 1;
    const currency = normalizeCurrencyCode(account.currency);
    const balance = Number(
      account.balanceAmount ?? account.balance_amount ?? 0,
    );
    if (currency === baseCurrency) {
      eligibleLiquidFunds += balance;
      return;
    }
    const rate = Number(rates[currency] || 0);
    if (rate <= 0) {
      missingAccountValuations += 1;
      return;
    }
    eligibleLiquidFunds += balance * rate;
  });

  const allocationSummaries = metrics.goalAllocationSummaries || {};
  let reservedTargetFunds = 0;
  let missingTargetValuations = 0;
  Object.values(allocationSummaries).forEach((summary) => {
    const allocatedAmount = Number(summary?.allocatedAmount || 0);
    if (allocatedAmount <= 0) return;
    const currency = normalizeCurrencyCode(summary.currency);
    const rate = Number(rates[currency] || 0);
    if (currency !== baseCurrency && rate <= 0) {
      missingTargetValuations += 1;
      return;
    }
    reservedTargetFunds +=
      currency === baseCurrency ? allocatedAmount : allocatedAmount * rate;
  });

  const complete =
    eligibleAccountCount > 0 &&
    missingAccountValuations === 0 &&
    missingTargetValuations === 0;

  return {
    complete,
    eligibleAccountCount,
    eligibleLiquidFunds,
    reservedTargetFunds,
    freeLiquidFunds: eligibleLiquidFunds - reservedTargetFunds,
    missingAccountValuations,
    missingTargetValuations,
    classification:
      "Akun bank, cash, atau e-wallet yang dapat dialokasikan.",
  };
}

function getCashFlowScore(savingsRatio) {
  const threshold =
    CONTROL_SCORING_SPEC.pillars.cashFlow.thresholds.find(
      (item) => savingsRatio >= item.minimumRatio,
    ) || CONTROL_SCORING_SPEC.pillars.cashFlow.thresholds.at(-1);
  return {
    score: threshold.score,
    status: threshold.status,
  };
}

function buildCashFlowSummary(
  transactions,
  monthKey,
  baseCurrency,
  timeZone,
) {
  const totals = getHistoricalFlowTotals(
    transactions,
    monthKey,
    baseCurrency,
    timeZone,
  );
  const netCashFlow = totals.income - totals.externalExpenses;
  const savingsRatio =
    totals.income > 0 ? netCashFlow / totals.income : null;
  const complete = totals.missingValuationCount === 0;
  const evaluable = complete && totals.income > 0;
  const scored = evaluable
    ? getCashFlowScore(savingsRatio)
    : { score: null, status: "Belum dapat dinilai" };

  return {
    ...totals,
    complete,
    evaluable,
    netCashFlow,
    savingsRatio,
    score: scored.score,
    status: scored.status,
  };
}

function buildRunwaySummary({
  metrics,
  transactions,
  monthKey,
  baseCurrency,
  timeZone,
  liquidity,
  budget,
}) {
  const historicalMonths = [-3, -2, -1].map((offset) =>
    shiftMonthKey(monthKey, offset),
  );
  const monthTotals = historicalMonths.map((historicalMonthKey) => ({
    monthKey: historicalMonthKey,
    ...getHistoricalFlowTotals(
      transactions,
      historicalMonthKey,
      baseCurrency,
      timeZone,
    ),
  }));
  const hasThreeFullMonths = monthTotals.every(
    (item) =>
      item.expenseCount + item.feeCount > 0 &&
      item.missingValuationCount === 0,
  );
  const historicalBurn = hasThreeFullMonths
    ? monthTotals.reduce(
        (sum, item) => sum + item.externalExpenses,
        0,
      ) / 3
    : null;
  const monthlyBurn =
    historicalBurn != null && historicalBurn > 0
      ? historicalBurn
      : budget.limitAmount > 0
        ? budget.limitAmount
        : null;
  const burnSource =
    historicalBurn != null && historicalBurn > 0
      ? "three_month_history"
      : budget.limitAmount > 0
        ? "budget_fallback"
        : "unavailable";
  const evaluable =
    liquidity.complete &&
    monthlyBurn != null &&
    monthlyBurn > 0;
  const months = evaluable
    ? liquidity.freeLiquidFunds / monthlyBurn
    : null;
  const threshold =
    months == null
      ? null
      : CONTROL_SCORING_SPEC.pillars.runway.thresholds.find(
          (item) => months >= item.minimumMonths,
        );

  return {
    evaluable,
    status: threshold?.status || "Belum dapat dinilai",
    score: threshold?.score ?? null,
    months,
    monthlyBurn,
    burnSource,
    historicalMonths,
    hasThreeFullMonths,
    freeLiquidFunds: liquidity.freeLiquidFunds,
  };
}

function buildCommitmentSummary(
  transactions,
  monthKey,
  baseCurrency,
  timeZone,
) {
  let tagihanSpent = 0;
  let missingValuationCount = 0;
  transactions
    .filter(
      (transaction) =>
        transaction.type === "expense" &&
        transaction.category === "Tagihan" &&
        isInMonth(transaction, monthKey, timeZone),
    )
    .forEach((transaction) => {
      const value = resolveTransactionHistoricalBaseValue(
        transaction,
        baseCurrency,
      );
      if (value == null) {
        missingValuationCount += 1;
        return;
      }
      tagihanSpent += value;
    });

  const flowTotals = getHistoricalFlowTotals(
    transactions,
    monthKey,
    baseCurrency,
    timeZone,
  );

  return {
    evaluable: false,
    status: "Belum dapat dinilai",
    score: null,
    tagihanSpent,
    verifiedFeeAmount: flowTotals.feeExpenses,
    missingValuationCount,
    recurringSupported: false,
    externalRemittanceSupported: false,
    reason:
      "Komitmen rutin dan remittance eksternal belum memiliki penanda terverifikasi.",
  };
}

function buildExposureSummary(metrics, baseCurrency) {
  const items = (metrics.assetAccountInsights || [])
    .map((account) => ({
      currency: normalizeCurrencyCode(account.currency),
      value: Number(account.valuationIdr || 0),
    }))
    .reduce((map, item) => {
      map.set(
        item.currency,
        Number(map.get(item.currency) || 0) + item.value,
      );
      return map;
    }, new Map());
  const total = [...items.values()].reduce(
    (sum, value) => sum + value,
    0,
  );
  const shares = [...items.entries()]
    .map(([currency, value]) => ({
      currency,
      value,
      share: total > 0 ? value / total : 0,
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);
  const dominant = shares[0] || null;

  return {
    available: shares.length > 0,
    total,
    shares,
    dominantCurrency: dominant?.currency || null,
    insight: dominant
      ? dominant.currency === baseCurrency
        ? `Sebagian besar aset berada dalam ${baseCurrency}. Nilai mata uang lain tetap dapat berubah mengikuti kurs.`
        : `Sebagian besar aset berada dalam ${dominant.currency}, sedangkan anggaran memakai ${baseCurrency}. Nilainya dapat berubah mengikuti kurs.`
      : "Eksposur mata uang belum dapat diringkas.",
  };
}

function getBudgetScore(budget) {
  if (!budget.available) return null;
  const penalties = CONTROL_SCORING_SPEC.pillars.budget.penalties;
  return clamp(
    100 -
      budget.overCount * penalties.overCategory -
      budget.projectedOverCount * penalties.projectedOverCategory -
      budget.warningCount * penalties.fastPaceCategory,
  );
}

function getBudgetStatus(budget) {
  if (!budget.available) return "Belum dapat dinilai";
  if (budget.overCount > 0) return "Melewati batas";
  if (budget.projectedOverCount > 0) return "Berisiko";
  if (budget.warningCount > 0) return "Perlu perhatian";
  return "Sesuai ritme";
}

function getBudgetMetric(budget) {
  if (!budget.available) return "Belum ada anggaran";
  if (budget.overCount > 0) {
    return `${budget.overCount} kategori melewati batas`;
  }
  if (budget.projectedOverCount > 0) {
    return `${budget.projectedOverCount} kategori diproyeksikan lewat`;
  }
  return `${Math.round(budget.usage * 100)}% anggaran terpakai`;
}

function getCashFlowMetric(cashFlow) {
  if (!cashFlow.evaluable) return "Rasio belum dapat dihitung";
  const percentage = Math.round(cashFlow.savingsRatio * 100);
  return `${percentage}% rasio tabungan`;
}

function getRunwayMetric(runway) {
  if (!runway.evaluable) return "Acuan pengeluaran belum tersedia";
  return `${runway.months.toLocaleString("id-ID", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} bulan`;
}

function getRecommendation({
  budget,
  cashFlow,
  runway,
  safeToSpend,
  completeness,
}) {
  const firstOver = budget.attentionCategories.find(
    (category) => category.paceStatus === "over",
  );
  const firstProjected = budget.attentionCategories.find(
    (category) => category.paceStatus === "projected_over",
  );

  if (safeToSpend.available && safeToSpend.amount < 0) {
    return {
      code: "negative_safe_to_spend",
      title: "Sesuaikan rencana bulan ini",
      body: "Dana bebas atau sisa anggaran sudah berada di bawah kebutuhan bulan berjalan.",
      target: "budget",
      categoryKey: firstOver?.categoryKey || null,
    };
  }
  if (firstOver) {
    return {
      code: "category_over",
      title: `Tinjau ${firstOver.categoryLabel}`,
      body: "Kategori ini sudah melewati batas bulan berjalan.",
      target: "budget",
      categoryKey: firstOver.categoryKey,
    };
  }
  if (firstProjected) {
    return {
      code: "category_projected_over",
      title: `Kurangi ${firstProjected.categoryLabel}`,
      body:
        firstProjected.daysEarly > 0
          ? `Dengan ritme sekarang, anggaran diperkirakan habis ${firstProjected.daysEarly} hari lebih awal.`
          : "Dengan ritme sekarang, anggaran diperkirakan melewati batas.",
      target: "budget",
      categoryKey: firstProjected.categoryKey,
    };
  }
  if (cashFlow.evaluable && cashFlow.netCashFlow < 0) {
    return {
      code: "negative_cash_flow",
      title: "Perbaiki arus kas bulan ini",
      body: "Pengeluaran eksternal lebih besar daripada pemasukan.",
      target: "history",
      categoryKey: null,
    };
  }
  if (runway.evaluable && runway.months < 1) {
    return {
      code: "low_runway",
      title: "Perkuat dana bebas",
      body: "Dana bebas diperkirakan belum cukup untuk satu bulan pengeluaran.",
      target: "budget",
      categoryKey: null,
    };
  }
  if (!budget.available) {
    return {
      code: "missing_budget",
      title: "Buat anggaran bulan ini",
      body: "Anggaran diperlukan untuk menghitung sisa aman.",
      target: "budget",
      categoryKey: null,
    };
  }
  if (completeness < 100) {
    return {
      code: "incomplete_data",
      title: "Lengkapi data keuangan",
      body: "Sebagian analisis belum dapat dinilai tanpa data historis atau komitmen yang terverifikasi.",
      target: "history",
      categoryKey: null,
    };
  }
  return {
    code: "no_urgent_issue",
    title: "Tidak ada masalah mendesak",
    body: "Anggaran, arus kas, dan dana bebas masih sesuai rencana.",
    target: "history",
    categoryKey: null,
  };
}

function buildScoring({
  budget,
  cashFlow,
  runway,
  commitments,
  explicitTimezone,
}) {
  const budgetScore = getBudgetScore(budget);
  const pillars = [
    {
      ...CONTROL_SCORING_SPEC.pillars.budget,
      evaluable: budgetScore != null,
      score: budgetScore,
      status: getBudgetStatus(budget),
      metric: getBudgetMetric(budget),
    },
    {
      ...CONTROL_SCORING_SPEC.pillars.cashFlow,
      evaluable: cashFlow.evaluable,
      score: cashFlow.score,
      status: cashFlow.status,
      metric: getCashFlowMetric(cashFlow),
    },
    {
      ...CONTROL_SCORING_SPEC.pillars.runway,
      evaluable: runway.evaluable,
      score: runway.score,
      status: runway.status,
      metric: getRunwayMetric(runway),
    },
    {
      ...CONTROL_SCORING_SPEC.pillars.commitments,
      evaluable: commitments.evaluable,
      score: commitments.score,
      status: commitments.status,
      metric: commitments.evaluable
        ? "Komitmen terverifikasi"
        : "Data tagihan rutin belum tersedia",
    },
  ];
  const completenessSpec = CONTROL_SCORING_SPEC.completeness;
  const completeness = clamp(
    (budget.available ? completenessSpec.budget : 0) +
      (cashFlow.evaluable ? completenessSpec.cashFlow : 0) +
      (runway.evaluable ? completenessSpec.runway : 0) +
      (commitments.evaluable ? completenessSpec.commitments : 0) +
      (explicitTimezone ? completenessSpec.explicitTimezone : 0),
  );
  const allPillarsEvaluable = pillars.every((pillar) => pillar.evaluable);
  const score = allPillarsEvaluable
    ? Math.round(
        pillars.reduce(
          (sum, pillar) =>
            sum + (pillar.score / 100) * pillar.weight,
          0,
        ),
      )
    : null;

  return {
    specificationVersion: CONTROL_SCORING_SPEC.version,
    pillars,
    score,
    status:
      score == null
        ? "Belum cukup data"
        : score >= 80
          ? "Sehat"
          : score >= 60
            ? "Perlu dijaga"
            : "Perlu perhatian",
    completeness,
    allPillarsEvaluable,
  };
}

export function formatControlMoney(
  value,
  currency = DEFAULT_BASE_CURRENCY,
  visible = true,
) {
  return visible
    ? formatCurrency(Number(value || 0), currency)
    : HIDDEN_BALANCE_TEXT;
}

export function buildBudgetControlSummary({
  metrics,
  transactions = [],
  baseCurrency = DEFAULT_BASE_CURRENCY,
  currentDate = new Date(),
  timeZone = null,
} = {}) {
  const normalizedBaseCurrency = normalizeCurrencyCode(baseCurrency);
  const monthKey = getControlMonthKey(currentDate, timeZone);
  const monthMeta = getControlMonthMeta(
    monthKey,
    currentDate,
    timeZone,
  );
  const budget = buildBudgetSummary(
    metrics || {},
    normalizedBaseCurrency,
    monthMeta,
  );
  const liquidity = buildLiquiditySummary(
    metrics || {},
    normalizedBaseCurrency,
  );
  const cashFlow = buildCashFlowSummary(
    transactions,
    monthKey,
    normalizedBaseCurrency,
    timeZone,
  );
  const runway = buildRunwaySummary({
    metrics: metrics || {},
    transactions,
    monthKey,
    baseCurrency: normalizedBaseCurrency,
    timeZone,
    liquidity,
    budget,
  });
  const commitments = buildCommitmentSummary(
    transactions,
    monthKey,
    normalizedBaseCurrency,
    timeZone,
  );
  const safeToSpendAvailable = budget.available && liquidity.complete;
  const safeToSpendAmount = safeToSpendAvailable
    ? Math.min(budget.remainingAmount, liquidity.freeLiquidFunds)
    : null;
  const safeToSpend = {
    available: safeToSpendAvailable,
    amount: safeToSpendAmount,
    status: !budget.available
      ? "Belum ada anggaran bulan ini"
      : !liquidity.complete
        ? "Data dana likuid belum lengkap"
        : safeToSpendAmount < 0
          ? "Perlu disesuaikan"
          : "Masih aman digunakan",
    obligationsIncluded: false,
    obligationsNote:
      "Belum memasukkan tagihan mendatang karena jadwal tagihan rutin belum tersedia.",
  };
  const exposure = buildExposureSummary(
    metrics || {},
    normalizedBaseCurrency,
  );
  const scoring = buildScoring({
    budget,
    cashFlow,
    runway,
    commitments,
    explicitTimezone: Boolean(timeZone),
  });
  const recommendation = getRecommendation({
    budget,
    cashFlow,
    runway,
    safeToSpend,
    completeness: scoring.completeness,
  });

  return {
    monthKey,
    monthLabel: formatMonthKey(monthKey),
    baseCurrency: normalizedBaseCurrency,
    monthMeta,
    budget,
    liquidity,
    cashFlow,
    runway,
    commitments,
    safeToSpend,
    exposure,
    scoring,
    recommendation,
    limitations: {
      recurringCommitments: false,
      externalRemittance: false,
      linkedRefunds: false,
      emergencyFundMarker: false,
      explicitTimezone: Boolean(timeZone),
    },
  };
}
