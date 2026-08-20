import React from "react";
import htm from "htm";
import { getTransactionFlow } from "../../domain/transactions.js";
import { formatShortTime } from "../../lib/dates.js";
import {
  getTransactionCategoryLabel,
  getTransactionCompactAmount,
  getTransactionDisplayTitle,
  getTransactionIconLabel,
  getTransactionTone,
} from "./presentation.js";

const html = htm.bind(React.createElement);
const PREMIUM_PANEL_SOFT =
  "relative overflow-hidden rounded-[26px] cuan-card-soft";

function RecentTransactionPreviewRow({ transaction, fallbackRate = 0 }) {
  const tone = getTransactionTone(transaction);
  const compactAmount = getTransactionCompactAmount(transaction, fallbackRate);
  const title = getTransactionDisplayTitle(transaction);
  const categoryLabel = getTransactionCategoryLabel(transaction);
  const flow = getTransactionFlow(transaction);

  return html`
    <div className="grid min-h-[58px] grid-cols-[38px_1fr_auto] items-center gap-3 rounded-2xl border border-slate-200/65 bg-white/55 px-3 py-2.5 dark:border-white/10 dark:bg-slate-950/32">
      <span
        className=${`flex h-9 w-9 items-center justify-center rounded-2xl text-[10px] font-black uppercase leading-none ring-1 ${tone.historyIcon}`}
      >
        ${getTransactionIconLabel(transaction)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-black text-slate-950 dark:text-white">
          ${title}
        </span>
        <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          <span className="truncate">
            ${flow === "exchange" ? "Exchange" : categoryLabel}
          </span>
          <span>${formatShortTime(transaction.occurred_at)}</span>
        </span>
      </span>
      <span className="min-w-0 text-right">
        <span
          className=${`block max-w-[7.5rem] truncate text-sm font-black ${tone.amount}`}
        >
          ${compactAmount.primary}
        </span>
        <span className="mt-0.5 block max-w-[7.5rem] truncate text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
          ${compactAmount.secondary}
        </span>
      </span>
    </div>
  `;
}

export function RecentTransactionsPreview({
  transactions = [],
  fallbackRate = 0,
  onOpenHistory,
}) {
  const previewTransactions = transactions.slice(0, 5);

  return html`
    <section className=${`${PREMIUM_PANEL_SOFT} hidden p-5 lg:block`}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.10),transparent_55%)] opacity-80"></div>
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold text-slate-950 dark:text-white">
            Transaksi Terbaru
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300/80">
            Aktivitas hari ini, dibuat ringkas.
          </p>
        </div>
        <button
          type="button"
          onClick=${onOpenHistory}
          className="cuan-secondary min-h-10 rounded-2xl px-3 py-2 text-xs font-black"
        >
          Riwayat
        </button>
      </div>

      <div className="relative mt-4 grid gap-2.5">
        ${previewTransactions.length
          ? previewTransactions.map(
              (transaction) => html`
                <${RecentTransactionPreviewRow}
                  key=${transaction.id}
                  transaction=${transaction}
                  fallbackRate=${fallbackRate}
                />
              `,
            )
          : html`
              <div className="rounded-2xl border border-dashed border-slate-300/70 bg-white/40 px-4 py-5 text-center text-sm font-semibold text-slate-600 dark:border-white/10 dark:bg-slate-950/24 dark:text-slate-300">
                Belum ada transaksi hari ini.
              </div>
            `}
      </div>
    </section>
  `;
}
