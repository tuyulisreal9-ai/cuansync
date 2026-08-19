import React, { useState } from "react";
import htm from "htm";
import {
  ChevronRight,
  CircleDollarSign,
  ShieldCheck,
  Target,
} from "lucide-react";
import { formatControlMoney } from "../../domain/control.js";
import { SheetShell } from "../shared/SheetShell.js";
import {
  CONTROL_MUTED,
  CONTROL_PANEL,
  ControlSummaryLine,
} from "./ControlPrimitives.js";

const html = htm.bind(React.createElement);

function formatRunwayDuration(months) {
  if (months == null) return "Belum cukup data";
  if (months < 1) {
    const days = Math.max(Math.round(Math.max(months, 0) * 30), 0);
    return days > 0 ? `Sekitar ${days} hari` : "Belum mencukupi";
  }
  return `Sekitar ${months.toLocaleString("id-ID", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} bulan`;
}

function getCashFlowPresentation(cashFlow) {
  if (!cashFlow.evaluable) {
    return {
      tone: "muted",
      status: "Belum cukup data",
      metric: "Tambahkan catatan pemasukan bulan ini",
    };
  }

  const percentage = Math.round(cashFlow.savingsRatio * 100);
  if (cashFlow.netCashFlow < 0) {
    return {
      tone: "danger",
      status: "Perlu diperhatikan",
      metric: "Pengeluaran lebih besar daripada pemasukan",
    };
  }
  if (percentage >= 20) {
    return {
      tone: "safe",
      status: "Aman",
      metric: `${percentage}% pemasukan masih tersisa`,
    };
  }
  return {
    tone: "warning",
    status: "Perlu dijaga",
    metric: `${percentage}% pemasukan masih tersisa`,
  };
}

function getRunwayPresentation(runway) {
  if (!runway.evaluable) {
    return {
      tone: "muted",
      status: "Belum cukup data",
      metric: "Butuh anggaran atau riwayat pengeluaran",
    };
  }
  if (runway.months >= 3) {
    return {
      tone: "safe",
      status: "Aman",
      metric: formatRunwayDuration(runway.months),
    };
  }
  if (runway.months >= 1) {
    return {
      tone: "warning",
      status: "Perlu dijaga",
      metric: formatRunwayDuration(runway.months),
    };
  }
  return {
    tone: "danger",
    status: "Terbatas",
    metric: formatRunwayDuration(runway.months),
  };
}

function getGoalPresentation(goal) {
  if (!goal.available) {
    return {
      tone: "muted",
      status: "Belum diatur",
      metric: "Belum ada target keuangan",
    };
  }
  const percentage = Math.round(goal.progress * 100);
  return {
    tone: percentage >= 100 ? "safe" : "progress",
    status: goal.status,
    metric: `${goal.name} - ${percentage}%`,
  };
}

function getToneClasses(tone) {
  const classes = {
    safe:
      "border-emerald-400/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    warning:
      "border-amber-400/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    danger:
      "border-rose-400/25 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    progress:
      "border-cyan-400/25 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
    muted:
      "border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
  };
  return classes[tone] || classes.muted;
}

function ConditionRow({ icon: Icon, title, presentation, onClick }) {
  return html`
    <button
      type="button"
      onClick=${onClick}
      className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-100/75 dark:hover:bg-slate-800/50"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        <${Icon} aria-hidden="true" className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <strong className="text-xs text-slate-950 dark:text-white">
            ${title}
          </strong>
          <span className=${`rounded-md border px-1.5 py-0.5 text-[9px] font-extrabold ${getToneClasses(presentation.tone)}`}>
            ${presentation.status}
          </span>
        </span>
        <span className=${`mt-1 block truncate text-[10px] ${CONTROL_MUTED}`}>
          ${presentation.metric}
        </span>
      </span>
      <${ChevronRight}
        aria-hidden="true"
        className="h-4 w-4 shrink-0 text-slate-400"
      />
    </button>
  `;
}

function CashFlowDetails({ summary, visible }) {
  const { cashFlow, baseCurrency } = summary;
  const ratio =
    cashFlow.savingsRatio == null
      ? "Belum tersedia"
      : `${Math.round(cashFlow.savingsRatio * 100)}%`;

  return html`
    <div className="divide-y divide-slate-200/90 dark:divide-slate-800">
      <${ControlSummaryLine}
        label="Pemasukan"
        value=${formatControlMoney(cashFlow.income, baseCurrency, visible)}
      />
      <${ControlSummaryLine}
        label="Pengeluaran"
        value=${formatControlMoney(
          cashFlow.externalExpenses,
          baseCurrency,
          visible,
        )}
      />
      <${ControlSummaryLine}
        label="Sisa bulan ini"
        value=${formatControlMoney(cashFlow.netCashFlow, baseCurrency, visible)}
        tone=${cashFlow.netCashFlow < 0 ? "text-rose-500" : "text-emerald-600 dark:text-emerald-300"}
      />
      <${ControlSummaryLine} label="Porsi yang tersisa" value=${ratio} />
      ${cashFlow.feeExpenses > 0
        ? html`
            <${ControlSummaryLine}
              label="Biaya transfer bulan ini"
              value=${formatControlMoney(
                cashFlow.feeExpenses,
                baseCurrency,
                visible,
              )}
            />
          `
        : null}
      <p className=${`pt-3 text-[11px] leading-5 ${CONTROL_MUTED}`}>
        Transfer antar-dompet dan pokok tukar valas tidak dihitung sebagai
        pemasukan atau pengeluaran.
      </p>
      ${cashFlow.missingValuationCount
        ? html`
            <p className="pt-3 text-[11px] leading-5 text-amber-700 dark:text-amber-300">
              ${cashFlow.missingValuationCount} transaksi belum dapat dihitung
              dalam ${baseCurrency}.
            </p>
          `
        : null}
    </div>
  `;
}

function RunwayDetails({ summary, visible }) {
  const { runway, baseCurrency } = summary;
  const sourceNote =
    runway.burnSource === "three_month_history"
      ? "Perkiraan memakai rata-rata pengeluaran tiga bulan penuh terakhir."
      : runway.burnSource === "budget_fallback"
        ? "Riwayat belum cukup, jadi perkiraan memakai anggaran bulan ini."
        : "Tambahkan anggaran atau riwayat pengeluaran agar perkiraan dapat dihitung.";

  return html`
    <div className="divide-y divide-slate-200/90 dark:divide-slate-800">
      <${ControlSummaryLine}
        label="Dana tersedia"
        value=${formatControlMoney(
          runway.freeLiquidFunds,
          baseCurrency,
          visible,
        )}
      />
      <${ControlSummaryLine}
        label="Acuan pengeluaran bulanan"
        value=${runway.monthlyBurn == null
          ? "Belum tersedia"
          : formatControlMoney(runway.monthlyBurn, baseCurrency, visible)}
      />
      <${ControlSummaryLine}
        label="Perkiraan daya tahan"
        value=${formatRunwayDuration(runway.months)}
      />
      <p className=${`pt-3 text-[11px] leading-5 ${CONTROL_MUTED}`}>
        ${sourceNote}
      </p>
    </div>
  `;
}

function GoalDetails({ summary, visible, onOpenBudget }) {
  const goal = summary.goal;
  if (!goal.available) {
    return html`
      <div className="py-2 text-center">
        <p className="text-sm font-extrabold text-slate-950 dark:text-white">
          Belum ada target keuangan
        </p>
        <p className=${`mx-auto mt-1 max-w-xs text-[11px] leading-5 ${CONTROL_MUTED}`}>
          Buat target untuk dana darurat, rencana pulang, atau kebutuhan besar
          lainnya.
        </p>
        <button
          type="button"
          onClick=${() => onOpenBudget(null)}
          className="mt-4 min-h-10 rounded-lg bg-emerald-500 px-4 text-xs font-black text-white transition hover:bg-emerald-400"
        >
          Buka anggaran dan target
        </button>
      </div>
    `;
  }

  return html`
    <div className="divide-y divide-slate-200/90 dark:divide-slate-800">
      <${ControlSummaryLine} label="Target" value=${goal.name} />
      <${ControlSummaryLine}
        label="Nominal tujuan"
        value=${formatControlMoney(
          goal.targetAmount,
          goal.currency,
          visible,
        )}
      />
      <${ControlSummaryLine}
        label="Terkumpul"
        value=${formatControlMoney(
          goal.savedAmount,
          goal.currency,
          visible,
        )}
        tone="text-emerald-600 dark:text-emerald-300"
      />
      <${ControlSummaryLine}
        label="Masih dibutuhkan"
        value=${formatControlMoney(
          goal.remainingAmount,
          goal.currency,
          visible,
        )}
      />
      <div className="pt-3">
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-emerald-400"
            style=${{ width: `${Math.round(goal.progress * 100)}%` }}
          ></div>
        </div>
        <p className=${`mt-2 text-[11px] ${CONTROL_MUTED}`}>
          ${Math.round(goal.progress * 100)}% dari target sudah terkumpul.
        </p>
      </div>
    </div>
  `;
}

function ConditionDetails({ selectedKey, summary, visible, onOpenBudget }) {
  if (selectedKey === "cashFlow") {
    return html`<${CashFlowDetails} summary=${summary} visible=${visible} />`;
  }
  if (selectedKey === "runway") {
    return html`<${RunwayDetails} summary=${summary} visible=${visible} />`;
  }
  return html`
    <${GoalDetails}
      summary=${summary}
      visible=${visible}
      onOpenBudget=${onOpenBudget}
    />
  `;
}

export function ControlPillars({ summary, visible, onOpenBudget }) {
  const [selectedKey, setSelectedKey] = useState(null);
  const cashFlow = getCashFlowPresentation(summary.cashFlow);
  const runway = getRunwayPresentation(summary.runway);
  const goal = getGoalPresentation(summary.goal);
  const sheetTitles = {
    cashFlow: "Arus kas bulan ini",
    runway: "Dana cadangan",
    goal: "Target keuangan",
  };

  return html`
    <section className=${`${CONTROL_PANEL} overflow-hidden`}>
      <div className="border-b border-slate-200/90 px-4 py-3 dark:border-slate-800">
        <h2 className="text-xs font-black text-slate-950 dark:text-white">
          Kondisi keuangan
        </h2>
      </div>
      <div className="divide-y divide-slate-200/90 dark:divide-slate-800">
        <${ConditionRow}
          icon=${CircleDollarSign}
          title="Arus kas"
          presentation=${cashFlow}
          onClick=${() => setSelectedKey("cashFlow")}
        />
        <${ConditionRow}
          icon=${ShieldCheck}
          title="Dana cadangan"
          presentation=${runway}
          onClick=${() => setSelectedKey("runway")}
        />
        <${ConditionRow}
          icon=${Target}
          title="Target keuangan"
          presentation=${goal}
          onClick=${() => setSelectedKey("goal")}
        />
      </div>
    </section>

    <${SheetShell}
      open=${Boolean(selectedKey)}
      title=${sheetTitles[selectedKey] || "Kondisi keuangan"}
      helper="Lihat angka utama dan cara perhitungannya."
      onClose=${() => setSelectedKey(null)}
      labelledBy="control-condition-title"
    >
      <${ConditionDetails}
        selectedKey=${selectedKey}
        summary=${summary}
        visible=${visible}
        onOpenBudget=${onOpenBudget}
      />
    </${SheetShell}>
  `;
}
