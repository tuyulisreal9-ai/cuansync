import React, { useState } from "https://esm.sh/react@18.3.1";
import htm from "https://esm.sh/htm@3.1.1";
import {
  ChevronDown,
  CircleDollarSign,
  ReceiptText,
  Repeat2,
  ShieldCheck,
  WalletCards,
} from "https://esm.sh/lucide-react@0.468.0?deps=react@18.3.1";
import { formatControlMoney } from "../../domain/control.js";
import {
  CONTROL_MUTED,
  CONTROL_PANEL,
  ControlStatusDot,
  ControlSummaryLine,
} from "./ControlPrimitives.js";

const html = htm.bind(React.createElement);

function getPillarTone(pillar) {
  if (!pillar.evaluable) return "muted";
  if (pillar.score >= 80) return "safe";
  if (pillar.score >= 60) return "warning";
  return "danger";
}

function PillarDetails({ pillarKey, summary, visible }) {
  const currency = summary.baseCurrency;

  if (pillarKey === "budget") {
    return html`
      <div className="px-4 pb-3">
        <${ControlSummaryLine}
          label="Batas bulanan"
          value=${formatControlMoney(
            summary.budget.limitAmount,
            currency,
            visible,
          )}
        />
        <${ControlSummaryLine}
          label="Terpakai"
          value=${formatControlMoney(
            summary.budget.spentAmount,
            currency,
            visible,
          )}
        />
        <${ControlSummaryLine}
          label="Kategori bermasalah"
          value=${String(summary.budget.attentionCount)}
        />
      </div>
    `;
  }

  if (pillarKey === "cashFlow") {
    const ratio =
      summary.cashFlow.savingsRatio == null
        ? "Belum tersedia"
        : `${Math.round(summary.cashFlow.savingsRatio * 100)}%`;
    return html`
      <div className="px-4 pb-3">
        <${ControlSummaryLine}
          label="Pemasukan"
          value=${formatControlMoney(
            summary.cashFlow.income,
            currency,
            visible,
          )}
        />
        <${ControlSummaryLine}
          label="Pengeluaran eksternal"
          value=${formatControlMoney(
            summary.cashFlow.externalExpenses,
            currency,
            visible,
          )}
        />
        <${ControlSummaryLine} label="Rasio tabungan" value=${ratio} />
        ${summary.cashFlow.missingValuationCount
          ? html`
              <p className="mt-2 text-[10px] leading-4 text-amber-700 dark:text-amber-300">
                ${summary.cashFlow.missingValuationCount} transaksi belum punya
                nilai historis dalam ${currency}.
              </p>
            `
          : null}
      </div>
    `;
  }

  if (pillarKey === "runway") {
    const months =
      summary.runway.months == null
        ? "Belum tersedia"
        : `${summary.runway.months.toLocaleString("id-ID", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          })} bulan`;
    return html`
      <div className="px-4 pb-3">
        <${ControlSummaryLine}
          label="Dana likuid bebas"
          value=${formatControlMoney(
            summary.runway.freeLiquidFunds,
            currency,
            visible,
          )}
        />
        <${ControlSummaryLine}
          label="Pengeluaran bulanan acuan"
          value=${summary.runway.monthlyBurn == null
            ? "Belum tersedia"
            : formatControlMoney(
                summary.runway.monthlyBurn,
                currency,
                visible,
              )}
        />
        <${ControlSummaryLine} label="Daya tahan" value=${months} />
        <p className=${`mt-2 text-[10px] leading-4 ${CONTROL_MUTED}`}>
          ${summary.runway.burnSource === "three_month_history"
            ? "Menggunakan rata-rata tiga bulan penuh terakhir."
            : summary.runway.burnSource === "budget_fallback"
              ? "Riwayat belum cukup, jadi memakai total anggaran bulan ini."
              : "Riwayat atau anggaran belum cukup untuk menghitung daya tahan."}
        </p>
      </div>
    `;
  }

  return html`
    <div className="px-4 pb-3">
      <${ControlSummaryLine}
        label="Pengeluaran Tagihan"
        value=${formatControlMoney(
          summary.commitments.tagihanSpent,
          currency,
          visible,
        )}
      />
      <${ControlSummaryLine}
        label="Biaya transfer terverifikasi"
        value=${formatControlMoney(
          summary.commitments.verifiedFeeAmount,
          currency,
          visible,
        )}
      />
      <p className="mt-2 text-[10px] leading-4 text-amber-700 dark:text-amber-300">
        Penilaian komitmen rutin dan remittance menunggu jadwal tagihan serta
        penanda transaksi eksternal di database.
      </p>
    </div>
  `;
}

export function ControlPillars({ summary, visible }) {
  const [openKey, setOpenKey] = useState("budget");
  const iconMap = {
    budget: ReceiptText,
    cashFlow: CircleDollarSign,
    runway: ShieldCheck,
    commitments: Repeat2,
  };

  return html`
    <section className=${`${CONTROL_PANEL} overflow-hidden`}>
      <div className="border-b border-slate-200/90 px-4 py-3 dark:border-slate-800">
        <h2 className="text-xs font-black text-slate-950 dark:text-white">
          Rincian kontrol
        </h2>
      </div>
      <div className="divide-y divide-slate-200/90 dark:divide-slate-800">
        ${summary.scoring.pillars.map((pillar) => {
          const Icon = iconMap[pillar.key] || WalletCards;
          const open = openKey === pillar.key;
          return html`
            <div key=${pillar.key}>
              <button
                type="button"
                aria-expanded=${open}
                onClick=${() => setOpenKey(open ? "" : pillar.key)}
                className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-slate-100/75 dark:hover:bg-slate-800/50"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <${Icon} aria-hidden="true" className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <${ControlStatusDot} tone=${getPillarTone(pillar)} />
                    <strong className="truncate text-xs text-slate-950 dark:text-white">
                      ${pillar.label}
                    </strong>
                  </span>
                  <span
                    className=${`mt-0.5 block truncate text-[10px] ${CONTROL_MUTED}`}
                  >
                    ${pillar.metric}
                  </span>
                </span>
                <${ChevronDown}
                  aria-hidden="true"
                  className=${`h-4 w-4 shrink-0 text-slate-400 transition ${
                    open ? "rotate-180" : ""
                  }`}
                />
              </button>
              ${open
                ? html`
                    <${PillarDetails}
                      pillarKey=${pillar.key}
                      summary=${summary}
                      visible=${visible}
                    />
                  `
                : null}
            </div>
          `;
        })}
      </div>
    </section>
  `;
}
