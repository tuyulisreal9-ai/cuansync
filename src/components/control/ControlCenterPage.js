import React from "react";
import htm from "htm";
import { ArrowLeft } from "lucide-react";
import { CONTROL_MUTED } from "./ControlPrimitives.js";
import { ControlPillars } from "./ControlPillars.js";
import {
  BudgetOverview,
  ConcernList,
  Exposure,
  SafeToSpendCard,
} from "./ControlSummarySections.js";

const html = htm.bind(React.createElement);

export function ControlCenterPage({
  summary,
  visible = true,
  onNavigate,
  onOpenBudget,
}) {
  return html`
    <div className="mx-auto grid w-full max-w-md gap-3 pb-[calc(7rem+env(safe-area-inset-bottom))] lg:pb-6">
      <header className="flex min-h-11 items-center gap-3">
        <button
          type="button"
          onClick=${() => onNavigate("overview")}
          aria-label="Kembali ke Beranda"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <${ArrowLeft} aria-hidden="true" className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <h1 className="text-base font-black text-slate-950 dark:text-white">
            Pusat Kontrol
          </h1>
          <p className=${`text-[10px] ${CONTROL_MUTED}`}>
            ${summary.monthLabel}
          </p>
        </div>
      </header>

      ${summary.safeToSpend.available
        ? html`
            <${SafeToSpendCard}
              summary=${summary}
              visible=${visible}
            />
          `
        : null}
      <${BudgetOverview}
        summary=${summary}
        visible=${visible}
        onOpenBudget=${onOpenBudget}
      />
      <${ConcernList}
        summary=${summary}
        visible=${visible}
        onOpenBudget=${onOpenBudget}
        onNavigate=${onNavigate}
      />
      <${ControlPillars}
        summary=${summary}
        visible=${visible}
        onOpenBudget=${onOpenBudget}
      />
      <${Exposure} summary=${summary} />
    </div>
  `;
}
