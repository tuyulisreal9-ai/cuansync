import {
  DEFAULT_BASE_CURRENCY,
  normalizeCurrencyCode,
} from "../lib/currency.js";
import {
  getDefaultCategoryGroup,
  normalizeExpenseCategory,
} from "./categories.js";
import { deriveStoredExchangeRateOrientation } from "./exchangeRate.js";
import {
  isSpendableAssetAccount,
  normalizeAssetAccounts,
} from "./assets.js";

const LEGACY_EXCHANGE_KEYWORDS = [
  "beli thb",
  "beli baht",
  "tukar thb",
  "tukar",
  "tukar / beli thb",
  "exchange",
  "convert",
  "currency exchange",
];

export const FUTURE_TRANSACTION_DATE_MESSAGE =
  "Tanggal dan waktu transaksi tidak boleh melewati waktu sekarang.";

export function validateTransactionOccurredAt(value, now = new Date()) {
  const occurredAt = new Date(value);
  const nowTime = new Date(now).getTime();

  if (Number.isNaN(occurredAt.getTime())) {
    throw new Error("Tanggal transaksi tidak valid.");
  }
  if (Number.isNaN(nowTime)) {
    throw new Error("Waktu saat ini tidak valid.");
  }
  if (occurredAt.getTime() > nowTime) {
    throw new Error(FUTURE_TRANSACTION_DATE_MESSAGE);
  }

  return occurredAt;
}

function looksLikeLegacyExchange(row) {
  if (row.type !== "income") return false;
  const amountThb = Number(row.amount_thb || 0);
  if (amountThb <= 0) return false;

  const searchable = [
    row.description,
    row.category,
    row.category_group,
    row.exchange_source,
    row.source,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return LEGACY_EXCHANGE_KEYWORDS.some((keyword) =>
    searchable.includes(keyword),
  );
}

export function createLegacyTransactionId(row, index = 0) {
  const seed = [
    row.created_at,
    row.occurred_at,
    row.type,
    row.description,
    row.category,
    row.amount_idr,
    row.amount_thb,
    row.locked_rate,
    index,
  ]
    .map((part) => String(part ?? ""))
    .join("|");
  let hash = 0;
  for (let indexSeed = 0; indexSeed < seed.length; indexSeed += 1) {
    hash = (hash * 31 + seed.charCodeAt(indexSeed)) >>> 0;
  }
  return `legacy-${hash.toString(36)}-${index}`;
}

export function normalizeTransaction(row, index = 0) {
  const baseCurrency = normalizeCurrencyCode(row.base_currency || row.baseCurrency);
  const normalized = {
    ...row,
    id: row.id || createLegacyTransactionId(row, index),
    type: ["income", "expense", "exchange"].includes(row.type)
      ? row.type
      : "expense",
    amount_idr: row.amount_idr == null ? null : Number(row.amount_idr),
    amount_thb: row.amount_thb == null ? null : Number(row.amount_thb),
    locked_rate: row.locked_rate == null ? null : Number(row.locked_rate),
    amount: row.amount == null ? null : Number(row.amount),
    base_amount: row.base_amount == null ? null : Number(row.base_amount),
    base_currency: baseCurrency,
    currency: row.currency ? normalizeCurrencyCode(row.currency) : null,
    from_currency: row.from_currency
      ? normalizeCurrencyCode(row.from_currency)
      : row.fromCurrency
        ? normalizeCurrencyCode(row.fromCurrency)
        : null,
    to_currency: row.to_currency
      ? normalizeCurrencyCode(row.to_currency)
      : row.toCurrency
        ? normalizeCurrencyCode(row.toCurrency)
        : null,
    from_amount:
      row.from_amount == null && row.fromAmount == null
        ? null
        : Number(row.from_amount ?? row.fromAmount),
    to_amount:
      row.to_amount == null && row.toAmount == null
        ? null
        : Number(row.to_amount ?? row.toAmount),
    rate: row.rate == null ? null : Number(row.rate),
    fee_amount: row.fee_amount == null ? null : Number(row.fee_amount),
    fee_currency: row.fee_currency
      ? normalizeCurrencyCode(row.fee_currency)
      : null,
    rate_base_currency: row.rate_base_currency
      ? normalizeCurrencyCode(row.rate_base_currency)
      : null,
    rate_quote_currency: row.rate_quote_currency
      ? normalizeCurrencyCode(row.rate_quote_currency)
      : null,
    exchange_rate:
      row.exchange_rate == null ? null : Number(row.exchange_rate),
    rate_type: [
      "realtime",
      "automatic",
      "custom",
      "historical",
      "transfer",
      "legacy",
      "base",
    ].includes(row.rate_type)
      ? row.rate_type
      : null,
  };

  if (looksLikeLegacyExchange(normalized)) {
    normalized.type = "exchange";
  }

  if (normalized.type === "exchange") {
    const amountIdr = Math.abs(Number(normalized.amount_idr || 0));
    const amountThb = Number(normalized.amount_thb || 0);
    const isLegacySell = amountThb < 0 && amountIdr > 0;
    const inferredFromCurrency =
      normalized.from_currency || (isLegacySell ? "THB" : "IDR");
    const inferredToCurrency =
      normalized.to_currency || (isLegacySell ? "IDR" : "THB");
    const inferredFromAmount =
      Number(normalized.from_amount || 0) > 0
        ? Math.abs(Number(normalized.from_amount))
        : inferredFromCurrency === "IDR"
          ? amountIdr
          : Math.abs(amountThb);
    const inferredToAmount =
      Number(normalized.to_amount || 0) > 0
        ? Math.abs(Number(normalized.to_amount))
        : inferredToCurrency === "IDR"
          ? amountIdr
          : Math.abs(amountThb);
    const inferredRate =
      Number(normalized.rate || normalized.locked_rate || 0) > 0
        ? Number(normalized.rate || normalized.locked_rate)
        : inferredFromAmount > 0 && inferredToAmount > 0
          ? inferredFromAmount / inferredToAmount
          : null;

    const feeCategory =
      Number(normalized.fee_amount || 0) > 0 && normalized.category
        ? normalizeExpenseCategory(normalized.category, "Lainnya")
        : null;
    const exchange = {
      ...normalized,
      category: feeCategory,
      category_group: feeCategory
        ? normalized.category_group || getDefaultCategoryGroup(feeCategory)
        : null,
      from_currency: normalizeCurrencyCode(inferredFromCurrency),
      to_currency: normalizeCurrencyCode(inferredToCurrency, "THB"),
      from_amount: inferredFromAmount,
      to_amount: inferredToAmount,
      rate: inferredRate,
      locked_rate: inferredRate,
      currency: null,
      amount: null,
      base_amount:
        normalizeCurrencyCode(inferredFromCurrency) === baseCurrency
          ? inferredFromAmount
          : normalizeCurrencyCode(inferredToCurrency) === baseCurrency
            ? inferredToAmount
            : null,
    };
    const orientation = deriveStoredExchangeRateOrientation(exchange);

    return {
      ...exchange,
      rate_base_currency: orientation.rateBaseCurrency,
      rate_quote_currency: orientation.rateQuoteCurrency,
      exchange_rate: Number(orientation.exchangeRate || 0) || null,
      rate_type: exchange.rate_type || "legacy",
      fromCurrency: exchange.from_currency,
      toCurrency: exchange.to_currency,
      fromAmount: exchange.from_amount,
      toAmount: exchange.to_amount,
      createdAt: exchange.created_at,
      updatedAt: exchange.updated_at,
    };
  }

  const inferredCurrency =
    normalized.currency ||
    (Number(normalized.amount_thb || 0) > 0 ? "THB" : baseCurrency);
  const currency = normalizeCurrencyCode(inferredCurrency);
  const inferredAmount =
    Number(normalized.amount || 0) > 0
      ? Number(normalized.amount)
      : currency === "THB"
        ? Number(normalized.amount_thb || 0)
        : Number(normalized.amount_idr || 0);
  const inferredRate =
    Number(normalized.rate || normalized.locked_rate || 0) > 0
      ? Number(normalized.rate || normalized.locked_rate)
      : null;
  const inferredBaseAmount =
    Number(normalized.base_amount || 0) > 0
      ? Number(normalized.base_amount)
      : Number(normalized.amount_idr || 0) > 0
        ? Number(normalized.amount_idr)
        : currency === baseCurrency
          ? inferredAmount
          : inferredAmount > 0 && inferredRate > 0
            ? inferredAmount * inferredRate
            : null;

  return {
    ...normalized,
    category:
      normalized.type === "expense"
        ? normalizeExpenseCategory(normalized.category, "Lainnya")
        : normalized.category,
    currency,
    amount: inferredAmount,
    base_amount: inferredBaseAmount,
    rate: inferredRate,
    locked_rate: inferredRate,
  };
}

export function normalizeTransactions(rows = []) {
  return rows.map((row, index) => normalizeTransaction(row, index));
}

export function orderTransactions(rows = []) {
  return [...rows].sort((a, b) => {
    const timeDiff =
      new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime();
    if (timeDiff !== 0) return timeDiff;
    return (
      new Date(a.created_at || a.occurred_at).getTime() -
      new Date(b.created_at || b.occurred_at).getTime()
    );
  });
}

export function getTransactionFlow(transaction) {
  if (transaction?.type === "exchange") return "exchange";
  return transaction?.type === "expense" ? "expense" : "income";
}

export function getTransactionCurrency(transaction) {
  if (transaction?.type === "exchange") {
    return normalizeCurrencyCode(transaction.from_currency);
  }
  return normalizeCurrencyCode(transaction?.currency);
}

export function getTransactionAmountValue(transaction) {
  const amount = Math.abs(Number(transaction?.amount || 0));
  if (amount > 0) return amount;
  const currency = getTransactionCurrency(transaction);
  if (currency === "THB") return Math.abs(Number(transaction?.amount_thb || 0));
  return Math.abs(Number(transaction?.amount_idr || 0));
}

export function getTransactionMainAmount(transaction) {
  return getTransactionAmountValue(transaction);
}

export function resolveTransactionBaseValue(transaction, fallbackRate = 0) {
  const baseCurrency = normalizeCurrencyCode(
    transaction?.base_currency,
    DEFAULT_BASE_CURRENCY,
  );
  const currency = normalizeCurrencyCode(transaction?.currency, baseCurrency);
  const amount = Math.abs(Number(transaction?.amount || 0));
  const baseAmount = Math.abs(Number(transaction?.base_amount || 0));
  const legacyAmountIdr = Math.abs(Number(transaction?.amount_idr || 0));
  const rate = Number(
    transaction?.rate || transaction?.locked_rate || fallbackRate || 0,
  );

  if (baseAmount > 0) return baseAmount;
  if (legacyAmountIdr > 0) return legacyAmountIdr;
  if (currency === baseCurrency) return amount;
  return amount > 0 && rate > 0 ? amount * rate : 0;
}

export function resolveTransactionHistoricalBaseValue(
  transaction,
  baseCurrency = DEFAULT_BASE_CURRENCY,
) {
  if (!transaction || transaction.type === "exchange") return null;

  const requestedBaseCurrency = normalizeCurrencyCode(baseCurrency);
  const storedBaseCurrency = normalizeCurrencyCode(
    transaction.base_currency,
    requestedBaseCurrency,
  );
  const currency = getTransactionCurrency(transaction);
  const amount = getTransactionAmountValue(transaction);
  const baseAmount = Math.abs(Number(transaction.base_amount || 0));
  const legacyAmountIdr = Math.abs(Number(transaction.amount_idr || 0));
  const storedRate = Number(
    transaction.rate || transaction.locked_rate || 0,
  );

  if (currency === requestedBaseCurrency) {
    return amount > 0 ? amount : null;
  }
  if (
    storedBaseCurrency === requestedBaseCurrency &&
    baseAmount > 0
  ) {
    return baseAmount;
  }
  if (requestedBaseCurrency === "IDR" && legacyAmountIdr > 0) {
    return legacyAmountIdr;
  }
  if (
    storedBaseCurrency === requestedBaseCurrency &&
    amount > 0 &&
    storedRate > 0
  ) {
    return amount * storedRate;
  }
  return null;
}

export function resolveTransactionFeeHistoricalBaseValue(
  transaction,
  baseCurrency = DEFAULT_BASE_CURRENCY,
) {
  const feeAmount = Math.abs(Number(transaction?.fee_amount || 0));
  if (feeAmount <= 0) return 0;

  const requestedBaseCurrency = normalizeCurrencyCode(baseCurrency);
  const feeCurrency = normalizeCurrencyCode(
    transaction.fee_currency || transaction.from_currency,
  );
  if (feeCurrency === requestedBaseCurrency) return feeAmount;

  const fromCurrency = normalizeCurrencyCode(transaction.from_currency);
  const toCurrency = normalizeCurrencyCode(transaction.to_currency);
  const fromAmount = Math.abs(Number(transaction.from_amount || 0));
  const toAmount = Math.abs(Number(transaction.to_amount || 0));
  const baseAmount = Math.abs(Number(transaction.base_amount || 0));
  const storedBaseCurrency = normalizeCurrencyCode(
    transaction.base_currency,
    requestedBaseCurrency,
  );

  if (
    feeCurrency === fromCurrency &&
    toCurrency === requestedBaseCurrency &&
    fromAmount > 0 &&
    toAmount > 0
  ) {
    return feeAmount * (toAmount / fromAmount);
  }
  if (
    feeCurrency === fromCurrency &&
    storedBaseCurrency === requestedBaseCurrency &&
    fromAmount > 0 &&
    baseAmount > 0
  ) {
    return feeAmount * (baseAmount / fromAmount);
  }

  return null;
}

export function computeCurrencyBalances(transactions = [], activeCurrencies = []) {
  const balances = Object.fromEntries(
    activeCurrencies.map((code) => [normalizeCurrencyCode(code), 0]),
  );

  function add(currency, amount) {
    const code = normalizeCurrencyCode(currency);
    balances[code] = Number(balances[code] || 0) + Number(amount || 0);
  }

  orderTransactions(transactions).forEach((item) => {
    if (item.type === "exchange") {
      add(item.from_currency, -Math.abs(Number(item.from_amount || 0)));
      add(item.to_currency, Math.abs(Number(item.to_amount || 0)));
      const feeAmount = Math.abs(Number(item.fee_amount || 0));
      if (feeAmount > 0) {
        add(item.fee_currency || item.from_currency, -feeAmount);
      }
      return;
    }

    const currency = getTransactionCurrency(item);
    const amount = getTransactionAmountValue(item);
    add(currency, item.type === "expense" ? -amount : amount);
  });

  return balances;
}

export function getTransactionAccountMovements(transaction, options = {}) {
  const reverse = Boolean(options.reverse);
  const flow = getTransactionFlow(transaction);
  const currency = getTransactionCurrency(transaction);
  const amount = getTransactionAmountValue(transaction);

  if (flow === "exchange") {
    const fromAmount = Math.abs(Number(transaction.from_amount || 0));
    const toAmount = Math.abs(Number(transaction.to_amount || 0));
    const feeAmount = Math.abs(Number(transaction.fee_amount || 0));
    const movements = [];
    if (fromAmount > 0 && transaction.source_account_id) {
      movements.push({
        accountId: transaction.source_account_id,
        currency: normalizeCurrencyCode(transaction.from_currency),
        amount: reverse ? fromAmount : -fromAmount,
        label: "akun sumber",
      });
    }
    if (toAmount > 0 && transaction.destination_account_id) {
      movements.push({
        accountId: transaction.destination_account_id,
        currency: normalizeCurrencyCode(transaction.to_currency),
        amount: reverse ? -toAmount : toAmount,
        label: "akun tujuan",
      });
    }
    if (feeAmount > 0 && transaction.source_account_id) {
      movements.push({
        accountId: transaction.source_account_id,
        currency: normalizeCurrencyCode(
          transaction.fee_currency || transaction.from_currency,
        ),
        amount: reverse ? feeAmount : -feeAmount,
        label: "biaya transfer",
      });
    }
    return movements;
  }

  if (!amount || amount <= 0) return [];

  if (flow === "income" && transaction.destination_account_id) {
    return [
      {
        accountId: transaction.destination_account_id,
        currency,
        amount: reverse ? -amount : amount,
        label: "akun tujuan",
      },
    ];
  }

  if (flow === "expense" && transaction.source_account_id) {
    return [
      {
        accountId: transaction.source_account_id,
        currency,
        amount: reverse ? amount : -amount,
        label: "akun sumber",
      },
    ];
  }

  return [];
}

export function transactionBelongsToAccount(transaction, accountId) {
  if (!accountId) return false;
  const flow = getTransactionFlow(transaction);
  if (flow === "exchange") {
    return (
      transaction.source_account_id === accountId ||
      transaction.destination_account_id === accountId
    );
  }
  if (flow === "income") {
    return transaction.destination_account_id === accountId;
  }
  return transaction.source_account_id === accountId;
}

function requireTransactionAccount(accountById, accountId, label) {
  if (!accountId) {
    throw new Error(`Pilih ${label} terlebih dahulu.`);
  }

  const account = accountById.get(accountId);
  if (!account) {
    throw new Error(`${label[0].toUpperCase()}${label.slice(1)} tidak ditemukan.`);
  }
  if (!isSpendableAssetAccount(account)) {
    throw new Error(
      `${account.name} bukan dompet transaksi. Pilih akun Bank, Cash, E-wallet, atau Lainnya.`,
    );
  }
  return account;
}

function assertAccountCurrency(account, currency, label) {
  const expectedCurrency = normalizeCurrencyCode(currency);
  const accountCurrency = normalizeCurrencyCode(account.currency);
  if (accountCurrency !== expectedCurrency) {
    throw new Error(
      `${label} ${account.name} memakai ${accountCurrency}, bukan ${expectedCurrency}.`,
    );
  }
}

export function validateTransactionAccountLinks(transaction, accounts = []) {
  const accountById = new Map(
    normalizeAssetAccounts(accounts).map((account) => [account.id, account]),
  );
  const flow = getTransactionFlow(transaction);

  if (flow === "income") {
    const destinationAccount = requireTransactionAccount(
      accountById,
      transaction.destination_account_id,
      "dompet tujuan",
    );
    assertAccountCurrency(
      destinationAccount,
      getTransactionCurrency(transaction),
      "Dompet tujuan",
    );
    return { sourceAccount: null, destinationAccount };
  }

  if (flow === "expense") {
    const sourceAccount = requireTransactionAccount(
      accountById,
      transaction.source_account_id,
      "dompet sumber",
    );
    assertAccountCurrency(
      sourceAccount,
      getTransactionCurrency(transaction),
      "Dompet sumber",
    );
    return { sourceAccount, destinationAccount: null };
  }

  const sourceAccount = requireTransactionAccount(
    accountById,
    transaction.source_account_id,
    "dompet asal",
  );
  const destinationAccount = requireTransactionAccount(
    accountById,
    transaction.destination_account_id,
    "dompet tujuan",
  );
  if (sourceAccount.id === destinationAccount.id) {
    throw new Error("Dompet asal dan tujuan tidak boleh sama.");
  }
  assertAccountCurrency(
    sourceAccount,
    transaction.from_currency,
    "Dompet asal",
  );
  assertAccountCurrency(
    destinationAccount,
    transaction.to_currency,
    "Dompet tujuan",
  );
  return { sourceAccount, destinationAccount };
}

export function getTransactionAccountActivity(transaction, accountId) {
  const flow = getTransactionFlow(transaction);
  if (flow === "exchange") {
    const outgoing = transaction.source_account_id === accountId;
    return {
      amount: Math.abs(
        Number(
          outgoing
            ? Number(transaction.from_amount || 0) + Number(transaction.fee_amount || 0)
            : transaction.to_amount || 0,
        ),
      ),
      currency: normalizeCurrencyCode(
        outgoing ? transaction.from_currency : transaction.to_currency,
      ),
      direction: outgoing ? "out" : "in",
      flow,
    };
  }

  return {
    amount: getTransactionAmountValue(transaction),
    currency: getTransactionCurrency(transaction),
    direction: flow === "income" ? "in" : "out",
    flow,
  };
}
