import {
  CATEGORY_OPTIONS,
  getBudgetCategoryKey,
  getCategoryMeta,
} from "../../domain/budgets.js";
import {
  getTransactionAmountValue,
  getTransactionCurrency,
  getTransactionFlow,
  getTransactionMainAmount,
  resolveTransactionBaseValue,
} from "../../domain/transactions.js";
import {
  DEFAULT_BASE_CURRENCY,
  formatCurrency,
} from "../../lib/currency.js";

const TRANSACTION_TYPE_LABELS = {
  income: "Pemasukan",
  exchange: "Tukar Mata Uang",
  expense: "Uang Keluar",
};

function isAccountTransfer(transaction) {
  return (
    getTransactionFlow(transaction) === "exchange" &&
    transaction.from_currency === transaction.to_currency &&
    transaction.source_account_id &&
    transaction.destination_account_id
  );
}

export function getExchangeTitle(transaction) {
  if (isAccountTransfer(transaction)) return "Transfer antar dompet";
  if (transaction.from_currency && transaction.to_currency) {
    return `${transaction.from_currency} ke ${transaction.to_currency}`;
  }
  return "Tukar Mata Uang";
}

export function getTransactionPreview(transaction) {
  if (getTransactionFlow(transaction) === "exchange") {
    return `${formatCurrency(
      transaction.from_amount,
      transaction.from_currency,
    )} -> ${formatCurrency(transaction.to_amount, transaction.to_currency)}`;
  }
  return formatCurrency(
    getTransactionAmountValue(transaction),
    getTransactionCurrency(transaction),
  );
}

export function getTransactionTypeLabel(transaction) {
  const flow = getTransactionFlow(transaction);
  if (flow === "exchange") {
    return isAccountTransfer(transaction) ? "Transfer antar dompet" : "Tukar Mata Uang";
  }
  return flow === "income" ? "Uang masuk" : "Uang keluar";
}

export function getTransactionIconLabel(transaction) {
  const flow = getTransactionFlow(transaction);
  if (flow === "income") return "IN";
  if (flow === "exchange") return "FX";
  const category = getCategoryMeta(transaction.category).value;
  const match = CATEGORY_OPTIONS.find((item) => item.value === category);
  if (!match) return "OUT";
  return match.label
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function getTransactionTone(transaction) {
  const flow = getTransactionFlow(transaction);
  if (flow === "income") {
    return {
      icon:
        "bg-emerald-100 text-emerald-700 ring-emerald-400/20 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-300/15",
      historyIcon:
        "bg-emerald-50 ring-emerald-200/75 dark:bg-emerald-400/10 dark:ring-emerald-300/20",
      amount: "text-emerald-700 dark:text-emerald-300",
      chip:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    };
  }
  if (flow === "exchange") {
    return {
      icon:
        "bg-sky-100 text-sky-700 ring-sky-400/20 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-300/15",
      historyIcon:
        "bg-sky-50 ring-sky-200/75 dark:bg-sky-400/10 dark:ring-sky-300/20",
      amount: "text-sky-700 dark:text-sky-300",
      chip:
        "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
    };
  }
  return {
    icon:
      "bg-amber-100 text-amber-700 ring-amber-400/20 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-300/15",
    historyIcon:
      "bg-amber-50 ring-amber-200/75 dark:bg-amber-400/10 dark:ring-amber-300/20",
    amount: "text-rose-700 dark:text-rose-300",
    chip:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  };
}

export function getTransactionDisplayTitle(transaction) {
  const isExchange = getTransactionFlow(transaction) === "exchange";
  return (
    transaction.description ||
    (isExchange
      ? getExchangeTitle(transaction)
      : TRANSACTION_TYPE_LABELS[transaction.type]) ||
    "Transaksi"
  );
}

export function getTransactionCompactAmount(transaction, fallbackRate = 0) {
  const flow = getTransactionFlow(transaction);
  const currency = getTransactionCurrency(transaction);
  const mainAmount = getTransactionMainAmount(transaction);
  if (flow === "income") {
    return {
      primary: `+${formatCurrency(mainAmount, currency)}`,
      secondary: currency.toUpperCase(),
    };
  }
  if (flow === "expense") {
    const valuation = resolveTransactionBaseValue(transaction, fallbackRate);
    const valuationIdr = valuation > 0 ? valuation : null;
    return {
      primary: `-${formatCurrency(mainAmount, currency)}`,
      secondary:
        currency !== DEFAULT_BASE_CURRENCY && valuationIdr != null
          ? `Valuasi ${formatCurrency(valuationIdr, "idr")}`
          : currency.toUpperCase(),
    };
  }

  return {
    primary: `-${formatCurrency(
      transaction.from_amount,
      transaction.from_currency,
    )}`,
    secondary: `+${formatCurrency(
      transaction.to_amount,
      transaction.to_currency,
    )}`,
  };
}

export function getTransactionCategoryKey(transaction) {
  if (transaction.type === "expense") {
    return getBudgetCategoryKey(transaction.category || "Lainnya");
  }
  return transaction.type === "exchange" ? "exchange" : "income";
}

export function getTransactionCategoryLabel(transaction) {
  if (transaction.category) return getCategoryMeta(transaction.category).label;
  if (transaction.type === "exchange") {
    return isAccountTransfer(transaction) ? "Transfer antar dompet" : "Tukar Mata Uang";
  }
  if (transaction.type === "income") {
    return `Pemasukan ${getTransactionCurrency(transaction)}`;
  }
  return "Lainnya";
}
