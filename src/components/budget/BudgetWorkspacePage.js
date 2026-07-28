import React, { useState } from "https://esm.sh/react@18.3.1";
import htm from "https://esm.sh/htm@3.1.1";
import {
  PiggyBank,
  Trash2,
} from "https://esm.sh/lucide-react@0.468.0?deps=react@18.3.1";
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
import { TargetPlanningSection } from "./TargetPlanningSection.js";

const html = htm.bind(React.createElement);
const INPUT_CLASS =
  "cs-entry-input min-h-11 w-full rounded-lg px-3 py-2.5 text-sm";
const CATEGORY_COLORS = [
  "bg-rose-500",
  "bg-pink-500",
  "bg-orange-500",
  "bg-red-500",
  "bg-violet-500",
  "bg-cyan-500",
  "bg-lime-500",
  "bg-slate-500",
];

function BudgetSection({
  metrics,
  currency,
  loading,
  onBudgetDelete,
  onBudgetSubmit,
}) {
  const [showForm, setShowForm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(
    CATEGORY_OPTIONS[0]?.value || "",
  );
  const [limitAmount, setLimitAmount] = useState("");
  const activeBudgets = metrics.budgetInsights.filter(
    (budget) => budget.currency === currency,
  );
  const activeBudgetKeys = new Set(
    activeBudgets.map((budget) => budget.categoryKey),
  );
  const availableCategories = CATEGORY_OPTIONS.filter(
    (category) =>
      !activeBudgetKeys.has(getBudgetCategoryKey(category.value)),
  );
  const selectedBudget =
    activeBudgets.find(
      (budget) =>
        budget.categoryKey === getBudgetCategoryKey(selectedCategory),
    ) || null;

  function openForm(budget = null) {
    if (budget) {
      setSelectedCategory(budget.category);
      setLimitAmount(String(budget.limitAmount || ""));
      setShowForm(true);
      return;
    }
    const fallback = availableCategories[0] || CATEGORY_OPTIONS[0];
    setSelectedCategory(fallback?.value || "");
    const existing =
      activeBudgets.find(
        (item) =>
          item.categoryKey === getBudgetCategoryKey(fallback?.value),
      ) || null;
    setLimitAmount(existing ? String(existing.limitAmount || "") : "");
    setShowForm(true);
  }

  function selectCategory(value) {
    setSelectedCategory(value);
    const existing =
      activeBudgets.find(
        (budget) =>
          budget.categoryKey === getBudgetCategoryKey(value),
      ) || null;
    setLimitAmount(existing ? String(existing.limitAmount || "") : "");
  }

  async function submit(event) {
    event.preventDefault();
    const ok = await onBudgetSubmit({
      month_key: metrics.currentMonthKey,
      group_key: getDefaultGroupForCategory(selectedCategory),
      category: selectedCategory,
      currency,
      limit_amount: normalizeNumericInput(limitAmount),
    });
    if (ok) {
      setShowForm(false);
      setLimitAmount("");
    }
  }

  return html`
    <section>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <${PiggyBank}
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-emerald-400"
          />
          <h2 className="truncate text-xs font-black text-white sm:text-sm">
            Batas Anggaran Bulanan (${currency})
          </h2>
        </div>
        <button
          type="button"
          onClick=${showForm ? () => setShowForm(false) : openForm}
          className=${`min-h-9 shrink-0 rounded-lg px-3 text-[11px] font-black ${
            showForm
              ? "border border-slate-700 text-slate-300"
              : "bg-emerald-500/12 text-emerald-300"
          }`}
        >
          ${showForm ? "Tutup" : "+ Atur Anggaran"}
        </button>
      </div>

      ${showForm
        ? html`
            <form
              className="mt-3 grid gap-3 rounded-xl border border-slate-800 bg-slate-900/75 p-3"
              onSubmit=${submit}
            >
              <label className="block">
                <span className="cs-entry-label">Pilih kategori</span>
                <select
                  value=${selectedCategory}
                  onChange=${(event) => selectCategory(event.target.value)}
                  className=${INPUT_CLASS}
                >
                  ${CATEGORY_OPTIONS.map(
                    (category) => html`
                      <option key=${category.value} value=${category.value}>
                        ${category.label}
                      </option>
                    `,
                  )}
                </select>
                ${selectedBudget
                  ? html`
                      <span className="mt-1.5 block text-[10px] leading-4 text-emerald-300">
                        Anggaran ini sudah ada. Simpan untuk memperbarui batasnya.
                      </span>
                    `
                  : null}
              </label>
              <label className="block">
                <span className="cs-entry-label">
                  Batas pengeluaran bulanan (${currency})
                </span>
                <input
                  required
                  inputMode="decimal"
                  value=${limitAmount}
                  onChange=${(event) =>
                    setLimitAmount(formatNumericInput(event.target.value))}
                  placeholder="0"
                  className=${INPUT_CLASS}
                />
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick=${() => setShowForm(false)}
                  className="min-h-10 rounded-lg px-3 text-[10px] font-bold text-slate-400"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled=${loading}
                  className="min-h-10 rounded-lg bg-emerald-500 px-4 text-[10px] font-black text-white disabled:opacity-50"
                >
                  ${selectedBudget ? "Simpan Perubahan" : "Simpan Anggaran"}
                </button>
              </div>
            </form>
          `
        : null}

      <div className="mt-3 grid gap-2.5">
        ${activeBudgets.length
          ? activeBudgets.map((budget, index) => {
              const spent = Number(budget.spentAmount || 0);
              const limit = Number(budget.limitAmount || 0);
              const usage = limit > 0 ? spent / limit : 0;
              const barWidth = Math.min(Math.max(usage * 100, spent > 0 ? 2 : 0), 100);
              const statusColor =
                budget.status === "over"
                  ? "bg-rose-500"
                  : budget.status === "warning"
                    ? "bg-amber-400"
                    : "bg-emerald-400";
              const meta = getBudgetCategoryMeta(
                budget.category,
                budget.group_key,
              );
              return html`
                <article
                  key=${budget.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/75 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className=${`grid h-7 w-7 shrink-0 place-items-center rounded-md text-[10px] font-black text-white ${
                          CATEGORY_COLORS[index % CATEGORY_COLORS.length]
                        }`}
                      >
                        ${String(meta.label || budget.categoryLabel || "A")
                          .charAt(0)
                          .toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate text-[11px] font-black text-white">
                          ${budget.categoryLabel}
                        </h3>
                        <p className="mt-0.5 text-[9px] text-slate-400">
                          Batas:
                          ${formatCurrency(limit, currency)}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick=${() => openForm(budget)}
                        className="min-h-8 rounded-lg px-2 text-[9px] font-black text-emerald-300 transition hover:bg-emerald-500/10"
                      >
                        Ubah
                      </button>
                      <button
                        type="button"
                        onClick=${() => onBudgetDelete(budget)}
                        aria-label=${`Hapus anggaran ${budget.categoryLabel}`}
                        className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-300"
                      >
                        <${Trash2} aria-hidden="true" className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="text-[9px] font-bold text-slate-300">
                      Terpakai:
                      <strong className="text-white">
                        ${formatCurrency(spent, currency)}
                      </strong>
                    </p>
                    <p className="text-[9px] font-black text-cyan-300">
                      ${Math.round(usage * 100)}%
                    </p>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className=${`h-full rounded-full ${statusColor}`}
                      style=${{ width: `${barWidth}%` }}
                    ></div>
                  </div>
                </article>
              `;
            })
          : html`
              <div className="rounded-xl border border-dashed border-slate-800 px-4 py-6 text-center">
                <p className="text-xs font-bold text-slate-300">
                  Belum ada anggaran bulan ini.
                </p>
                <p className="mt-1 text-[10px] text-slate-500">
                  Atur kategori yang benar-benar ingin kamu batasi.
                </p>
              </div>
            `}
      </div>
    </section>
  `;
}

export function BudgetWorkspacePage({
  metrics,
  transactions = [],
  activeCurrencies = [],
  baseCurrency,
  onBudgetDelete,
  onBudgetSubmit,
  onCreateGoal,
  onUpdateGoal,
  onDeleteGoal,
  onArchiveGoal,
  onGoalActivity,
  onMoveAllocation,
  onUseGoal,
  loading = false,
}) {
  const budgetCurrency = normalizeCurrencyCode(baseCurrency);

  return html`
    <div className="mx-auto grid max-w-md gap-4 pb-[calc(7rem+env(safe-area-inset-bottom))] lg:pb-6">
      <header>
        <h1 className="font-display text-lg font-black text-white">
          Anggaran & Target Tabungan
        </h1>
        <p className="mt-1 text-[10px] leading-4 text-cyan-300/85">
          Atur batas pengeluaran bulanan dan pantau progres rencana finansialmu.
        </p>
      </header>

      <${BudgetSection}
        metrics=${metrics}
        currency=${budgetCurrency}
        loading=${loading}
        onBudgetDelete=${onBudgetDelete}
        onBudgetSubmit=${onBudgetSubmit}
      />

      <${TargetPlanningSection}
        goals=${metrics.goalInsights}
        summaries=${metrics.goalAllocationSummaries}
        activeCurrencies=${activeCurrencies}
        baseCurrency=${budgetCurrency}
        transactions=${transactions}
        loading=${loading}
        onCreateGoal=${onCreateGoal}
        onUpdateGoal=${onUpdateGoal}
        onDeleteGoal=${onDeleteGoal}
        onArchiveGoal=${onArchiveGoal}
        onGoalActivity=${onGoalActivity}
        onMoveAllocation=${onMoveAllocation}
        onUseGoal=${onUseGoal}
      />
    </div>
  `;
}

export { BudgetSection as ControlBudgetHub };
