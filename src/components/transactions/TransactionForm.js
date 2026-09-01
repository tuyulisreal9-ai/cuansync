import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import htm from "htm";
import {
  ArrowDown,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  Landmark,
  PiggyBank,
  WalletCards,
  X,
} from "lucide-react";
import {
  getCurrentValuationRateForCurrency,
  isSpendableAssetAccount,
  normalizeAssetAccounts,
} from "../../domain/assets.js";
import {
  CATEGORY_OPTIONS,
  DEFAULT_CATEGORY,
  UNIVERSAL_BUDGET_GROUP,
  getBudgetCategoryKey,
} from "../../domain/budgets.js";
import {
  addExchangeDecimals,
  compareExchangeDecimals,
  getDirectionalExchangeRate,
  getExchangeAmountDigits,
  getExchangeRateToBase,
  getLatestExchangeForCurrencyUntil,
  resolveNormalizedPairRate,
  serializeExchangeRate,
  settleExchangeCalculation,
  validateExchangeRate,
} from "../../domain/exchange.js";
import {
  DEFAULT_ACTIVE_CURRENCIES,
  DEFAULT_BASE_CURRENCY,
  formatCurrency,
  formatMoney,
  formatNumericInput,
  normalizeCurrencyCode,
  normalizeCurrencyList,
  normalizeNumericInput,
} from "../../lib/currency.js";
import { toInputDateTime } from "../../lib/dates.js";
import { FUTURE_TRANSACTION_DATE_MESSAGE } from "../../domain/transactions.js";
import { FormActionDock } from "../shared/FormActionDock.js";

const html = htm.bind(React.createElement);
const INPUT_CLASS =
  "cs-entry-input w-full min-h-11 rounded-lg px-3 py-2.5 text-sm transition";

function normalizeEntryType(value) {
  return value === "income" ? "income" : "expense";
}

function getAccountLabel(account) {
  const balance = Number(
    account.availableBalance ?? account.available_balance ??
      account.balance_amount ?? account.balanceAmount ?? 0,
  );
  return `${account.name} (${account.currency}) - Tersedia ${formatCurrency(
    balance,
    account.currency,
  )}`;
}

function getGoalSpendingAccountId(goal) {
  if (!goal) return "";
  const mappedSources = (goal.accountBreakdown || [])
    .filter((source) => Number(source.amount || 0) > 0.0001)
    .sort((left, right) => Number(right.amount || 0) - Number(left.amount || 0));
  return mappedSources.find(
    (source) => source.accountId === goal.primaryFundingAccountId,
  )?.accountId || mappedSources[0]?.accountId || "";
}

function getAccountBalance(account) {
  if (!account) return "";
  const actual = Number(account.balance_amount ?? account.balanceAmount ?? 0);
  const reserved = Number(account.reservedBalance ?? account.reserved_balance ?? 0);
  const available = Number(
    account.availableBalance ?? account.available_balance ?? actual - reserved,
  );
  return `Aktual ${formatCurrency(actual, account.currency)} • Dilindungi ${formatCurrency(
    reserved,
    account.currency,
  )} • Tersedia ${formatCurrency(available, account.currency)}`;
}

function formatExchangeAmount(value, currency) {
  const digits = getExchangeAmountDigits(currency);
  return formatMoney(Number(value || 0), currency, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function formatExchangeRateLabel({
  rateBaseCurrency,
  rateQuoteCurrency,
  exchangeRate,
}) {
  const rate = Number(exchangeRate || 0);
  if (!Number.isFinite(rate) || rate <= 0) return "Kurs belum tersedia";
  return `1 ${rateBaseCurrency} = ${formatMoney(rate, rateQuoteCurrency, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatRateInputValue(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const negative = raw.startsWith("-");
  const unsigned = raw.replace(/^[+-]/, "");
  const formatted = formatNumericInput(unsigned);
  if (!formatted) return negative ? "-" : "";
  return `${negative ? "-" : ""}${formatted}`;
}

function SegmentButton({ active, children, onClick, tone = "emerald" }) {
  const activeClass =
    tone === "rose"
      ? "bg-rose-500 text-white shadow-[0_10px_24px_rgba(244,63,94,0.2)]"
      : "bg-emerald-500 text-white shadow-[0_10px_24px_rgba(16,185,129,0.2)]";
  return html`
    <button
      type="button"
      aria-pressed=${active}
      onClick=${onClick}
      className=${`min-h-11 rounded-md px-2 text-xs font-extrabold transition ${
        active
          ? activeClass
          : "text-slate-600 hover:bg-slate-200/70 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
      }`}
    >
      ${children}
    </button>
  `;
}

function AccountBalanceHint({ account, label = "" }) {
  if (!account) return null;
  return html`
    <p className="cs-entry-account-hint mt-1.5 truncate px-2.5 py-1.5 text-[10px] font-medium">
      ${label
        ? html`
            ${label}:
            <strong className="text-slate-800 dark:text-slate-200">${account.currency}</strong>
            <span className="text-slate-400"> | </span>
            Saldo: ${formatCurrency(
              Number(account.balance_amount ?? account.balanceAmount ?? 0),
              account.currency,
            )}
          `
        : getAccountBalance(account)}
    </p>
  `;
}

export function TransactionForm({
  transactions,
  onSubmit,
  onClose,
  loading,
  activeCurrencies: activeCurrencySettings = DEFAULT_ACTIVE_CURRENCIES,
  dailyCurrency: dailyCurrencySetting = DEFAULT_BASE_CURRENCY,
  baseCurrency: baseCurrencySetting = DEFAULT_BASE_CURRENCY,
  assetAccounts = [],
  budgetInsights = [],
  goalInsights = [],
  globalRateSnapshot = null,
  initialEntryType = "expense",
  initialTargetId = "",
  initialExpenseCurrency = "",
  initialMovementMode = "exchange",
  workspace = false,
  onRequestAddWallet,
}) {
  const [entryType, setEntryType] = useState(() =>
    normalizeEntryType(initialEntryType),
  );
  const [movementMode, setMovementMode] = useState(() =>
    initialMovementMode === "transfer" ? "transfer" : "exchange",
  );
  const [rateMode, setRateMode] = useState("global");
  const [rateResetMessage, setRateResetMessage] = useState("");
  const [fundingPickerOpen, setFundingPickerOpen] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [exchangeAutoTarget, setExchangeAutoTarget] = useState("to_amount");
  const exchangeAutoTargetRef = useRef("to_amount");
  const previousExchangeDirectionRef = useRef("");
  const [incomeCurrency, setIncomeCurrency] = useState(() =>
    normalizeCurrencyCode(baseCurrencySetting),
  );
  const [expenseCurrency, setExpenseCurrency] = useState(() =>
    normalizeCurrencyCode(
      initialExpenseCurrency || dailyCurrencySetting,
      baseCurrencySetting,
    ),
  );
  const [form, setForm] = useState({
    occurred_at: toInputDateTime(),
    description: "",
    category: DEFAULT_CATEGORY,
    amount: "",
    from_currency: normalizeCurrencyCode(baseCurrencySetting),
    to_currency: "THB",
    from_amount: "",
    to_amount: "",
    exchange_rate: "",
    rate_base_currency: "",
    rate_quote_currency: "",
    rate_type: "realtime",
    fee_amount: "",
    source_account_id: "",
    destination_account_id: "",
    target_id: initialTargetId || "",
  });

  const baseCurrency = normalizeCurrencyCode(baseCurrencySetting);
  const activeCurrencies = normalizeCurrencyList(activeCurrencySettings, {
    baseCurrency,
  });
  const preferredExpenseCurrency = activeCurrencies.includes(
    normalizeCurrencyCode(
      initialExpenseCurrency || dailyCurrencySetting,
      baseCurrency,
    ),
  )
    ? normalizeCurrencyCode(
        initialExpenseCurrency || dailyCurrencySetting,
        baseCurrency,
      )
    : activeCurrencies[0] || baseCurrency;
  const defaultForeignCurrency =
    activeCurrencies.find((currency) => currency !== baseCurrency) || baseCurrency;
  const isIncome = entryType === "income";
  const isExpense = entryType === "expense";
  const isMovement = entryType === "exchange";
  const isTransfer = isMovement && movementMode === "transfer";
  const selectedCurrency = isIncome ? incomeCurrency : expenseCurrency;
  const selectedCurrencyCode = normalizeCurrencyCode(selectedCurrency);
  const selectedAccountField = isIncome
    ? "destination_account_id"
    : "source_account_id";
  const spendableAccounts = useMemo(
    () =>
      normalizeAssetAccounts(assetAccounts).filter((account) =>
        isSpendableAssetAccount(account),
      ),
    [assetAccounts],
  );
  const spendableAccountsKey = spendableAccounts
    .map(
      (account) =>
        `${account.id}:${account.currency}:${account.balance_amount}:${account.availableBalance}:${account.isPrimary}`,
    )
    .join("|");
  const accountById = new Map(spendableAccounts.map((account) => [account.id, account]));
  const eligibleGoals = isExpense
    ? goalInsights.filter(
        (goal) =>
          !["archived", "used"].includes(goal.status) &&
          Number(goal.availableAmount || 0) > 0,
      )
    : [];
  const selectedGoal =
    eligibleGoals.find((goal) => goal.id === form.target_id) || null;
  const selectedGoalSources = selectedGoal?.accountBreakdown?.filter(
    (source) => Number(source.amount || 0) > 0.0001,
  ) || [];
  const selectedGoalSourceIds = new Set(
    selectedGoalSources.map((source) => source.accountId),
  );
  const entryAccountOptions = isExpense && selectedGoal
    ? spendableAccounts.filter((account) => selectedGoalSourceIds.has(account.id))
    : spendableAccounts;
  const selectedEntryAccount = accountById.get(form[selectedAccountField]) || null;
  const selectedGoalSource = selectedGoalSources.find(
    (source) => source.accountId === selectedEntryAccount?.id,
  ) || null;
  const sourceAccount = accountById.get(form.source_account_id) || null;
  const destinationAccount = accountById.get(form.destination_account_id) || null;
  const entryAmount = Number(normalizeNumericInput(form.amount) || 0);
  const selectedAvailableBalance = Number(
    selectedEntryAccount?.availableBalance ??
      selectedEntryAccount?.available_balance ??
      selectedEntryAccount?.balance_amount ??
      0,
  );
  const crossesProtectedFunds =
    isExpense &&
    !form.target_id &&
    entryAmount > selectedAvailableBalance + 0.0001;
  const exceedsSelectedSavings =
    isExpense &&
    Boolean(selectedGoal) &&
    entryAmount > Number(selectedGoalSource?.amount || 0) + 0.0001;
  const exceedsActualAccountBalance =
    isExpense &&
    Boolean(selectedGoal) &&
    entryAmount > Number(
      selectedEntryAccount?.balance_amount ?? selectedEntryAccount?.balanceAmount ?? 0,
    ) + 0.0001;
  const expenseFundingTitle = selectedGoal
    ? selectedGoal.name
    : selectedEntryAccount?.name || "Pilih dompet";
  const expenseFundingSubtitle = selectedGoal
    ? selectedEntryAccount
      ? `${selectedEntryAccount.name} • ${formatCurrency(
          selectedGoalSource?.amount || 0,
          selectedGoal.currency,
        )} tersedia`
      : "Dompet sumber belum terhubung"
    : selectedEntryAccount
      ? `${selectedEntryAccount.currency} • ${formatCurrency(
          selectedAvailableBalance,
          selectedEntryAccount.currency,
        )} tersedia`
      : "Sumber dana belum dipilih";
  const movementDestinationOptions = sourceAccount
    ? spendableAccounts.filter((account) =>
        isTransfer
          ? account.id !== sourceAccount.id && account.currency === sourceAccount.currency
          : account.id !== sourceAccount.id && account.currency !== sourceAccount.currency,
      )
    : spendableAccounts;
  const globalPairRate = resolveNormalizedPairRate(
    globalRateSnapshot,
    form.from_currency,
    form.to_currency,
    baseCurrency,
  );
  const fallbackRateBaseCurrency =
    form.from_currency === baseCurrency
      ? form.to_currency
      : form.from_currency;
  const fallbackRateQuoteCurrency =
    fallbackRateBaseCurrency === form.from_currency
      ? form.to_currency
      : form.from_currency;
  const rateBaseCurrency =
    form.rate_base_currency ||
    (globalPairRate.exchangeRate
      ? globalPairRate.rateBaseCurrency
      : fallbackRateBaseCurrency);
  const rateQuoteCurrency =
    form.rate_quote_currency ||
    (globalPairRate.exchangeRate
      ? globalPairRate.rateQuoteCurrency
      : fallbackRateQuoteCurrency);
  const currentRateOrientation = {
    rateBaseCurrency,
    rateQuoteCurrency,
    exchangeRate: form.exchange_rate,
  };
  const settledMovementForm = isMovement
    ? settleExchangeCalculation(form, "exchange_rate", {
        rateField: "exchange_rate",
        preferredTarget: exchangeAutoTargetRef.current,
        rateBaseCurrency,
        rateQuoteCurrency,
      })
    : form;
  const parsedAmount = Number(normalizeNumericInput(form.amount));
  const parsedFromAmount = Number(
    normalizeNumericInput(settledMovementForm.from_amount),
  );
  const parsedToAmount = Number(
    normalizeNumericInput(settledMovementForm.to_amount),
  );
  const parsedFeeAmount = Math.max(Number(normalizeNumericInput(form.fee_amount)), 0);
  const serializedExchangeRate = serializeExchangeRate(form.exchange_rate);
  const parsedExchangeRate = Number(serializedExchangeRate || 0);
  const exchangeRateValidation = validateExchangeRate(form.exchange_rate);
  const sourceDebitAmount = addExchangeDecimals(
    normalizeNumericInput(settledMovementForm.from_amount) || "0",
    normalizeNumericInput(form.fee_amount) || "0",
  );
  const sourceBalanceAmount = Number(
    sourceAccount?.balance_amount ?? sourceAccount?.balanceAmount ?? 0,
  );
  const sourceBalanceSufficient =
    !sourceAccount ||
    compareExchangeDecimals(sourceDebitAmount || "0", String(sourceBalanceAmount)) <= 0;
  const isForeignExpense = isExpense && selectedCurrencyCode !== baseCurrency;
  const latestExpenseExchange =
    isForeignExpense
      ? getLatestExchangeForCurrencyUntil(
          transactions,
          selectedCurrencyCode,
          new Date(form.occurred_at || Date.now()),
          baseCurrency,
        )
      : null;
  const latestExpenseRate =
    isForeignExpense
      ? getExchangeRateToBase(
          latestExpenseExchange,
          selectedCurrencyCode,
          baseCurrency,
        ) ||
          getCurrentValuationRateForCurrency(
            globalRateSnapshot,
            selectedCurrencyCode,
            baseCurrency,
          ).rate ||
          0
      : 0;
  const selectedBudgetInsight = isExpense
    ? budgetInsights.find(
        (item) =>
          item.categoryKey ===
            getBudgetCategoryKey(form.category, UNIVERSAL_BUDGET_GROUP) &&
          (item.currency === selectedCurrencyCode || item.currency === baseCurrency),
      )
    : null;
  const selectedBudgetActivity =
    selectedBudgetInsight && isExpense
      ? selectedBudgetInsight.currency === selectedCurrencyCode
        ? parsedAmount
        : selectedBudgetInsight.currency === baseCurrency && selectedCurrencyCode === baseCurrency
          ? parsedAmount
          : selectedBudgetInsight.currency === baseCurrency && latestExpenseRate > 0
            ? parsedAmount * latestExpenseRate
            : null
      : null;
  const selectedBudgetOverAmount =
    selectedBudgetInsight && selectedBudgetActivity != null
      ? Math.max(
          selectedBudgetActivity - Math.max(selectedBudgetInsight.remainingAmount, 0),
          0,
        )
      : 0;
  const movementReady =
    sourceAccount &&
    destinationAccount &&
    sourceAccount.id !== destinationAccount.id &&
    (isTransfer
      ? sourceAccount.currency === destinationAccount.currency && parsedExchangeRate === 1
      : sourceAccount.currency !== destinationAccount.currency && parsedExchangeRate > 0);
  const occurredAtTime = new Date(form.occurred_at).getTime();
  const transactionDateInvalid =
    Number.isNaN(occurredAtTime) || occurredAtTime > Date.now();
  const submitDisabled = isMovement
    ? parsedFromAmount <= 0 ||
      parsedToAmount <= 0 ||
      !movementReady ||
      !exchangeRateValidation.valid ||
      !sourceBalanceSufficient ||
      transactionDateInvalid
    : parsedAmount <= 0 ||
      !selectedEntryAccount ||
      crossesProtectedFunds ||
      exceedsSelectedSavings ||
      exceedsActualAccountBalance ||
      transactionDateInvalid;

  useEffect(() => {
    setEntryType(workspace ? "exchange" : normalizeEntryType(initialEntryType));
    if (!workspace && initialExpenseCurrency) {
      setExpenseCurrency(
        normalizeCurrencyCode(initialExpenseCurrency, baseCurrencySetting),
      );
    }
    setForm((current) => ({
      ...current,
      target_id: initialTargetId || "",
    }));
    if (initialEntryType === "exchange" || workspace) {
      setMovementMode(initialMovementMode === "transfer" ? "transfer" : "exchange");
    }
  }, [
    baseCurrencySetting,
    initialEntryType,
    initialExpenseCurrency,
    initialMovementMode,
    initialTargetId,
    workspace,
  ]);

  useEffect(() => {
    if (!activeCurrencies.includes(incomeCurrency)) {
      setIncomeCurrency(activeCurrencies[0] || baseCurrency);
    }
    if (!activeCurrencies.includes(expenseCurrency)) {
      setExpenseCurrency(preferredExpenseCurrency);
    }
    if (!workspace && isMovement && activeCurrencies.length < 2 && !isTransfer) {
      setEntryType("expense");
    }
  }, [
    activeCurrencies.join("|"),
    baseCurrency,
    expenseCurrency,
    incomeCurrency,
    isMovement,
    isTransfer,
    preferredExpenseCurrency,
    workspace,
  ]);

  useEffect(() => {
    if (isMovement || !spendableAccounts.length) return;
    const field = isIncome ? "destination_account_id" : "source_account_id";
    const selected = accountById.get(form[field]);
    const contextualGoal = goalInsights.find(
      (goal) => goal.id === (form.target_id || initialTargetId),
    );
    const selectedMatchesGoal = !contextualGoal || contextualGoal.accountBreakdown?.some(
      (source) =>
        source.accountId === selected?.id && Number(source.amount || 0) > 0.0001,
    );
    if (selected && selectedMatchesGoal) return;
    const compatible = spendableAccounts.filter(
      (account) => account.currency === selectedCurrencyCode,
    );
    const goalAccountId = getGoalSpendingAccountId(contextualGoal);
    const recentTransaction = [...transactions]
      .reverse()
      .find(
        (transaction) =>
          transaction.type === (isIncome ? "income" : "expense") &&
          transaction.currency === selectedCurrencyCode,
      );
    const recentAccountId = isIncome
      ? recentTransaction?.destination_account_id
      : recentTransaction?.source_account_id;
    const fallback =
      compatible.find((account) => account.id === goalAccountId) ||
      compatible.find((account) => account.isPrimary || account.is_primary) ||
      compatible.find((account) => account.id === recentAccountId) ||
      compatible.find((account) => account.account_purpose === "daily") ||
      compatible[0] ||
      spendableAccounts[0];
    if (!fallback) return;
    setForm((current) => ({ ...current, [field]: fallback.id }));
    if (isIncome) setIncomeCurrency(fallback.currency);
    else setExpenseCurrency(fallback.currency);
  }, [
    isMovement,
    isIncome,
    selectedCurrencyCode,
    spendableAccountsKey,
    form.target_id,
    goalInsights,
    transactions,
  ]);

  function selectTarget(targetId) {
    const target = goalInsights.find((goal) => goal.id === targetId);
    const targetAccountId = getGoalSpendingAccountId(target);
    if (target?.currency) setExpenseCurrency(target.currency);
    setForm((current) => ({
      ...current,
      target_id: targetId,
      source_account_id: targetId ? targetAccountId : current.source_account_id,
    }));
  }

  function selectExpenseFundingMode(mode) {
    if (mode === "savings") {
      const target = selectedGoal || eligibleGoals[0] || null;
      const targetAccountId = getGoalSpendingAccountId(target);
      if (target?.currency) setExpenseCurrency(target.currency);
      setForm((current) => ({
        ...current,
        target_id: target?.id || "",
        source_account_id: targetAccountId,
      }));
      return;
    }

    const compatible = spendableAccounts.filter(
      (account) => account.currency === selectedCurrencyCode,
    );
    const fallback =
      compatible.find(
        (account) =>
          Number(account.availableBalance ?? account.available_balance ?? 0) > 0.0001 &&
          (account.isPrimary || account.is_primary),
      ) ||
      compatible.find(
        (account) => Number(account.availableBalance ?? account.available_balance ?? 0) > 0.0001,
      ) ||
      compatible[0] ||
      null;
    setForm((current) => ({
      ...current,
      target_id: "",
      source_account_id: fallback?.id || "",
    }));
  }

  useEffect(() => {
    if (!isExpense || !form.target_id) return;
    const targetStillValid = goalInsights.some(
      (goal) =>
        goal.id === form.target_id &&
        goal.currency === selectedCurrencyCode &&
        !["archived", "used"].includes(goal.status),
    );
    if (!targetStillValid) {
      setForm((current) => ({ ...current, target_id: "" }));
    }
  }, [form.target_id, goalInsights, isExpense, selectedCurrencyCode]);

  useEffect(() => {
    if (!isMovement || !spendableAccounts.length) return;
    setForm((current) => {
      const currentSource = accountById.get(current.source_account_id);
      const source = currentSource || spendableAccounts[0];
      const destinationCandidates = spendableAccounts.filter((account) =>
        isTransfer
          ? account.id !== source.id && account.currency === source.currency
          : account.id !== source.id && account.currency !== source.currency,
      );
      const currentDestination = accountById.get(current.destination_account_id);
      const destination = destinationCandidates.some(
        (account) => account.id === currentDestination?.id,
      )
        ? currentDestination
        : destinationCandidates[0] || null;
      const next = {
        ...current,
        source_account_id: source.id,
        destination_account_id: destination?.id || "",
        from_currency: source.currency,
        to_currency: isTransfer
          ? source.currency
          : destination?.currency ||
            activeCurrencies.find((currency) => currency !== source.currency) ||
            defaultForeignCurrency,
      };
      if (isTransfer) {
        next.exchange_rate = "1";
        next.rate_base_currency = source.currency;
        next.rate_quote_currency = source.currency;
        next.rate_type = "transfer";
        next.to_amount = next.from_amount;
      }
      return next;
    });
  }, [
    isMovement,
    isTransfer,
    spendableAccountsKey,
    activeCurrencies.join("|"),
    defaultForeignCurrency,
  ]);

  useEffect(() => {
    if (!isMovement || isTransfer) return;
    const directionKey = `${form.from_currency}>${form.to_currency}`;
    const previousDirection = previousExchangeDirectionRef.current;
    const directionChanged =
      previousDirection && previousDirection !== directionKey;
    previousExchangeDirectionRef.current = directionKey;

    if (rateMode === "custom" && directionChanged) {
      setForm((current) => ({
        ...current,
        exchange_rate: "",
        to_amount: "",
        rate_base_currency:
          globalPairRate.exchangeRate
            ? globalPairRate.rateBaseCurrency
            : fallbackRateBaseCurrency,
        rate_quote_currency:
          globalPairRate.exchangeRate
            ? globalPairRate.rateQuoteCurrency
            : fallbackRateQuoteCurrency,
        rate_type: "custom",
      }));
      setRateResetMessage(
        "Kurs custom direset karena arah atau pasangan dompet berubah. Masukkan kurs money changer terbaru.",
      );
    }
  }, [
    form.from_currency,
    form.to_currency,
    globalPairRate.exchangeRate,
    globalPairRate.rateBaseCurrency,
    globalPairRate.rateQuoteCurrency,
    fallbackRateBaseCurrency,
    fallbackRateQuoteCurrency,
    isMovement,
    isTransfer,
    rateMode,
  ]);

  useEffect(() => {
    if (!isMovement || isTransfer || rateMode !== "global") return;
    if (!globalPairRate.exchangeRate) {
      setForm((current) => ({
        ...current,
        exchange_rate: "",
        [exchangeAutoTargetRef.current]: "",
        rate_base_currency: fallbackRateBaseCurrency,
        rate_quote_currency: fallbackRateQuoteCurrency,
        rate_type: "realtime",
      }));
      return;
    }
    setRateResetMessage("");
    setForm((current) => {
      const next = {
        ...current,
        exchange_rate: globalPairRate.exchangeRate,
        rate_base_currency: globalPairRate.rateBaseCurrency,
        rate_quote_currency: globalPairRate.rateQuoteCurrency,
        rate_type: "realtime",
      };
      return settleExchangeCalculation(next, "exchange_rate", {
        rateField: "exchange_rate",
        preferredTarget: exchangeAutoTargetRef.current,
        rateBaseCurrency: globalPairRate.rateBaseCurrency,
        rateQuoteCurrency: globalPairRate.rateQuoteCurrency,
      });
    });
  }, [
    fallbackRateBaseCurrency,
    fallbackRateQuoteCurrency,
    globalPairRate.exchangeRate,
    globalPairRate.rateBaseCurrency,
    globalPairRate.rateQuoteCurrency,
    exchangeAutoTarget,
    isMovement,
    isTransfer,
    rateMode,
  ]);

  function updateField(field, value) {
    if (field === "from_amount") {
      exchangeAutoTargetRef.current = "to_amount";
      setExchangeAutoTarget("to_amount");
    }
    if (field === "to_amount") {
      exchangeAutoTargetRef.current = "from_amount";
      setExchangeAutoTarget("from_amount");
    }
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (isTransfer && field === "from_amount") {
        next.to_amount = value;
        next.exchange_rate = "1";
      }
      /* Pada transfer kedua sisi memakai mata uang yang sama, jadi mengetik di
         kolom "Ke" harus mengisi balik "Dari" dengan nilai yang sama. Tanpa
         ini kolom bawah bisa diisi tetapi nominal yang dikirim tetap kosong. */
      if (isTransfer && field === "to_amount") {
        next.from_amount = value;
        next.exchange_rate = "1";
      }
      if (
        isMovement &&
        !isTransfer &&
        ["from_amount", "to_amount", "exchange_rate"].includes(field)
      ) {
        if (
          field === "exchange_rate" &&
          !validateExchangeRate(value).valid
        ) {
          next[exchangeAutoTargetRef.current] = "";
          return next;
        }
        return settleExchangeCalculation(next, field, {
          rateField: "exchange_rate",
          preferredTarget:
            field === "to_amount"
              ? "from_amount"
              : field === "from_amount"
                ? "to_amount"
                : exchangeAutoTargetRef.current,
          rateBaseCurrency: next.rate_base_currency || rateBaseCurrency,
          rateQuoteCurrency: next.rate_quote_currency || rateQuoteCurrency,
        });
      }
      return next;
    });
  }

  function settleExchangeField(field) {
    if (isTransfer) return;
    setForm((current) =>
      settleExchangeCalculation(current, field, {
        rateField: "exchange_rate",
        preferredTarget: exchangeAutoTargetRef.current,
        rateBaseCurrency: current.rate_base_currency || rateBaseCurrency,
        rateQuoteCurrency: current.rate_quote_currency || rateQuoteCurrency,
      }),
    );
  }

  function selectEntryAccount(accountId) {
    const account = accountById.get(accountId);
    updateField(selectedAccountField, accountId);
    if (!account) return;
    if (isIncome) setIncomeCurrency(account.currency);
    else setExpenseCurrency(account.currency);
  }

  function selectMovementAccount(field, accountId) {
    const account = accountById.get(accountId);
    if (!account) return;
    setForm((current) => {
      const next = { ...current, [field]: accountId };
      if (field === "source_account_id") {
        next.from_currency = account.currency;
        if (isTransfer) {
          next.to_currency = account.currency;
          next.exchange_rate = "1";
          next.rate_base_currency = account.currency;
          next.rate_quote_currency = account.currency;
          next.rate_type = "transfer";
          next.to_amount = next.from_amount;
        }
      } else {
        next.to_currency = account.currency;
      }
      return next;
    });
  }

  function changeMovementMode(nextMode) {
    setMovementMode(nextMode);
    setRateMode(nextMode === "transfer" ? "custom" : "global");
    if (nextMode === "transfer") {
      setRateResetMessage("");
      setForm((current) => ({
        ...current,
        to_currency: current.from_currency,
        to_amount: current.from_amount,
        exchange_rate: "1",
        rate_base_currency: current.from_currency,
        rate_quote_currency: current.from_currency,
        rate_type: "transfer",
      }));
    }
  }

  function changeRateMode(nextMode) {
    setRateMode(nextMode);
    setRateResetMessage("");
    if (nextMode === "custom") {
      setForm((current) => ({
        ...current,
        exchange_rate:
          serializeExchangeRate(current.exchange_rate) ||
          globalPairRate.exchangeRate ||
          "",
        rate_base_currency:
          globalPairRate.rateBaseCurrency || fallbackRateBaseCurrency,
        rate_quote_currency:
          globalPairRate.rateQuoteCurrency || fallbackRateQuoteCurrency,
        rate_type: "custom",
      }));
      return;
    }
    if (!globalPairRate.exchangeRate) return;
    setForm((current) => {
      const next = {
        ...current,
        exchange_rate: globalPairRate.exchangeRate,
        rate_base_currency: globalPairRate.rateBaseCurrency,
        rate_quote_currency: globalPairRate.rateQuoteCurrency,
        rate_type: "realtime",
      };
      return settleExchangeCalculation(next, "exchange_rate", {
        rateField: "exchange_rate",
        preferredTarget: exchangeAutoTargetRef.current,
        rateBaseCurrency: globalPairRate.rateBaseCurrency,
        rateQuoteCurrency: globalPairRate.rateQuoteCurrency,
      });
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (transactionDateInvalid) {
      setShowMoreOptions(true);
      return;
    }
    if (!spendableAccounts.length) {
      onRequestAddWallet?.();
      return;
    }
    const finalForm = isMovement && !isTransfer
      ? settleExchangeCalculation(form, "exchange_rate", {
          rateField: "exchange_rate",
          preferredTarget: exchangeAutoTargetRef.current,
          rateBaseCurrency,
          rateQuoteCurrency,
        })
      : isTransfer
        ? {
            ...form,
            to_amount: form.from_amount,
            exchange_rate: "1",
            rate_base_currency: form.from_currency,
            rate_quote_currency: form.from_currency,
            rate_type: "transfer",
          }
        : form;
    if (isMovement) setForm(finalForm);

    const fallbackDescription = isMovement
      ? isTransfer
        ? "Transfer antar dompet"
        : `Tukar ${finalForm.from_currency} ke ${finalForm.to_currency}`
      : isIncome
        ? "Pemasukan"
        : "Pengeluaran";
    const directionalExchangeRate = isMovement
      ? isTransfer
        ? "1"
        : getDirectionalExchangeRate({
            sourceCurrency: finalForm.from_currency,
            targetCurrency: finalForm.to_currency,
            rateBaseCurrency:
              finalForm.rate_base_currency || rateBaseCurrency,
            rateQuoteCurrency:
              finalForm.rate_quote_currency || rateQuoteCurrency,
            exchangeRate: finalForm.exchange_rate,
          })
      : null;
    const payload = {
      type: entryType,
      occurred_at: new Date(finalForm.occurred_at).toISOString(),
      description: finalForm.description.trim() || fallbackDescription,
      category_group: isExpense ? UNIVERSAL_BUDGET_GROUP : null,
      category: isExpense ? finalForm.category : null,
      currency: isMovement ? null : selectedCurrencyCode,
      amount: isMovement ? null : normalizeNumericInput(finalForm.amount),
      amount_idr: null,
      amount_thb: null,
      exchange_rate: isMovement
        ? serializeExchangeRate(finalForm.exchange_rate)
        : latestExpenseRate || null,
      expense_currency: isExpense ? selectedCurrencyCode : null,
      from_currency: isMovement ? finalForm.from_currency : null,
      to_currency: isMovement ? finalForm.to_currency : null,
      from_amount: isMovement ? normalizeNumericInput(finalForm.from_amount) : null,
      to_amount: isMovement ? normalizeNumericInput(finalForm.to_amount) : null,
      rate: isMovement ? directionalExchangeRate : null,
      rate_base_currency: isMovement
        ? finalForm.rate_base_currency || rateBaseCurrency
        : null,
      rate_quote_currency: isMovement
        ? finalForm.rate_quote_currency || rateQuoteCurrency
        : null,
      rate_type: isMovement
        ? isTransfer
          ? "transfer"
          : rateMode === "custom"
            ? "custom"
            : "realtime"
        : null,
      fee_amount: isMovement ? normalizeNumericInput(finalForm.fee_amount) : null,
      source_account_id: isMovement || isExpense
        ? finalForm.source_account_id || null
        : null,
      destination_account_id: isMovement || isIncome
        ? finalForm.destination_account_id || null
        : null,
      target_id: isExpense ? finalForm.target_id || null : null,
    };

    const succeeded = await onSubmit(payload);
    if (succeeded) {
      onClose?.();
    }
  }

  const typeOptions = [
    { value: "income", label: "Pemasukan", tone: "emerald", icon: ArrowDownLeft },
    { value: "expense", label: "Pengeluaran", tone: "rose", icon: ArrowUpRight },
  ];

  /* Tampilan khusus "Kirim antar dompet" dan "Tukar mata uang" mengikuti
     artifact desain. Yang berubah hanya markup: seluruh state, handler,
     perhitungan kurs, validasi, dan payload memakai yang sudah ada di atas
     supaya tidak ada logika yang bergeser. Ditempatkan sesudah semua hook
     agar urutan hook React tetap sama di setiap render. */
  if (workspace) {
    const movementTitle = isTransfer ? "Kirim antar dompet" : "Tukar mata uang";
    /* Desain menampilkan simbol mata uang ("Rp", "$"), bukan kodenya. Simbol
       diturunkan dari hasil format nol karena registry tidak menyimpannya. */
    const symbolOf = (code) =>
      formatCurrency(0, code || baseCurrency)
        .replace(/[\d.,\s]/g, "")
        .trim() || (code || baseCurrency);
    const fromSymbol = symbolOf(form.from_currency);
    const toSymbol = symbolOf(form.to_currency);

    const walletChip = (account, active, onPick) => html`
      <button
        key=${account.id}
        type="button"
        onClick=${onPick}
        aria-pressed=${active}
        className="dc-press dc-press-94 flex min-h-11 flex-none flex-col justify-center gap-0.5 rounded-[14px] border px-3.5 text-left"
        style=${active
          ? {
              background: "var(--cs-sel-bg)",
              color: "var(--cs-sel-fg)",
              borderColor: "var(--cs-sel-bg)",
            }
          : {
              background: "var(--cs-card)",
              color: "var(--cs-body)",
              borderColor: "var(--cs-line)",
            }}
      >
        <span className="whitespace-nowrap text-[12.5px] font-bold">
          ${account.name}
        </span>
        <span className="whitespace-nowrap text-[10.5px] opacity-75">
          ${formatMoney(
            Number(account.balance_amount ?? account.balanceAmount ?? 0),
            account.currency,
          )}
        </span>
      </button>
    `;

    return html`
      <div className="cs-movement-workspace flex w-full flex-col gap-4 pb-28">
        <div className="flex items-center justify-between">
          <span className="text-[17px] font-bold tracking-[-0.2px]">
            ${movementTitle}
          </span>
          <button
            type="button"
            onClick=${onClose}
            className="flex min-h-11 items-center pl-4 text-[13px]"
            style=${{ color: "var(--cs-mut)" }}
          >
            Nanti
          </button>
        </div>

        ${!spendableAccounts.length
          ? html`
              <div
                className="dc-card flex flex-col gap-3 p-4 text-[13px] leading-[1.45]"
                style=${{ color: "var(--cs-body)" }}
              >
                <p>
                  Tambahkan minimal dua dompet aktif sebelum membuat transfer
                  atau tukar mata uang.
                </p>
                ${onRequestAddWallet
                  ? html`
                      <button
                        type="button"
                        onClick=${onRequestAddWallet}
                        className="dc-press dc-press-96 min-h-[52px] rounded-[17px] text-[15px] font-bold"
                        style=${{
                          background: "var(--cs-acc)",
                          color: "var(--cs-on-acc)",
                        }}
                      >
                        Tambah dompet
                      </button>
                    `
                  : null}
              </div>
            `
          : html`
              <${React.Fragment}>
              <div
                className="dc-card flex flex-col gap-3 rounded-[20px] p-4"
              >
                <span className="text-xs" style=${{ color: "var(--cs-mut)" }}>
                  Dari
                </span>
                <div className="dc-scroll-x flex gap-2 overflow-x-auto pb-0.5">
                  ${spendableAccounts.map((account) =>
                    walletChip(
                      account,
                      account.id === form.source_account_id,
                      () => selectMovementAccount("source_account_id", account.id),
                    ),
                  )}
                </div>
                <div
                  className="flex items-end gap-1.5 pb-2"
                  style=${{ borderBottom: "1.5px solid var(--cs-line)" }}
                >
                  <span
                    className="pb-[3px] text-[15px]"
                    style=${{ color: "var(--cs-mut)" }}
                  >
                    ${fromSymbol}
                  </span>
                  <input
                    inputMode="decimal"
                    autoComplete="off"
                    value=${form.from_amount}
                    onChange=${(event) =>
                      updateField(
                        "from_amount",
                        formatNumericInput(event.target.value),
                      )}
                    onBlur=${() => settleExchangeField("from_amount")}
                    placeholder="0"
                    className="dc-num min-w-0 flex-1 border-none bg-transparent p-0 text-[26px] tracking-[-0.8px] outline-none"
                    style=${{ color: "var(--cs-ink)" }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 px-1">
                <span
                  className="h-px flex-1"
                  style=${{ background: "var(--cs-line)" }}
                ></span>
                <span
                  className="flex h-8 w-8 flex-none items-center justify-center rounded-[11px]"
                  style=${{ background: "var(--cs-chip)" }}
                >
                  <${ArrowDown}
                    aria-hidden="true"
                    className="h-4 w-4"
                    style=${{ color: "var(--cs-body)" }}
                    strokeWidth=${1.75}
                  />
                </span>
                <span
                  className="h-px flex-1"
                  style=${{ background: "var(--cs-line)" }}
                ></span>
              </div>

              <div className="dc-card flex flex-col gap-3 rounded-[20px] p-4">
                <span className="text-xs" style=${{ color: "var(--cs-mut)" }}>
                  Ke
                </span>
                <div className="dc-scroll-x flex gap-2 overflow-x-auto pb-0.5">
                  ${movementDestinationOptions.length
                    ? movementDestinationOptions.map((account) =>
                        walletChip(
                          account,
                          account.id === form.destination_account_id,
                          () =>
                            selectMovementAccount(
                              "destination_account_id",
                              account.id,
                            ),
                        ),
                      )
                    : html`
                        <span
                          className="py-2 text-[12.5px]"
                          style=${{ color: "var(--cs-mut)" }}
                        >
                          Tidak ada dompet yang sesuai
                        </span>
                      `}
                </div>
                ${/* Kolom "Ke" bisa diisi, tidak hanya menampilkan hasil.
                      Mengetik di sini mengisi balik "Dari" memakai kurs yang
                      berlaku, jadi menukar 100rb LKR dengan kurs 45 langsung
                      mengisi Rp 4.500.000 di atas. Perhitungan dua arahnya
                      sudah ada di settleExchangeCalculation, yang kurang hanya
                      inputnya. */ null}
                <div
                  className="flex items-end gap-1.5 pb-2"
                  style=${{ borderBottom: "1.5px solid var(--cs-line)" }}
                >
                  <span
                    className="pb-[3px] text-[15px]"
                    style=${{ color: "var(--cs-mut)" }}
                  >
                    ${toSymbol}
                  </span>
                  <input
                    inputMode="decimal"
                    autoComplete="off"
                    aria-label=${`Jumlah diterima dalam ${form.to_currency}`}
                    value=${form.to_amount}
                    onChange=${(event) =>
                      updateField(
                        "to_amount",
                        formatNumericInput(event.target.value),
                      )}
                    onBlur=${() => settleExchangeField("to_amount")}
                    placeholder="0"
                    className="dc-num min-w-0 flex-1 border-none bg-transparent p-0 text-[26px] tracking-[-0.8px] outline-none"
                    style=${{ color: "var(--cs-ink)" }}
                  />
                </div>
              </div>
              <//>
            `}

        ${spendableAccounts.length && !isTransfer
          ? html`
              <div
                className="flex flex-col gap-3 rounded-[14px] p-3.5"
                style=${{ background: "var(--cs-chip)" }}
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className="text-xs"
                    style=${{ color: "var(--cs-body)" }}
                  >
                    Kurs sekarang
                  </span>
                  <span
                    className="dc-num whitespace-nowrap text-[12.5px]"
                    style=${{ color: "var(--cs-mut)" }}
                  >
                    ${globalPairRate.exchangeRate
                      ? `1 ${rateBaseCurrency} = ${formatMoney(
                          Number(globalPairRate.exchangeRate),
                          rateQuoteCurrency,
                        )}`
                      : "Kurs belum tersedia"}
                  </span>
                </div>
                <span
                  className="h-px"
                  style=${{ background: "var(--cs-line)" }}
                ></span>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className="text-xs"
                      style=${{ color: "var(--cs-body)" }}
                    >
                      Isi kurs sendiri
                    </span>
                    ${rateMode === "custom"
                      ? html`
                          <button
                            type="button"
                            onClick=${() => setRateMode("global")}
                            className="text-[11.5px] font-bold"
                            style=${{ color: "var(--cs-link)" }}
                          >
                            Pakai kurs app
                          </button>
                        `
                      : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="dc-num whitespace-nowrap text-sm">
                      1 ${rateBaseCurrency}
                    </span>
                    <span
                      className="text-sm"
                      style=${{ color: "var(--cs-mut)" }}
                    >
                      =
                    </span>
                    ${/* Saat memakai kurs app, kolom dibiarkan kosong dan kurs
                          resmi tampil sebagai placeholder terformat. Nilai
                          mentah punya presisi penuh (17857.143176020414) yang
                          tidak enak dibaca dan bukan angka yang diketik
                          pengguna. Begitu diketik, mode pindah ke custom dan
                          nilai aslinya yang tampil. */ null}
                    <input
                      inputMode="decimal"
                      autoComplete="off"
                      value=${rateMode === "custom" ? form.exchange_rate : ""}
                      onChange=${(event) => {
                        if (rateMode !== "custom") setRateMode("custom");
                        updateField("exchange_rate", event.target.value);
                      }}
                      onBlur=${() => settleExchangeField("exchange_rate")}
                      placeholder=${globalPairRate.exchangeRate
                        ? formatMoney(
                            Number(globalPairRate.exchangeRate),
                            rateQuoteCurrency,
                          )
                        : "0"}
                      className="dc-num min-h-11 min-w-[96px] flex-1 rounded-xl border px-3 text-[15px] outline-none"
                      style=${{
                        background: "var(--cs-card)",
                        borderColor: exchangeRateValidation.valid
                          ? "var(--cs-line)"
                          : "var(--cs-danger)",
                        color: "var(--cs-ink)",
                      }}
                    />
                    <span className="dc-num whitespace-nowrap text-sm">
                      ${rateQuoteCurrency}
                    </span>
                  </div>
                </div>
              </div>
            `
          : null}

        <span
          className="px-0.5 text-xs leading-[1.45]"
          style=${{
            color: sourceBalanceSufficient
              ? "var(--cs-mut)"
              : "var(--cs-danger)",
          }}
        >
          ${!sourceBalanceSufficient
            ? `Saldo ${sourceAccount?.name || "dompet asal"} tidak mencukupi.`
            : "Isi jumlahnya dulu, nanti kelihatan uangnya masuk berapa."}
        </span>

        <div className="sticky bottom-0 -mx-1 flex flex-col px-1 pb-2 pt-3">
          <button
            type="button"
            onClick=${handleSubmit}
            disabled=${submitDisabled || loading}
            className="dc-press dc-press-96 flex min-h-[52px] items-center justify-center rounded-[17px] text-[15px] font-bold"
            style=${submitDisabled || loading
              ? { background: "var(--cs-track)", color: "var(--cs-faint)" }
              : { background: "var(--cs-acc)", color: "var(--cs-on-acc)" }}
          >
            ${loading
              ? "Menyimpan..."
              : submitDisabled
                ? "Isi jumlahnya dulu"
                : isTransfer
                  ? "Kirim sekarang"
                  : "Tukar sekarang"}
          </button>
        </div>
      </div>
    `;
  }

  return html`
    <div className=${workspace
      ? "cs-movement-workspace mx-auto w-full pb-28"
      : "cs-entry-dialog fixed inset-0 z-[70] flex items-end justify-center p-2 sm:items-center sm:p-5"}>
      ${!workspace
        ? html`
            <button
              type="button"
              aria-label="Tutup form transaksi"
              onClick=${onClose}
              className="absolute inset-0 min-h-0 w-full bg-slate-950/72 backdrop-blur-sm"
            ></button>
          `
        : null}

      <section
        role=${workspace ? "region" : "dialog"}
        aria-modal=${workspace ? undefined : "true"}
        aria-labelledby="transaction-form-title"
        className=${workspace
          ? "cs-movement-panel relative w-full overflow-hidden rounded-xl"
          : "cs-entry-panel relative flex max-h-[calc(100dvh-1rem)] w-full max-w-[31rem] flex-col overflow-hidden rounded-lg"}
      >
        <header className=${workspace
          ? "cs-movement-hero shrink-0 px-4 py-3"
          : "flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/70 px-4 py-2.5 dark:border-slate-800"}>
          ${workspace
            ? html`
                <div key="movement-title" className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 min-h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-400/15 text-emerald-300">
                    <${ArrowLeftRight} aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <h2 id="transaction-form-title" className="font-display text-base font-extrabold leading-tight text-white">
                      Transfer & Tukar Valas
                    </h2>
                    <p className="mt-1 truncate text-[10px] text-emerald-50/80">
                      Transfer antar dompet atau tukar valas ke ${baseCurrency}
                    </p>
                  </div>
                </div>

                <div key="movement-mode" className="cs-movement-mode mt-3 grid grid-cols-2 gap-1 rounded-lg p-1">
                  <${SegmentButton}
                    active=${isTransfer}
                    onClick=${() => changeMovementMode("transfer")}
                  >
                    Transfer Antar Dompet
                  </${SegmentButton}>
                  <${SegmentButton}
                    active=${!isTransfer}
                    onClick=${() => changeMovementMode("exchange")}
                  >
                    Tukar Valas / Remit
                  </${SegmentButton}>
                </div>
              `
            : html`
                <div key="transaction-title" className="min-w-0">
                  <h2 id="transaction-form-title" className="font-display text-base font-extrabold text-slate-950 dark:text-white">
                    Catat transaksi
                  </h2>
                  <p className="mt-0.5 hidden text-[10px] text-slate-500 sm:block dark:text-slate-400">
                    Catat pemasukan atau pengeluaran dengan cepat.
                  </p>
                </div>
                <button
                  key="transaction-close"
                  type="button"
                  aria-label="Tutup"
                  onClick=${onClose}
                  className="inline-flex h-11 min-h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-200/70 hover:text-slate-950 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  <${X} aria-hidden="true" className="h-4 w-4" />
                </button>
              `}
        </header>

        <div className=${workspace
          ? "cs-movement-form-card mt-4 min-h-0 rounded-xl px-4 pb-5 pt-4"
          : "min-h-0 overflow-y-auto px-4 pb-4 pt-2"}>
          ${!workspace
            ? html`
                <div className="cs-entry-segment grid grid-cols-2 gap-1 rounded-lg p-1">
                  ${typeOptions.map((option) => {
                    const Icon = option.icon;
                    return html`
                      <button
                        key=${option.value}
                        type="button"
                        onClick=${() => setEntryType(option.value)}
                        aria-pressed=${entryType === option.value}
                        className=${`flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-md px-2 text-[11px] font-extrabold transition ${
                          entryType === option.value
                            ? option.tone === "rose"
                              ? "bg-rose-500 text-white shadow-[0_10px_22px_rgba(244,63,94,0.18)]"
                              : "bg-emerald-500 text-white shadow-[0_10px_22px_rgba(16,185,129,0.18)]"
                            : "text-slate-600 hover:bg-slate-200/70 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                        }`}
                      >
                        <${Icon} aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">${option.label}</span>
                      </button>
                    `;
                  })}
                </div>
              `
            : null}

          ${isMovement && !workspace
            ? html`
                <div className="mt-4">
                  <div className="cs-entry-segment grid grid-cols-2 gap-1 rounded-lg p-1">
                    <${SegmentButton}
                      active=${isTransfer}
                      onClick=${() => changeMovementMode("transfer")}
                    >
                      Transfer antar dompet
                    </${SegmentButton}>
                    <${SegmentButton}
                      active=${!isTransfer}
                      onClick=${() => changeMovementMode("exchange")}
                    >
                      Tukar valas
                    </${SegmentButton}>
                  </div>
                </div>
              `
            : null}

          ${workspace
            ? html`
                <div className="mb-4">
                  <h3 className="text-[13px] font-extrabold text-white">
                    ${isTransfer ? "Pindahkan Aset Antar Dompet" : "Konversi Valas & Remittance"}
                  </h3>
                  <p className="mt-1 text-[10px] leading-4 text-slate-400">
                    ${isTransfer
                      ? "Pindahkan saldo antar akun tanpa mengubah mata uang."
                      : "Pilih akun sumber dan penerima. Hasil konversi bersih otomatis memperbarui saldo tujuan."}
                  </p>
                </div>
              `
            : null}

          <form className="mt-2.5 grid gap-2.5" onSubmit=${handleSubmit}>
            ${!isMovement
              ? html`
                  ${isExpense && spendableAccounts.length
                    ? html`
                        <section key="entry-funding" className="cs-entry-funding-compact overflow-hidden rounded-lg">
                          <button
                            type="button"
                            aria-expanded=${fundingPickerOpen}
                            onClick=${() => setFundingPickerOpen((current) => !current)}
                            className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left"
                          >
                            <span className=${`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${selectedGoal ? "bg-cyan-500/15 text-cyan-500" : "bg-emerald-500/15 text-emerald-500"}`}>
                              ${selectedGoal
                                ? html`<${PiggyBank} aria-hidden="true" className="h-4 w-4" />`
                                : html`<${WalletCards} aria-hidden="true" className="h-4 w-4" />`}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-[9px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                ${selectedGoal ? "Tabungan" : "Saldo Dompet"}
                              </span>
                              <strong className="mt-0.5 block truncate text-xs text-slate-950 dark:text-white">
                                ${expenseFundingTitle}
                              </strong>
                              <span className="mt-0.5 block truncate text-[9px] text-slate-500 dark:text-slate-400">
                                ${expenseFundingSubtitle}
                              </span>
                            </span>
                            <span className="shrink-0 text-[10px] font-black text-cyan-600 dark:text-cyan-300">
                              ${fundingPickerOpen ? "Tutup" : "Ubah"}
                            </span>
                          </button>

                          ${fundingPickerOpen
                            ? html`
                                <div className="cs-entry-funding-picker grid gap-2 border-t border-slate-200 px-3 pb-3 pt-2 dark:border-slate-800">
                                  <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-500/10 p-1">
                                    <button
                                      type="button"
                                      aria-pressed=${!form.target_id}
                                      onClick=${() => selectExpenseFundingMode("wallet")}
                                      className=${`min-h-11 rounded-md px-2 text-[10px] font-black ${!form.target_id ? "bg-emerald-500 text-white" : "text-slate-500 dark:text-slate-300"}`}
                                    >
                                      Dompet
                                    </button>
                                    <button
                                      type="button"
                                      aria-pressed=${Boolean(form.target_id)}
                                      onClick=${() => selectExpenseFundingMode("savings")}
                                      disabled=${eligibleGoals.length === 0}
                                      className=${`min-h-11 rounded-md px-2 text-[10px] font-black disabled:cursor-not-allowed disabled:opacity-40 ${form.target_id ? "bg-cyan-500 text-white" : "text-slate-500 dark:text-slate-300"}`}
                                    >
                                      Tabungan
                                    </button>
                                  </div>

                                  ${form.target_id
                                    ? html`
                                        <label className="block">
                                          <span className="sr-only">Tabungan yang digunakan</span>
                                          <select
                                            value=${form.target_id}
                                            onChange=${(event) => selectTarget(event.target.value)}
                                            className=${INPUT_CLASS}
                                          >
                                            ${eligibleGoals.map(
                                              (goal) => html`
                                                <option key=${goal.id} value=${goal.id}>
                                                  ${goal.name} — ${formatCurrency(goal.availableAmount, goal.currency)}
                                                </option>
                                              `,
                                            )}
                                          </select>
                                        </label>
                                      `
                                    : null}

                                  <label className="block">
                                    <span className="sr-only">Dompet sumber dana</span>
                                    <select
                                      required
                                      value=${form.source_account_id || ""}
                                      onChange=${(event) => selectEntryAccount(event.target.value)}
                                      className=${INPUT_CLASS}
                                    >
                                      ${entryAccountOptions.length
                                        ? entryAccountOptions.map(
                                            (account) => {
                                              const savedAmount = selectedGoalSources.find(
                                                (source) => source.accountId === account.id,
                                              )?.amount;
                                              return html`
                                                <option key=${account.id} value=${account.id}>
                                                  ${selectedGoal
                                                    ? `${account.name} — tabungan ${formatCurrency(savedAmount || 0, account.currency)}`
                                                    : getAccountLabel(account)}
                                                </option>
                                              `;
                                            },
                                          )
                                        : html`<option value="">Dompet sumber belum terhubung</option>`}
                                    </select>
                                  </label>
                                </div>
                              `
                            : null}
                        </section>
                      `
                    : null}

                  ${isIncome && spendableAccounts.length
                    ? html`
                        <label key="entry-account" className="block">
                          <span className="cs-entry-label">Masuk ke dompet</span>
                          <select
                            required
                            value=${form.destination_account_id || ""}
                            onChange=${(event) => selectEntryAccount(event.target.value)}
                            className=${INPUT_CLASS}
                          >
                            ${spendableAccounts.map(
                              (account) => html`
                                <option key=${account.id} value=${account.id}>${getAccountLabel(account)}</option>
                              `,
                            )}
                          </select>
                        </label>
                      `
                    : null}

                  ${!spendableAccounts.length
                    ? html`
                        <div key="entry-account-missing" className="cs-entry-notice rounded-lg px-3 py-3 text-xs leading-5 text-slate-600 dark:text-slate-300">
                          <p className="font-extrabold text-slate-900 dark:text-white">
                            Tambahkan dompet sebelum mencatat transaksi
                          </p>
                          <p className="mt-1">
                            Dompet menentukan mata uang dan tempat saldo ${isIncome ? "masuk" : "keluar"}, jadi transaksi tidak akan tersimpan tanpa tujuan yang jelas.
                          </p>
                          ${onRequestAddWallet
                            ? html`
                                <button
                                  type="button"
                                  onClick=${onRequestAddWallet}
                                  className="history-action-primary mt-3 min-h-11 rounded-lg px-3 py-2 text-xs font-extrabold"
                                >
                                  Tambah dompet pertama
                                </button>
                              `
                            : null}
                        </div>
                      `
                    : null}

                  <label key="entry-amount" className="cs-entry-amount block">
                    <span className="cs-entry-label">Nominal</span>
                    <span className="relative block">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 rounded-md bg-slate-500/10 px-2 py-1 text-[9px] font-black text-slate-500 dark:text-slate-300">
                        ${selectedCurrencyCode}
                      </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      required
                      value=${form.amount}
                      onChange=${(event) => updateField("amount", formatNumericInput(event.target.value))}
                      placeholder="0"
                      className=${`${INPUT_CLASS} pl-[4.25rem] font-display text-base font-black tabular-nums`}
                    />
                    </span>
                  </label>

                  <div className=${`grid gap-2 ${isExpense ? "grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)]" : ""}`}>
                    <label key="entry-description" className="min-w-0">
                      <span className="cs-entry-label">Judul</span>
                      <input
                        type="text"
                        value=${form.description}
                        onChange=${(event) => updateField("description", event.target.value)}
                        placeholder=${isIncome ? "Gaji bulanan" : "Makan siang"}
                        className=${INPUT_CLASS}
                      />
                    </label>

                    ${isExpense
                      ? html`
                        <label key="entry-category" className="min-w-0">
                          <span className="cs-entry-label">Kategori</span>
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
                  </div>

                  ${isExpense
                    ? html`
                        ${crossesProtectedFunds
                          ? html`
                              <div key="protected-funds-warning" className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-xs leading-5 text-amber-700 dark:text-amber-200">
                                Nominal melewati saldo bebas di dompet ini. Pilih Tabungan bila dana
                                memang berasal dari tabungan, ganti dompet, atau kurangi nominal.
                              </div>
                            `
                          : null}
                        ${selectedGoal && !entryAccountOptions.length
                          ? html`
                              <div key="savings-source-missing" className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-xs leading-5 text-amber-700 dark:text-amber-200">
                                Tabungan ini belum memiliki saldo yang terhubung ke dompet sumber.
                                Buka detail Tabungan lalu pilih Tambah Saldo dari dompet yang benar.
                              </div>
                            `
                          : null}
                        ${exceedsSelectedSavings
                          ? html`
                              <div key="savings-balance-warning" className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-xs leading-5 text-amber-700 dark:text-amber-200">
                                Nominal lebih besar dari saldo ${selectedGoal.name} yang tersimpan di
                                ${selectedEntryAccount?.name}. Kurangi nominal atau pilih dompet sumber lain.
                              </div>
                            `
                          : null}
                        ${exceedsActualAccountBalance
                          ? html`
                              <div key="savings-account-warning" className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-3 text-xs leading-5 text-rose-700 dark:text-rose-200">
                                Saldo aktual ${selectedEntryAccount?.name} tidak mencukupi untuk pengeluaran ini.
                              </div>
                            `
                          : null}
                      `
                    : null}
                `
              : html`
                  ${spendableAccounts.length
                    ? html`
                        <label key="movement-source" className="block">
                          <span className="cs-entry-label">
                            ${isTransfer ? "Dari Dompet Asal" : "Akun Asal Valas (Dipotong)"}
                          </span>
                          <select
                            value=${form.source_account_id || ""}
                            onChange=${(event) =>
                              selectMovementAccount("source_account_id", event.target.value)}
                            className=${INPUT_CLASS}
                          >
                            ${spendableAccounts.map(
                              (account) => html`
                                <option key=${account.id} value=${account.id}>
                                  ${getAccountLabel(account)}
                                </option>
                              `,
                            )}
                          </select>
                          <${AccountBalanceHint}
                            account=${sourceAccount}
                            label=${isTransfer ? "Mata Uang" : "Mata Uang Asal"}
                          />
                        </label>

                        <label key="movement-destination" className="block">
                          <span className="cs-entry-label">
                            ${isTransfer ? "Ke Dompet Tujuan" : "Akun Penerima (Ditambah)"}
                          </span>
                          <select
                            value=${form.destination_account_id || ""}
                            onChange=${(event) =>
                              selectMovementAccount("destination_account_id", event.target.value)}
                            className=${INPUT_CLASS}
                          >
                            ${movementDestinationOptions.length
                              ? movementDestinationOptions.map(
                                  (account) => html`
                                    <option key=${account.id} value=${account.id}>
                                      ${getAccountLabel(account)}
                                    </option>
                                  `,
                                )
                              : html`<option value="">Tidak ada dompet yang sesuai</option>`}
                          </select>
                          <${AccountBalanceHint}
                            account=${destinationAccount}
                            label=${isTransfer ? "Mata Uang" : "Mata Uang Tujuan"}
                          />
                        </label>
                      `
                    : html`
                        <div key="movement-account-missing" className="cs-entry-notice rounded-lg px-3 py-3 text-xs leading-5 text-slate-600 dark:text-slate-300">
                          <p>Tambahkan minimal dua dompet aktif sebelum membuat transfer atau tukar valas.</p>
                          ${onRequestAddWallet
                            ? html`
                                <button
                                  type="button"
                                  onClick=${onRequestAddWallet}
                                  className="history-action-primary mt-3 min-h-11 rounded-lg px-3 py-2 text-xs font-extrabold"
                                >
                                  Tambah dompet
                                </button>
                              `
                            : null}
                        </div>
                      `}

                  ${!isTransfer
                    ? html`
                        <section key="movement-rate" className="cs-entry-rate-card rounded-lg p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-extrabold text-emerald-400">
                                ${rateMode === "custom"
                                  ? "Kurs Money Changer"
                                  : "Kurs Real-Time"}
                              </p>
                            </div>
                            <span className="max-w-[58%] shrink-0 text-right text-[10px] font-extrabold leading-4 text-emerald-400">
                              ${formatExchangeRateLabel(currentRateOrientation)}
                            </span>
                          </div>
                          <label className="mt-2 flex cursor-pointer items-start gap-2 text-[10px] leading-4 text-slate-300">
                            <input
                              type="checkbox"
                              checked=${rateMode === "custom"}
                              onChange=${(event) =>
                                changeRateMode(event.target.checked ? "custom" : "global")}
                              className="cs-rate-checkbox mt-0.5 h-4 min-h-4 w-4 shrink-0 rounded border-emerald-400/60 bg-slate-950 text-emerald-500 accent-emerald-500"
                            />
                            <span>Gunakan kurs custom dari money changer, Remitly, atau Wise</span>
                          </label>
                          ${rateMode === "global" && !globalPairRate.exchangeRate
                            ? html`
                                <p className="mt-2 text-[10px] font-medium text-amber-500">
                                  Kurs global belum tersedia. Gunakan kurs sendiri untuk melanjutkan.
                                </p>
                              `
                            : null}
                          ${rateMode === "custom"
                            ? html`
                                <label className="mt-3 block">
                                  <span className="cs-entry-label">
                                    1 ${rateBaseCurrency} sama dengan
                                  </span>
                                  <span className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      autoComplete="off"
                                      required
                                      value=${form.exchange_rate}
                                      onChange=${(event) =>
                                        updateField(
                                          "exchange_rate",
                                          formatRateInputValue(event.target.value),
                                        )}
                                      onBlur=${() => settleExchangeField("exchange_rate")}
                                      placeholder="Contoh: 540"
                                      aria-invalid=${!exchangeRateValidation.valid}
                                      className=${INPUT_CLASS}
                                    />
                                    <span className="rounded-md border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-2 text-[10px] font-black text-emerald-300">
                                      ${rateQuoteCurrency}
                                    </span>
                                  </span>
                                  ${!exchangeRateValidation.valid
                                    ? html`
                                        <p className="mt-1.5 text-[10px] font-bold text-rose-400">
                                          ${exchangeRateValidation.message}
                                        </p>
                                      `
                                    : null}
                                </label>
                              `
                            : null}
                          ${rateResetMessage
                            ? html`
                                <p className="mt-2 rounded-md border border-amber-400/20 bg-amber-400/10 px-2.5 py-2 text-[10px] font-semibold leading-4 text-amber-300">
                                  ${rateResetMessage}
                                </p>
                              `
                            : null}
                        </section>
                      `
                    : html`
                        <div key="movement-transfer-note" className="cs-entry-notice px-3 py-3 text-xs leading-5 text-slate-600 dark:text-slate-300">
                          Transfer memakai mata uang yang sama. Saldo dipindahkan tanpa konversi kurs.
                        </div>
                      `}

                  <label key="movement-from-amount" className="block">
                    <span className="cs-entry-label">
                      ${isTransfer
                        ? `Jumlah Transfer (${form.from_currency})`
                        : `Anda tukarkan (${form.from_currency})`}
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      required
                      value=${settledMovementForm.from_amount}
                      onChange=${(event) =>
                        updateField("from_amount", formatNumericInput(event.target.value))}
                      onBlur=${() => settleExchangeField("from_amount")}
                      placeholder="0"
                      className=${INPUT_CLASS}
                    />
                  </label>

                  ${!isTransfer
                    ? html`
                        <label key="movement-to-amount" className="block">
                          <span className="cs-entry-label">Akan diterima (${form.to_currency})</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            required
                            value=${settledMovementForm.to_amount}
                            onChange=${(event) =>
                              updateField(
                                "to_amount",
                                formatNumericInput(event.target.value),
                              )}
                            onBlur=${() => settleExchangeField("to_amount")}
                            placeholder="0"
                            className=${INPUT_CLASS}
                          />
                        </label>
                      `
                    : null}

                  <label key="movement-fee" className="block">
                    <span className="cs-entry-label">Biaya Admin / Transfer Fee (${form.from_currency})</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      value=${form.fee_amount}
                      onChange=${(event) =>
                        updateField("fee_amount", formatNumericInput(event.target.value))}
                      placeholder="0"
                      className=${INPUT_CLASS}
                    />
                  </label>

                  ${parsedFromAmount > 0
                    ? html`
                        <div key="movement-summary" className="cs-entry-summary grid gap-1.5 rounded-lg p-3 text-[11px]">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-500 dark:text-slate-400">
                              Anda tukarkan
                            </span>
                            <strong className="truncate text-right font-extrabold text-slate-950 dark:text-white">
                              ${formatExchangeAmount(
                                parsedFromAmount,
                                form.from_currency,
                              )}
                            </strong>
                          </div>
                          ${!isTransfer
                            ? html`
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-slate-500 dark:text-slate-400">
                                    Kurs
                                  </span>
                                  <strong className="truncate text-right font-extrabold text-slate-950 dark:text-white">
                                    ${formatExchangeRateLabel(currentRateOrientation)}
                                  </strong>
                                </div>
                              `
                            : null}
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-500 dark:text-slate-400">
                              Akan diterima
                            </span>
                            <strong className="truncate text-right font-extrabold text-emerald-500">
                              ${formatExchangeAmount(
                                isTransfer ? parsedFromAmount : parsedToAmount,
                                isTransfer
                                  ? form.from_currency
                                  : form.to_currency,
                              )}
                            </strong>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-500 dark:text-slate-400">
                              Biaya admin
                            </span>
                            <strong className="truncate text-right font-extrabold text-rose-400">
                              ${formatExchangeAmount(
                                parsedFeeAmount,
                                form.from_currency,
                              )}
                            </strong>
                          </div>
                          <div className="flex items-center justify-between gap-3 border-t border-slate-200/70 pt-1.5 dark:border-slate-800">
                            <span className="font-bold text-slate-600 dark:text-slate-300">
                              Total dipotong
                            </span>
                            <strong className="truncate text-right font-black text-slate-950 dark:text-white">
                              ${formatExchangeAmount(
                                sourceDebitAmount,
                                form.from_currency,
                              )}
                            </strong>
                          </div>
                        </div>
                    `
                    : null}

                  ${parsedFromAmount > 0 && !sourceBalanceSufficient
                    ? html`
                        <div key="movement-balance-warning" className="cs-entry-warning rounded-lg px-3 py-2.5 text-[11px] font-semibold leading-5">
                          Saldo ${form.from_currency} tidak cukup untuk nominal dan biaya admin.
                        </div>
                      `
                    : null}
                `}

            ${!workspace
              ? html`
            <div key="entry-more-options" className="rounded-lg border border-slate-200/80 dark:border-slate-800">
              <button
                type="button"
                aria-expanded=${showMoreOptions}
                onClick=${() => setShowMoreOptions((current) => !current)}
                className="flex min-h-11 w-full items-center justify-between gap-3 px-3 text-left text-[10px] font-black text-slate-600 dark:text-slate-300"
              >
                <span className="inline-flex items-center gap-2">
                  <${CalendarDays} aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" />
                  Opsi lainnya
                </span>
                <${ChevronDown}
                  aria-hidden="true"
                  className=${`h-4 w-4 text-slate-400 transition ${showMoreOptions ? "rotate-180" : ""}`}
                />
              </button>
              ${showMoreOptions
                ? html`
                    <label className="block border-t border-slate-200/80 px-3 pb-3 pt-2 dark:border-slate-800">
                      <span className="cs-entry-label">Tanggal & waktu</span>
                      <span className="relative block">
                        <input
                          type="datetime-local"
                          required
                          max=${toInputDateTime()}
                          value=${form.occurred_at}
                          onChange=${(event) => updateField("occurred_at", event.target.value)}
                          className=${`${INPUT_CLASS} pr-10`}
                        />
                        <${CalendarDays}
                          aria-hidden="true"
                          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                        />
                      </span>
                      ${transactionDateInvalid
                        ? html`
                            <span className="mt-1.5 block text-[10px] font-bold text-rose-500">
                              ${FUTURE_TRANSACTION_DATE_MESSAGE}
                            </span>
                          `
                        : null}
                    </label>
                  `
                : null}
            </div>
                `
              : null}

            ${isMovement
              ? html`
                  <label key="movement-description" className="block">
                    <span className="cs-entry-label">Catatan Transaksi</span>
                    <input
                      type="text"
                      value=${form.description}
                      onChange=${(event) => updateField("description", event.target.value)}
                      placeholder=${isTransfer ? "Contoh: Pindah saldo ke e-wallet" : "Contoh: Tukar di bank atau remit"}
                      className=${INPUT_CLASS}
                    />
                  </label>
                `
              : null}

            ${isExpense && selectedBudgetOverAmount > 0
              ? html`
                  <div key="entry-budget-warning" className="cs-entry-warning rounded-lg px-3 py-3 text-xs leading-5">
                    Transaksi ini melewati anggaran ${selectedBudgetInsight.categoryLabel} sebesar ${formatCurrency(
                      selectedBudgetOverAmount,
                      selectedBudgetInsight.currency,
                    )}. Kamu tetap bisa simpan.
                  </div>
                `
              : null}

            <${FormActionDock} key="transaction-submit" aboveNavigation=${workspace}>
              <button
                type="submit"
                disabled=${loading || submitDisabled}
                className="cs-entry-submit min-h-12 w-full rounded-xl px-4 text-sm font-extrabold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                ${loading
                  ? "Menyimpan..."
                  : isMovement
                    ? isTransfer
                      ? "Simpan transfer"
                      : "Simpan tukar valas"
                    : isIncome
                      ? "Simpan pemasukan"
                      : "Simpan pengeluaran"}
              </button>
            <//>
          </form>
        </div>
      </section>
    </div>
  `;
}
