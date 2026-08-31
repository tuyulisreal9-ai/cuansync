import React, { useEffect, useState } from "react";
import htm from "htm";
import {
  CATEGORY_OPTIONS,
  DEFAULT_CATEGORY,
  normalizeBudgetCategory,
} from "../../domain/budgets.js";
import {
  getAssetAccountDisplayName,
  getSelectableAssetAccounts,
} from "../../domain/assets.js";
import {
  deriveStoredExchangeRateOrientation,
  settleExchangeCalculation,
  validateExchangeRate,
} from "../../domain/exchange.js";
import {
  getTransactionAmountValue,
  getTransactionCurrency,
  getTransactionFlow,
  getTransactionMainAmount,
  FUTURE_TRANSACTION_DATE_MESSAGE,
  resolveTransactionBaseValue,
} from "../../domain/transactions.js";
import {
  DEFAULT_BASE_CURRENCY,
  formatCurrency,
  formatMoney,
  formatNumericInput,
  formatRate,
  normalizeCurrencyCode,
  normalizeNumericInput,
} from "../../lib/currency.js";
import {
  formatShortDateTime,
  formatShortTime,
  toInputDateTime,
} from "../../lib/dates.js";
import {
  getTransactionCategoryLabel,
  getTransactionCompactAmount,
  getTransactionDisplayTitle,
  getTransactionIconLabel,
  getTransactionTone,
  getTransactionTypeLabel,
} from "./presentation.js";

const html = htm.bind(React.createElement);
/* Angka input dan label mengikuti sheet "Ubah catatan" di artifact:
   input tinggi 48, radius 14, border --line, latar --card, padding 0 14,
   teks 14.5px; label 12px --mut dengan padding 0 2. */
const INPUT_CLASS =
  "w-full min-h-12 rounded-[14px] border px-3.5 text-[14.5px] cs-edit-input";
const EDIT_LABEL_CLASS = "block px-0.5 text-xs cs-edit-label";

function getTransactionIdrValuationWithRate(transaction, fallbackRate = 0) {
  const valuation = resolveTransactionBaseValue(transaction, fallbackRate);
  return valuation > 0 ? valuation : null;
}

function formatEditNumericValue(value) {
  const numericValue = Math.abs(Number(value || 0));
  return numericValue > 0 ? formatNumericInput(String(numericValue)) : "";
}

function formatExchangeRateOrientation({
  rateBaseCurrency,
  rateQuoteCurrency,
  exchangeRate,
}) {
  const rate = Number(exchangeRate || 0);
  if (!Number.isFinite(rate) || rate <= 0) return "-";
  return `1 ${rateBaseCurrency} = ${formatMoney(rate, rateQuoteCurrency, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function getTransactionEditForm(transaction) {
  const flow = getTransactionFlow(transaction);
  const currency = getTransactionCurrency(transaction);
  const rate = Number(transaction.rate || transaction.locked_rate || 0);
  const rateOrientation =
    flow === "exchange"
      ? deriveStoredExchangeRateOrientation(transaction)
      : null;

  return {
    type: flow,
    occurred_at: toInputDateTime(new Date(transaction.occurred_at || Date.now())),
    description: transaction.description || "",
    category:
      flow === "expense"
        ? normalizeBudgetCategory(
            transaction.category,
            transaction.category_group,
          )
        : transaction.category || DEFAULT_CATEGORY,
    currency,
    expense_currency: currency,
    from_currency: normalizeCurrencyCode(transaction.from_currency),
    to_currency: normalizeCurrencyCode(transaction.to_currency, "THB"),
    from_amount: formatEditNumericValue(transaction.from_amount),
    to_amount: formatEditNumericValue(transaction.to_amount),
    amount_idr: formatEditNumericValue(transaction.amount_idr),
    amount_thb: formatEditNumericValue(transaction.amount_thb),
    amount: formatEditNumericValue(getTransactionAmountValue(transaction)),
    locked_rate: formatEditNumericValue(
      rateOrientation?.exchangeRate || rate,
    ),
    rate_base_currency: rateOrientation?.rateBaseCurrency || "",
    rate_quote_currency: rateOrientation?.rateQuoteCurrency || "",
    rate_type: transaction.rate_type || "legacy",
    source_account_id: transaction.source_account_id || "",
    destination_account_id: transaction.destination_account_id || "",
  };
}
function TransactionEditForm({
  transaction,
  form,
  onChange,
  onSave,
  onCancel,
  loading = false,
  assetAccounts = [],
}) {
  const [exchangeAutoTarget, setExchangeAutoTarget] = useState("to_amount");
  const flow = form.type || getTransactionFlow(transaction);
  const isIncome = flow === "income";
  const isExpense = flow === "expense";
  const isExchange = flow === "exchange";
  const isTransfer =
    isExchange &&
    normalizeCurrencyCode(form.from_currency) === normalizeCurrencyCode(form.to_currency);
  const transactionCurrency = normalizeCurrencyCode(
    isExpense ? form.expense_currency : form.currency,
  );
  const amountValue = Number(normalizeNumericInput(form.amount));
  const settledEditForm = isExchange
    ? settleExchangeCalculation(form, "locked_rate", {
        rateField: "locked_rate",
        preferredTarget: exchangeAutoTarget,
        rateBaseCurrency: form.rate_base_currency,
        rateQuoteCurrency: form.rate_quote_currency,
      })
    : form;
  const fromAmount = Number(normalizeNumericInput(settledEditForm.from_amount));
  const toAmount = Number(normalizeNumericInput(settledEditForm.to_amount));
  const rateValidation = validateExchangeRate(form.locked_rate);
  const originalEntryAccountId = isIncome
    ? transaction.destination_account_id
    : transaction.source_account_id;
  const allEntryAccountOptions = getSelectableAssetAccounts(
    assetAccounts,
    transactionCurrency,
  );
  const entryAccountOptions = originalEntryAccountId &&
    allEntryAccountOptions.some((account) => account.id === originalEntryAccountId)
    ? allEntryAccountOptions.filter((account) => account.id === originalEntryAccountId)
    : allEntryAccountOptions;
  const allSourceAccountOptions = getSelectableAssetAccounts(
    assetAccounts,
    form.from_currency,
  );
  const sourceAccountOptions = transaction.source_account_id &&
    allSourceAccountOptions.some(
      (account) => account.id === transaction.source_account_id,
    )
    ? allSourceAccountOptions.filter(
        (account) => account.id === transaction.source_account_id,
      )
    : allSourceAccountOptions;
  const allDestinationAccountOptions = getSelectableAssetAccounts(
    assetAccounts,
    form.to_currency,
  ).filter((account) => account.id !== form.source_account_id);
  const destinationAccountOptions = transaction.destination_account_id &&
    allDestinationAccountOptions.some(
      (account) => account.id === transaction.destination_account_id,
    )
    ? allDestinationAccountOptions.filter(
        (account) => account.id === transaction.destination_account_id,
      )
    : allDestinationAccountOptions;
  const entryAccountId = isIncome
    ? form.destination_account_id
    : form.source_account_id;
  const accountLinksValid = isExchange
    ? Boolean(
        form.source_account_id &&
          form.destination_account_id &&
          form.source_account_id !== form.destination_account_id,
      )
    : Boolean(entryAccountId);
  const descriptionValid = String(form.description || "").trim().length > 0;
  const occurredAtTime = new Date(form.occurred_at).getTime();
  const transactionDateInvalid =
    Number.isNaN(occurredAtTime) || occurredAtTime > Date.now();
  const submitDisabled =
    loading ||
    !descriptionValid ||
    !accountLinksValid ||
    transactionDateInvalid ||
    ((isIncome || isExpense) && amountValue <= 0) ||
    (isExchange &&
      (fromAmount <= 0 ||
        toAmount <= 0 ||
        !rateValidation.valid ||
        (isTransfer && Number(normalizeNumericInput(form.locked_rate)) !== 1)));
  const formSubtitle = isExchange
    ? "Exchange"
    : isIncome
      ? `Uang masuk | ${transactionCurrency}`
      : `Uang keluar | ${transactionCurrency}`;

  function updateField(field, value) {
    if (field === "from_amount") setExchangeAutoTarget("to_amount");
    if (field === "to_amount") setExchangeAutoTarget("from_amount");
    const next = { ...form, [field]: value };
    if (field === "source_account_id" && value === next.destination_account_id) {
      next.destination_account_id = "";
    }
    onChange(next);
  }

  function settleExchangeField(field) {
    onChange(
      settleExchangeCalculation(form, field, {
        rateField: "locked_rate",
        preferredTarget: exchangeAutoTarget,
        rateBaseCurrency: form.rate_base_currency,
        rateQuoteCurrency: form.rate_quote_currency,
      }),
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const finalForm = isExchange
      ? settleExchangeCalculation(form, "locked_rate", {
          rateField: "locked_rate",
          preferredTarget: exchangeAutoTarget,
          rateBaseCurrency: form.rate_base_currency,
          rateQuoteCurrency: form.rate_quote_currency,
        })
      : form;
    if (isExchange) onChange(finalForm);
    await onSave(finalForm);
  }

  return html`
    <form className="grid gap-4" onSubmit=${handleSubmit}>
      <div key="edit-type" className="flex flex-col gap-2">
        <span className=${EDIT_LABEL_CLASS}>Jenis transaksi</span>
        <div
          className="flex min-h-12 items-center rounded-[14px] border px-3.5 text-[14.5px] font-medium"
          style=${{
            borderColor: "var(--cs-line)",
            background: "var(--cs-chip)",
            color: "var(--cs-ink)",
          }}
        >
          ${formSubtitle}
        </div>
      </div>

      <label key="edit-description" className="block space-y-2">
        <span className=${EDIT_LABEL_CLASS}>
          Catatan
        </span>
        <input
          type="text"
          required
          value=${form.description}
          onChange=${(event) => updateField("description", event.target.value)}
          placeholder="Catatan transaksi"
          className=${INPUT_CLASS}
        />
      </label>

      ${isExchange
        ? html`
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200/70 bg-white/45 p-3 dark:border-white/10 dark:bg-slate-900/30">
                <span className=${EDIT_LABEL_CLASS}>
                  Dari mata uang
                </span>
                <strong className="mt-1 block text-sm text-slate-950 dark:text-white">
                  ${form.from_currency}
                </strong>
              </div>
              <div className="rounded-2xl border border-slate-200/70 bg-white/45 p-3 dark:border-white/10 dark:bg-slate-900/30">
                <span className=${EDIT_LABEL_CLASS}>
                  Ke mata uang
                </span>
                <strong className="mt-1 block text-sm text-slate-950 dark:text-white">
                  ${form.to_currency}
                </strong>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className=${EDIT_LABEL_CLASS}>
                  Dompet asal
                </span>
                <select
                  value=${form.source_account_id}
                  onChange=${(event) => updateField("source_account_id", event.target.value)}
                  className=${INPUT_CLASS}
                >
                  <option value="">Pilih dompet</option>
                  ${sourceAccountOptions.map(
                    (account) => html`
                      <option key=${account.id} value=${account.id}>
                        ${getAssetAccountDisplayName(account)}
                      </option>
                    `,
                  )}
                </select>
              </label>
              <label className="block space-y-2">
                <span className=${EDIT_LABEL_CLASS}>
                  Dompet tujuan
                </span>
                <select
                  value=${form.destination_account_id}
                  onChange=${(event) => updateField("destination_account_id", event.target.value)}
                  className=${INPUT_CLASS}
                >
                  <option value="">Pilih dompet</option>
                  ${destinationAccountOptions.map(
                    (account) => html`
                      <option key=${account.id} value=${account.id}>
                        ${getAssetAccountDisplayName(account)}
                      </option>
                    `,
                  )}
                </select>
              </label>
            </div>

            <label className="block space-y-2">
              <span className=${EDIT_LABEL_CLASS}>
                Jumlah ditukar
              </span>
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value=${form.from_amount}
                onChange=${(event) =>
                  updateField("from_amount", formatNumericInput(event.target.value))}
                onBlur=${() => settleExchangeField("from_amount")}
                placeholder="0"
                required
                className=${INPUT_CLASS}
              />
            </label>

            <label className="block space-y-2">
              <span className=${EDIT_LABEL_CLASS}>
                Jumlah diterima
              </span>
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                required
                value=${form.to_amount}
                onChange=${(event) =>
                  updateField("to_amount", formatNumericInput(event.target.value))}
                onBlur=${() => settleExchangeField("to_amount")}
                placeholder="0"
                className=${INPUT_CLASS}
              />
            </label>

            <label className="block space-y-2">
              <span className=${EDIT_LABEL_CLASS}>
                Kurs money changer
              </span>
              <span className="mb-2 block text-xs font-bold text-emerald-600 dark:text-emerald-300">
                1 ${form.rate_base_currency} sama dengan berapa ${form.rate_quote_currency}
              </span>
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value=${form.locked_rate}
                onChange=${(event) =>
                  updateField("locked_rate", formatNumericInput(event.target.value))}
                onBlur=${() => settleExchangeField("locked_rate")}
                placeholder="0"
                required
                className=${INPUT_CLASS}
              />
              ${!rateValidation.valid
                ? html`
                    <span className="block text-xs font-bold text-rose-500">
                      ${rateValidation.message}
                    </span>
                  `
                : null}
            </label>

            <div className="rounded-2xl border border-sky-300/25 bg-sky-400/10 px-4 py-3 text-sm font-black text-sky-800 dark:border-sky-300/20 dark:bg-sky-500/10 dark:text-sky-100">
              ${formatCurrency(fromAmount, form.from_currency)} -> ${formatCurrency(toAmount, form.to_currency)}
            </div>
          `
        : null}

      ${(isIncome || isExpense) && !isExchange
        ? html`
            <label key="edit-entry-account" className="block space-y-2">
              <span className=${EDIT_LABEL_CLASS}>
                ${isIncome ? "Masuk ke dompet" : "Keluar dari dompet"}
              </span>
              <select
                value=${entryAccountId}
                onChange=${(event) =>
                  updateField(
                    isIncome ? "destination_account_id" : "source_account_id",
                    event.target.value,
                  )}
                className=${INPUT_CLASS}
              >
                <option value="">Pilih dompet ${transactionCurrency}</option>
                ${entryAccountOptions.map(
                  (account) => html`
                    <option key=${account.id} value=${account.id}>
                      ${getAssetAccountDisplayName(account)}
                    </option>
                  `,
                )}
              </select>
              ${!entryAccountOptions.length
                ? html`
                    <span className="block text-xs font-bold text-amber-600 dark:text-amber-300">
                      Belum ada dompet ${transactionCurrency}. Tambahkan dompet sebelum memperbarui transaksi ini.
                    </span>
                  `
                : null}
            </label>

            <label key="edit-entry-amount" className="block space-y-2">
              <span className=${EDIT_LABEL_CLASS}>
                Nominal ${transactionCurrency}
              </span>
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value=${form.amount}
                onChange=${(event) =>
                  updateField("amount", formatNumericInput(event.target.value))}
                placeholder="0"
                required
                className=${INPUT_CLASS}
              />
            </label>

          `
        : null}

      ${isExpense
        ? html`
            <label key="edit-category" className="block space-y-2">
              <span className=${EDIT_LABEL_CLASS}>
                Kategori
              </span>
              <select
                value=${form.category}
                onChange=${(event) => updateField("category", event.target.value)}
                className=${INPUT_CLASS}
              >
                ${CATEGORY_OPTIONS.map(
                  (category) => html`
                    <option key=${category.value} value=${category.value}>
                      ${category.label}
                    </option>
                  `,
                )}
              </select>
            </label>
          `
        : null}

      <label key="edit-occurred-at" className="block space-y-2">
        <span className=${EDIT_LABEL_CLASS}>
          Tanggal
        </span>
        <input
          type="datetime-local"
          required
          max=${toInputDateTime()}
          value=${form.occurred_at}
          onChange=${(event) => updateField("occurred_at", event.target.value)}
          className=${INPUT_CLASS}
        />
        ${transactionDateInvalid
          ? html`
              <span className="block text-xs font-bold text-rose-500">
                ${FUTURE_TRANSACTION_DATE_MESSAGE}
              </span>
            `
          : null}
      </label>

      ${/* Footer mengikuti artifact: simpan tinggi 52 radius 17 berlatar aksen,
            lalu aksi sekunder tinggi 48 radius 16 bergaris tepi. */ null}
      <div
        key="edit-actions"
        className="sticky bottom-0 z-10 -mx-5 flex flex-col gap-2 px-5 pb-2 pt-3"
        style=${{ background: "var(--cs-bg)" }}
      >
        <button
          type="submit"
          disabled=${submitDisabled}
          className="dc-press dc-press-96 flex min-h-[52px] items-center justify-center rounded-[17px] text-[15px] font-bold disabled:cursor-not-allowed"
          style=${
            submitDisabled
              ? { background: "var(--cs-track)", color: "var(--cs-faint)" }
              : { background: "var(--cs-acc)", color: "var(--cs-on-acc)" }
          }
        >
          ${loading ? "Menyimpan..." : "Simpan"}
        </button>
        <button
          type="button"
          onClick=${onCancel}
          className="dc-press dc-press-96 flex min-h-12 items-center justify-center rounded-[16px] border text-sm font-bold"
          style=${{
            borderColor: "var(--cs-line)",
            color: "var(--cs-body)",
          }}
        >
          Batal
        </button>
      </div>
    </form>
  `;
}

/* Baris rincian memakai pola daftar yang sama dengan Pengaturan dan Dompet:
   label kiri berwarna redup, nilai kanan berwarna tinta. Sebelumnya berupa
   kotak-kotak kecil dengan label kapital bertracking lebar yang tidak dipakai
   di mana pun lagi setelah redesign. */
function ReceiptMetaRow({ label, value }) {
  return html`
    <div className="flex min-h-[44px] items-center justify-between gap-3 px-4 py-2.5">
      <span
        className="shrink-0 text-[13px]"
        style=${{ color: "var(--cs-mut)" }}
      >
        ${label}
      </span>
      <span
        className="min-w-0 truncate text-right text-[13.5px] font-medium"
        style=${{ color: "var(--cs-ink)" }}
      >
        ${value}
      </span>
    </div>
  `;
}

export function TransactionDetailSheet({
  transaction,
  onClose,
  onDelete,
  onUpdate,
  fallbackRate = 0,
  loading = false,
  activeCurrencies = [],
  baseCurrency = DEFAULT_BASE_CURRENCY,
  assetAccounts = [],
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!transaction) return undefined;
    setIsEditing(false);
    setConfirmingDelete(false);
    setEditForm(getTransactionEditForm(transaction));
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [transaction, onClose]);

  if (!transaction) return null;

  const flow = getTransactionFlow(transaction);
  const tone = getTransactionTone(transaction);
  /* Warna nominal memakai token, bukan kelas emerald/rose warisan. Maknanya
     dipertahankan seperti sebelumnya: masuk hijau, keluar merah, tukar netral. */
  const detailFlow = getTransactionFlow(transaction);
  const detailAmountColor =
    detailFlow === "income"
      ? "var(--cs-pos)"
      : detailFlow === "exchange"
        ? "var(--cs-mut)"
        : "var(--cs-danger)";
  const currency = getTransactionCurrency(transaction);
  const mainAmount = getTransactionMainAmount(transaction);
  const valuationIdr = getTransactionIdrValuationWithRate(transaction, fallbackRate);
  const categoryLabel = getTransactionCategoryLabel(transaction);
  const isExchange = flow === "exchange";
  const signedPrefix = flow === "income" ? "+" : "-";
  const description = getTransactionDisplayTitle(transaction);
  const compactAmount = getTransactionCompactAmount(transaction, fallbackRate);
  const amountText = isExchange
    ? `${compactAmount.primary} -> ${compactAmount.secondary}`
    : `${signedPrefix}${formatCurrency(mainAmount, currency)}`;
  const currencyLabel = isExchange ? "Transfer / Exchange" : currency.toUpperCase();
  const showValuation = valuationIdr != null;
  const exchangeRateOrientation = isExchange
    ? deriveStoredExchangeRateOrientation(transaction)
    : null;
  const rateText = isExchange
    ? formatExchangeRateOrientation(exchangeRateOrientation)
    : transaction.rate || transaction.locked_rate
      ? formatRate(
          transaction.rate || transaction.locked_rate,
          DEFAULT_BASE_CURRENCY,
          currency,
        )
      : "-";
  const accountById = new Map(
    assetAccounts.map((account) => [account.id, account]),
  );
  const sourceAccount = accountById.get(transaction.source_account_id);
  const destinationAccount = accountById.get(transaction.destination_account_id);
  const accountMeta = isExchange
    ? [
        ["Dompet asal", sourceAccount?.name || "Dompet tidak tercatat"],
        ["Dompet tujuan", destinationAccount?.name || "Dompet tidak tercatat"],
      ]
    : [[
        flow === "income" ? "Masuk ke" : "Keluar dari",
        (flow === "income" ? destinationAccount : sourceAccount)?.name ||
          "Dompet tidak tercatat",
      ]];
  const receiptMeta = isExchange
    ? [
        ...accountMeta,
        ["Dari", transaction.from_currency],
        ["Ke", transaction.to_currency],
        ["Ditukar", formatCurrency(transaction.from_amount, transaction.from_currency)],
        ["Diterima", formatCurrency(transaction.to_amount, transaction.to_currency)],
        ["Kurs", rateText],
        ["Tanggal", formatShortDateTime(transaction.occurred_at)],
      ]
    : [
        ...accountMeta,
        ["Tanggal", formatShortDateTime(transaction.occurred_at)],
        ["Kategori", categoryLabel],
        ["Mata uang", currencyLabel],
        ["Kurs", rateText],
      ];
  const receiptHelper = isExchange
    ? "Perpindahan aset, bukan pemasukan atau pengeluaran"
    : showValuation && currency !== DEFAULT_BASE_CURRENCY
      ? `Valuasi ${formatCurrency(valuationIdr, "idr")}`
      : getTransactionTypeLabel(transaction);

  async function handleSaveEdit(nextForm) {
    const succeeded = await onUpdate(transaction, nextForm);
    if (succeeded) {
      setIsEditing(false);
      onClose();
    }
  }

  async function handleConfirmDelete() {
    const succeeded = await onDelete(transaction);
    if (succeeded) onClose();
  }

  return html`
    <div className="fixed inset-0 z-[120] flex items-end justify-center md:items-center">
      <button
        key="detail-backdrop"
        type="button"
        aria-label="Tutup detail transaksi"
        className="absolute inset-0"
        style=${{ background: "rgba(20,18,15,0.42)" }}
        onClick=${onClose}
      ></button>
      <section
        key="detail-panel"
        className="transaction-sheet relative flex max-h-[calc(100svh-1rem)] w-full flex-col gap-4 overflow-y-auto px-5 pb-6 pt-3 md:max-h-[86svh] md:max-w-lg"
        style=${{
          background: "var(--cs-bg)",
          borderRadius: "26px 26px 0 0",
          boxShadow: "0 -12px 40px rgba(0,0,0,0.18)",
        }}
      >
        <span
          className="mx-auto block h-1 w-[42px] shrink-0 rounded-full md:hidden"
          style=${{ background: "var(--cs-dim)" }}
        ></span>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[17px] font-bold tracking-[-0.2px]">
              ${isEditing ? "Edit transaksi" : "Detail transaksi"}
            </p>
            <p
              className="mt-0.5 truncate text-[13px]"
              style=${{ color: "var(--cs-mut)" }}
            >
              ${formatShortTime(transaction.occurred_at)} · ${getTransactionTypeLabel(transaction)}
            </p>
          </div>
          <button
            type="button"
            onClick=${onClose}
            className="flex min-h-11 shrink-0 items-center pl-4 text-[13px]"
            style=${{ color: "var(--cs-mut)" }}
            aria-label="Tutup"
          >
            Tutup
          </button>
        </div>

        ${isEditing && editForm
          ? html`
              <${TransactionEditForm}
                transaction=${transaction}
                form=${editForm}
                onChange=${setEditForm}
                onSave=${handleSaveEdit}
                onCancel=${() => {
                  setIsEditing(false);
                  setEditForm(getTransactionEditForm(transaction));
                }}
                loading=${loading}
                assetAccounts=${assetAccounts}
              />
            `
          : html`
              <${React.Fragment}>
              <div key="detail-receipt" className="dc-card flex flex-col gap-4 p-[18px]">
                <div className="flex items-center gap-3.5">
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[12.5px] font-bold"
                    style=${{
                      background: "var(--cs-chip)",
                      color: "var(--cs-body)",
                    }}
                  >
                    ${getTransactionIconLabel(transaction)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-bold">${description}</p>
                    <p
                      className="mt-0.5 truncate text-[12.5px]"
                      style=${{ color: "var(--cs-mut)" }}
                    >
                      ${getTransactionTypeLabel(transaction)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-xs" style=${{ color: "var(--cs-mut)" }}>
                    Nominal
                  </span>
                  <p
                    className="dc-num break-words text-[26px] leading-none tracking-[-0.8px]"
                    style=${{ color: detailAmountColor }}
                  >
                    ${amountText}
                  </p>
                  ${receiptHelper
                    ? html`
                        <span
                          className="text-xs leading-[1.45]"
                          style=${{ color: "var(--cs-mut)" }}
                        >
                          ${receiptHelper}
                        </span>
                      `
                    : null}
                </div>
              </div>

              <div
                key="detail-meta"
                className="dc-card divide-y overflow-hidden"
                style=${{ borderColor: "var(--cs-line)" }}
              >
                ${receiptMeta.map(
                  ([label, value]) => html`
                    <${ReceiptMetaRow} key=${label} label=${label} value=${value} />
                  `,
                )}
              </div>

              <div
                key="detail-actions"
                className="sticky bottom-0 z-10 -mx-5 px-5 pb-2 pt-3"
                style=${{ background: "var(--cs-bg)" }}
              >
                ${confirmingDelete
                  ? html`
                      <div
                        className="flex flex-col gap-3 rounded-[18px] border p-4"
                        style=${{
                          borderColor: "var(--cs-danger)",
                          background: "var(--cs-card)",
                        }}
                      >
                        <p className="text-sm font-bold">
                          Yakin ingin menghapus transaksi ini?
                        </p>
                        <p
                          className="text-[13px] leading-[1.45]"
                          style=${{ color: "var(--cs-mut)" }}
                        >
                          Data akan dihapus dari riwayat dan semua saldo serta
                          summary akan dihitung ulang.
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick=${() => setConfirmingDelete(false)}
                            className="dc-press dc-press-96 min-h-[52px] rounded-[17px] text-[15px] font-medium"
                            style=${{ color: "var(--cs-body)" }}
                          >
                            Batal
                          </button>
                          <button
                            type="button"
                            disabled=${loading}
                            onClick=${handleConfirmDelete}
                            className="dc-press dc-press-96 min-h-[52px] rounded-[17px] text-[15px] font-bold disabled:cursor-not-allowed disabled:opacity-60"
                            style=${{
                              background: "var(--cs-danger)",
                              color: "var(--cs-on-acc)",
                            }}
                          >
                            ${loading ? "Menghapus..." : "Hapus"}
                          </button>
                        </div>
                      </div>
                    `
                  : html`
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick=${() => setIsEditing(true)}
                          className="dc-press dc-press-96 min-h-[52px] rounded-[17px] text-[15px] font-bold"
                          style=${{
                            background: "var(--cs-acc)",
                            color: "var(--cs-on-acc)",
                          }}
                        >
                          Edit transaksi
                        </button>
                        <button
                          type="button"
                          onClick=${() => setConfirmingDelete(true)}
                          className="dc-press dc-press-96 min-h-[52px] rounded-[17px] text-[15px] font-bold"
                          style=${{ color: "var(--cs-danger)" }}
                        >
                          Hapus transaksi
                        </button>
                      </div>
                    `}
              </div>
              <//>
            `}
      </section>
    </div>
  `;
}
