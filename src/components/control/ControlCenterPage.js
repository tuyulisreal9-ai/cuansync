import React from "react";
import htm from "htm";
import { ArrowLeft } from "lucide-react";
import { CONTROL_MUTED } from "./ControlPrimitives.js";
import { ControlPillars } from "./ControlPillars.js";
import {
  BudgetOverview,
  ConcernList,
  ControlCoachCard,
  Exposure,
  SafeToSpendCard,
} from "./ControlSummarySections.js";

const html = htm.bind(React.createElement);

/* Skor dan statusnya sudah dihitung buildScoring() di domain/control.js —
   panel ini hanya menampilkannya, tidak menghitung ulang apa pun. Ketika ada
   pilar yang datanya belum lengkap, buildScoring mengembalikan score null dan
   panel jujur menyatakan skor belum bisa dinilai. */
function ScorePanel({ scoring }) {
  const score = scoring?.score;
  const hasScore = Number.isFinite(score);
  const ratio = hasScore ? Math.min(Math.max(score / 100, 0), 1) : 0;
  const pending = (scoring?.pillars || []).filter((pillar) => !pillar.evaluable);

  return html`
    <section className="dc-panel flex flex-col gap-[18px] p-[22px]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-[7px]">
          <span className="text-[13px] text-[#9c968b]">Skor keuanganmu</span>
          <div className="flex items-end gap-[7px]">
            <span className="dc-num text-[36px] leading-none tracking-[-1.6px]">
              ${hasScore ? score : "—"}
            </span>
            <span className="pb-[5px] text-[13px] text-[#9c968b]">dari 100</span>
          </div>
        </div>
        <span
          className="shrink-0 whitespace-nowrap rounded-full px-[11px] py-[7px] text-[11.5px] font-bold"
          style=${{
            background: "rgba(250,247,241,0.1)",
            color: hasScore ? "var(--cs-pos)" : "#9c968b",
          }}
        >
          ${scoring?.status || "Belum cukup data"}
        </span>
      </div>
      <div
        className="h-2.5 overflow-hidden rounded-full"
        style=${{ background: "rgba(250,247,241,0.14)" }}
      >
        <div
          className="h-full rounded-full"
          style=${{ width: `${ratio * 100}%`, background: "var(--cs-acc)" }}
        ></div>
      </div>
      <span className="text-[12.5px] leading-[1.5] text-[#9c968b]">
        ${hasScore
          ? `Kelengkapan data ${scoring.completeness}%. Skor dihitung dari anggaran, arus kas, daya tahan dana, dan tagihan rutin.`
          : `Skor belum bisa dinilai karena ${pending
              .map((pillar) => pillar.label)
              .join(", ") || "sebagian data"} belum lengkap.`}
      </span>
    </section>
  `;
}

export function ControlCenterPage({
  summary,
  visible = true,
  onNavigate,
  onOpenBudget,
  onAddIncome,
}) {
  return html`
    <div className="mx-auto grid w-full max-w-md gap-3 pb-[calc(7rem+env(safe-area-inset-bottom))] lg:pb-6">
      <${ScorePanel} scoring=${summary.scoring} />

      <${ControlCoachCard}
        summary=${summary}
        onNavigate=${onNavigate}
        onOpenBudget=${onOpenBudget}
        onAddIncome=${onAddIncome}
      />
      ${summary.safeToSpend.available
        ? html`
            <${SafeToSpendCard}
              summary=${summary}
              visible=${visible}
            />
          `
        : null}
      <${ControlPillars}
        summary=${summary}
        visible=${visible}
        onOpenBudget=${onOpenBudget}
        onNavigate=${onNavigate}
        onAddIncome=${onAddIncome}
      />
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
      <${Exposure} summary=${summary} />
    </div>
  `;
}
