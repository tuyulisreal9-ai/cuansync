import React, { useEffect, useMemo, useState } from "react";
import htm from "htm";
import { BarChart3, ChevronRight } from "lucide-react";
import {
  CATEGORY_OPTIONS,
  MONTHLY_BUDGET_CATEGORY,
  getBudgetCategoryKey,
  getDefaultGroupForCategory,
} from "../../domain/budgets.js";
import {
  BUDGET_MODES,
  buildSimpleBudgetView,
  estimateRecurringBills,
  resolveBudgetMode,
  suggestCategorySplit,
} from "../../domain/budgetPlan.js";
import {
  formatCurrency,
  formatNumericInput,
  getNumericInputOptions,
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
import { SheetShell } from "../shared/SheetShell.js";

const html = htm.bind(React.createElement);
const INPUT_CLASS =
  "cs-entry-input min-h-11 w-full rounded-lg px-3 py-2.5 text-sm";


/* Menambah atau mengubah jatah kategori dibuka sebagai sheet, sama seperti
   panel isian lain di aplikasi. Sebelumnya formnya muncul sebagai kartu di
   atas daftar beserta bilah tombolnya sendiri, sehingga satu layar berisi
   tiga permukaan bertumpuk dan daftar jatahnya terdorong jauh ke bawah. */
function BudgetCategorySheet({
  open,
  budget,
  budgets = [],
  currency,
  loading,
  onClose,
  onSubmit,
}) {
  const editing = Boolean(budget);
  const [category, setCategory] = useState(CATEGORY_OPTIONS[0]?.value || "");
  const [inputAmount, setInputAmount] = useState("");
  const [formError, setFormError] = useState("");

  const takenKeys = new Set(budgets.map((item) => item.categoryKey));
  /* Kategori yang sudah punya jatah tidak ditawarkan lagi saat menambah,
     karena mengubahnya lewat barisnya sendiri di daftar. Kalau semuanya
     sudah punya, daftarnya dibuka kembali supaya tetap bisa dipakai. */
  const available = CATEGORY_OPTIONS.filter(
    (item) => !takenKeys.has(getBudgetCategoryKey(item.value)),
  );
  const options = available.length ? available : CATEGORY_OPTIONS;
  const selectedMeta = CATEGORY_OPTIONS.find((item) => item.value === category);
  const selectedLabel = editing
    ? budget.categoryLabel
    : selectedMeta?.label || category;
  const sudahPunyaJatah =
    !editing && takenKeys.has(getBudgetCategoryKey(category));

  useEffect(() => {
    if (!open) return;
    const startCategory = editing
      ? budget.category
      : options[0]?.value || CATEGORY_OPTIONS[0]?.value || "";
    setCategory(startCategory);
    setInputAmount(
      editing
        ? formatNumericInput(
            String(budget.limitAmount || ""),
            getNumericInputOptions(currency),
          )
        : "",
    );
    setFormError("");
  }, [open]);

  function selectCategory(value) {
    setCategory(value);
    /* Memilih kategori yang sudah punya jatah mengisi batas lamanya, supaya
       menyimpan berarti memperbarui, bukan menimpa dengan angka kosong. */
    const existing = budgets.find(
      (item) => item.categoryKey === getBudgetCategoryKey(value),
    );
    setInputAmount(
      existing
        ? formatNumericInput(
            String(existing.limitAmount || ""),
            getNumericInputOptions(currency),
          )
        : "",
    );
    setFormError("");
  }

  async function submit(event) {
    event.preventDefault();
    const amount = Number(
      normalizeNumericInput(inputAmount, getNumericInputOptions(currency)),
    );
    if (!amount || amount <= 0) {
      setFormError("Batas pengeluaran bulanan harus lebih besar dari 0.");
      return;
    }
    const ok = await onSubmit?.({
      category: editing ? budget.category : category,
      amount,
    });
    if (ok) onClose?.();
  }

  return html`
    <${SheetShell}
      open=${open}
      onClose=${onClose}
      title=${editing
        ? `Atur jatah ${budget.categoryLabel}`
        : "Tambah jatah kategori"}
      helper=${editing
        ? "Batas ini berlaku untuk bulan berjalan. Belanja di kategori tersebut langsung menguranginya."
        : "Pilih kategori yang ingin kamu batasi, lalu isi batas bulanannya."}
      labelledBy="budget-category-title"
    >
      <form className="grid gap-4" onSubmit=${submit}>
        ${editing
          ? null
          : html`
              <div className="block">
                <span className="cs-entry-label">Pilih kategori</span>
                ${/* Chip, bukan select. Daftar opsi select digambar sistem
                      operasi sehingga tidak bisa mengikuti token desain.
                      Metriknya sama dengan chip kategori di Catat cepat:
                      tinggi 38, radius 99, teks 13px/600. */ null}
                <div className="flex flex-wrap gap-2">
                  ${options.map((item) => {
                    const active = item.value === category;
                    return html`
                      <button
                        key=${item.value}
                        type="button"
                        aria-pressed=${active}
                        onClick=${() => selectCategory(item.value)}
                        className="dc-press dc-press-96 flex min-h-[38px] items-center rounded-full px-[15px] text-[13px] font-semibold"
                        style=${active
                          ? {
                              background: "var(--cs-sel-bg)",
                              color: "var(--cs-sel-fg)",
                              border: "1px solid transparent",
                            }
                          : {
                              background: "var(--cs-card)",
                              color: "var(--cs-body)",
                              border: "1px solid var(--cs-line)",
                            }}
                      >
                        ${item.label}
                      </button>
                    `;
                  })}
                </div>
                ${sudahPunyaJatah
                  ? html`
                      <span
                        className="mt-1.5 block text-xs leading-[1.45]"
                        style=${{ color: "var(--cs-mut)" }}
                      >
                        Kategori ini sudah punya jatah. Simpan untuk memperbarui
                        batasnya.
                      </span>
                    `
                  : null}
              </div>
            `}

        <label className="block">
          <span className="cs-entry-label">
            ${`Batas ${selectedLabel} per bulan`}
          </span>
          <input
            required
            inputMode="decimal"
            enterKeyHint="done"
            value=${inputAmount}
            onChange=${(event) =>
              setInputAmount(
                formatNumericInput(
                  event.target.value,
                  getNumericInputOptions(currency),
                ),
              )}
            placeholder="0"
            className=${INPUT_CLASS}
          />
          ${selectedMeta?.description
            ? html`
                <span
                  className="mt-1.5 block text-xs leading-[1.45]"
                  style=${{ color: "var(--cs-mut)" }}
                >
                  ${selectedMeta.description}
                </span>
              `
            : null}
        </label>

        ${/* Batas jatah selalu dicatat dalam mata uang dasar. Belanja dalam
              mata uang lain tetap menguranginya karena dikonversi lebih dulu
              lewat base_amount, jadi layar ini tidak perlu pemilih mata
              uang. */ null}
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

        <button
          type="submit"
          disabled=${loading}
          className="dc-press dc-press-96 flex min-h-[52px] items-center justify-center rounded-[17px] text-[15px] font-bold disabled:opacity-50"
          style=${{ background: "var(--cs-acc)", color: "var(--cs-on-acc)" }}
        >
          Simpan jatah
        </button>
      </form>
    </${SheetShell}>
  `;
}

/* Daftar jatah kategori. Judulnya berada di dalam kartu seperti kartu mode
   simpel, sehingga kedua mode terbaca sebagai satu keluarga dan label segmen
   di atasnya tidak terulang lagi sebagai judul halaman. */
function BudgetSection({
  metrics,
  paceByCategory,
  currency,
  loading,
  onBudgetDelete,
  onBudgetSubmit,
  focusCategoryKey = null,
  daysLeftInMonth = 0,
  onOpenCategoryHistory,
}) {
  const [editing, setEditing] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const baseCurrency = normalizeCurrencyCode(currency);
  const activeBudgets = metrics.budgetInsights.filter(
    (budget) =>
      budget.scope !== "month" &&
      normalizeCurrencyCode(
        budget.baseCurrency || budget.base_currency || budget.currency,
      ) === baseCurrency,
  );

  useEffect(() => {
    if (!focusCategoryKey) return;
    const target = document.querySelector(
      `[data-budget-category="${focusCategoryKey}"]`,
    );
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusCategoryKey, activeBudgets.length]);

  function openSheet(budget = null) {
    setOpenMenuId(null);
    setEditing({ budget });
  }

  async function submitBudget({ category, amount }) {
    return onBudgetSubmit({
      month_key: metrics.currentMonthKey,
      group_key: getDefaultGroupForCategory(category),
      category,
      input_amount: amount,
      input_currency: baseCurrency,
      base_amount: amount,
      base_currency: baseCurrency,
      planning_rate: 1,
      rate_source: "base",
      rate_date: new Date().toISOString().slice(0, 10),
      rate_from_currency: baseCurrency,
      rate_to_currency: baseCurrency,
    });
  }

  return html`
    <section className="dc-card flex flex-col gap-[15px] p-[18px]">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[15px] font-bold">Jatah per kategori</span>
        ${activeBudgets.length
          ? html`
              <span
                className="shrink-0 text-[11.5px]"
                style=${{ color: "var(--cs-mut)" }}
              >
                ${`${activeBudgets.length} kategori`}
              </span>
            `
          : null}
      </div>

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
                            onClick=${() => openSheet(budget)}
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
        onClick=${() => openSheet(null)}
        className="flex items-center justify-center gap-2 pt-4"
        style=${{ borderTop: "1px solid var(--cs-chip)" }}
      >
        <span className="text-[17px]" style=${{ color: "var(--cs-faint)" }}>+</span>
        <span className="text-[13px] font-medium" style=${{ color: "var(--cs-mut)" }}>
          Tambah kategori
        </span>
      </button>

      <${BudgetCategorySheet}
        open=${Boolean(editing)}
        budget=${editing?.budget || null}
        budgets=${activeBudgets}
        currency=${baseCurrency}
        loading=${loading}
        onClose=${() => setEditing(null)}
        onSubmit=${submitBudget}
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

/* Pemilih mode memakai metrik segmen yang sama persis dengan Keluar/Masuk di
   Catat transaksi: tinggi 40, radius 11 di dalam wadah radius 14, teks
   13px/700. Perpindahan mode jadi terasa seperti bagian aplikasi yang sudah
   ada, bukan kontrol baru. */
function BudgetModeSwitch({ mode, onSelect }) {
  const segment = (active) =>
    active
      ? { background: "var(--cs-sel-bg)", color: "var(--cs-sel-fg)" }
      : { background: "transparent", color: "var(--cs-body)" };

  return html`
    <div
      className="flex gap-1 rounded-[14px] p-1"
      style=${{ background: "var(--cs-seg)" }}
    >
      <button
        type="button"
        onClick=${() => onSelect(BUDGET_MODES.simple)}
        aria-pressed=${mode === BUDGET_MODES.simple}
        className="min-h-10 flex-1 rounded-[11px] text-[13px] font-bold"
        style=${segment(mode === BUDGET_MODES.simple)}
      >
        Simpel
      </button>
      <button
        type="button"
        onClick=${() => onSelect(BUDGET_MODES.category)}
        aria-pressed=${mode === BUDGET_MODES.category}
        className="min-h-10 flex-1 rounded-[11px] text-[13px] font-bold"
        style=${segment(mode === BUDGET_MODES.category)}
      >
        Per kategori
      </button>
    </div>
  `;
}

/* Mode simpel: satu angka untuk sebulan. Barisnya memakai metrik yang sama
   dengan baris kategori di BudgetSection, jadi berpindah mode tidak mengubah
   rasa halamannya. */
function SimpleBudgetCard({
  view,
  pace,
  currency,
  loading,
  billEstimate,
  reserveBills,
  onToggleReserveBills,
  previousAmount = 0,
  onSave,
}) {
  const [showForm, setShowForm] = useState(false);
  const [inputAmount, setInputAmount] = useState("");
  const [formError, setFormError] = useState("");
  const formVisible = showForm || !view;

  function openForm() {
    setInputAmount(
      view
        ? formatNumericInput(
            String(view.limitAmount || ""),
            getNumericInputOptions(currency),
          )
        : "",
    );
    setFormError("");
    setShowForm(true);
  }

  async function submit(event) {
    event.preventDefault();
    const amount = Number(
      normalizeNumericInput(inputAmount, getNumericInputOptions(currency)),
    );
    if (!amount || amount <= 0) {
      setFormError("Jatah bulanan harus lebih besar dari 0.");
      return;
    }
    const ok = await onSave?.(amount);
    if (ok) {
      setShowForm(false);
      setInputAmount("");
      setFormError("");
    }
  }

  const limit = Number(view?.limitAmount || 0);
  const spent = Number(view?.spentAmount || 0);
  const usage = limit > 0 ? spent / limit : 0;
  const barWidth = Math.min(Math.max(usage * 100, spent > 0 ? 2 : 0), 100);
  const over = Math.round(usage * 100) >= 100;
  const barColor = over
    ? "var(--cs-danger)"
    : view?.status === "warning"
      ? "var(--cs-warn)"
      : "var(--cs-acc)";
  const ritme = buildBudgetPaceSentence(pace, currency);
  const ritmeWarna = {
    danger: "var(--cs-danger)",
    warn: "var(--cs-warn)",
    mut: "var(--cs-mut)",
  }[getBudgetPaceTone(pace?.paceStatus)];
  /* Dirakit di sini, bukan dipecah di dalam template: htm memakan pergantian
     barisnya dan kalimatnya menempel. */
  const catatanTagihan = billEstimate
    ? [
        `Perkiraan dari rata-rata Tagihan dan Tempat Tinggal ${billEstimate.monthCount} bulan terakhir.`,
        billEstimate.paidThisMonth > 0
          ? `${formatCurrency(billEstimate.paidThisMonth, currency)} sudah dibayar bulan ini.`
          : "",
      ]
        .filter(Boolean)
        .join(" ")
    : "";

  return html`
    <section className="dc-card flex flex-col gap-[15px] p-[18px]">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[15px] font-bold">Jatah bulan ini</span>
        ${view && !formVisible
          ? html`
              <button
                type="button"
                onClick=${openForm}
                className="shrink-0 text-[13px] font-medium"
                style=${{ color: "var(--cs-link)" }}
              >
                Atur
              </button>
            `
          : null}
      </div>

      ${formVisible
        ? html`
            <form className="grid gap-3" onSubmit=${submit}>
              <label className="block">
                <span className="cs-entry-label">
                  Berapa jatahmu bulan ini?
                </span>
                <input
                  required
                  inputMode="decimal"
                  enterKeyHint="done"
                  value=${inputAmount}
                  onChange=${(event) =>
                    setInputAmount(
                      formatNumericInput(
                        event.target.value,
                        getNumericInputOptions(currency),
                      ),
                    )}
                  placeholder="0"
                  className=${INPUT_CLASS}
                />
              </label>

              ${!view && previousAmount > 0
                ? html`
                    <button
                      type="button"
                      onClick=${() =>
                        setInputAmount(
                          formatNumericInput(
                            String(previousAmount),
                            getNumericInputOptions(currency),
                          ),
                        )}
                      className="self-start text-[13px] font-medium"
                      style=${{ color: "var(--cs-link)" }}
                    >
                      ${`Pakai jatah bulan lalu (${formatCurrency(previousAmount, currency)})`}
                    </button>
                  `
                : null}

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

              <div
                className=${view
                  ? "grid grid-cols-[.75fr_1.25fr] gap-2"
                  : "grid"}
              >
                ${view
                  ? html`
                      <button
                        type="button"
                        onClick=${() => {
                          setShowForm(false);
                          setFormError("");
                        }}
                        className="dc-press dc-press-96 min-h-[52px] rounded-[17px] px-3 text-[15px] font-medium"
                        style=${{ color: "var(--cs-body)" }}
                      >
                        Batal
                      </button>
                    `
                  : null}
                <button
                  type="submit"
                  disabled=${loading}
                  className="dc-press dc-press-96 min-h-[52px] rounded-[17px] px-4 text-[15px] font-bold disabled:opacity-50"
                  style=${{
                    background: "var(--cs-acc)",
                    color: "var(--cs-on-acc)",
                  }}
                >
                  Simpan jatah
                </button>
              </div>
            </form>
          `
        : html`
            <div className="flex flex-col gap-[7px]">
              <div className="flex items-baseline justify-between gap-2.5 text-[13px]">
                <span style=${{ color: "var(--cs-body)" }}>Terpakai</span>
                <span
                  className="dc-num shrink-0 whitespace-nowrap text-[12.5px]"
                  style=${{ color: over ? "var(--cs-danger)" : "var(--cs-ink)" }}
                >
                  ${formatCurrency(spent, currency)} / ${formatCurrency(limit, currency)}
                </span>
              </div>

              <span className="dc-track h-2">
                <span
                  style=${{ width: `${barWidth}%`, background: barColor }}
                ></span>
              </span>

              ${ritme?.label
                ? html`
                    <span className="flex items-center gap-1.5 text-[11.5px]">
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
            </div>
          `}

      ${view && billEstimate
        ? html`
            <div
              className="flex flex-col gap-1.5 pt-4"
              style=${{ borderTop: "1px solid var(--cs-chip)" }}
            >
              <div className="flex items-baseline justify-between gap-2.5 text-[13px]">
                <span style=${{ color: "var(--cs-body)" }}>
                  Disisihkan untuk tagihan rutin
                </span>
                <span
                  className="dc-num shrink-0 whitespace-nowrap text-[12.5px]"
                  style=${{
                    color: reserveBills ? "var(--cs-ink)" : "var(--cs-faint)",
                  }}
                >
                  ${reserveBills
                    ? formatCurrency(billEstimate.remaining, currency)
                    : "Tidak disisihkan"}
                </span>
              </div>
              <span
                className="text-[11.5px] leading-[1.45]"
                style=${{ color: "var(--cs-mut)" }}
              >
                ${catatanTagihan}
              </span>
              <button
                type="button"
                onClick=${onToggleReserveBills}
                className="self-start text-xs font-bold"
                style=${{ color: "var(--cs-link)" }}
              >
                ${reserveBills ? "Jangan sisihkan" : "Sisihkan lagi"}
              </button>
            </div>
          `
        : null}
    </section>
  `;
}

/* Perpindahan mode menghapus jatah lama bulan itu, jadi selalu lewat sheet
   dengan angka yang bisa dilihat dulu, bukan dialog bawaan peramban. */
function BudgetModeSheet({
  open,
  kind,
  currency,
  split,
  categoryTotal = 0,
  loading,
  onClose,
  onApplySplit,
  onManualCategories,
  onMerge,
}) {
  const [mergeAmount, setMergeAmount] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!open) return;
    setMergeAmount(
      categoryTotal > 0
        ? formatNumericInput(
            String(categoryTotal),
            getNumericInputOptions(currency),
          )
        : "",
    );
    setFormError("");
  }, [open, kind]);

  async function merge(event) {
    event.preventDefault();
    const amount = Number(
      normalizeNumericInput(mergeAmount, getNumericInputOptions(currency)),
    );
    if (!amount || amount <= 0) {
      setFormError("Jatah bulanan harus lebih besar dari 0.");
      return;
    }
    await onMerge?.(amount);
  }

  const toCategory = kind === "toCategory";
  const helper = toCategory
    ? split
      ? `Jatah ${formatCurrency(split.total, currency)} dibagi mengikuti pola belanjamu ${split.monthCount} bulan terakhir. Angkanya masih bisa kamu ubah setelah tersimpan.`
      : "Riwayat belanjamu belum cukup untuk diusulkan pembagiannya, jadi batas tiap kategori kamu isi sendiri."
    : "Semua batas kategori bulan ini digabung jadi satu jatah. Rinciannya bisa dibuat lagi kapan saja.";

  return html`
    <${SheetShell}
      open=${open}
      onClose=${onClose}
      title=${toCategory ? "Bagi jatah per kategori" : "Gabungkan jadi satu jatah"}
      helper=${helper}
      labelledBy="budget-mode-title"
    >
      ${toCategory
        ? html`
            <div className="flex flex-col gap-3">
              ${split
                ? html`
                    <div className="flex flex-col">
                      ${split.rows.map(
                        (row) => html`
                          <div
                            key=${row.categoryKey}
                            className="flex min-h-[34px] items-center gap-2.5 px-1"
                          >
                            <span className="min-w-0 flex-1 truncate text-[12.5px]">
                              ${row.label}
                            </span>
                            <span
                              className="dc-num shrink-0 text-[12px]"
                              style=${{ color: "var(--cs-mut)" }}
                            >
                              ${Math.round(row.share * 100)}%
                            </span>
                            <span className="dc-num w-[92px] shrink-0 text-right text-[12.5px]">
                              ${formatCurrency(row.amount, currency)}
                            </span>
                          </div>
                        `,
                      )}
                    </div>
                  `
                : null}

              <span
                className="text-[11.5px] leading-[1.45]"
                style=${{ color: "var(--cs-mut)" }}
              >
                Jatah satu bulan penuh akan diganti oleh batas per kategori.
              </span>

              ${split
                ? html`
                    <button
                      type="button"
                      onClick=${() => onApplySplit?.(split.rows)}
                      disabled=${loading}
                      className="dc-press dc-press-96 flex min-h-[52px] items-center justify-center rounded-[17px] text-[15px] font-bold disabled:opacity-50"
                      style=${{
                        background: "var(--cs-acc)",
                        color: "var(--cs-on-acc)",
                      }}
                    >
                      Pakai pembagian ini
                    </button>
                  `
                : null}

              <button
                type="button"
                onClick=${onManualCategories}
                disabled=${loading}
                className=${split
                  ? "dc-press dc-press-96 flex min-h-12 items-center justify-center rounded-[16px] border text-sm font-bold disabled:opacity-50"
                  : "dc-press dc-press-96 flex min-h-[52px] items-center justify-center rounded-[17px] text-[15px] font-bold disabled:opacity-50"}
                style=${split
                  ? { borderColor: "var(--cs-line)", color: "var(--cs-body)" }
                  : { background: "var(--cs-acc)", color: "var(--cs-on-acc)" }}
              >
                Isi sendiri
              </button>
            </div>
          `
        : html`
            <form className="grid gap-3" onSubmit=${merge}>
              <label className="block">
                <span className="cs-entry-label">Jatah bulan ini</span>
                <input
                  required
                  inputMode="decimal"
                  enterKeyHint="done"
                  value=${mergeAmount}
                  onChange=${(event) =>
                    setMergeAmount(
                      formatNumericInput(
                        event.target.value,
                        getNumericInputOptions(currency),
                      ),
                    )}
                  placeholder="0"
                  className=${INPUT_CLASS}
                />
              </label>

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

              <span
                className="text-[11.5px] leading-[1.45]"
                style=${{ color: "var(--cs-mut)" }}
              >
                Batas per kategori bulan ini akan dihapus.
              </span>

              <button
                type="submit"
                disabled=${loading}
                className="dc-press dc-press-96 flex min-h-[52px] items-center justify-center rounded-[17px] text-[15px] font-bold disabled:opacity-50"
                style=${{
                  background: "var(--cs-acc)",
                  color: "var(--cs-on-acc)",
                }}
              >
                Gabungkan
              </button>
            </form>
          `}
    </${SheetShell}>
  `;
}

export function BudgetWorkspacePage({
  metrics,
  controlSummary,
  transactions = [],
  budgets = [],
  baseCurrency,
  onBudgetDelete,
  onBudgetSubmit,
  onSaveBudgetPlan,
  reserveBills = true,
  onToggleReserveBills,
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
  const monthKey = metrics.currentMonthKey;
  /* Mode tidak disimpan sebagai penanda tersendiri, melainkan dibaca dari
     baris jatah bulan ini. Bulan yang masih kosong mengikuti mode bulan
     sebelumnya. */
  const plan = useMemo(
    () => resolveBudgetMode(budgets, monthKey, budgetCurrency),
    [budgets, monthKey, budgetCurrency],
  );
  const [emptyMode, setEmptyMode] = useState(plan.suggestedMode);
  const [modeSheet, setModeSheet] = useState(null);

  useEffect(() => {
    setEmptyMode(plan.suggestedMode);
  }, [plan.suggestedMode, monthKey]);

  const mode = plan.mode === BUDGET_MODES.none ? emptyMode : plan.mode;
  const simpleMode = mode === BUDGET_MODES.simple;
  const monthlyInsight =
    (metrics.budgetInsights || []).find((item) => item.scope === "month") ||
    null;
  const billEstimate = useMemo(
    () =>
      simpleMode
        ? estimateRecurringBills({
            transactions,
            monthKey,
            baseCurrency: budgetCurrency,
          })
        : null,
    [simpleMode, transactions, monthKey, budgetCurrency],
  );
  const simpleView = buildSimpleBudgetView({
    insight: monthlyInsight,
    reservedAmount: reserveBills ? Number(billEstimate?.remaining || 0) : 0,
  });
  const splitSuggestion = useMemo(
    () =>
      modeSheet === "toCategory"
        ? suggestCategorySplit({
            transactions,
            monthKey,
            baseCurrency: budgetCurrency,
            totalAmount: Number(plan.monthlyBudget?.limitAmount || 0),
          })
        : null,
    [modeSheet, transactions, monthKey, budgetCurrency, plan.monthlyBudget],
  );
  const categoryTotal = plan.categoryBudgets.reduce(
    (sum, budget) => sum + Number(budget.limitAmount || 0),
    0,
  );

  function selectMode(next) {
    if (next === mode) return;
    /* Bulan yang belum punya jatah tidak perlu konfirmasi: tidak ada yang
       dihapus, hanya tampilannya yang berganti. */
    if (plan.mode === BUDGET_MODES.none) {
      setEmptyMode(next);
      return;
    }
    setModeSheet(next === BUDGET_MODES.simple ? "toSimple" : "toCategory");
  }

  async function saveMonthlyBudget(amount) {
    return onSaveBudgetPlan?.({
      mode: BUDGET_MODES.simple,
      monthKey,
      totalAmount: amount,
    });
  }

  async function applySplit(rows) {
    const ok = await onSaveBudgetPlan?.({
      mode: BUDGET_MODES.category,
      monthKey,
      rows,
    });
    if (ok) setModeSheet(null);
    return ok;
  }

  async function switchToManualCategories() {
    const ok = await onSaveBudgetPlan?.({
      mode: BUDGET_MODES.category,
      monthKey,
      rows: [],
    });
    if (ok) setModeSheet(null);
    return ok;
  }

  async function mergeIntoMonthly(amount) {
    const ok = await onSaveBudgetPlan?.({
      mode: BUDGET_MODES.simple,
      monthKey,
      totalAmount: amount,
    });
    if (ok) setModeSheet(null);
    return ok;
  }

  const breakdown = buildSpendingBreakdown({
    transactions,
    budgetInsights: metrics.budgetInsights || [],
    baseCurrency: budgetCurrency,
    monthKey: metrics.currentMonthKey,
    /* Di mode simpel tidak ada kategori yang "belum punya jatah": semuanya
       ada di dalam satu jatah bulan ini. */
    wholeMonthBudget: simpleMode && Boolean(monthlyInsight),
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
  const heroNote = simpleMode
    ? simpleView
      ? simpleView.todayRemaining >= 0
        ? `Hari ini kamu masih aman sampai ${formatCurrency(simpleView.todayRemaining, budgetCurrency)}.`
        : `Hari ini sudah lewat ${formatCurrency(Math.abs(simpleView.todayRemaining), budgetCurrency)} dari batas amanmu.`
      : "Isi satu angka untuk sebulan, sisa hariannya dihitung otomatis."
    : limitTotal > 0
      ? `Kalau dibagi rata, kamu bisa pakai ${formatCurrency(perDay, budgetCurrency)} per hari sampai akhir bulan.`
      : "Belum ada batas bulanan. Atur jatah per kategori supaya sisa harian bisa dihitung.";
  const perhatianText =
    simpleMode && monthlyInsight
      ? "Jatah bulan ini perlu dilihat"
      : `${attentionCount} kategori perlu dilihat`;

  /* Permintaan membuka Target kini diarahkan ke halaman Dompet sejak dari
     tombolnya. Halaman ini tidak lagi mengalihkan dirinya sendiri saat
     dipasang: efek itulah yang membuat tab Jatah tidak bisa dibuka lagi. */

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
          ${heroNote}
        </span>
      </section>

      <${BudgetModeSwitch} mode=${mode} onSelect=${selectMode} />

      ${simpleMode
        ? html`
            <${SimpleBudgetCard}
              view=${simpleView}
              pace=${paceByCategory.get(MONTHLY_BUDGET_CATEGORY)}
              currency=${budgetCurrency}
              loading=${loading}
              billEstimate=${billEstimate}
              reserveBills=${reserveBills}
              onToggleReserveBills=${onToggleReserveBills}
              previousAmount=${plan.previousMonthlyAmount}
              onSave=${saveMonthlyBudget}
            />
          `
        : html`
            <${BudgetSection}
              metrics=${metrics}
              paceByCategory=${paceByCategory}
              currency=${budgetCurrency}
              loading=${loading}
              onBudgetDelete=${onBudgetDelete}
              onBudgetSubmit=${onBudgetSubmit}
              focusCategoryKey=${focusCategoryKey}
              daysLeftInMonth=${daysLeft}
              onOpenCategoryHistory=${onOpenCategoryHistory}
            />
          `}
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
                        ${perhatianText}
                      </span>
                    </span>
                  `
                : null}
            </button>
          `
        : null}
      </div>

      ${/* Sheet perpindahan mode dirender di dalam grid supaya halaman tetap
            satu akar. Posisinya fixed, jadi tidak mengambil sel grid. */ null}
      <${BudgetModeSheet}
        open=${Boolean(modeSheet)}
        kind=${modeSheet}
        currency=${budgetCurrency}
        split=${splitSuggestion}
        categoryTotal=${categoryTotal}
        loading=${loading}
        onClose=${() => setModeSheet(null)}
        onApplySplit=${applySplit}
        onManualCategories=${switchToManualCategories}
        onMerge=${mergeIntoMonthly}
      />
    </div>
  `;
}

export { BudgetSection as ControlBudgetHub };
