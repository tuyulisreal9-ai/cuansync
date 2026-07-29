import React, { useMemo } from "https://esm.sh/react@18.3.1";
import htm from "https://esm.sh/htm@3.1.1";
import {
  buildMonthlyReport,
  getAvailableReportMonths,
} from "../../domain/reports.js";
import {
  DEFAULT_BASE_CURRENCY,
  formatCurrency,
  formatPercent,
} from "../../lib/currency.js";
import {
  formatDateTime,
  formatMonthKey,
  getMonthKey,
  shiftMonthKey,
} from "../../lib/dates.js";
import {
  getTransactionPreview,
  getTransactionTypeLabel,
} from "../transactions/index.js";

const html = htm.bind(React.createElement);
const PREMIUM_PANEL = "relative overflow-hidden rounded-[30px] cuan-card";
const GLASS_INPUT = "w-full min-h-12 rounded-2xl px-4 py-3.5 text-sm transition cuan-input";

function ReportMonthPicker({ months, value, onChange }) {
  const previousKey = shiftMonthKey(value, -1);
  const nextKey = shiftMonthKey(value, 1);
  const latestAllowed = getMonthKey(new Date());
  const nextDisabled = nextKey > latestAllowed && !months.includes(nextKey);

  return html`
    <div className="grid grid-cols-[44px_1fr_44px] items-center gap-2">
      <button
        type="button"
        onClick=${() => onChange(previousKey)}
        className="cuan-secondary inline-flex min-h-11 items-center justify-center rounded-2xl px-3 text-sm font-black transition hover:-translate-y-0.5"
        aria-label="Bulan sebelumnya"
      >
        ${"<"}
      </button>
      <select
        value=${value}
        onChange=${(event) => onChange(event.target.value)}
        className=${`${GLASS_INPUT} text-center font-semibold`}
        aria-label="Pilih bulan laporan"
      >
        ${months.map(
          (month) => html`
            <option key=${month} value=${month}>${formatMonthKey(month)}</option>
          `,
        )}
      </select>
      <button
        type="button"
        disabled=${nextDisabled}
        onClick=${() => onChange(nextKey)}
        className="cuan-secondary inline-flex min-h-11 items-center justify-center rounded-2xl px-3 text-sm font-black transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"
        aria-label="Bulan berikutnya"
      >
        ${">"}
      </button>
    </div>
  `;
}

function MonthlyReportHero({ report }) {
  const netPositive = report.summary.netCashflowIdr >= 0;
  const trendText =
    report.previousDeltaIdr == null
      ? "Belum ada data bulan lalu"
      : `${report.previousDeltaIdr >= 0 ? "Naik" : "Turun"} ${formatCurrency(
          Math.abs(report.previousDeltaIdr),
          "idr",
        )} vs bulan lalu`;
  const statusLabel = netPositive ? "Sisa" : "Minus";
  const heroLabel = netPositive ? "Sisa uang bulan ini" : "Minus bulan ini";
  const heroHelper = netPositive
    ? "Bulan ini masih aman."
    : "Bulan ini lebih besar pasak daripada tiang.";

  return html`
    <section className=${`${PREMIUM_PANEL} report-reveal report-glow-sweep p-5 md:p-6`}>
      <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-brand-400/20 blur-3xl dark:bg-brand-400/14"></div>
      <div className="pointer-events-none absolute -bottom-24 left-6 h-48 w-48 rounded-full bg-sky-300/16 blur-3xl dark:bg-sky-400/10"></div>
      <div className="relative grid gap-5 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
        <div>
          <div className="inline-flex rounded-full border border-brand-300/25 bg-brand-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-800 dark:border-brand-400/20 dark:text-brand-200">
            Laporan ${report.meta.label}
          </div>
          <p className="mt-4 text-sm font-semibold text-slate-600 dark:text-slate-300">
            ${heroLabel}
          </p>
          <h2 className=${`mt-2 break-words font-display text-4xl font-black text-slate-950 dark:text-white md:text-5xl ${netPositive ? "" : "text-rose-700 dark:text-rose-300"}`}>
            ${netPositive ? "+" : "-"}${formatCurrency(Math.abs(report.summary.netCashflowIdr), "idr")}
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-700 dark:text-slate-300">
            ${heroHelper}
          </p>
        </div>

        <div className="grid gap-3 rounded-[24px] border border-slate-200/70 bg-white/58 p-4 shadow-[0_18px_44px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/45">
          <div className="flex items-center justify-between gap-3">
            <span className=${`rounded-full px-3 py-1 text-xs font-black ${netPositive ? "bg-brand-500/12 text-brand-700 dark:text-brand-200" : "bg-rose-500/12 text-rose-700 dark:text-rose-200"}`}>
              ${statusLabel}
            </span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              ${trendText}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Uang masuk
              </p>
              <p className="mt-2 break-words text-base font-black text-brand-700 dark:text-brand-300">
                ${formatCurrency(report.summary.externalIncomeIdr, "idr")}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Uang keluar
              </p>
              <p className="mt-2 break-words text-base font-black text-rose-700 dark:text-rose-300">
                ${formatCurrency(report.summary.expenseIdr, "idr")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

function MonthlyReportKpis({ report }) {
  const stats = [
    {
      title: "Uang masuk",
      value: formatCurrency(report.summary.externalIncomeIdr, "idr"),
      helper: "Total pemasukan",
    },
    {
      title: "Uang keluar",
      value: formatCurrency(report.summary.expenseIdr, "idr"),
      helper: "Total pengeluaran",
    },
    {
      title: "Sisa dari masuk",
      value:
        report.summary.externalIncomeIdr > 0
          ? formatPercent(report.savingsRatio)
          : "-",
      helper: "Bagian uang masuk yang belum terpakai",
    },
    {
      title: "Tukar uang",
      value: formatCurrency(report.summary.exchangeVolumeIdr, "idr"),
      helper: `${report.summary.exchangeCount} transaksi tukar`,
    },
    {
      title: "Belum ada rate",
      value: report.summary.unvaluedExpenseCount,
      helper: "Pengeluaran asing",
    },
    {
      title: "Rata-rata",
      value: formatCurrency(report.dailyAverageExpenseIdr, "idr"),
      helper: "Keluar per hari",
    },
    {
      title: "Transaksi",
      value: report.summary.count,
      helper: "Aktivitas bulan ini",
    },
  ];

  return html`
    <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-7">
      ${stats.map(
        (item, index) => html`
          <div
            key=${item.title}
            className="cuan-card-soft report-reveal rounded-[22px] p-4"
            style=${{ animationDelay: `${80 + index * 45}ms` }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              ${item.title}
            </p>
            <p className="mt-2 break-words text-base font-black text-slate-950 dark:text-white md:text-lg">
              ${item.value}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
              ${item.helper}
            </p>
          </div>
        `,
      )}
    </section>
  `;
}

function MonthlyBudgetPulse({ report }) {
  const chipClass =
    report.budgetStatus === "over"
      ? "bg-rose-500/12 text-rose-700 dark:text-rose-200"
      : report.budgetStatus === "warning"
        ? "bg-amber-500/12 text-amber-700 dark:text-amber-200"
        : report.budgetStatus === "safe"
          ? "bg-brand-500/12 text-brand-700 dark:text-brand-200"
          : "bg-slate-500/12 text-slate-600 dark:text-slate-300";

  return html`
    <section className=${`${PREMIUM_PANEL} report-reveal p-5 md:p-6`}>
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-bold text-slate-950 dark:text-white">
            Proteksi Anggaran
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Status semua anggaran aktif di ${report.meta.label}, mengikuti mata uang yang kamu pakai.
          </p>
        </div>
        <span className=${`rounded-full px-3 py-1 text-xs font-black ${chipClass}`}>
          ${report.budgetStatusLabel}
        </span>
      </div>

      ${report.budgetInsights.length
        ? html`
            <div className="relative mt-5 grid gap-3">
              ${report.budgetInsights.map((budget) => {
                const width = `${Math.min(
                  Math.max(budget.usage * 100, budget.spentAmount > 0 ? 8 : 0),
                  100,
                )}%`;
                return html`
                  <div
                    key=${budget.id || `${budget.month_key}-${budget.currency}-${budget.categoryKey}`}
                    className="rounded-2xl border border-slate-200/70 bg-white/50 p-3 dark:border-white/10 dark:bg-slate-800/45"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                          ${budget.categoryLabel}
                        </p>
                        <p className="mt-1 text-sm font-black text-slate-950 dark:text-white">
                          ${formatCurrency(budget.spentAmount, budget.currency)} / ${formatCurrency(
                            budget.limitAmount,
                            budget.currency,
                          )}
                        </p>
                      </div>
                      <span className=${`rounded-full border px-2.5 py-1 text-[11px] font-black ${budget.tone}`}>
                        ${budget.statusLabel}
                      </span>
                    </div>
                    <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
                      <div
                        className=${`report-bar-fill h-full rounded-full bg-gradient-to-r ${budget.barClass}`}
                        style=${{ width }}
                      ></div>
                    </div>
                    <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                      Sisa ${formatCurrency(Math.max(budget.remainingAmount, 0), budget.currency)}
                      - Batas hari ini ${formatCurrency(budget.dynamicDailyLimit, budget.currency)}
                    </p>
                  </div>
                `;
              })}
            </div>
            <div className="relative mt-4 grid grid-cols-3 gap-3 rounded-2xl border border-slate-200/70 bg-white/45 p-3 dark:border-white/10 dark:bg-slate-900/35">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  Batas IDR
                </p>
                <p className="mt-1 text-sm font-black text-slate-950 dark:text-white">
                  ${formatCurrency(report.budgetLimitBaseIdr, "idr")}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  Terpakai
                </p>
                <p className="mt-1 text-sm font-black text-slate-950 dark:text-white">
                  ${formatCurrency(report.budgetSpentBaseIdr, "idr")}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  Sisa
                </p>
                <p className="mt-1 text-sm font-black text-slate-950 dark:text-white">
                  ${formatCurrency(Math.max(report.budgetRemainingBaseIdr, 0), "idr")}
                </p>
              </div>
            </div>
          `
        : html`
            <div className="relative mt-5 rounded-2xl border border-dashed border-slate-300/70 bg-white/45 p-5 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-800/35 dark:text-slate-300">
              Belum ada anggaran aktif untuk bulan ini. Buat anggaran di tab Kontrol agar laporan bisa membaca batas aman.
            </div>
          `}
    </section>
  `;
}

function MonthlyCurrencySummary({ report }) {
  const visibleCurrencies = report.currencyBreakdown.filter(
    (item) =>
      item.income > 0 ||
      item.expense > 0 ||
      item.exchangeIn > 0 ||
      item.exchangeOut > 0,
  );

  return html`
    <section className=${`${PREMIUM_PANEL} report-reveal p-5 md:p-6`}>
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold text-slate-950 dark:text-white">
            Ringkasan Mata Uang
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Uang masuk, uang keluar, dan tukar uang dibuat terpisah agar tidak membingungkan.
          </p>
        </div>
      </div>

      ${visibleCurrencies.length
        ? html`
            <div className="relative mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              ${visibleCurrencies.map((item) => html`
                <div
                  key=${item.currency}
                  className="rounded-2xl border border-slate-200/70 bg-white/50 p-3 dark:border-white/10 dark:bg-slate-800/45"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-slate-950 dark:text-white">
                      ${item.currency}
                    </p>
                    <span className="rounded-full border border-brand-300/25 bg-brand-500/10 px-2.5 py-1 text-[11px] font-black text-brand-700 dark:border-brand-300/20 dark:text-brand-200">
                      Wallet
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Masuk</p>
                      <p className="mt-1 font-black text-brand-700 dark:text-brand-300">
                        ${formatCurrency(item.income, item.currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Keluar</p>
                      <p className="mt-1 font-black text-rose-700 dark:text-rose-300">
                        ${formatCurrency(item.expense, item.currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Diterima</p>
                      <p className="mt-1 font-black text-sky-700 dark:text-sky-300">
                        ${formatCurrency(item.exchangeIn, item.currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Ditukar</p>
                      <p className="mt-1 font-black text-slate-700 dark:text-slate-200">
                        ${formatCurrency(item.exchangeOut, item.currency)}
                      </p>
                    </div>
                  </div>
                </div>
              `)}
            </div>
          `
        : html`
            <div className="relative mt-5 rounded-2xl border border-dashed border-slate-300/70 bg-white/45 p-5 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-800/35 dark:text-slate-300">
              Belum ada aktivitas mata uang di bulan ini.
            </div>
          `}
    </section>
  `;
}

function MonthlyReportCharts({ report }) {
  const cashflowMax = Math.max(
    report.summary.externalIncomeIdr,
    report.summary.expenseIdr,
    1,
  );
  const dailyMax = Math.max(
    ...report.dailySeries.map((item) => item.expenseIdr),
    1,
  );

  return html`
    <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
      <div className=${`${PREMIUM_PANEL} report-reveal p-5 md:p-6`}>
        <div className="relative">
          <h3 className="font-display text-lg font-bold text-slate-950 dark:text-white">
            Uang Masuk vs Keluar
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Perbandingan total bulan ini.
          </p>
        </div>
        <div className="relative mt-5 grid gap-4">
          ${[
            ["Masuk", report.summary.externalIncomeIdr, "from-brand-500 to-emerald-300"],
            ["Keluar", report.summary.expenseIdr, "from-rose-500 to-amber-400"],
          ].map(([label, value, gradient], index) => {
            const width = `${Math.max((Number(value) / cashflowMax) * 100, value > 0 ? 8 : 0)}%`;
            return html`
              <div key=${label}>
                <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                  <span className="font-semibold text-slate-600 dark:text-slate-300">
                    ${label}
                  </span>
                  <span className="font-bold text-slate-950 dark:text-white">
                    ${formatCurrency(value, "idr")}
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
                  <div
                    className=${`report-bar-fill h-full rounded-full bg-gradient-to-r ${gradient}`}
                    style=${{ width, animationDelay: `${index * 120}ms` }}
                  ></div>
                </div>
              </div>
            `;
          })}
        </div>
      </div>

      <div className=${`${PREMIUM_PANEL} report-reveal p-5 md:p-6`}>
        <div className="relative">
          <h3 className="font-display text-lg font-bold text-slate-950 dark:text-white">
            Pola Harian
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Pengeluaran per hari di ${report.meta.label}.
          </p>
        </div>
        <div className="relative mt-5 flex h-36 items-end gap-1">
          ${report.dailySeries.map((item, index) => {
            const height = Math.max((item.expenseIdr / dailyMax) * 100, item.expenseIdr > 0 ? 10 : 4);
            const showLabel =
              index === 0 ||
              index === report.dailySeries.length - 1 ||
              Number(item.label) % 5 === 0;
            return html`
              <div key=${item.key} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <div className="flex h-24 w-full items-end">
                  <div
                    title=${`${item.tooltipLabel}: ${formatCurrency(item.expenseIdr, "idr")}`}
                    className="report-column w-full rounded-t-xl bg-gradient-to-t from-brand-600 to-emerald-300 dark:from-brand-500 dark:to-emerald-200"
                    style=${{
                      height: `${height}%`,
                      animationDelay: `${index * 18}ms`,
                    }}
                  ></div>
                </div>
                <span className="h-3 text-[9px] font-semibold text-slate-500 dark:text-slate-400">
                  ${showLabel ? item.label : ""}
                </span>
              </div>
            `;
          })}
        </div>
      </div>
    </section>
  `;
}

function MonthlyCategoryBreakdown({ report }) {
  const topCategories = report.categoryBreakdown.slice(0, 5);

  return html`
    <section className=${`${PREMIUM_PANEL} report-reveal p-5 md:p-6`}>
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold text-slate-950 dark:text-white">
            Kategori Terbesar
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Ke mana uang paling banyak pergi.
          </p>
        </div>
      </div>

      ${topCategories.length
        ? html`
            <div className="relative mt-5 grid gap-3">
              ${topCategories.map((item, index) => html`
                <div key=${item.key} className="rounded-2xl border border-slate-200/70 bg-white/50 p-3 dark:border-white/10 dark:bg-slate-800/45">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-950 dark:text-white">
                        ${item.label}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        ${item.count} transaksi
                      </p>
                      <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                        ${Object.entries(item.valueByCurrency || {})
                          .filter(([, amount]) => Number(amount || 0) > 0)
                          .map(([currency, amount]) => formatCurrency(amount, currency))
                          .join(" + ")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-slate-950 dark:text-white">
                        ${formatCurrency(item.valueIdr, "idr")}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        ${formatPercent(item.share)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
                    <div
                      className=${`report-bar-fill h-full rounded-full bg-gradient-to-r ${item.meta.bar}`}
                      style=${{
                        width: `${Math.max(item.share * 100, 6)}%`,
                        animationDelay: `${index * 70}ms`,
                      }}
                    ></div>
                  </div>
                </div>
              `)}
            </div>
          `
        : html`
            <div className="relative mt-5 rounded-2xl border border-dashed border-slate-300/70 bg-white/45 p-5 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-800/35 dark:text-slate-300">
              Belum ada pengeluaran di bulan ini.
            </div>
          `}
    </section>
  `;
}

function MonthlyReportInsights({ report }) {
  const topCategory = report.topCategory;
  const budgetHelper =
    report.budgetInsights.length
      ? `${formatPercent(report.budgetUsage)} dari anggaran sudah terpakai. Total anggaran ${formatCurrency(
          report.budgetLimitBaseIdr,
          "idr",
        )}.`
      : "Tambahkan anggaran agar laporan bisa memberi peringatan.";
  const rhythmHelper = report.meta.isCurrentMonth
    ? `Jika pola sama, akhir bulan sekitar ${formatCurrency(report.projectedExpenseIdr, "idr")}.`
    : "Rata-rata dari bulan yang sudah selesai.";
  const focusHelper =
    topCategory && topCategory.share >= 0.45
      ? `${topCategory.label} mengambil ${formatPercent(topCategory.share)} dari pengeluaran.`
      : topCategory
        ? "Pengeluaran relatif tersebar di beberapa kategori."
        : "Belum ada kategori pengeluaran.";
  const insights = [
    {
      title: "Fokus kategori",
      value: topCategory ? topCategory.label : "-",
      helper: focusHelper,
    },
    {
      title: "Rata-rata harian",
      value: formatCurrency(report.dailyAverageExpenseIdr, "idr"),
      helper: rhythmHelper,
    },
    {
      title: "Anggaran",
      value: report.budgetStatusLabel,
      helper: budgetHelper,
    },
  ];

  return html`
    <section className="grid gap-3 md:grid-cols-3">
      ${insights.map(
        (item, index) => html`
          <div
            key=${item.title}
            className="cuan-card-soft report-reveal rounded-[22px] p-4"
            style=${{ animationDelay: `${140 + index * 55}ms` }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              ${item.title}
            </p>
            <p className="mt-2 break-words text-base font-black text-slate-950 dark:text-white">
              ${item.value}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
              ${item.helper}
            </p>
          </div>
        `,
      )}
    </section>
  `;
}

function MonthlyReportRecent({ report, onNavigate }) {
  return html`
    <section className=${`${PREMIUM_PANEL} report-reveal p-5 md:p-6`}>
      <div className="relative flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold text-slate-950 dark:text-white">
            Transaksi Bulan Ini
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            5 aktivitas terakhir di ${report.meta.label}.
          </p>
        </div>
        <button
          type="button"
          onClick=${() => onNavigate("history")}
          className="cuan-secondary min-h-11 rounded-2xl px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5"
        >
          Riwayat
        </button>
      </div>

      <div className="relative mt-4 grid gap-2">
        ${report.recentTransactions.map((item) => html`
          <div
            key=${item.id}
            className="grid grid-cols-[1fr_auto] gap-3 rounded-2xl border border-slate-200/70 bg-white/50 p-3 dark:border-white/10 dark:bg-slate-800/45"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-950 dark:text-white">
                ${item.description || getTransactionTypeLabel(item) || "Transaksi"}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                ${formatDateTime(item.occurred_at)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-black text-slate-950 dark:text-white">
                ${getTransactionPreview(item)}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                ${getTransactionTypeLabel(item)}
              </p>
            </div>
          </div>
        `)}
      </div>
    </section>
  `;
}

function MonthlyReportEmptyState({ onNavigate }) {
  return html`
    <section className=${`${PREMIUM_PANEL} report-reveal p-6 text-center md:p-8`}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(16,185,129,0.16),transparent_48%)]"></div>
      <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-brand-300/25 bg-brand-500/12 text-2xl font-black text-brand-700 dark:text-brand-200">
        +
      </div>
      <h3 className="relative mt-4 font-display text-2xl font-bold text-slate-950 dark:text-white">
        Laporan bulan ini masih kosong
      </h3>
      <p className="relative mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-300">
        Tambahkan transaksi agar CUANSYNC bisa menampilkan uang masuk, uang keluar, kategori, dan ringkasan bulanan.
      </p>
      <button
        type="button"
        onClick=${() => onNavigate("add")}
        className="relative mt-5 min-h-12 rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_44px_rgba(16,185,129,0.22)] transition hover:-translate-y-0.5 hover:bg-brand-700 dark:bg-emerald-500"
      >
        Tambah transaksi
      </button>
    </section>
  `;
}

export function MonthlyReportPage({
  transactions,
  budgets,
  selectedMonthKey,
  baseCurrency = DEFAULT_BASE_CURRENCY,
  onMonthChange,
  onNavigate,
}) {
  const months = useMemo(
    () => getAvailableReportMonths(transactions, selectedMonthKey),
    [transactions, selectedMonthKey],
  );
  const report = useMemo(
    () => buildMonthlyReport(transactions, budgets, selectedMonthKey, baseCurrency),
    [transactions, budgets, selectedMonthKey, baseCurrency],
  );

  return html`
    <div className="grid gap-4">
      <section className="grid gap-3 md:grid-cols-[1fr_minmax(18rem,24rem)] md:items-end">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Laporan bulanan
          </p>
          <h2 className="mt-2 font-display text-2xl font-black text-slate-950 dark:text-white md:text-3xl">
            Ringkasan Bulan Ini
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Lihat uang masuk, uang keluar, anggaran, dan transaksi penting dalam satu tempat.
          </p>
        </div>
        <${ReportMonthPicker}
          months=${months}
          value=${selectedMonthKey}
          onChange=${onMonthChange}
        />
      </section>

      ${report.hasTransactions
        ? html`
            <${MonthlyReportHero} report=${report} />
            <${MonthlyReportKpis} report=${report} />
            <${MonthlyCurrencySummary} report=${report} />
            <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
              <${MonthlyBudgetPulse} report=${report} />
              <${MonthlyCategoryBreakdown} report=${report} />
            </div>
            <${MonthlyReportInsights} report=${report} />
            <${MonthlyReportCharts} report=${report} />
            <${MonthlyReportRecent} report=${report} onNavigate=${onNavigate} />
          `
        : html`<${MonthlyReportEmptyState} onNavigate=${onNavigate} />`}
    </div>
  `;
}

