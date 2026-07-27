import React, { useEffect, useState } from "https://esm.sh/react@18.3.1";
import htm from "https://esm.sh/htm@3.1.1";
import { SubmitActionBar } from "../shared/SubmitActionBar.js";
import {
  getAssetAccountDisplayName,
  getCurrentValuationRateForCurrency,
  getSelectableAssetAccounts,
} from "../../domain/assets.js";
import {
  CATEGORY_OPTIONS,
  DEFAULT_CATEGORY,
  UNIVERSAL_BUDGET_GROUP,
  getBudgetCategoryKey,
} from "../../domain/budgets.js";
import {
  getExchangeRateToBase,
  getLatestExchangeForCurrencyUntil,
  settleExchangeCalculation,
} from "../../domain/exchange.js";
import {
  DEFAULT_ACTIVE_CURRENCIES,
  DEFAULT_BASE_CURRENCY,
  formatCurrency,
  formatNumericInput,
  getCurrencyOptions,
  normalizeCurrencyCode,
  normalizeCurrencyList,
  normalizeNumericInput,
} from "../../lib/currency.js";
import { toInputDateTime } from "../../lib/dates.js";

const html = htm.bind(React.createElement);
const PANEL_CLASS = "relative overflow-hidden rounded-[30px] cuan-card";
const INPUT_CLASS =
  "w-full min-h-12 rounded-2xl px-4 py-3.5 text-sm transition cuan-input";
export function TransactionForm({
  transactions,
  onSubmit,
  loading,
  activeCurrencies: activeCurrencySettings = DEFAULT_ACTIVE_CURRENCIES,
  dailyCurrency: dailyCurrencySetting = DEFAULT_BASE_CURRENCY,
  baseCurrency: baseCurrencySetting = DEFAULT_BASE_CURRENCY,
  assetAccounts = [],
  budgetInsights = [],
  globalRateSnapshot = null,
}) {
  const [entryType, setEntryType] = useState("income");
  const [incomeCurrency, setIncomeCurrency] = useState(() => baseCurrencySetting);
  const [expenseCurrency, setExpenseCurrency] = useState(() =>
    normalizeCurrencyCode(dailyCurrencySetting, baseCurrencySetting),
  );
  const [exchangeAutoTarget, setExchangeAutoTarget] = useState("to_amount");
  const [form, setForm] = useState({
    occurred_at: toInputDateTime(),
    description: "",
    category: DEFAULT_CATEGORY,
    amount_idr: "",
    amount_thb: "",
    amount: "",
    from_currency: baseCurrencySetting,
    to_currency: "THB",
    from_amount: "",
    to_amount: "",
    exchange_rate: "",
    source_account_id: "",
    destination_account_id: "",
  });

  const parsedAmountThb = Number(normalizeNumericInput(form.amount_thb));
  const parsedAmountIdr = Number(normalizeNumericInput(form.amount_idr));
  const parsedAmount = Number(normalizeNumericInput(form.amount));
  const baseCurrency = normalizeCurrencyCode(baseCurrencySetting);
  const activeCurrencies = normalizeCurrencyList(activeCurrencySettings, {
    baseCurrency,
  });
  const preferredExpenseCurrency = activeCurrencies.includes(
    normalizeCurrencyCode(dailyCurrencySetting, baseCurrency),
  )
    ? normalizeCurrencyCode(dailyCurrencySetting, baseCurrency)
    : activeCurrencies[0] || baseCurrency;
  const defaultForeignCurrency =
    activeCurrencies.find((currency) => currency !== baseCurrency) || baseCurrency;
  const isIncome = entryType === "income";
  const isExpense = entryType === "expense";
  const isExchange = entryType === "exchange";
  const settledExchangeForm = isExchange
    ? settleExchangeCalculation(form, "exchange_rate", {
        rateField: "exchange_rate",
        preferredTarget: exchangeAutoTarget,
      })
    : form;
  const parsedFromAmount = Number(normalizeNumericInput(settledExchangeForm.from_amount));
  const parsedToAmount = Number(normalizeNumericInput(settledExchangeForm.to_amount));
  const parsedExchangeRate = Number(normalizeNumericInput(form.exchange_rate));
  const selectedCurrency = isIncome ? incomeCurrency : expenseCurrency;
  const selectedCurrencyCode = normalizeCurrencyCode(selectedCurrency);
  const accountOptions = getSelectableAssetAccounts(assetAccounts, selectedCurrencyCode);
  const exchangeFromAccountOptions = getSelectableAssetAccounts(
    assetAccounts,
    form.from_currency,
  );
  const exchangeToAccountOptions = getSelectableAssetAccounts(
    assetAccounts,
    form.to_currency,
  );
  const accountOptionsKey = accountOptions.map((account) => account.id).join("|");
  const exchangeFromAccountOptionsKey = exchangeFromAccountOptions
    .map((account) => account.id)
    .join("|");
  const exchangeToAccountOptionsKey = exchangeToAccountOptions
    .map((account) => account.id)
    .join("|");
  const selectedAccountField = isIncome
    ? "destination_account_id"
    : "source_account_id";
  const isThb = selectedCurrencyCode === "THB";
  const isIdr = selectedCurrencyCode === "IDR";
  const isForeign = selectedCurrencyCode !== baseCurrency;
  const latestExpenseExchange =
    isExpense && isForeign
      ? getLatestExchangeForCurrencyUntil(
          transactions,
          selectedCurrencyCode,
          new Date(form.occurred_at || Date.now()),
          baseCurrency,
        )
      : null;
  const latestExpenseRate =
    isExpense && isForeign
      ? getExchangeRateToBase(latestExpenseExchange, selectedCurrencyCode, baseCurrency) ||
        getCurrentValuationRateForCurrency(
          globalRateSnapshot,
          selectedCurrencyCode,
          baseCurrency,
        ).rate ||
        0
      : 0;
  const parsedSelectedAmount = parsedAmount || (isIdr ? parsedAmountIdr : parsedAmountThb);
  const submitDisabled = isExchange
    ? parsedFromAmount <= 0 ||
      parsedToAmount <= 0 ||
      parsedExchangeRate <= 0 ||
      form.from_currency === form.to_currency ||
      (assetAccounts.length > 0 &&
        (!form.source_account_id || !form.destination_account_id))
    : parsedSelectedAmount <= 0 ||
      (accountOptions.length > 0 && !form[selectedAccountField]);
  const typeOptions = [
    { value: "income", label: "Pemasukan" },
    { value: "expense", label: "Pengeluaran" },
    ...(activeCurrencies.length > 1
      ? [{ value: "exchange", label: "Tukar Mata Uang" }]
      : []),
  ];
  const currencyOptions = getCurrencyOptions(activeCurrencies);
  const selectedBudgetInsight = isExpense
    ? budgetInsights.find(
        (item) =>
          item.categoryKey === getBudgetCategoryKey(form.category, UNIVERSAL_BUDGET_GROUP) &&
          (item.currency === selectedCurrencyCode || item.currency === baseCurrency),
      )
    : null;
  const selectedBudgetActivity =
    selectedBudgetInsight && isExpense
      ? selectedBudgetInsight.currency === selectedCurrencyCode
        ? parsedSelectedAmount
        : selectedBudgetInsight.currency === baseCurrency && selectedCurrencyCode === baseCurrency
          ? parsedSelectedAmount
          : selectedBudgetInsight.currency === baseCurrency && latestExpenseRate > 0
            ? parsedSelectedAmount * latestExpenseRate
            : null
      : null;
  const selectedBudgetOverAmount =
    selectedBudgetInsight && selectedBudgetActivity != null
      ? Math.max(selectedBudgetActivity - Math.max(selectedBudgetInsight.remainingAmount, 0), 0)
      : 0;

  useEffect(() => {
    if (!activeCurrencies.includes(incomeCurrency)) {
      setIncomeCurrency(activeCurrencies[0] || baseCurrency);
    }
    if (!activeCurrencies.includes(expenseCurrency)) {
      setExpenseCurrency(preferredExpenseCurrency);
    }
    if (entryType === "exchange" && activeCurrencies.length < 2) {
      setEntryType("expense");
    }
    setForm((current) => {
      const fromCurrency = activeCurrencies.includes(current.from_currency)
        ? current.from_currency
        : baseCurrency;
      const toCurrency =
        activeCurrencies.includes(current.to_currency) &&
        current.to_currency !== fromCurrency
          ? current.to_currency
          : activeCurrencies.find((currency) => currency !== fromCurrency) ||
            defaultForeignCurrency;
      return {
        ...current,
        from_currency: fromCurrency,
        to_currency: toCurrency,
      };
    });
  }, [
    activeCurrencies.join("|"),
    baseCurrency,
    defaultForeignCurrency,
    entryType,
    expenseCurrency,
    incomeCurrency,
    preferredExpenseCurrency,
  ]);

  useEffect(() => {
    setExpenseCurrency(preferredExpenseCurrency);
  }, [preferredExpenseCurrency]);

  useEffect(() => {
    if (isExchange) return;
    setForm((current) => {
      if (!accountOptions.length) {
        return current[selectedAccountField]
          ? { ...current, [selectedAccountField]: "" }
          : current;
      }
      if (accountOptions.some((account) => account.id === current[selectedAccountField])) {
        return current;
      }
      return {
        ...current,
        [selectedAccountField]: accountOptions[0].id,
      };
    });
  }, [isExchange, selectedAccountField, selectedCurrencyCode, accountOptionsKey]);

  function updateField(field, value) {
    if (field === "from_amount") setExchangeAutoTarget("to_amount");
    if (field === "to_amount") setExchangeAutoTarget("from_amount");
    setForm((current) => ({ ...current, [field]: value }));
  }

  function settleExchangeField(field) {
    setForm((current) =>
      settleExchangeCalculation(current, field, {
        rateField: "exchange_rate",
        preferredTarget: exchangeAutoTarget,
      }),
    );
  }

  function setCurrency(value) {
    if (isIncome) {
      setIncomeCurrency(value);
      return;
    }
    setExpenseCurrency(value);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const finalForm = isExchange
      ? settleExchangeCalculation(form, "exchange_rate", {
          rateField: "exchange_rate",
          preferredTarget: exchangeAutoTarget,
        })
      : form;
    if (isExchange) setForm(finalForm);

    const payload = {
      type: entryType,
      occurred_at: new Date(finalForm.occurred_at).toISOString(),
      description: finalForm.description.trim(),
      category_group: isExpense ? UNIVERSAL_BUDGET_GROUP : null,
      category: isExpense ? finalForm.category : null,
      currency: isExchange ? null : selectedCurrencyCode,
      amount: isExchange ? null : normalizeNumericInput(finalForm.amount || (isIdr ? finalForm.amount_idr : finalForm.amount_thb)),
      amount_idr: isIdr && !isExchange ? normalizeNumericInput(finalForm.amount || finalForm.amount_idr) : null,
      amount_thb: isThb && !isExchange ? normalizeNumericInput(finalForm.amount || finalForm.amount_thb) : null,
      exchange_rate: isExchange ? normalizeNumericInput(finalForm.exchange_rate) : latestExpenseRate || null,
      expense_currency: isExpense ? selectedCurrencyCode : null,
      from_currency: isExchange ? finalForm.from_currency : null,
      to_currency: isExchange ? finalForm.to_currency : null,
      from_amount: isExchange ? normalizeNumericInput(finalForm.from_amount) : null,
      to_amount: isExchange ? normalizeNumericInput(finalForm.to_amount) : null,
      rate: isExchange ? normalizeNumericInput(finalForm.exchange_rate) : null,
      source_account_id: isExpense ? finalForm.source_account_id || null : null,
      destination_account_id: isIncome ? finalForm.destination_account_id || null : null,
    };

    const succeeded = await onSubmit(payload);
    if (succeeded) {
      setForm({
        occurred_at: toInputDateTime(),
        description: "",
        category: DEFAULT_CATEGORY,
        amount_idr: "",
        amount_thb: "",
        amount: "",
        from_currency: baseCurrency,
        to_currency: defaultForeignCurrency,
        from_amount: "",
        to_amount: "",
        exchange_rate: "",
        source_account_id: "",
        destination_account_id: "",
      });
      setExchangeAutoTarget("to_amount");
    }
  }

  const typeButtonClass = (value) =>
    value === entryType
      ? "bg-brand-600 text-white shadow-[0_16px_40px_rgba(16,185,129,0.22)] dark:bg-emerald-500 dark:text-white"
      : "text-slate-700 hover:bg-white/70 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-white";
  const typeGridClass = activeCurrencies.length > 1 ? "grid-cols-3" : "grid-cols-2";
  const currencyButtonClass = (value) =>
    value === selectedCurrency
      ? "bg-brand-600 text-white shadow-[0_14px_34px_rgba(16,185,129,0.18)] dark:bg-emerald-500 dark:text-white"
      : "text-slate-700 hover:bg-white/70 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-white";

  return html`
    <div className=${`${PANEL_CLASS} p-5 md:p-6`}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),transparent_50%)] opacity-80"></div>
      <div className="relative">
        <h3 className="font-display text-xl font-bold">Tambah Transaksi</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300/80">
          Pilih jenis transaksi lalu mata uangnya.
        </p>
      </div>

      <div className=${`cuan-segment relative mt-5 grid ${typeGridClass} gap-2 rounded-2xl p-1`}>
        ${typeOptions.map(
          (option) => html`
            <button
              key=${option.value}
              type="button"
              onClick=${() => setEntryType(option.value)}
              className=${`rounded-2xl px-3 py-2.5 text-sm font-semibold transition duration-300 ${typeButtonClass(option.value)}`}
            >
              ${option.label}
            </button>
          `,
        )}
      </div>

      ${!isExchange
        ? html`
            <div className="relative mt-4">
              <span className="mb-2 block text-sm font-medium">Mata uang</span>
              <div className="cuan-segment grid grid-cols-2 gap-2 rounded-2xl p-1 sm:grid-cols-5">
                ${currencyOptions.map(
                  (option) => html`
                    <button
                      key=${option.value}
                      type="button"
                      onClick=${() => setCurrency(option.value)}
                      className=${`rounded-2xl px-3 py-2.5 text-sm font-semibold transition duration-300 ${currencyButtonClass(option.value)}`}
                    >
                      ${option.label}
                    </button>
                  `,
                )}
              </div>
            </div>
          `
        : null}

      <form className="relative mt-5 grid gap-4" onSubmit=${handleSubmit}>
        <label className="block">
          <span className="mb-2 block text-sm font-medium">Tanggal & waktu</span>
          <input
            type="datetime-local"
            required
            value=${form.occurred_at}
            onChange=${(event) => updateField("occurred_at", event.target.value)}
            className=${INPUT_CLASS}
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium">Deskripsi</span>
          <input
            type="text"
            placeholder=${isExchange
              ? "Beli baht / tukar USD"
              : isIncome
              ? isThb
                ? "Bonus THB / pemberian"
                : "Gaji bulanan"
              : isThb
                ? "Makan siang"
                : "Belanja bulanan"}
            value=${form.description}
            onChange=${(event) => updateField("description", event.target.value)}
            className=${INPUT_CLASS}
          />
        </label>

        ${!isExchange && accountOptions.length
          ? html`
              <label className="block">
                <span className="mb-2 block text-sm font-medium">
                  ${isIncome ? "Masuk ke akun" : "Keluar dari akun"}
                </span>
                <select
                  value=${form[selectedAccountField] || ""}
                  onChange=${(event) =>
                    updateField(selectedAccountField, event.target.value)}
                  className=${INPUT_CLASS}
                >
                  ${accountOptions.map(
                    (account) => html`
                      <option key=${account.id} value=${account.id}>
                        ${getAssetAccountDisplayName(account)}
                      </option>
                    `,
                  )}
                </select>
              </label>
            `
          : null}

        ${isExchange
          ? html`
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium">Dari mata uang</span>
                  <select
                    value=${form.from_currency}
                    onChange=${(event) => updateField("from_currency", event.target.value)}
                    className=${INPUT_CLASS}
                  >
                    ${currencyOptions.map(
                      (option) => html`
                        <option key=${option.value} value=${option.value}>
                          ${option.label}
                        </option>
                      `,
                    )}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium">Ke mata uang</span>
                  <select
                    value=${form.to_currency}
                    onChange=${(event) => updateField("to_currency", event.target.value)}
                    className=${INPUT_CLASS}
                  >
                    ${currencyOptions.map(
                      (option) => html`
                        <option key=${option.value} value=${option.value}>
                          ${option.label}
                        </option>
                      `,
                    )}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium">
                  Jumlah ${form.from_currency} ditukar
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  required
                  value=${form.from_amount}
                  onChange=${(event) =>
                    updateField("from_amount", formatNumericInput(event.target.value))}
                  onBlur=${() => settleExchangeField("from_amount")}
                  placeholder="0"
                  className=${INPUT_CLASS}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium">
                  Jumlah ${form.to_currency} diterima
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

              <label className="block">
                <span className="mb-2 block text-sm font-medium">
                  Kurs (${form.from_currency} / 1 ${form.to_currency})
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  required
                  value=${form.exchange_rate}
                  onChange=${(event) =>
                    updateField("exchange_rate", formatNumericInput(event.target.value))}
                  onBlur=${() => settleExchangeField("exchange_rate")}
                  placeholder="0"
                  className=${INPUT_CLASS}
                />
              </label>

              <div className="rounded-2xl border border-sky-300/25 bg-sky-400/10 px-4 py-3 text-sm font-black text-sky-800 backdrop-blur-xl dark:border-sky-300/20 dark:bg-sky-500/10 dark:text-sky-100">
                ${formatCurrency(parsedFromAmount, form.from_currency)} -> ${formatCurrency(parsedToAmount, form.to_currency)}
              </div>
            `
          : null}

        ${isExpense
          ? html`
              <label className="block">
                <span className="mb-2 block text-sm font-medium">Kategori Uang Keluar</span>
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

        ${!isExchange && isIdr
          ? html`
              <label className="block">
                <span className="mb-2 block text-sm font-medium">
                  ${isIncome ? "Jumlah uang masuk (IDR)" : "Jumlah uang keluar (IDR)"}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  required
                  value=${form.amount_idr}
                  onChange=${(event) =>
                    updateField("amount_idr", formatNumericInput(event.target.value))}
                  placeholder="0"
                  className=${INPUT_CLASS}
                />
              </label>
            `
          : null}

        ${!isExchange && isThb
          ? html`
              <label className="block">
                <span className="mb-2 block text-sm font-medium">
                  ${isIncome ? "Jumlah THB diterima" : "Jumlah uang keluar (THB)"}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  required
                  value=${form.amount_thb}
                  onChange=${(event) =>
                    updateField("amount_thb", formatNumericInput(event.target.value))}
                  placeholder=${isIncome ? "800" : "0"}
                  className=${INPUT_CLASS}
                />
              </label>
            `
          : null}

        ${!isExchange && !isIdr && !isThb
          ? html`
              <label className="block">
                <span className="mb-2 block text-sm font-medium">
                  ${isIncome ? "Jumlah uang masuk" : "Jumlah uang keluar"} (${selectedCurrencyCode})
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  required
                  value=${form.amount}
                  onChange=${(event) =>
                    updateField("amount", formatNumericInput(event.target.value))}
                  placeholder="0"
                  className=${INPUT_CLASS}
                />
              </label>
            `
          : null}

        ${isExpense && selectedBudgetOverAmount > 0
          ? html`
              <div className="rounded-2xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-900 backdrop-blur-xl dark:border-amber-300/20 dark:bg-amber-500/10 dark:text-amber-100">
                Transaksi ini melewati anggaran ${selectedBudgetInsight.categoryLabel} sebesar ${formatCurrency(
                  selectedBudgetOverAmount,
                  selectedBudgetInsight.currency,
                )}. Kamu tetap bisa simpan.
              </div>
            `
          : null}

        ${!isExchange && isIncome && isForeign
          ? html`
              <div className="rounded-2xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-900 backdrop-blur-xl dark:border-emerald-300/20 dark:bg-emerald-400/10 dark:text-emerald-200">
                <p className="font-semibold">
                  Pemasukan ini langsung menambah saldo ${selectedCurrencyCode}.
                </p>
                <p className="mt-1">Kalau berasal dari konversi IDR, gunakan tab Tukar Mata Uang.</p>
              </div>
            `
          : null}

        ${isExpense && isIdr
          ? html`
              <div className="rounded-2xl border border-sky-300/30 bg-sky-400/10 px-4 py-3 text-sm text-sky-900 backdrop-blur-xl dark:border-sky-300/20 dark:bg-sky-500/10 dark:text-sky-200">
                Belanja IDR akan langsung mengurangi saldo utama. Atur anggaran IDR di Kontrol jika ingin batas aman harian aktif.
              </div>
            `
          : null}

        <${SubmitActionBar}
          label=${isExchange
            ? "Simpan tukar mata uang"
            : isIncome
              ? "Simpan uang masuk"
              : "Simpan uang keluar"}
          loading=${loading}
          disabled=${submitDisabled}
        />
      </form>
    </div>
  `;
}


