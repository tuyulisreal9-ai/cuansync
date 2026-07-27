import {
  DEFAULT_BASE_CURRENCY,
  formatCurrency,
  normalizeCurrencyCode,
} from "../lib/currency.js";
import { getGlobalRateForCurrency } from "../lib/exchangeRates.js";

export const ASSET_ACCOUNT_TYPES = [
  { value: "bank", label: "Bank" },
  { value: "cash", label: "Cash" },
  { value: "ewallet", label: "E-wallet" },
  { value: "investment", label: "Investasi" },
  { value: "other", label: "Lainnya" },
];

export const ASSET_ACCOUNT_TYPE_LOOKUP = Object.fromEntries(
  ASSET_ACCOUNT_TYPES.map((item) => [item.value, item]),
);

const SPENDABLE_ASSET_ACCOUNT_TYPES = new Set([
  "bank",
  "cash",
  "ewallet",
  "other",
]);

function createLegacyAssetAccountId(row, index = 0) {
  const seed = [
    row.created_at,
    row.name,
    row.account_type,
    row.currency,
    row.balance_amount,
    index,
  ]
    .map((part) => String(part ?? ""))
    .join("|");
  let hash = 0;
  for (let indexSeed = 0; indexSeed < seed.length; indexSeed += 1) {
    hash = (hash * 31 + seed.charCodeAt(indexSeed)) >>> 0;
  }
  return `legacy-asset-account-${hash.toString(36)}-${index}`;
}

export function getDefaultAssetAccountName(
  accountType = "bank",
  currency = DEFAULT_BASE_CURRENCY,
) {
  const code = normalizeCurrencyCode(currency);
  if (accountType === "cash") return `Cash ${code}`;
  const typeLabel = ASSET_ACCOUNT_TYPE_LOOKUP[accountType]?.label || "Akun";
  return `${typeLabel} ${code}`;
}

export function normalizeAssetAccount(row, index = 0) {
  const accountType = ASSET_ACCOUNT_TYPE_LOOKUP[row?.account_type]
    ? row.account_type
    : ASSET_ACCOUNT_TYPE_LOOKUP[row?.type]
      ? row.type
      : "bank";
  const currency = normalizeCurrencyCode(row?.currency || row?.currency_code);
  const defaultName = getDefaultAssetAccountName(accountType, currency);
  const balanceAmount = Number(
    row?.balance_amount ?? row?.balanceAmount ?? row?.opening_balance ?? 0,
  );
  return {
    ...row,
    id: row?.id || createLegacyAssetAccountId(row || {}, index),
    name: String(row?.name || row?.account_name || defaultName).trim() || defaultName,
    account_type: accountType,
    currency,
    balance_amount: Number.isFinite(balanceAmount) ? balanceAmount : 0,
    note: row?.note || row?.description || "",
    created_at: row?.created_at || new Date().toISOString(),
  };
}

export function normalizeAssetAccounts(rows = []) {
  return rows.map(normalizeAssetAccount).sort((a, b) => {
    const currencyDiff = a.currency.localeCompare(b.currency);
    if (currencyDiff !== 0) return currencyDiff;
    return a.name.localeCompare(b.name);
  });
}

export function isSpendableAssetAccount(account) {
  return SPENDABLE_ASSET_ACCOUNT_TYPES.has(account?.account_type || "bank");
}

export function getSelectableAssetAccounts(accounts = [], currency, options = {}) {
  const normalizedCurrency = normalizeCurrencyCode(currency);
  const includeInvestments = Boolean(options.includeInvestments);
  return normalizeAssetAccounts(accounts).filter(
    (account) =>
      normalizeCurrencyCode(account.currency) === normalizedCurrency &&
      (includeInvestments || isSpendableAssetAccount(account)),
  );
}

export function getAssetAccountDisplayName(account) {
  const typeLabel = ASSET_ACCOUNT_TYPE_LOOKUP[account?.account_type]?.label || "Akun";
  const currency = normalizeCurrencyCode(account?.currency);
  const name = account?.name || getDefaultAssetAccountName(account?.account_type, currency);
  return `${name} - ${currency} - ${typeLabel}`;
}

export function getCurrentValuationRateForCurrency(
  globalRateSnapshot,
  currency,
  baseCurrency = DEFAULT_BASE_CURRENCY,
) {
  const globalRate = getGlobalRateForCurrency(
    globalRateSnapshot,
    currency,
    baseCurrency,
  );
  return globalRate.rate > 0 ? globalRate : { rate: 0, source: null };
}

export function getAssetAccountValuationLabel(
  account,
  baseCurrency = DEFAULT_BASE_CURRENCY,
) {
  const normalizedBaseCurrency = normalizeCurrencyCode(baseCurrency);
  if (account.currency === normalizedBaseCurrency) return "Mata uang utama";
  if (account.valuationIdr == null) return "Kurs belum tersedia";
  const suffix = account.rateSource === "global" ? " kurs global" : "";
  return `Sekitar ${formatCurrency(
    account.valuationIdr,
    normalizedBaseCurrency,
  )}${suffix}`;
}

export function buildAssetAccountInsights(
  accounts = [],
  globalRateSnapshot = null,
  baseCurrency = DEFAULT_BASE_CURRENCY,
) {
  const normalizedBaseCurrency = normalizeCurrencyCode(baseCurrency);
  const accountInsights = normalizeAssetAccounts(accounts).map((account) => {
    const currency = normalizeCurrencyCode(account.currency);
    const balanceAmount = Number(account.balance_amount || 0);
    const rateInfo = getCurrentValuationRateForCurrency(
      globalRateSnapshot,
      currency,
      normalizedBaseCurrency,
    );
    const rate = Number(rateInfo.rate || 0);
    const valuationIdr =
      currency === normalizedBaseCurrency
        ? balanceAmount
        : rate > 0
          ? balanceAmount * rate
          : null;
    return {
      ...account,
      typeLabel: ASSET_ACCOUNT_TYPE_LOOKUP[account.account_type]?.label || "Akun",
      balanceAmount,
      valuationIdr,
      rate,
      rateSource: rateInfo.source,
    };
  });
  const totalsByCurrency = accountInsights.reduce((totals, account) => {
    totals[account.currency] =
      Number(totals[account.currency] || 0) + Number(account.balanceAmount || 0);
    return totals;
  }, {});
  const totalValueIdr = accountInsights.reduce(
    (sum, account) => sum + Number(account.valuationIdr || 0),
    0,
  );

  return {
    accountInsights,
    accountCount: accountInsights.length,
    totalsByCurrency,
    totalValueIdr,
  };
}

export function roundAccountBalance(value) {
  return Math.max(
    Math.round((Number(value || 0) + Number.EPSILON) * 10000) / 10000,
    0,
  );
}

export function buildAssetAccountBalancePlan(
  accounts,
  movements,
  options = {},
) {
  const skipMissing = Boolean(options.skipMissing);
  const movementMap = new Map();
  movements
    .filter((movement) => movement.accountId && Number(movement.amount || 0) !== 0)
    .forEach((movement) => {
      const currency = normalizeCurrencyCode(movement.currency);
      const key = `${movement.accountId}|${currency}`;
      const existing = movementMap.get(key) || {
        accountId: movement.accountId,
        currency,
        amount: 0,
        label: movement.label,
      };
      existing.amount += Number(movement.amount || 0);
      movementMap.set(key, existing);
    });
  const normalizedMovements = [...movementMap.values()].filter(
    (movement) => Math.abs(Number(movement.amount || 0)) > 0.0001,
  );

  if (!normalizedMovements.length) {
    return {
      changedAccounts: [],
      nextAccounts: accounts,
    };
  }

  const accountMap = new Map(
    accounts.map((account) => [account.id, normalizeAssetAccount(account)]),
  );
  const changedAccountIds = new Set();
  const updatedAt = new Date().toISOString();

  normalizedMovements.forEach((movement) => {
    const account = accountMap.get(movement.accountId);
    if (!account) {
      if (skipMissing) return;
      throw new Error("Akun yang dipilih tidak ditemukan.");
    }

    const movementCurrency = normalizeCurrencyCode(movement.currency);
    const accountCurrency = normalizeCurrencyCode(account.currency);
    if (movementCurrency !== accountCurrency) {
      throw new Error(
        `Akun ${account.name} memakai ${accountCurrency}, bukan ${movementCurrency}.`,
      );
    }

    const currentBalance = Number(account.balance_amount || 0);
    const nextBalance = currentBalance + Number(movement.amount || 0);
    if (nextBalance < -0.0001) {
      throw new Error(`Saldo ${account.name} tidak mencukupi.`);
    }

    accountMap.set(account.id, {
      ...account,
      balance_amount: roundAccountBalance(nextBalance),
      updated_at: updatedAt,
    });
    changedAccountIds.add(account.id);
  });

  const nextAccounts = normalizeAssetAccounts([...accountMap.values()]);
  return {
    changedAccounts: nextAccounts.filter((account) =>
      changedAccountIds.has(account.id),
    ),
    nextAccounts,
  };
}
