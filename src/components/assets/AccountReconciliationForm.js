import React, { useEffect, useMemo, useState } from "react";
import htm from "htm";
import {
  AlertTriangle,
  CheckCircle2,
  History,
  Landmark,
  PenLine,
  Search,
} from "lucide-react";
import { calculateReconciliation } from "../../domain/reconciliations.js";
import {
  getTransactionAccountActivity,
  transactionBelongsToAccount,
} from "../../domain/transactions.js";
import {
  formatNumericInput,
  getCurrencyMeta,
  normalizeNumericInput,
} from "../../lib/currency.js";
import { useMaskedCurrency } from "../../lib/balanceVisibility.js";
import { formatShortDateTime } from "../../lib/dates.js";
import { FormActionDock } from "../shared/FormActionDock.js";

const html = htm.bind(React.createElement);

function readNumber(...values) {
  const value = values.find(
    (candidate) => candidate !== null && candidate !== undefined && candidate !== "",
  );
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function getCheckedAt(reconciliation) {
  return (
    reconciliation?.checked_at ||
    reconciliation?.checkedAt ||
    reconciliation?.created_at ||
    reconciliation?.createdAt ||
    ""
  );
}

function formatCheckedAt(value) {
  if (!value || Number.isNaN(new Date(value).getTime())) return "Waktu tidak tersedia";
  return formatShortDateTime(value);
}

function getExternalBalanceLabel(accountType) {
  if (accountType === "bank") return "Saldo di aplikasi bank";
  if (accountType === "ewallet") return "Saldo di e-wallet";
  if (accountType === "cash") return "Saldo uang tunai";
  return "Saldo sebenarnya";
}

function getExternalBalanceHelper(accountType) {
  if (accountType === "cash") {
    return "Masukkan jumlah uang tunai yang benar-benar tersedia.";
  }
  if (accountType === "bank" || accountType === "ewallet") {
    return "Gunakan saldo dari transaksi yang sudah selesai, bukan yang masih pending.";
  }
  return "Masukkan saldo terbaru dari sumber aslinya.";
}

function getHistoryComparison(reconciliation, currency) {
  const appBalance = readNumber(
    reconciliation?.app_balance,
    reconciliation?.appBalance,
    reconciliation?.actual_balance,
    reconciliation?.actualBalance,
  );
  const bankBalance = readNumber(
    reconciliation?.bank_balance,
    reconciliation?.bankBalance,
  );

  try {
    return calculateReconciliation({ appBalance, bankBalance, currency });
  } catch {
    const difference = bankBalance - appBalance;
    return {
      appBalance,
      bankBalance,
      difference,
      differenceAmount: Math.abs(difference),
      isMatched: difference === 0,
      direction:
        difference === 0
          ? "matched"
          : difference > 0
            ? "bank_higher"
            : "bank_lower",
    };
  }
}

function ReconciliationResult({ comparison, currency }) {
  const money = useMaskedCurrency();

  if (!comparison) {
    return html`
      <div className="dc-dashed flex min-h-[72px] items-center gap-3 px-3.5 py-3">
        <${Landmark}
          aria-hidden="true"
          className="h-[18px] w-[18px] shrink-0"
          style=${{ color: "var(--cs-faint)" }}
          strokeWidth=${1.75}
        />
        <p className="text-xs leading-5" style=${{ color: "var(--cs-mut)" }}>
          Masukkan saldo sebenarnya untuk melihat selisihnya secara otomatis.
        </p>
      </div>
    `;
  }

  const matched = Boolean(comparison.isMatched || comparison.direction === "matched");
  const bankHigher = comparison.direction === "bank_higher";
  const tone = matched
    ? "var(--cs-pos)"
    : bankHigher
      ? "var(--cs-warn)"
      : "var(--cs-danger)";
  const title = matched
    ? "Saldo cocok"
    : bankHigher
      ? "Saldo sebenarnya lebih besar"
      : "Saldo sebenarnya lebih kecil";
  const helper = matched
    ? "Tidak ada selisih dengan catatan CUANSYNC."
    : bankHigher
      ? "Mungkin ada pemasukan, bunga, atau cashback yang belum dicatat."
      : "Mungkin ada pengeluaran atau biaya yang belum dicatat.";
  const differenceAmount = Math.abs(
    Number(comparison.differenceAmount ?? comparison.difference ?? 0),
  );
  const Icon = matched ? CheckCircle2 : AlertTriangle;

  return html`
    <div
      className="dc-card flex min-h-[78px] items-center gap-3.5 px-4 py-3.5"
      style=${{
        borderColor: `color-mix(in srgb, ${tone} 30%, var(--cs-line))`,
        background: `color-mix(in srgb, ${tone} 7%, var(--cs-card))`,
      }}
    >
      <span
        className="dc-chip flex h-10 w-10 shrink-0 items-center justify-center"
        style=${{
          color: tone,
          background: `color-mix(in srgb, ${tone} 12%, var(--cs-card))`,
        }}
      >
        <${Icon} aria-hidden="true" className="h-[19px] w-[19px]" strokeWidth=${1.8} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="truncate text-sm font-bold" style=${{ color: tone }}>${title}</p>
          <span className="dc-num shrink-0 text-[13.5px]" style=${{ color: tone }}>
            ${matched
              ? money(0, currency)
              : `${bankHigher ? "+" : "-"}${money(differenceAmount, currency)}`}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] leading-4" style=${{ color: "var(--cs-mut)" }}>
          ${helper}
        </p>
      </div>
    </div>
  `;
}

/* Menyimpan selisih saja tidak menyelesaikan apa pun: pengguna masih harus
   tahu sebabnya. Dua jalan keluar disediakan di tempat selisihnya muncul,
   yaitu memeriksa transaksi terakhir dompet ini untuk mencari yang terlewat,
   ganda, atau salah nominal, dan mencatat transaksi yang tertinggal dengan
   nominal selisih sudah terisi. */
function DifferenceActions({
  comparison,
  currency,
  transactions,
  onRecordMissing,
  disabled,
}) {
  const money = useMaskedCurrency();
  const [reviewOpen, setReviewOpen] = useState(false);

  const bankHigher = comparison.direction === "bank_higher";
  const differenceAmount = Math.abs(
    Number(comparison.differenceAmount ?? comparison.difference ?? 0),
  );

  return html`
    <section className="grid gap-2.5" aria-label="Tindakan saat saldo berbeda">
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick=${() => setReviewOpen((current) => !current)}
          aria-expanded=${reviewOpen}
          className="dc-tile dc-press dc-press-96 flex min-h-[58px] items-center gap-2.5 px-3 py-2.5 text-left"
        >
          <${Search}
            aria-hidden="true"
            className="h-[17px] w-[17px] shrink-0"
            style=${{ color: "var(--cs-body)" }}
            strokeWidth=${1.8}
          />
          <span className="min-w-0 text-[12.5px] font-bold leading-4">
            Periksa transaksi
          </span>
        </button>
        <button
          type="button"
          disabled=${disabled || typeof onRecordMissing !== "function"}
          onClick=${() => onRecordMissing?.()}
          className="dc-tile dc-press dc-press-96 flex min-h-[58px] items-center gap-2.5 px-3 py-2.5 text-left disabled:cursor-not-allowed disabled:opacity-45"
        >
          <${PenLine}
            aria-hidden="true"
            className="h-[17px] w-[17px] shrink-0"
            style=${{ color: "var(--cs-body)" }}
            strokeWidth=${1.8}
          />
          <span className="min-w-0 text-[12.5px] font-bold leading-4">
            Catat yang tertinggal
          </span>
        </button>
      </div>

      <p className="px-0.5 text-[11px] leading-4" style=${{ color: "var(--cs-mut)" }}>
        ${`Mencatat ${bankHigher ? "pemasukan" : "pengeluaran"} sebesar ${money(
          differenceAmount,
          currency,
        )} akan membuat saldo cocok.`}
      </p>

      ${reviewOpen
        ? transactions.length
          ? html`
              <div className="dc-card overflow-hidden">
                ${transactions.map((item) => html`
                  <div
                    key=${item.id}
                    className="dc-row flex items-center gap-3 px-4 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-medium">
                        ${item.description || "Tanpa keterangan"}
                      </p>
                      <p
                        className="mt-0.5 truncate text-[11px]"
                        style=${{ color: "var(--cs-mut)" }}
                      >
                        ${formatCheckedAt(item.occurred_at)}
                      </p>
                    </div>
                    <span
                      className="dc-num shrink-0 text-[12.5px]"
                      style=${{
                        color:
                          item.activityDirection === "in"
                            ? "var(--cs-pos)"
                            : "var(--cs-danger)",
                      }}
                    >
                      ${`${item.activityDirection === "in" ? "+" : "-"}${money(
                        item.activityAmount,
                        item.activityCurrency,
                      )}`}
                    </span>
                  </div>
                `)}
              </div>
            `
          : html`
              <div className="dc-dashed flex min-h-14 items-center justify-center px-4 py-3 text-center">
                <p className="text-xs" style=${{ color: "var(--cs-mut)" }}>
                  Belum ada transaksi pada dompet ini.
                </p>
              </div>
            `
        : null}
    </section>
  `;
}

export function AccountReconciliationForm({
  account,
  reconciliations = [],
  transactions = [],
  loading = false,
  onSubmit,
  onSuccess,
  onRecordMissingTransaction,
}) {
  const money = useMaskedCurrency();
  const [bankBalanceInput, setBankBalanceInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const currency = account?.currency || "IDR";
  const allowDecimal = getCurrencyMeta(currency).fractionDigits > 0;
  const appBalance = readNumber(
    account?.balanceAmount,
    account?.actualBalance,
    account?.balance_amount,
  );
  const reservedBalance = readNumber(
    account?.reservedBalance,
    account?.reserved_balance,
  );
  const availableBalance = readNumber(
    account?.availableBalance,
    account?.available_balance,
    Math.max(appBalance - reservedBalance, 0),
  );
  const normalizedBankBalance = normalizeNumericInput(bankBalanceInput, {
    allowDecimal,
  });
  const numericBankBalance = Number(normalizedBankBalance);
  const hasValidBalance =
    normalizedBankBalance !== "" &&
    Number.isFinite(numericBankBalance) &&
    numericBankBalance >= 0;

  const comparison = useMemo(() => {
    if (!hasValidBalance) return null;
    try {
      return calculateReconciliation({
        appBalance,
        bankBalance: numericBankBalance,
        currency,
      });
    } catch {
      return null;
    }
  }, [appBalance, currency, hasValidBalance, numericBankBalance]);

  const recentReconciliations = useMemo(
    () =>
      [...reconciliations]
        .sort(
          (left, right) =>
            new Date(getCheckedAt(right)).getTime() -
            new Date(getCheckedAt(left)).getTime(),
        )
        .slice(0, 3),
    [reconciliations],
  );

  /* Transaksi terakhir dompet ini, lengkap dengan arah dan nominal yang benar
     benar menyentuh dompetnya. Transfer memakai sisi yang relevan: keluar
     memakai nominal asal beserta biaya, masuk memakai nominal tujuan. */
  const accountTransactions = useMemo(() => {
    if (!account?.id) return [];
    return transactions
      .filter((transaction) => transactionBelongsToAccount(transaction, account.id))
      .sort(
        (left, right) =>
          new Date(right.occurred_at).getTime() -
          new Date(left.occurred_at).getTime(),
      )
      .slice(0, 6)
      .map((transaction) => {
        const activity = getTransactionAccountActivity(transaction, account.id);
        return {
          ...transaction,
          activityAmount: activity.amount,
          activityCurrency: activity.currency,
          activityDirection: activity.direction,
        };
      });
  }, [account?.id, transactions]);

  useEffect(() => {
    setBankBalanceInput("");
    setError("");
    setSaving(false);
  }, [account?.id]);

  async function submit(event) {
    event.preventDefault();
    setError("");

    if (!account?.id) {
      setError("Dompet tidak ditemukan.");
      return;
    }
    if (!hasValidBalance || !comparison) {
      setError("Masukkan saldo yang valid terlebih dahulu.");
      return;
    }
    if (typeof onSubmit !== "function") return;

    setSaving(true);
    try {
      const ok = await onSubmit({
        accountId: account.id,
        bankBalance: numericBankBalance,
        checkedAt: new Date().toISOString(),
      });
      if (ok === true) {
        setBankBalanceInput("");
        onSuccess?.();
      }
    } catch (submitError) {
      setError(
        submitError?.message || "Pengecekan saldo belum berhasil disimpan.",
      );
    } finally {
      setSaving(false);
    }
  }

  const busy = loading || saving;

  return html`
    <form className="grid gap-4" onSubmit=${submit}>
      <section className="dc-card overflow-hidden" aria-label="Ringkasan saldo dompet">
        <div className="flex items-center justify-between gap-3 px-4 py-3.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">${account?.name || "Dompet"}</p>
            <p className="mt-0.5 text-[11px]" style=${{ color: "var(--cs-mut)" }}>
              Saldo aktual tercatat
            </p>
          </div>
          <span className="dc-num shrink-0 text-[15px]">
            ${money(appBalance, currency)}
          </span>
        </div>
        <div className="dc-row grid grid-cols-2">
          <div className="px-4 py-3">
            <span className="block text-[11px]" style=${{ color: "var(--cs-mut)" }}>
              Bisa dipakai
            </span>
            <span className="dc-num mt-1 block truncate text-[13px]">
              ${money(availableBalance, currency)}
            </span>
          </div>
          <div className="border-l px-4 py-3" style=${{ borderColor: "var(--cs-line)" }}>
            <span className="block text-[11px]" style=${{ color: "var(--cs-mut)" }}>
              Disisihkan
            </span>
            <span className="dc-num mt-1 block truncate text-[13px]" style=${{ color: "var(--cs-warn)" }}>
              ${money(reservedBalance, currency)}
            </span>
          </div>
        </div>
      </section>

      ${reservedBalance > 0
        ? html`
            <p
              className="rounded-[16px] px-3.5 py-3 text-xs leading-5"
              style=${{ background: "var(--cs-soft)", color: "var(--cs-body)" }}
            >
              Perbandingan memakai saldo aktual ${money(appBalance, currency)}.
              Dana yang disisihkan ke Tabungan tetap berada di sumber ini.
            </p>
          `
        : null}

      <label className="block">
        <span className="mb-2 block px-0.5 text-xs font-bold" style=${{ color: "var(--cs-body)" }}>
          ${getExternalBalanceLabel(account?.account_type)}
        </span>
        <span className="relative block">
          <input
            required
            autoFocus
            type="text"
            inputMode=${allowDecimal ? "decimal" : "numeric"}
            value=${bankBalanceInput}
            onChange=${(event) => {
              setBankBalanceInput(
                formatNumericInput(event.target.value, { allowDecimal }),
              );
              setError("");
            }}
            placeholder="0"
            aria-describedby="reconciliation-balance-helper reconciliation-result"
            className="cs-edit-input min-h-12 w-full rounded-[14px] border px-3.5 pr-16 text-[15px] font-medium"
          />
          <span
            className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-xs font-bold"
            style=${{ color: "var(--cs-mut)" }}
          >
            ${currency}
          </span>
        </span>
        <span
          id="reconciliation-balance-helper"
          className="mt-1.5 block px-0.5 text-[11px] leading-4"
          style=${{ color: "var(--cs-mut)" }}
        >
          ${getExternalBalanceHelper(account?.account_type)}
        </span>
      </label>

      <div id="reconciliation-result" aria-live="polite" aria-atomic="true">
        <${ReconciliationResult} comparison=${comparison} currency=${currency} />
      </div>

      ${comparison && !comparison.isMatched
        ? html`
            <${DifferenceActions}
              comparison=${comparison}
              currency=${currency}
              transactions=${accountTransactions}
              disabled=${busy}
              onRecordMissing=${() =>
                onRecordMissingTransaction?.({
                  accountId: account.id,
                  entryType:
                    comparison.direction === "bank_higher" ? "income" : "expense",
                  amount: Math.abs(
                    Number(comparison.differenceAmount ?? comparison.difference ?? 0),
                  ),
                })}
            />
          `
        : null}

      <section className="grid gap-2.5" aria-labelledby="reconciliation-history-title">
        <div className="flex items-center justify-between gap-3 px-0.5">
          <h3 id="reconciliation-history-title" className="text-[15px] font-bold">
            Riwayat pengecekan
          </h3>
          <span className="text-xs" style=${{ color: "var(--cs-mut)" }}>
            3 terbaru
          </span>
        </div>

        ${recentReconciliations.length
          ? html`
              <div className="dc-card overflow-hidden">
                ${recentReconciliations.map((reconciliation, index) => {
                  const historyCurrency = reconciliation.currency || currency;
                  const historyComparison = getHistoryComparison(
                    reconciliation,
                    historyCurrency,
                  );
                  const matched = Boolean(
                    historyComparison.isMatched ||
                      historyComparison.direction === "matched",
                  );
                  const direction = historyComparison.direction;
                  const tone = matched
                    ? "var(--cs-pos)"
                    : direction === "bank_higher"
                      ? "var(--cs-warn)"
                      : "var(--cs-danger)";
                  const differenceAmount = Math.abs(
                    Number(
                      historyComparison.differenceAmount ??
                        historyComparison.difference ??
                        0,
                    ),
                  );
                  return html`
                    <div
                      key=${reconciliation.id || `${getCheckedAt(reconciliation)}-${index}`}
                      className="dc-row flex items-center gap-3 px-4 py-3"
                    >
                      <span
                        className="dc-chip flex h-9 w-9 shrink-0 items-center justify-center"
                        style=${{
                          color: tone,
                          background: `color-mix(in srgb, ${tone} 10%, var(--cs-card))`,
                        }}
                      >
                        <${matched ? CheckCircle2 : History}
                          aria-hidden="true"
                          className="h-4 w-4"
                          strokeWidth=${1.8}
                        />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">
                          ${formatCheckedAt(getCheckedAt(reconciliation))}
                        </p>
                        <p className="mt-0.5 truncate text-[11px]" style=${{ color: "var(--cs-mut)" }}>
                          Saldo sebenarnya ${money(
                            historyComparison.bankBalance,
                            historyCurrency,
                          )}
                        </p>
                      </div>
                      <span className="dc-num shrink-0 text-[12.5px]" style=${{ color: tone }}>
                        ${matched
                          ? "Cocok"
                          : `${direction === "bank_higher" ? "+" : "-"}${money(
                              differenceAmount,
                              historyCurrency,
                            )}`}
                      </span>
                    </div>
                  `;
                })}
              </div>
            `
          : html`
              <div className="dc-dashed flex min-h-14 items-center justify-center px-4 py-3 text-center">
                <p className="text-xs" style=${{ color: "var(--cs-mut)" }}>
                  Belum ada pengecekan saldo.
                </p>
              </div>
            `}
      </section>

      ${error
        ? html`
            <p role="alert" className="px-0.5 text-xs font-semibold" style=${{ color: "var(--cs-danger)" }}>
              ${error}
            </p>
          `
        : null}

      <${FormActionDock}>
        <button
          type="submit"
          disabled=${busy || !hasValidBalance || !comparison}
          className="dc-press dc-press-96 min-h-[52px] w-full rounded-[17px] px-4 text-[15px] font-bold disabled:cursor-not-allowed disabled:opacity-45"
          style=${{ background: "var(--cs-acc)", color: "var(--cs-on-acc)" }}
        >
          ${busy ? "Menyimpan..." : "Simpan pengecekan"}
        </button>
      <//>
    </form>
  `;
}
