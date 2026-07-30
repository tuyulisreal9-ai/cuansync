import React, { useEffect, useState } from "https://esm.sh/react@18.3.1";
import htm from "https://esm.sh/htm@3.1.1";
import {
  MoreVertical,
  PiggyBank,
  Trash2,
} from "https://esm.sh/lucide-react@0.468.0?deps=react@18.3.1";
import {
  CATEGORY_OPTIONS,
  calculateBudgetBaseAmount,
  getBudgetCategoryKey,
  getBudgetCategoryMeta,
  getDefaultGroupForCategory,
  resolveAutomaticBudgetRate,
} from "../../domain/budgets.js";
import {
  DEFAULT_ACTIVE_CURRENCIES,
  formatAutoNumericValue,
  formatCurrency,
  formatMoney,
  formatNumericInput,
  normalizeCurrencyCode,
  normalizeCurrencyList,
  normalizeNumericInput,
} from "../../lib/currency.js";
import { SheetShell } from "../shared/SheetShell.js";
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

function toDateInput(value, fallback = new Date()) {
  const date = value ? new Date(value) : fallback;
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

function getRateSourceLabel(source) {
  if (source === "custom") return "Kurs custom";
  if (source === "legacy") return "Kurs lama";
  return "Kurs otomatis";
}

function formatPlanningRate(rate, inputCurrency, baseCurrency) {
  const numericRate = Number(rate || 0);
  if (!numericRate) return "-";
  return `1 ${inputCurrency} = ${formatMoney(numericRate, baseCurrency, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  })}`;
}

function BudgetRateSheet({
  open,
  inputCurrency,
  baseCurrency,
  globalRateSnapshot,
  currentRate,
  currentSource,
  currentDate,
  onApply,
  onClose,
}) {
  const [mode, setMode] = useState(
    currentSource === "custom" ? "custom" : "automatic",
  );
  const [customRate, setCustomRate] = useState(
    formatAutoNumericValue(currentRate),
  );
  const [rateDate, setRateDate] = useState(toDateInput(currentDate));
  const [error, setError] = useState("");
  const automatic = resolveAutomaticBudgetRate(
    globalRateSnapshot,
    inputCurrency,
    baseCurrency,
  );

  useEffect(() => {
    if (!open) return;
    setMode(currentSource === "custom" ? "custom" : "automatic");
    setCustomRate(formatAutoNumericValue(currentRate));
    setRateDate(toDateInput(currentDate || automatic.rateDate));
    setError("");
  }, [
    open,
    currentRate,
    currentSource,
    currentDate,
    automatic.rateDate,
  ]);

  function applyRate() {
    const nextRate =
      mode === "custom"
        ? Number(normalizeNumericInput(customRate))
        : Number(automatic.rate || 0);
    if (!nextRate || nextRate <= 0) {
      setError(
        mode === "custom"
          ? "Masukkan kurs yang lebih besar dari 0."
          : "Kurs otomatis belum tersedia. Gunakan kurs custom.",
      );
      return;
    }
    if (!rateDate) {
      setError("Tanggal kurs wajib diisi.");
      return;
    }
    onApply({
      planningRate: nextRate,
      rateSource: mode === "custom" ? "custom" : "automatic",
      rateDate,
    });
  }

  return html`
    <${SheetShell}
      open=${open}
      title="Ubah kurs anggaran"
      helper=${`Orientasi kurs selalu 1 ${inputCurrency} ke ${baseCurrency}.`}
      labelledBy="budget-rate-sheet-title"
      onClose=${onClose}
    >
      <div className="grid gap-3">
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick=${() => {
              setMode("automatic");
              setRateDate(toDateInput(automatic.rateDate));
              setError("");
            }}
            className=${`min-h-10 rounded-md px-3 text-xs font-black transition ${
              mode === "automatic"
                ? "bg-emerald-500 text-white"
                : "text-slate-600 dark:text-slate-300"
            }`}
          >
            Kurs otomatis
          </button>
          <button
            type="button"
            onClick=${() => {
              setMode("custom");
              setError("");
            }}
            className=${`min-h-10 rounded-md px-3 text-xs font-black transition ${
              mode === "custom"
                ? "bg-emerald-500 text-white"
                : "text-slate-600 dark:text-slate-300"
            }`}
          >
            Kurs custom
          </button>
        </div>

        <label className="block">
          <span className="cs-entry-label">
            1 ${inputCurrency} sama dengan
          </span>
          <span className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <input
              type="text"
              inputMode="decimal"
              readOnly=${mode === "automatic"}
              value=${mode === "automatic"
                ? formatAutoNumericValue(automatic.rate)
                : customRate}
              onChange=${(event) =>
                setCustomRate(formatNumericInput(event.target.value))}
              placeholder="0"
              className=${INPUT_CLASS}
            />
            <span className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-3 text-xs font-black text-emerald-700 dark:text-emerald-300">
              ${baseCurrency}
            </span>
          </span>
        </label>

        <label className="block">
          <span className="cs-entry-label">Tanggal kurs</span>
          <input
            type="date"
            value=${rateDate}
            onChange=${(event) => setRateDate(event.target.value)}
            className=${INPUT_CLASS}
          />
        </label>

        <div className="rounded-lg border border-emerald-300/25 bg-emerald-400/8 px-3 py-2.5">
          <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
            ${formatPlanningRate(
              mode === "automatic" ? automatic.rate : normalizeNumericInput(customRate),
              inputCurrency,
              baseCurrency,
            )}
          </p>
        </div>

        ${error
          ? html`
              <p className="text-[10px] font-bold text-rose-600 dark:text-rose-300">
                ${error}
              </p>
            `
          : null}

        <button
          type="button"
          onClick=${applyRate}
          className="min-h-11 rounded-lg bg-emerald-500 px-4 text-xs font-black text-white"
        >
          Terapkan
        </button>
      </div>
    </${SheetShell}>
  `;
}

function BudgetSection({
  metrics,
  currency,
  activeCurrencies,
  globalRateSnapshot,
  loading,
  onBudgetDelete,
  onBudgetSubmit,
  focusCategoryKey = null,
}) {
  const [showForm, setShowForm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(
    CATEGORY_OPTIONS[0]?.value || "",
  );
  const [inputAmount, setInputAmount] = useState("");
  const [inputCurrency, setInputCurrency] = useState(currency);
  const [planningRate, setPlanningRate] = useState(1);
  const [rateSource, setRateSource] = useState("base");
  const [rateDate, setRateDate] = useState(toDateInput(new Date()));
  const [showRateSheet, setShowRateSheet] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [formError, setFormError] = useState("");
  const baseCurrency = normalizeCurrencyCode(currency);
  const currencyOptions = normalizeCurrencyList(
    [...activeCurrencies, ...DEFAULT_ACTIVE_CURRENCIES],
    { baseCurrency },
  );
  const activeBudgets = metrics.budgetInsights.filter(
    (budget) =>
      normalizeCurrencyCode(
        budget.baseCurrency || budget.base_currency || budget.currency,
      ) === baseCurrency,
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
  const officialAmount = calculateBudgetBaseAmount({
    inputAmount: normalizeNumericInput(inputAmount),
    inputCurrency,
    baseCurrency,
    planningRate,
  });

  useEffect(() => {
    if (!focusCategoryKey) return;
    const target = document.querySelector(
      `[data-budget-category="${focusCategoryKey}"]`,
    );
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusCategoryKey, activeBudgets.length]);

  function applyAutomaticRate(nextInputCurrency) {
    const code = normalizeCurrencyCode(nextInputCurrency, baseCurrency);
    if (code === baseCurrency) {
      setPlanningRate(1);
      setRateSource("base");
      setRateDate(toDateInput(new Date()));
      return;
    }
    const automatic = resolveAutomaticBudgetRate(
      globalRateSnapshot,
      code,
      baseCurrency,
    );
    setPlanningRate(Number(automatic.rate || 0));
    setRateSource("automatic");
    setRateDate(toDateInput(automatic.rateDate));
  }

  function loadBudgetForm(budget) {
    const budgetInputCurrency = normalizeCurrencyCode(
      budget.inputCurrency || budget.input_currency || baseCurrency,
      baseCurrency,
    );
    setSelectedCategory(budget.category);
    setInputAmount(
      formatNumericInput(
        String(budget.inputAmount || budget.input_amount || budget.limitAmount || ""),
      ),
    );
    setInputCurrency(budgetInputCurrency);
    setPlanningRate(
      Number(
        budget.planningRate ||
          budget.planning_rate ||
          (budgetInputCurrency === baseCurrency ? 1 : 0),
      ),
    );
    setRateSource(
      budget.rateSource ||
        budget.rate_source ||
        (budgetInputCurrency === baseCurrency ? "base" : "legacy"),
    );
    setRateDate(toDateInput(budget.rateDate || budget.rate_date || budget.created_at));
    setFormError("");
    setOpenMenuId(null);
    setShowForm(true);
  }

  function resetForCategory(category) {
    setSelectedCategory(category);
    setInputAmount("");
    setInputCurrency(baseCurrency);
    setPlanningRate(1);
    setRateSource("base");
    setRateDate(toDateInput(new Date()));
    setFormError("");
  }

  function openForm(budget = null) {
    if (budget) {
      loadBudgetForm(budget);
      return;
    }
    const fallback = availableCategories[0] || CATEGORY_OPTIONS[0];
    const existing =
      activeBudgets.find(
        (item) =>
          item.categoryKey === getBudgetCategoryKey(fallback?.value),
      ) || null;
    if (existing) {
      loadBudgetForm(existing);
      return;
    }
    resetForCategory(fallback?.value || "");
    setShowForm(true);
  }

  function selectCategory(value) {
    const existing =
      activeBudgets.find(
        (budget) =>
          budget.categoryKey === getBudgetCategoryKey(value),
      ) || null;
    if (existing) {
      loadBudgetForm(existing);
      return;
    }
    resetForCategory(value);
  }

  function selectInputCurrency(value) {
    const code = normalizeCurrencyCode(value, baseCurrency);
    setInputCurrency(code);
    applyAutomaticRate(code);
    setFormError("");
  }

  async function submit(event) {
    event.preventDefault();
    const normalizedInputAmount = Number(
      normalizeNumericInput(inputAmount),
    );
    if (!normalizedInputAmount || normalizedInputAmount <= 0) {
      setFormError("Batas pengeluaran bulanan harus lebih besar dari 0.");
      return;
    }
    if (!officialAmount || officialAmount <= 0) {
      setFormError(
        `Kurs ${inputCurrency} ke ${baseCurrency} belum valid.`,
      );
      return;
    }
    const ok = await onBudgetSubmit({
      month_key: metrics.currentMonthKey,
      group_key: getDefaultGroupForCategory(selectedCategory),
      category: selectedCategory,
      input_amount: normalizedInputAmount,
      input_currency: inputCurrency,
      base_amount: officialAmount,
      base_currency: baseCurrency,
      planning_rate: planningRate,
      rate_source: rateSource,
      rate_date: rateDate,
      rate_from_currency: inputCurrency,
      rate_to_currency: baseCurrency,
    });
    if (ok) {
      setShowForm(false);
      resetForCategory(availableCategories[0]?.value || CATEGORY_OPTIONS[0]?.value || "");
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
          <h2 className="truncate text-xs font-black text-slate-950 dark:text-white sm:text-sm">
            Batas Anggaran Bulanan
          </h2>
        </div>
        <button
          type="button"
          onClick=${showForm ? () => setShowForm(false) : () => openForm()}
          className=${`min-h-9 shrink-0 rounded-lg px-3 text-[11px] font-black ${
            showForm
              ? "border border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300"
              : "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
          }`}
        >
          ${showForm ? "Tutup" : "+ Atur Anggaran"}
        </button>
      </div>

      ${showForm
        ? html`
            <form
              className="mt-3 grid gap-3 rounded-xl border border-slate-200 bg-white/80 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/75 dark:shadow-none"
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
                      <span className="mt-1.5 block text-[10px] leading-4 text-emerald-700 dark:text-emerald-300">
                        Anggaran ini sudah ada. Simpan untuk memperbarui batasnya.
                      </span>
                    `
                  : null}
              </label>

              <label className="block">
                <span className="cs-entry-label">
                  Batas pengeluaran bulanan
                </span>
                <span className="grid grid-cols-[minmax(0,1fr)_5.5rem] overflow-hidden rounded-lg border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950">
                  <input
                    required
                    inputMode="decimal"
                    value=${inputAmount}
                    onChange=${(event) =>
                      setInputAmount(formatNumericInput(event.target.value))}
                    placeholder="0"
                    className="min-h-11 min-w-0 border-0 bg-transparent px-3 py-2.5 text-sm font-bold text-slate-950 outline-none dark:text-white"
                  />
                  <select
                    aria-label="Mata uang input anggaran"
                    value=${inputCurrency}
                    onChange=${(event) => selectInputCurrency(event.target.value)}
                    className="min-h-11 border-0 border-l border-slate-200 bg-slate-100 px-2 text-xs font-black text-slate-800 outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                  >
                    ${currencyOptions.map(
                      (code) => html`
                        <option key=${code} value=${code}>${code}</option>
                      `,
                    )}
                  </select>
                </span>
              </label>

              ${inputCurrency !== baseCurrency
                ? html`
                    <div className="flex min-h-7 items-center justify-between gap-3 rounded-lg bg-slate-100 px-3 py-1.5 dark:bg-slate-950/70">
                      <p className="min-w-0 truncate text-[10px] font-bold text-slate-600 dark:text-slate-300">
                        ${officialAmount
                          ? `≈ ${formatCurrency(officialAmount, baseCurrency)} · ${getRateSourceLabel(rateSource)}`
                          : "Kurs otomatis belum tersedia"}
                      </p>
                      <button
                        type="button"
                        onClick=${() => setShowRateSheet(true)}
                        className="shrink-0 text-[10px] font-black text-emerald-700 dark:text-emerald-300"
                      >
                        Ubah Kurs
                      </button>
                    </div>
                  `
                : null}

              ${formError
                ? html`
                    <p className="text-[10px] font-bold text-rose-600 dark:text-rose-300">
                      ${formError}
                    </p>
                  `
                : null}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick=${() => setShowForm(false)}
                  className="min-h-10 rounded-lg px-3 text-[10px] font-bold text-slate-600 dark:text-slate-400"
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
              const limit = Number(budget.baseAmount || budget.limitAmount || 0);
              const remaining = limit - spent;
              const usage = limit > 0 ? spent / limit : 0;
              const barWidth = Math.min(
                Math.max(usage * 100, spent > 0 ? 2 : 0),
                100,
              );
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
              const sourceCurrency = normalizeCurrencyCode(
                budget.inputCurrency || budget.input_currency || baseCurrency,
                baseCurrency,
              );
              const menuOpen = openMenuId === budget.id;
              return html`
                <article
                  key=${budget.id}
                  data-budget-category=${budget.categoryKey}
                  role="button"
                  tabIndex="0"
                  onClick=${() => loadBudgetForm(budget)}
                  onKeyDown=${(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      loadBudgetForm(budget);
                    }
                  }}
                  className=${`relative cursor-pointer rounded-xl border bg-white/80 p-3 text-left shadow-sm transition hover:border-emerald-400/45 dark:bg-slate-900/75 dark:shadow-none ${
                    focusCategoryKey === budget.categoryKey
                      ? "border-emerald-400 ring-2 ring-emerald-400/20"
                      : "border-slate-200 dark:border-slate-800"
                  }`}
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
                        <span className="flex min-w-0 items-center gap-1.5">
                          <h3 className="truncate text-[11px] font-black text-slate-950 dark:text-white">
                            ${budget.categoryLabel}
                          </h3>
                          ${sourceCurrency !== baseCurrency
                            ? html`
                                <span className="shrink-0 rounded bg-emerald-500/12 px-1.5 py-0.5 text-[8px] font-black text-emerald-700 dark:text-emerald-300">
                                  ${sourceCurrency}
                                </span>
                              `
                            : null}
                        </span>
                        <p className="mt-0.5 text-[9px] text-slate-600 dark:text-slate-400">
                          Batas ${budget.hasPlanningSnapshot
                            ? formatCurrency(limit, baseCurrency)
                            : "belum dikonversi"}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label=${`Menu anggaran ${budget.categoryLabel}`}
                      onClick=${(event) => {
                        event.stopPropagation();
                        setOpenMenuId(menuOpen ? null : budget.id);
                      }}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-200 dark:hover:bg-slate-800"
                    >
                      <${MoreVertical} aria-hidden="true" className="h-4 w-4" />
                    </button>
                  </div>

                  ${menuOpen
                    ? html`
                        <div
                          className="absolute right-3 top-11 z-10 min-w-28 overflow-hidden rounded-lg border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900"
                          onClick=${(event) => event.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick=${() => loadBudgetForm(budget)}
                            className="block min-h-9 w-full rounded-md px-3 text-left text-[10px] font-bold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick=${() => {
                              setOpenMenuId(null);
                              onBudgetDelete(budget);
                            }}
                            className="flex min-h-9 w-full items-center gap-2 rounded-md px-3 text-left text-[10px] font-bold text-rose-600 hover:bg-rose-500/10 dark:text-rose-300"
                          >
                            <${Trash2} aria-hidden="true" className="h-3.5 w-3.5" />
                            Hapus
                          </button>
                        </div>
                      `
                    : null}

                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <p className="text-[9px] font-bold text-slate-600 dark:text-slate-300">
                      Terpakai
                      <strong className="mt-0.5 block text-[10px] text-slate-950 dark:text-white">
                        ${formatCurrency(spent, baseCurrency)}
                      </strong>
                    </p>
                    <p className="text-right text-[9px] font-bold text-slate-600 dark:text-slate-300">
                      Sisa
                      <strong className=${`mt-0.5 block text-[10px] ${
                        remaining < 0
                          ? "text-rose-600 dark:text-rose-300"
                          : "text-emerald-700 dark:text-emerald-300"
                      }`}>
                        ${formatCurrency(remaining, baseCurrency)}
                      </strong>
                    </p>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div
                        className=${`h-full rounded-full ${statusColor}`}
                        style=${{ width: `${barWidth}%` }}
                      ></div>
                    </div>
                    <span className="shrink-0 text-[9px] font-black text-cyan-700 dark:text-cyan-300">
                      ${Math.round(usage * 100)}%
                    </span>
                  </div>
                </article>
              `;
            })
          : html`
              <div className="rounded-xl border border-dashed border-slate-300 bg-white/35 px-4 py-6 text-center dark:border-slate-800 dark:bg-transparent">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Belum ada anggaran bulan ini.
                </p>
                <p className="mt-1 text-[10px] text-slate-600 dark:text-slate-500">
                  Atur kategori yang benar-benar ingin kamu batasi.
                </p>
              </div>
            `}
      </div>

      <${BudgetRateSheet}
        open=${showRateSheet}
        inputCurrency=${inputCurrency}
        baseCurrency=${baseCurrency}
        globalRateSnapshot=${globalRateSnapshot}
        currentRate=${planningRate}
        currentSource=${rateSource}
        currentDate=${rateDate}
        onClose=${() => setShowRateSheet(false)}
        onApply=${(next) => {
          setPlanningRate(next.planningRate);
          setRateSource(next.rateSource);
          setRateDate(next.rateDate);
          setFormError("");
          setShowRateSheet(false);
        }}
      />
    </section>
  `;
}

export function BudgetWorkspacePage({
  metrics,
  transactions = [],
  activeCurrencies = [],
  baseCurrency,
  globalRateSnapshot = null,
  onBudgetDelete,
  onBudgetSubmit,
  onCreateGoal,
  onUpdateGoal,
  onDeleteGoal,
  onArchiveGoal,
  onGoalActivity,
  onMoveAllocation,
  onUseGoal,
  focusCategoryKey = null,
  loading = false,
}) {
  const budgetCurrency = normalizeCurrencyCode(baseCurrency);

  return html`
    <div className="mx-auto grid max-w-md gap-4 pb-[calc(7rem+env(safe-area-inset-bottom))] lg:pb-6">
      <header>
        <h1 className="font-display text-lg font-black text-slate-950 dark:text-white">
          Anggaran & Target Tabungan
        </h1>
        <p className="mt-1 text-[10px] leading-4 text-slate-600 dark:text-cyan-300/85">
          Atur batas pengeluaran bulanan dan pantau progres rencana finansialmu.
        </p>
      </header>

      <${BudgetSection}
        metrics=${metrics}
        currency=${budgetCurrency}
        activeCurrencies=${activeCurrencies}
        globalRateSnapshot=${globalRateSnapshot}
        loading=${loading}
        onBudgetDelete=${onBudgetDelete}
        onBudgetSubmit=${onBudgetSubmit}
        focusCategoryKey=${focusCategoryKey}
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
