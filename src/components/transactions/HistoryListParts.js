import React from "react";
import htm from "htm";
import {
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpRight,
} from "lucide-react";
import { getAssetAccountDisplayName } from "../../domain/assets.js";
import { getTransactionFlow } from "../../domain/transactions.js";
import { formatNumericInput } from "../../lib/currency.js";
import { formatShortTime } from "../../lib/dates.js";
import {
  getTransactionCategoryLabel,
  getTransactionCompactAmount,
  getTransactionDisplayTitle,
  getTransactionTone,
} from "./presentation.js";
import { FormActionDock } from "../shared/FormActionDock.js";

const html = htm.bind(React.createElement);

const INPUT_CLASS =
  "cuan-input min-h-11 w-full rounded-xl px-3 py-2.5 text-sm transition";

const HISTORY_SORT_OPTIONS = [
  { value: "newest", label: "Terbaru" },
  { value: "oldest", label: "Terlama" },
  { value: "largest", label: "Nominal terbesar" },
  { value: "smallest", label: "Nominal terkecil" },
];

const HISTORY_TYPE_OPTIONS = [
  { value: "all", label: "Semua tipe" },
  { value: "income", label: "Uang masuk" },
  { value: "expense", label: "Uang keluar" },
  { value: "exchange", label: "Transfer / Exchange" },
];

const TRANSACTION_FILTER_TABS = [
  { value: "all", label: "Semua" },
  { value: "income", label: "Masuk" },
  { value: "expense", label: "Keluar" },
  { value: "exchange", label: "Exchange" },
];

export function TransactionFilter({
  filters,
  onChange,
  onReset,
  categoryOptions,
  currencyOptions,
  showSearch = true,
  onDone = null,
}) {
  function updateFilter(field, value) {
    onChange((current) => ({ ...current, [field]: value }));
  }

  return html`
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-3">
        ${showSearch
          ? html`
              <label className="col-span-2 block">
                <span className="mb-1.5 block text-xs font-bold">Cari catatan</span>
                <input
                  type="search"
                  autoComplete="off"
                  placeholder="Cari dari deskripsi atau catatan"
                  value=${filters.search}
                  onChange=${(event) => updateFilter("search", event.target.value)}
                  className=${INPUT_CLASS}
                />
              </label>
            `
          : null}

        <label className="block">
          <span className="mb-1.5 block text-xs font-bold">Dari tanggal</span>
          <input
            type="date"
            value=${filters.startDate}
            onChange=${(event) => updateFilter("startDate", event.target.value)}
            className=${INPUT_CLASS}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-bold">Sampai tanggal</span>
          <input
            type="date"
            value=${filters.endDate}
            onChange=${(event) => updateFilter("endDate", event.target.value)}
            className=${INPUT_CLASS}
          />
        </label>

        <label className="col-span-2 block">
          <span className="mb-1.5 block text-xs font-bold">Tipe transaksi</span>
          <select
            value=${filters.type}
            onChange=${(event) => updateFilter("type", event.target.value)}
            className=${INPUT_CLASS}
          >
            ${HISTORY_TYPE_OPTIONS.map(
              (option) => html`
                <option key=${option.value} value=${option.value}>
                  ${option.label}
                </option>
              `,
            )}
          </select>
        </label>

        <label className="col-span-2 block">
          <span className="mb-1.5 block text-xs font-bold">Kategori</span>
          <select
            value=${filters.category}
            onChange=${(event) => updateFilter("category", event.target.value)}
            className=${INPUT_CLASS}
          >
            ${categoryOptions.map(
              (option) => html`
                <option key=${option.value} value=${option.value}>
                  ${option.label}
                </option>
              `,
            )}
          </select>
        </label>

        <label className="col-span-2 block">
          <span className="mb-1.5 block text-xs font-bold">Mata uang</span>
          <select
            value=${filters.currency}
            onChange=${(event) => updateFilter("currency", event.target.value)}
            className=${INPUT_CLASS}
          >
            ${currencyOptions.map(
              (option) => html`
                <option key=${option.value} value=${option.value}>
                  ${option.label}
                </option>
              `,
            )}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-bold">Nominal minimum</span>
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            value=${filters.minAmount}
            onChange=${(event) =>
              updateFilter("minAmount", formatNumericInput(event.target.value))}
            className=${INPUT_CLASS}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-bold">Nominal maksimum</span>
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            value=${filters.maxAmount}
            onChange=${(event) =>
              updateFilter("maxAmount", formatNumericInput(event.target.value))}
            className=${INPUT_CLASS}
          />
        </label>

        <label className="col-span-2 block">
          <span className="mb-1.5 block text-xs font-bold">Urutkan</span>
          <select
            value=${filters.sortBy}
            onChange=${(event) => updateFilter("sortBy", event.target.value)}
            className=${INPUT_CLASS}
          >
            ${HISTORY_SORT_OPTIONS.map(
              (option) => html`
                <option key=${option.value} value=${option.value}>
                  ${option.label}
                </option>
              `,
            )}
          </select>
        </label>

      </div>
      <${FormActionDock}>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick=${onReset}
            className="cuan-secondary min-h-12 rounded-xl px-3 py-2.5 text-sm font-bold transition"
          >
            Reset filter
          </button>
          ${onDone
            ? html`
                <button
                  type="button"
                  onClick=${onDone}
                  className="history-action-primary min-h-12 rounded-xl px-3 py-2.5 text-sm font-black"
                >
                  Terapkan
                </button>
              `
            : null}
        </div>
      <//>
    </div>
  `;
}

function getTransactionAccountLabel(transaction, accountById) {
  function getShortName(account) {
    return account?.name || getAssetAccountDisplayName(account);
  }

  const flow = getTransactionFlow(transaction);
  if (flow === "income") {
    const account = accountById.get(transaction.destination_account_id);
    return account ? getShortName(account) : "Dompet tidak tercatat";
  }
  if (flow === "expense") {
    const account = accountById.get(transaction.source_account_id);
    return account ? getShortName(account) : "Dompet tidak tercatat";
  }

  const source = accountById.get(transaction.source_account_id);
  const destination = accountById.get(transaction.destination_account_id);
  if (source && destination) {
    return `${getShortName(source)} ke ${getShortName(destination)}`;
  }
  return source
    ? getShortName(source)
    : destination
      ? getShortName(destination)
      : "Dompet tidak tercatat";
}

export function TransactionItem({
  transaction,
  onOpen,
  fallbackRate = 0,
  accountById = new Map(),
}) {
  const tone = getTransactionTone(transaction);
  const compactAmount = getTransactionCompactAmount(transaction, fallbackRate);
  const title = getTransactionDisplayTitle(transaction);
  const categoryLabel = getTransactionCategoryLabel(transaction);
  const flow = getTransactionFlow(transaction);
  const accountLabel = getTransactionAccountLabel(transaction, accountById);
  const Icon =
    flow === "income"
      ? ArrowDownLeft
      : flow === "exchange"
        ? ArrowRightLeft
        : ArrowUpRight;
  const metadata = [
    flow === "exchange" ? "Transfer / Exchange" : categoryLabel,
    accountLabel,
    formatShortTime(transaction.occurred_at),
  ].filter(Boolean);

  return html`
    <button
      type="button"
      onClick=${() => onOpen(transaction)}
      className="history-transaction-item transaction-item group grid min-h-[66px] w-full grid-cols-[38px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition duration-200 hover:border-brand-300/30"
      aria-label=${`Buka detail ${title}`}
    >
      <span className=${`history-icon-badge flex h-[38px] w-[38px] items-center justify-center rounded-[10px] ring-1 transition duration-200 group-hover:scale-105 ${tone.historyIcon}`}>
        <${Icon} aria-hidden="true" className="h-4 w-4" />
      </span>

      <span className="min-w-0">
        <span className="history-item-title block truncate text-[13px] font-black leading-5 text-slate-950 dark:text-white">
          ${title}
        </span>
        <span className="history-item-meta mt-0.5 block truncate text-[10px] font-semibold leading-4 text-slate-500 dark:text-slate-400">
          ${metadata.join(" \u00b7 ")}
        </span>
      </span>

      <span className="min-w-0 max-w-[8rem] text-right">
        <span className=${`block truncate text-[13px] font-black leading-5 ${tone.amount}`}>
          ${compactAmount.primary}
        </span>
        <span className="history-item-secondary mt-0.5 block truncate text-[9px] font-bold uppercase text-slate-500 dark:text-slate-400">
          ${compactAmount.secondary}
        </span>
      </span>
    </button>
  `;
}

export function TransactionFilterTabs({ value, onChange }) {
  return html`
    <div className="cuan-segment grid grid-cols-4 gap-1 rounded-xl p-1">
      ${TRANSACTION_FILTER_TABS.map((tab) => {
        const active = value === tab.value;
        return html`
          <button
            key=${tab.value}
            type="button"
            onClick=${() => onChange(tab.value)}
            aria-pressed=${active}
            className=${`min-h-10 rounded-lg px-1.5 text-[11px] font-black transition duration-200 ${active ? "bg-brand-600 text-white shadow-[0_8px_22px_rgba(16,185,129,0.18)] dark:bg-emerald-500" : "text-slate-600 hover:bg-white/75 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"}`}
          >
            ${tab.label}
          </button>
        `;
      })}
    </div>
  `;
}
