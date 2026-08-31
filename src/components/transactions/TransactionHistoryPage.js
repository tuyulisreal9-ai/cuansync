import React, { useEffect, useMemo, useState } from "react";
import htm from "htm";
import { getLatestRateForCurrencyUntil } from "../../domain/exchange.js";
import { transactionBelongsToAccount } from "../../domain/transactions.js";
import {
  DEFAULT_BASE_CURRENCY,
  formatCurrency,
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
  monthLabel = "",
  monthlyIncome = null,
  monthlyExpense = null,
  focusCategory = "",
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

  // "Lihat transaksinya" dari halaman Jatah membuka Riwayat yang sudah
  // tersaring ke kategori itu, bukan daftar penuh yang menyesatkan.
  useEffect(() => {
    if (!focusCategory) return;
    setFilters((current) => ({ ...current, category: focusCategory }));
  }, [focusCategory]);

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
      ${Number.isFinite(monthlyIncome) && Number.isFinite(monthlyExpense)
        ? html`
            <section className="dc-panel flex gap-4 p-[18px]">
              <div className="flex flex-1 flex-col gap-1">
                <span className="text-[11.5px] text-[#9c968b]">
                  Masuk ${monthLabel}
                </span>
                <span
                  className="dc-num text-[16px]"
                  style=${{ color: "var(--cs-pos)" }}
                >
                  +${formatCurrency(monthlyIncome, normalizeCurrencyCode(baseCurrency))}
                </span>
              </div>
              <div
                className="w-px shrink-0"
                style=${{ background: "rgba(250,247,241,0.14)" }}
              ></div>
              <div className="flex flex-1 flex-col gap-1">
                <span className="text-[11.5px] text-[#9c968b]">
                  Keluar ${monthLabel}
                </span>
                <span className="dc-num text-[16px]">
                  −${formatCurrency(monthlyExpense, normalizeCurrencyCode(baseCurrency))}
                </span>
              </div>
            </section>
          `
        : null}

      <div className="flex items-center gap-2.5" aria-label="Penyaring transaksi">
        <${TransactionFilterTabs}
          value=${filters.type}
          onChange=${(value) => updateFilter("type", value)}
        />
        <button
          type="button"
          onClick=${() => setFilterSheetOpen(true)}
          aria-label=${advancedFilterCount
            ? `Saring riwayat, ${advancedFilterCount} filter aktif`
            : "Saring riwayat"}
          className="relative flex h-[46px] w-[46px] shrink-0 flex-col items-center justify-center gap-[3.5px] rounded-[15px] border"
          style=${advancedFilterCount
            ? { background: "var(--cs-sel-bg)", borderColor: "var(--cs-sel-bg)" }
            : { background: "var(--cs-card)", borderColor: "var(--cs-line)" }}
        >
          ${[16, 11, 6].map(
            (width) => html`
              <span
                key=${width}
                className="block h-[1.6px] rounded-sm"
                style=${{
                  width: `${width}px`,
                  background: advancedFilterCount
                    ? "var(--cs-sel-fg)"
                    : "var(--cs-body)",
                }}
              ></span>
            `,
          )}
          ${advancedFilterCount
            ? html`
                <span
                  className="absolute -right-[5px] -top-[5px] flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold"
                  style=${{ background: "var(--cs-acc)", color: "var(--cs-on-acc)" }}
                >
                  ${advancedFilterCount}
                </span>
              `
            : null}
        </button>
      </div>

      ${activeFilterChips.length
        ? html`
            <div className="flex flex-wrap items-center gap-2" aria-label="Filter aktif">
              ${activeFilterChips.map(
                (chip) => html`
                  <button
                    key=${chip.key}
                    type="button"
                    onClick=${chip.clear}
                    aria-label=${`Hapus filter ${chip.label}`}
                    className="inline-flex min-h-8 max-w-full items-center gap-2 rounded-full px-3 text-xs font-medium"
                    style=${{ background: "var(--cs-seg)", color: "var(--cs-body)" }}
                  >
                    <span className="truncate">${chip.label}</span>
                    <span
                      aria-hidden="true"
                      className="shrink-0 text-[13px]"
                      style=${{ color: "var(--cs-faint)" }}
                    >
                      ×
                    </span>
                  </button>
                `,
              )}
              <button
                type="button"
                onClick=${resetFilters}
                className="px-1 py-1.5 text-xs font-bold"
                style=${{ color: "var(--cs-link)" }}
              >
                Hapus semua
              </button>
            </div>
          `
        : null}

      <section className="grid gap-4">
        ${visibleTransactions.length
          ? html`
              <div className="grid gap-4">
                ${groupedTransactions.map(
                  (group) => html`
                    <div key=${group.key} className="grid gap-2.5">
                      <span
                        className="truncate px-0.5 text-[13px] font-bold"
                        style=${{ color: "var(--cs-mut)" }}
                      >
                        ${group.label}
                      </span>
                      <div className="dc-card overflow-hidden">
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
                ${!hasFilters && filteredTransactions.length > HISTORY_VISIBLE_LIMIT
                  ? html`
                      <button
                        type="button"
                        onClick=${() => setShowAllHistory((current) => !current)}
                        className="min-h-11 w-full rounded-xl border text-xs font-bold"
                        style=${{ borderColor: "var(--cs-line)", color: "var(--cs-body)" }}
                      >
                        ${showAllHistory
                          ? "Ringkas lagi"
                          : `Lihat semua ${filteredTransactions.length} transaksi`}
                      </button>
                    `
                  : null}
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
        onExport=${() => setExportSheetOpen(true)}
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
        assetAccounts=${assetAccounts}
      />
    </div>
  `;
}
