import React from "react";
import htm from "htm";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Circle,
  ChevronRight,
  Gauge,
  Landmark,
  Lightbulb,
  Sparkles,
} from "lucide-react";
import {
  buildControlCoach,
  getControlReadiness,
} from "../../domain/controlGuidance.js";
import {
  CONTROL_MUTED,
  CONTROL_PANEL,
  ControlMoney,
  ControlStatusDot,
} from "./ControlPrimitives.js";

const html = htm.bind(React.createElement);

function getCoachTone(tone) {
  const tones = {
    safe: {
      shell:
        "border-emerald-400/25 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.2),transparent_45%),linear-gradient(145deg,rgba(6,78,59,0.96),rgba(6,25,35,0.98))]",
      badge: "bg-emerald-300/20 text-emerald-200",
      icon: "bg-emerald-300 text-emerald-950",
    },
    warning: {
      shell:
        "border-amber-300/25 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.2),transparent_45%),linear-gradient(145deg,rgba(69,38,8,0.96),rgba(8,23,35,0.98))]",
      badge: "bg-amber-300/20 text-amber-200",
      icon: "bg-amber-300 text-amber-950",
    },
    danger: {
      shell:
        "border-rose-300/25 bg-[radial-gradient(circle_at_top_right,rgba(251,113,133,0.2),transparent_45%),linear-gradient(145deg,rgba(76,5,25,0.96),rgba(8,23,35,0.98))]",
      badge: "bg-rose-300/20 text-rose-200",
      icon: "bg-rose-300 text-rose-950",
    },
    progress: {
      shell:
        "border-cyan-300/25 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.22),transparent_45%),linear-gradient(145deg,rgba(8,47,73,0.98),rgba(6,25,35,0.98))]",
      badge: "bg-cyan-300/20 text-cyan-200",
      icon: "bg-cyan-300 text-cyan-950",
    },
  };
  return tones[tone] || tones.progress;
}

export function ControlCoachCard({
  summary,
  onOpenBudget,
  onNavigate,
  onAddIncome,
}) {
  const coach = buildControlCoach(summary);
  const readiness = getControlReadiness(summary);
  const tone = getCoachTone(coach.tone);

  function handleAction() {
    if (coach.actionTarget === "budget") {
      onOpenBudget(coach.categoryKey);
      return;
    }
    if (coach.actionTarget === "goal") {
      onOpenBudget("__goals__");
      return;
    }
    if (coach.actionTarget === "income") {
      onAddIncome();
      return;
    }
    onNavigate(coach.actionTarget || "history");
  }

  return html`
    <section className=${`overflow-hidden rounded-2xl border p-4 text-white shadow-[0_18px_45px_rgba(2,8,23,0.18)] ${tone.shell}`}>
      <div className="flex items-center justify-between gap-3">
        <span className=${`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${tone.badge}`}>
          <${Sparkles} aria-hidden="true" className="h-3 w-3" />
          ${coach.eyebrow}
        </span>
        <span className="text-[10px] font-bold text-white/60">
          ${readiness.readyCount}/${readiness.totalCount} fondasi siap
        </span>
      </div>

      <h2 className="mt-4 max-w-sm text-xl font-black leading-tight">
        ${coach.title}
      </h2>
      <p className="mt-2 text-[11px] leading-5 text-white/70">
        ${coach.body}
      </p>

      <div className="mt-4 grid grid-cols-3 gap-1.5">
        ${readiness.items.map(
          (item) => html`
            <div
              key=${item.key}
              className=${`flex min-w-0 items-center gap-1.5 rounded-lg border px-2 py-2 text-[9px] font-extrabold ${
                item.ready
                  ? "border-white/10 bg-white/10 text-white"
                  : "border-white/10 bg-black/10 text-white/50"
              }`}
            >
              ${item.ready
                ? html`<${Check} aria-hidden="true" className="h-3 w-3 shrink-0" />`
                : html`<${Circle} aria-hidden="true" className="h-2.5 w-2.5 shrink-0" />`}
              <span className="truncate">${item.label}</span>
            </div>
          `,
        )}
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-white/10 bg-black/10 p-3">
        <${Lightbulb}
          aria-hidden="true"
          className="mt-0.5 h-4 w-4 shrink-0 text-amber-200"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-black uppercase tracking-[0.1em] text-white/50">
            Kenapa ini penting
          </p>
          <p className="mt-1 text-[10px] leading-4 text-white/70">
            ${coach.why}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick=${handleAction}
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-black text-slate-950 transition hover:bg-slate-100"
      >
        ${coach.actionLabel}
        <${ArrowRight} aria-hidden="true" className="h-4 w-4" />
      </button>
    </section>
  `;
}

export function SafeToSpendCard({ summary, visible }) {
  const { safeToSpend, baseCurrency } = summary;

  return html`
    <section className="overflow-hidden rounded-xl border border-emerald-400/25 bg-[linear-gradient(135deg,rgba(16,185,129,0.13),rgba(15,23,42,0.02))] p-4 dark:bg-[linear-gradient(135deg,rgba(16,185,129,0.14),rgba(15,23,42,0.72))]">
      <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
            Sisa aman bulan ini
          </p>
          <p className="mt-2 break-words text-2xl font-black leading-none text-slate-950 dark:text-white">
            ${safeToSpend.available
              ? html`
                  <${ControlMoney}
                    value=${safeToSpend.amount}
                    currency=${baseCurrency}
                    visible=${visible}
                  />
                `
              : "Belum dapat dihitung"}
          </p>
      </div>

      <div className="mt-3 flex items-start gap-2 border-t border-emerald-400/15 pt-3">
        <${ControlStatusDot}
          tone=${safeToSpend.available
            ? safeToSpend.amount < 0
              ? "danger"
              : "safe"
            : "muted"}
        />
        <p className="text-[11px] leading-4 text-slate-600 dark:text-slate-300">
          ${safeToSpend.status}. ${safeToSpend.obligationsNote}
        </p>
      </div>
      <p className="mt-2 text-[9px] font-bold uppercase tracking-[0.08em] text-emerald-700/75 dark:text-emerald-300/70">
        Panduan belanja · bukan saldo total
      </p>
    </section>
  `;
}

function getBudgetInsight(budget) {
  if (!budget.available) {
    return "Mulai dari satu kategori penting. Batas yang realistis membantu uangmu bertahan sesuai rencana.";
  }
  if (budget.remainingAmount < 0) {
    return "Batas bulan ini sudah terlewati. Tinjau kategori terbesar sebelum menambah pengeluaran baru.";
  }
  if (budget.spentAmount === 0) {
    return "Anggaranmu sudah siap. Catat pengeluaran agar ritme bulan mulai terbaca—sisa anggaran bukan target untuk dihabiskan.";
  }
  if (budget.usage >= 0.85) {
    return "Ruang belanja mulai sempit. Prioritaskan kebutuhan utama hingga periode berikutnya.";
  }
  return "Ritme pengeluaran masih terkendali. Pertahankan pencatatan agar peringatan muncul sebelum batas terlewati.";
}

export function BudgetOverview({ summary, visible, onOpenBudget }) {
  const { budget, baseCurrency } = summary;
  const progress = Math.min(Math.max(budget.usage * 100, 0), 100);

  return html`
    <section className=${`${CONTROL_PANEL} overflow-hidden`}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-200/90 px-4 py-3 dark:border-slate-800">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
            <${Gauge} aria-hidden="true" className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-black text-slate-950 dark:text-white">
              Anggaran bulan ini
            </h2>
            <p className=${`text-[10px] ${CONTROL_MUTED}`}>
              ${budget.categories.length} kategori dalam ${baseCurrency}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick=${() => onOpenBudget(null)}
          className="min-h-11 shrink-0 rounded-lg px-2.5 text-[10px] font-black text-emerald-700 transition hover:bg-emerald-500/10 dark:text-emerald-300"
        >
          Atur
        </button>
      </div>

      ${budget.available
        ? html`
            <div className="px-4 py-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-[9px] font-bold uppercase text-slate-500">
                    Batas
                  </p>
                  <${ControlMoney}
                    value=${budget.limitAmount}
                    currency=${baseCurrency}
                    visible=${visible}
                    className="mt-1 block text-xs font-black text-slate-950 dark:text-white"
                  />
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase text-slate-500">
                    Terpakai
                  </p>
                  <${ControlMoney}
                    value=${budget.spentAmount}
                    currency=${baseCurrency}
                    visible=${visible}
                    className="mt-1 block text-xs font-black text-slate-950 dark:text-white"
                  />
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase text-slate-500">
                    Sisa
                  </p>
                  <${ControlMoney}
                    value=${budget.remainingAmount}
                    currency=${baseCurrency}
                    visible=${visible}
                    className=${`mt-1 block text-xs font-black ${
                      budget.remainingAmount < 0
                        ? "text-rose-500"
                        : "text-emerald-600 dark:text-emerald-300"
                    }`}
                  />
                </div>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div
                  className=${`h-full rounded-full ${
                    budget.remainingAmount < 0
                      ? "bg-rose-500"
                      : budget.usage >= 0.85
                        ? "bg-amber-400"
                        : "bg-emerald-400"
                  }`}
                  style=${{ width: `${progress}%` }}
                ></div>
              </div>
              <p className=${`mt-3 text-[10px] leading-4 ${CONTROL_MUTED}`}>
                ${getBudgetInsight(budget)}
              </p>
            </div>
          `
        : html`
            <div className="px-4 py-4">
              <p className="text-xs font-black text-slate-950 dark:text-white">
                Beri pengeluaranmu batas yang terasa masuk akal
              </p>
              <p className=${`mt-1.5 text-[10px] leading-4 ${CONTROL_MUTED}`}>
                ${getBudgetInsight(budget)}
              </p>
              <button
                type="button"
                onClick=${() => onOpenBudget(null)}
                className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-emerald-500 px-3 text-[10px] font-black text-white transition hover:bg-emerald-400"
              >
                Buat anggaran
                <${ArrowRight} aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            </div>
          `}
    </section>
  `;
}

export function ConcernList({
  summary,
  visible,
  onOpenBudget,
  onNavigate,
}) {
  const concerns = summary.budget.attentionCategories.slice(0, 2);
  const recommendation = summary.recommendation;
  const generalPriority =
    !concerns.length &&
    ["negative_cash_flow", "low_runway"].includes(recommendation.code)
      ? recommendation
      : null;

  if (!concerns.length && !generalPriority) return null;

  function openGeneralPriority() {
    if (generalPriority.target === "budget") {
      onOpenBudget(generalPriority.categoryKey);
      return;
    }
    onNavigate(generalPriority.target);
  }

  return html`
    <section className=${CONTROL_PANEL}>
      <div className="flex items-center gap-2 px-4 pt-3">
        <${AlertTriangle}
          aria-hidden="true"
          className="h-4 w-4 text-amber-500"
        />
        <h2 className="text-xs font-black text-slate-950 dark:text-white">
          Prioritas bulan ini
        </h2>
      </div>
      <div className="mt-2 divide-y divide-slate-200/90 border-t border-slate-200/90 dark:divide-slate-800 dark:border-slate-800">
        ${concerns.map(
          (category) => html`
            <button
              key=${category.categoryKey}
              type="button"
              onClick=${() => onOpenBudget(category.categoryKey)}
              className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-slate-100/80 dark:hover:bg-slate-800/55"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-black text-slate-950 dark:text-white">
                  ${category.categoryLabel}
                </span>
                <span className="mt-0.5 block text-[10px] text-amber-700 dark:text-amber-300">
                  ${category.statusLabel}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <${ControlMoney}
                  value=${category.remainingAmount}
                  currency=${summary.baseCurrency}
                  visible=${visible}
                  className=${`block text-[11px] font-black ${
                    category.remainingAmount < 0
                      ? "text-rose-500"
                      : "text-slate-700 dark:text-slate-200"
                  }`}
                />
                <span className="text-[9px] text-slate-500">
                  ${Math.round(category.usage * 100)}%
                </span>
              </span>
              <${ChevronRight}
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-slate-400"
              />
            </button>
          `,
        )}
        ${generalPriority
          ? html`
              <button
                type="button"
                onClick=${openGeneralPriority}
                className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-100/80 dark:hover:bg-slate-800/55"
              >
                <span className="min-w-0 flex-1">
                  <strong className="block text-xs text-slate-950 dark:text-white">
                    ${generalPriority.title}
                  </strong>
                  <span className=${`mt-1 block text-[10px] leading-4 ${CONTROL_MUTED}`}>
                    ${generalPriority.body}
                  </span>
                </span>
                <${ChevronRight}
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 text-slate-400"
                />
              </button>
            `
          : null}
      </div>
    </section>
  `;
}

export function Exposure({ summary }) {
  if (!summary.exposure.available) return null;

  return html`
    <section className=${`${CONTROL_PANEL} p-3.5`}>
      <div className="flex items-center gap-2">
        <${Landmark}
          aria-hidden="true"
          className="h-4 w-4 text-cyan-600 dark:text-cyan-300"
        />
        <h2 className="text-xs font-black text-slate-950 dark:text-white">
          Komposisi mata uang
        </h2>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        ${summary.exposure.shares.map(
          (item) => html`
            <span
              key=${item.currency}
              className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-black text-slate-700 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-200"
            >
              ${item.currency} ${Math.round(item.share * 100)}%
            </span>
          `,
        )}
      </div>
      <p className=${`mt-2 text-[10px] leading-4 ${CONTROL_MUTED}`}>
        ${summary.exposure.insight}
      </p>
    </section>
  `;
}
