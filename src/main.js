import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import htm from "htm";
import { createClient } from "@supabase/supabase-js";
import { APP_NAME, SUPABASE_ANON_KEY, SUPABASE_URL } from "./config.js";
import { BudgetWorkspacePage } from "./components/budget/index.js";
import { AuthRecoveryScreen, AuthScreen } from "./components/auth/index.js";
import { WealthGoalsPage } from "./components/assets/index.js";
import { ControlCenterPage } from "./components/control/index.js";
import { HomeDashboardPage } from "./components/home/index.js";
import { BulkEntrySheet } from "./components/transactions/BulkEntrySheet.js";
import { QuickEntrySheet } from "./components/transactions/QuickEntrySheet.js";
import { DesktopRightPanel } from "./components/layout/index.js";
import {
  DesktopNavigation,
  MobileNavigation,
  QuickActionMenu,
} from "./components/navigation/index.js";
import { MonthlyReportPage } from "./components/reports/index.js";
import { SettingsPanel } from "./components/settings/index.js";
import {
  AppLoadingScreen,
  PremiumMeshBackground,
} from "./components/shared/AppScaffold.js";
import { SubmitActionBar } from "./components/shared/SubmitActionBar.js";
import { AvatarBadge } from "./components/shared/AvatarBadge.js";
import { WalletHeader } from "./components/wallet/index.js";
import {
  RecentTransactionsPreview,
  TransactionForm,
  TransactionHistoryPage,
  getTransactionCategoryLabel,
  getTransactionDisplayTitle,
} from "./components/transactions/index.js";
import {
  ASSET_ACCOUNT_TYPE_LOOKUP,
  buildAssetAccountBalancePlan,
  buildAssetAccountInsights,
  getAssetAccountDisplayName,
  getCurrentValuationRateForCurrency,
  getDefaultAssetAccountName,
  getSelectableAssetAccounts,
  isSpendableAssetAccount,
  normalizeAssetAccount,
  normalizeAssetAccounts,
} from "./domain/assets.js";
import {
  CATEGORY_OPTIONS,
  DEFAULT_CATEGORY,
  MONTHLY_BUDGET_CATEGORY,
  UNIVERSAL_BUDGET_GROUP,
  buildBudgetOverspendWarning,
  calculateBudgetBaseAmount,
  computeBudgetInsights,
  getBudgetCategoryKey,
  getBudgetCategoryLabel,
  getBudgetCategoryMeta,
  getBudgetRowKey,
  getDefaultGroupForCategory,
  isMonthlyBudget,
  normalizeBudgetCategory,
  normalizeBudgets,
} from "./domain/budgets.js";
import { buildBudgetControlSummary } from "./domain/control.js";
import {
  applyTransactionRateToRecord,
  resolveTransactionRateInfo,
} from "./domain/transactionRates.js";
import {
  addExchangeDecimals,
  calculateExchangeTargetAmount,
  compareExchangeDecimals,
  createTransactionFallbackRate,
  getDirectionalExchangeRate,
  getLatestRateForCurrencyUntil,
  serializeExchangeRate,
  validateExchangeRate,
} from "./domain/exchange.js";
import {
  GOAL_TYPE_HOLD_BALANCE,
  computeGoalAllocationState,
  evaluateAccountDebit,
  normalizeGoal,
  normalizeGoalActivities,
  normalizeGoalActivity,
  syncGoalActivityForTransaction,
  validateGoalActivity,
} from "./domain/goals.js";
import {
  buildAccountReconciliationRecord,
  normalizeAccountReconciliation,
  normalizeAccountReconciliations,
} from "./domain/reconciliations.js";
import {
  computeCurrencyBalances,
  createLegacyTransactionId,
  getTransactionAccountMovements,
  getTransactionAmountValue,
  getTransactionCurrency,
  getTransactionFlow,
  getTransactionMainAmount,
  normalizeTransaction,
  normalizeTransactions,
  orderTransactions,
  resolveTransactionBaseValue,
  sumHistoricalBaseValues,
  transactionBelongsToAccount,
  validateTransactionAccountLinks,
  validateTransactionOccurredAt,
} from "./domain/transactions.js";
import {
  DEFAULT_ACTIVE_CURRENCIES,
  DEFAULT_BASE_CURRENCY,
  DEFAULT_SELECTED_CURRENCIES,
  formatCurrency,
  formatNumericInput,
  getCurrencyOptions as buildCurrencyOptions,
  getNumericInputOptions,
  normalizeCurrencyCode,
  normalizeCurrencyList as normalizeCurrencyListBase,
  normalizeNumericInput,
} from "./lib/currency.js";
import {
  formatLongDate,
  formatMonthKey,
  getLocalDayKey,
  getMonthKey,
  getMonthMeta,
  getMonthParts,
} from "./lib/dates.js";
import {
  GLOBAL_EXCHANGE_RATES_STORAGE_KEY,
  fetchGlobalCurrencyRates,
  hasGlobalRatesForCurrencies,
  isGlobalRateSnapshotFresh,
  normalizeGlobalRateSnapshot,
} from "./lib/exchangeRates.js";
import { BalanceVisibilityProvider } from "./lib/balanceVisibility.js";
import { readStorage, writeStorage } from "./lib/storage.js";
import { normalizeCurrencySettings } from "./lib/currencySettings.js";
import {
  getProfileDisplayName,
  getUserInitials,
} from "./lib/profile.js";
import {
  normalizeThemeMode,
  resolveThemeMode,
} from "./lib/theme.js";
import { createSupabaseSessionRecovery } from "./lib/authSession.js";
import {
  NATIVE_AUTH_REDIRECT_URL,
  addNativeAppStateListener,
  addNativeBackButtonListener,
  addNativeUrlListener,
  closeNativeAuthBrowser,
  getAuthCallbackFromUrl,
  getNativeAppState,
  getNativeLaunchUrl,
  isNativeMobileApp,
  minimizeNativeApp,
  nativeAuthStorage,
  openNativeAuthBrowser,
  syncThemeColorMeta,
  updateNativeStatusBar,
} from "./lib/mobile.js";
import { parseNativeAppRoute } from "./lib/nativeAppRoute.js";
import {
  isNativeWidgetAvailable,
  requestPinNativeWidget,
  updateNativeWidgetSnapshot,
} from "./lib/nativeWidgets.js";

const html = htm.bind(React.createElement);

/* Nominal dari form berupa teks yang masih memakai format mata uangnya
   ("25.000"), sedangkan Catat cepat dan widget mengirim angka. Keduanya
   harus sampai utuh: teks dibaca menurut mata uangnya, angka dibiarkan. */
function readCurrencyAmount(value, currency) {
  if (typeof value === "number") return value;
  return Number(normalizeNumericInput(value, getNumericInputOptions(currency)));
}

const STORAGE_KEYS = {
  theme: "monefy-theme",
  demoAuth: "monefy-demo-auth",
  demoTransactions: "monefy-demo-transactions",
  demoBudgets: "monefy-demo-budgets",
  demoGoals: "monefy-demo-goals",
  demoGoalActivities: "cuansync-demo-goal-activities",
  demoAssetAccounts: "cuansync-demo-asset-accounts",
  demoAccountReconciliations: "cuansync-demo-account-reconciliations",
  profilePhotos: "monefy-profile-photos",
  profile: "cuansync-profile",
  balanceVisible: "monefy-balance-visible",
  hideBalances: "cuansync-hide-balances",
  currencySettings: "monefy-currency-settings",
  transactionFabHintDismissed: "cuansync-transaction-fab-hint-dismissed",
  incomeEstimates: "cuansync-income-estimates",
  budgetBillReserve: "cuansync-budget-bill-reserve",
  globalExchangeRates: GLOBAL_EXCHANGE_RATES_STORAGE_KEY,
};

const LEGACY_STORAGE_KEYS = {
  theme: "kas-poipet-theme",
  demoAuth: "kas-poipet-demo-auth",
  demoTransactions: "kas-poipet-demo-transactions",
  demoBudgets: "kas-poipet-demo-budgets",
  demoGoals: "kas-poipet-demo-goals",
  demoGoalActivities: "kas-poipet-demo-goal-activities",
  demoAssetAccounts: "kas-poipet-demo-asset-accounts",
  demoAccountReconciliations: "kas-poipet-demo-account-reconciliations",
  profilePhotos: "kas-poipet-profile-photos",
  profile: "kas-poipet-profile",
  balanceVisible: "kas-poipet-balance-visible",
  hideBalances: "kas-poipet-hide-balances",
  currencySettings: "kas-poipet-currency-settings",
  globalExchangeRates: "kas-poipet-global-exchange-rates",
};

const DEMO_USER = {
  id: "demo-user",
  email: "demo@cuansync.local",
  user_metadata: {
    full_name: "Demo Lokal",
    avatar_url: "",
  },
};

const TYPE_META = {
  income: {
    label: "Pemasukan",
    chip:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  exchange: {
    label: "Tukar Mata Uang",
    chip: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  },
  expense: {
    label: "Uang Keluar",
    chip:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
};

let runtimeCurrencySettings = null;

const cardSurface =
  "cuan-card";

const cardSurfaceSoft =
  "cuan-card-soft";

const inputSurface =
  "cuan-input";

const mutedText = "text-slate-700 dark:text-slate-300/80";

const PREMIUM_PANEL =
  `relative overflow-hidden rounded-[30px] ${cardSurface}`;

const PREMIUM_PANEL_SOFT =
  `relative overflow-hidden rounded-[26px] ${cardSurfaceSoft}`;

const PREMIUM_ITEM =
  "cuan-item group relative overflow-hidden rounded-[24px] transition duration-500 hover:-translate-y-1 hover:scale-[1.01]";

const GLASS_PILL =
  "cuan-pill inline-flex min-h-11 items-center rounded-full px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5";

const GLASS_INPUT =
  `w-full min-h-12 rounded-2xl px-4 py-3.5 text-sm transition ${inputSurface}`;

let supabase = null;
const supabaseSessionRecovery = createSupabaseSessionRecovery({
  getClient: () => supabase,
  onClockDiagnostic: (diagnostic) => {
    try {
      window.localStorage.setItem(
        "cuansync-auth-clock-diagnostic",
        JSON.stringify(diagnostic),
      );
    } catch {
      // Diagnosis is best-effort and never includes a token or user identity.
    }
    if (!isNativeMobileApp()) {
      console.warn("CUANSYNC JWT clock diagnostic", diagnostic);
    }
  },
});

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: !isNativeMobileApp(),
      flowType: "pkce",
      storage: nativeAuthStorage,
    },
    global: {
      fetch: supabaseSessionRecovery.fetch,
    },
  });
}

function readBalanceVisiblePreference() {
  const hideBalances = readAppStorage("hideBalances", null);
  if (typeof hideBalances === "boolean") return !hideBalances;
  return readAppStorage("balanceVisible", false);
}

function writeBalanceVisiblePreference(visible) {
  writeAppStorage("hideBalances", !visible);
  writeAppStorage("balanceVisible", visible);
}

function normalizeCurrencyList(
  currencies,
  { ensureBase = true, baseCurrency = null } = {},
) {
  const requiredBase = normalizeCurrencyCode(
    baseCurrency || runtimeCurrencySettings?.baseCurrency || DEFAULT_BASE_CURRENCY,
  );
  return normalizeCurrencyListBase(currencies, {
    ensureBase,
    baseCurrency: requiredBase,
  });
}

function mergeCurrencyLists(...lists) {
  return normalizeCurrencyList(lists.flat().filter(Boolean));
}

function normalizeUserSettingsRow(row) {
  if (!row) return null;
  return normalizeCurrencySettings(
    {
      baseCurrency: row.base_currency,
      activeCurrencies: row.active_currencies,
      dailyCurrency: row.daily_currency,
      configured: true,
    },
    { configured: true },
  );
}

function isMissingDailyCurrencyColumn(error) {
  const message = String(error?.message || "");
  return (
    message.includes("daily_currency") &&
    (message.includes("schema cache") || error?.code === "PGRST204")
  );
}

function isMissingIncomeEstimateColumn(error) {
  const message = String(error?.message || "");
  return (
    message.includes("monthly_income_estimate") &&
    (message.includes("schema cache") || error?.code === "PGRST204")
  );
}

function isMissingTransactionRateTypeColumn(error) {
  const message = String(error?.message || "");
  return (
    message.includes("rate_type") &&
    (message.includes("schema cache") || error?.code === "PGRST204")
  );
}

function getCurrencySettingsOwnerId(user) {
  return user ? getUserStorageId(user) : null;
}

function readCurrencySettings(ownerId = null) {
  const stored = readAppStorage("currencySettings", null);
  if (!stored) return null;

  const storedOwnerId =
    stored.ownerId || stored.userId || stored.user_id || stored.profileId || null;
  if (ownerId && storedOwnerId !== ownerId) return null;

  const normalized = normalizeCurrencySettings(stored);
  return storedOwnerId ? { ...normalized, ownerId: storedOwnerId } : normalized;
}

function saveCurrencySettings(settings, ownerId = null) {
  const normalized = normalizeCurrencySettings(settings, { configured: true });
  const scoped = ownerId ? { ...normalized, ownerId } : normalized;
  writeAppStorage("currencySettings", scoped);
  return scoped;
}

function cacheCurrencySettings(settings, ownerId = null) {
  const normalized = normalizeCurrencySettings(settings, {
    configured: Boolean(settings?.configured),
  });
  const scoped = ownerId ? { ...normalized, ownerId } : normalized;
  writeAppStorage("currencySettings", scoped);
  return scoped;
}

function setRuntimeCurrencySettings(settings) {
  runtimeCurrencySettings = settings ? normalizeCurrencySettings(settings) : null;
}

function getActiveCurrencies() {
  return (
    normalizeCurrencyList(
      runtimeCurrencySettings?.activeCurrencies ||
        readCurrencySettings()?.activeCurrencies ||
        DEFAULT_SELECTED_CURRENCIES,
      {
        baseCurrency:
          runtimeCurrencySettings?.baseCurrency ||
          readCurrencySettings()?.baseCurrency ||
          DEFAULT_BASE_CURRENCY,
      },
    )
  );
}

function getCurrencyOptions(currencies = getActiveCurrencies()) {
  return buildCurrencyOptions(currencies);
}

function getBaseCurrency() {
  return normalizeCurrencyCode(
    runtimeCurrencySettings?.baseCurrency ||
      readCurrencySettings()?.baseCurrency ||
      DEFAULT_BASE_CURRENCY,
  );
}

function getUserStorageId(user) {
  return user?.id || user?.email || "guest";
}

function readAppStorage(keyName, fallback) {
  return readStorage(
    STORAGE_KEYS[keyName],
    fallback,
    LEGACY_STORAGE_KEYS[keyName],
  );
}

function writeAppStorage(keyName, value) {
  writeStorage(STORAGE_KEYS[keyName], value);
}

// Di web dokumen yang menggulir, sedangkan di shell native yang menggulir adalah
// .app-shell. window.scrollTo tidak menyentuh shell, jadi halaman baru tetap
// terbuka di posisi gulir halaman sebelumnya. Gulirkan keduanya.
function scrollAppToTop() {
  if (typeof window === "undefined") return;
  window.scrollTo({ top: 0, behavior: "smooth" });
  const shell = document.querySelector(".app-shell");
  if (shell && shell.scrollTop > 0) {
    shell.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function normalizeProfile(row, user, fallback = {}) {
  const fallbackSettings = normalizeCurrencySettings({
    baseCurrency: fallback.base_currency || fallback.baseCurrency,
    dailyCurrency: fallback.daily_currency || fallback.dailyCurrency,
    activeCurrencies: fallback.activeCurrencies || fallback.active_currencies,
  });
  const baseCurrency = normalizeCurrencyCode(
    row?.base_currency || fallbackSettings.baseCurrency || DEFAULT_BASE_CURRENCY,
  );
  const dailyCurrency = normalizeCurrencyCode(
    row?.daily_currency ||
      fallbackSettings.dailyCurrency ||
      fallbackSettings.activeCurrencies?.[0] ||
      baseCurrency,
    baseCurrency,
  );
  const hideBalances =
    typeof row?.hide_balances === "boolean"
      ? row.hide_balances
      : typeof fallback.hide_balances === "boolean"
        ? fallback.hide_balances
        : typeof fallback.hideBalances === "boolean"
          ? fallback.hideBalances
          : !readBalanceVisiblePreference();

  return {
    id: row?.id || user?.id || fallback.id || "demo-user",
    email: row?.email || fallback.email || user?.email || "",
    display_name:
      row?.display_name ||
      fallback.display_name ||
      fallback.displayName ||
      user?.user_metadata?.full_name ||
      user?.email?.split("@")[0] ||
      "Pengguna",
    avatar_url:
      row?.avatar_url ||
      fallback.avatar_url ||
      fallback.avatarUrl ||
      user?.user_metadata?.avatar_url ||
      "",
    base_currency: baseCurrency,
    daily_currency: dailyCurrency,
    theme_mode: normalizeThemeMode(
      row?.theme_mode || fallback.theme_mode || fallback.themeMode || readAppStorage("theme", "system"),
    ),
    hide_balances: hideBalances,
    ...normalizeIncomeEstimateFields(row, fallback, baseCurrency),
    country_code: row?.country_code || fallback.country_code || fallback.countryCode || "",
    created_at: row?.created_at || fallback.created_at || new Date().toISOString(),
    updated_at: row?.updated_at || fallback.updated_at || new Date().toISOString(),
  };
}

function readLocalProfile(user, currencySettings = null) {
  const storedProfiles = readAppStorage("profile", {});
  const storageId = getUserStorageId(user);
  const stored =
    storedProfiles && typeof storedProfiles === "object"
      ? storedProfiles[storageId] || storedProfiles
      : null;
  return normalizeProfile(stored, user, {
    ...(currencySettings || {}),
    ...(readLocalIncomeEstimate(user) || {}),
    hideBalances: !readBalanceVisiblePreference(),
  });
}

function writeLocalProfile(user, profile) {
  const storageId = getUserStorageId(user);
  const storedProfiles = readAppStorage("profile", {});
  writeAppStorage("profile", {
    ...(storedProfiles && typeof storedProfiles === "object" ? storedProfiles : {}),
    [storageId]: profile,
  });
}

/* Perkiraan pemasukan bulanan disimpan di profil. Nilai null di baris profil
   berarti memang dikosongkan; kolom yang tidak ada berarti migration-nya
   belum terpasang, dan nilainya diambil dari cadangan. */
function normalizeIncomeEstimateFields(
  row,
  fallback = {},
  baseCurrency = DEFAULT_BASE_CURRENCY,
) {
  const source =
    row && Object.prototype.hasOwnProperty.call(row, "monthly_income_estimate")
      ? row
      : fallback || {};
  const amount = Number(source.monthly_income_estimate);
  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      monthly_income_estimate: null,
      monthly_income_estimate_currency: null,
    };
  }
  return {
    monthly_income_estimate: amount,
    monthly_income_estimate_currency: normalizeCurrencyCode(
      source.monthly_income_estimate_currency,
      baseCurrency,
    ),
  };
}

/* Cadangan untuk akun Supabase yang migration perkiraan pemasukannya belum
   terpasang. Isinya dianggap tertunda: begitu kolomnya ada, nilainya dikirim
   sekali ke profil lalu dihapus dari perangkat. Mode demo tidak memakainya
   karena profil demo memang tersimpan lokal. */
function readLocalIncomeEstimate(user) {
  const stored = readAppStorage("incomeEstimates", {});
  const entry =
    stored && typeof stored === "object" ? stored[getUserStorageId(user)] : null;
  return entry && typeof entry === "object"
    ? normalizeIncomeEstimateFields(entry)
    : null;
}

function writeLocalIncomeEstimate(user, fields) {
  const stored = readAppStorage("incomeEstimates", {});
  const next = { ...(stored && typeof stored === "object" ? stored : {}) };
  if (fields) {
    next[getUserStorageId(user)] = {
      monthly_income_estimate: fields.monthly_income_estimate,
      monthly_income_estimate_currency: fields.monthly_income_estimate_currency,
    };
  } else {
    delete next[getUserStorageId(user)];
  }
  writeAppStorage("incomeEstimates", next);
}

function upsertIncomeEstimate(user, fields) {
  return supabase.from("profiles").upsert(
    {
      id: user.id,
      monthly_income_estimate: fields.monthly_income_estimate,
      monthly_income_estimate_currency: fields.monthly_income_estimate_currency,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
}

/* Perkiraan valas dinilai dengan kurs terkini, karena ini angka ke depan dan
   bukan transaksi yang punya kurs historis. Tanpa kurs, nilai dasarnya null
   dan Kondisi keuanganmu menyebutnya alih-alih menebak. */
function resolveIncomeEstimate(profile, rateSnapshot, baseCurrency) {
  const fields = normalizeIncomeEstimateFields(profile, {}, baseCurrency);
  if (fields.monthly_income_estimate == null) return null;
  const base = normalizeCurrencyCode(baseCurrency);
  const currency = normalizeCurrencyCode(
    fields.monthly_income_estimate_currency,
    base,
  );
  const rate =
    currency === base
      ? 1
      : Number(
          getCurrentValuationRateForCurrency(rateSnapshot, currency, base)?.rate ||
            0,
        );
  return {
    amount: fields.monthly_income_estimate,
    currency,
    baseAmount: rate > 0 ? fields.monthly_income_estimate * rate : null,
  };
}

function inferCurrenciesFromTransactions(rows = []) {
  const currencies = new Set([DEFAULT_BASE_CURRENCY]);
  rows.forEach((row) => {
    if (row.currency) currencies.add(normalizeCurrencyCode(row.currency));
    if (row.base_currency) currencies.add(normalizeCurrencyCode(row.base_currency));
    if (row.from_currency) currencies.add(normalizeCurrencyCode(row.from_currency));
    if (row.to_currency) currencies.add(normalizeCurrencyCode(row.to_currency));
    if (Number(row.amount_thb || 0) !== 0) currencies.add("THB");
    if (Number(row.amount_idr || 0) !== 0) currencies.add("IDR");
  });
  return normalizeCurrencyList([...currencies], {
    baseCurrency: DEFAULT_BASE_CURRENCY,
  });
}

function normalizeUserCurrencyRows(rows = [], profile = null, fallbackSettings = null, inferred = []) {
  const activeRows = rows.filter((row) => row?.is_active !== false);
  const rowBase = rows.find((row) => row?.is_base)?.currency_code;
  const rowDaily = rows.find((row) => row?.is_daily)?.currency_code;
  const baseCurrency = normalizeCurrencyCode(
    rowBase ||
      profile?.base_currency ||
      fallbackSettings?.baseCurrency ||
      DEFAULT_BASE_CURRENCY,
  );
  const activeCurrencies = activeRows.length
    ? activeRows.map((row) => row.currency_code)
    : fallbackSettings?.activeCurrencies?.length
      ? fallbackSettings.activeCurrencies
      : inferred.length
        ? inferred
        : [baseCurrency];
  const dailyCurrency = normalizeCurrencyCode(
    rowDaily ||
      profile?.daily_currency ||
      fallbackSettings?.dailyCurrency ||
      activeCurrencies[0] ||
      baseCurrency,
    baseCurrency,
  );

  return normalizeCurrencySettings(
    {
      baseCurrency,
      activeCurrencies,
      dailyCurrency,
      configured: true,
    },
    { configured: true },
  );
}

function buildUserCurrencyRecords(userId, settings, existingCodes = []) {
  const normalized = normalizeCurrencySettings(settings, { configured: true });
  const activeSet = new Set(normalized.activeCurrencies);
  const allCodes = normalizeCurrencyList(
    [...existingCodes, ...normalized.activeCurrencies],
    { ensureBase: false, baseCurrency: normalized.baseCurrency },
  );
  const updatedAt = new Date().toISOString();

  return allCodes.map((currencyCode) => ({
    user_id: userId,
    currency_code: currencyCode,
    is_active: activeSet.has(currencyCode),
    is_base: currencyCode === normalized.baseCurrency,
    is_daily: currencyCode === normalized.dailyCurrency,
    updated_at: updatedAt,
  }));
}

function computeMetrics(
  transactions,
  budgets,
  goals,
  goalActivities = [],
  assetAccounts = [],
  globalRateSnapshot = null,
) {
  const ordered = orderTransactions(transactions);
  const baseCurrency = getBaseCurrency();
  const configuredCurrencies = [baseCurrency];
  const currentMonthKey = getMonthKey(new Date());
  const currentMonthTransactions = ordered.filter(
    (item) => getMonthKey(item.occurred_at) === currentMonthKey,
  );

  const transactionCurrencyBalances = computeCurrencyBalances(
    ordered,
    configuredCurrencies,
  );
  const goalAllocationState = computeGoalAllocationState({
    goals,
    activities: goalActivities,
    accounts: assetAccounts,
  });
  const accountsWithAvailability = assetAccounts.map((account) => ({
    ...account,
    ...(goalAllocationState.accountAvailability?.[account.id]
      ? {
          reserved_balance:
            goalAllocationState.accountAvailability[account.id].reservedBalance,
          available_balance:
            goalAllocationState.accountAvailability[account.id].availableBalance,
        }
      : {}),
  }));
  const assetAccountSummary = buildAssetAccountInsights(
    accountsWithAvailability,
    globalRateSnapshot,
    baseCurrency,
  );
  const discoveredCurrencies =
    assetAccountSummary.accountCount > 0
      ? Object.keys(assetAccountSummary.totalsByCurrency)
      : Object.keys(transactionCurrencyBalances);
  const activeCurrencies = normalizeCurrencyList(discoveredCurrencies, {
    baseCurrency,
  });
  const currencyBalanceDefaults = Object.fromEntries(
    activeCurrencies.map((currency) => [currency, 0]),
  );
  const currencyBalances =
    assetAccountSummary.accountCount > 0
      ? {
          ...currencyBalanceDefaults,
          ...assetAccountSummary.totalsByCurrency,
        }
      : {
          ...currencyBalanceDefaults,
          ...transactionCurrencyBalances,
        };
  const receivedThb = Number(currencyBalances.THB || 0);
  const spentThb = ordered
    .filter((item) => item.type === "expense" && getTransactionCurrency(item) === "THB")
    .reduce((sum, item) => sum + getTransactionAmountValue(item), 0);
  const budgetInsights = computeBudgetInsights(
    currentMonthTransactions,
    budgets,
    currentMonthKey,
    getBaseCurrency(),
    globalRateSnapshot,
  );
  const overspentCount = budgetInsights.filter((item) => item.status === "over").length;
  const warningCount = budgetInsights.filter((item) => item.status === "warning").length;
  const budgetLimitTotal = budgetInsights.reduce(
    (sum, item) => sum + Number(item.baseAmount || item.limitAmount || 0),
    0,
  );
  const budgetSpentTotal = budgetInsights.reduce(
    (sum, item) => sum + Number(item.spentAmount || 0),
    0,
  );
  const budgetUsageTotal =
    budgetLimitTotal > 0 ? budgetSpentTotal / budgetLimitTotal : 0;

  const goalInsights = goalAllocationState.goals;
  const totalGoalTarget = goalInsights.reduce(
    (sum, item) => sum + Number(item.targetAmount || 0),
    0,
  );
  const totalGoalSaved = goalInsights.reduce(
    (sum, item) => sum + Number(item.savedAmount || 0),
    0,
  );
  const goalProgressTotal =
    totalGoalTarget > 0 ? totalGoalSaved / totalGoalTarget : 0;
  const nextGoal =
    goalInsights.find(
      (item) => !["completed", "used", "archived"].includes(item.status),
    ) ||
    goalInsights[0] ||
    null;
  const balanceIdrBase = Number(currencyBalances.IDR || 0);
  const allocatedToGoalsIdr = Number(
    goalAllocationState.allocatedByCurrency.IDR || 0,
  );
  const availableBalanceIdr = assetAccountSummary.accountCount > 0
    ? assetAccountSummary.accountInsights.reduce((sum, account) => {
        const availableAmount = Number(
          account.availableBalance ?? account.balanceAmount ?? 0,
        );
        const currentValue = account.currency === baseCurrency
          ? availableAmount
          : availableAmount * Number(account.rate || 0);
        return sum + (Number.isFinite(currentValue) ? currentValue : 0);
      }, 0)
    : balanceIdrBase;

  const activeExchange =
    [...ordered].reverse().find((item) => item.type === "exchange") || null;
  const latestRate = getCurrentValuationRateForCurrency(
    globalRateSnapshot,
    "THB",
    baseCurrency,
  ).rate;
  const balanceThb = Number(currencyBalances.THB || 0);
  const balanceThbValuationIdr =
    latestRate > 0 ? balanceThb * latestRate : null;
  const netWorthBeforeGoalsIdr = Object.entries(currencyBalances).reduce(
    (sum, [currency, balance]) => {
      if (currency === DEFAULT_BASE_CURRENCY) return sum + Number(balance || 0);
      const rateInfo = getCurrentValuationRateForCurrency(
        globalRateSnapshot,
        currency,
        baseCurrency,
      );
      const rate = Number(rateInfo.rate || 0);
      return sum + (rate > 0 ? Number(balance || 0) * rate : 0);
    },
    0,
  );
  const netWorthIdr = netWorthBeforeGoalsIdr;
  const foreignBalanceItems = activeCurrencies
    .filter((currency) => currency !== DEFAULT_BASE_CURRENCY)
    .map((currency) => {
      const balance = Number(currencyBalances[currency] || 0);
      const rateInfo = getCurrentValuationRateForCurrency(
        globalRateSnapshot,
        currency,
        baseCurrency,
      );
      const rate = Number(rateInfo.rate || 0);
      return {
        currency,
        balance,
        rate,
        rateSource: rateInfo.source,
        valuationIdr: rate > 0 ? balance * rate : null,
      };
    });
  const foreignBalanceValuationIdr = foreignBalanceItems.reduce(
    (sum, item) => sum + Number(item.valuationIdr || 0),
    0,
  );
  /* Ringkasan bulanan memakai nilai yang tersimpan bersama transaksinya,
     sama seperti Jatah dan Kondisi keuanganmu. Sebelumnya angkanya dinilai
     ulang dengan kurs hari ini, sehingga total "Keluar" bergeser sendiri
     tiap hari dan berbeda dari total di Jatah untuk data yang sama. Kurs
     hari ini tetap dipakai untuk valuasi saldo dan aset. */
  const monthlyIncome = sumHistoricalBaseValues(
    currentMonthTransactions.filter((item) => item.type === "income"),
    baseCurrency,
  );
  const monthlyExpense = sumHistoricalBaseValues(
    currentMonthTransactions.filter((item) => item.type === "expense"),
    baseCurrency,
  );
  const monthlyIncomeIdr = monthlyIncome.total;
  const monthlyExpenseIdr = monthlyExpense.total;
  const monthlyExternalIncomeIdr = monthlyIncome.total;
  const monthlyUnvaluedCount =
    monthlyIncome.missingCount + monthlyExpense.missingCount;
  const monthlyNetChangeIdr = monthlyExternalIncomeIdr - monthlyExpenseIdr;
  const budgetRemainingThb = budgetLimitTotal - budgetSpentTotal;
  const budgetStatus =
    budgetLimitTotal <= 0
      ? "none"
      : budgetUsageTotal > 1
        ? "over"
        : budgetUsageTotal >= 0.85
          ? "warning"
          : "safe";
  const budgetStatusLabel =
    budgetStatus === "none"
      ? "Belum ada anggaran"
      : budgetStatus === "over"
        ? "Melewati batas"
        : budgetStatus === "warning"
          ? "Hati-hati"
          : "Aman";

  return {
    currentMonthKey,
    currentMonthLabel: formatMonthKey(currentMonthKey),
    balanceIdr: availableBalanceIdr,
    /* Nama yang sama dengan isinya. Halaman Dompet membaca
       metrics.availableBalanceIdr, dan selama ini nilainya undefined sehingga
       diam diam jatuh ke total: "Bisa dipakai" tampil sama persis dengan
       seluruh uang, padahal sebagian sudah disisihkan ke tabungan. */
    availableBalanceIdr,
    balanceIdrBase,
    allocatedToGoalsIdr,
    balanceThb,
    balanceThbValuationIdr,
    foreignBalanceItems,
    foreignBalanceValuationIdr,
    currencyBalances,
    netWorthIdr,
    latestRate,
    monthlyIncomeIdr,
    monthlyExpenseIdr,
    monthlyExternalIncomeIdr,
    monthlyUnvaluedCount,
    monthlyNetChangeIdr,
    spentThb,
    activeCurrencies,
    activeExchange,
    recent: [...ordered].reverse().slice(0, 10),
    budgetInsights,
    overspentCount,
    warningCount,
    budgetLimitTotal,
    budgetSpentTotal,
    budgetRemainingThb,
    budgetUsageTotal,
    budgetStatus,
    budgetStatusLabel,
    goalInsights,
    totalGoalTarget,
    totalGoalSaved,
    goalProgressTotal,
    nextGoal,
    goalAllocationState,
    goalAllocationSummaries: goalAllocationState.summaries,
    assetAccountInsights: assetAccountSummary.accountInsights,
    assetAccountCount: assetAccountSummary.accountCount,
    assetAccountTotalsByCurrency: assetAccountSummary.totalsByCurrency,
    assetAccountTotalValueIdr: assetAccountSummary.totalValueIdr,
    globalRateProvider: globalRateSnapshot?.provider || null,
    globalRateSourceDate: globalRateSnapshot?.sourceDate || null,
  };
}

function DailyExpenseForm({
  onSubmit,
  loading,
  budget,
  todaySpentThb,
  todaySpentIdr,
  todaySpentCurrency = todaySpentThb,
  expenseCurrency = DEFAULT_BASE_CURRENCY,
  baseCurrency = getBaseCurrency(),
  accounts = [],
  onRequestAddWallet,
}) {
  const dailyCurrency = normalizeCurrencyCode(expenseCurrency);
  const accountOptions = getSelectableAssetAccounts(accounts, dailyCurrency);
  const accountOptionsKey = accountOptions.map((account) => account.id).join("|");
  const [form, setForm] = useState({
    description: "",
    category: DEFAULT_CATEGORY,
    amount_thb: "",
    source_account_id: "",
  });
  const hasBudget = Boolean(budget);

  const statusTone = !budget
    ? "border-slate-300/20 bg-slate-400/10 text-slate-900 dark:border-slate-400/20 dark:bg-slate-500/10 dark:text-slate-200"
    : budget.status === "over" || budget.todayRemainingSafe < 0
      ? "border-rose-300/20 bg-rose-400/10 text-rose-900 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200"
      : budget.status === "warning"
        ? "border-amber-300/20 bg-amber-400/10 text-amber-900 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200"
        : "border-emerald-300/20 bg-emerald-400/10 text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200";
  const statusLabel = !budget
    ? "Belum ada anggaran"
    : budget.todayRemainingSafe < 0
      ? "Lewat batas"
      : budget.status === "warning"
        ? "Waspada"
        : "Aman";
  const todayLimit = budget
    ? formatCurrency(budget.dynamicDailyLimit, dailyCurrency)
    : "-";
  const safeRemaining = budget
    ? budget.todayRemainingSafe >= 0
      ? formatCurrency(budget.todayRemainingSafe, dailyCurrency)
      : `- ${formatCurrency(Math.abs(budget.todayRemainingSafe), dailyCurrency)}`
    : "-";
  /* Terpakai mengikuti jatah yang sama dengan Sisa aman selama jatahnya ada,
     supaya kedua angka di kartu ini bisa dikurangkan satu sama lain. */
  const todaySpentToday = budget
    ? Number(budget.spentToday || 0)
    : Number(todaySpentCurrency || 0);
  const todaySpentCurrencyCode = budget ? budget.currency : dailyCurrency;
  const todaySpentScopeLabel = budget
    ? budget.categoryLabel || "Jatah harian"
    : `Semua pengeluaran ${dailyCurrency}`;
  const dailyInputOptions = getNumericInputOptions(dailyCurrency);
  const parsedAmount = Number(
    normalizeNumericInput(form.amount_thb, dailyInputOptions),
  );
  const selectedQuickAccount = accountOptions.find(
    (account) => account.id === form.source_account_id,
  );
  const quickAvailableBalance = Number(
    selectedQuickAccount?.availableBalance ??
      selectedQuickAccount?.available_balance ??
      selectedQuickAccount?.balance_amount ??
      0,
  );
  const crossesProtectedFunds = parsedAmount > quickAvailableBalance + 0.0001;
  const submitDisabled =
    parsedAmount <= 0 ||
    !accountOptions.length ||
    !form.source_account_id ||
    crossesProtectedFunds;

  useEffect(() => {
    setForm((current) => {
      if (!accountOptions.length) {
        return current.source_account_id
          ? { ...current, source_account_id: "" }
          : current;
      }
      if (accountOptions.some((account) => account.id === current.source_account_id)) {
        return current;
      }
      return {
        ...current,
        source_account_id:
          accountOptions.find((account) => account.isPrimary || account.is_primary)?.id ||
          accountOptions.find((account) => account.account_purpose === "daily")?.id ||
          accountOptions[0].id,
      };
    });
  }, [dailyCurrency, accountOptionsKey]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!accountOptions.length || !form.source_account_id) {
      onRequestAddWallet?.();
      return;
    }

    const succeeded = await onSubmit({
      type: "expense",
      occurred_at: new Date().toISOString(),
      description: form.description.trim(),
      category_group: hasBudget ? UNIVERSAL_BUDGET_GROUP : null,
      category: form.category,
      currency: dailyCurrency,
      amount: normalizeNumericInput(form.amount_thb, dailyInputOptions),
      amount_idr: dailyCurrency === "IDR" ? normalizeNumericInput(form.amount_thb, dailyInputOptions) : null,
      amount_thb: dailyCurrency === "THB" ? normalizeNumericInput(form.amount_thb, dailyInputOptions) : null,
      exchange_rate: null,
      expense_currency: dailyCurrency,
      source_account_id: form.source_account_id || null,
    });

    if (succeeded) {
      setForm({
        description: "",
        category: DEFAULT_CATEGORY,
        amount_thb: "",
        source_account_id: form.source_account_id,
      });
    }
  }

  return html`
    <div className=${`${PREMIUM_PANEL} p-4 md:p-6 lg:p-5`}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),transparent_50%)] opacity-80"></div>
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold md:text-xl">Pengeluaran Hari Ini</h3>
            <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300/80">
              Catat pengeluaran cepat tanpa buka formulir lengkap.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <div className="inline-flex rounded-full border border-brand-300/25 bg-brand-500/10 px-3 py-1 text-xs font-black text-brand-700 backdrop-blur-xl dark:bg-brand-400/10 dark:text-brand-200">
              ${dailyCurrency}
            </div>
            <div className="inline-flex rounded-full border border-slate-200/70 bg-white/60 px-3 py-1 text-[11px] font-semibold text-slate-600 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/40 dark:text-slate-300">
              Sekarang
            </div>
          </div>
        </div>
      </div>

      <div className="relative mt-4 rounded-2xl border border-slate-200/70 bg-white/58 p-3.5 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/40 lg:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className=${`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusTone}`}>
            ${statusLabel}
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              Pengingat hari ini
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
              ${budget ? `Batas ${todayLimit}` : `Atur anggaran ${dailyCurrency} lewat Kontrol`}
            </p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="min-w-0 rounded-2xl border border-slate-200/60 bg-white/50 px-3 py-3 dark:border-white/10 dark:bg-slate-950/30">
            <p className="truncate text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
              Terpakai
            </p>
            <p className="mt-1.5 truncate text-sm font-black text-slate-950 dark:text-white md:text-lg">
              ${formatCurrency(todaySpentToday, todaySpentCurrencyCode)}
            </p>
            ${/* Terpakai dan Sisa aman harus berasal dari jatah yang sama.
                  Dulu Terpakai hanya menjumlah mata uang harian sedangkan
                  Sisa aman memotong belanja jatah dari semua mata uang. */ null}
            <p className="mt-1 truncate text-[10px] font-semibold text-slate-500 dark:text-slate-400">
              ${todaySpentScopeLabel}
            </p>
          </div>
          <div className="min-w-0 rounded-2xl border border-slate-200/60 bg-white/50 px-3 py-3 dark:border-white/10 dark:bg-slate-950/30">
            <p className="truncate text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
              Sisa aman
            </p>
            <p className="mt-1.5 truncate text-sm font-black text-slate-950 dark:text-white md:text-lg">
              ${safeRemaining}
            </p>
          </div>
          <div className="min-w-0 rounded-2xl border border-slate-200/60 bg-white/50 px-3 py-3 dark:border-white/10 dark:bg-slate-950/30">
            <p className="truncate text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
              Valuasi ${normalizeCurrencyCode(baseCurrency)}
            </p>
            <p className="mt-1.5 truncate text-sm font-black text-slate-950 dark:text-white md:text-lg">
              ${todaySpentIdr > 0
                ? formatCurrency(todaySpentIdr, normalizeCurrencyCode(baseCurrency))
                : "-"}
            </p>
            <p className="mt-1 truncate text-[10px] font-semibold text-slate-500 dark:text-slate-400">
              Pengeluaran ${dailyCurrency} hari ini
            </p>
          </div>
        </div>
      </div>

      <form className="relative mt-4 grid gap-3.5 lg:mt-5 lg:grid-cols-2 lg:gap-4" onSubmit=${handleSubmit}>
        ${!accountOptions.length
          ? html`
              <div className="rounded-2xl border border-amber-300/25 bg-amber-400/10 p-4 text-sm leading-6 text-amber-950 dark:border-amber-300/20 dark:text-amber-100 lg:col-span-2">
                <p className="font-black">Belum ada dompet ${dailyCurrency}</p>
                <p className="mt-1 text-xs">
                  Tambahkan dompet agar CUANSYNC tahu saldo mana yang dipakai untuk pengeluaran ini.
                </p>
                ${onRequestAddWallet
                  ? html`
                      <button
                        type="button"
                        onClick=${onRequestAddWallet}
                        className="mt-3 min-h-10 rounded-xl bg-brand-600 px-3 py-2 text-xs font-black text-white transition hover:bg-brand-700"
                      >
                        Tambah dompet
                      </button>
                    `
                  : null}
              </div>
            `
          : null}
        <label className="block lg:col-span-2">
          <span className="mb-2 block text-sm font-medium">Jumlah (${dailyCurrency})</span>
          <input
            type="text"
            inputMode=${dailyInputOptions.allowDecimal ? "decimal" : "numeric"}
            autoComplete="off"
            required
            value=${form.amount_thb}
            onChange=${(event) =>
              updateField("amount_thb", formatNumericInput(event.target.value, dailyInputOptions))}
            placeholder="0"
            className=${GLASS_INPUT}
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium">Kategori</span>
          <select
            value=${form.category}
            onChange=${(event) => updateField("category", event.target.value)}
            className=${GLASS_INPUT}
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

        ${accountOptions.length
          ? html`
              <label className="block">
                <span className="mb-2 block text-sm font-medium">Dompet</span>
                <select
                  value=${form.source_account_id}
                  onChange=${(event) => updateField("source_account_id", event.target.value)}
                  className=${GLASS_INPUT}
                >
                  ${accountOptions.map(
                    (account) => html`
                      <option key=${account.id} value=${account.id}>
                        ${getAssetAccountDisplayName(account)} — tersedia ${formatCurrency(
                          account.availableBalance ?? account.balance_amount,
                          account.currency,
                        )}
                      </option>
                    `,
                  )}
                </select>
              </label>
              ${crossesProtectedFunds
                ? html`
                    <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs leading-5 text-amber-700 dark:text-amber-200 lg:col-span-2">
                      Nominal memakai dana target. Buka formulir lengkap untuk memilih target
                      yang ingin digunakan.
                    </p>
                  `
                : null}
            `
          : null}

        <label className="block lg:col-span-2">
          <span className="mb-2 block text-sm font-medium">Catatan</span>
          <input
            type="text"
            placeholder="Contoh: makan siang"
            value=${form.description}
            onChange=${(event) => updateField("description", event.target.value)}
            className=${GLASS_INPUT}
          />
        </label>

        <div className="lg:col-span-2">
          <${SubmitActionBar}
            label="Simpan pengeluaran"
            loading=${loading}
            disabled=${submitDisabled}
          />
        </div>
      </form>
    </div>
  `;
}

function InfoBanner({ message, tone }) {
  if (!message) return null;
  const tones = {
    info:
      "border-sky-300/20 bg-sky-400/10 text-sky-900 backdrop-blur-xl dark:border-sky-400/20 dark:bg-sky-500/10 dark:text-sky-200",
    success:
      "border-emerald-300/20 bg-emerald-400/10 text-emerald-900 backdrop-blur-xl dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200",
    error:
      "border-rose-300/20 bg-rose-400/10 text-rose-900 backdrop-blur-xl dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200",
  };

  return html`
    <div className=${`rounded-2xl border px-4 py-3 text-sm font-medium ${tones[tone]}`}>
      ${message}
    </div>
  `;
}

function ToastMessage({ toast, onDismiss }) {
  if (!toast) return null;
  const tone = toast.tone || "success";
  const tones = {
    success:
      "border-emerald-300/25 bg-emerald-500/14 text-emerald-900 shadow-[0_22px_60px_rgba(16,185,129,0.22)] dark:border-emerald-400/20 dark:bg-emerald-500/16 dark:text-emerald-100",
    info:
      "border-sky-300/25 bg-sky-500/14 text-sky-900 shadow-[0_22px_60px_rgba(14,165,233,0.20)] dark:border-sky-400/20 dark:bg-sky-500/16 dark:text-sky-100",
    warning:
      "border-amber-300/30 bg-amber-500/14 text-amber-900 shadow-[0_22px_60px_rgba(245,158,11,0.18)] dark:border-amber-400/20 dark:bg-amber-500/16 dark:text-amber-100",
    error:
      "border-rose-300/25 bg-rose-500/14 text-rose-900 shadow-[0_22px_60px_rgba(244,63,94,0.20)] dark:border-rose-400/20 dark:bg-rose-500/16 dark:text-rose-100",
  };
  const closeTone = {
    success: "text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-200",
    info: "text-sky-700 hover:bg-sky-500/10 dark:text-sky-200",
    warning: "text-amber-700 hover:bg-amber-500/10 dark:text-amber-200",
    error: "text-rose-700 hover:bg-rose-500/10 dark:text-rose-200",
  };

  return html`
    <div className="fixed inset-x-4 top-4 z-50 sm:left-auto sm:right-6 sm:w-[22rem]">
      <div className=${`rounded-[22px] border px-4 py-3 text-sm font-semibold backdrop-blur-2xl transition duration-300 ease-out ${tones[tone] || tones.success}`}>
        <div className="flex items-start justify-between gap-3">
          <p>${toast.message}</p>
          <button
            type="button"
            onClick=${onDismiss}
            aria-label="Tutup toast"
            className=${`min-h-0 rounded-full px-2 py-0.5 text-xs transition ${closeTone[tone] || closeTone.success}`}
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  `;
}

function App() {
  const [theme, setTheme] = useState(() =>
    normalizeThemeMode(readAppStorage("theme", "system")),
  );
  const [systemPrefersDark, setSystemPrefersDark] = useState(() =>
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : false,
  );
  const [user, setUser] = useState(null);
  const [hydratedUserId, setHydratedUserId] = useState(null);
  const [profile, setProfile] = useState(null);
  const [mode, setMode] = useState("loading");
  const [authRecoveryError, setAuthRecoveryError] = useState("");
  const [authRecoveryAttempt, setAuthRecoveryAttempt] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  /* Mode simpel menyisihkan perkiraan tagihan rutin dari jatah harian.
     Pilihannya hanya memengaruhi tampilan, jadi cukup disimpan di perangkat
     ini seperti preferensi tampilan lainnya. */
  const [reserveBills, setReserveBills] = useState(
    () => readAppStorage("budgetBillReserve", true) !== false,
  );
  const [goals, setGoals] = useState([]);
  const [goalActivities, setGoalActivities] = useState([]);
  const [goalFundingAccounts, setGoalFundingAccounts] = useState([]);
  const [assetAccounts, setAssetAccounts] = useState([]);
  const [accountReconciliations, setAccountReconciliations] = useState([]);
  const [accountPreferences, setAccountPreferences] = useState([]);
  const [profilePhotos, setProfilePhotos] = useState(() =>
    readAppStorage("profilePhotos", {}),
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState("info");
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [reportMonthKey, setReportMonthKey] = useState(getMonthKey(new Date()));
  const [balanceVisible, setBalanceVisible] = useState(() =>
    readBalanceVisiblePreference(),
  );
  const [currencySettings, setCurrencySettings] = useState(() =>
    readCurrencySettings(),
  );
  const [globalRateSnapshot, setGlobalRateSnapshot] = useState(() =>
    normalizeGlobalRateSnapshot(
      readAppStorage("globalExchangeRates", null),
      getBaseCurrency(),
    ),
  );
  const [selectedWalletCurrency, setSelectedWalletCurrency] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [quickActionOpen, setQuickActionOpen] = useState(false);
  const [transactionEntryType, setTransactionEntryType] = useState("expense");
  const [transactionTargetDraft, setTransactionTargetDraft] = useState({
    id: "",
    currency: "",
  });
  const [transactionReturnTab, setTransactionReturnTab] = useState("overview");
  const [movementInitialMode, setMovementInitialMode] = useState("exchange");
  const [assetFormRequest, setAssetFormRequest] = useState(0);
  const [budgetFocusCategoryKey, setBudgetFocusCategoryKey] = useState(null);
  const [historyFocusCategory, setHistoryFocusCategory] = useState("");
  const [quickEntryOpen, setQuickEntryOpen] = useState(false);
  const [bulkEntryOpen, setBulkEntryOpen] = useState(false);
  const [quickEntryRequestKey, setQuickEntryRequestKey] = useState(0);
  const [quickEntryInitialAccountId, setQuickEntryInitialAccountId] = useState("");
  const [quickEntryInitialAmount, setQuickEntryInitialAmount] = useState(0);
  const [pendingNativeAction, setPendingNativeAction] = useState(null);
  const handledNativeAuthUrlsRef = useRef(new Set());
  const lastNativeActionRef = useRef({ url: "", handledAt: 0 });
  const [transactionFabHintDismissed, setTransactionFabHintDismissed] = useState(() =>
    Boolean(readAppStorage("transactionFabHintDismissed", false)),
  );

  const supabaseReady = Boolean(supabase);
  setRuntimeCurrencySettings(currencySettings);
  const normalizedAppCurrencySettings = normalizeCurrencySettings(
    currencySettings || DEFAULT_SELECTED_CURRENCIES,
    { configured: Boolean(currencySettings?.configured) },
  );
  const activeCurrencies = normalizedAppCurrencySettings.activeCurrencies;
  const globalRateCurrencies = normalizeCurrencyList([
    ...DEFAULT_ACTIVE_CURRENCIES,
    ...activeCurrencies,
    ...assetAccounts.map((account) => account.currency),
    ...transactions.map((transaction) => getTransactionCurrency(transaction)),
  ]);
  const metrics = useMemo(
    () => computeMetrics(
      transactions,
      budgets,
      goals,
      goalActivities,
      assetAccounts,
      globalRateSnapshot,
    ),
    [
      transactions,
      budgets,
      goals,
      goalActivities,
      assetAccounts,
      currencySettings,
      globalRateSnapshot,
    ],
  );

  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => setSystemPrefersDark(mediaQuery.matches);
    handleChange();
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    const resolvedTheme = resolveThemeMode(theme, systemPrefersDark);
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
    writeAppStorage("theme", normalizeThemeMode(theme));
    updateNativeStatusBar(resolvedTheme === "dark").catch(() => {});
    /* Padanan status bar untuk peramban dan PWA: tag theme-color di index.html
       hanya mengikuti prefers-color-scheme sistem, sedangkan tema di sini bisa
       dipilih manual. */
    syncThemeColorMeta(resolvedTheme === "dark");
  }, [theme, systemPrefersDark]);

  useEffect(() => {
    if (!isNativeMobileApp()) return undefined;
    let active = true;
    let listenerHandle = null;

    const handleNativeUrl = async (url) => {
      const route = parseNativeAppRoute(url);
      if (!route) return;

      if (route.kind !== "auth-callback") {
        /* Beberapa perangkat mengirim URL peluncuran lalu appUrlOpen untuk
           ketukan yang sama. Redam hanya duplikat yang sangat berdekatan;
           URL widget memang sengaja identik pada setiap ketukan berikutnya. */
        const now = Date.now();
        const previous = lastNativeActionRef.current;
        if (previous.url === url && now - previous.handledAt < 750) return;
        lastNativeActionRef.current = { url, handledAt: now };
        if (active) {
          setPendingNativeAction({ ...route, requestedAt: now });
        }
        return;
      }

      if (!supabaseReady || handledNativeAuthUrlsRef.current.has(url)) return;
      try {
        const callback = getAuthCallbackFromUrl(url);
        if (!callback) return;
        handledNativeAuthUrlsRef.current.add(url);
        const { error } = callback.type === "pkce"
          ? await supabase.auth.exchangeCodeForSession(callback.code)
          : await supabase.auth.setSession(callback.session);
        if (error) throw error;
        await closeNativeAuthBrowser();
        if (!active) return;
        setAuthRecoveryError("");
        setMessage("Login Google berhasil. Selamat datang di CUANSYNC.");
        setMessageTone("success");
      } catch (error) {
        await closeNativeAuthBrowser();
        if (!active) return;
        setMessage(error.message || "Login Google di aplikasi gagal diselesaikan.");
        setMessageTone("error");
      }
    };

    addNativeUrlListener(handleNativeUrl).then((handle) => {
      if (!active) {
        handle?.remove();
        return;
      }
      listenerHandle = handle;
      getNativeLaunchUrl()
        .then(handleNativeUrl)
        .catch((error) => {
          if (!active) return;
          setMessage(error.message || "Aksi saat aplikasi dibuka tidak dapat diperiksa.");
          setMessageTone("error");
        });
    });

    return () => {
      active = false;
      listenerHandle?.remove();
    };
  }, [supabaseReady]);

  useEffect(() => {
    if (!supabaseReady || !isNativeMobileApp()) return undefined;
    let active = true;
    let listenerHandle = null;

    let lifecycleUpdate = Promise.resolve();
    const applyAppState = ({ isActive }) => {
      lifecycleUpdate = lifecycleUpdate
        .catch(() => {})
        .then(() =>
          isActive
            ? supabase.auth.startAutoRefresh()
            : supabase.auth.stopAutoRefresh(),
        );
      return lifecycleUpdate;
    };

    addNativeAppStateListener(applyAppState).then((handle) => {
      if (!active) {
        handle?.remove();
        return;
      }
      listenerHandle = handle;
      getNativeAppState().then(applyAppState).catch(() => {});
    });

    return () => {
      active = false;
      listenerHandle?.remove();
      supabase.auth.stopAutoRefresh().catch(() => {});
    };
  }, [supabaseReady]);

  useEffect(() => {
    if (!isNativeMobileApp()) return undefined;
    let active = true;
    let listenerHandle = null;

    addNativeBackButtonListener(async () => {
      const dialogs = [...document.querySelectorAll('[role="dialog"]')];
      const topDialog = dialogs.at(-1);
      const dialogCloseButton = topDialog
        ? [...topDialog.querySelectorAll("button")].find((button) =>
            String(button.getAttribute("aria-label") || button.textContent || "")
              .trim()
              .toLowerCase()
              .startsWith("tutup"),
          )
        : null;
      if (dialogCloseButton) {
        dialogCloseButton.click();
        return;
      }
      if (quickActionOpen) {
        setQuickActionOpen(false);
        return;
      }
      if (menuOpen) {
        setMenuOpen(false);
        return;
      }
      if (activeTab === "add") {
        setTransactionTargetDraft({ id: "", currency: "" });
        setActiveTab(transactionReturnTab || "overview");
        return;
      }
      if (activeTab !== "overview") {
        setActiveTab("overview");
        return;
      }
      await minimizeNativeApp();
    }).then((handle) => {
      if (!active) {
        handle?.remove();
        return;
      }
      listenerHandle = handle;
    });

    return () => {
      active = false;
      listenerHandle?.remove();
    };
  }, [activeTab, menuOpen, quickActionOpen, transactionReturnTab]);

  useEffect(() => {
    const baseCurrency = normalizedAppCurrencySettings.baseCurrency;
    const currentSnapshot = normalizeGlobalRateSnapshot(globalRateSnapshot, baseCurrency);
    if (
      currentSnapshot.baseCurrency === baseCurrency &&
      isGlobalRateSnapshotFresh(currentSnapshot) &&
      hasGlobalRatesForCurrencies(currentSnapshot, globalRateCurrencies, baseCurrency)
    ) {
      return undefined;
    }

    let cancelled = false;
    fetchGlobalCurrencyRates({
      baseCurrency,
      currencies: globalRateCurrencies,
    })
      .then((snapshot) => {
        if (cancelled) return;
        setGlobalRateSnapshot(snapshot);
        writeAppStorage("globalExchangeRates", snapshot);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [
    normalizedAppCurrencySettings.baseCurrency,
    globalRateCurrencies.join("|"),
  ]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    setSelectedWalletCurrency(null);
  }, [currencySettings?.dailyCurrency, activeCurrencies.join("|")]);

  useEffect(() => {
    if (!message || messageTone === "error") return undefined;
    setToast({ message, tone: messageTone });
    const timer = window.setTimeout(() => setMessage(""), 3400);
    return () => window.clearTimeout(timer);
  }, [message, messageTone]);

  useEffect(() => {
    const demoAuth = readAppStorage("demoAuth", false);
    if (demoAuth) {
      setUser(DEMO_USER);
      setMode("demo");
      return undefined;
    }

    if (!supabaseReady) {
      setMode("signed-out");
      return undefined;
    }

    let active = true;
    let sessionRestored = false;
    let queuedAuthSession = null;
    let hasQueuedAuthEvent = false;

    const applySessionUser = (sessionUser) => {
      if (sessionUser) {
        const ownerId = getCurrencySettingsOwnerId(sessionUser);
        const cachedSettings = readCurrencySettings(ownerId);
        const startupSettings =
          cachedSettings || normalizeCurrencySettings(null);
        setCurrencySettings(startupSettings);
        setRuntimeCurrencySettings(startupSettings);
        const cachedProfile = readLocalProfile(sessionUser, startupSettings);
        setProfile(cachedProfile);
        setTheme(cachedProfile.theme_mode);
        setBalanceVisible(!cachedProfile.hide_balances);
      } else {
        setCurrencySettings(null);
        setRuntimeCurrencySettings(null);
      }
      setUser(sessionUser);
      setMode(sessionUser ? "supabase" : "signed-out");
    };

    supabaseSessionRecovery
      .restoreSession()
      .then(({ data, error }) => {
        if (!active) return;
        sessionRestored = true;
        if (hasQueuedAuthEvent) {
          setAuthRecoveryError("");
          applySessionUser(queuedAuthSession?.user || null);
          return;
        }
        if (error) {
          setAuthRecoveryError(
            error.message || "Sesi tersimpan belum dapat diperiksa.",
          );
          setMode("session-error");
          return;
        }
        setAuthRecoveryError("");
        const sessionUser = data.session?.user || null;
        applySessionUser(sessionUser);
        if (sessionUser) {
          supabaseSessionRecovery
            .validateSessionUser()
            .then(({ data: userData, error: validationError }) => {
              if (!active) return;
              if (validationError || !userData?.user) {
                setMessage(
                  "Sesi lokal berhasil dipulihkan. Verifikasi akun akan dicoba lagi saat koneksi stabil.",
                );
                setMessageTone("info");
                return;
              }
              if (userData.user.id !== sessionUser.id) {
                setAuthRecoveryError(
                  "Identitas sesi tersimpan tidak cocok. Silakan masuk kembali dengan akun yang benar.",
                );
                setMode("session-error");
              }
            })
            .catch(() => {
              if (!active) return;
              setMessage(
                "Sesi lokal berhasil dipulihkan. Verifikasi akun akan dicoba lagi saat koneksi stabil.",
              );
              setMessageTone("info");
            });
        }
      })
      .catch((error) => {
        if (!active) return;
        sessionRestored = true;
        if (hasQueuedAuthEvent) {
          setAuthRecoveryError("");
          applySessionUser(queuedAuthSession?.user || null);
          return;
        }
        setAuthRecoveryError(
          error.message || "Sesi tersimpan belum dapat diperiksa.",
        );
        setMode("session-error");
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (!sessionRestored) {
        if (_event !== "INITIAL_SESSION") {
          queuedAuthSession = session;
          hasQueuedAuthEvent = true;
        }
        return;
      }
      const sessionUser = session?.user || null;
      setAuthRecoveryError("");
      applySessionUser(sessionUser);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabaseReady, authRecoveryAttempt]);

  useEffect(() => {
    if (!user) {
      setHydratedUserId(null);
      setTransactions([]);
      setBudgets([]);
      setGoals([]);
      setGoalActivities([]);
      setAssetAccounts([]);
      setAccountReconciliations([]);
      setProfile(null);
      setCurrencySettings(null);
      setRuntimeCurrencySettings(null);
      return;
    }

    setHydratedUserId(null);
    let cancelled = false;

    async function loadDashboardData() {
      if (mode === "demo") {
        const normalizedDemoTransactions = orderTransactions(
          normalizeTransactions(readAppStorage("demoTransactions", [])),
        );
        const inferredDemoCurrencies = inferCurrenciesFromTransactions(
          normalizedDemoTransactions,
        );
        const demoOwnerId = getCurrencySettingsOwnerId(DEMO_USER);
        const localSettings =
          readCurrencySettings(demoOwnerId) ||
          saveCurrencySettings({
            activeCurrencies: inferredDemoCurrencies,
            baseCurrency: DEFAULT_BASE_CURRENCY,
            dailyCurrency: inferredDemoCurrencies[0] || DEFAULT_BASE_CURRENCY,
          }, demoOwnerId);
        const localProfile = readLocalProfile(user, localSettings);
        writeAppStorage("demoTransactions", normalizedDemoTransactions);
        setTransactions(normalizedDemoTransactions);
        setBudgets(
          normalizeBudgets(
            readAppStorage("demoBudgets", []),
            getBaseCurrency(),
          ),
        );
        setGoals(readAppStorage("demoGoals", []).map(normalizeGoal));
        setGoalActivities(
          normalizeGoalActivities(readAppStorage("demoGoalActivities", [])),
        );
        const demoPreferences = readAppStorage("demoAccountPreferences", []);
        const demoPrimaryIds = new Set(
          demoPreferences
            .filter((preference) => preference.flow_type === "expense")
            .map((preference) => preference.account_id),
        );
        setGoalFundingAccounts(readAppStorage("demoGoalFundingAccounts", []));
        setAccountPreferences(demoPreferences);
        setAssetAccounts(
          normalizeAssetAccounts(
            readAppStorage("demoAssetAccounts", []).map((account) => ({
              ...account,
              is_primary: demoPrimaryIds.has(account.id),
            })),
          ),
        );
        setAccountReconciliations(
          normalizeAccountReconciliations(
            readAppStorage("demoAccountReconciliations", []),
          ),
        );
        setProfile(localProfile);
        setTheme(localProfile.theme_mode);
        setBalanceVisible(!localProfile.hide_balances);
        setCurrencySettings(localSettings);
        setRuntimeCurrencySettings(localSettings);
        if (!cancelled) setHydratedUserId(user.id);
        return;
      }

      const ownerId = getCurrencySettingsOwnerId(user);
      const cachedSettings = readCurrencySettings(ownerId);
      if (cachedSettings) {
        setCurrencySettings((current) => current || cachedSettings);
        setRuntimeCurrencySettings(cachedSettings);
      }
      setLoading(true);
      const [
        transactionResult,
        budgetResult,
        goalResult,
        goalActivityResult,
        goalFundingResult,
        assetAccountResult,
        accountReconciliationResult,
        accountPreferenceResult,
        settingsResult,
        profileResult,
        currencyResult,
      ] = await Promise.all([
        supabase
          .from("transactions")
          .select("*")
          .eq("user_id", user.id)
          .order("occurred_at", { ascending: true })
          .order("created_at", { ascending: true }),
        supabase
          .from("budgets")
          .select("*")
          .eq("user_id", user.id)
          .order("month_key", { ascending: false })
          .order("group_key", { ascending: true }),
        supabase
          .from("goals")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("goal_allocations")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("goal_funding_accounts")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("asset_accounts")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("account_reconciliations")
          .select("*")
          .eq("user_id", user.id)
          .order("checked_at", { ascending: false })
          .limit(100),
        supabase
          .from("account_preferences")
          .select("*")
          .eq("user_id", user.id),
        supabase
          .from("user_settings")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("user_currencies")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true }),
      ]);

      if (cancelled) return;

      const notices = [];

      if (transactionResult.error) {
        notices.push({
          tone: "error",
          text: transactionResult.error.message,
        });
        setTransactions([]);
      } else {
        setTransactions(
          orderTransactions(normalizeTransactions(transactionResult.data || [])),
        );
      }

      if (budgetResult.error) {
        setBudgets([]);
        notices.push({
          tone: budgetResult.error.code === "42P01" ? "info" : "error",
          text:
            budgetResult.error.code === "42P01"
              ? "Tabel anggaran belum ada. Jalankan schema.sql terbaru agar fitur proteksi anggaran aktif."
              : budgetResult.error.message,
        });
      } else {
        setBudgets(
          normalizeBudgets(budgetResult.data || [], getBaseCurrency()),
        );
      }

      if (goalResult.error) {
        setGoals([]);
        notices.push({
          tone: goalResult.error.code === "42P01" ? "info" : "error",
          text:
            goalResult.error.code === "42P01"
              ? "Tabel target belum ada. Jalankan schema.sql terbaru agar pelacak kemajuan aktif."
              : goalResult.error.message,
        });
      } else {
        const fundingRows = goalFundingResult.error
          ? []
          : goalFundingResult.data || [];
        setGoalFundingAccounts(fundingRows);
        setGoals(
          (goalResult.data || []).map((goal) =>
            normalizeGoal({
              ...goal,
              goal_funding_accounts: fundingRows.filter(
                (funding) => funding.goal_id === goal.id,
              ),
            }),
          ),
        );
      }

      if (goalActivityResult.error) {
        setGoalActivities([]);
        notices.push({
          tone:
            goalActivityResult.error.code === "42P01" ||
            goalActivityResult.error.code === "PGRST205"
              ? "info"
              : "error",
          text:
            goalActivityResult.error.code === "42P01" ||
            goalActivityResult.error.code === "PGRST205"
              ? "Aktivitas alokasi belum tersedia. Jalankan migrasi target terbaru agar alokasi dapat disimpan."
              : goalActivityResult.error.message,
        });
      } else {
        setGoalActivities(
          normalizeGoalActivities(goalActivityResult.data || []),
        );
      }

      if (assetAccountResult.error) {
        setAssetAccounts([]);
        notices.push({
          tone: assetAccountResult.error.code === "42P01" ? "info" : "error",
          text:
            assetAccountResult.error.code === "42P01"
              ? "Tabel akun/bank belum ada. Jalankan schema.sql terbaru agar fitur Aset aktif."
              : assetAccountResult.error.message,
        });
      } else {
        const preferenceRows = accountPreferenceResult.error
          ? []
          : accountPreferenceResult.data || [];
        setAccountPreferences(preferenceRows);
        const primaryIds = new Set(
          preferenceRows
            .filter((preference) => preference.flow_type === "expense")
            .map((preference) => preference.account_id),
        );
        setAssetAccounts(
          normalizeAssetAccounts(
            (assetAccountResult.data || []).map((account) => ({
              ...account,
              is_primary: primaryIds.has(account.id),
            })),
          ),
        );
      }

      if (accountReconciliationResult.error) {
        setAccountReconciliations([]);
        const reconciliationTableMissing =
          accountReconciliationResult.error.code === "42P01" ||
          accountReconciliationResult.error.code === "PGRST205";
        if (!reconciliationTableMissing) {
          notices.push({
            tone: "error",
            text: accountReconciliationResult.error.message,
          });
        }
      } else {
        setAccountReconciliations(
          normalizeAccountReconciliations(accountReconciliationResult.data || []),
        );
      }

      const legacySettings = settingsResult.error
        ? null
        : normalizeUserSettingsRow(settingsResult.data);
      const localSettings = readCurrencySettings(ownerId);
      const remoteTransactions = transactionResult.error ? [] : transactionResult.data || [];
      const remoteBudgets = budgetResult.error ? [] : budgetResult.data || [];
      const remoteGoals = goalResult.error ? [] : goalResult.data || [];
      const remoteAssetAccounts = assetAccountResult.error
        ? []
        : assetAccountResult.data || [];
      const currencyRows =
        !currencyResult.error && Array.isArray(currencyResult.data)
          ? currencyResult.data
          : [];
      const inferredCurrencies = inferCurrenciesFromTransactions(
        remoteTransactions,
      );
      const hasFinancialHistory =
        remoteTransactions.length > 0 ||
        remoteBudgets.length > 0 ||
        remoteGoals.length > 0 ||
        remoteAssetAccounts.length > 0;
      const hasCustomCurrencyRows =
        currencyRows.length > 1 ||
        currencyRows.some(
          (row) => normalizeCurrencyCode(row.currency_code) !== DEFAULT_BASE_CURRENCY,
        );
      const hasProfileCustomCurrency =
        !profileResult.error &&
        Boolean(profileResult.data) &&
        (normalizeCurrencyCode(profileResult.data.base_currency) !== DEFAULT_BASE_CURRENCY ||
          normalizeCurrencyCode(profileResult.data.daily_currency) !== DEFAULT_BASE_CURRENCY);
      const setupConfigured = Boolean(
        legacySettings ||
          localSettings?.configured ||
          hasCustomCurrencyRows ||
          hasProfileCustomCurrency ||
          hasFinancialHistory,
      );
      const fallbackSettings =
        legacySettings ||
        localSettings ||
        normalizeCurrencySettings(
          {
            activeCurrencies: inferredCurrencies,
            baseCurrency: DEFAULT_BASE_CURRENCY,
            dailyCurrency: inferredCurrencies[0] || DEFAULT_BASE_CURRENCY,
            configured: setupConfigured,
          },
          { configured: setupConfigured },
        );

      const modernProfile =
        !profileResult.error && profileResult.data
          ? normalizeProfile(profileResult.data, user, {
              ...fallbackSettings,
              theme_mode: settingsResult.data?.theme,
              hideBalances:
                typeof settingsResult.data?.balance_visible === "boolean"
                  ? !settingsResult.data.balance_visible
                  : undefined,
            })
          : null;
      const modernSettings =
        setupConfigured &&
        !currencyResult.error &&
        (currencyRows.length > 0 || hasProfileCustomCurrency)
          ? normalizeUserCurrencyRows(
              currencyRows,
              modernProfile || profileResult.data,
              fallbackSettings,
              inferredCurrencies,
            )
          : null;
      const nextSettings = normalizeCurrencySettings(
        modernSettings || fallbackSettings,
        { configured: setupConfigured },
      );
      const nextProfile = normalizeProfile(modernProfile || profileResult.data, user, {
        ...nextSettings,
        theme_mode: settingsResult.data?.theme || theme,
        hideBalances:
          typeof settingsResult.data?.balance_visible === "boolean"
            ? !settingsResult.data.balance_visible
            : !balanceVisible,
      });
      /* Sebelum migration perkiraan pemasukan terpasang, baris profil belum
         punya kolomnya, jadi perkiraan dari perangkat yang dipakai. Setelah
         kolomnya ada, perkiraan yang tertunda dikirim sekali ke profil,
         kecuali profil sudah punya nilai yang lebih baru. */
      const pendingIncomeEstimate = readLocalIncomeEstimate(user);
      const incomeEstimateColumnReady =
        !profileResult.error &&
        Boolean(profileResult.data) &&
        Object.prototype.hasOwnProperty.call(
          profileResult.data,
          "monthly_income_estimate",
        );
      if (pendingIncomeEstimate && !incomeEstimateColumnReady) {
        Object.assign(nextProfile, pendingIncomeEstimate);
      } else if (
        pendingIncomeEstimate?.monthly_income_estimate != null &&
        nextProfile.monthly_income_estimate == null
      ) {
        Object.assign(nextProfile, pendingIncomeEstimate);
        Promise.resolve(upsertIncomeEstimate(user, pendingIncomeEstimate))
          .then(({ error }) => {
            if (!error) writeLocalIncomeEstimate(user, null);
          })
          .catch(() => {});
      } else if (pendingIncomeEstimate) {
        writeLocalIncomeEstimate(user, null);
      }

      setCurrencySettings(nextSettings);
      setRuntimeCurrencySettings(nextSettings);
      cacheCurrencySettings(nextSettings, ownerId);
      setProfile(nextProfile);
      setTheme(nextProfile.theme_mode);
      writeBalanceVisiblePreference(!nextProfile.hide_balances);
      setBalanceVisible(!nextProfile.hide_balances);

      const modernTablesReady = !profileResult.error && !currencyResult.error;
      if (modernTablesReady && nextSettings.configured) {
        const existingCodes = currencyRows.map((row) => row.currency_code);
        Promise.all([
          supabase.from("profiles").upsert(
            {
              id: user.id,
              email: nextProfile.email || user.email || "",
              display_name: nextProfile.display_name,
              avatar_url: nextProfile.avatar_url,
              base_currency: nextSettings.baseCurrency,
              daily_currency: nextSettings.dailyCurrency,
              theme_mode: nextProfile.theme_mode,
              hide_balances: nextProfile.hide_balances,
              country_code: nextProfile.country_code || null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "id" },
          ),
          supabase.from("user_currencies").upsert(
            buildUserCurrencyRecords(user.id, nextSettings, existingCodes),
            { onConflict: "user_id,currency_code" },
          ),
        ]).catch(() => {});
      } else if (profileResult.error?.code === "42P01" || currencyResult.error?.code === "42P01") {
        notices.push({
          tone: "info",
          text:
            "Schema profil terbaru belum aktif. Jalankan schema.sql agar Pengaturan sinkron lintas perangkat.",
        });
      }

      if (settingsResult.error && settingsResult.error.code !== "42P01") {
        notices.push({
          tone: "error",
          text: settingsResult.error.message,
        });
      }

      if (notices.length) {
        setMessage(notices[0].text);
        setMessageTone(notices[0].tone);
      }

      setLoading(false);
      if (!cancelled) setHydratedUserId(user.id);
    }

    loadDashboardData();

    return () => {
      cancelled = true;
    };
  }, [user, mode]);

  async function handleGoogleLogin() {
    if (!supabaseReady) return;
    setMessage("");

    const nativeLogin = isNativeMobileApp();

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: nativeLogin
          ? NATIVE_AUTH_REDIRECT_URL
          : window.location.origin,
        skipBrowserRedirect: nativeLogin,
      },
    });

    if (error) {
      setMessage(error.message);
      setMessageTone("error");
      return;
    }
    if (nativeLogin && data?.url) {
      try {
        await openNativeAuthBrowser(data.url);
      } catch (nativeError) {
        setMessage(nativeError.message || "Browser login Google tidak dapat dibuka.");
        setMessageTone("error");
      }
    }
  }

  function handleDemoLogin() {
    writeAppStorage("demoAuth", true);
    const normalizedDemoTransactions = orderTransactions(
      normalizeTransactions(readAppStorage("demoTransactions", [])),
    );
    const inferredDemoCurrencies = inferCurrenciesFromTransactions(
      normalizedDemoTransactions,
    );
    const demoOwnerId = getCurrencySettingsOwnerId(DEMO_USER);
    const localSettings =
      readCurrencySettings(demoOwnerId) ||
      saveCurrencySettings({
        activeCurrencies: inferredDemoCurrencies,
        baseCurrency: DEFAULT_BASE_CURRENCY,
        dailyCurrency: inferredDemoCurrencies[0] || DEFAULT_BASE_CURRENCY,
      }, demoOwnerId);
    const localProfile = readLocalProfile(DEMO_USER, localSettings);
    writeAppStorage("demoTransactions", normalizedDemoTransactions);
    setUser(DEMO_USER);
    setMode("demo");
    setTransactions(normalizedDemoTransactions);
    setBudgets(
      normalizeBudgets(readAppStorage("demoBudgets", []), getBaseCurrency()),
    );
    setGoals(readAppStorage("demoGoals", []).map(normalizeGoal));
    setGoalActivities(
      normalizeGoalActivities(readAppStorage("demoGoalActivities", [])),
    );
    setProfile(localProfile);
    setTheme(localProfile.theme_mode);
    setBalanceVisible(!localProfile.hide_balances);
    setCurrencySettings(localSettings);
    setRuntimeCurrencySettings(localSettings);
    setMessage("Demo lokal aktif. Semua modul analitik, anggaran, dan target berjalan di browser ini.");
    setMessageTone("success");
  }

  async function handleSignOut() {
    setMessage("");
    if (mode === "demo") {
      window.localStorage.removeItem(STORAGE_KEYS.demoAuth);
      window.localStorage.removeItem(LEGACY_STORAGE_KEYS.demoAuth);
      setUser(null);
      setMode("signed-out");
      setTransactions([]);
      setBudgets([]);
      setGoals([]);
      setGoalActivities([]);
      setProfile(null);
      setCurrencySettings(null);
      setRuntimeCurrencySettings(null);
      return;
    }

    const { error } = await supabase.auth.signOut();
    if (error) {
      setMessage(error.message);
      setMessageTone("error");
      return;
    }
    setCurrencySettings(null);
    setRuntimeCurrencySettings(null);
  }

  async function persistDemoTransactions(nextTransactions) {
    const ordered = orderTransactions(normalizeTransactions(nextTransactions));
    writeAppStorage("demoTransactions", ordered);
    setTransactions(ordered);
  }

  async function persistDemoBudgets(nextBudgets) {
    const normalized = normalizeBudgets(nextBudgets, getBaseCurrency());
    writeAppStorage("demoBudgets", normalized);
    setBudgets(normalized);
  }

  async function persistDemoGoals(nextGoals) {
    writeAppStorage("demoGoals", nextGoals);
    setGoals(nextGoals.map(normalizeGoal));
  }

  async function persistDemoGoalActivities(nextActivities) {
    const normalized = normalizeGoalActivities(nextActivities);
    writeAppStorage("demoGoalActivities", normalized);
    setGoalActivities(normalized);
  }

  function applyAccountPrimaryPreferences(
    nextAccounts,
    preferences = accountPreferences,
  ) {
    const primaryIds = new Set(
      preferences
        .filter((preference) => preference.flow_type === "expense")
        .map((preference) => preference.account_id),
    );
    return normalizeAssetAccounts(
      nextAccounts.map((account) => ({
        ...account,
        is_primary: primaryIds.has(account.id),
      })),
    );
  }

  async function persistDemoAssetAccounts(nextAccounts) {
    const normalized = applyAccountPrimaryPreferences(nextAccounts);
    writeAppStorage("demoAssetAccounts", normalized);
    setAssetAccounts(normalized);
  }

  async function persistAssetAccountBalancePlan(plan) {
    if (!plan.changedAccounts.length) return;

    if (mode === "demo") {
      await persistDemoAssetAccounts(plan.nextAccounts);
      return;
    }

    for (const account of plan.changedAccounts) {
      const { error } = await supabase
        .from("asset_accounts")
        .update({
          balance_amount: account.balance_amount,
          updated_at: account.updated_at || new Date().toISOString(),
        })
        .eq("id", account.id)
        .eq("user_id", user.id);
      if (error) throw error;
    }

    setAssetAccounts(applyAccountPrimaryPreferences(plan.nextAccounts));
  }

  async function handleCreateAccountReconciliation(payload) {
    try {
      setLoading(true);
      setMessage("");
      setToast(null);

      const account = assetAccounts.find(
        (item) => item.id === payload.accountId,
      );
      if (!account) {
        throw new Error("Dompet yang ingin dicocokkan tidak ditemukan.");
      }

      const record = buildAccountReconciliationRecord({
        id: crypto.randomUUID(),
        userId: user.id,
        account,
        bankBalance: payload.bankBalance,
        checkedAt: payload.checkedAt,
        note: payload.note,
      });
      let savedRecord = record;

      if (mode === "demo") {
        const next = normalizeAccountReconciliations([
          record,
          ...accountReconciliations,
        ]);
        writeAppStorage("demoAccountReconciliations", next);
        setAccountReconciliations(next);
      } else {
        const { data, error } = await supabase
          .rpc("record_account_reconciliation", {
            p_account_id: account.id,
            p_bank_balance: record.bank_balance,
            p_note: record.note || null,
          });
        if (error) {
          const tableMissing =
            error.code === "42P01" ||
            error.code === "PGRST202" ||
            error.code === "PGRST205";
          if (tableMissing) {
            throw new Error(
              "Fitur Cocokkan Saldo belum aktif di database. Jalankan migrasi rekonsiliasi terbaru.",
            );
          }
          throw error;
        }
        const savedRow = Array.isArray(data) ? data[0] : data;
        if (!savedRow) {
          throw new Error("Pengecekan saldo tidak mengembalikan hasil.");
        }
        savedRecord = normalizeAccountReconciliation(savedRow);
        setAccountReconciliations((current) =>
          normalizeAccountReconciliations([
            savedRecord,
            ...current,
          ]),
        );
      }

      const matched = savedRecord.status === "matched";
      setMessage(
        matched
          ? `Saldo ${account.name} cocok dan pengecekan telah disimpan.`
          : `Selisih saldo ${account.name} telah disimpan untuk diperiksa.`,
      );
      setMessageTone(matched ? "success" : "info");
      setToast({
        message: matched ? "Saldo cocok." : "Pengecekan saldo disimpan.",
        tone: matched ? "success" : "info",
      });
      return true;
    } catch (error) {
      setMessage(error.message || "Gagal menyimpan pengecekan saldo.");
      setMessageTone("error");
      setToast({
        message: error.message || "Gagal menyimpan pengecekan saldo.",
        tone: "warning",
      });
      return false;
    } finally {
      setLoading(false);
    }
  }

  /* Dipanggil dari Cocokkan Saldo ketika saldo berbeda. Nominalnya hanya
     mengisi formulir; penyimpanan tetap menunggu pengguna menekan Simpan,
     sehingga selisih tidak pernah berubah menjadi transaksi secara diam diam. */
  function handleRecordMissingTransaction(request) {
    const account = spendableAssetAccounts.find(
      (item) => item.id === request?.accountId,
    );
    if (!account) {
      setToast({
        message: "Dompet untuk transaksi ini tidak tersedia.",
        tone: "warning",
      });
      return;
    }

    const entryType = request?.entryType === "income" ? "income" : "expense";
    const amount = Number(request?.amount || 0);
    dismissTransactionFabHint();
    setTransactionEntryType(entryType);
    setQuickEntryInitialAccountId(account.id);
    setQuickEntryInitialAmount(amount > 0 ? amount : 0);
    setQuickEntryRequestKey((current) => current + 1);
    setQuickEntryOpen(true);
    setMenuOpen(false);
    setQuickActionOpen(false);
  }

  async function handleCreateTransaction(payload) {
    try {
      setLoading(true);
      setMessage("");
      setToast(null);
      validateTransactionOccurredAt(payload.occurred_at);

      const record = {
        id: crypto.randomUUID(),
        user_id: user.id,
        type: payload.type,
        occurred_at: payload.occurred_at,
        description: payload.description,
        category: payload.category,
        category_group: payload.category_group,
        amount_idr: null,
        amount_thb: null,
        locked_rate: null,
        currency: null,
        amount: null,
        base_currency: getBaseCurrency(),
        base_amount: null,
        from_currency: null,
        to_currency: null,
        from_amount: null,
        to_amount: null,
        rate: null,
        rate_base_currency: null,
        rate_quote_currency: null,
        exchange_rate: null,
        rate_type: null,
        fee_amount: null,
        fee_currency: null,
        source_account_id: null,
        destination_account_id: null,
        target_id: null,
        client_request_id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (payload.type === "income") {
        const currency = normalizeCurrencyCode(payload.currency);
        const amount = readCurrencyAmount(
          payload.amount || payload.amount_idr || payload.amount_thb,
          currency,
        );
        if (!amount || amount <= 0) {
          throw new Error(`Jumlah pemasukan ${currency} harus lebih besar dari 0.`);
        }
        record.currency = currency;
        record.amount = amount;
        /* Pemasukan valas memakai jalur kurs yang sama dengan pengeluaran:
           tanpa kurs tersimpan, nilainya hilang dari Kondisi keuanganmu. */
        const rateInfo = resolveTransactionRateInfo({
          currency,
          baseCurrency: getBaseCurrency(),
          occurredAt: new Date(payload.occurred_at),
          transactions,
          globalRateSnapshot,
          explicitRate: Number(payload.exchange_rate || payload.rate || 0),
          preferCustom: payload.rate_type === "custom",
        });
        applyTransactionRateToRecord(record, amount, rateInfo);
        record.amount_idr = currency === getBaseCurrency() ? amount : null;
        record.amount_thb = currency === "THB" ? amount : null;
        record.category = null;
        record.category_group = null;
        record.destination_account_id = payload.destination_account_id || null;
      }

      if (payload.type === "exchange") {
        const fromCurrency = normalizeCurrencyCode(payload.from_currency);
        const toCurrency = normalizeCurrencyCode(payload.to_currency, "THB");
        const fromAmountValue = normalizeNumericInput(payload.from_amount, getNumericInputOptions(payload.from_currency));
        const exchangeRateValue = serializeExchangeRate(payload.exchange_rate);
        const feeAmountValue = normalizeNumericInput(payload.fee_amount, getNumericInputOptions(payload.from_currency)) || "0";
        const fromAmount = Number(fromAmountValue);
        const feeAmount = Number(feeAmountValue);
        const rateBaseCurrency = normalizeCurrencyCode(
          payload.rate_base_currency || fromCurrency,
        );
        const rateQuoteCurrency = normalizeCurrencyCode(
          payload.rate_quote_currency || toCurrency,
        );
        const rateType = ["realtime", "custom", "transfer"].includes(
          payload.rate_type,
        )
          ? payload.rate_type
          : "legacy";
        const ratePair = new Set([rateBaseCurrency, rateQuoteCurrency]);
        const rateValidation = validateExchangeRate(exchangeRateValue);
        const calculatedToAmountValue = calculateExchangeTargetAmount({
          sourceCurrency: fromCurrency,
          targetCurrency: toCurrency,
          sourceAmount: fromAmountValue,
          rateBaseCurrency,
          rateQuoteCurrency,
          exchangeRate: exchangeRateValue,
        });
        const toAmount = Number(calculatedToAmountValue);
        const rate = Number(
          getDirectionalExchangeRate({
            sourceCurrency: fromCurrency,
            targetCurrency: toCurrency,
            rateBaseCurrency,
            rateQuoteCurrency,
            exchangeRate: exchangeRateValue,
          }),
        );
        const sourceAccountId = payload.source_account_id || null;
        const destinationAccountId = payload.destination_account_id || null;
        const sourceAccount = assetAccounts.find((account) => account.id === sourceAccountId);
        const destinationAccount = assetAccounts.find(
          (account) => account.id === destinationAccountId,
        );
        const isInternalTransfer = fromCurrency === toCurrency;
        if (!sourceAccountId || !destinationAccountId) {
          throw new Error("Pilih dompet asal dan tujuan terlebih dahulu.");
        }
        if (!sourceAccount || !destinationAccount) {
          throw new Error("Dompet asal atau tujuan tidak ditemukan.");
        }
        if (sourceAccountId === destinationAccountId) {
          throw new Error("Dompet asal dan tujuan tidak boleh sama.");
        }
        if (isInternalTransfer && Number(exchangeRateValue) !== 1) {
          throw new Error("Rate transfer antar dompet harus bernilai 1.");
        }
        if (
          !isInternalTransfer &&
          (ratePair.size !== 2 ||
            !ratePair.has(fromCurrency) ||
            !ratePair.has(toCurrency))
        ) {
          throw new Error("Orientasi kurs tidak sesuai dengan pasangan mata uang.");
        }
        if (
          sourceAccount &&
          normalizeCurrencyCode(sourceAccount.currency) !== fromCurrency
        ) {
          throw new Error("Mata uang dompet asal tidak sesuai.");
        }
        if (
          destinationAccount &&
          normalizeCurrencyCode(destinationAccount.currency) !== toCurrency
        ) {
          throw new Error("Mata uang dompet tujuan tidak sesuai.");
        }
        if (!fromAmount || fromAmount <= 0) {
          throw new Error("Jumlah yang ditukar harus lebih besar dari 0.");
        }
        if (!toAmount || toAmount <= 0) {
          throw new Error("Jumlah diterima harus lebih besar dari 0.");
        }
        if (!rateValidation.valid || !rate || rate <= 0) {
          throw new Error(rateValidation.message || "Kurs exchange harus lebih besar dari 0.");
        }
        const availableFromBalance = Number(
          sourceAccount.balance_amount || sourceAccount.balanceAmount || 0,
        );
        const totalDebit = addExchangeDecimals(fromAmountValue, feeAmountValue);
        if (
          compareExchangeDecimals(
            totalDebit,
            String(availableFromBalance),
          ) > 0
        ) {
          throw new Error(`Saldo ${fromCurrency} tidak mencukupi.`);
        }
        record.from_currency = fromCurrency;
        record.to_currency = toCurrency;
        record.from_amount = fromAmount;
        record.to_amount = toAmount;
        record.rate = rate;
        record.locked_rate = rate;
        record.rate_base_currency = rateBaseCurrency;
        record.rate_quote_currency = rateQuoteCurrency;
        record.exchange_rate = exchangeRateValue;
        record.rate_type = isInternalTransfer ? "transfer" : rateType;
        record.fee_amount = feeAmount || null;
        record.fee_currency = feeAmount > 0 ? fromCurrency : null;
        record.category =
          feeAmount > 0 && payload.category
            ? normalizeBudgetCategory(payload.category)
            : null;
        record.category_group = record.category
          ? getDefaultGroupForCategory(record.category)
          : null;
        record.source_account_id = sourceAccountId;
        record.destination_account_id = destinationAccountId;
        record.base_amount =
          fromCurrency === getBaseCurrency()
            ? fromAmount
            : toCurrency === getBaseCurrency()
              ? toAmount
              : fromAmount *
                (getLatestRateForCurrencyUntil(
                  transactions,
                  fromCurrency,
                  new Date(payload.occurred_at),
                  getBaseCurrency(),
                ) || 0);
        record.amount_idr =
          fromCurrency === "IDR" ? fromAmount : toCurrency === "IDR" ? toAmount : null;
        record.amount_thb =
          fromCurrency === "THB" ? -fromAmount : toCurrency === "THB" ? toAmount : null;
      }

      if (payload.type === "expense") {
        const expenseCurrency = normalizeCurrencyCode(payload.expense_currency || payload.currency);
        const amount = readCurrencyAmount(
          payload.amount || payload.amount_idr || payload.amount_thb,
          expenseCurrency,
        );
        const sourceAccountId = payload.source_account_id || null;
        const targetId = payload.target_id || null;
        const selectedGoal = targetId
          ? metrics.goalInsights.find((goal) => goal.id === targetId)
          : null;

        if (!amount || amount <= 0) {
          throw new Error(`Jumlah pengeluaran ${expenseCurrency} harus lebih besar dari 0.`);
        }
        if (targetId && !selectedGoal) {
          throw new Error("Target yang dipilih tidak ditemukan.");
        }
        if (selectedGoal && selectedGoal.currency !== expenseCurrency) {
          throw new Error(
            `Target ${selectedGoal.name} hanya dapat digunakan untuk transaksi ${selectedGoal.currency}.`,
          );
        }
        if (
          selectedGoal &&
          amount > Number(selectedGoal.availableAmount || 0) + 0.0001
        ) {
          throw new Error(
            `Dana tersedia pada ${selectedGoal.name} tidak mencukupi.`,
          );
        }
        const rateInfo = resolveTransactionRateInfo({
          currency: expenseCurrency,
          baseCurrency: getBaseCurrency(),
          occurredAt: new Date(payload.occurred_at),
          transactions,
          globalRateSnapshot,
          explicitRate: Number(payload.exchange_rate || payload.rate || 0),
          preferCustom: payload.rate_type === "custom",
        });

        record.currency = expenseCurrency;
        record.amount = amount;
        applyTransactionRateToRecord(record, amount, rateInfo);
        record.amount_thb = expenseCurrency === "THB" ? amount : null;
        record.category = payload.category;
        record.category_group = getDefaultGroupForCategory(payload.category);
        record.source_account_id = sourceAccountId;
        record.target_id = targetId;
      }

      if (record.type === "expense") {
        const debitCheck = evaluateAccountDebit({
          allocationState: metrics.goalAllocationState,
          accountId: record.source_account_id,
          amount: record.amount,
          targetId: record.target_id,
        });
        if (!debitCheck.allowed) throw new Error(debitCheck.message);
      }
      if (record.type === "exchange") {
        const debitCheck = evaluateAccountDebit({
          allocationState: metrics.goalAllocationState,
          accountId: record.source_account_id,
          amount: Number(record.from_amount || 0) + Number(record.fee_amount || 0),
        });
        if (!debitCheck.allowed) {
          throw new Error(
            debitCheck.requiresDecision
              ? "Dana tersedia akun asal tidak cukup karena sebagian saldo dilindungi target. Lepaskan atau pindahkan alokasi lebih dulu."
              : debitCheck.message,
          );
        }
      }

      validateTransactionAccountLinks(record, assetAccounts);
      const accountBalancePlan = buildAssetAccountBalancePlan(
        assetAccounts,
        getTransactionAccountMovements(record),
      );
      let savedTransaction = normalizeTransaction(record);

      if (mode === "demo") {
        await persistDemoTransactions([...transactions, record]);
        await persistAssetAccountBalancePlan(accountBalancePlan);
        await persistDemoGoalActivities(
          syncGoalActivityForTransaction(goalActivities, savedTransaction),
        );
      } else {
        const { data, error } = await supabase.rpc("record_transaction_atomic", {
          p_transaction: record,
          p_reserved_action: record.target_id ? "use_goal" : null,
        });
        if (error) throw error;
        savedTransaction = normalizeTransaction(Array.isArray(data) ? data[0] : data);
        setAssetAccounts(applyAccountPrimaryPreferences(accountBalancePlan.nextAccounts));
        setTransactions((current) =>
          orderTransactions([...current, savedTransaction]),
        );
        setGoalActivities((current) =>
          syncGoalActivityForTransaction(current, savedTransaction),
        );
      }
      await markOneTimeGoalUsed(savedTransaction);

      const budgetWarning = buildBudgetOverspendWarning(
        savedTransaction,
        [...transactions, savedTransaction],
        budgets,
        getBaseCurrency(),
        globalRateSnapshot,
      );
      setMessage("Transaksi berhasil disimpan dan dashboard sudah diperbarui.");
      setMessageTone("success");
      setToast({
        message: budgetWarning?.message || "Transaksi berhasil disimpan.",
        tone: budgetWarning ? "warning" : "success",
      });
      return true;
    } catch (error) {
      setMessage(error.message || "Terjadi kesalahan saat menyimpan transaksi.");
      setMessageTone("error");
      return false;
    } finally {
      setLoading(false);
    }
  }

  /* Catat banyak menyimpan seluruh batch lewat jalur sendiri, bukan dengan
     memanggil handleCreateTransaction berkali kali. Fungsi itu membaca daftar
     transaksi dan saldo dari closure render, jadi panggilan kedua di dalam satu
     perulangan akan menimpa hasil panggilan pertama di Demo Lokal. Di sini
     semua record dibangun dari satu potret data, lalu disimpan sekali.

     Batch ini hanya membuat pemasukan dan pengeluaran. Tidak ada transfer,
     tukar mata uang, maupun pemakaian dana Target, sehingga seluruh cabang
     rumit di handleCreateTransaction memang tidak berlaku di sini. */
  async function handleCreateTransactionBatch(payloads = []) {
    const savedRowIds = [];
    const savedTransactions = [];

    try {
      setLoading(true);
      setMessage("");
      setToast(null);

      const baseCurrency = getBaseCurrency();
      const records = payloads.map((payload) => {
        const occurredAt = validateTransactionOccurredAt(payload.occurred_at);
        const currency = normalizeCurrencyCode(payload.currency);
        const amount = readCurrencyAmount(payload.amount, currency);
        const isExpense = payload.type === "expense";
        if (!amount || amount <= 0) {
          throw new Error(
            `Nominal "${payload.description}" harus lebih besar dari 0.`,
          );
        }

        const record = {
          id: crypto.randomUUID(),
          user_id: user.id,
          type: isExpense ? "expense" : "income",
          occurred_at: occurredAt.toISOString(),
          description: payload.description,
          category: isExpense ? payload.category : null,
          category_group: isExpense
            ? getDefaultGroupForCategory(payload.category)
            : null,
          amount_idr: !isExpense && currency === baseCurrency ? amount : null,
          amount_thb: currency === "THB" ? amount : null,
          locked_rate: null,
          currency,
          amount,
          base_currency: baseCurrency,
          base_amount: null,
          from_currency: null,
          to_currency: null,
          from_amount: null,
          to_amount: null,
          rate: null,
          rate_base_currency: null,
          rate_quote_currency: null,
          exchange_rate: null,
          rate_type: null,
          fee_amount: null,
          fee_currency: null,
          source_account_id: isExpense ? payload.source_account_id : null,
          destination_account_id: isExpense
            ? null
            : payload.destination_account_id,
          target_id: null,
          client_request_id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        /* Kurs tiap baris dicari dari data sebelum batch ini, jadi hasilnya
           tidak bergantung pada urutan penyimpanan. Tanpa kurs, barisnya tetap
           tersimpan tetapi belum dinilai, sama seperti transaksi satuan. */
        applyTransactionRateToRecord(
          record,
          amount,
          resolveTransactionRateInfo({
            currency,
            baseCurrency,
            occurredAt,
            transactions,
            globalRateSnapshot,
          }),
        );
        validateTransactionAccountLinks(record, assetAccounts);
        return { rowId: payload.rowId, record };
      });

      /* Saldo diperiksa sekali untuk seluruh batch per dompet. Server memeriksa
         baris demi baris, jadi tanpa hitungan kumulatif di sini batch bisa
         berhenti di tengah dengan sebagian sudah masuk. */
      const debitByAccount = new Map();
      records.forEach(({ record }) => {
        const accountId =
          record.source_account_id || record.destination_account_id;
        if (!accountId) return;
        const effect =
          record.type === "expense" ? Number(record.amount) : -Number(record.amount);
        debitByAccount.set(
          accountId,
          Number(debitByAccount.get(accountId) || 0) + effect,
        );
      });
      for (const [accountId, amount] of debitByAccount) {
        if (amount <= 0) continue;
        const debitCheck = evaluateAccountDebit({
          allocationState: metrics.goalAllocationState,
          accountId,
          amount,
        });
        if (!debitCheck.allowed) throw new Error(debitCheck.message);
      }

      let failure = null;

      if (mode === "demo") {
        const rows = records.map(({ record }) => record);
        const plan = buildAssetAccountBalancePlan(
          assetAccounts,
          rows.flatMap((record) => getTransactionAccountMovements(record)),
        );
        await persistDemoTransactions([...transactions, ...rows]);
        await persistAssetAccountBalancePlan(plan);
        records.forEach(({ rowId, record }) => {
          savedTransactions.push(normalizeTransaction(record));
          savedRowIds.push(rowId);
        });
      } else {
        for (const item of records) {
          try {
            const { data, error } = await supabase.rpc("record_transaction_atomic", {
              p_transaction: item.record,
              p_reserved_action: null,
            });
            if (error) throw error;
            savedTransactions.push(
              normalizeTransaction(Array.isArray(data) ? data[0] : data),
            );
            savedRowIds.push(item.rowId);
          } catch (error) {
            failure = error;
            break;
          }
        }
        if (savedTransactions.length) {
          const plan = buildAssetAccountBalancePlan(
            assetAccounts,
            savedTransactions.flatMap((record) =>
              getTransactionAccountMovements(record),
            ),
          );
          setAssetAccounts(applyAccountPrimaryPreferences(plan.nextAccounts));
          setTransactions((current) =>
            orderTransactions([...current, ...savedTransactions]),
          );
        }
      }

      if (failure) {
        /* Baris yang sudah masuk tidak ditarik kembali: masing masing sudah
           atomik di server. Yang tersisa tetap di daftar dan bisa dicoba lagi,
           dan karena client_request_id-nya sama, percobaan ulang tidak pernah
           menggandakan yang sudah tersimpan. */
        const message = savedTransactions.length
          ? `${savedTransactions.length} dari ${records.length} transaksi tersimpan. ${failure.message || ""}`.trim()
          : failure.message || "Transaksi gagal disimpan.";
        setMessage(message);
        setMessageTone("error");
        return { ok: false, savedRowIds, transactions: savedTransactions, message };
      }

      const nextTransactions = [...transactions, ...savedTransactions];
      const budgetWarning = savedTransactions.reduce(
        (found, record) =>
          found ||
          buildBudgetOverspendWarning(
            record,
            nextTransactions,
            budgets,
            baseCurrency,
            globalRateSnapshot,
          ),
        null,
      );
      const berhasil = `${savedTransactions.length} transaksi berhasil disimpan.`;
      setMessage(berhasil);
      setMessageTone("success");
      setToast({
        message: budgetWarning?.message || berhasil,
        tone: budgetWarning ? "warning" : "success",
      });
      return { ok: true, savedRowIds, transactions: savedTransactions, message: "" };
    } catch (error) {
      const message = error.message || "Terjadi kesalahan saat menyimpan transaksi.";
      setMessage(message);
      setMessageTone("error");
      return { ok: false, savedRowIds, transactions: savedTransactions, message };
    } finally {
      setLoading(false);
    }
  }

  /* Batalkan semua di layar Selesai. Hanya transaksi dari batch itu yang
     dihapus, dan saldonya dikembalikan dari gerakan transaksi itu sendiri,
     bukan dari daftar di layar yang mungkin belum ikut terbarui. */
  async function handleDeleteTransactionBatch(rows = []) {
    const targets = (rows || []).filter((row) => row?.id);
    if (!targets.length) return false;

    try {
      setLoading(true);
      setMessage("");
      setToast(null);

      const idSet = new Set(targets.map((row) => row.id));
      const plan = buildAssetAccountBalancePlan(
        assetAccounts,
        targets.flatMap((row) =>
          getTransactionAccountMovements(row, { reverse: true }),
        ),
        { skipMissing: true },
      );

      if (mode === "demo") {
        await persistDemoTransactions(
          transactions.filter((row) => !idSet.has(row.id)),
        );
        await persistAssetAccountBalancePlan(plan);
      } else {
        for (const row of targets) {
          const { error } = await supabase.rpc("delete_transaction_atomic", {
            p_transaction_id: row.id,
          });
          if (error) throw error;
        }
        setAssetAccounts(applyAccountPrimaryPreferences(plan.nextAccounts));
        setTransactions((current) => current.filter((row) => !idSet.has(row.id)));
      }

      setMessage(`${targets.length} transaksi dibatalkan.`);
      setMessageTone("info");
      setToast({ message: "Pencatatan dibatalkan." });
      return true;
    } catch (error) {
      setMessage(error.message || "Gagal membatalkan pencatatan.");
      setMessageTone("error");
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateTransaction(transaction, payload) {
    try {
      setLoading(true);
      setMessage("");
      setToast(null);

      const occurredAt = validateTransactionOccurredAt(payload.occurred_at);

      const nextType = getTransactionFlow(transaction);
      const description = String(payload.description || "").trim();
      /* Nominal dibaca dengan aturan angka mata uangnya sendiri, sama seperti
         saat dicatat, supaya "25.000" tidak pernah menyusut menjadi 25. */
      const entryCurrency =
        payload.expense_currency || payload.currency || transaction.currency;
      const movementFromOptions = getNumericInputOptions(
        payload.from_currency || transaction.from_currency,
      );
      const amount = readCurrencyAmount(payload.amount, entryCurrency);
      const amountIdr = readCurrencyAmount(payload.amount_idr, "IDR");
      const amountThb = readCurrencyAmount(payload.amount_thb, "THB");
      const fromAmountValue = normalizeNumericInput(
        payload.from_amount,
        movementFromOptions,
      );
      const fromAmount = Number(fromAmountValue);
      const lockedRate = Number(normalizeNumericInput(payload.locked_rate));
      const record = {
        type: nextType,
        occurred_at: occurredAt.toISOString(),
        description,
        category: null,
        category_group: null,
        amount_idr: null,
        amount_thb: null,
        locked_rate: null,
        currency: null,
        amount: null,
        base_currency: getBaseCurrency(),
        base_amount: null,
        from_currency: null,
        to_currency: null,
        from_amount: null,
        to_amount: null,
        rate: null,
        rate_base_currency: null,
        rate_quote_currency: null,
        exchange_rate: null,
        rate_type: null,
        fee_amount: null,
        fee_currency: null,
        source_account_id: null,
        destination_account_id: null,
        target_id: null,
        updated_at: new Date().toISOString(),
      };

      if (!description) {
        throw new Error("Deskripsi transaksi wajib diisi.");
      }

      if (nextType === "income") {
        const currency = normalizeCurrencyCode(payload.currency);
        const nextAmount = amount || amountIdr || amountThb;
        if (!nextAmount || nextAmount <= 0) {
          throw new Error(`Jumlah pemasukan ${currency} harus lebih besar dari 0.`);
        }
        record.currency = currency;
        record.amount = nextAmount;
        /* Pemasukan valas ikut menyimpan kursnya seperti pengeluaran. Tanpa
           itu nilainya kosong di analitik dan arus kas terbaca minus. */
        const rateInfo = resolveTransactionRateInfo({
          currency,
          baseCurrency: getBaseCurrency(),
          occurredAt,
          transactions: transactions.filter((item) => item.id !== transaction.id),
          globalRateSnapshot,
          explicitRate: Number(payload.exchange_rate || payload.rate || 0),
          lockedRate:
            normalizeCurrencyCode(transaction.currency) === currency
              ? Number(transaction.locked_rate || transaction.rate || 0)
              : 0,
          storedRateType: transaction.rate_type,
          preferCustom: payload.rate_type === "custom",
        });
        applyTransactionRateToRecord(record, nextAmount, rateInfo);
        record.amount_thb = currency === "THB" ? nextAmount : null;
        record.destination_account_id =
          payload.destination_account_id !== undefined
            ? payload.destination_account_id || null
            : transaction.destination_account_id || null;
      }

      if (nextType === "exchange") {
        const fromCurrency = normalizeCurrencyCode(payload.from_currency);
        const toCurrency = normalizeCurrencyCode(payload.to_currency, "THB");
        const isInternalTransfer = fromCurrency === toCurrency;
        const exchangeRateValue = serializeExchangeRate(
          payload.exchange_rate || payload.locked_rate,
        );
        const rateBaseCurrency = normalizeCurrencyCode(
          payload.rate_base_currency || fromCurrency,
        );
        const rateQuoteCurrency = normalizeCurrencyCode(
          payload.rate_quote_currency || toCurrency,
        );
        const rateType = isInternalTransfer
          ? "transfer"
          : ["realtime", "custom", "legacy"].includes(payload.rate_type)
            ? payload.rate_type
            : "legacy";
        const calculatedToAmountValue = isInternalTransfer
          ? fromAmountValue
          : calculateExchangeTargetAmount({
              sourceCurrency: fromCurrency,
              targetCurrency: toCurrency,
              sourceAmount: fromAmountValue,
              rateBaseCurrency,
              rateQuoteCurrency,
              exchangeRate: exchangeRateValue,
            });
        const toAmount = Number(calculatedToAmountValue);
        const directionalRateValue = getDirectionalExchangeRate({
          sourceCurrency: fromCurrency,
          targetCurrency: toCurrency,
          rateBaseCurrency,
          rateQuoteCurrency,
          exchangeRate: exchangeRateValue,
        });
        const rateValidation = validateExchangeRate(exchangeRateValue);
        const ratePair = new Set([rateBaseCurrency, rateQuoteCurrency]);
        if (
          isInternalTransfer &&
          (!(payload.source_account_id || transaction.source_account_id) ||
            !(payload.destination_account_id || transaction.destination_account_id) ||
            (payload.source_account_id || transaction.source_account_id) ===
              (payload.destination_account_id || transaction.destination_account_id))
        ) {
          throw new Error("Transfer membutuhkan dompet asal dan tujuan yang berbeda.");
        }
        if (!fromAmount || fromAmount <= 0) {
          throw new Error("Jumlah ditukar harus lebih besar dari 0.");
        }
        if (!toAmount || toAmount <= 0) {
          throw new Error("Jumlah diterima harus lebih besar dari 0.");
        }
        if (!rateValidation.valid || !directionalRateValue) {
          throw new Error(
            rateValidation.message || "Kurs exchange wajib diisi.",
          );
        }
        if (isInternalTransfer && Number(exchangeRateValue) !== 1) {
          throw new Error("Rate transfer antar dompet harus bernilai 1.");
        }
        if (
          !isInternalTransfer &&
          (ratePair.size !== 2 ||
            !ratePair.has(fromCurrency) ||
            !ratePair.has(toCurrency))
        ) {
          throw new Error("Orientasi kurs tidak sesuai dengan pasangan mata uang.");
        }

        record.from_currency = fromCurrency;
        record.to_currency = toCurrency;
        record.from_amount = fromAmount;
        record.to_amount = toAmount;
        record.rate = Number(directionalRateValue);
        record.locked_rate = Number(directionalRateValue);
        record.rate_base_currency = rateBaseCurrency;
        record.rate_quote_currency = rateQuoteCurrency;
        record.exchange_rate = exchangeRateValue;
        record.rate_type = rateType;
        record.fee_amount = transaction.fee_amount || null;
        record.fee_currency = transaction.fee_currency || null;
        record.category =
          Number(record.fee_amount || 0) > 0 && transaction.category
            ? normalizeBudgetCategory(transaction.category)
            : null;
        record.category_group = record.category
          ? getDefaultGroupForCategory(record.category)
          : null;
        record.source_account_id =
          payload.source_account_id !== undefined
            ? payload.source_account_id || null
            : transaction.source_account_id || null;
        record.destination_account_id =
          payload.destination_account_id !== undefined
            ? payload.destination_account_id || null
            : transaction.destination_account_id || null;
        record.base_amount =
          fromCurrency === getBaseCurrency()
            ? fromAmount
            : toCurrency === getBaseCurrency()
              ? toAmount
              : fromAmount *
                (getLatestRateForCurrencyUntil(
                  transactions.filter((item) => item.id !== transaction.id),
                  fromCurrency,
                  occurredAt,
                  getBaseCurrency(),
                ) || 0);
        record.amount_idr =
          fromCurrency === "IDR" ? fromAmount : toCurrency === "IDR" ? toAmount : null;
        record.amount_thb =
          fromCurrency === "THB" ? -fromAmount : toCurrency === "THB" ? toAmount : null;
      }

      if (nextType === "expense") {
        const expenseCurrency = normalizeCurrencyCode(payload.expense_currency || payload.currency);
        const nextAmount = amount || amountIdr || amountThb;
        const targetId =
          payload.target_id !== undefined
            ? payload.target_id || null
            : transaction.target_id || null;
        const allocationStateWithoutCurrentSpend = computeGoalAllocationState({
          goals,
          activities: goalActivities.filter(
            (activity) => activity.transaction_id !== transaction.id,
          ),
          accounts: assetAccounts,
        });
        const selectedGoal = targetId
          ? allocationStateWithoutCurrentSpend.goals.find(
              (goal) => goal.id === targetId,
            )
          : null;
        record.category = payload.category || DEFAULT_CATEGORY;
        record.category_group = getDefaultGroupForCategory(record.category);

        if (!nextAmount || nextAmount <= 0) {
          throw new Error(`Jumlah pengeluaran ${expenseCurrency} harus lebih besar dari 0.`);
        }
        if (targetId && !selectedGoal) {
          throw new Error("Target yang dipilih tidak ditemukan.");
        }
        if (selectedGoal && selectedGoal.currency !== expenseCurrency) {
          throw new Error(
            `Target ${selectedGoal.name} hanya dapat digunakan untuk transaksi ${selectedGoal.currency}.`,
          );
        }
        if (
          selectedGoal &&
          nextAmount > Number(selectedGoal.availableAmount || 0) + 0.0001
        ) {
          throw new Error(
            `Dana tersedia pada ${selectedGoal.name} tidak mencukupi.`,
          );
        }
        const rateInfo = resolveTransactionRateInfo({
          currency: expenseCurrency,
          baseCurrency: getBaseCurrency(),
          occurredAt,
          transactions: transactions.filter((item) => item.id !== transaction.id),
          globalRateSnapshot,
          lockedRate,
          storedRateType: transaction.rate_type,
        });

        record.currency = expenseCurrency;
        record.amount = nextAmount;
        applyTransactionRateToRecord(record, nextAmount, rateInfo);
        record.source_account_id =
          payload.source_account_id !== undefined
            ? payload.source_account_id || null
            : transaction.source_account_id || null;
        record.target_id = targetId;
      }

      const updatedTransactionForMovement = normalizeTransaction({
        ...transaction,
        ...record,
      });
      const updatedTransaction = normalizeTransaction({
        ...transaction,
        ...record,
      });
      const revertedBalancePlan = buildAssetAccountBalancePlan(
        assetAccounts,
        getTransactionAccountMovements(transaction, { reverse: true }),
        { skipMissing: true },
      );
      const allocationStateBeforeUpdate = computeGoalAllocationState({
        goals,
        activities: goalActivities.filter(
          (activity) => activity.transaction_id !== transaction.id,
        ),
        accounts: revertedBalancePlan.nextAccounts,
      });
      if (updatedTransaction.type === "expense") {
        const debitCheck = evaluateAccountDebit({
          allocationState: allocationStateBeforeUpdate,
          accountId: updatedTransaction.source_account_id,
          amount: updatedTransaction.amount,
          targetId: updatedTransaction.target_id,
        });
        if (!debitCheck.allowed) throw new Error(debitCheck.message);
      }
      if (updatedTransaction.type === "exchange") {
        const debitCheck = evaluateAccountDebit({
          allocationState: allocationStateBeforeUpdate,
          accountId: updatedTransaction.source_account_id,
          amount:
            Number(updatedTransaction.from_amount || 0) +
            Number(updatedTransaction.fee_amount || 0),
        });
        if (!debitCheck.allowed) throw new Error(debitCheck.message);
      }
      validateTransactionAccountLinks(updatedTransaction, assetAccounts);
      const accountBalancePlan = buildAssetAccountBalancePlan(
        assetAccounts,
        [
          ...getTransactionAccountMovements(transaction, { reverse: true }),
          ...getTransactionAccountMovements(updatedTransactionForMovement),
        ],
        { skipMissing: true },
      );

      if (mode === "demo") {
        const transactionId = transaction.id || createLegacyTransactionId(transaction);
        await persistDemoTransactions(
          transactions.map((item) =>
            item.id === transactionId ? { ...item, ...record } : item,
          ),
        );
        await persistAssetAccountBalancePlan(accountBalancePlan);
        await persistDemoGoalActivities(
          syncGoalActivityForTransaction(goalActivities, updatedTransaction),
        );
      } else {
        const { data, error } = await supabase.rpc("update_transaction_atomic", {
          p_transaction_id: transaction.id,
          p_transaction: {
            ...transaction,
            ...record,
            id: transaction.id,
            client_request_id:
              transaction.client_request_id || crypto.randomUUID(),
          },
          p_reserved_action: record.target_id ? "use_goal" : null,
        });
        if (error) throw error;
        setAssetAccounts(applyAccountPrimaryPreferences(accountBalancePlan.nextAccounts));
        const normalizedUpdated = normalizeTransaction(
          Array.isArray(data) ? data[0] : data,
        );
        setTransactions((current) =>
          orderTransactions(
            current.map((item) =>
              item.id === transaction.id ? normalizedUpdated : item,
            ),
          ),
        );
        setGoalActivities((current) =>
          syncGoalActivityForTransaction(current, normalizedUpdated),
        );
      }
      await markOneTimeGoalUsed(updatedTransaction);

      const nextTransactionsForBudget = transactions.map((item) =>
        item.id === transaction.id ? updatedTransaction : item,
      );
      const budgetWarning = buildBudgetOverspendWarning(
        updatedTransaction,
        nextTransactionsForBudget,
        budgets,
        getBaseCurrency(),
        globalRateSnapshot,
      );
      setMessage("Transaksi berhasil diperbarui.");
      setMessageTone("success");
      setToast({
        message: budgetWarning?.message || "Transaksi diperbarui",
        tone: budgetWarning ? "warning" : "success",
      });
      return true;
    } catch (error) {
      setMessage(error.message || "Gagal memperbarui transaksi.");
      setMessageTone("error");
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteTransaction(transaction) {
    try {
      setLoading(true);
      setMessage("");
      setToast(null);
      const transactionId = transaction.id || createLegacyTransactionId(transaction);
      const accountBalancePlan = buildAssetAccountBalancePlan(
        assetAccounts,
        getTransactionAccountMovements(transaction, { reverse: true }),
        { skipMissing: true },
      );

      if (mode === "demo") {
        await persistDemoTransactions(
          transactions.filter((item) => item.id !== transactionId),
        );
        await persistAssetAccountBalancePlan(accountBalancePlan);
        await persistDemoGoalActivities(
          goalActivities.filter(
            (activity) => activity.transaction_id !== transactionId,
          ),
        );
      } else {
        const { error } = await supabase.rpc("delete_transaction_atomic", {
          p_transaction_id: transactionId,
        });
        if (error) throw error;
        setAssetAccounts(applyAccountPrimaryPreferences(accountBalancePlan.nextAccounts));
        setTransactions((current) =>
          current.filter((item) => item.id !== transactionId),
        );
        setGoalActivities((current) =>
          current.filter(
            (activity) => activity.transaction_id !== transactionId,
          ),
        );
      }

      setMessage("Transaksi dihapus.");
      setMessageTone("info");
      setToast({ message: "Transaksi dihapus" });
      return true;
    } catch (error) {
      setMessage(error.message || "Gagal menghapus transaksi.");
      setMessageTone("error");
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveBudget(payload) {
    try {
      setLoading(true);
      setMessage("");

      const baseCurrency = getBaseCurrency();
      const inputCurrency = normalizeCurrencyCode(
        payload.input_currency || baseCurrency,
        baseCurrency,
      );
      const inputAmount = Number(
        payload.input_amount || payload.limit_amount || payload.limit_thb,
      );
      const planningRate =
        inputCurrency === baseCurrency
          ? 1
          : Number(payload.planning_rate || 0);
      const baseAmount = calculateBudgetBaseAmount({
        inputAmount,
        inputCurrency,
        baseCurrency,
        planningRate,
      });
      /* Jatah mode simpel memakai kategori penanda yang tidak boleh ikut
         dinormalkan, karena akan jatuh ke kategori "Lainnya". */
      const monthlyPlan = isMonthlyBudget(payload);
      const category = monthlyPlan
        ? MONTHLY_BUDGET_CATEGORY
        : normalizeBudgetCategory(payload.category, payload.group_key);
      const groupKey = monthlyPlan
        ? UNIVERSAL_BUDGET_GROUP
        : payload.group_key || getDefaultGroupForCategory(category);
      const categoryKey = monthlyPlan
        ? MONTHLY_BUDGET_CATEGORY
        : getBudgetCategoryKey(category, groupKey);
      if (!inputAmount || inputAmount <= 0) {
        throw new Error("Batas pengeluaran bulanan harus lebih besar dari 0.");
      }
      if (!baseAmount || baseAmount <= 0) {
        throw new Error(
          inputCurrency === baseCurrency
            ? "Batas pengeluaran bulanan tidak valid."
            : `Kurs ${inputCurrency} ke ${baseCurrency} belum valid.`,
        );
      }

      const matchingBudgets = budgets.filter(
        (item) =>
          item.month_key === payload.month_key &&
          getBudgetRowKey(item) === categoryKey,
      );
      if (
        matchingBudgets.length > 1 ||
        matchingBudgets.some((item) => Number(item.mergedBudgetCount || 1) > 1)
      ) {
        throw new Error(
          "Ada lebih dari satu anggaran untuk kategori dan bulan ini. Periksa data duplikat sebelum menyimpan.",
        );
      }
      const existing = matchingBudgets[0] || null;
      const rateSource =
        inputCurrency === baseCurrency
          ? "base"
          : payload.rate_source === "custom"
            ? "custom"
            : "automatic";
      const rateDate =
        payload.rate_date ||
        new Date().toISOString().slice(0, 10);

      const record = {
        id: existing?.id || crypto.randomUUID(),
        user_id: user.id,
        month_key: payload.month_key,
        group_key: groupKey,
        category,
        input_amount: inputAmount,
        input_currency: inputCurrency,
        base_amount: baseAmount,
        base_currency: baseCurrency,
        planning_rate: planningRate,
        rate_source: rateSource,
        rate_date: rateDate,
        rate_from_currency: inputCurrency,
        rate_to_currency: baseCurrency,
        currency: baseCurrency,
        limit_amount: baseAmount,
        limit_thb: baseCurrency === "THB" ? baseAmount : 0,
        created_at: existing?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (mode === "demo") {
        const next = [
          ...budgets.filter(
            (item) =>
              !(
                item.month_key === payload.month_key &&
                getBudgetRowKey(item) === categoryKey
              ),
          ),
          record,
        ];
        await persistDemoBudgets(next);
      } else {
        const query = existing?.id
          ? supabase
              .from("budgets")
              .update({
                month_key: record.month_key,
                group_key: record.group_key,
                category: record.category,
                input_amount: record.input_amount,
                input_currency: record.input_currency,
                base_amount: record.base_amount,
                base_currency: record.base_currency,
                planning_rate: record.planning_rate,
                rate_source: record.rate_source,
                rate_date: record.rate_date,
                rate_from_currency: record.rate_from_currency,
                rate_to_currency: record.rate_to_currency,
                currency: record.currency,
                limit_amount: record.limit_amount,
                limit_thb: record.limit_thb,
                updated_at: record.updated_at,
              })
              .eq("id", existing.id)
              .eq("user_id", user.id)
          : supabase.from("budgets").insert(record);
        const { data, error } = await query.select().single();
        if (error) {
          if (
            error.code === "PGRST204" ||
            /input_amount|base_amount|planning_rate|rate_source/i.test(
              String(error.message || ""),
            )
          ) {
            throw new Error(
              "Migrasi anggaran lintas mata uang belum dipasang pada database.",
            );
          }
          throw error;
        }

        setBudgets((current) => {
          const next = normalizeBudgets(
            [
              ...current.filter((item) => item.id !== data.id),
              data,
            ],
            getBaseCurrency(),
          );
          return next.sort((a, b) => String(a.month_key).localeCompare(String(b.month_key)));
        });
      }

      setMessage(
        monthlyPlan
          ? "Jatah bulan ini berhasil disimpan."
          : `Jatah ${getBudgetCategoryLabel(category, groupKey)} berhasil disimpan.`,
      );
      setMessageTone("success");
      return true;
    } catch (error) {
      setMessage(error.message || "Gagal menyimpan anggaran.");
      setMessageTone("error");
      return false;
    } finally {
      setLoading(false);
    }
  }

  /* Menyetel seluruh jatah satu bulan sekaligus: satu baris untuk mode simpel
     atau satu baris per kategori untuk mode rinci. Dipisahkan dari
     handleSaveBudget karena menyimpan baris satu per satu di dalam perulangan
     akan memakai daftar anggaran yang sudah basi dari render sebelumnya,
     sehingga baris pertama tertimpa baris berikutnya. */
  async function handleSaveBudgetPlan({
    mode: nextMode,
    monthKey,
    totalAmount = 0,
    rows = [],
  }) {
    try {
      setLoading(true);
      setMessage("");

      const baseCurrency = getBaseCurrency();
      const monthly = nextMode === "simple";
      const entries = monthly
        ? [
            {
              category: MONTHLY_BUDGET_CATEGORY,
              amount: Number(totalAmount || 0),
            },
          ]
        : rows.map((row) => ({
            category: normalizeBudgetCategory(row.category),
            amount: Number(row.amount || 0),
          }));
      if (entries.some((entry) => !(entry.amount > 0))) {
        throw new Error("Jatah bulanan harus lebih besar dari 0.");
      }

      const monthRows = budgets.filter(
        (item) =>
          item.month_key === monthKey &&
          normalizeCurrencyCode(item.base_currency || item.currency) ===
            baseCurrency,
      );
      const now = new Date().toISOString();
      const records = entries.map((entry) => {
        const isMonthlyEntry = entry.category === MONTHLY_BUDGET_CATEGORY;
        const groupKey = isMonthlyEntry
          ? UNIVERSAL_BUDGET_GROUP
          : getDefaultGroupForCategory(entry.category);
        const entryKey = isMonthlyEntry
          ? MONTHLY_BUDGET_CATEGORY
          : getBudgetCategoryKey(entry.category, groupKey);
        const existing = monthRows.find(
          (item) => getBudgetRowKey(item) === entryKey,
        );
        return {
          id: existing?.id || crypto.randomUUID(),
          user_id: user.id,
          month_key: monthKey,
          group_key: groupKey,
          category: entry.category,
          input_amount: entry.amount,
          input_currency: baseCurrency,
          base_amount: entry.amount,
          base_currency: baseCurrency,
          planning_rate: 1,
          rate_source: "base",
          rate_date: now.slice(0, 10),
          rate_from_currency: baseCurrency,
          rate_to_currency: baseCurrency,
          currency: baseCurrency,
          limit_amount: entry.amount,
          limit_thb: baseCurrency === "THB" ? entry.amount : 0,
          created_at: existing?.created_at || now,
          updated_at: now,
        };
      });

      /* Dua mode tidak boleh hidup berdampingan di satu bulan, jadi baris
         lama yang tidak terpakai lagi dihapus setelah yang baru tersimpan. */
      const keptIds = new Set(records.map((record) => record.id));
      const removedIds = [
        ...new Set(
          monthRows
            .flatMap((item) => [item.id, ...(item.sourceBudgetIds || [])])
            .filter((id) => Boolean(id) && !keptIds.has(id)),
        ),
      ];

      if (mode === "demo") {
        const dropped = new Set([...removedIds, ...keptIds]);
        await persistDemoBudgets([
          ...budgets.filter((item) => !dropped.has(item.id)),
          ...records,
        ]);
      } else {
        if (removedIds.length) {
          const { error } = await supabase
            .from("budgets")
            .delete()
            .eq("user_id", user.id)
            .in("id", removedIds);
          if (error) throw error;
        }
        let saved = [];
        if (records.length) {
          const { data, error } = await supabase
            .from("budgets")
            .upsert(records, { onConflict: "id" })
            .select();
          if (error) throw error;
          saved = data || records;
        }
        const dropped = new Set([...removedIds, ...keptIds]);
        setBudgets((current) =>
          normalizeBudgets(
            [...current.filter((item) => !dropped.has(item.id)), ...saved],
            baseCurrency,
          ).sort((a, b) =>
            String(a.month_key).localeCompare(String(b.month_key)),
          ),
        );
      }

      setMessage(
        !records.length
          ? "Jatah satu bulan penuh dilepas. Sekarang atur batas per kategori."
          : monthly
            ? "Jatah bulan ini berhasil disimpan."
            : "Jatah per kategori berhasil disimpan.",
      );
      setMessageTone("success");
      return true;
    } catch (error) {
      setMessage(error.message || "Gagal menyimpan jatah.");
      setMessageTone("error");
      return false;
    } finally {
      setLoading(false);
    }
  }

  function handleToggleReserveBills() {
    setReserveBills((current) => {
      const next = !current;
      writeAppStorage("budgetBillReserve", next);
      return next;
    });
  }

  async function handleDeleteBudget(budget) {
    const confirmation = window.confirm(
      `Hapus jatah ${budget.categoryLabel || getBudgetCategoryLabel(budget.category, budget.group_key)} untuk ${formatMonthKey(budget.month_key)}?`,
    );
    if (!confirmation) return;

    try {
      setLoading(true);
      setMessage("");

      if (mode === "demo") {
        const sourceIds = new Set([
          budget.id,
          ...(budget.sourceBudgetIds || []),
        ]);
        await persistDemoBudgets(
          budgets.filter((item) => !sourceIds.has(item.id)),
        );
      } else {
        const sourceIds = [
          ...new Set([
            budget.id,
            ...(budget.sourceBudgetIds || []),
          ]),
        ].filter(Boolean);
        const { error } = await supabase
          .from("budgets")
          .delete()
          .eq("user_id", user.id)
          .in("id", sourceIds);
        if (error) throw error;
        const deletedIds = new Set(sourceIds);
        setBudgets((current) =>
          current.filter((item) => !deletedIds.has(item.id)),
        );
      }

      setMessage("Jatah dihapus.");
      setMessageTone("info");
    } catch (error) {
      setMessage(error.message || "Gagal menghapus anggaran.");
      setMessageTone("error");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateAssetAccount(payload) {
    try {
      setLoading(true);
      setMessage("");

      const rawName = String(payload.name || "").trim();
      const balanceAmount = Number(payload.balance_amount || 0);
      const accountType = ASSET_ACCOUNT_TYPE_LOOKUP[payload.account_type]
        ? payload.account_type
        : "bank";
      const currency = normalizeCurrencyCode(payload.currency);
      const name = rawName || getDefaultAssetAccountName(accountType, currency);

      if (accountType !== "cash" && !rawName) {
        throw new Error("Nama bank atau akun wajib diisi.");
      }
      if (balanceAmount < 0) {
        throw new Error("Saldo akun tidak boleh negatif.");
      }

      const record = {
        id: crypto.randomUUID(),
        user_id: user.id,
        name,
        account_type: accountType,
        account_purpose:
          ["daily", "savings", "bills", "general", "investment"].includes(
            payload.account_purpose,
          )
            ? payload.account_purpose
            : accountType === "investment"
              ? "investment"
              : "general",
        currency,
        balance_amount: balanceAmount,
        is_allocatable:
          typeof payload.is_allocatable === "boolean"
            ? payload.is_allocatable
            : ["bank", "cash", "ewallet"].includes(accountType),
        note: String(payload.note || "").trim(),
        created_at: new Date().toISOString(),
        is_archived: false,
      };

      if (mode === "demo") {
        await persistDemoAssetAccounts([...assetAccounts, record]);
      } else {
        const { data, error } = await supabase
          .from("asset_accounts")
          .insert(record)
          .select()
          .single();
        if (error) throw error;
        setAssetAccounts((current) =>
          normalizeAssetAccounts([...current, normalizeAssetAccount(data)]),
        );
      }

      setMessage(`${name} ditambahkan ke Aset.`);
      setMessageTone("success");
      return true;
    } catch (error) {
      setMessage(error.message || "Gagal menyimpan akun aset.");
      setMessageTone("error");
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteAssetAccount(account) {
    const linkedTransactions = transactions.filter((transaction) =>
      transactionBelongsToAccount(transaction, account.id),
    );
    if (linkedTransactions.length) {
      const countLabel = `${linkedTransactions.length} transaksi`;
      setMessage(
        `${account.name} belum bisa dihapus karena masih dipakai oleh ${countLabel}. Hapus atau pindahkan transaksi tersebut terlebih dahulu.`,
      );
      setMessageTone("error");
      setToast({
        message: `Dompet masih dipakai oleh ${countLabel}.`,
        tone: "warning",
      });
      return;
    }
    const confirmation = window.confirm(`Hapus akun "${account.name}" dari daftar aset?`);
    if (!confirmation) return;

    try {
      setLoading(true);
      setMessage("");

      if (mode === "demo") {
        await persistDemoAssetAccounts(
          assetAccounts.filter((item) => item.id !== account.id),
        );
      } else {
        const { error } = await supabase
          .from("asset_accounts")
          .delete()
          .eq("id", account.id)
          .eq("user_id", user.id);
        if (error) throw error;
        setAssetAccounts((current) =>
          current.filter((item) => item.id !== account.id),
        );
      }

      setMessage("Akun aset dihapus.");
      setMessageTone("info");
    } catch (error) {
      setMessage(error.message || "Gagal menghapus akun aset.");
      setMessageTone("error");
    } finally {
      setLoading(false);
    }
  }

  async function handleSetPrimaryAccount(
    account,
    flowType = "expense",
    options = {},
  ) {
    const clearPrimary = options.clear === true;
    try {
      setLoading(true);
      const preference = {
        user_id: user.id,
        currency: normalizeCurrencyCode(account.currency),
        flow_type: flowType,
        account_id: account.id,
        updated_at: new Date().toISOString(),
      };
      if (mode === "demo") {
        const nextPreferences = [
          ...accountPreferences.filter(
            (item) =>
              !(
                item.currency === preference.currency &&
                item.flow_type === preference.flow_type
              ),
          ),
          ...(clearPrimary ? [] : [preference]),
        ];
        writeAppStorage("demoAccountPreferences", nextPreferences);
        setAccountPreferences(nextPreferences);
      } else if (clearPrimary) {
        const { error } = await supabase
          .from("account_preferences")
          .delete()
          .eq("user_id", user.id)
          .eq("currency", preference.currency)
          .eq("flow_type", preference.flow_type);
        if (error) throw error;
        setAccountPreferences((current) =>
          current.filter(
            (item) =>
              !(
                item.currency === preference.currency &&
                item.flow_type === preference.flow_type
              ),
          ),
        );
      } else {
        const { data, error } = await supabase.rpc("set_account_preference", {
          p_currency: preference.currency,
          p_flow_type: preference.flow_type,
          p_account_id: preference.account_id,
        });
        if (error) throw error;
        setAccountPreferences((current) => [
          ...current.filter(
            (item) =>
              !(
                item.currency === preference.currency &&
                item.flow_type === preference.flow_type
              ),
          ),
          data || preference,
        ]);
      }
      setAssetAccounts((current) =>
        normalizeAssetAccounts(
          current.map((item) => ({
            ...item,
            is_primary:
              item.currency === preference.currency
                ? !clearPrimary && item.id === preference.account_id
                : item.is_primary,
          })),
        ),
      );
      setMessage(
        clearPrimary
          ? `${account.name} tidak lagi menjadi akun utama ${preference.currency}.`
          : `${account.name} menjadi akun utama pengeluaran ${preference.currency}.`,
      );
      setMessageTone("success");
      setToast({
        message: clearPrimary ? "Akun utama dilepas." : "Akun utama diperbarui.",
        tone: "success",
      });
      return true;
    } catch (error) {
      setMessage(error.message || "Gagal memperbarui akun utama.");
      setMessageTone("error");
      return false;
    } finally {
      setLoading(false);
    }
  }

  function getCurrentGoalAllocationState(
    nextGoals = goals,
    nextActivities = goalActivities,
    nextAccounts = assetAccounts,
  ) {
    return computeGoalAllocationState({
      goals: nextGoals,
      activities: nextActivities,
      accounts: nextAccounts,
    });
  }

  async function persistGoalActivityRecord(record) {
    const normalized = normalizeGoalActivity(record);
    let saved = normalized;
    if (mode === "demo") {
      await persistDemoGoalActivities([...goalActivities, normalized]);
    } else {
      const { data, error } = await supabase.rpc("record_goal_activity_atomic", {
        p_goal_id: normalized.goal_id,
        p_account_id: normalized.account_id,
        p_type: normalized.type,
        p_amount: normalized.amount,
        p_note: normalized.note || "",
        p_client_request_id: normalized.client_request_id || crypto.randomUUID(),
      });
      if (error) throw error;
      saved = normalizeGoalActivity(data);
      setGoalActivities((current) =>
        normalizeGoalActivities([...current, saved]),
      );
    }

    if (saved.mapping_status === "mapped" && saved.account_id) {
      const funding = {
        goal_id: saved.goal_id,
        account_id: saved.account_id,
        user_id: user.id,
        currency: saved.currency,
        is_primary: false,
      };
      setGoalFundingAccounts((current) =>
        current.some(
          (item) =>
            item.goal_id === funding.goal_id &&
            item.account_id === funding.account_id,
        )
          ? current
          : [...current, funding],
      );
      setGoals((current) =>
        current.map((item) => {
          if (item.id !== saved.goal_id) return item;
          const existingFunding = item.fundingAccounts || [];
          const hasFunding = existingFunding.some(
            (itemFunding) => itemFunding.account_id === saved.account_id,
          );
          return normalizeGoal({
            ...item,
            funding_status: "funded",
            goal_funding_accounts: hasFunding
              ? existingFunding
              : [
                  ...existingFunding,
                  {
                    ...funding,
                    is_primary: existingFunding.length === 0,
                  },
                ],
          });
        }),
      );
    }
    return saved;
  }

  async function handleCreateGoal(payload) {
    try {
      setLoading(true);
      setMessage("");

      const name = String(payload.name || "").trim();
      const currency = normalizeCurrencyCode(
        payload.currency || getBaseCurrency(),
      );
      const targetAmount = Number(
        payload.target_amount ?? payload.target_amount_idr,
      );
      const initialAllocation = Number(
        payload.initial_allocation ?? payload.saved_amount_idr ?? 0,
      );
      const targetType =
        payload.target_type === "collect_by_date"
          ? "collect_by_date"
          : GOAL_TYPE_HOLD_BALANCE;
      const accountId = payload.account_id || null;
      const protectionMode = ["strict", "flexible", "informational"].includes(
        payload.protection_mode,
      )
        ? payload.protection_mode
        : "flexible";

      if (!name) throw new Error("Nama target wajib diisi.");
      if (!targetAmount || targetAmount <= 0) {
        throw new Error(`Nominal target ${currency} harus lebih besar dari 0.`);
      }
      if (initialAllocation < 0) {
        throw new Error("Alokasi awal tidak boleh negatif.");
      }

      const allocationState = getCurrentGoalAllocationState();
      const sourceAvailability = allocationState.accountAvailability?.[accountId];
      if (initialAllocation > 0 && !sourceAvailability) {
        throw new Error("Pilih akun sumber untuk alokasi awal.");
      }
      if (
        initialAllocation > Number(sourceAvailability?.availableBalance || 0) + 0.0001
      ) {
        throw new Error(
          `Alokasi awal melebihi dana tersedia pada akun sumber ${currency}.`,
        );
      }

      const now = new Date().toISOString();
      const record = normalizeGoal({
        id: crypto.randomUUID(),
        user_id: user.id,
        name,
        currency,
        target_amount: targetAmount,
        target_amount_idr: targetAmount,
        saved_amount_idr: 0,
        target_type: targetType,
        deadline: payload.deadline || null,
        note: String(payload.note || "").trim(),
        status: "active",
        protection_mode: protectionMode,
        funding_status: accountId ? "funded" : "plan_only",
        spending_reduces_progress: payload.spending_reduces_progress !== false,
        goal_funding_accounts: accountId
          ? [{
              goal_id: null,
              account_id: accountId,
              user_id: user.id,
              currency,
              is_primary: true,
            }]
          : [],
        created_at: now,
        updated_at: now,
      });
      let savedGoal = record;

      if (mode === "demo") {
        record.fundingAccounts = record.fundingAccounts.map((funding) => ({
          ...funding,
          goal_id: record.id,
        }));
        record.primaryFundingAccountId = accountId;
        await persistDemoGoals([...goals, record]);
        if (accountId) {
          const fundingRows = [
            ...goalFundingAccounts,
            ...record.fundingAccounts,
          ];
          writeAppStorage("demoGoalFundingAccounts", fundingRows);
          setGoalFundingAccounts(fundingRows);
        }
      } else {
        const requestId = crypto.randomUUID();
        const { data, error } = await supabase.rpc(
          "create_goal_with_funding_atomic",
          {
            p_goal: {
              id: record.id,
              name: record.name,
              currency: record.currency,
              target_amount: record.targetAmount,
              target_type: record.targetType,
              deadline: record.deadline,
              note: record.note,
              protection_mode: record.protectionMode,
              spending_reduces_progress: record.spendingReducesProgress,
              created_at: record.created_at,
            },
            p_account_id: accountId,
            p_initial_allocation: initialAllocation,
            p_client_request_id: requestId,
          },
        );
        if (error) throw error;
        const fundingRows = accountId
          ? [{
              goal_id: record.id,
              account_id: accountId,
              user_id: user.id,
              currency,
              is_primary: true,
            }]
          : [];
        savedGoal = normalizeGoal({
          ...(Array.isArray(data) ? data[0] : data),
          goal_funding_accounts: fundingRows,
        });
        setGoalFundingAccounts((current) => [...current, ...fundingRows]);
        setGoals((current) => [...current, savedGoal]);
      }

      if (initialAllocation > 0 && mode === "demo") {
        await persistGoalActivityRecord({
          id: crypto.randomUUID(),
          user_id: user.id,
          goal_id: savedGoal.id,
          type: "assign",
          amount: initialAllocation,
          currency,
          account_id: accountId,
          mapping_status: "mapped",
          note: "Alokasi awal",
          created_at: now,
        });
      }

      setMessage(
        initialAllocation > 0
          ? `Target dibuat dan ${formatCurrency(initialAllocation, currency)} dialokasikan tanpa mengubah saldo rekening.`
          : "Target finansial berhasil dibuat.",
      );
      setMessageTone("success");
      return true;
    } catch (error) {
      setMessage(error.message || "Gagal menyimpan target.");
      setMessageTone("error");
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteGoal(goal) {
    const confirmation = window.confirm(`Hapus target "${goal.name}"?`);
    if (!confirmation) return;

    try {
      setLoading(true);
      setMessage("");

      if (mode === "demo") {
        await persistDemoGoals(goals.filter((item) => item.id !== goal.id));
        await persistDemoGoalActivities(
          goalActivities.filter((item) => item.goal_id !== goal.id),
        );
      } else {
        const { error } = await supabase
          .from("goals")
          .delete()
          .eq("id", goal.id)
          .eq("user_id", user.id);
        if (error) throw error;
        setGoals((current) => current.filter((item) => item.id !== goal.id));
      }

      setMessage("Target dihapus.");
      setMessageTone("info");
    } catch (error) {
      setMessage(error.message || "Gagal menghapus target.");
      setMessageTone("error");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoalActivity(
    goal,
    rawAmount,
    type = "assign",
    note = "",
    requestedAccountId = null,
  ) {
    try {
      setLoading(true);
      setMessage("");

      const amount = Number(rawAmount);
      const normalizedGoal = normalizeGoal(goal);
      const accountId =
        requestedAccountId ||
        normalizedGoal.primaryFundingAccountId ||
        normalizedGoal.accountBreakdown?.[0]?.accountId ||
        null;
      const validation = validateGoalActivity({
        goal: normalizedGoal,
        type,
        amount,
        accountId,
        allocationState: getCurrentGoalAllocationState(),
      });
      if (!validation.valid) throw new Error(validation.message);

      await persistGoalActivityRecord({
        id: crypto.randomUUID(),
        user_id: user.id,
        goal_id: normalizedGoal.id,
        type,
        amount,
        currency: normalizedGoal.currency,
        account_id: accountId,
        mapping_status: "mapped",
        client_request_id: crypto.randomUUID(),
        note,
        created_at: new Date().toISOString(),
      });

      setMessage(
        type === "release"
          ? `${formatCurrency(amount, normalizedGoal.currency)} kembali menjadi dana belum dialokasikan.`
          : `${formatCurrency(amount, normalizedGoal.currency)} dialokasikan ke ${normalizedGoal.name} tanpa mengubah saldo rekening.`,
      );
      setMessageTone("success");
      return true;
    } catch (error) {
      setMessage(error.message || "Gagal memperbarui tabungan.");
      setMessageTone("error");
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function handleMoveGoalAllocation(
    sourceGoal,
    destinationGoal,
    rawAmount,
    requestedAccountId = null,
  ) {
    try {
      setLoading(true);
      setMessage("");
      const source = normalizeGoal(sourceGoal);
      const destination = normalizeGoal(destinationGoal);
      const amount = Number(rawAmount);
      const accountId =
        requestedAccountId ||
        source.primaryFundingAccountId ||
        source.accountBreakdown?.[0]?.accountId ||
        null;
      if (source.id === destination.id) {
        throw new Error("Pilih target tujuan yang berbeda.");
      }
      if (source.currency !== destination.currency) {
        throw new Error("Alokasi hanya dapat dipindahkan dalam mata uang yang sama.");
      }
      const state = getCurrentGoalAllocationState();
      const releaseValidation = validateGoalActivity({
        goal: source,
        type: "release",
        amount,
        accountId,
        allocationState: state,
      });
      if (!releaseValidation.valid) throw new Error(releaseValidation.message);

      const timestamp = new Date().toISOString();
      const records = [
        normalizeGoalActivity({
          id: crypto.randomUUID(),
          user_id: user.id,
          goal_id: source.id,
          type: "release",
          amount,
          currency: source.currency,
          account_id: accountId,
          mapping_status: "mapped",
          note: `Dipindahkan ke ${destination.name}`,
          created_at: timestamp,
        }),
        normalizeGoalActivity({
          id: crypto.randomUUID(),
          user_id: user.id,
          goal_id: destination.id,
          type: "assign",
          amount,
          currency: destination.currency,
          account_id: accountId,
          mapping_status: "mapped",
          note: `Dipindahkan dari ${source.name}`,
          created_at: timestamp,
        }),
      ];

      if (mode === "demo") {
        await persistDemoGoalActivities([...goalActivities, ...records]);
      } else {
        const { data, error } = await supabase.rpc(
          "move_goal_allocation_atomic",
          {
            p_source_goal_id: source.id,
            p_destination_goal_id: destination.id,
            p_account_id: accountId,
            p_amount: amount,
            p_client_request_id: crypto.randomUUID(),
          },
        );
        if (error) throw error;
        setGoalActivities((current) =>
          normalizeGoalActivities([...current, ...(data || [])]),
        );
      }

      setMessage(
        `${formatCurrency(amount, source.currency)} dipindahkan dari ${source.name} ke ${destination.name}.`,
      );
      setMessageTone("success");
      return true;
    } catch (error) {
      setMessage(error.message || "Gagal memindahkan alokasi.");
      setMessageTone("error");
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateGoal(goal, payload) {
    try {
      setLoading(true);
      setMessage("");
      const normalizedGoal = normalizeGoal(goal);
      const name = String(payload.name || normalizedGoal.name).trim();
      const targetAmount = Number(
        payload.target_amount ?? payload.target_amount_idr,
      );
      if (!name) throw new Error("Nama target wajib diisi.");
      if (!targetAmount || targetAmount <= 0) {
        throw new Error("Nominal target harus lebih besar dari 0.");
      }
      const update = {
        name,
        target_amount: targetAmount,
        target_amount_idr: targetAmount,
        target_type:
          payload.target_type === "collect_by_date"
            ? "collect_by_date"
            : GOAL_TYPE_HOLD_BALANCE,
        deadline: payload.deadline || null,
        note: String(payload.note || "").trim(),
        protection_mode:
          ["strict", "flexible", "informational"].includes(
            payload.protection_mode,
          )
            ? payload.protection_mode
            : normalizedGoal.protectionMode,
        spending_reduces_progress:
          payload.spending_reduces_progress ??
          normalizedGoal.spendingReducesProgress,
        updated_at: new Date().toISOString(),
      };
      if (mode === "demo") {
        await persistDemoGoals(
          goals.map((item) =>
            item.id === normalizedGoal.id ? { ...item, ...update } : item,
          ),
        );
      } else {
        const { data, error } = await supabase
          .from("goals")
          .update(update)
          .eq("id", normalizedGoal.id)
          .eq("user_id", user.id)
          .select()
          .single();
        if (error) throw error;
        setGoals((current) =>
          current.map((item) =>
            item.id === normalizedGoal.id ? normalizeGoal(data) : item,
          ),
        );
      }
      setMessage("Target diperbarui.");
      setMessageTone("success");
      return true;
    } catch (error) {
      setMessage(error.message || "Gagal memperbarui target.");
      setMessageTone("error");
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function handleArchiveGoal(goal) {
    try {
      setLoading(true);
      const normalizedGoal = normalizeGoal(goal);
      if (Number(goal.mappedAvailableAmount || 0) > 0.0001) {
        throw new Error(
          "Lepaskan atau pindahkan seluruh alokasi sebelum mengarsipkan target.",
        );
      }
      const update = {
        status: "archived",
        archived_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (mode === "demo") {
        await persistDemoGoals(
          goals.map((item) =>
            item.id === normalizedGoal.id ? { ...item, ...update } : item,
          ),
        );
      } else {
        const { data, error } = await supabase
          .from("goals")
          .update(update)
          .eq("id", normalizedGoal.id)
          .eq("user_id", user.id)
          .select()
          .single();
        if (error) throw error;
        setGoals((current) =>
          current.map((item) =>
            item.id === normalizedGoal.id ? normalizeGoal(data) : item,
          ),
        );
      }
      setMessage("Target diarsipkan.");
      setMessageTone("info");
      return true;
    } catch (error) {
      setMessage(error.message || "Gagal mengarsipkan target.");
      setMessageTone("error");
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function markOneTimeGoalUsed(transaction) {
    if (transaction?.type !== "expense" || !transaction?.target_id) return;
    const goal = metrics.goalInsights.find(
      (item) => item.id === transaction.target_id,
    );
    if (
      !goal ||
      goal.targetType !== "collect_by_date" ||
      Number(goal.availableAmount || 0) + 0.0001 < Number(goal.targetAmount || 0)
    ) {
      return;
    }
    const completedAt = goal.completed_at || new Date().toISOString();
    const update = {
      status: "used",
      completed_at: completedAt,
      updated_at: new Date().toISOString(),
    };
    if (mode === "demo") {
      await persistDemoGoals(
        goals.map((item) =>
          item.id === goal.id ? { ...item, ...update } : item,
        ),
      );
      return;
    }
    const { data, error } = await supabase
      .from("goals")
      .update(update)
      .eq("id", goal.id)
      .eq("user_id", user.id)
      .select()
      .single();
    if (error) throw error;
    setGoals((current) =>
      current.map((item) => (item.id === goal.id ? normalizeGoal(data) : item)),
    );
  }

  async function handleAddGoalProgress(
    goal,
    rawAmount,
    action = "deposit",
    accountId = null,
  ) {
    return handleGoalActivity(
      goal,
      rawAmount,
      action === "withdraw" ? "release" : "assign",
      "",
      accountId,
    );
  }

  async function persistUserSettings(nextSettings, overrides = {}) {
    if (mode !== "supabase" || !user || !supabaseReady) {
      return { synced: false, localOnly: true };
    }

    const normalized = normalizeCurrencySettings(nextSettings, { configured: true });
    const themeMode = normalizeThemeMode(
      overrides.themeMode || overrides.theme || profile?.theme_mode || theme,
    );
    const hideBalances =
      typeof overrides.hideBalances === "boolean"
        ? overrides.hideBalances
        : typeof overrides.balanceVisible === "boolean"
          ? !overrides.balanceVisible
          : profile?.hide_balances ?? !balanceVisible;
    const nextProfile = normalizeProfile({
      ...(profile || {}),
      base_currency: normalized.baseCurrency,
      daily_currency: normalized.dailyCurrency,
      theme_mode: themeMode,
      hide_balances: hideBalances,
    }, user, {
      ...normalized,
      theme_mode: themeMode,
      hideBalances,
    });
    const profileRecord = {
      id: user.id,
      email: nextProfile.email || user.email || "",
      display_name: nextProfile.display_name,
      avatar_url: nextProfile.avatar_url,
      base_currency: normalized.baseCurrency,
      daily_currency: normalized.dailyCurrency,
      theme_mode: themeMode,
      hide_balances: hideBalances,
      country_code: nextProfile.country_code || null,
      updated_at: new Date().toISOString(),
    };
    const legacyRecord = {
      user_id: user.id,
      base_currency: normalized.baseCurrency,
      active_currencies: normalized.activeCurrencies,
      daily_currency: normalized.dailyCurrency,
      theme: themeMode === "system" ? resolveThemeMode(themeMode, systemPrefersDark) : themeMode,
      balance_visible: !hideBalances,
      updated_at: new Date().toISOString(),
    };

    const existingCurrencyResult = await supabase
      .from("user_currencies")
      .select("currency_code")
      .eq("user_id", user.id);
    if (!existingCurrencyResult.error) {
      const currencyRows = buildUserCurrencyRecords(
        user.id,
        normalized,
        (existingCurrencyResult.data || []).map((row) => row.currency_code),
      );
      const [profileUpsert, currenciesUpsert] = await Promise.all([
        supabase.from("profiles").upsert(profileRecord, { onConflict: "id" }),
        supabase
          .from("user_currencies")
          .upsert(currencyRows, { onConflict: "user_id,currency_code" }),
      ]);
      if (!profileUpsert.error && !currenciesUpsert.error) {
        setProfile(nextProfile);
        return { synced: true, modern: true };
      }
      if (
        profileUpsert.error?.code !== "42P01" &&
        currenciesUpsert.error?.code !== "42P01"
      ) {
        throw profileUpsert.error || currenciesUpsert.error;
      }
    }

    const { error } = await supabase
      .from("user_settings")
      .upsert(legacyRecord, { onConflict: "user_id" });
    if (isMissingDailyCurrencyColumn(error)) {
      const fallbackRecord = { ...legacyRecord };
      delete fallbackRecord.daily_currency;
      const { error: fallbackError } = await supabase
        .from("user_settings")
        .upsert(fallbackRecord, { onConflict: "user_id" });
      if (fallbackError) throw fallbackError;
      return { synced: true, dailyCurrencyLocalOnly: true };
    }
    if (error) throw error;
    setProfile(nextProfile);
    return { synced: true, modern: false };
  }

  useEffect(() => {
    if (
      !pendingNativeAction ||
      !user ||
      hydratedUserId !== user.id ||
      !currencySettings
    ) {
      return;
    }

    const availableAccounts = normalizeAssetAccounts(assetAccounts).filter(
      isSpendableAssetAccount,
    );
    const moveToWalletSetup = (messageText) => {
      setPendingNativeAction(null);
      setToast({ message: messageText, tone: "warning" });
      setAssetFormRequest((current) => current + 1);
      setActiveTab("investment");
      setMenuOpen(false);
      setQuickActionOpen(false);
      setQuickEntryOpen(false);
    };

    if (pendingNativeAction.kind === "quick-entry") {
      if (!availableAccounts.length) {
        moveToWalletSetup(
          "Tambahkan dompet terlebih dahulu sebelum mencatat transaksi.",
        );
        return;
      }

      const preferredAccountId = accountPreferences.find(
        (preference) =>
          preference.flow_type === pendingNativeAction.entryType &&
          availableAccounts.some(
            (account) => account.id === preference.account_id,
          ),
      )?.account_id;
      const dailyCurrency = normalizeCurrencyCode(
        currencySettings.dailyCurrency || currencySettings.baseCurrency,
      );
      const initialAccount =
        availableAccounts.find((account) => account.id === preferredAccountId) ||
        availableAccounts.find(
          (account) =>
            account.is_primary &&
            normalizeCurrencyCode(account.currency) === dailyCurrency,
        ) ||
        availableAccounts.find(
          (account) => normalizeCurrencyCode(account.currency) === dailyCurrency,
        ) ||
        availableAccounts.find((account) => account.is_primary) ||
        availableAccounts[0];

      setPendingNativeAction(null);
      setTransactionEntryType(pendingNativeAction.entryType);
      setQuickEntryInitialAccountId(initialAccount?.id || "");
      /* Widget tidak pernah membawa nominal. Tanpa penyetelan ulang ini,
         nominal selisih dari Cocokkan Saldo akan tertinggal di keypad. */
      setQuickEntryInitialAmount(0);
      setQuickEntryRequestKey((current) => current + 1);
      setTransactionFabHintDismissed(true);
      writeAppStorage("transactionFabHintDismissed", true);
      setQuickEntryOpen(true);
      setMenuOpen(false);
      setQuickActionOpen(false);
      return;
    }

    if (pendingNativeAction.kind === "movement") {
      const canOpenMovement = availableAccounts.some((account, index) =>
        availableAccounts.slice(index + 1).some((candidate) =>
          pendingNativeAction.movementType === "transfer"
            ? normalizeCurrencyCode(candidate.currency) ===
              normalizeCurrencyCode(account.currency)
            : normalizeCurrencyCode(candidate.currency) !==
              normalizeCurrencyCode(account.currency),
        ),
      );
      if (!canOpenMovement) {
        moveToWalletSetup(
          pendingNativeAction.movementType === "transfer"
            ? "Transfer membutuhkan dua dompet dengan mata uang yang sama."
            : "Tukar valas membutuhkan dua dompet dengan mata uang berbeda.",
        );
        return;
      }

      setPendingNativeAction(null);
      setMovementInitialMode(pendingNativeAction.movementType);
      setTransactionEntryType("exchange");
      setTransactionFabHintDismissed(true);
      writeAppStorage("transactionFabHintDismissed", true);
      setActiveTab("movement");
      setMenuOpen(false);
      setQuickActionOpen(false);
      setQuickEntryOpen(false);
    }
  }, [
    pendingNativeAction,
    user,
    hydratedUserId,
    currencySettings,
    assetAccounts,
    accountPreferences,
  ]);

  useEffect(() => {
    if (!isNativeWidgetAvailable()) return;

    const dayKey = getLocalDayKey(new Date());
    if (!user) {
      if (mode === "loading") return;
      updateNativeWidgetSnapshot({
        dayKey,
        updatedAt: Date.now(),
        primaryWalletName: "",
        todayCount: 0,
        todayExpenseFormatted: "",
        hideAmounts: true,
        isSignedIn: false,
      }).catch(() => {});
      return;
    }
    if (hydratedUserId !== user.id || !currencySettings) return;

    const availableAccounts = normalizeAssetAccounts(assetAccounts).filter(
      isSpendableAssetAccount,
    );
    const dailyCurrency = normalizeCurrencyCode(
      currencySettings.dailyCurrency || currencySettings.baseCurrency,
    );
    const primaryAccount =
      availableAccounts.find(
        (account) =>
          account.is_primary &&
          normalizeCurrencyCode(account.currency) === dailyCurrency,
      ) ||
      availableAccounts.find(
        (account) => normalizeCurrencyCode(account.currency) === dailyCurrency,
      ) ||
      availableAccounts.find((account) => account.is_primary) ||
      availableAccounts[0];
    const todayTransactions = transactions.filter(
      (transaction) => getLocalDayKey(transaction.occurred_at) === dayKey,
    );
    const todayExpenses = todayTransactions.filter(
      (transaction) => getTransactionFlow(transaction) === "expense",
    );
    const expenseValuations = todayExpenses.map((transaction) => ({
      amount: getTransactionAmountValue(transaction),
      baseValue: Math.max(
        Number(resolveTransactionBaseValue(transaction)) || 0,
        0,
      ),
    }));
    const hasIncompleteValuation = expenseValuations.some(
      ({ amount, baseValue }) => amount > 0 && baseValue <= 0,
    );
    const todayExpense = expenseValuations.reduce(
      (total, item) => total + item.baseValue,
      0,
    );
    const baseCurrency = normalizeCurrencyCode(
      currencySettings.baseCurrency || DEFAULT_BASE_CURRENCY,
    );

    updateNativeWidgetSnapshot({
      dayKey,
      updatedAt: Date.now(),
      primaryWalletName: primaryAccount?.name || "Belum ada dompet",
      /* Catat kilat menulis transaksi tanpa membuka WebView, jadi ia perlu
         tahu dompet mana dan mata uang apa. Pengenal dompet milik pengguna
         sendiri, tersimpan di penyimpanan privat aplikasi; token dan transaksi
         mentah tetap tidak pernah ikut. */
      primaryWalletId: primaryAccount?.id || "",
      primaryWalletCurrency: primaryAccount
        ? normalizeCurrencyCode(primaryAccount.currency)
        : "",
      baseCurrency,
      todayCount: todayTransactions.length,
      todayExpenseFormatted: hasIncompleteValuation
        ? "Lihat di aplikasi"
        : formatCurrency(todayExpense, baseCurrency),
      hideAmounts: !balanceVisible,
      isSignedIn: true,
    }).catch(() => {});
  }, [
    mode,
    user,
    hydratedUserId,
    currencySettings,
    assetAccounts,
    transactions,
    balanceVisible,
  ]);

  function handleThemeChange(value) {
    const nextTheme = normalizeThemeMode(value);
    setTheme(nextTheme);
    setProfile((current) => {
      const nextProfile = normalizeProfile({
        ...(current || {}),
        theme_mode: nextTheme,
      }, user, {
        ...(currencySettings || normalizeCurrencySettings(null)),
        theme_mode: nextTheme,
        hideBalances: !balanceVisible,
      });
      if (mode === "demo") writeLocalProfile(user, nextProfile);
      return nextProfile;
    });
    persistUserSettings(currencySettings || normalizeCurrencySettings(null), {
      themeMode: nextTheme,
    }).catch(() => {});
  }

  if (mode === "loading" || (user && currencySettings === null)) {
    return html`<${AppLoadingScreen} appName=${APP_NAME} />`;
  }

  if (mode === "session-error") {
    return html`
      <${AuthRecoveryScreen}
        appName=${APP_NAME}
        error=${authRecoveryError}
        onRetry=${() => {
          setMode("loading");
          setAuthRecoveryError("");
          setAuthRecoveryAttempt((current) => current + 1);
        }}
      />
    `;
  }

  if (!user) {
    return html`
      <${AuthScreen}
        onGoogleLogin=${handleGoogleLogin}
        onDemoLogin=${handleDemoLogin}
        supabaseReady=${supabaseReady}
        appName=${APP_NAME}
      />
    `;
  }

  const dashboardCurrencySettings = normalizeCurrencySettings({
    activeCurrencies: metrics.activeCurrencies || activeCurrencies,
    baseCurrency: currencySettings?.baseCurrency,
    dailyCurrency: currencySettings?.dailyCurrency,
  });
  const dashboardActiveCurrencies = dashboardCurrencySettings.activeCurrencies;
  const spendableAssetAccounts = normalizeAssetAccounts(assetAccounts).filter(
    (account) => isSpendableAssetAccount(account),
  );
  const spendableCurrencySet = new Set(
    spendableAssetAccounts.map((account) => normalizeCurrencyCode(account.currency)),
  );
  const focusedWalletCurrency =
    selectedWalletCurrency &&
    spendableCurrencySet.has(normalizeCurrencyCode(selectedWalletCurrency))
      ? normalizeCurrencyCode(selectedWalletCurrency)
      : null;
  const configuredDailyCurrency = dashboardCurrencySettings.dailyCurrency;
  const dailyExpenseCurrency =
    focusedWalletCurrency ||
    (spendableCurrencySet.has(configuredDailyCurrency)
      ? configuredDailyCurrency
      : spendableAssetAccounts[0]?.currency || configuredDailyCurrency);
  const hasTransferPair = spendableAssetAccounts.some((account, index) =>
    spendableAssetAccounts.slice(index + 1).some(
      (candidate) => candidate.currency === account.currency,
    ),
  );
  const hasExchangePair = spendableAssetAccounts.some((account, index) =>
    spendableAssetAccounts.slice(index + 1).some(
      (candidate) => candidate.currency !== account.currency,
    ),
  );
  const walletBaseCurrency = dashboardCurrencySettings.baseCurrency;
  const incomeEstimate = resolveIncomeEstimate(
    profile,
    globalRateSnapshot,
    walletBaseCurrency,
  );
  const controlSummary = buildBudgetControlSummary({
    metrics,
    transactions,
    baseCurrency: walletBaseCurrency,
    incomeEstimate,
  });
  const activeBudgetInsight =
    metrics.budgetInsights.find((item) => item.currency === dailyExpenseCurrency) || null;
  const todayKey = getLocalDayKey(new Date());
  const todayExpenses = orderTransactions(transactions)
    .filter(
      (item) =>
        item.type === "expense" &&
        getTransactionCurrency(item) === dailyExpenseCurrency &&
        getLocalDayKey(item.occurred_at) === todayKey,
    )
    .reverse();
  const todaySpentCurrency = todayExpenses.reduce(
    (sum, item) => sum + getTransactionAmountValue(item),
    0,
  );
  const todaySpentIdr = todayExpenses.reduce(
    (sum, item) => sum + resolveTransactionBaseValue(item),
    0,
  );
  const nextDayBudgetText = !activeBudgetInsight
    ? ""
    : activeBudgetInsight.remainingDaysAfterToday > 0
      ? `Jatah besok ${formatCurrency(activeBudgetInsight.projectedNextDailyLimit, dailyExpenseCurrency)}.`
      : "Hari terakhir bulan ini.";
  const overspendingValue = !activeBudgetInsight
    ? "Belum ada"
    : activeBudgetInsight.remainingAmount < 0
      ? "Lewat bulanan"
      : activeBudgetInsight.todayRemainingSafe < 0
        ? "Lewat harian"
        : activeBudgetInsight.status === "warning"
          ? "Waspada"
          : "Aman";
  const overspendingHelper = !activeBudgetInsight
    ? "Buat anggaran bulanan agar proteksi anggaran aktif."
    : activeBudgetInsight.todayRemainingSafe < 0
      ? `Hari ini lewat ${formatCurrency(Math.abs(activeBudgetInsight.todayRemainingSafe), dailyExpenseCurrency)} dari batas aman. ${nextDayBudgetText}`
      : `Batas aman hari ini ${formatCurrency(activeBudgetInsight.dynamicDailyLimit, dailyExpenseCurrency)}. ${nextDayBudgetText}`;
  const userDisplayName = getProfileDisplayName(profile, user);
  /* Sapaan header memakai sumber yang sama dengan kartu profil dan Pengaturan,
     yaitu getProfileDisplayName yang membaca profile.display_name. Sebelumnya
     header membaca profile.full_name, field yang tidak pernah ada pada objek
     profil, sehingga selalu jatuh ke user.user_metadata.full_name. Metadata itu
     berasal dari sesi auth saat login dan tidak ikut diperbarui setelah nama
     diganti, jadi sapaan tetap memakai nama lama sampai pengguna login ulang. */
  const greetingName = userDisplayName.trim().split(/\s+/)[0] || "";
  const userInitials = getUserInitials({
    ...user,
    user_metadata: { full_name: userDisplayName },
  });
  const userStorageId = getUserStorageId(user);
  const profilePhoto =
    profile?.avatar_url ||
    profilePhotos[userStorageId] ||
    user?.user_metadata?.avatar_url ||
    "";
  const resolvedTheme = resolveThemeMode(theme, systemPrefersDark);
  const isDark = resolvedTheme === "dark";
  const menuActiveTab = activeTab === "control" ? "overview" : activeTab;
  const menuTabStyle = (tab) =>
    tab === menuActiveTab
      ? { background: "var(--cs-sel-bg)", color: "var(--cs-sel-fg)" }
      : { background: "var(--cs-card)", color: "var(--cs-body)" };
  const menuPanelClass =
    "cuan-menu fixed right-3 top-20 z-30 max-h-[calc(100svh-6rem)] w-[min(18rem,calc(100vw-1.5rem))] overflow-y-auto rounded-[24px] p-3 md:right-4 md:top-24 md:w-[min(20rem,calc(100vw-2rem))] md:rounded-[28px] md:p-4";
  const menuProfileCardClass =
    "cuan-menu-card flex items-center gap-3 rounded-2xl p-3";
  /* Beranda, Dompet, Anggaran, dan Riwayat sudah punya tempat tetap di
     navigasi bawah, jadi mengulangnya di menu profil hanya menggandakan jalan
     yang sama. Yang tersisa di sini hanya tujuan yang tidak ada di bawah. */
  const navigationTabs = [{ key: "settings", label: "Pengaturan" }];
  const historyTransactions = [...orderTransactions(transactions)].reverse();
  const walletBalances = {
    ...metrics.currencyBalances,
    [DEFAULT_BASE_CURRENCY]: metrics.balanceIdr,
  };
  const walletValuationsByCurrency = Object.fromEntries(
    dashboardActiveCurrencies.map((currency) => {
      const balance = Number(walletBalances[currency] || 0);
      const rateInfo = getCurrentValuationRateForCurrency(
        globalRateSnapshot,
        currency,
        walletBaseCurrency,
      );
      const rate = Number(rateInfo.rate || 0);
      return [
        currency,
        currency === walletBaseCurrency ? balance : rate > 0 ? balance * rate : 0,
      ];
    }),
  );
  const walletTotalValueBase = dashboardActiveCurrencies.reduce(
    (sum, currency) => sum + Number(walletValuationsByCurrency[currency] || 0),
    0,
  );

  async function handleSaveProfile(nextProfileFields) {
    const nextProfile = normalizeProfile(
      {
        ...(profile || {}),
        ...nextProfileFields,
        email: profile?.email || user?.email || "",
      },
      user,
      {
        ...(currencySettings || normalizeCurrencySettings(null)),
        theme_mode: theme,
        hideBalances: !balanceVisible,
      },
    );

    setProfile(nextProfile);
    setProfilePhotos((current) => {
      const next = { ...current };
      if (nextProfile.avatar_url) {
        next[userStorageId] = nextProfile.avatar_url;
      } else {
        delete next[userStorageId];
      }
      writeAppStorage("profilePhotos", next);
      return next;
    });

    if (mode === "demo") {
      writeLocalProfile(user, nextProfile);
      setMessage("Profil diperbarui.");
      setMessageTone("success");
      return true;
    }

    try {
      const { error } = await supabase.from("profiles").upsert(
        {
          id: user.id,
          email: nextProfile.email || user.email || "",
          display_name: nextProfile.display_name,
          avatar_url: nextProfile.avatar_url,
          base_currency: currencySettings?.baseCurrency || getBaseCurrency(),
          daily_currency:
            currencySettings?.dailyCurrency ||
            currencySettings?.activeCurrencies?.[0] ||
            getBaseCurrency(),
          theme_mode: nextProfile.theme_mode,
          hide_balances: nextProfile.hide_balances,
          country_code: nextProfile.country_code || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );
      if (error) throw error;
      supabase.auth
        .updateUser({
          data: {
            full_name: nextProfile.display_name,
            avatar_url: nextProfile.avatar_url,
          },
        })
        .catch(() => {});
      setMessage("Profil diperbarui.");
      setMessageTone("success");
      return true;
    } catch (error) {
      setMessage(
        error?.code === "42P01"
          ? "Profil tersimpan lokal. Jalankan schema.sql terbaru agar sinkron lintas perangkat."
          : error.message || "Gagal memperbarui profil.",
      );
      setMessageTone(error?.code === "42P01" ? "info" : "error");
      return error?.code === "42P01";
    }
  }

  /* Perkiraan pemasukan bulanan untuk Kondisi keuanganmu. Ini bukan
     transaksi, jadi saldo tidak berubah. Kalau kolomnya belum ada karena
     migration belum terpasang, perkiraan tetap berlaku di perangkat ini dan
     dikirim ke profil setelah kolomnya tersedia. */
  async function handleSaveIncomeEstimate(nextEstimate) {
    const fields = normalizeIncomeEstimateFields(
      {
        monthly_income_estimate: nextEstimate?.amount ?? null,
        monthly_income_estimate_currency: nextEstimate?.currency ?? null,
      },
      {},
      walletBaseCurrency,
    );
    const savedText =
      fields.monthly_income_estimate == null
        ? "Perkiraan pemasukan dihapus."
        : "Perkiraan pemasukan disimpan.";
    const previousProfile = profile;
    const nextProfile = normalizeProfile(
      { ...(profile || {}), ...fields },
      user,
      {
        ...(currencySettings || normalizeCurrencySettings(null)),
        theme_mode: theme,
        hideBalances: !balanceVisible,
      },
    );
    setProfile(nextProfile);

    if (mode === "demo") {
      writeLocalProfile(user, nextProfile);
      setMessage(savedText);
      setMessageTone("success");
      return true;
    }

    let error = null;
    try {
      ({ error } = await upsertIncomeEstimate(user, fields));
    } catch (caught) {
      error = caught;
    }
    if (!error) {
      writeLocalIncomeEstimate(user, null);
      setMessage(savedText);
      setMessageTone("success");
      return true;
    }
    if (isMissingIncomeEstimateColumn(error)) {
      writeLocalIncomeEstimate(user, fields);
      setMessage(
        "Perkiraan tersimpan di perangkat ini. Pasang migration terbaru supaya ikut tersinkron.",
      );
      setMessageTone("info");
      return true;
    }
    setProfile(previousProfile);
    setMessage(error?.message || "Perkiraan pemasukan gagal disimpan.");
    setMessageTone("error");
    return false;
  }

  /* Ekspor bulanan mengambil ulang transaksi pada rentang yang dipilih. Array
     utama aplikasi bisa terkena batas baris respons Supabase setelah akun
     dipakai lama; query per bulan dan pagination menjaga PDF tetap lengkap
     tanpa membuat waktu buka aplikasi makin berat. */
  async function loadStatementTransactions(monthKey) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(monthKey || ""))) {
      throw new Error("Bulan laporan tidak valid.");
    }

    const localRows = orderTransactions(transactions).filter(
      (transaction) =>
        transaction?.occurred_at &&
        getMonthKey(transaction.occurred_at) === monthKey,
    );
    if (mode === "demo" || !supabaseReady || !user?.id) return localRows;

    const { year, month } = getMonthParts(monthKey);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    const pageSize = 1000;
    const rows = [];

    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .gte("occurred_at", start.toISOString())
        .lt("occurred_at", end.toISOString())
        .order("occurred_at", { ascending: true })
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      const page = data || [];
      rows.push(...page);
      if (page.length < pageSize) break;
    }

    return orderTransactions(normalizeTransactions(rows));
  }

  function applyBalanceVisibility(nextVisible) {
    writeBalanceVisiblePreference(nextVisible);
    const nextHideBalances = !nextVisible;
    setProfile((current) => {
      const nextProfile = normalizeProfile({
        ...(current || {}),
        hide_balances: nextHideBalances,
      }, user, {
        ...(currencySettings || normalizeCurrencySettings(null)),
        theme_mode: theme,
        hideBalances: nextHideBalances,
      });
      if (mode === "demo") writeLocalProfile(user, nextProfile);
      return nextProfile;
    });
    persistUserSettings(currencySettings || normalizeCurrencySettings(null), {
      hideBalances: nextHideBalances,
      balanceVisible: nextVisible,
    }).catch(() => {});
  }

  function handleSetHideBalances(hideBalances) {
    const nextVisible = !hideBalances;
    setBalanceVisible(nextVisible);
    applyBalanceVisibility(nextVisible);
  }

  function handleToggleBalanceVisibility() {
    setBalanceVisible((current) => {
      const next = !current;
      applyBalanceVisibility(next);
      return next;
    });
  }

  function navigateAppTab(tab) {
    if (tab === "add") {
      if (!spendableAssetAccounts.length) {
        setToast({
          message: "Tambahkan dompet terlebih dahulu sebelum mencatat transaksi.",
          tone: "warning",
        });
        openAssetFormFromQuickAction();
        return;
      }
      setTransactionFabHintDismissed(true);
      setTransactionEntryType("expense");
      writeAppStorage("transactionFabHintDismissed", true);
    }
    /* Permintaan fokus kategori hanya berlaku untuk kunjungan itu. Dulu
       kuncinya bertahan selamanya, sehingga halaman Jatah terus mengulang
       permintaan lama setiap kali dibuka. */
    if (tab !== "budget") setBudgetFocusCategoryKey(null);
    setActiveTab(tab);
    setMenuOpen(false);
    setQuickActionOpen(false);
  }

  function openBudgetWorkspace(categoryKey = null) {
    /* Seksi Target tinggal di halaman Dompet, jadi permintaannya diarahkan
       langsung ke sana. Sebelumnya "__goals__" disimpan sebagai fokus
       kategori Jatah, lalu halaman Jatah mengalihkan dirinya sendiri ke
       Dompet setiap kali dibuka sampai halaman dimuat ulang. */
    if (categoryKey === "__goals__") {
      setBudgetFocusCategoryKey(null);
      navigateAppTab("investment");
      scrollAppToTop();
      return;
    }
    setBudgetFocusCategoryKey(categoryKey || null);
    navigateAppTab("budget");
    scrollAppToTop();
  }

  function dismissTransactionFabHint() {
    setTransactionFabHintDismissed(true);
    writeAppStorage("transactionFabHintDismissed", true);
  }

  // Catat cepat: sheet keypad untuk pemasukan dan pengeluaran sederhana.
  // Transfer, tukar mata uang, dan pengaturan detail tetap lewat form lengkap.
  function openQuickEntry() {
    if (!spendableAssetAccounts.length) {
      setToast({
        message: "Tambahkan dompet terlebih dahulu sebelum mencatat transaksi.",
        tone: "warning",
      });
      openAssetFormFromQuickAction();
      return;
    }
    const requestedEntryType = "expense";
    const preferredAccountId = accountPreferences.find(
      (preference) =>
        preference.flow_type === requestedEntryType &&
        spendableAssetAccounts.some(
          (account) => account.id === preference.account_id,
        ),
    )?.account_id;
    dismissTransactionFabHint();
    setTransactionEntryType(requestedEntryType);
    setQuickEntryInitialAccountId(preferredAccountId || "");
    setQuickEntryInitialAmount(0);
    setQuickEntryRequestKey((current) => current + 1);
    setQuickEntryOpen(true);
  }

  function openBulkEntry() {
    if (!spendableAssetAccounts.length) {
      setToast({
        message: "Tambahkan dompet terlebih dahulu sebelum mencatat transaksi.",
        tone: "warning",
      });
      openAssetFormFromQuickAction();
      return;
    }
    dismissTransactionFabHint();
    setBulkEntryOpen(true);
  }

  function openTransactionForm(entryType = "expense", target = null, amount = 0) {
    if (!spendableAssetAccounts.length) {
      setToast({
        message: "Tambahkan dompet terlebih dahulu sebelum mencatat transaksi.",
        tone: "warning",
      });
      openAssetFormFromQuickAction();
      return;
    }
    dismissTransactionFabHint();
    setTransactionReturnTab((current) =>
      activeTab === "add" ? current || "overview" : activeTab,
    );
    setTransactionEntryType(entryType);
    setTransactionTargetDraft({
      id: target?.id || "",
      currency: target?.currency || "",
      amount: Number(amount) > 0 ? Number(amount) : 0,
    });
    setActiveTab("add");
    setMenuOpen(false);
    setQuickActionOpen(false);
  }

  function openMovementWorkspace(initialMode = "exchange") {
    const movementAllowed =
      initialMode === "transfer" ? hasTransferPair : hasExchangePair;
    if (!movementAllowed) {
      setToast({
        message:
          initialMode === "transfer"
            ? "Transfer membutuhkan dua dompet dengan mata uang yang sama."
            : "Tukar valas membutuhkan dua dompet dengan mata uang berbeda.",
        tone: "warning",
      });
      openAssetFormFromQuickAction();
      return;
    }
    dismissTransactionFabHint();
    setMovementInitialMode(initialMode === "transfer" ? "transfer" : "exchange");
    setTransactionEntryType("exchange");
    setActiveTab("movement");
    setMenuOpen(false);
    setQuickActionOpen(false);
    scrollAppToTop();
  }

  function closeTransactionForm() {
    setTransactionTargetDraft({ id: "", currency: "" });
    navigateAppTab(transactionReturnTab || "overview");
  }

  /* Tombol + di navigasi langsung membuka Catat transaksi. Sebelumnya ia
     membuka menu Aksi cepat yang menawarkan tambah dompet dan lainnya, jadi
     mencatat uang butuh dua ketukan. Alur tambah dompet tetap tersedia dari
     halaman Dompet. */
  function openQuickActionMenu() {
    openQuickEntry();
  }

  function openAssetFormFromQuickAction() {
    setAssetFormRequest((current) => current + 1);
    navigateAppTab("investment");
  }

  function handleAssetFormRequestHandled() {
    setAssetFormRequest(0);
  }

  const recentTodayTransactions = orderTransactions(transactions)
    .filter((item) => getLocalDayKey(item.occurred_at) === todayKey)
    .reverse()
    .slice(0, 5);
  /* Kurs cadangan mengikuti mata uang tiap transaksi, bukan satu kurs baht
     untuk semuanya. */
  const latestTransactionRate = createTransactionFallbackRate(
    transactions,
    walletBaseCurrency,
  );
  const activeContent = activeTab === "today"
    ? html`
        <section className="grid gap-5">
          <${DailyExpenseForm}
            onSubmit=${handleCreateTransaction}
            loading=${loading}
            budget=${activeBudgetInsight}
            todaySpentThb=${todaySpentCurrency}
            todaySpentIdr=${todaySpentIdr}
            todaySpentCurrency=${todaySpentCurrency}
            expenseCurrency=${dailyExpenseCurrency}
            baseCurrency=${walletBaseCurrency}
            accounts=${metrics.assetAccountInsights}
            onRequestAddWallet=${openAssetFormFromQuickAction}
          />
          <${RecentTransactionsPreview}
            transactions=${recentTodayTransactions}
            fallbackRate=${latestTransactionRate}
            onOpenHistory=${() => navigateAppTab("history")}
          />
        </section>
      `
    : activeTab === "budget"
      ? html`
          <section>
            <${BudgetWorkspacePage}
              metrics=${metrics}
              controlSummary=${controlSummary}
              transactions=${transactions}
              budgets=${budgets}
              activeCurrencies=${dashboardActiveCurrencies}
              baseCurrency=${walletBaseCurrency}
              globalRateSnapshot=${globalRateSnapshot}
              loading=${loading}
              onBudgetDelete=${handleDeleteBudget}
              onBudgetSubmit=${handleSaveBudget}
              onSaveBudgetPlan=${handleSaveBudgetPlan}
              reserveBills=${reserveBills}
              onToggleReserveBills=${handleToggleReserveBills}
              focusCategoryKey=${budgetFocusCategoryKey}
              onNavigate=${navigateAppTab}
              onOpenCategoryHistory=${(budget) => {
                setHistoryFocusCategory(budget.categoryKey || "");
                navigateAppTab("history");
              }}
            />
          </section>
        `
      : activeTab === "movement"
        ? html`
            <section>
              <${TransactionForm}
                transactions=${transactions}
                onSubmit=${handleCreateTransaction}
                loading=${loading}
                activeCurrencies=${dashboardActiveCurrencies}
                dailyCurrency=${dailyExpenseCurrency}
                baseCurrency=${walletBaseCurrency}
                assetAccounts=${metrics.assetAccountInsights}
                budgetInsights=${metrics.budgetInsights}
                goalInsights=${metrics.goalInsights}
                globalRateSnapshot=${globalRateSnapshot}
                initialEntryType="exchange"
                initialMovementMode=${movementInitialMode}
                workspace=${true}
                onClose=${() => navigateAppTab("overview")}
                onRequestAddWallet=${openAssetFormFromQuickAction}
              />
            </section>
          `
        : activeTab === "add"
        ? html`
            <section>
              <${TransactionForm}
                transactions=${transactions}
                onSubmit=${handleCreateTransaction}
                loading=${loading}
                activeCurrencies=${dashboardActiveCurrencies}
                dailyCurrency=${dailyExpenseCurrency}
                baseCurrency=${walletBaseCurrency}
                assetAccounts=${metrics.assetAccountInsights}
                budgetInsights=${metrics.budgetInsights}
                goalInsights=${metrics.goalInsights}
                globalRateSnapshot=${globalRateSnapshot}
                initialEntryType=${transactionEntryType}
                initialTargetId=${transactionTargetDraft.id}
                initialExpenseCurrency=${transactionTargetDraft.currency}
                initialAmount=${transactionTargetDraft.amount}
                onClose=${closeTransactionForm}
                onRequestAddWallet=${openAssetFormFromQuickAction}
              />
            </section>
          `
        : activeTab === "history"
          ? html`
              <section>
                <${TransactionHistoryPage}
                  transactions=${historyTransactions}
                  onDelete=${handleDeleteTransaction}
                  onUpdate=${handleUpdateTransaction}
                  loading=${loading}
                  activeCurrencies=${dashboardActiveCurrencies}
                  assetAccounts=${assetAccounts}
                  goalFundingAccounts=${goalFundingAccounts}
                  baseCurrency=${walletBaseCurrency}
                  emptyMessage="Belum ada transaksi."
                  emptyHint="Mulai dari satu transaksi kecil. Setelah itu, CUANSYNC bisa menampilkan riwayat dan laporan yang lebih berguna."
                  emptyActionLabel="Tambah transaksi"
                  onEmptyAction=${() => openTransactionForm("expense")}
                  monthLabel=${metrics.currentMonthLabel}
                  monthlyIncome=${Number(metrics.monthlyIncomeIdr || 0)}
                  monthlyExpense=${Number(metrics.monthlyExpenseIdr || 0)}
                  unvaluedCount=${Number(metrics.monthlyUnvaluedCount || 0)}
                  focusCategory=${historyFocusCategory}
                />
              </section>
            `
          : activeTab === "overview"
            ? html`
                <section>
                  <${HomeDashboardPage}
                    metrics=${metrics}
                    controlSummary=${controlSummary}
                    activeCurrencies=${dashboardActiveCurrencies}
                    dailyCurrency=${dailyExpenseCurrency}
                    baseCurrency=${walletBaseCurrency}
                    valuationsByCurrency=${walletValuationsByCurrency}
                    totalValueBase=${walletTotalValueBase}
                    visible=${balanceVisible}
                    onToggleVisible=${handleToggleBalanceVisibility}
                    fallbackRate=${latestTransactionRate}
                    onNavigate=${navigateAppTab}
                    canTransfer=${hasTransferPair}
                    canExchange=${hasExchangePair}
                    onAddTransaction=${openQuickEntry}
                    onAddBulkTransaction=${openBulkEntry}
                    onExchange=${(mode) => openMovementWorkspace(mode)}
                    onAddWallet=${openAssetFormFromQuickAction}
                  />
                </section>
              `
            : activeTab === "control"
              ? html`
                  <section>
                    <${ControlCenterPage}
                      summary=${controlSummary}
                      visible=${balanceVisible}
                      onNavigate=${navigateAppTab}
                      onOpenBudget=${openBudgetWorkspace}
                      onAddIncome=${() => openTransactionForm("income")}
                      incomeEstimate=${incomeEstimate}
                      activeCurrencies=${dashboardActiveCurrencies}
                      onSaveIncomeEstimate=${handleSaveIncomeEstimate}
                    />
                  </section>
                `
              : activeTab === "report"
              ? html`
                  <section>
                    <${MonthlyReportPage}
                      transactions=${transactions}
                      budgets=${budgets}
                      selectedMonthKey=${reportMonthKey}
                      baseCurrency=${walletBaseCurrency}
                      onMonthChange=${setReportMonthKey}
                      onNavigate=${navigateAppTab}
                    />
                  </section>
                `
              : activeTab === "settings"
                ? html`
                    <section>
                      <${SettingsPanel}
                        user=${user}
                        profile=${profile}
                        profilePhoto=${profilePhoto}
                        transactions=${transactions}
                        assetAccounts=${assetAccounts}
                        baseCurrency=${walletBaseCurrency}
                        onLoadStatementTransactions=${loadStatementTransactions}
                        theme=${theme}
                        onThemeChange=${handleThemeChange}
                        balanceVisible=${balanceVisible}
                        onToggleBalanceVisibility=${handleSetHideBalances}
                        nativeWidgetAvailable=${isNativeWidgetAvailable()}
                        onRequestNativeWidget=${requestPinNativeWidget}
                        onSaveProfile=${handleSaveProfile}
                        onSignOut=${handleSignOut}
                      />
                    </section>
                  `
                : html`
                    <section>
                      <${WealthGoalsPage}
                        metrics=${metrics}
                        transactions=${transactions}
                        accountReconciliations=${accountReconciliations}
                        loading=${loading}
                        activeCurrencies=${dashboardActiveCurrencies}
                        baseCurrency=${walletBaseCurrency}
                        onCreateAssetAccount=${handleCreateAssetAccount}
                        onDeleteAssetAccount=${handleDeleteAssetAccount}
                        onSetPrimaryAccount=${handleSetPrimaryAccount}
                        onCreateAccountReconciliation=${handleCreateAccountReconciliation}
                        onRecordMissingTransaction=${handleRecordMissingTransaction}
                        onCreateGoal=${handleCreateGoal}
                        onUpdateGoal=${handleUpdateGoal}
                        onDeleteGoal=${handleDeleteGoal}
                        onArchiveGoal=${handleArchiveGoal}
                        onMoveAllocation=${handleMoveGoalAllocation}
                        onContribute=${handleAddGoalProgress}
                        onUseGoal=${(goal) => openTransactionForm("expense", goal)}
                        onOpenGoals=${() => navigateAppTab("budget")}
                        onOpenReport=${() => navigateAppTab("report")}
                        onSelectAccountCurrency=${setSelectedWalletCurrency}
                        openAssetFormRequest=${assetFormRequest}
                        onAssetFormRequestHandled=${handleAssetFormRequestHandled}
                      />
                    </section>
                  `;
  const fullWidthWorkspace =
    activeTab === "overview" ||
    activeTab === "control" ||
    activeTab === "movement" ||
    activeTab === "budget";

  return html`
    ${/* Privasi disiarkan dari sini supaya kartu dompet, sheet detail, dan
          baris aktivitas sedalam apa pun ikut tertutup tanpa perlu dioper
          prop satu per satu. */ null}
    <${BalanceVisibilityProvider}
      visible=${balanceVisible}
      onToggle=${handleToggleBalanceVisibility}
    >
    ${/* Di desktop padding dipindah ke kolom utama supaya sidebar bisa menempel
          rapat ke tepi kiri layar seperti di artifact. */ null}
    <main className="app-shell relative isolate min-h-screen overflow-x-clip px-6 pt-2 md:px-6 md:py-5 lg:p-0">
      <${PremiumMeshBackground} />
      <${ToastMessage} toast=${toast} onDismiss=${() => setToast(null)} />
      ${/* Desktop memakai tata letak artifact: sidebar 264px yang menempel di
            kiri, lalu kolom utama yang mengisi sisanya. Di bawah lg susunannya
            tetap satu kolom seperti sebelumnya. */ null}
      <div className="cs-workspace relative z-10 lg:flex lg:items-stretch">
        ${/* onToggleTheme memanggil handleThemeChange, bukan setTheme langsung.
              setTheme hanya mengubah state layar: profil dan salinan server
              tetap memuat tema lama, lalu pemulihan sesi saat tab difokuskan
              kembali mengembalikan tampilan seperti semula. */ null}
        <${DesktopNavigation}
          activeTab=${activeTab}
          onChange=${navigateAppTab}
          onSettings=${() => navigateAppTab("settings")}
          onToggleTheme=${() =>
            handleThemeChange(resolvedTheme === "dark" ? "light" : "dark")}
          isDark=${resolvedTheme === "dark"}
          userName=${userDisplayName}
          userEmail=${user?.email || "Demo Lokal"}
          userInitials=${userInitials}
          avatarSrc=${profilePhoto}
        />
        <div className="min-w-0 lg:flex lg:min-h-screen lg:flex-1 lg:flex-col">
        <${WalletHeader}
          appName=${APP_NAME}
          balances=${walletBalances}
          valuationsByCurrency=${walletValuationsByCurrency}
          totalValueBase=${walletTotalValueBase}
          activeCurrencies=${dashboardActiveCurrencies}
          selectedCurrency=${selectedWalletCurrency}
          dailyCurrency=${dailyExpenseCurrency}
          baseCurrency=${walletBaseCurrency}
          visible=${balanceVisible}
          onToggleVisibility=${handleToggleBalanceVisibility}
          onSelectCurrency=${setSelectedWalletCurrency}
          avatarSrc=${profilePhoto}
          avatarInitials=${userInitials}
          onAvatarClick=${() => setMenuOpen((current) => !current)}
          compact=${activeTab === "settings" ||
          activeTab === "overview" ||
          activeTab === "control" ||
          activeTab === "investment" ||
          activeTab === "movement" ||
          activeTab === "budget" ||
          activeTab === "history"}
          historyCompact=${activeTab === "history"}
          activeTab=${activeTab}
          userName=${greetingName}
          onBack=${() =>
            navigateAppTab(activeTab === "control" ? "budget" : "overview")}
          onAddTransaction=${openQuickEntry}
          onSend=${() => openMovementWorkspace("transfer")}
          onSwap=${() => openMovementWorkspace("exchange")}
          canSend=${hasTransferPair}
          canSwap=${hasExchangePair}
        />

        ${menuOpen
          ? html`
              <button
                key="profile-menu-backdrop"
                type="button"
                aria-label="Tutup menu"
                onClick=${() => setMenuOpen(false)}
                className="fixed inset-0 z-20 bg-slate-950/5 backdrop-blur-[1px]"
              ></button>
              <section
                key="profile-menu-panel"
                className=${menuPanelClass}
                onClick=${(event) => event.stopPropagation()}
              >
                <div className=${menuProfileCardClass}>
                  <${AvatarBadge} src=${profilePhoto} initials=${userInitials} size="md" />
                  <div className="min-w-0">
                    <p
                      className="truncate text-sm font-bold"
                      style=${{ color: "var(--cs-ink)" }}
                    >
                      ${userDisplayName}
                    </p>
                    <p
                      className="truncate text-xs"
                      style=${{ color: "var(--cs-mut)" }}
                    >
                      ${user?.email || "Demo Lokal"}
                    </p>
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  ${navigationTabs.map(
                    (tab) => html`
                      <button
                        key=${tab.key}
                        type="button"
                        onClick=${() => {
                          setActiveTab(tab.key);
                          setMenuOpen(false);
                        }}
                        className="dc-press dc-press-96 flex min-h-11 w-full items-center justify-between rounded-[14px] border px-4 py-3 text-left text-[13.5px] font-medium"
                        style=${{
                          ...menuTabStyle(tab.key),
                          borderColor:
                            menuActiveTab === tab.key
                              ? "transparent"
                              : "var(--cs-line)",
                        }}
                      >
                        <span>${tab.label}</span>
                      </button>
                    `,
                  )}
                </div>
              </section>
            `
          : null}

        ${message && messageTone === "error"
          ? html`
              <div className="mt-5">
                <${InfoBanner} message=${message} tone=${messageTone} />
              </div>
            `
          : null}

        ${/* Desktop: kolom konten memakai padding 28/32/56 dan lebar maksimum
              1400 seperti artifact. Batas lebar lama dilepas di lg supaya
              grid dua kolom punya ruang. */ null}
        <div className=${fullWidthWorkspace
          ? activeTab === "movement"
            ? "mx-auto mt-4 max-w-[34rem] lg:mt-0 lg:w-full lg:max-w-[46rem] lg:px-8 lg:pb-14 lg:pt-7"
            : "mx-auto mt-4 max-w-[1024px] lg:mt-0 lg:w-full lg:max-w-[1400px] lg:px-8 lg:pb-14 lg:pt-7"
          : "mt-5 lg:mt-0 lg:grid lg:w-full lg:max-w-[1400px] lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-6 lg:px-8 lg:pb-14 lg:pt-7"}>
          ${/* key diikat ke tab aktif supaya React memasang ulang node ini saat
                tab berganti, dan animasi masuk fadeUp terulang tiap pindah
                layar seperti tabAnim di artifact. */ null}
          <div key=${`screen-${activeTab}`} className="dc-screen min-w-0">
            ${activeContent}
          </div>
          ${fullWidthWorkspace
            ? null
            : html`
                <${DesktopRightPanel}
                  assetAccounts=${metrics.assetAccountInsights}
                  budget=${activeBudgetInsight}
                  todaySpentCurrency=${todaySpentCurrency}
                  todaySpentIdr=${todaySpentIdr}
                  dailyCurrency=${dailyExpenseCurrency}
                  baseCurrency=${walletBaseCurrency}
                  visible=${balanceVisible}
                  onNavigate=${navigateAppTab}
                />
              `}
        </div>
        </div>
      </div>
      <${MobileNavigation}
        activeTab=${activeTab}
        onChange=${navigateAppTab}
        onAdd=${openQuickActionMenu}
        showHint=${!transactionFabHintDismissed && activeTab !== "add" && activeTab !== "movement"}
        onDismissHint=${dismissTransactionFabHint}
      />
      <${QuickActionMenu}
        open=${quickActionOpen}
        canExchange=${hasExchangePair}
        onClose=${() => setQuickActionOpen(false)}
        onAddTransaction=${openQuickEntry}
        onExchange=${() => openMovementWorkspace("exchange")}
        onAddWallet=${openAssetFormFromQuickAction}
      />

      <${BulkEntrySheet}
        open=${bulkEntryOpen}
        onClose=${() => setBulkEntryOpen(false)}
        onSubmit=${handleCreateTransactionBatch}
        onUndo=${handleDeleteTransactionBatch}
        loading=${loading}
        accounts=${spendableAssetAccounts}
        categories=${CATEGORY_OPTIONS}
        availability=${metrics.goalAllocationState?.accountAvailability || {}}
        baseCurrency=${walletBaseCurrency}
      />

      <${QuickEntrySheet}
        open=${quickEntryOpen}
        onClose=${() => setQuickEntryOpen(false)}
        onSubmit=${handleCreateTransaction}
        loading=${loading}
        accounts=${spendableAssetAccounts}
        categories=${CATEGORY_OPTIONS}
        baseCurrency=${walletBaseCurrency}
        initialEntryType=${transactionEntryType}
        initialAccountId=${quickEntryInitialAccountId}
        initialAmount=${quickEntryInitialAmount}
        requestKey=${quickEntryRequestKey}
      />
    </main>
    <//>
  `;
}

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error(`Runtime error in ${APP_NAME}:`, error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return html`
        <main className="min-h-screen bg-mist p-6 text-ink dark:bg-slate-950 dark:text-slate-50">
          <div className="mx-auto max-w-3xl rounded-2xl border border-rose-300/40 bg-rose-50 p-5 dark:border-rose-500/30 dark:bg-rose-500/10">
            <h1 className="font-display text-xl font-bold text-rose-700 dark:text-rose-300">
              ${APP_NAME} mengalami error saat berjalan
            </h1>
            <p className="mt-2 text-sm text-rose-700 dark:text-rose-200">
              Ini biasanya bug frontend, bukan kerusakan database. Buka konsol browser (F12)
              untuk detail teknis.
            </p>
            <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-900 p-3 text-xs text-slate-100">
${String(this.state.error?.message || this.state.error)}
            </pre>
            <button
              type="button"
              onClick=${() => window.location.reload()}
              className="mt-4 rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
            >
              Muat ulang
            </button>
          </div>
        </main>
      `;
    }

    return this.props.children;
  }
}

createRoot(document.getElementById("root")).render(
  html`<${AppErrorBoundary}><${App} /></${AppErrorBoundary}>`,
);
