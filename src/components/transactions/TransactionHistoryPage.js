import React, { useEffect, useMemo, useState } from "https://esm.sh/react@18.3.1";
import htm from "https://esm.sh/htm@3.1.1";
import { getLatestRateForCurrencyUntil } from "../../domain/exchange.js";
import {
  DEFAULT_BASE_CURRENCY,
  normalizeCurrencyCode,
} from "../../lib/currency.js";
import { getMonthKey } from "../../lib/dates.js";
import { TransactionDetailSheet } from "./TransactionDetailSheet.js";
import {
  TransactionFilter,
  TransactionFilterTabs,
  TransactionItem,
} from "./HistoryListParts.js";
import {
  DEFAULT_TRANSACTION_FILTERS,
  HISTORY_VISIBLE_LIMIT,
  downloadMonthlyStatement,
  filterAndSortTransactions,
  getHistoryCategoryOptions,
  getHistoryCurrencyOptions,
  getTransactionRangeLabel,
  groupTransactionsByDay,
  hasActiveTransactionFilters,
} from "./history.js";

const html = htm.bind(React.createElement);
const INPUT_CLASS =
  "w-full min-h-12 rounded-2xl px-4 py-3.5 text-sm transition cuan-input";
export function TransactionHistoryPage({
  transactions,
  onDelete,
  onUpdate,
  loading = false,
  activeCurrencies = [],
  baseCurrency = DEFAULT_BASE_CURRENCY,
  title = "Aktivitas Terakhir",
  description = "",
  emptyMessage = "Belum ada transaksi.",
  emptyHint = "Catat transaksi pertama agar riwayat, saldo, dan laporan mulai terisi.",
  emptyActionLabel = "Catat transaksi pertama",
  onEmptyAction = null,
}) {
  const [filters, setFilters] = useState(() => ({ ...DEFAULT_TRANSACTION_FILTERS }));
  const [exportMonthKey, setExportMonthKey] = useState(getMonthKey(new Date()));
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const categoryOptions = useMemo(
    () => getHistoryCategoryOptions(transactions),
    [transactions],
  );
  const currencyOptions = useMemo(
    () => getHistoryCurrencyOptions(activeCurrencies),
    [activeCurrencies],
  );
  const filteredTransactions = useMemo(
    () => filterAndSortTransactions(transactions, filters),
    [transactions, filters],
  );
  const hasFilters = hasActiveTransactionFilters(filters);
  const visibleTransactions = useMemo(
    () =>
      hasFilters || showAllHistory
        ? filteredTransactions
        : filteredTransactions.slice(0, HISTORY_VISIBLE_LIMIT),
    [filteredTransactions, hasFilters, showAllHistory],
  );
  const groupedTransactions = useMemo(
    () => groupTransactionsByDay(visibleTransactions),
    [visibleTransactions],
  );
  const latestRate = useMemo(
    () => getLatestRateForCurrencyUntil(
      transactions,
      "THB",
      new Date(8640000000000000),
      baseCurrency,
    ),
    [transactions, baseCurrency],
  );
  const exportCount = useMemo(
    () =>
      transactions.filter(
        (transaction) =>
          exportMonthKey && getMonthKey(transaction.occurred_at) === exportMonthKey,
      ).length,
    [transactions, exportMonthKey],
  );
  const hiddenTransactionCount = Math.max(
    filteredTransactions.length - visibleTransactions.length,
    0,
  );
  const hasDateFilter = Boolean(filters.startDate || filters.endDate);
  const rangeLabel = hasDateFilter ? getTransactionRangeLabel(filters) : "";
  const historyCountLabel = !transactions.length
    ? "0 transaksi"
    : hasFilters
      ? `${filteredTransactions.length} dari ${transactions.length} transaksi${hasDateFilter ? ` - ${rangeLabel}` : ""}`
      : hiddenTransactionCount
        ? `${visibleTransactions.length} terbaru dari ${transactions.length} transaksi`
        : `${filteredTransactions.length} transaksi`;

  useEffect(() => {
    setFilters((current) => {
      if (
        current.currency === "all" ||
        activeCurrencies.includes(normalizeCurrencyCode(current.currency))
      ) {
        return current;
      }
      return { ...current, currency: "all" };
    });
  }, [activeCurrencies.join("|")]);

  useEffect(() => {
    setShowAllHistory(false);
  }, [filters]);

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function resetFilters() {
    setFilters({ ...DEFAULT_TRANSACTION_FILTERS });
  }

  function handleDownloadMonth() {
    if (!exportMonthKey || exportCount === 0) return;
    downloadMonthlyStatement(transactions, exportMonthKey, latestRate);
  }

  return html`
    <div className="grid gap-3">
      <section className="history-filter-panel sticky top-3 z-20 rounded-[24px] border border-slate-200/70 bg-white/82 p-2.5 shadow-[0_18px_50px_rgba(15,23,42,0.10)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/82 dark:shadow-black/30">
        <div className="grid gap-3">
          <input
            type="search"
            autoComplete="off"
            placeholder="Cari transaksi"
            value=${filters.search}
            onChange=${(event) => updateFilter("search", event.target.value)}
            className=${INPUT_CLASS}
          />
          <${TransactionFilterTabs}
            value=${filters.type}
            onChange=${(value) => updateFilter("type", value)}
          />
          <div className="grid gap-2 rounded-[20px] border border-slate-200/70 bg-white/56 p-2 dark:border-white/10 dark:bg-slate-900/36 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                Mutasi
              </span>
              <input
                type="month"
                value=${exportMonthKey}
                onChange=${(event) => setExportMonthKey(event.target.value)}
                className=${`${INPUT_CLASS} min-h-11 py-2.5`}
              />
            </label>
            <button
              type="button"
              onClick=${handleDownloadMonth}
              disabled=${!exportMonthKey || exportCount === 0}
              className="history-action-primary min-h-11 rounded-2xl px-4 py-2.5 text-xs font-black disabled:cursor-not-allowed disabled:opacity-45"
            >
              Unduh CSV
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              ${historyCountLabel}
            </p>
            <div className="flex flex-wrap items-center justify-end gap-2">
              ${!hasFilters && filteredTransactions.length > HISTORY_VISIBLE_LIMIT
                ? html`
                    <button
                      type="button"
                      onClick=${() => setShowAllHistory((current) => !current)}
                      className="cuan-secondary min-h-10 rounded-2xl px-3 py-2 text-xs font-black transition hover:-translate-y-0.5"
                    >
                      ${showAllHistory ? "Ringkas" : "Lihat semua"}
                    </button>
                  `
                : null}
              <button
                type="button"
                onClick=${() => setShowAdvancedFilters((current) => !current)}
                className="cuan-secondary min-h-10 rounded-2xl px-3 py-2 text-xs font-black transition hover:-translate-y-0.5"
              >
                ${showAdvancedFilters ? "Tutup penyaring" : "Penyaring lanjutan"}
              </button>
            </div>
          </div>
        </div>
      </section>

      ${showAdvancedFilters
        ? html`
            <${TransactionFilter}
              filters=${filters}
              onChange=${setFilters}
              onReset=${resetFilters}
              categoryOptions=${categoryOptions}
              currencyOptions=${currencyOptions}
              showSearch=${false}
            />
          `
        : null}

      <section className="history-list-panel relative overflow-hidden rounded-[30px] p-3 md:p-5">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),transparent_50%)] opacity-80"></div>
        ${visibleTransactions.length
          ? html`
              <div className="relative grid gap-5">
                ${groupedTransactions.map(
                  (group) => html`
                    <div key=${group.key} className="grid gap-3">
                      <div className="history-date-header relative z-0 mt-1 flex items-center justify-between rounded-2xl border border-slate-200/65 bg-white/80 px-3 py-2 text-xs font-black text-slate-600 shadow-[0_10px_28px_rgba(15,23,42,0.06)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/78 dark:text-slate-300">
                        <span>${group.label}</span>
                        <span>${group.transactions.length}</span>
                      </div>
                      <div className="grid gap-2.5">
                        ${group.transactions.map(
                          (transaction) => html`
                            <${TransactionItem}
                              key=${transaction.id}
                              transaction=${transaction}
                              onOpen=${setSelectedTransaction}
                              fallbackRate=${latestRate}
                            />
                          `,
                        )}
                      </div>
                    </div>
                  `,
                )}
              </div>
            `
          : html`
              <div className="relative rounded-[24px] border border-dashed border-slate-300/70 bg-white/52 p-6 text-center backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/25 md:p-8">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-brand-300/25 bg-brand-500/10 text-xl font-black text-brand-700 dark:border-brand-300/20 dark:text-brand-300">
                  0
                </div>
                <h4 className="mt-4 font-display text-xl font-bold text-slate-950 dark:text-white">
                  ${transactions.length ? "Tidak ada transaksi yang cocok" : emptyMessage}
                </h4>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-300/80">
                  ${transactions.length
                    ? "Coba longgarkan tanggal, kategori, nominal, atau kata kunci pencarian."
                    : emptyHint}
                </p>
                ${!transactions.length && onEmptyAction
                  ? html`
                      <button
                        type="button"
                        onClick=${onEmptyAction}
                        className="history-action-primary mt-5 min-h-12 rounded-2xl px-5 py-3 text-sm font-semibold"
                      >
                        ${emptyActionLabel}
                      </button>
                    `
                  : null}
                ${hasFilters
                  ? html`
                      <button
                        type="button"
                        onClick=${resetFilters}
                        className="mt-5 min-h-12 rounded-2xl border border-white/10 bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_44px_rgba(16,185,129,0.18)] transition hover:-translate-y-0.5 hover:bg-brand-700"
                      >
                        Reset penyaring
                      </button>
                    ` 
                  : null}
              </div>
            `}
      </section>

      <${TransactionDetailSheet}
        transaction=${selectedTransaction}
        onClose=${() => setSelectedTransaction(null)}
        onDelete=${onDelete}
        onUpdate=${onUpdate}
        fallbackRate=${latestRate}
        loading=${loading}
        activeCurrencies=${activeCurrencies}
        baseCurrency=${baseCurrency}
      />
    </div>
  `;
}


