import React, { useEffect, useMemo, useState } from "https://esm.sh/react@18.3.1";
import htm from "https://esm.sh/htm@3.1.1";
import {
  Download,
  Search,
  SlidersHorizontal,
  X,
} from "https://esm.sh/lucide-react@0.468.0?deps=react@18.3.1";
import { getLatestRateForCurrencyUntil } from "../../domain/exchange.js";
import { transactionBelongsToAccount } from "../../domain/transactions.js";
import {
  DEFAULT_BASE_CURRENCY,
  normalizeCurrencyCode,
} from "../../lib/currency.js";
import { getMonthKey } from "../../lib/dates.js";
import { TransactionDetailSheet } from "./TransactionDetailSheet.js";
import {
  TransactionFilterTabs,
  TransactionItem,
} from "./HistoryListParts.js";
import {
  HistoryFilterSheet,
  StatementExportSheet,
} from "./HistoryToolSheets.js";
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

const HISTORY_SORT_LABELS = {
  oldest: "Terlama",
  largest: "Nominal terbesar",
  smallest: "Nominal terkecil",
};

export function TransactionHistoryPage({
  transactions,
  onDelete,
  onUpdate,
  loading = false,
  activeCurrencies = [],
  assetAccounts = [],
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
  const [exportAccountId, setExportAccountId] = useState("all");
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [exportSheetOpen, setExportSheetOpen] = useState(false);
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
  const accountById = useMemo(
    () => new Map(assetAccounts.map((account) => [account.id, account])),
    [assetAccounts],
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
  const exportTransactions = useMemo(
    () =>
      transactions.filter(
        (transaction) =>
          exportAccountId === "all" ||
          transactionBelongsToAccount(transaction, exportAccountId),
      ),
    [transactions, exportAccountId],
  );
  const exportCount = useMemo(
    () =>
      exportTransactions.filter(
        (transaction) =>
          exportMonthKey && getMonthKey(transaction.occurred_at) === exportMonthKey,
      ).length,
    [exportTransactions, exportMonthKey],
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
  const categoryLabelByValue = useMemo(
    () => new Map(categoryOptions.map((option) => [option.value, option.label])),
    [categoryOptions],
  );
  const currencyLabelByValue = useMemo(
    () => new Map(currencyOptions.map((option) => [option.value, option.label])),
    [currencyOptions],
  );
  const activeFilterChips = useMemo(() => {
    const chips = [];
    if (filters.startDate || filters.endDate) {
      chips.push({
        key: "date",
        label: getTransactionRangeLabel(filters),
        clear: () =>
          setFilters((current) => ({
            ...current,
            startDate: "",
            endDate: "",
          })),
      });
    }
    if (filters.category !== "all") {
      chips.push({
        key: "category",
        label: categoryLabelByValue.get(filters.category) || filters.category,
        clear: () => updateFilter("category", "all"),
      });
    }
    if (filters.currency !== "all") {
      chips.push({
        key: "currency",
        label: currencyLabelByValue.get(filters.currency) || filters.currency,
        clear: () => updateFilter("currency", "all"),
      });
    }
    if (filters.minAmount) {
      chips.push({
        key: "min",
        label: `Min. ${filters.minAmount}`,
        clear: () => updateFilter("minAmount", ""),
      });
    }
    if (filters.maxAmount) {
      chips.push({
        key: "max",
        label: `Maks. ${filters.maxAmount}`,
        clear: () => updateFilter("maxAmount", ""),
      });
    }
    if (filters.sortBy !== "newest") {
      chips.push({
        key: "sort",
        label: HISTORY_SORT_LABELS[filters.sortBy] || "Urutan khusus",
        clear: () => updateFilter("sortBy", "newest"),
      });
    }
    return chips;
  }, [
    filters,
    categoryLabelByValue,
    currencyLabelByValue,
  ]);
  const advancedFilterCount = activeFilterChips.length;

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

  useEffect(() => {
    if (
      exportAccountId !== "all" &&
      !assetAccounts.some((account) => account.id === exportAccountId)
    ) {
      setExportAccountId("all");
    }
  }, [assetAccounts, exportAccountId]);

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function resetFilters() {
    setFilters({ ...DEFAULT_TRANSACTION_FILTERS });
  }

  function handleDownloadMonth() {
    if (!exportMonthKey || exportCount === 0) return;
    downloadMonthlyStatement(exportTransactions, exportMonthKey, latestRate);
    setExportSheetOpen(false);
  }

  return html`
    <div className="history-page grid gap-2.5 pb-[calc(5.75rem+env(safe-area-inset-bottom))] lg:pb-0">
      <section
        className="history-filter-panel rounded-2xl border p-2.5"
        aria-label="Pencarian dan penyaring transaksi"
      >
        <div className="grid gap-2.5">
          <label className="relative block">
            <span className="sr-only">Cari transaksi</span>
            <${Search}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              autoComplete="off"
              placeholder="Cari transaksi"
              value=${filters.search}
              onChange=${(event) => updateFilter("search", event.target.value)}
              className="cuan-input min-h-10 w-full rounded-xl py-2 pl-9 pr-10 text-sm transition"
            />
            ${filters.search
              ? html`
                  <button
                    type="button"
                    onClick=${() => updateFilter("search", "")}
                    aria-label="Hapus pencarian"
                    className="absolute right-1 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-200/70 dark:hover:bg-white/10"
                  >
                    <${X} aria-hidden="true" className="h-4 w-4" />
                  </button>
                `
              : null}
          </label>
          <${TransactionFilterTabs}
            value=${filters.type}
            onChange=${(value) => updateFilter("type", value)}
          />
          <div className="flex min-h-9 items-center justify-between gap-2 border-t border-slate-200/70 pt-2 dark:border-white/10">
            <p className="min-w-0 truncate text-[11px] font-bold text-slate-500 dark:text-slate-400">
              ${historyCountLabel}
            </p>
            <div className="flex shrink-0 items-center gap-1.5">
              ${!hasFilters && filteredTransactions.length > HISTORY_VISIBLE_LIMIT
                ? html`
                    <button
                      type="button"
                      onClick=${() => setShowAllHistory((current) => !current)}
                      className="min-h-9 rounded-lg px-2 text-[10px] font-black text-emerald-600 transition hover:bg-emerald-500/10 dark:text-emerald-300"
                    >
                      ${showAllHistory ? "Ringkas" : "Lihat semua"}
                    </button>
                  `
                : null}
              <button
                type="button"
                onClick=${() => setFilterSheetOpen(true)}
                className="cuan-secondary inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-black transition"
              >
                <${SlidersHorizontal} aria-hidden="true" className="h-3.5 w-3.5" />
                ${advancedFilterCount ? `Filter (${advancedFilterCount})` : "Filter"}
              </button>
              <button
                type="button"
                onClick=${() => setExportSheetOpen(true)}
                aria-label="Unduh mutasi"
                title="Unduh mutasi"
                className="cuan-secondary inline-flex h-9 min-h-9 w-9 items-center justify-center rounded-lg transition"
              >
                <${Download} aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          </div>
          ${activeFilterChips.length
            ? html`
                <div className="flex flex-wrap gap-1.5" aria-label="Filter aktif">
                  ${activeFilterChips.map(
                    (chip) => html`
                      <button
                        key=${chip.key}
                        type="button"
                        onClick=${chip.clear}
                        className="inline-flex min-h-8 max-w-full items-center gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2 text-[10px] font-bold text-emerald-700 dark:text-emerald-300"
                        aria-label=${`Hapus filter ${chip.label}`}
                      >
                        <span className="truncate">${chip.label}</span>
                        <${X} aria-hidden="true" className="h-3 w-3 shrink-0" />
                      </button>
                    `,
                  )}
                  <button
                    type="button"
                    onClick=${resetFilters}
                    className="min-h-8 rounded-lg px-2 text-[10px] font-black text-slate-500 transition hover:bg-slate-200/60 dark:text-slate-400 dark:hover:bg-white/10"
                  >
                    Reset filter
                  </button>
                </div>
              `
            : null}
        </div>
      </section>

      <section className="history-list-panel rounded-2xl p-2">
        ${visibleTransactions.length
          ? html`
              <div className="grid gap-3">
                ${groupedTransactions.map(
                  (group) => html`
                    <div key=${group.key} className="grid gap-1.5">
                      <div className="history-date-header flex min-h-7 items-center justify-between border-b px-1.5 py-1 text-[10px] font-black text-slate-600 dark:text-slate-300">
                        <span className="truncate">${group.label}</span>
                        <span className="shrink-0 text-slate-400">
                          ${group.transactions.length} transaksi
                        </span>
                      </div>
                      <div className="grid gap-1.5">
                        ${group.transactions.map(
                          (transaction) => html`
                            <${TransactionItem}
                              key=${transaction.id}
                              transaction=${transaction}
                              onOpen=${setSelectedTransaction}
                              fallbackRate=${latestRate}
                              accountById=${accountById}
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
              <div className="rounded-xl border border-dashed border-slate-300/70 p-5 text-center dark:border-white/10">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-brand-300/25 bg-brand-500/10 text-sm font-black text-brand-700 dark:border-brand-300/20 dark:text-brand-300">
                  0
                </div>
                <h4 className="mt-3 font-display text-base font-bold text-slate-950 dark:text-white">
                  ${transactions.length ? "Tidak ada transaksi yang cocok" : emptyMessage}
                </h4>
                <p className="mx-auto mt-1.5 max-w-md text-xs leading-5 text-slate-600 dark:text-slate-300/80">
                  ${transactions.length
                    ? "Coba longgarkan tanggal, kategori, nominal, atau kata kunci pencarian."
                    : emptyHint}
                </p>
                ${!transactions.length && onEmptyAction
                  ? html`
                      <button
                        type="button"
                        onClick=${onEmptyAction}
                        className="history-action-primary mt-4 min-h-11 rounded-xl px-4 py-2.5 text-sm font-semibold"
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
                        className="mt-4 min-h-11 rounded-xl border border-white/10 bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
                      >
                        Reset filter
                      </button>
                    ` 
                  : null}
              </div>
            `}
      </section>

      <${HistoryFilterSheet}
        open=${filterSheetOpen}
        filters=${filters}
        onChange=${setFilters}
        onReset=${resetFilters}
        onClose=${() => setFilterSheetOpen(false)}
        categoryOptions=${categoryOptions}
        currencyOptions=${currencyOptions}
      />

      <${StatementExportSheet}
        open=${exportSheetOpen}
        monthKey=${exportMonthKey}
        onMonthChange=${setExportMonthKey}
        accountId=${exportAccountId}
        onAccountChange=${setExportAccountId}
        accounts=${assetAccounts}
        transactionCount=${exportCount}
        onDownload=${handleDownloadMonth}
        onClose=${() => setExportSheetOpen(false)}
      />

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
