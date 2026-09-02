import React, { useEffect, useMemo, useState } from "react";
import htm from "htm";
import {
  DEFAULT_BASE_CURRENCY,
  formatCurrency,
} from "../../lib/currency.js";
import { formatMonthKey, getMonthKey } from "../../lib/dates.js";
import { isNativeMobileApp } from "../../lib/mobile.js";
import {
  exportMonthlyStatementPdf,
} from "../../lib/monthlyStatementPdf.js";
import { getProfileDisplayName } from "../../lib/profile.js";
import {
  buildMonthlyStatement,
  getMonthlyStatementTransactions,
  isValidStatementMonthKey,
} from "../transactions/monthlyStatement.js";
import { FormActionDock } from "../shared/FormActionDock.js";
import { SheetShell } from "../shared/SheetShell.js";

const html = htm.bind(React.createElement);
const INPUT_CLASS =
  "cuan-input min-h-12 w-full rounded-2xl px-4 py-3 text-sm transition";

function StatementSummary({ statement }) {
  const incomplete = !statement.summary.isValuationComplete;
  const items = [
    {
      label: "Transaksi",
      value: String(statement.summary.transactionCount),
      tone: "var(--cs-ink)",
    },
    {
      label: incomplete ? "Masuk tervaluasi" : "Uang masuk",
      value: formatCurrency(statement.summary.income, statement.baseCurrency),
      tone: "var(--cs-pos)",
    },
    {
      label: incomplete ? "Keluar tervaluasi" : "Uang keluar",
      value: formatCurrency(statement.summary.expense, statement.baseCurrency),
      tone: "var(--cs-danger)",
    },
    {
      label: incomplete ? "Bersih tervaluasi" : "Arus bersih",
      value: `${statement.summary.net >= 0 ? "+" : "-"}${formatCurrency(
        Math.abs(statement.summary.net),
        statement.baseCurrency,
      )}`,
      tone:
        statement.summary.net >= 0
          ? "var(--cs-pos)"
          : "var(--cs-danger)",
    },
  ];

  return html`
    <div className="grid grid-cols-2 gap-2">
      ${items.map(
        (item) => html`
          <div
            key=${item.label}
            className="rounded-2xl border px-3 py-3"
            style=${{
              borderColor: "var(--cs-line)",
              background: "var(--cs-soft)",
            }}
          >
            <span
              className="block text-[10px] font-bold uppercase tracking-[0.12em]"
              style=${{ color: "var(--cs-mut)" }}
            >
              ${item.label}
            </span>
            <span
              className="dc-num mt-1.5 block truncate text-sm font-bold"
              style=${{ color: item.tone }}
            >
              ${item.value}
            </span>
          </div>
        `,
      )}
    </div>
  `;
}

export function MonthlyStatementExportSheet({
  open,
  onClose,
  user,
  profile,
  transactions = [],
  assetAccounts = [],
  baseCurrency = DEFAULT_BASE_CURRENCY,
  onLoadTransactions,
}) {
  const [monthKey, setMonthKey] = useState(() => getMonthKey(new Date()));
  const [monthTransactions, setMonthTransactions] = useState([]);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadRevision, setLoadRevision] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!open) return undefined;
    if (!isValidStatementMonthKey(monthKey)) {
      setMonthTransactions([]);
      setLoadingMonth(false);
      setLoadFailed(false);
      setMessage("");
      setErrorMessage("");
      return undefined;
    }
    let active = true;
    setLoadingMonth(true);
    setLoadFailed(false);
    setMessage("");
    setErrorMessage("");

    const fallback = getMonthlyStatementTransactions(transactions, monthKey);
    const hasCompleteLoader = typeof onLoadTransactions === "function";
    Promise.resolve()
      .then(() => (hasCompleteLoader ? onLoadTransactions(monthKey) : fallback))
      .then((rows) => {
        if (!active) return;
        setMonthTransactions(
          getMonthlyStatementTransactions(
            Array.isArray(rows) ? rows : fallback,
            monthKey,
          ),
        );
      })
      .catch((error) => {
        if (!active) return;
        setMonthTransactions(hasCompleteLoader ? [] : fallback);
        setLoadFailed(hasCompleteLoader);
        setErrorMessage(
          hasCompleteLoader
            ? "Riwayat lengkap bulan tersebut belum dapat dimuat. Coba lagi agar PDF tidak kehilangan transaksi."
            : error?.message || "Data bulan tersebut belum dapat dimuat.",
        );
      })
      .finally(() => {
        if (active) setLoadingMonth(false);
      });

    return () => {
      active = false;
    };
  }, [open, monthKey, transactions, loadRevision]);

  const statement = useMemo(
    () =>
      isValidStatementMonthKey(monthKey)
        ? buildMonthlyStatement({
            transactions: monthTransactions,
            assetAccounts,
            monthKey,
            baseCurrency,
            ownerName: getProfileDisplayName(profile, user),
          })
        : null,
    [monthTransactions, assetAccounts, monthKey, baseCurrency, profile, user],
  );
  const hasTransactions = Boolean(statement?.summary.transactionCount > 0);
  const native = isNativeMobileApp();

  async function handleExport() {
    if (!statement || !hasTransactions || loadFailed || loadingMonth || exporting) return;
    setExporting(true);
    setMessage("");
    setErrorMessage("");
    try {
      const result = await exportMonthlyStatementPdf(statement);
      setMessage(
        result.method === "share"
          ? "PDF siap disimpan atau dibagikan."
          : `${result.filename} berhasil diunduh.`,
      );
    } catch (error) {
      setErrorMessage(
        error?.message || "PDF belum berhasil dibuat. Silakan coba lagi.",
      );
    } finally {
      setExporting(false);
    }
  }

  return html`
    <${SheetShell}
      open=${open}
      onClose=${onClose}
      title="Laporan transaksi PDF"
      helper="Pilih satu bulan. CUANSYNC akan menyusun seluruh riwayatnya menjadi laporan yang rapi."
      labelledBy="monthly-statement-export-title"
    >
      <div className="grid gap-4">
        <label className="block">
          <span
            className="mb-2 block text-xs font-bold"
            style=${{ color: "var(--cs-body)" }}
          >
            Bulan laporan
          </span>
          <input
            type="month"
            value=${monthKey}
            max=${getMonthKey(new Date())}
            onChange=${(event) => setMonthKey(event.target.value)}
            className=${INPUT_CLASS}
          />
        </label>

        <div
          className="rounded-[22px] border p-3.5"
          style=${{
            borderColor: "var(--cs-line)",
            background: "var(--cs-card)",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p
                className="truncate text-sm font-bold"
                style=${{ color: "var(--cs-ink)" }}
              >
                ${isValidStatementMonthKey(monthKey)
                  ? formatMonthKey(monthKey)
                  : "Pilih bulan laporan"}
              </p>
              <p
                className="mt-1 text-xs leading-5"
                style=${{ color: "var(--cs-mut)" }}
              >
                ${loadingMonth
                  ? "Mengambil riwayat lengkap..."
                  : hasTransactions
                    ? `${statement.summary.transactionCount} transaksi siap dimasukkan ke PDF.`
                    : "Belum ada transaksi pada bulan ini."}
              </p>
            </div>
            <span
              className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold"
              style=${{
                background: "var(--cs-chip)",
                color: "var(--cs-body)",
              }}
            >
              PDF
            </span>
          </div>

          ${!loadingMonth && hasTransactions
            ? html`
                <div className="mt-3">
                  <${StatementSummary} statement=${statement} />
                </div>
              `
            : null}
        </div>

        <div
          className="rounded-2xl border px-3.5 py-3 text-xs leading-5"
          style=${{
            borderColor: "var(--cs-line)",
            background: "var(--cs-soft)",
            color: "var(--cs-body)",
          }}
        >
          PDF berfokus pada riwayat. Transfer antar-dompet dan pokok tukar
          mata uang tidak dihitung sebagai pemasukan atau pengeluaran; biaya
          transaksi tetap dihitung.
        </div>

        ${statement?.summary.unvaluedCount > 0
          ? html`
              <p
                className="rounded-2xl border px-3.5 py-3 text-xs leading-5"
                style=${{
                  borderColor: "color-mix(in srgb, var(--cs-warn) 35%, var(--cs-line))",
                  background: "color-mix(in srgb, var(--cs-warn) 8%, var(--cs-card))",
                  color: "var(--cs-warn)",
                }}
              >
                ${statement.summary.unvaluedCount} transaksi mata uang asing
                tidak memiliki valuasi historis ${statement.baseCurrency}.
                Nominal aslinya tetap muncul, sedangkan ringkasan hanya
                mencakup transaksi yang dapat dinilai dengan benar.
              </p>
            `
          : null}

        ${message
          ? html`
              <p role="status" className="text-xs font-semibold" style=${{ color: "var(--cs-pos)" }}>
                ${message}
              </p>
            `
          : null}
        ${errorMessage
          ? html`
              <div className="flex items-start justify-between gap-3">
                <p role="alert" className="text-xs font-semibold leading-5" style=${{ color: "var(--cs-danger)" }}>
                  ${errorMessage}
                </p>
                ${loadFailed
                  ? html`
                      <button
                        type="button"
                        onClick=${() => setLoadRevision((value) => value + 1)}
                        className="shrink-0 rounded-xl border px-3 py-2 text-xs font-bold"
                        style=${{
                          borderColor: "var(--cs-line)",
                          color: "var(--cs-body)",
                        }}
                      >
                        Coba lagi
                      </button>
                    `
                  : null}
              </div>
            `
          : null}

        <${FormActionDock}>
          <button
            type="button"
            onClick=${handleExport}
            disabled=${
              loadingMonth ||
              exporting ||
              loadFailed ||
              !isValidStatementMonthKey(monthKey) ||
              !hasTransactions
            }
            className="history-action-primary min-h-12 w-full rounded-xl px-4 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-45"
          >
            ${exporting
              ? "Menyusun PDF..."
              : native
                ? "Buat & bagikan PDF"
                : "Buat & unduh PDF"}
          </button>
        <//>
      </div>
    <//>
  `;
}
