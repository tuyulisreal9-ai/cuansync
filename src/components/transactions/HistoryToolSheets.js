import React from "https://esm.sh/react@18.3.1";
import htm from "https://esm.sh/htm@3.1.1";
import { getAssetAccountDisplayName } from "../../domain/assets.js";
import { SheetShell } from "../shared/SheetShell.js";
import { TransactionFilter } from "./HistoryListParts.js";

const html = htm.bind(React.createElement);
const INPUT_CLASS =
  "cuan-input min-h-11 w-full rounded-xl px-3 py-2.5 text-sm transition";

export function HistoryFilterSheet({
  open,
  filters,
  onChange,
  onReset,
  onClose,
  categoryOptions,
  currencyOptions,
}) {
  return html`
    <${SheetShell}
      open=${open}
      title="Penyaring transaksi"
      helper="Persempit riwayat berdasarkan periode, kategori, mata uang, atau nominal."
      onClose=${onClose}
      labelledBy="history-filter-sheet-title"
    >
      <${TransactionFilter}
        filters=${filters}
        onChange=${onChange}
        onReset=${onReset}
        categoryOptions=${categoryOptions}
        currencyOptions=${currencyOptions}
        showSearch=${false}
        onDone=${onClose}
      />
    <//>
  `;
}

export function StatementExportSheet({
  open,
  monthKey,
  onMonthChange,
  accountId,
  onAccountChange,
  accounts = [],
  transactionCount = 0,
  onDownload,
  onClose,
}) {
  return html`
    <${SheetShell}
      open=${open}
      title="Unduh mutasi"
      helper="Pilih periode dan dompet yang ingin dimasukkan ke file."
      onClose=${onClose}
      labelledBy="history-export-sheet-title"
    >
      <div className="grid gap-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-200">
            Bulan dan tahun
          </span>
          <input
            type="month"
            value=${monthKey}
            onChange=${(event) => onMonthChange(event.target.value)}
            className=${INPUT_CLASS}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-200">
            Dompet atau akun
          </span>
          <select
            value=${accountId}
            onChange=${(event) => onAccountChange(event.target.value)}
            className=${INPUT_CLASS}
          >
            <option value="all">Semua dompet dan akun</option>
            ${accounts.map(
              (account) => html`
                <option key=${account.id} value=${account.id}>
                  ${getAssetAccountDisplayName(account)}
                </option>
              `,
            )}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-200">
            Format file
          </span>
          <select value="csv" disabled className=${`${INPUT_CLASS} opacity-80`}>
            <option value="csv">CSV</option>
          </select>
        </label>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-slate-50/70 px-3 py-2.5 text-xs dark:border-white/10 dark:bg-white/[0.04]">
          <span className="font-semibold text-slate-600 dark:text-slate-300">
            Data siap diunduh
          </span>
          <span className="font-black text-slate-950 dark:text-white">
            ${transactionCount} transaksi
          </span>
        </div>

        <button
          type="button"
          onClick=${onDownload}
          disabled=${!monthKey || transactionCount === 0}
          className="history-action-primary min-h-11 rounded-xl px-4 py-2.5 text-sm font-black disabled:cursor-not-allowed disabled:opacity-45"
        >
          Unduh mutasi
        </button>
      </div>
    <//>
  `;
}
