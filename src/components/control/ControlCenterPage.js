import React, { useEffect, useState } from "https://esm.sh/react@18.3.1";
import htm from "https://esm.sh/htm@3.1.1";
import { buildControlCenter } from "../../domain/control.js";
import {
  DEFAULT_BASE_CURRENCY,
  formatCurrency,
  normalizeCurrencyList,
} from "../../lib/currency.js";

const html = htm.bind(React.createElement);
const PANEL_CLASS = "relative overflow-hidden rounded-[30px] cuan-card";
const PANEL_SOFT_CLASS =
  "relative overflow-hidden rounded-[26px] cuan-card-soft";

function ControlMetric({ label, value, helper }) {
  return html`
    <div className="rounded-[22px] border border-slate-200/70 bg-white/58 p-4 dark:border-white/10 dark:bg-slate-900/44">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        ${label}
      </p>
      <p className="mt-2 break-words text-lg font-black text-slate-950 dark:text-white">
        ${value}
      </p>
      <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
        ${helper}
      </p>
    </div>
  `;
}

function ControlCenterHero({
  metrics,
  control,
  currencies = [],
  onCurrencyChange = null,
}) {
  const scoreWidth = `${control.controlScore}%`;
  const showCurrencyPicker = currencies.length > 1 && onCurrencyChange;

  return html`
    <section className=${`${PANEL_CLASS} control-center-card p-5 md:p-6`}>
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand-400/14 blur-3xl"></div>
      <div className="relative grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
            Kontrol
          </p>
          <h2 className="mt-3 font-display text-3xl font-black tracking-[-0.04em] text-slate-950 dark:text-white md:text-4xl">
            ${control.controlLabel}
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Fokus ${control.currency}: saldo, batas, dan ritme bulan ini.
          </p>
          ${showCurrencyPicker
            ? html`
                <div className="cuan-segment mt-4 flex flex-wrap gap-1 rounded-[20px] p-1 md:max-w-xl">
                  ${currencies.map((currency) => {
                    const active = control.currency === currency;
                    return html`
                      <button
                        key=${currency}
                        type="button"
                        onClick=${() => onCurrencyChange(currency)}
                        className=${`min-h-10 flex-1 rounded-2xl px-3 text-xs font-black transition duration-300 ${
                          active
                            ? "bg-brand-600 text-white shadow-[0_14px_34px_rgba(16,185,129,0.22)] dark:bg-emerald-500"
                            : "text-slate-600 hover:bg-white/75 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                        }`}
                      >
                        ${currency}
                      </button>
                    `;
                  })}
                </div>
              `
            : null}
        </div>
        <div className="rounded-[28px] border border-slate-200/70 bg-white/62 p-4 dark:border-white/10 dark:bg-slate-950/40 md:w-52">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Skor Kontrol
          </p>
          <p className=${`mt-2 text-4xl font-black tracking-[-0.05em] ${control.controlTone}`}>
            ${control.controlScore}
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-600 to-emerald-300"
              style=${{ width: scoreWidth }}
            ></div>
          </div>
        </div>
      </div>

      <div className="relative mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <${ControlMetric}
          label="Total aset"
          value=${formatCurrency(metrics.netWorthIdr, "idr")}
          helper="Kurs global"
        />
        <${ControlMetric}
          label=${`Daya tahan ${control.currency}`}
          value=${control.currencyRunwayDays == null
            ? "Stabil"
            : `${Math.max(control.currencyRunwayDays, 0)} hari`}
          helper=${control.currencyDailyAverage > 0
            ? `${formatCurrency(control.currencyDailyAverage, control.currency)}/hari`
            : "Belum ada ritme"}
        />
        <${ControlMetric}
          label="Arus kas"
          value=${formatCurrency(control.projectedNetIdr, "idr")}
          helper="Akhir bulan"
        />
        <${ControlMetric}
          label="Sisa anggaran"
          value=${control.activeBudget
            ? formatCurrency(
                Math.max(control.activeBudget.remainingAmount, 0),
                control.currency,
              )
            : "-"}
          helper=${control.activeBudget
            ? control.activeBudget.statusLabel
            : `Belum ada anggaran ${control.currency}`}
        />
      </div>
    </section>
  `;
}

function ControlPriorityPanel({ alert, action, onNavigate }) {
  const toneClass = {
    emerald:
      "border-brand-300/25 bg-brand-500/10 text-brand-800 dark:border-brand-300/20 dark:text-brand-200",
    amber:
      "border-amber-300/30 bg-amber-400/10 text-amber-800 dark:border-amber-300/20 dark:text-amber-200",
    rose:
      "border-rose-300/30 bg-rose-400/10 text-rose-800 dark:border-rose-300/20 dark:text-rose-200",
  };

  function handleAction() {
    if (!action) return;
    onNavigate(action.target === "control-budget" ? "budget" : action.target);
  }

  return html`
    <section className="grid gap-3 md:grid-cols-2">
      <div className=${`rounded-[24px] border p-4 ${toneClass[alert?.tone] || toneClass.emerald}`}>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-75">
          Prioritas
        </p>
        <p className="mt-2 font-black">${alert?.title || "Aman"}</p>
        <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300">
          ${alert?.body || "Tidak ada risiko besar saat ini."}
        </p>
      </div>

      <button
        type="button"
        onClick=${handleAction}
        className="rounded-[24px] border border-slate-200/70 bg-white/58 p-4 text-left transition hover:-translate-y-0.5 hover:bg-white/82 dark:border-white/10 dark:bg-slate-900/44 dark:hover:bg-slate-900/70"
      >
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
          Aksi
        </p>
        <p className="mt-2 font-black text-slate-950 dark:text-white">
          ${action?.title || "Catat transaksi"}
        </p>
        <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300">
          ${action?.body || "Jaga data tetap akurat."}
        </p>
      </button>
    </section>
  `;
}

function ControlBudgetSummary({ metrics, selectedCurrency, onOpenBudget }) {
  const selectedBudgets = metrics.budgetInsights.filter(
    (item) => item.currency === selectedCurrency,
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
  const overCount = selectedBudgets.filter(
    (item) => item.status === "over",
  ).length;

  return html`
    <section className=${`${PANEL_SOFT_CLASS} p-5 md:p-6`}>
      <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
            Anggaran
          </p>
          <h3 className="mt-2 font-display text-xl font-black text-slate-950 dark:text-white">
            Anggaran bulan ini
          </h3>
          <p className="mt-1 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300/80">
            Pantau batas kategori tanpa memenuhi halaman Kontrol.
          </p>
        </div>
        <button
          type="button"
          onClick=${() => onOpenBudget("budget")}
          className="history-action-primary min-h-12 rounded-2xl px-5 py-3 text-sm font-black"
        >
          Atur anggaran
        </button>
      </div>

      <div className="relative mt-4 grid grid-cols-3 gap-2">
        <${ControlMetric}
          label="Target"
          value=${targetTotal > 0
            ? formatCurrency(targetTotal, selectedCurrency)
            : "-"}
          helper=${selectedBudgets.length
            ? `${selectedBudgets.length} kategori`
            : "Belum diatur"}
        />
        <${ControlMetric}
          label="Terpakai"
          value=${spentTotal > 0
            ? formatCurrency(spentTotal, selectedCurrency)
            : "-"}
          helper="Bulan ini"
        />
        <${ControlMetric}
          label=${remainingTotal < 0 ? "Lewat" : "Sisa"}
          value=${targetTotal > 0
            ? formatCurrency(Math.abs(remainingTotal), selectedCurrency)
            : "-"}
          helper=${overCount ? `${overCount} kategori lewat` : "Aman"}
        />
      </div>
    </section>
  `;
}

function ControlCenterEmptyState({ onNavigate }) {
  return html`
    <section className=${`${PANEL_CLASS} p-6 text-center md:p-8`}>
      <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-brand-300/25 bg-brand-500/12 text-2xl font-black text-brand-700 dark:text-brand-200">
        +
      </div>
      <h3 className="relative mt-4 font-display text-2xl font-bold text-slate-950 dark:text-white">
        Kontrol siap dipakai
      </h3>
      <p className="relative mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-300">
        Tambahkan transaksi pertama agar CUANSYNC bisa membaca ritme harian.
      </p>
      <button
        type="button"
        onClick=${() => onNavigate("add")}
        className="history-action-primary relative mt-5 min-h-12 rounded-2xl px-5 py-3 text-sm font-semibold"
      >
        Tambah transaksi pertama
      </button>
    </section>
  `;
}

export function ControlCenterPage({
  metrics,
  transactions,
  activeCurrencies = metrics.activeCurrencies,
  baseCurrency = DEFAULT_BASE_CURRENCY,
  onNavigate,
}) {
  const normalizedCurrencies = normalizeCurrencyList(activeCurrencies, {
    baseCurrency,
  });
  const [selectedCurrency, setSelectedCurrency] = useState(
    normalizedCurrencies[0],
  );

  useEffect(() => {
    if (!normalizedCurrencies.includes(selectedCurrency)) {
      setSelectedCurrency(normalizedCurrencies[0]);
    }
  }, [normalizedCurrencies.join("|"), selectedCurrency]);

  const control = buildControlCenter(metrics, selectedCurrency);

  if (!transactions.length) {
    return html`
      <div className="grid gap-4">
        <${ControlCenterEmptyState} onNavigate=${onNavigate} />
        <${ControlBudgetSummary}
          metrics=${metrics}
          selectedCurrency=${control.currency}
          onOpenBudget=${onNavigate}
        />
      </div>
    `;
  }

  return html`
    <div className="grid gap-4">
      <${ControlCenterHero}
        metrics=${metrics}
        control=${control}
        currencies=${normalizedCurrencies}
        onCurrencyChange=${setSelectedCurrency}
      />
      <${ControlPriorityPanel}
        alert=${control.alerts[0]}
        action=${control.nextActions[0]}
        onNavigate=${onNavigate}
      />
      <${ControlBudgetSummary}
        metrics=${metrics}
        selectedCurrency=${control.currency}
        onOpenBudget=${onNavigate}
      />
    </div>
  `;
}
