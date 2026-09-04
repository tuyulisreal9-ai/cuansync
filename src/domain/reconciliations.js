import {
  getCurrencyMeta,
  normalizeCurrencyCode,
} from "../lib/currency.js";

export const RECONCILIABLE_ACCOUNT_TYPES = Object.freeze([
  "bank",
  "cash",
  "ewallet",
]);

const RECONCILIABLE_ACCOUNT_TYPE_SET = new Set(
  RECONCILIABLE_ACCOUNT_TYPES,
);

function requireIdentifier(value, label) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`${label} wajib tersedia.`);
  return normalized;
}

function requireNonnegativeAmount(value, label) {
  if (
    value === "" ||
    value == null ||
    (typeof value === "string" && !value.trim())
  ) {
    throw new Error(`${label} wajib diisi.`);
  }

  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    throw new Error(`${label} harus berupa angka yang valid.`);
  }
  if (amount < 0) {
    throw new Error(`${label} tidak boleh negatif.`);
  }
  return amount;
}

function getCurrencyScale(currency) {
  const fractionDigits = Math.max(
    0,
    Number(getCurrencyMeta(currency).fractionDigits || 0),
  );
  return {
    fractionDigits,
    scale: 10 ** fractionDigits,
  };
}

function toMinorUnits(value, currency) {
  const { scale } = getCurrencyScale(currency);
  return Math.round((Number(value) + Number.EPSILON) * scale);
}

function fromMinorUnits(value, currency) {
  const { scale } = getCurrencyScale(currency);
  const normalized = value / scale;
  return Object.is(normalized, -0) ? 0 : normalized;
}

export function roundReconciliationAmount(value, currency) {
  const amount = requireNonnegativeAmount(value, "Nominal");
  return fromMinorUnits(toMinorUnits(amount, currency), currency);
}

export function isReconciliableAccountType(accountType) {
  return RECONCILIABLE_ACCOUNT_TYPE_SET.has(
    String(accountType || "").trim().toLowerCase(),
  );
}

export function calculateReconciliation({
  appBalance,
  actualBalance,
  bankBalance,
  currency,
} = {}) {
  const normalizedCurrency = normalizeCurrencyCode(currency);
  const rawAppBalance = appBalance ?? actualBalance;
  const validAppBalance = requireNonnegativeAmount(
    rawAppBalance,
    "Saldo CUANSYNC",
  );
  const validBankBalance = requireNonnegativeAmount(
    bankBalance,
    "Saldo bank",
  );
  const appMinor = toMinorUnits(validAppBalance, normalizedCurrency);
  const bankMinor = toMinorUnits(validBankBalance, normalizedCurrency);
  const differenceMinor = bankMinor - appMinor;
  const normalizedAppBalance = fromMinorUnits(
    appMinor,
    normalizedCurrency,
  );
  const normalizedBankBalance = fromMinorUnits(
    bankMinor,
    normalizedCurrency,
  );
  const difference = fromMinorUnits(
    differenceMinor,
    normalizedCurrency,
  );
  const isMatched = differenceMinor === 0;
  const direction = isMatched
    ? "matched"
    : differenceMinor > 0
      ? "bank_higher"
      : "bank_lower";

  return Object.freeze({
    currency: normalizedCurrency,
    appBalance: normalizedAppBalance,
    actualBalance: normalizedAppBalance,
    bankBalance: normalizedBankBalance,
    difference,
    differenceAmount: difference,
    status: isMatched ? "matched" : "different",
    isMatched,
    direction,
  });
}

function normalizeDate(value, label) {
  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} tidak valid.`);
  }
  return parsed;
}

function createLegacyReconciliationId(row, index = 0) {
  const seed = [
    row?.user_id ?? row?.userId,
    row?.account_id ?? row?.accountId,
    row?.checked_at ?? row?.checkedAt,
    row?.app_balance ?? row?.appBalance,
    row?.bank_balance ?? row?.bankBalance,
    index,
  ]
    .map((part) => String(part ?? ""))
    .join("|");
  let hash = 0;
  for (let offset = 0; offset < seed.length; offset += 1) {
    hash = (hash * 31 + seed.charCodeAt(offset)) >>> 0;
  }
  return `legacy-reconciliation-${hash.toString(36)}-${index}`;
}

function createReconciliationId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `reconciliation-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function buildAccountReconciliationRecord(
  {
    id,
    userId,
    account,
    bankBalance,
    checkedAt,
    note = "",
  } = {},
  { now = new Date() } = {},
) {
  const currentTime = normalizeDate(now, "Waktu saat ini");
  const reconciliationTime = checkedAt == null
    ? new Date(currentTime.getTime())
    : normalizeDate(checkedAt, "Waktu pengecekan");

  if (reconciliationTime.getTime() > currentTime.getTime()) {
    throw new Error("Waktu pengecekan tidak boleh berada di masa depan.");
  }

  const accountType = String(
    account?.account_type ?? account?.accountType ?? "",
  )
    .trim()
    .toLowerCase();
  if (!isReconciliableAccountType(accountType)) {
    throw new Error(
      "Cocokkan Saldo hanya tersedia untuk Bank, Cash, dan E-wallet.",
    );
  }
  if (Boolean(account?.is_archived ?? account?.isArchived)) {
    throw new Error("Dompet yang sudah diarsipkan tidak dapat dicocokkan.");
  }

  const currency = normalizeCurrencyCode(account?.currency);
  const appBalance =
    account?.balanceAmount ??
    account?.actualBalance ??
    account?.balance_amount;
  const calculation = calculateReconciliation({
    appBalance,
    bankBalance,
    currency,
  });

  return Object.freeze({
    id: requireIdentifier(id || createReconciliationId(), "ID rekonsiliasi"),
    user_id: requireIdentifier(userId, "Pengguna"),
    account_id: requireIdentifier(account?.id, "Dompet"),
    currency: calculation.currency,
    checked_at: reconciliationTime.toISOString(),
    app_balance: calculation.appBalance,
    bank_balance: calculation.bankBalance,
    difference: calculation.differenceAmount,
    status: calculation.status,
    note: String(note || "").trim(),
    created_at: currentTime.toISOString(),
  });
}

export function normalizeAccountReconciliation(row, index = 0) {
  const source = row || {};
  const currency = normalizeCurrencyCode(source.currency);
  const rawAppBalance = Number(
    source.app_balance ?? source.appBalance ?? source.actualBalance ?? 0,
  );
  const rawBankBalance = Number(
    source.bank_balance ?? source.bankBalance ?? rawAppBalance,
  );
  const safeAppBalance = Number.isFinite(rawAppBalance) && rawAppBalance >= 0
    ? rawAppBalance
    : 0;
  const safeBankBalance = Number.isFinite(rawBankBalance) && rawBankBalance >= 0
    ? rawBankBalance
    : safeAppBalance;
  const calculation = calculateReconciliation({
    appBalance: safeAppBalance,
    bankBalance: safeBankBalance,
    currency,
  });
  const checkedAtCandidate =
    source.checked_at ??
    source.checkedAt ??
    source.created_at ??
    source.createdAt ??
    "1970-01-01T00:00:00.000Z";
  const checkedAtDate = new Date(checkedAtCandidate);
  const checkedAt = Number.isNaN(checkedAtDate.getTime())
    ? "1970-01-01T00:00:00.000Z"
    : checkedAtDate.toISOString();
  const createdAtCandidate = source.created_at ?? source.createdAt ?? checkedAt;
  const createdAtDate = new Date(createdAtCandidate);
  const createdAt = Number.isNaN(createdAtDate.getTime())
    ? checkedAt
    : createdAtDate.toISOString();
  const accountId = source.account_id ?? source.accountId ?? null;
  const userId = source.user_id ?? source.userId ?? null;

  return Object.freeze({
    ...source,
    id: source.id || createLegacyReconciliationId(source, index),
    user_id: userId,
    userId,
    account_id: accountId,
    accountId,
    currency: calculation.currency,
    checked_at: checkedAt,
    checkedAt,
    app_balance: calculation.appBalance,
    appBalance: calculation.appBalance,
    actualBalance: calculation.actualBalance,
    bank_balance: calculation.bankBalance,
    bankBalance: calculation.bankBalance,
    difference: calculation.differenceAmount,
    differenceAmount: calculation.differenceAmount,
    status: calculation.status,
    isMatched: calculation.isMatched,
    direction: calculation.direction,
    note: String(source.note || "").trim(),
    created_at: createdAt,
    createdAt,
  });
}

export function normalizeAccountReconciliations(rows = []) {
  const normalizedRows = (Array.isArray(rows) ? rows : [])
    .map((row, index) => normalizeAccountReconciliation(row, index))
    .sort((left, right) => {
      const checkedDifference =
        new Date(right.checkedAt).getTime() - new Date(left.checkedAt).getTime();
      if (checkedDifference !== 0) return checkedDifference;
      const createdDifference =
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      if (createdDifference !== 0) return createdDifference;
      return String(right.id).localeCompare(String(left.id));
    });
  return Object.freeze(normalizedRows);
}

export function getLatestAccountReconciliation(rows = [], accountId = null) {
  const normalizedAccountId = accountId == null
    ? null
    : String(accountId).trim();
  return (
    normalizeAccountReconciliations(rows).find(
      (row) =>
        normalizedAccountId == null || row.accountId === normalizedAccountId,
    ) || null
  );
}
