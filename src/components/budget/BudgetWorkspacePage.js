import React, { useEffect, useState } from "react";
import htm from "htm";
import {
  BarChart3,
  ChevronRight,
  PiggyBank,
  Trash2,
} from "lucide-react";
import {
  CATEGORY_OPTIONS,
  calculateBudgetBaseAmount,
  getBudgetCategoryKey,
  getDefaultGroupForCategory,
  resolveAutomaticBudgetRate,
} from "../../domain/budgets.js";
import {
  formatAutoNumericValue,
  formatCurrency,
  formatMoney,
  formatNumericInput,
  normalizeCurrencyCode,
  normalizeNumericInput,
} from "../../lib/currency.js";
import {
  buildBudgetPaceSentence,
  getBudgetPaceTone,
} from "../../domain/budgetPace.js";
import {
  UNCATEGORIZED_KEY,
  buildSpendingBreakdown,
} from "../../domain/spendingBreakdown.js";
import { FormActionDock } from "../shared/FormActionDock.js";
import { SheetShell } from "../shared/SheetShell.js";

const html = htm.bind(React.createElement);
const INPUT_CLASS =
  "cs-entry-input min-h-11 w-full rounded-lg px-3 py-2.5 text-sm";

function toDateInput(value, fallback = new Date()) {
  const date = value ? new Date(value) : fallback;
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
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
            className=${`min-h-11 rounded-md px-3 text-xs font-black transition ${
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
            className=${`min-h-11 rounded-md px-3 text-xs font-black transition ${
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

        <${FormActionDock}>
          <button
            type="button"
            onClick=${applyRate}
            className="min-h-12 w-full rounded-xl bg-emerald-500 px-4 text-xs font-black text-white"
          >
            Terapkan
          </button>
        <//>
      </div>
    </${SheetShell}>
  `;
}

function BudgetSection({
  metrics,
  paceByCategory,
  currency,
  activeCurrencies,
  globalRateSnapshot,
  loading,
  onBudgetDelete,
  onBudgetSubmit,
  focusCategoryKey = null,
  daysLeftInMonth = 0,
  onOpenCategoryHistory,
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
      <div className="flex items-baseline justify-between gap-3 px-0.5">
        <h2 className="truncate text-[15px] font-bold">Per kategori</h2>
        <button
          type="button"
          onClick=${showForm ? () => setShowForm(false) : () => openForm()}
          className="shrink-0 text-[13px] font-medium"
          style=${{ color: "var(--cs-link)" }}
        >
          ${showForm ? "Tutup" : "Atur"}
        </button>
      </div>

      ${showForm
        ? html`
            <${React.Fragment}>
            <form
              id="cs-budget-form"
              className="dc-card mt-3 grid gap-4 p-[18px]"
              onSubmit=${submit}
            >
              ${/* Kategori memakai chip, bukan <select>. Daftar opsi select
                    digambar oleh sistem operasi sehingga tidak bisa mengikuti
                    token desain, dan semua kategori jadi tersembunyi di balik
                    satu baris. Metrik chip mengikuti desain: tinggi 38, radius
                    99, teks 13px/600. */ null}
              <div className="block">
                <span className="cs-entry-label">Pilih kategori</span>
                <div className="flex flex-wrap gap-2">
                  ${CATEGORY_OPTIONS.map((category) => {
                    const active = category.value === selectedCategory;
                    return html`
                      <button
                        key=${category.value}
                        type="button"
                        aria-pressed=${active}
                        onClick=${() => selectCategory(category.value)}
                        className="dc-press dc-press-96 flex min-h-[38px] items-center rounded-full px-[15px] text-[13px] font-semibold"
                        style=${
                          active
                            ? {
                                background: "var(--cs-sel-bg)",
                                color: "var(--cs-sel-fg)",
                                border: "1px solid transparent",
                              }
                            : {
                                background: "var(--cs-card)",
                                color: "var(--cs-body)",
                                border: "1px solid var(--cs-line)",
                              }
                        }
                      >
                        ${category.label}
                      </button>
                    `;
                  })}
                </div>
                ${selectedBudget
                  ? html`
                      <span
                        className="mt-1.5 block text-xs leading-[1.45]"
                        style=${{ color: "var(--cs-mut)" }}
                      >
                        Anggaran ini sudah ada. Simpan untuk memperbarui batasnya.
                      </span>
                    `
                  : null}
              </div>

              <label className="block">
                <span className="cs-entry-label">
                  Batas pengeluaran bulanan
                </span>
                <input
                  required
                  inputMode="decimal"
                  enterKeyHint="done"
                  value=${inputAmount}
                  onChange=${(event) =>
                    setInputAmount(formatNumericInput(event.target.value))}
                  placeholder="0"
                  className=${INPUT_CLASS}
                />
              </label>

              ${/* Batas jatah selalu dicatat dalam mata uang dasar. Belanja
                    dalam mata uang lain tetap mengurangi jatah ini karena
                    dikonversi lebih dulu lewat base_amount, jadi layar ini
                    tidak perlu pemilih mata uang. */ null}

              ${formError
                ? html`
                    <p
                      className="text-xs font-medium leading-[1.45]"
                      style=${{ color: "var(--cs-danger)" }}
                    >
                      ${formError}
                    </p>
                  `
                : null}

            </form>

            ${/* Dock berada di luar <form> supaya spacer 80px miliknya tidak
                  ikut menggelembungkan kartu dan meninggalkan ruang kosong di
                  bawah input. Tombol simpan tetap tersambung lewat atribut
                  form. */ null}
            <${FormActionDock} fixedOnMobile=${true}>
              <div className="grid grid-cols-[.75fr_1.25fr] gap-2">
                <button
                  type="button"
                  onClick=${() => setShowForm(false)}
                  className="dc-press dc-press-96 min-h-[52px] rounded-[17px] px-3 text-[15px] font-medium"
                  style=${{ color: "var(--cs-body)" }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  form="cs-budget-form"
                  disabled=${loading}
                  className="dc-press dc-press-96 min-h-[52px] rounded-[17px] px-4 text-[15px] font-bold disabled:opacity-50"
                  style=${{
                    background: "var(--cs-acc)",
                    color: "var(--cs-on-acc)",
                  }}
                >
                  ${selectedBudget ? "Simpan Perubahan" : "Simpan Anggaran"}
                </button>
              </div>
            <//>
            <//>
          `
        : null}

      <div className="dc-card mt-3 flex flex-col gap-[15px] p-[18px]">
        ${activeBudgets.length
          ? activeBudgets.map((budget) => {
              const spent = Number(budget.spentAmount || 0);
              const limit = Number(budget.baseAmount || budget.limitAmount || 0);
              const remaining = limit - spent;
              const usage = limit > 0 ? spent / limit : 0;
              const percent = Math.round(usage * 100);
              const barWidth = Math.min(
                Math.max(usage * 100, spent > 0 ? 2 : 0),
                100,
              );
              const over = percent >= 100;
              const barColor = over
                ? "var(--cs-danger)"
                : budget.status === "warning"
                  ? "var(--cs-warn)"
                  : "var(--cs-acc)";
              const open = openMenuId === budget.id;
              /* Angka "terpakai / batas" tidak menjawab apakah ritmenya aman.
                 getBudgetPace sudah menghitung jawabannya, tinggal ditampilkan. */
              const pace = paceByCategory?.get(budget.categoryKey);
              const ritme = buildBudgetPaceSentence(pace, baseCurrency);
              const ritmeWarna = {
                danger: "var(--cs-danger)",
                warn: "var(--cs-warn)",
                mut: "var(--cs-mut)",
              }[getBudgetPaceTone(pace?.paceStatus)];
              // Catatan dihitung dari data nyata, bukan teks contoh di desain.
              const note = over
                ? `Sudah lewat ${formatCurrency(Math.abs(remaining), baseCurrency)}. Sisanya terpaksa diambil dari jatah lain.`
                : daysLeftInMonth > 0
                  ? `Sisa ${formatCurrency(remaining, baseCurrency)}, kira-kira ${formatCurrency(remaining / daysLeftInMonth, baseCurrency)} per hari sampai akhir bulan.`
                  : `Sisa ${formatCurrency(remaining, baseCurrency)} sampai akhir bulan.`;

              return html`
                <div
                  key=${budget.id}
                  data-budget-category=${budget.categoryKey}
                  className="flex flex-col gap-[7px] py-1"
                >
                  <button
                    type="button"
                    onClick=${() => setOpenMenuId(open ? null : budget.id)}
                    aria-expanded=${open}
                    className="flex items-baseline justify-between gap-2.5 text-left text-[13px]"
                  >
                    <span
                      className="min-w-0 flex-1 truncate"
                      style=${{ color: "var(--cs-body)" }}
                    >
                      ${budget.categoryLabel}
                    </span>
                    <span
                      className="dc-num shrink-0 whitespace-nowrap text-[12.5px]"
                      style=${{ color: over ? "var(--cs-danger)" : "var(--cs-ink)" }}
                    >
                      ${formatCurrency(spent, baseCurrency)} / ${formatCurrency(limit, baseCurrency)}
                    </span>
                  </button>

                  <span className="dc-track h-2">
                    <span style=${{ width: `${barWidth}%`, background: barColor }}></span>
                  </span>

                  ${/* Hanya di desktop. Di ponsel barisnya sudah padat dan
                        keterangan yang sama tetap tersedia saat baris dibuka. */ null}
                  ${ritme?.label
                    ? html`
                        <span className="hidden items-center gap-1.5 text-[11.5px] lg:flex">
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style=${{ background: ritmeWarna }}
                          ></span>
                          <span style=${{ color: ritmeWarna }}>${ritme.label}</span>
                          ${ritme.detail
                            ? html`<span style=${{ color: "var(--cs-mut)" }}
                                >· ${ritme.detail}</span
                              >`
                            : null}
                        </span>
                      `
                    : null}

                  ${open
                    ? html`
                        <div className="flex flex-col gap-[9px] pt-[3px]">
                          <span
                            className="text-[12.5px] leading-[1.45]"
                            style=${{ color: over ? "var(--cs-danger)" : "var(--cs-body)" }}
                          >
                            ${note}
                          </span>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick=${() => loadBudgetForm(budget)}
                              className="text-xs font-bold"
                              style=${{ color: "var(--cs-link)" }}
                            >
                              Atur jatah
                            </button>
                            <span style=${{ color: "var(--cs-faint)" }}>·</span>
                            <button
                              type="button"
                              onClick=${() => onOpenCategoryHistory?.(budget)}
                              className="text-xs font-medium"
                              style=${{ color: "var(--cs-mut)" }}
                            >
                              Lihat transaksinya
                            </button>
                            <span style=${{ color: "var(--cs-faint)" }}>·</span>
                            <button
                              type="button"
                              onClick=${() => {
                                setOpenMenuId(null);
                                onBudgetDelete(budget);
                              }}
                              className="text-xs font-medium"
                              style=${{ color: "var(--cs-danger)" }}
                            >
                              Hapus
                            </button>
                          </div>
                        </div>
                      `
                    : null}
                </div>
              `;
            })
          : html`
              <p
                className="py-2 text-center text-[13px] leading-[1.5]"
                style=${{ color: "var(--cs-mut)" }}
              >
                Belum ada jatah bulan ini. Atur kategori yang benar-benar ingin
                kamu batasi.
              </p>
            `}

        <button
          type="button"
          onClick=${() => {
            setOpenMenuId(null);
            setShowForm(true);
          }}
          className="flex items-center justify-center gap-2 pt-4"
          style=${{ borderTop: "1px solid var(--cs-chip)" }}
        >
          <span className="text-[17px]" style=${{ color: "var(--cs-faint)" }}>+</span>
          <span className="text-[13px] font-medium" style=${{ color: "var(--cs-mut)" }}>
            Tambah kategori
          </span>
        </button>
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

/* Ke mana uangmu pergi. Menutup titik buta halaman ini: BudgetSection hanya
   membaca budgetInsights, jadi belanja di kategori yang belum punya jatah
   tidak terlihat sama sekali. Angkanya dihitung dengan fungsi yang sama
   dengan baris jatah, supaya kategori yang sama tidak tampil dua nilai. */
function SpendingBreakdownCard({ breakdown, currency, onOpenCategory }) {
  if (!breakdown?.hasData) {
    return html`
      <section className="dc-card flex flex-col gap-3 p-[18px]">
        <span className="text-[15px] font-bold">Ke mana uangmu pergi</span>
        <span
          className="text-[12.5px] leading-[1.5]"
          style=${{ color: "var(--cs-mut)" }}
        >
          Belum ada pengeluaran bulan ini.
        </span>
      </section>
    `;
  }

  const tanpaJatah = breakdown.unbudgeted;
  /* Dirakit di sini, bukan dipecah beberapa baris di dalam template. htm
     memakan pergantian barisnya dan hasilnya menempel jadi "ada di2". */
  const catatanTanpaJatah = `${Math.round(tanpaJatah.share * 100)}% pengeluaranmu (${formatCurrency(
    tanpaJatah.amount,
    currency,
  )}) ada di ${tanpaJatah.count} kategori yang belum punya jatah, jadi tidak ikut terhitung di daftar atas.`;

  return html`
    <section className="dc-card flex flex-col gap-3.5 p-[18px]">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[15px] font-bold">Ke mana uangmu pergi</span>
        <span
          className="dc-num shrink-0 text-[12.5px]"
          style=${{ color: "var(--cs-mut)" }}
        >
          ${formatCurrency(breakdown.total, currency)}
        </span>
      </div>

      ${/* Satu batang bertumpuk memberi gambaran porsi lebih cepat daripada
            membaca tujuh persentase satu per satu. */ null}
      <span className="flex h-2.5 w-full overflow-hidden rounded-full" style=${{ background: "var(--cs-track)" }}>
        ${breakdown.rows.map(
          (row) => html`
            <span
              key=${row.key}
              style=${{
                width: `${row.share * 100}%`,
                background: row.hasBudget ? "var(--cs-acc)" : "var(--cs-warn)",
              }}
            ></span>
          `,
        )}
      </span>

      <div className="flex flex-col">
        ${breakdown.rows.map(
          (row) => html`
            <button
              key=${row.key}
              type="button"
              onClick=${() => onOpenCategory?.(row)}
              aria-label=${`Lihat transaksi ${row.label}`}
              className="dc-press flex min-h-[34px] items-center gap-2.5 rounded-[10px] px-1 text-left"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style=${{
                  background: row.hasBudget ? "var(--cs-acc)" : "var(--cs-warn)",
                }}
              ></span>
              <span className="min-w-0 flex-1 truncate text-[12.5px]">
                ${row.label}
              </span>
              ${row.hasBudget
                ? null
                : html`<span
                    className="shrink-0 text-[10.5px]"
                    style=${{ color: "var(--cs-warn)" }}
                    >tanpa jatah</span
                  >`}
              <span
                className="dc-num shrink-0 text-[12px]"
                style=${{ color: "var(--cs-mut)" }}
              >
                ${Math.round(row.share * 100)}%
              </span>
              <span className="dc-num w-[92px] shrink-0 text-right text-[12.5px]">
                ${formatCurrency(row.amount, currency)}
              </span>
            </button>
          `,
        )}
      </div>

      ${breakdown.rest.count > 0
        ? html`
            <span
              className="px-1 text-[11.5px]"
              style=${{ color: "var(--cs-mut)" }}
            >
              ${`dan ${breakdown.rest.count} kategori lain ${formatCurrency(breakdown.rest.amount, currency)}`}
            </span>
          `
        : null}

      ${tanpaJatah.amount > 0
        ? html`
            <span
              className="rounded-[12px] px-3 py-2.5 text-[12px] leading-[1.5]"
              style=${{ background: "var(--cs-seg)", color: "var(--cs-body)" }}
            >
              ${catatanTanpaJatah}
            </span>
          `
        : null}
    </section>
  `;
}

export function BudgetWorkspacePage({
  metrics,
  controlSummary,
  transactions = [],
  activeCurrencies = [],
  baseCurrency,
  globalRateSnapshot = null,
  onBudgetDelete,
  onBudgetSubmit,
  focusCategoryKey = null,
  loading = false,
  onNavigate,
  onOpenCategoryHistory,
}) {
  const budgetCurrency = normalizeCurrencyCode(baseCurrency);
  /* controlSummary.budget.categories memakai penyaring mata uang yang sama
     persis dengan daftar di halaman ini, jadi tiap baris pasti ketemu
     pasangannya. Dipetakan lewat categoryKey supaya urutannya tidak jadi
     asumsi. */
  const breakdown = buildSpendingBreakdown({
    transactions,
    budgetInsights: metrics.budgetInsights || [],
    baseCurrency: budgetCurrency,
    monthKey: metrics.currentMonthKey,
  });
  const paceByCategory = new Map(
    (controlSummary?.budget?.categories || []).map((category) => [
      category.categoryKey,
      category,
    ]),
  );

  const limitTotal = Number(metrics.budgetLimitTotal || 0);
  const spentTotal = Number(metrics.budgetSpentTotal || 0);
  const remaining = Math.max(limitTotal - spentTotal, 0);
  const now = new Date();
  const daysLeft = Math.max(
    new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate(),
    0,
  );
  const perDay = daysLeft > 0 ? remaining / daysLeft : remaining;
  const remainingText = formatCurrency(remaining, budgetCurrency);
  const attentionCount =
    Number(metrics.overspentCount || 0) + Number(metrics.warningCount || 0);

  // Seksi Target sudah pindah ke halaman Dompet, jadi permintaan fokus
  // "__goals__" diarahkan ke sana, bukan digulir di halaman ini.
  useEffect(() => {
    if (focusCategoryKey !== "__goals__") return;
    onNavigate?.("investment");
  }, [focusCategoryKey]);

  return html`
    ${/* max-w-md adalah lebar ponsel. Tanpa penyesuaian lg, halaman ini
          terkunci 448px di layar 1748px, memakai 30% ruang yang ada.
          Di desktop lebarnya dilepas dan isinya dibagi dua kolom. */ null}
    <div className="mx-auto grid max-w-md gap-4 pb-[calc(7rem+env(safe-area-inset-bottom))] lg:max-w-none lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-6 lg:pb-6">
      ${/* Panel sisa dan daftar kategori dibungkus satu sel. Sebagai dua sel
            terpisah, baris grid ikut meregang mengikuti kolom kanan dan jarak
            antar keduanya melar. */ null}
      <div className="flex min-w-0 flex-col gap-4 lg:gap-6">
      <section className="dc-panel flex flex-col gap-3.5 p-[22px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] text-[#9c968b]">
            Sisa jatah ${metrics.currentMonthLabel || "bulan ini"}
          </span>
          <span className="shrink-0 text-[11.5px] text-[#9c968b]">
            ${daysLeft} hari lagi
          </span>
        </div>
        <div className="flex items-end gap-1.5">
          <span className="pb-1.5 text-[19px] font-medium text-[#9c968b]">
            ${budgetCurrency === "IDR" ? "Rp" : budgetCurrency}
          </span>
          <span className="dc-num text-[36px] leading-none tracking-[-1.6px]">
            ${remainingText.replace(/^[^\d-]*/, "")}
          </span>
        </div>
        <span className="text-[12.5px] leading-[1.45] text-[#9c968b]">
          ${limitTotal > 0
            ? `Kalau dibagi rata, kamu bisa pakai ${formatCurrency(perDay, budgetCurrency)} per hari sampai akhir bulan.`
            : "Belum ada batas bulanan. Atur jatah per kategori supaya sisa harian bisa dihitung."}
        </span>
      </section>

      <${BudgetSection}
        metrics=${metrics}
        paceByCategory=${paceByCategory}
        currency=${budgetCurrency}
        activeCurrencies=${activeCurrencies}
        globalRateSnapshot=${globalRateSnapshot}
        loading=${loading}
        onBudgetDelete=${onBudgetDelete}
        onBudgetSubmit=${onBudgetSubmit}
        focusCategoryKey=${focusCategoryKey === "__goals__"
          ? null
          : focusCategoryKey}
        daysLeftInMonth=${daysLeft}
        onOpenCategoryHistory=${onOpenCategoryHistory}
      />
      </div>


      ${/* Kolom kanan desktop, dibungkus satu sel supaya kedua kartunya tetap
            bertumpuk di sana. Tanpa wadah, penempatan otomatis melempar kartu
            kedua kembali ke kolom kiri baris berikutnya. Di ponsel wadah ini
            hanya kolom biasa dengan jarak yang sama, jadi urutannya tetap. */ null}
      <div className="flex min-w-0 flex-col gap-4 lg:gap-6">
      ${/* Riwayat menyaring berdasarkan kunci kategori. Baris tanpa kategori
            tidak punya kunci yang bisa disaring, jadi tidak diarahkan ke mana
            mana. */ null}
      <${SpendingBreakdownCard}
        breakdown=${breakdown}
        currency=${budgetCurrency}
        onOpenCategory=${(row) =>
          row.key === UNCATEGORIZED_KEY
            ? undefined
            : onOpenCategoryHistory?.({ categoryKey: row.key })}
      />

      ${onNavigate
        ? html`
            <button
              type="button"
              onClick=${() => onNavigate("control")}
              className="dc-card flex w-full flex-col gap-3.5 p-[18px] text-left"
            >
              <div className="flex items-center gap-3">
                <span
                  className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[13px]"
                  style=${{ background: "var(--cs-acc)" }}
                >
                  <${BarChart3}
                    aria-hidden="true"
                    className="h-5 w-5"
                    style=${{ color: "var(--cs-on-acc)" }}
                    strokeWidth=${1.8}
                  />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[15px] font-bold">Kondisi keuanganmu</span>
                  <span className="text-xs text-[color:var(--cs-mut)]">
                    Diperbarui tiap kamu mencatat
                  </span>
                </span>
                <${ChevronRight}
                  aria-hidden="true"
                  className="h-[18px] w-[18px] shrink-0"
                  style=${{ color: "var(--cs-faint)" }}
                />
              </div>
              <span className="text-[13px] leading-[1.5] text-[color:var(--cs-body)]">
                Skor, rincian ke mana uangmu pergi, dan hal-hal yang bisa dirapikan
                bulan ini.
              </span>
              ${attentionCount > 0
                ? html`
                    <span className="flex gap-2">
                      <span
                        className="rounded-full px-[11px] py-1.5 text-[11.5px] font-bold"
                        style=${{ background: "var(--cs-seg)", color: "var(--cs-body)" }}
                      >
                        ${attentionCount} kategori perlu dilihat
                      </span>
                    </span>
                  `
                : null}
            </button>
          `
        : null}
      </div>
    </div>
  `;
}

export { BudgetSection as ControlBudgetHub };
