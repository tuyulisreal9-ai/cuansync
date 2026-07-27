import React, { useState } from "https://esm.sh/react@18.3.1";
import htm from "https://esm.sh/htm@3.1.1";
import {
  CATEGORY_OPTIONS,
  getBudgetCategoryKey,
  getBudgetCategoryMeta,
  getDefaultGroupForCategory,
} from "../../domain/budgets.js";
import {
  formatCurrency,
  formatNumericInput,
  normalizeCurrencyCode,
  normalizeNumericInput,
} from "../../lib/currency.js";

const html = htm.bind(React.createElement);
const PREMIUM_PANEL = "relative overflow-hidden rounded-[30px] cuan-card";
const GLASS_INPUT =
  "w-full min-h-12 rounded-2xl px-4 py-3.5 text-sm transition cuan-input";

export function BudgetWorkspacePage({
  metrics,
  baseCurrency,
  onBudgetDelete,
  onBudgetSubmit,
  loading = false,
}) {
  const budgetCurrency = normalizeCurrencyCode(baseCurrency);
  const selectedBudgets = metrics.budgetInsights.filter(
    (item) => item.currency === budgetCurrency,
  );
  const targetTotal = selectedBudgets.reduce(
    (sum, item) => sum + Number(item.limitAmount || 0),
    0,
  );
  const spentTotal = selectedBudgets.reduce(
    (sum, item) => sum + Number(item.spentAmount || 0),
    0,
  );
  const remainingTotal = targetTotal - spentTotal;

  return html`
    <div className="grid gap-4 pb-[calc(8rem+env(safe-area-inset-bottom))] lg:pb-0">
      <section className=${`${PREMIUM_PANEL} p-4 md:p-5`}>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),transparent_50%)] opacity-80"></div>
        <div className="relative grid gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              Anggaran
            </p>
            <h2 className="mt-2 font-display text-2xl font-black tracking-[-0.02em] text-slate-950 dark:text-white md:text-3xl">
              Atur kategori bulan ini
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300/85">
              Mulai dari kategori penting. Tambahkan kebutuhan lain nanti kalau sudah perlu.
            </p>
          </div>
          <div className="rounded-[22px] border border-slate-200/70 bg-white/46 p-3 dark:border-white/10 dark:bg-slate-950/28">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  Target
                </p>
                <p className="mt-1 text-base font-black text-slate-950 dark:text-white">
                  ${targetTotal > 0
                    ? formatCurrency(targetTotal, budgetCurrency)
                    : "-"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  Terpakai
                </p>
                <p className="mt-1 text-base font-black text-slate-950 dark:text-white">
                  ${spentTotal > 0
                    ? formatCurrency(spentTotal, budgetCurrency)
                    : "-"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  ${remainingTotal < 0 ? "Lewat" : "Tersisa"}
                </p>
                <p
                  className=${`mt-1 text-base font-black ${
                    remainingTotal < 0
                      ? "text-rose-600 dark:text-rose-300"
                      : "text-brand-700 dark:text-brand-200"
                  }`}
                >
                  ${targetTotal > 0
                    ? formatCurrency(Math.abs(remainingTotal), budgetCurrency)
                    : "-"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <${ControlBudgetHub}
        metrics=${metrics}
        selectedCurrency=${budgetCurrency}
        loading=${loading}
        onBudgetDelete=${onBudgetDelete}
        onBudgetSubmit=${onBudgetSubmit}
      />
    </div>
  `;
}

export function ControlBudgetHub({
  metrics,
  selectedCurrency,
  loading,
  onBudgetDelete,
  onBudgetSubmit,
}) {
  const [editingKey, setEditingKey] = useState(null);
  const [draftTarget, setDraftTarget] = useState("");
  const selectedBudgets = metrics.budgetInsights.filter(
    (item) => item.currency === selectedCurrency,
  );
  const categoryOptionKeys = new Set(
    CATEGORY_OPTIONS.map((item) => getBudgetCategoryKey(item.value)),
  );
  const budgetByCategory = new Map(
    selectedBudgets.map((budget) => [budget.categoryKey, budget]),
  );
  const budgetRows = [
    ...CATEGORY_OPTIONS.map((item) => ({
      key: getBudgetCategoryKey(item.value),
      value: item.value,
      label: item.label,
      meta: getBudgetCategoryMeta(item.value),
      budget: budgetByCategory.get(getBudgetCategoryKey(item.value)) || null,
    })),
    ...selectedBudgets
      .filter((budget) => !categoryOptionKeys.has(budget.categoryKey))
      .map((budget) => ({
        key: budget.categoryKey,
        value: budget.category,
        label: budget.categoryLabel,
        meta: budget.meta,
        budget,
      })),
  ];

  function startEdit(row) {
    setEditingKey(row.key);
    setDraftTarget(
      row.budget?.limitAmount
        ? formatNumericInput(String(row.budget.limitAmount))
        : "",
    );
  }

  async function saveRow(row) {
    const ok = await onBudgetSubmit({
      month_key: metrics.currentMonthKey,
      group_key: getDefaultGroupForCategory(row.value),
      category: row.value,
      currency: selectedCurrency,
      limit_amount: normalizeNumericInput(draftTarget),
    });
    if (ok) {
      setEditingKey(null);
      setDraftTarget("");
    }
  }

  return html`
    <section
      id="control-budget-section"
      className=${`${PREMIUM_PANEL} scroll-mt-6 overflow-hidden p-0`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),transparent_50%)] opacity-80"></div>
      <div className="relative">
        <div className="flex flex-col gap-4 border-b border-slate-200/65 p-4 dark:border-white/10 md:flex-row md:items-end md:justify-between md:p-5">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
              Anggaran
            </p>
            <h3 className="mt-2 font-display text-xl font-black text-slate-950 dark:text-white">
              Kategori bulan ini
            </h3>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-black text-slate-500 dark:text-slate-400">
                Bulan
              </span>
              <input
                type="month"
                value=${metrics.currentMonthKey}
                readOnly=${true}
                className=${`${GLASS_INPUT} h-11 text-sm`}
              />
            </label>
            <div>
              <span className="mb-1.5 block text-xs font-black text-slate-500 dark:text-slate-400">
                Mata uang anggaran
              </span>
              <div className="flex h-11 items-center rounded-2xl border border-slate-200/80 bg-white/60 px-4 text-sm font-black text-slate-950 dark:border-white/10 dark:bg-slate-900/50 dark:text-white">
                ${selectedCurrency}
              </div>
            </div>
          </div>
        </div>

        <div className="hidden border-b border-slate-200/65 px-5 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:border-white/10 dark:text-slate-400 md:grid md:grid-cols-[minmax(0,1.35fr)_0.85fr_0.85fr_0.85fr_auto] md:gap-3">
          <span>Kategori</span>
          <span>Target</span>
          <span>Terpakai</span>
          <span>Sisa</span>
          <span className="text-right">Aksi</span>
        </div>

        <div className="divide-y divide-slate-200/65 dark:divide-white/10">
          ${budgetRows.map((row) => {
            const budget = row.budget;
            const editing = editingKey === row.key;
            const spent = Number(budget?.spentAmount || 0);
            const target = Number(budget?.limitAmount || 0);
            const remaining = Number(
              budget?.remainingAmount ?? target - spent,
            );
            const usage = budget
              ? Math.min(
                  Math.max(
                    Number(budget.usage || 0) * 100,
                    spent > 0 ? 8 : 0,
                  ),
                  100,
                )
              : 0;
            const statusClass =
              budget?.status === "over"
                ? "text-rose-600 dark:text-rose-300"
                : budget?.status === "warning"
                  ? "text-amber-600 dark:text-amber-300"
                  : "text-brand-700 dark:text-brand-200";

            return html`
              <div
                key=${row.key}
                className="grid gap-3 px-4 py-4 transition hover:bg-slate-950/[0.025] dark:hover:bg-white/[0.035] md:grid-cols-[minmax(0,1.35fr)_0.85fr_0.85fr_0.85fr_auto] md:items-center md:gap-3 md:px-5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-brand-400/90"></span>
                    <p className="truncate text-sm font-black text-slate-950 dark:text-white">
                      ${row.label}
                    </p>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
                    <div
                      className=${`h-full rounded-full bg-gradient-to-r ${
                        budget?.barClass || "from-slate-500 to-slate-400"
                      }`}
                      style=${{ width: `${usage}%` }}
                    ></div>
                  </div>
                </div>

                ${editing
                  ? html`
                      <div className="md:col-span-3">
                        <input
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          value=${draftTarget}
                          onChange=${(event) =>
                            setDraftTarget(
                              formatNumericInput(event.target.value),
                            )}
                          placeholder=${`Target ${selectedCurrency}`}
                          className=${`${GLASS_INPUT} h-11 text-sm`}
                        />
                      </div>
                    `
                  : html`
                      <div className="grid grid-cols-3 gap-2 md:contents">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-500 md:hidden">
                            Target
                          </p>
                          <p className="mt-1 text-sm font-black text-slate-950 dark:text-white md:mt-0">
                            ${budget
                              ? formatCurrency(target, selectedCurrency)
                              : "Belum diatur"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-500 md:hidden">
                            Terpakai
                          </p>
                          <p className="mt-1 text-sm font-black text-slate-950 dark:text-white md:mt-0">
                            ${spent > 0
                              ? formatCurrency(spent, selectedCurrency)
                              : "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-500 md:hidden">
                            Sisa
                          </p>
                          <p
                            className=${`mt-1 text-sm font-black md:mt-0 ${
                              budget
                                ? statusClass
                                : "text-slate-500 dark:text-slate-400"
                            }`}
                          >
                            ${budget
                              ? formatCurrency(
                                  Math.abs(remaining),
                                  selectedCurrency,
                                )
                              : "-"}
                          </p>
                        </div>
                      </div>
                    `}

                <div className="flex items-center justify-end gap-2">
                  ${editing
                    ? html`
                        <button
                          type="button"
                          disabled=${loading}
                          onClick=${() => saveRow(row)}
                          className="rounded-full bg-brand-600 px-3 py-2 text-xs font-black text-white transition hover:bg-brand-500 disabled:opacity-60"
                        >
                          Simpan
                        </button>
                        <button
                          type="button"
                          onClick=${() => {
                            setEditingKey(null);
                            setDraftTarget("");
                          }}
                          className="rounded-full border border-slate-200/70 px-3 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-950/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                        >
                          Batal
                        </button>
                      `
                    : html`
                        <button
                          type="button"
                          onClick=${() => startEdit(row)}
                          className="rounded-full border border-brand-300/25 bg-brand-500/10 px-3 py-2 text-xs font-black text-brand-700 transition hover:bg-brand-500/16 dark:text-brand-200"
                        >
                          ${budget ? "Ubah" : "Atur"}
                        </button>
                        ${budget
                          ? html`
                              <button
                                type="button"
                                onClick=${() => onBudgetDelete(budget)}
                                className="rounded-full px-2.5 py-2 text-xs font-black text-rose-600 transition hover:bg-rose-500/10 dark:text-rose-300"
                              >
                                Hapus
                              </button>
                            `
                          : null}
                      `}
                </div>
              </div>
            `;
          })}
        </div>
      </div>
    </section>
  `;
}
