import React from "https://esm.sh/react@18.3.1";
import htm from "https://esm.sh/htm@3.1.1";
import { getTransactionFlow } from "../../domain/transactions.js";
import { formatNumericInput } from "../../lib/currency.js";
import { formatShortDateTime } from "../../lib/dates.js";
import {
  getTransactionCategoryLabel,
  getTransactionCompactAmount,
  getTransactionDisplayTitle,
  getTransactionIconLabel,
  getTransactionTone,
} from "./presentation.js";

const html = htm.bind(React.createElement);

const FILTER_PANEL =
  "relative overflow-hidden rounded-[26px] cuan-card-soft";
const INPUT_CLASS =
  "w-full min-h-12 rounded-2xl px-4 py-3.5 text-sm transition cuan-input";

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
}) {
  function updateFilter(field, value) {
    onChange((current) => ({ ...current, [field]: value }));
  }

  return html`
    <section className=${`${FILTER_PANEL} p-4 md:p-5`}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),transparent_50%)] opacity-80"></div>
      <div className="relative grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        ${showSearch
          ? html`
              <label className="block md:col-span-2 xl:col-span-4">
                <span className="mb-2 block text-sm font-medium">Cari catatan</span>
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
          <span className="mb-2 block text-sm font-medium">Dari tanggal</span>
          <input
            type="date"
            value=${filters.startDate}
            onChange=${(event) => updateFilter("startDate", event.target.value)}
            className=${INPUT_CLASS}
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium">Sampai tanggal</span>
          <input
            type="date"
            value=${filters.endDate}
            onChange=${(event) => updateFilter("endDate", event.target.value)}
            className=${INPUT_CLASS}
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium">Tipe transaksi</span>
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

        <label className="block">
          <span className="mb-2 block text-sm font-medium">Kategori</span>
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

        <label className="block">
          <span className="mb-2 block text-sm font-medium">Mata uang</span>
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
          <span className="mb-2 block text-sm font-medium">Nominal minimum</span>
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
          <span className="mb-2 block text-sm font-medium">Nominal maksimum</span>
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

        <label className="block">
          <span className="mb-2 block text-sm font-medium">Urutkan</span>
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

        <div className="flex items-end">
          <button
            type="button"
            onClick=${onReset}
            className="cuan-secondary min-h-12 w-full rounded-2xl px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5"
          >
            Reset penyaring
          </button>
        </div>
      </div>
    </section>
  `;
}

export function TransactionItem({ transaction, onOpen, fallbackRate = 0 }) {
  const tone = getTransactionTone(transaction);
  const compactAmount = getTransactionCompactAmount(transaction, fallbackRate);
  const title = getTransactionDisplayTitle(transaction);
  const categoryLabel = getTransactionCategoryLabel(transaction);
  const flow = getTransactionFlow(transaction);

  return html`
    <button
      type="button"
      onClick=${() => onOpen(transaction)}
      className="history-transaction-item transaction-item group grid min-h-[76px] w-full grid-cols-[44px_1fr_auto] items-center gap-3 rounded-[22px] border border-slate-200/70 bg-white/60 px-3 py-2.5 text-left shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:border-brand-300/30 hover:bg-white/82 dark:border-white/10 dark:bg-slate-900/52 dark:shadow-black/20 dark:hover:bg-slate-900/75"
      aria-label=${`Buka detail ${title}`}
    >
      <span className=${`history-icon-badge flex h-11 w-11 items-center justify-center rounded-2xl text-[11px] font-black uppercase tracking-[0.08em] leading-none ring-1 transition duration-300 group-hover:scale-105 ${tone.historyIcon}`}>
        ${getTransactionIconLabel(transaction)}
      </span>

      <span className="min-w-0">
        <span className="history-item-title block truncate text-sm font-black text-slate-950 dark:text-white">
          ${title}
        </span>
        <span className="history-item-meta mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          <span className=${`history-chip max-w-[8rem] truncate rounded-full px-2 py-0.5 ${tone.chip}`}>
            ${flow === "exchange" ? "Exchange" : categoryLabel}
          </span>
          <span>${formatShortDateTime(transaction.occurred_at)}</span>
        </span>
      </span>

      <span className="min-w-0 text-right">
        <span className=${`block max-w-[8.5rem] truncate text-sm font-black ${tone.amount}`}>
          ${compactAmount.primary}
        </span>
        <span className="history-item-secondary mt-1 block max-w-[8.5rem] truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
          ${compactAmount.secondary}
        </span>
      </span>
    </button>
  `;
}

export function TransactionFilterTabs({ value, onChange }) {
  return html`
    <div className="cuan-segment grid grid-cols-4 gap-1 rounded-[22px] p-1">
      ${TRANSACTION_FILTER_TABS.map((tab) => {
        const active = value === tab.value;
        return html`
          <button
            key=${tab.value}
            type="button"
            onClick=${() => onChange(tab.value)}
            className=${`min-h-11 rounded-2xl px-2 text-xs font-black transition duration-300 ${active ? "bg-brand-600 text-white shadow-[0_14px_34px_rgba(16,185,129,0.22)] dark:bg-emerald-500" : "text-slate-600 hover:bg-white/75 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"}`}
          >
            ${tab.label}
          </button>
        `;
      })}
    </div>
  `;
}
