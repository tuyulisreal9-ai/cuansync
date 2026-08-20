import React, { useState } from "react";
import htm from "htm";
import {
  ArrowRight,
  ChevronDown,
  CircleDollarSign,
  ShieldCheck,
  Target,
} from "lucide-react";
import { formatControlMoney } from "../../domain/control.js";
import {
  CONTROL_MUTED,
  ControlSummaryLine,
} from "./ControlPrimitives.js";

const html = htm.bind(React.createElement);

function clampPercentage(value) {
  return Math.min(Math.max(Number(value) || 0, 0), 100);
}

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
      metric: "Belum terbaca",
      progress: 0,
      nudge: "Catat minimal satu pemasukan dan pengeluaran bulan ini.",
    };
  }

  const percentage = Math.round(cashFlow.savingsRatio * 100);
  if (cashFlow.netCashFlow < 0) {
    return {
      tone: "danger",
      status: "Perlu diperhatikan",
      metric: `${Math.abs(percentage)}% defisit`,
      progress: 100,
      nudge: "Cari satu pengeluaran yang dapat ditunda atau dikurangi.",
    };
  }
  if (percentage >= 20) {
    return {
      tone: "safe",
      status: "Terkendali",
      metric: `${percentage}% tersisa`,
      progress: clampPercentage(percentage),
      nudge: "Pertahankan ritme dan arahkan sebagian sisa ke targetmu.",
    };
  }
  return {
    tone: "warning",
    status: "Perlu dijaga",
    metric: `${percentage}% tersisa`,
    progress: clampPercentage(percentage),
    nudge: "Ruang bulan ini menipis; prioritaskan kebutuhan utama.",
  };
}

function getRunwayPresentation(runway) {
  if (!runway.evaluable) {
    return {
      tone: "muted",
      status: "Belum cukup data",
      metric: "Belum terbaca",
      progress: 0,
      nudge: "Tambahkan anggaran atau riwayat pengeluaran untuk membuat perkiraan.",
    };
  }
  if (runway.months >= 3) {
    return {
      tone: "safe",
      status: "Fondasi kuat",
      metric: formatRunwayDuration(runway.months),
      progress: 100,
      nudge: "Tinjau kembali jumlah ini saat kebutuhan hidupmu berubah.",
    };
  }
  if (runway.months >= 1) {
    return {
      tone: "warning",
      status: "Sedang dibangun",
      metric: formatRunwayDuration(runway.months),
      progress: clampPercentage((runway.months / 3) * 100),
      nudge: "Gunakan tiga bulan sebagai tonggak awal, lalu sesuaikan dengan kondisimu.",
    };
  }
  return {
    tone: "danger",
    status: "Masih rentan",
    metric: formatRunwayDuration(runway.months),
    progress: clampPercentage((runway.months / 3) * 100),
    nudge: "Mulai kecil dan konsisten; setiap tambahan memperpanjang ruang bernapasmu.",
  };
}

function getGoalPresentation(goal) {
  if (!goal.available) {
    return {
      tone: "progress",
      status: "Belum diatur",
      metric: "Pilih tujuan pertamamu",
      progress: 0,
      nudge: "Mulai dari dana darurat, pendidikan, rencana pulang, atau kebutuhan besar lain.",
    };
  }
  const percentage = Math.round(goal.progress * 100);
  return {
    tone: percentage >= 100 ? "safe" : "progress",
    status: goal.status,
    metric: `${percentage}% tercapai`,
    progress: percentage,
    nudge:
      percentage >= 100
        ? "Target ini tercapai. Rayakan progres lalu tentukan prioritas berikutnya."
        : `${goal.name} sedang bergerak—jaga setoran kecil tetap konsisten.`,
  };
}

function getToneClasses(tone) {
  const classes = {
    safe: {
      icon: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
      badge:
        "border-emerald-400/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      bar: "bg-emerald-400",
      wash: "from-emerald-500/10",
    },
    warning: {
      icon: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
      badge:
        "border-amber-400/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      bar: "bg-amber-400",
      wash: "from-amber-500/10",
    },
    danger: {
      icon: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
      badge:
        "border-rose-400/25 bg-rose-500/10 text-rose-700 dark:text-rose-300",
      bar: "bg-rose-400",
      wash: "from-rose-500/10",
    },
    progress: {
      icon: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-300",
      badge:
        "border-cyan-400/25 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
      bar: "bg-cyan-400",
      wash: "from-cyan-500/10",
    },
    muted: {
      icon: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
      badge:
        "border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
      bar: "bg-slate-400",
      wash: "from-slate-500/5",
    },
  };
  return classes[tone] || classes.muted;
}

function FoundationCard({
  cardKey,
  icon: Icon,
  title,
  benefit,
  presentation,
  actionLabel,
  onAction,
  expanded,
  onToggle,
  children,
}) {
  const tone = getToneClasses(presentation.tone);

  return html`
    <article className=${`overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-br ${tone.wash} via-white to-white shadow-sm dark:border-slate-800 dark:via-slate-900 dark:to-slate-900 dark:shadow-none`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className=${`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tone.icon}`}>
              <${Icon} aria-hidden="true" className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-slate-950 dark:text-white">
                ${title}
              </h3>
              <span className=${`mt-1 inline-flex rounded-md border px-1.5 py-0.5 text-[9px] font-extrabold ${tone.badge}`}>
                ${presentation.status}
              </span>
            </div>
          </div>
          <strong className="max-w-[42%] text-right text-sm font-black leading-5 text-slate-950 dark:text-white">
            ${presentation.metric}
          </strong>
        </div>

        <p className=${`mt-3 text-[11px] leading-5 ${CONTROL_MUTED}`}>
          ${benefit}
        </p>

        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200/90 dark:bg-slate-800">
          <div
            className=${`h-full rounded-full transition-all duration-500 ${tone.bar}`}
            style=${{ width: `${clampPercentage(presentation.progress)}%` }}
          ></div>
        </div>
        <p className="mt-2 text-[10px] font-semibold leading-4 text-slate-700 dark:text-slate-300">
          ${presentation.nudge}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick=${onAction}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-950 px-3 text-[10px] font-black text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
          >
            ${actionLabel}
            <${ArrowRight} aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-expanded=${expanded}
            aria-controls=${`control-${cardKey}-details`}
            onClick=${onToggle}
            className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-slate-200 px-3 text-[10px] font-black text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            ${expanded ? "Tutup rincian" : "Cara dihitung"}
            <${ChevronDown}
              aria-hidden="true"
              className=${`h-3.5 w-3.5 transition ${expanded ? "rotate-180" : ""}`}
            />
          </button>
        </div>
      </div>

      ${expanded
        ? html`
            <div
              id=${`control-${cardKey}-details`}
              className="border-t border-slate-200/90 bg-white/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/25"
            >
              <p className="mb-2 text-[9px] font-black uppercase tracking-[0.1em] text-slate-500">
                Angka di balik saran
              </p>
              ${children}
            </div>
          `
        : null}
    </article>
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
      <p className=${`pt-3 text-[10px] leading-4 ${CONTROL_MUTED}`}>
        Transfer antar-dompet dan pokok tukar valas tidak dihitung sebagai pemasukan atau pengeluaran.
      </p>
      ${cashFlow.missingValuationCount
        ? html`
            <p className="pt-2 text-[10px] leading-4 text-amber-700 dark:text-amber-300">
              ${cashFlow.missingValuationCount} transaksi belum dapat dihitung dalam ${baseCurrency}.
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
        ? "Riwayat belum cukup, jadi perkiraan sementara memakai anggaran bulan ini."
        : "Tambahkan anggaran atau riwayat pengeluaran agar perkiraan dapat dihitung.";

  return html`
    <div className="divide-y divide-slate-200/90 dark:divide-slate-800">
      <${ControlSummaryLine}
        label="Dana bebas"
        value=${formatControlMoney(
          runway.freeLiquidFunds,
          baseCurrency,
          visible,
        )}
      />
      <${ControlSummaryLine}
        label="Acuan bulanan"
        value=${runway.monthlyBurn == null
          ? "Belum tersedia"
          : formatControlMoney(runway.monthlyBurn, baseCurrency, visible)}
      />
      <${ControlSummaryLine}
        label="Daya tahan"
        value=${formatRunwayDuration(runway.months)}
      />
      <p className=${`pt-3 text-[10px] leading-4 ${CONTROL_MUTED}`}>
        ${sourceNote}
      </p>
    </div>
  `;
}

function GoalDetails({ summary, visible }) {
  const goal = summary.goal;
  if (!goal.available) {
    return html`
      <div>
        <p className="text-xs font-extrabold text-slate-950 dark:text-white">
          Belum ada target keuangan
        </p>
        <p className=${`mt-1 text-[10px] leading-4 ${CONTROL_MUTED}`}>
          Target membantu menghitung berapa yang masih dibutuhkan dan membuat progres tetap terlihat.
        </p>
      </div>
    `;
  }

  return html`
    <div className="divide-y divide-slate-200/90 dark:divide-slate-800">
      <${ControlSummaryLine} label="Target" value=${goal.name} />
      <${ControlSummaryLine}
        label="Nominal tujuan"
        value=${formatControlMoney(goal.targetAmount, goal.currency, visible)}
      />
      <${ControlSummaryLine}
        label="Terkumpul"
        value=${formatControlMoney(goal.savedAmount, goal.currency, visible)}
        tone="text-emerald-600 dark:text-emerald-300"
      />
      <${ControlSummaryLine}
        label="Masih dibutuhkan"
        value=${formatControlMoney(goal.remainingAmount, goal.currency, visible)}
      />
    </div>
  `;
}

export function ControlPillars({
  summary,
  visible,
  onOpenBudget,
  onNavigate,
  onAddIncome,
}) {
  const [expandedKey, setExpandedKey] = useState(null);
  const cashFlow = getCashFlowPresentation(summary.cashFlow);
  const runway = getRunwayPresentation(summary.runway);
  const goal = getGoalPresentation(summary.goal);

  function toggle(key) {
    setExpandedKey((current) => (current === key ? null : key));
  }

  return html`
    <section aria-labelledby="financial-foundations-title">
      <div className="mb-2.5 px-0.5">
        <p className="text-[9px] font-black uppercase tracking-[0.12em] text-emerald-600 dark:text-emerald-300">
          Fondasi finansialmu
        </p>
        <div className="mt-1 flex items-end justify-between gap-3">
          <h2 id="financial-foundations-title" className="text-sm font-black text-slate-950 dark:text-white">
            Bukan hanya angka—ini fungsinya
          </h2>
          <span className=${`shrink-0 text-[9px] ${CONTROL_MUTED}`}>
            Ketuk rincian bila perlu
          </span>
        </div>
      </div>

      <div className="grid gap-3">
        <${FoundationCard}
          cardKey="cash-flow"
          icon=${CircleDollarSign}
          title="Arus kas"
          benefit="Menjawab apakah gaya pengeluaranmu benar-benar didukung oleh pemasukan—bukan sekadar melihat saldo hari ini."
          presentation=${cashFlow}
          actionLabel=${summary.cashFlow.evaluable
            ? "Lihat transaksi"
            : "Catat pemasukan"}
          onAction=${summary.cashFlow.evaluable
            ? () => onNavigate("history")
            : onAddIncome}
          expanded=${expandedKey === "cashFlow"}
          onToggle=${() => toggle("cashFlow")}
        >
          <${CashFlowDetails} summary=${summary} visible=${visible} />
        </${FoundationCard}>

        <${FoundationCard}
          cardKey="runway"
          icon=${ShieldCheck}
          title="Dana cadangan"
          benefit="Mengukur berapa lama kebutuhan utama dapat bertahan jika pemasukan tiba-tiba berhenti atau ada biaya tak terduga."
          presentation=${runway}
          actionLabel="Bangun dana cadangan"
          onAction=${() => onOpenBudget("__goals__")}
          expanded=${expandedKey === "runway"}
          onToggle=${() => toggle("runway")}
        >
          <${RunwayDetails} summary=${summary} visible=${visible} />
        </${FoundationCard}>

        <${FoundationCard}
          cardKey="goal"
          icon=${Target}
          title="Target keuangan"
          benefit="Mengubah keinginan besar menjadi nominal dan progres kecil yang dapat kamu jaga dari bulan ke bulan."
          presentation=${goal}
          actionLabel=${summary.goal.available
            ? "Kelola target"
            : "Buat target pertama"}
          onAction=${() => onOpenBudget("__goals__")}
          expanded=${expandedKey === "goal"}
          onToggle=${() => toggle("goal")}
        >
          <${GoalDetails} summary=${summary} visible=${visible} />
        </${FoundationCard}>
      </div>
    </section>
  `;
}
