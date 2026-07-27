import React, { useEffect, useState } from "https://esm.sh/react@18.3.1";
import htm from "https://esm.sh/htm@3.1.1";
import { CATEGORY_OPTIONS, DEFAULT_CATEGORY } from "../../domain/budgets.js";
import { settleExchangeCalculation } from "../../domain/exchange.js";
import {
  getTransactionAmountValue,
  getTransactionCurrency,
  getTransactionFlow,
  getTransactionMainAmount,
  resolveTransactionBaseValue,
} from "../../domain/transactions.js";
import {
  DEFAULT_BASE_CURRENCY,
  formatCurrency,
  formatNumericInput,
  formatRate,
  normalizeCurrencyCode,
  normalizeCurrencyList,
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
const INPUT_CLASS =
  "w-full min-h-12 rounded-2xl px-4 py-3.5 text-sm transition cuan-input";

function mergeCurrencyLists(baseCurrency, ...lists) {
  return normalizeCurrencyList(lists.flat().filter(Boolean), {
    baseCurrency,
  });
}

function getTransactionIdrValuationWithRate(transaction, fallbackRate = 0) {
  const valuation = resolveTransactionBaseValue(transaction, fallbackRate);
  return valuation > 0 ? valuation : null;
}

function formatEditNumericValue(value) {
  const numericValue = Math.abs(Number(value || 0));
  return numericValue > 0 ? formatNumericInput(String(numericValue)) : "";
}

function getTransactionEditForm(transaction) {
  const flow = getTransactionFlow(transaction);
  const currency = getTransactionCurrency(transaction);
  const rate = Number(transaction.rate || transaction.locked_rate || 0);

  return {
    type: flow,
    occurred_at: toInputDateTime(new Date(transaction.occurred_at || Date.now())),
    description: transaction.description || "",
    category: transaction.category || DEFAULT_CATEGORY,
    currency,
    expense_currency: currency,
    from_currency: normalizeCurrencyCode(transaction.from_currency),
    to_currency: normalizeCurrencyCode(transaction.to_currency, "THB"),
    from_amount: formatEditNumericValue(transaction.from_amount),
    to_amount: formatEditNumericValue(transaction.to_amount),
    amount_idr: formatEditNumericValue(transaction.amount_idr),
    amount_thb: formatEditNumericValue(transaction.amount_thb),
    amount: formatEditNumericValue(getTransactionAmountValue(transaction)),
    locked_rate: formatEditNumericValue(rate),
  };
}
function TransactionEditForm({
  transaction,
  form,
  onChange,
  onSave,
  onCancel,
  loading = false,
  activeCurrencies: availableCurrencies = [],
  baseCurrency = DEFAULT_BASE_CURRENCY,
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [exchangeAutoTarget, setExchangeAutoTarget] = useState("to_amount");
  const flow = form.type || getTransactionFlow(transaction);
  const isIncome = flow === "income";
  const isExpense = flow === "expense";
  const isExchange = flow === "exchange";
  const transactionCurrency = normalizeCurrencyCode(
    isExpense ? form.expense_currency : form.currency,
  );
  const isForeign = transactionCurrency !== baseCurrency;
  const amountValue = Number(normalizeNumericInput(form.amount));
  const settledEditForm = isExchange
    ? settleExchangeCalculation(form, "locked_rate", {
        rateField: "locked_rate",
        preferredTarget: exchangeAutoTarget,
      })
    : form;
  const fromAmount = Number(normalizeNumericInput(settledEditForm.from_amount));
  const toAmount = Number(normalizeNumericInput(settledEditForm.to_amount));
  const lockedRate = Number(normalizeNumericInput(form.locked_rate));
  const activeCurrencies = mergeCurrencyLists(
    baseCurrency,
    availableCurrencies,
    form.currency,
    form.expense_currency,
    form.from_currency,
    form.to_currency,
  );
  const descriptionValid = String(form.description || "").trim().length > 0;
  const submitDisabled =
    loading ||
    !descriptionValid ||
    ((isIncome || isExpense) && amountValue <= 0) ||
    (isExchange &&
      (fromAmount <= 0 ||
        toAmount <= 0 ||
        lockedRate <= 0 ||
        form.from_currency === form.to_currency));
  const typeOptions = [
    { value: "income", label: "Uang Masuk" },
    { value: "expense", label: "Uang Keluar" },
    { value: "exchange", label: "Exchange" },
  ];
  const formSubtitle = isExchange
    ? "Exchange"
    : isIncome
      ? `Uang masuk | ${transactionCurrency}`
      : `Uang keluar | ${transactionCurrency}`;

  function updateField(field, value) {
    if (field === "from_amount") setExchangeAutoTarget("to_amount");
    if (field === "to_amount") setExchangeAutoTarget("from_amount");
    const next = { ...form, [field]: value };
    onChange(next);
  }

  function settleExchangeField(field) {
    onChange(
      settleExchangeCalculation(form, field, {
        rateField: "locked_rate",
        preferredTarget: exchangeAutoTarget,
      }),
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const finalForm = isExchange
      ? settleExchangeCalculation(form, "locked_rate", {
          rateField: "locked_rate",
          preferredTarget: exchangeAutoTarget,
        })
      : form;
    if (isExchange) onChange(finalForm);
    await onSave(finalForm);
  }

  return html`
    <form className="mt-5 grid gap-3" onSubmit=${handleSubmit}>
      <div className="rounded-[24px] border border-slate-200/70 bg-white/60 p-4 dark:border-white/10 dark:bg-slate-900/42">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
          Jenis transaksi
        </p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-sm font-black text-slate-950 dark:text-white">
            ${formSubtitle}
          </p>
          <span className="rounded-full border border-brand-300/25 bg-brand-500/10 px-3 py-1 text-[11px] font-black text-brand-700 dark:border-brand-300/20 dark:text-brand-200">
            Aktif
          </span>
        </div>
      </div>

      <label className="block space-y-2">
        <span className="block text-xs font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
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
              <label className="block space-y-2">
                <span className="block text-xs font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                  Dari mata uang
                </span>
                <select
                  value=${form.from_currency}
                  onChange=${(event) => updateField("from_currency", event.target.value)}
                  className=${INPUT_CLASS}
                >
                  ${activeCurrencies.map(
                    (currency) => html`
                      <option key=${currency} value=${currency}>${currency}</option>
                    `,
                  )}
                </select>
              </label>
              <label className="block space-y-2">
                <span className="block text-xs font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                  Ke mata uang
                </span>
                <select
                  value=${form.to_currency}
                  onChange=${(event) => updateField("to_currency", event.target.value)}
                  className=${INPUT_CLASS}
                >
                  ${activeCurrencies.map(
                    (currency) => html`
                      <option key=${currency} value=${currency}>${currency}</option>
                    `,
                  )}
                </select>
              </label>
            </div>

            <label className="block space-y-2">
              <span className="block text-xs font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
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
              <span className="block text-xs font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
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
              <span className="block text-xs font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                Kurs ${form.from_currency} / 1 ${form.to_currency}
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
            </label>

            <div className="rounded-2xl border border-sky-300/25 bg-sky-400/10 px-4 py-3 text-sm font-black text-sky-800 dark:border-sky-300/20 dark:bg-sky-500/10 dark:text-sky-100">
              ${formatCurrency(fromAmount, form.from_currency)} -> ${formatCurrency(toAmount, form.to_currency)}
            </div>
          `
        : null}

      ${(isIncome || isExpense) && !isExchange
        ? html`
            <label className="block space-y-2">
              <span className="block text-xs font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
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
            <label className="block space-y-2">
              <span className="block text-xs font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
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

      <label className="block space-y-2">
        <span className="block text-xs font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
          Tanggal
        </span>
        <input
          type="datetime-local"
          required
          value=${form.occurred_at}
          onChange=${(event) => updateField("occurred_at", event.target.value)}
          className=${INPUT_CLASS}
        />
      </label>

      <div className="rounded-[22px] border border-slate-200/70 bg-white/45 p-2 dark:border-white/10 dark:bg-slate-900/30">
        <button
          type="button"
          onClick=${() => setShowAdvanced((current) => !current)}
          className="flex min-h-11 w-full items-center justify-between rounded-2xl px-3 text-sm font-black text-slate-700 transition hover:bg-white/70 dark:text-slate-200 dark:hover:bg-white/10"
        >
          <span>Opsi lanjutan</span>
          <span>${showAdvanced ? "Tutup" : "Ubah tipe / mata uang"}</span>
        </button>

        ${showAdvanced
          ? html`
              <div className="mt-2 grid gap-3 border-t border-slate-200/70 px-1 pt-3 dark:border-white/10">
                <div>
                  <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                    Tipe
                  </span>
                  <div className="cuan-segment grid grid-cols-3 gap-1 rounded-2xl p-1">
                    ${typeOptions.map((option) => {
                      const active = flow === option.value;
                      return html`
                        <button
                          key=${option.value}
                          type="button"
                          onClick=${() =>
                            onChange({
                              ...form,
                              type: option.value,
                              category:
                                option.value === "expense"
                                  ? form.category || DEFAULT_CATEGORY
                                  : form.category,
                              expense_currency:
                                option.value === "expense"
                                  ? form.expense_currency || baseCurrency
                                  : form.expense_currency,
                              locked_rate:
                                option.value === "expense" && flow !== "expense"
                                  ? ""
                                  : form.locked_rate,
                            })}
                          className=${`min-h-11 rounded-2xl px-2 py-2 text-xs font-black transition ${active ? "bg-brand-600 text-white shadow-[0_14px_34px_rgba(16,185,129,0.20)] dark:bg-emerald-500" : "text-slate-600 hover:bg-white/75 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"}`}
                        >
                          ${option.label}
                        </button>
                      `;
                    })}
                  </div>
                </div>

                ${isExpense
                  ? html`
                      <div>
                        <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                          Mata uang
                        </span>
                        <div className="cuan-segment grid grid-cols-2 gap-2 rounded-2xl p-1 sm:grid-cols-5">
                          ${activeCurrencies.map((currency) => {
                            const active = normalizeCurrencyCode(form.expense_currency) === currency;
                            return html`
                              <button
                                key=${currency}
                                type="button"
                                onClick=${() =>
                                  onChange({
                                    ...form,
                                    expense_currency: currency,
                                    locked_rate:
                                      currency === transactionCurrency
                                        ? form.locked_rate
                                        : "",
                                  })}
                                className=${`min-h-11 rounded-2xl px-3 py-2 text-sm font-black transition ${active ? "bg-brand-600 text-white shadow-[0_14px_34px_rgba(16,185,129,0.20)] dark:bg-emerald-500" : "text-slate-600 hover:bg-white/75 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"}`}
                              >
                                ${currency}
                              </button>
                            `;
                          })}
                        </div>
                      </div>
                    `
                  : null}
              </div>
            `
          : null}
      </div>

      <div className="history-detail-actions sticky bottom-0 z-10 -mx-5 mt-2 grid grid-cols-2 gap-3 border-t border-slate-200/70 bg-white/85 p-5 shadow-[0_-18px_50px_rgba(15,23,42,0.08)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/86 dark:shadow-black/28">
        <button
          type="button"
          onClick=${onCancel}
          className="cuan-secondary min-h-12 rounded-2xl px-4 py-3 text-sm font-black transition hover:-translate-y-0.5"
        >
          Batal
        </button>
        <button
          type="submit"
          disabled=${submitDisabled}
          className="min-h-12 rounded-2xl bg-brand-600 px-4 py-3 text-sm font-black text-white shadow-[0_18px_44px_rgba(16,185,129,0.22)] transition hover:-translate-y-0.5 hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:bg-emerald-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
        >
          ${loading ? "Menyimpan..." : "Simpan"}
        </button>
      </div>
    </form>
  `;
}

function ReceiptMetaCard({ label, value }) {
  return html`
    <div className="history-receipt-meta rounded-[20px] px-3 py-2.5">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-500">
        ${label}
      </p>
      <p className="mt-1 truncate text-sm font-black text-slate-900 dark:text-slate-100">
        ${value}
      </p>
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
  const rateText = transaction.rate || transaction.locked_rate
    ? formatRate(
        transaction.rate || transaction.locked_rate,
        isExchange ? transaction.from_currency : DEFAULT_BASE_CURRENCY,
        isExchange ? transaction.to_currency : currency,
      )
    : "-";
  const receiptMeta = isExchange
    ? [
        ["Dari", transaction.from_currency],
        ["Ke", transaction.to_currency],
        ["Ditukar", formatCurrency(transaction.from_amount, transaction.from_currency)],
        ["Diterima", formatCurrency(transaction.to_amount, transaction.to_currency)],
        ["Kurs", rateText],
        ["Tanggal", formatShortDateTime(transaction.occurred_at)],
      ]
    : [
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
        type="button"
        aria-label="Tutup detail transaksi"
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
        onClick=${onClose}
      ></button>
      <section className="history-detail-sheet transaction-sheet relative max-h-[calc(100svh-1rem)] w-full overflow-y-auto rounded-t-[30px] p-5 md:max-h-[86svh] md:max-w-lg md:rounded-[30px]">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700 md:hidden"></div>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              ${isEditing ? "Edit transaksi" : "Detail transaksi"}
            </p>
            <p className="mt-1 truncate text-sm font-bold text-slate-600 dark:text-slate-300">
              ${formatShortTime(transaction.occurred_at)} | ${getTransactionTypeLabel(transaction)}
            </p>
          </div>
          <button
            type="button"
            onClick=${onClose}
            className="cuan-secondary inline-flex min-h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg font-black"
            aria-label="Tutup"
          >
            x
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
                activeCurrencies=${activeCurrencies}
                baseCurrency=${baseCurrency}
              />
            `
          : html`
              <div className="history-receipt-card mt-5 overflow-hidden rounded-[28px] p-4">
                <div className="flex items-start gap-3">
                  <span className=${`flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] text-xs font-black uppercase tracking-[0.08em] ring-1 ${tone.historyIcon}`}>
                    ${getTransactionIconLabel(transaction)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xl font-black text-slate-950 dark:text-white">
                      ${description}
                    </p>
                    <p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400">
                      ${getTransactionTypeLabel(transaction)}
                    </p>
                  </div>
                </div>

                <div className="history-amount-card mt-5 rounded-[24px] p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">
                    Nominal
                  </p>
                  <p className=${`mt-2 break-words text-3xl font-black tracking-[-0.03em] ${tone.amount}`}>
                    ${amountText}
                  </p>
                  <p className="mt-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                    ${receiptHelper}
                  </p>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  ${receiptMeta.map(
                    ([label, value]) => html`
                      <${ReceiptMetaCard} key=${label} label=${label} value=${value} />
                    `,
                  )}
                </div>
              </div>

              <div className="history-detail-actions sticky bottom-0 z-10 -mx-5 mt-5 p-5">
                ${confirmingDelete
                  ? html`
                      <div className="history-delete-confirm rounded-[24px] p-4">
                        <p className="font-black text-slate-950 dark:text-white">
                          Yakin ingin menghapus transaksi ini?
                        </p>
                        <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                          Data akan dihapus dari riwayat dan semua saldo serta summary akan dihitung ulang.
                        </p>
                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick=${() => setConfirmingDelete(false)}
                            className="history-action-secondary min-h-12 rounded-2xl px-4 py-3 text-sm font-black transition hover:-translate-y-0.5"
                          >
                            Batal
                          </button>
                          <button
                            type="button"
                            disabled=${loading}
                            onClick=${handleConfirmDelete}
                            className="history-action-delete min-h-12 rounded-2xl px-4 py-3 text-sm font-black transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            ${loading ? "Menghapus..." : "Hapus"}
                          </button>
                        </div>
                      </div>
                    `
                  : html`
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick=${() => setIsEditing(true)}
                          className="history-action-primary min-h-12 rounded-2xl px-4 py-3 text-sm font-black transition hover:-translate-y-0.5"
                        >
                          Edit transaksi
                        </button>
                        <button
                          type="button"
                          onClick=${() => setConfirmingDelete(true)}
                          className="history-action-danger min-h-12 rounded-2xl px-4 py-3 text-sm font-black transition hover:-translate-y-0.5"
                        >
                          Hapus transaksi
                        </button>
                      </div>
                    `}
              </div>
            `}
      </section>
    </div>
  `;
}
