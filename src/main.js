import React, { useEffect, useMemo, useState } from "https://esm.sh/react@18.3.1";
import { createRoot } from "https://esm.sh/react-dom@18.3.1/client";
import htm from "https://esm.sh/htm@3.1.1";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { APP_NAME, SUPABASE_ANON_KEY, SUPABASE_URL } from "./config.js";

const html = htm.bind(React.createElement);

const STORAGE_KEYS = {
  theme: "monefy-theme",
  demoAuth: "monefy-demo-auth",
  demoTransactions: "monefy-demo-transactions",
  demoBudgets: "monefy-demo-budgets",
  demoGoals: "monefy-demo-goals",
  profilePhotos: "monefy-profile-photos",
  balanceVisible: "monefy-balance-visible",
  currencySettings: "monefy-currency-settings",
};

const LEGACY_STORAGE_KEYS = {
  theme: "kas-poipet-theme",
  demoAuth: "kas-poipet-demo-auth",
  demoTransactions: "kas-poipet-demo-transactions",
  demoBudgets: "kas-poipet-demo-budgets",
  demoGoals: "kas-poipet-demo-goals",
  profilePhotos: "kas-poipet-profile-photos",
  balanceVisible: "kas-poipet-balance-visible",
  currencySettings: "kas-poipet-currency-settings",
};

const DEMO_USER = {
  id: "demo-user",
  email: "demo@cuansync.local",
  user_metadata: {
    full_name: "Demo User",
    avatar_url: "",
  },
};

const CATEGORY_OPTIONS = [
  {
    value: "Makan",
    label: "Makan Harian",
    chip:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    bar: "from-emerald-400 to-emerald-500",
  },
  {
    value: "Belanja",
    label: "Belanja Kebutuhan",
    chip: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
    bar: "from-sky-300 to-indigo-500",
  },
  {
    value: "Transport",
    label: "Transport",
    chip:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    bar: "from-amber-300 to-orange-500",
  },
  {
    value: "Tagihan",
    label: "Tagihan",
    chip:
      "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
    bar: "from-violet-300 to-fuchsia-500",
  },
  {
    value: "Kesehatan",
    label: "Kesehatan",
    chip: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    bar: "from-rose-300 to-pink-500",
  },
  {
    value: "Internet",
    label: "Internet & Pulsa",
    chip: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300",
    bar: "from-cyan-300 to-blue-500",
  },
  {
    value: "Tempat Tinggal",
    label: "Tempat Tinggal",
    chip: "bg-lime-100 text-lime-700 dark:bg-lime-500/15 dark:text-lime-300",
    bar: "from-lime-300 to-emerald-500",
  },
  {
    value: "Lainnya",
    label: "Lainnya",
    chip:
      "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
    bar: "from-slate-400 to-slate-700",
  },
];

const CATEGORY_LOOKUP = Object.fromEntries(
  CATEGORY_OPTIONS.map((item) => [item.value, item]),
);

const HISTORY_CATEGORY_EMOJI = {
  Makan: "🍜",
  "Makan Harian": "🍜",
  Belanja: "🛒",
  "Belanja Kebutuhan": "🛒",
  Transport: "🚕",
  Tagihan: "💡",
  Kesehatan: "🩺",
  Internet: "📶",
  "Internet & Pulsa": "📶",
  "Tempat Tinggal": "🏠",
  Lainnya: "🧾",
};

const DEFAULT_CATEGORY = "Makan";
const UNIVERSAL_BUDGET_GROUP = "needs";

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

const DEFAULT_BASE_CURRENCY = "IDR";
const DEFAULT_ACTIVE_CURRENCIES = [
  "IDR",
  "THB",
  "USD",
  "AUD",
  "KRW",
  "JPY",
  "SGD",
  "MYR",
  "EUR",
  "GBP",
];
const DEFAULT_SELECTED_CURRENCIES = ["IDR"];

const CURRENCY_META = {
  IDR: { label: "IDR", locale: "id-ID", digits: 0 },
  THB: { label: "THB", locale: "th-TH", digits: 2 },
  USD: { label: "USD", locale: "en-US", digits: 2 },
  AUD: { label: "AUD", locale: "en-AU", digits: 2 },
  KRW: { label: "KRW", locale: "ko-KR", digits: 0 },
  JPY: { label: "JPY", locale: "ja-JP", digits: 0 },
  SGD: { label: "SGD", locale: "en-SG", digits: 2 },
  MYR: { label: "MYR", locale: "ms-MY", digits: 2 },
  EUR: { label: "EUR", locale: "de-DE", digits: 2 },
  GBP: { label: "GBP", locale: "en-GB", digits: 2 },
};

const currencyFormatters = {};
let runtimeCurrencySettings = null;

const numberFormatter = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("id-ID", {
  style: "percent",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const inputGroupingFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const cardSurface =
  "cuan-card";

const cardSurfaceSoft =
  "cuan-card-soft";

const inputSurface =
  "cuan-input";

const mutedText = "text-slate-700 dark:text-slate-300/80";

const navSurface =
  "cuan-nav";

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

const MESH_ORBS = [
  {
    id: "emerald-a",
    className:
      "-left-24 top-0 h-[28rem] w-[28rem] bg-emerald-300/28 dark:bg-emerald-400/20",
    animation: "premium-float-a 26s ease-in-out infinite alternate",
  },
  {
    id: "indigo-a",
    className:
      "right-[-6rem] top-16 h-[30rem] w-[30rem] bg-sky-300/24 dark:bg-indigo-400/18",
    animation: "premium-float-b 32s ease-in-out infinite alternate",
  },
  {
    id: "blue-a",
    className:
      "left-1/3 top-1/2 h-[24rem] w-[24rem] bg-cyan-300/18 dark:bg-blue-500/16",
    animation: "premium-float-c 28s ease-in-out infinite alternate",
  },
  {
    id: "emerald-b",
    className:
      "bottom-[-8rem] right-1/4 h-[26rem] w-[26rem] bg-emerald-200/24 dark:bg-emerald-300/14",
    animation: "premium-float-d 34s ease-in-out infinite alternate",
  },
];

const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;

function normalizeCurrencyCode(currency, fallback = DEFAULT_BASE_CURRENCY) {
  const code = String(currency || fallback || DEFAULT_BASE_CURRENCY)
    .trim()
    .toUpperCase();
  return code || DEFAULT_BASE_CURRENCY;
}

function getCurrencyMeta(currency) {
  const code = normalizeCurrencyCode(currency);
  return CURRENCY_META[code] || { label: code, locale: "en-US", digits: 2 };
}

function formatCurrency(value, currency) {
  const code = normalizeCurrencyCode(currency);
  if (!currencyFormatters[code]) {
    const meta = getCurrencyMeta(code);
    currencyFormatters[code] = new Intl.NumberFormat(meta.locale, {
      style: "currency",
      currency: code,
      minimumFractionDigits: meta.digits,
      maximumFractionDigits: meta.digits,
    });
  }
  return currencyFormatters[code].format(Number(value || 0));
}

function formatRate(
  value,
  fromCurrency = DEFAULT_BASE_CURRENCY,
  toCurrency = "THB",
) {
  if (!value) return "-";
  return `${numberFormatter.format(Number(value))} ${normalizeCurrencyCode(
    fromCurrency,
  )} / 1 ${normalizeCurrencyCode(toCurrency, "THB")}`;
}

function normalizeCurrencyList(currencies, { ensureBase = true } = {}) {
  const source = Array.isArray(currencies) ? currencies : [];
  const selected = [];
  const seen = new Set();

  function addCurrency(currency) {
    const code = normalizeCurrencyCode(currency);
    if (!code || seen.has(code)) return;
    seen.add(code);
    selected.push(code);
  }

  if (ensureBase) addCurrency(DEFAULT_BASE_CURRENCY);
  source.forEach(addCurrency);

  const order = new Map(DEFAULT_ACTIVE_CURRENCIES.map((code, index) => [code, index]));
  selected.sort((left, right) => {
    const leftOrder = order.has(left) ? order.get(left) : Number.MAX_SAFE_INTEGER;
    const rightOrder = order.has(right) ? order.get(right) : Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder || left.localeCompare(right);
  });

  return selected.length ? selected : [DEFAULT_BASE_CURRENCY];
}

function mergeCurrencyLists(...lists) {
  return normalizeCurrencyList(lists.flat().filter(Boolean));
}

function normalizeCurrencySettings(settings, { configured = false } = {}) {
  const baseCurrency = normalizeCurrencyCode(
    settings?.baseCurrency || settings?.base_currency || DEFAULT_BASE_CURRENCY,
  );
  const source = Array.isArray(settings)
    ? settings
    : settings?.activeCurrencies || settings?.currencies || DEFAULT_SELECTED_CURRENCIES;
  const activeCurrencies = normalizeCurrencyList(
    source,
  );
  const normalizedActiveCurrencies = normalizeCurrencyList([baseCurrency, ...activeCurrencies]);
  const requestedDailyCurrency = normalizeCurrencyCode(
    settings?.dailyCurrency ||
      settings?.daily_currency ||
      settings?.defaultExpenseCurrency ||
      settings?.default_expense_currency ||
      normalizedActiveCurrencies[0] ||
      baseCurrency,
  );
  const dailyCurrency = normalizedActiveCurrencies.includes(requestedDailyCurrency)
    ? requestedDailyCurrency
    : normalizedActiveCurrencies[0] || baseCurrency;

  return {
    baseCurrency,
    activeCurrencies: normalizedActiveCurrencies,
    dailyCurrency,
    configured: Boolean(settings?.configured || configured),
  };
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

function readCurrencySettings() {
  const stored = readAppStorage("currencySettings", null);
  return stored ? normalizeCurrencySettings(stored) : null;
}

function saveCurrencySettings(settings) {
  const normalized = normalizeCurrencySettings(settings, { configured: true });
  writeAppStorage("currencySettings", normalized);
  return normalized;
}

function setRuntimeCurrencySettings(settings) {
  runtimeCurrencySettings = settings ? normalizeCurrencySettings(settings) : null;
}

function getActiveCurrencies() {
  return (
    runtimeCurrencySettings?.activeCurrencies ||
    readCurrencySettings()?.activeCurrencies ||
    DEFAULT_SELECTED_CURRENCIES
  );
}

function getCurrencyOptions(currencies = getActiveCurrencies()) {
  return currencies.map((currency) => {
    const code = normalizeCurrencyCode(currency);
    return { value: code, label: getCurrencyMeta(code).label };
  });
}

function getBaseCurrency() {
  return DEFAULT_BASE_CURRENCY;
}

function formatPercent(value) {
  return percentFormatter.format(Number(value || 0));
}

function normalizeNumericInput(value, { allowDecimal = true } = {}) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const withoutCommas = raw.replace(/,/g, "");
  if (!allowDecimal) {
    return withoutCommas.replace(/[^\d]/g, "");
  }

  let cleaned = withoutCommas.replace(/[^\d.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot !== -1) {
    cleaned = `${cleaned.slice(0, firstDot + 1)}${cleaned
      .slice(firstDot + 1)
      .replace(/\./g, "")}`;
  }
  return cleaned;
}

function formatNumericInput(value, { allowDecimal = true } = {}) {
  const cleaned = normalizeNumericInput(value, { allowDecimal });
  if (!cleaned) return "";

  if (!allowDecimal) {
    return inputGroupingFormatter.format(Number(cleaned));
  }

  if (cleaned.includes(".")) {
    const [integerPartRaw, decimalPart = ""] = cleaned.split(".");
    const integerPart = integerPartRaw
      ? inputGroupingFormatter.format(Number(integerPartRaw))
      : "0";
    return `${integerPart}.${decimalPart}`;
  }

  return inputGroupingFormatter.format(Number(cleaned));
}

function formatAutoNumericValue(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return "";
  const rounded =
    Math.abs(numeric) >= 100
      ? Math.round(numeric * 100) / 100
      : Math.round(numeric * 1000000) / 1000000;
  return formatNumericInput(String(rounded));
}

function settleExchangeCalculation(
  form,
  changedField,
  { rateField = "exchange_rate", preferredTarget = null } = {},
) {
  const next = { ...form };
  const fromAmount = Number(normalizeNumericInput(next.from_amount));
  const toAmount = Number(normalizeNumericInput(next.to_amount));
  const rate = Number(normalizeNumericInput(next[rateField]));

  function setAutoValue(field, value) {
    const formatted = formatAutoNumericValue(value);
    if (formatted) next[field] = formatted;
  }

  if (changedField === rateField) {
    if (rate <= 0) return next;
    if (preferredTarget === "from_amount" && toAmount > 0) {
      setAutoValue("from_amount", toAmount * rate);
      return next;
    }
    if (preferredTarget === "to_amount" && fromAmount > 0) {
      setAutoValue("to_amount", fromAmount / rate);
      return next;
    }
    if (toAmount > 0) {
      setAutoValue("from_amount", toAmount * rate);
      return next;
    }
    if (fromAmount > 0) {
      setAutoValue("to_amount", fromAmount / rate);
    }
    return next;
  }

  if (changedField === "from_amount") {
    if (fromAmount <= 0) return next;
    if (toAmount > 0) {
      setAutoValue(rateField, fromAmount / toAmount);
      return next;
    }
    if (rate > 0) {
      setAutoValue("to_amount", fromAmount / rate);
    }
    return next;
  }

  if (changedField === "to_amount") {
    if (toAmount <= 0) return next;
    if (fromAmount > 0) {
      setAutoValue(rateField, fromAmount / toAmount);
      return next;
    }
    if (rate > 0) {
      setAutoValue("from_amount", toAmount * rate);
    }
  }

  return next;
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDay(value) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function formatMonthKey(value) {
  const [year, month] = String(value).split("-");
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(new Date(Number(year), Number(month) - 1, 1));
}

function formatLongDate(value) {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function getUserDisplayName(user) {
  return (
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "User"
  );
}

function getUserInitials(user) {
  const base = getUserDisplayName(user)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
  return base || "U";
}

function getUserStorageId(user) {
  return user?.id || user?.email || "guest";
}

function AvatarBadge({ src, initials, size = "md" }) {
  const sizeClass =
    size === "lg"
      ? "h-20 w-20 text-xl"
      : size === "md"
        ? "h-12 w-12 text-sm"
        : "h-10 w-10 text-xs";

  return html`
    <div
      className=${`inline-flex items-center justify-center overflow-hidden rounded-full border border-brand-300/40 bg-brand-600 font-bold text-white shadow-[0_12px_30px_rgba(16,185,129,0.22)] ring-2 ring-brand-500/12 dark:border-white/10 dark:ring-brand-300/10 ${sizeClass}`}
    >
      ${src
        ? html`
            <img
              src=${src}
              alt="Foto profil"
              className="h-full w-full object-cover"
            />
          `
        : initials}
    </div>
  `;
}

function EyeToggleIcon({ visible }) {
  if (visible) {
    return html`
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </svg>
    `;
  }

  return html`
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M9.88 9.88A3 3 0 0 0 14.12 14.12"></path>
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c6.5 0 10 7 10 7a17.56 17.56 0 0 1-2.07 3.02"></path>
      <path d="M6.61 6.61C3.7 8.63 2 12 2 12s3.5 7 10 7a9.76 9.76 0 0 0 5.39-1.61"></path>
      <path d="M2 2l20 20"></path>
    </svg>
  `;
}

function BalancePrivacyPill({ balanceIdr, balanceThb, visible, onToggle }) {
  const idrText = visible ? formatCurrency(balanceIdr, "idr") : "••••••";
  const thbText = visible ? formatCurrency(balanceThb, "thb") : "••••••";

  return html`
    <div className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-2xl border border-brand-300/30 bg-brand-600 px-3 py-1.5 text-[11px] font-semibold uppercase text-white shadow-[0_12px_30px_rgba(16,185,129,0.22)] sm:flex-none sm:rounded-full sm:text-xs">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-white/75">IDR</span>
        <span className="min-w-[4.75rem] break-all tabular-nums">${idrText}</span>
        <span className="hidden text-white/45 min-[360px]:inline">|</span>
        <span className="text-white/75">THB</span>
        <span className="min-w-[4.25rem] break-all tabular-nums">${thbText}</span>
      </div>
      <button
        type="button"
        onClick=${onToggle}
        aria-label=${visible ? "Sembunyikan saldo" : "Tampilkan saldo"}
        title=${visible ? "Sembunyikan saldo" : "Tampilkan saldo"}
        className="inline-flex min-h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/18 bg-white/12 text-white transition hover:-translate-y-0.5 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/45"
      >
        <${EyeToggleIcon} visible=${visible} />
      </button>
    </div>
  `;
}

function CompactBalancePrivacyPill({
  balances = {},
  activeCurrencies = getActiveCurrencies(),
  visible,
  onToggle,
}) {
  const hiddenText = "\u2022\u2022\u2022\u2022\u2022\u2022";
  const balanceItems = normalizeCurrencyList(activeCurrencies).map((currency) => ({
    label: currency,
    value: visible ? formatCurrency(balances[currency] || 0, currency) : hiddenText,
  }));

  return html`
    <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-[22px] border border-brand-300/30 bg-gradient-to-br from-brand-600 via-emerald-600 to-teal-700 p-1.5 text-white shadow-[0_16px_38px_rgba(16,185,129,0.24)] ring-1 ring-white/10 sm:flex-none sm:min-w-[19rem] sm:rounded-full">
      <div className="balance-strip flex min-w-0 flex-1 gap-1.5 overflow-x-auto pr-0.5">
        ${balanceItems.map(
          (item) => html`
            <div
              key=${item.label}
              className="min-w-[5.8rem] flex-1 rounded-2xl bg-white/[0.08] px-2.5 py-2 ring-1 ring-white/[0.08] sm:rounded-full sm:px-3"
            >
              <p className="text-[10px] font-black uppercase leading-none tracking-[0.12em] text-white/72">
                ${item.label}
              </p>
              <p className="mt-1 truncate text-[11px] font-black leading-none tabular-nums text-white min-[390px]:text-xs">
                ${item.value}
              </p>
            </div>
          `,
        )}
      </div>
      <button
        type="button"
        onClick=${onToggle}
        aria-label=${visible ? "Sembunyikan saldo" : "Tampilkan saldo"}
        title=${visible ? "Sembunyikan saldo" : "Tampilkan saldo"}
        className="inline-flex h-11 min-h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/22 bg-white/14 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] transition hover:-translate-y-0.5 hover:bg-white/22 focus:outline-none focus:ring-2 focus:ring-white/45"
      >
        <${EyeToggleIcon} visible=${visible} />
      </button>
    </div>
  `;
}

function getLocalDayKey(value) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMonthKey(value = new Date()) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getMonthParts(monthKey = getMonthKey(new Date())) {
  const [yearRaw, monthRaw] = String(monthKey).split("-");
  const year = Number(yearRaw) || new Date().getFullYear();
  const month = Number(monthRaw) || new Date().getMonth() + 1;
  return { year, month };
}

function getMonthMeta(monthKey = getMonthKey(new Date())) {
  const { year, month } = getMonthParts(monthKey);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  const daysInMonth = end.getDate();
  const isCurrentMonth = monthKey === getMonthKey(new Date());
  const elapsedDays = isCurrentMonth ? new Date().getDate() : daysInMonth;

  return {
    year,
    month,
    start,
    end,
    daysInMonth,
    elapsedDays: Math.max(Math.min(elapsedDays, daysInMonth), 1),
    isCurrentMonth,
    label: formatMonthKey(monthKey),
  };
}

function shiftMonthKey(monthKey, offset) {
  const { year, month } = getMonthParts(monthKey);
  return getMonthKey(new Date(year, month - 1 + offset, 1));
}

function getDateInputValue(value = new Date()) {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function toInputDateTime(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function readStorage(key, fallback, legacyKey = null) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
    if (!legacyKey) return fallback;

    const legacyRaw = window.localStorage.getItem(legacyKey);
    if (!legacyRaw) return fallback;

    const parsedLegacy = JSON.parse(legacyRaw);
    window.localStorage.setItem(key, JSON.stringify(parsedLegacy));
    return parsedLegacy;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
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

async function resizeProfileImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca file gambar."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("File gambar tidak valid."));
      image.onload = () => {
        const size = 320;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Browser tidak mendukung canvas untuk foto profil."));
          return;
        }

        const scale = Math.max(size / image.width, size / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        const offsetX = (size - width) / 2;
        const offsetY = (size - height) / 2;

        ctx.fillStyle = "#0f172a";
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(image, offsetX, offsetY, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.84));
      };
      image.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}

function getCategoryMeta(category) {
  return (
    CATEGORY_LOOKUP[category] || {
      value: category || "Lainnya",
      label: category || "Lainnya",
      chip:
        "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
      bar: "from-slate-400 to-slate-700",
    }
  );
}

const LEGACY_EXCHANGE_KEYWORDS = [
  "beli thb",
  "beli baht",
  "tukar thb",
  "tukar",
  "tukar / beli thb",
  "exchange",
  "convert",
  "currency exchange",
];

function looksLikeLegacyExchange(row) {
  if (row.type !== "income") return false;
  const amountThb = Number(row.amount_thb || 0);
  if (amountThb <= 0) return false;

  const searchable = [
    row.description,
    row.category,
    row.category_group,
    row.exchange_source,
    row.source,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return LEGACY_EXCHANGE_KEYWORDS.some((keyword) =>
    searchable.includes(keyword),
  );
}

function createLegacyTransactionId(row, index = 0) {
  const seed = [
    row.created_at,
    row.occurred_at,
    row.type,
    row.description,
    row.category,
    row.amount_idr,
    row.amount_thb,
    row.locked_rate,
    index,
  ]
    .map((part) => String(part ?? ""))
    .join("|");
  let hash = 0;
  for (let indexSeed = 0; indexSeed < seed.length; indexSeed += 1) {
    hash = (hash * 31 + seed.charCodeAt(indexSeed)) >>> 0;
  }
  return `legacy-${hash.toString(36)}-${index}`;
}

function normalizeTransaction(row, index = 0) {
  const baseCurrency = normalizeCurrencyCode(row.base_currency || row.baseCurrency);
  const normalized = {
    ...row,
    id: row.id || createLegacyTransactionId(row, index),
    type: ["income", "expense", "exchange"].includes(row.type)
      ? row.type
      : "expense",
    amount_idr: row.amount_idr == null ? null : Number(row.amount_idr),
    amount_thb: row.amount_thb == null ? null : Number(row.amount_thb),
    locked_rate: row.locked_rate == null ? null : Number(row.locked_rate),
    amount: row.amount == null ? null : Number(row.amount),
    base_amount: row.base_amount == null ? null : Number(row.base_amount),
    base_currency: baseCurrency,
    currency: row.currency ? normalizeCurrencyCode(row.currency) : null,
    from_currency: row.from_currency
      ? normalizeCurrencyCode(row.from_currency)
      : row.fromCurrency
        ? normalizeCurrencyCode(row.fromCurrency)
        : null,
    to_currency: row.to_currency
      ? normalizeCurrencyCode(row.to_currency)
      : row.toCurrency
        ? normalizeCurrencyCode(row.toCurrency)
        : null,
    from_amount:
      row.from_amount == null && row.fromAmount == null
        ? null
        : Number(row.from_amount ?? row.fromAmount),
    to_amount:
      row.to_amount == null && row.toAmount == null
        ? null
        : Number(row.to_amount ?? row.toAmount),
    rate: row.rate == null ? null : Number(row.rate),
  };

  if (looksLikeLegacyExchange(normalized)) {
    normalized.type = "exchange";
  }

  if (normalized.type === "exchange") {
    const amountIdr = Math.abs(Number(normalized.amount_idr || 0));
    const amountThb = Number(normalized.amount_thb || 0);
    const isLegacySell = amountThb < 0 && amountIdr > 0;
    const inferredFromCurrency =
      normalized.from_currency || (isLegacySell ? "THB" : "IDR");
    const inferredToCurrency =
      normalized.to_currency || (isLegacySell ? "IDR" : "THB");
    const inferredFromAmount =
      Number(normalized.from_amount || 0) > 0
        ? Math.abs(Number(normalized.from_amount))
        : inferredFromCurrency === "IDR"
          ? amountIdr
          : Math.abs(amountThb);
    const inferredToAmount =
      Number(normalized.to_amount || 0) > 0
        ? Math.abs(Number(normalized.to_amount))
        : inferredToCurrency === "IDR"
          ? amountIdr
          : Math.abs(amountThb);
    const inferredRate =
      Number(normalized.rate || normalized.locked_rate || 0) > 0
        ? Number(normalized.rate || normalized.locked_rate)
        : inferredFromAmount > 0 && inferredToAmount > 0
          ? inferredFromAmount / inferredToAmount
          : null;

    const exchange = {
      ...normalized,
      category: null,
      category_group: null,
      from_currency: normalizeCurrencyCode(inferredFromCurrency),
      to_currency: normalizeCurrencyCode(inferredToCurrency, "THB"),
      from_amount: inferredFromAmount,
      to_amount: inferredToAmount,
      rate: inferredRate,
      locked_rate: inferredRate,
      currency: null,
      amount: null,
      base_amount:
        normalizeCurrencyCode(inferredFromCurrency) === baseCurrency
          ? inferredFromAmount
          : normalizeCurrencyCode(inferredToCurrency) === baseCurrency
            ? inferredToAmount
            : null,
    };

    return {
      ...exchange,
      fromCurrency: exchange.from_currency,
      toCurrency: exchange.to_currency,
      fromAmount: exchange.from_amount,
      toAmount: exchange.to_amount,
      createdAt: exchange.created_at,
      updatedAt: exchange.updated_at,
    };
  }

  const inferredCurrency =
    normalized.currency ||
    (Number(normalized.amount_thb || 0) > 0 ? "THB" : baseCurrency);
  const currency = normalizeCurrencyCode(inferredCurrency);
  const inferredAmount =
    Number(normalized.amount || 0) > 0
      ? Number(normalized.amount)
      : currency === "THB"
        ? Number(normalized.amount_thb || 0)
        : Number(normalized.amount_idr || 0);
  const inferredRate =
    Number(normalized.rate || normalized.locked_rate || 0) > 0
      ? Number(normalized.rate || normalized.locked_rate)
      : null;
  const inferredBaseAmount =
    Number(normalized.base_amount || 0) > 0
      ? Number(normalized.base_amount)
      : Number(normalized.amount_idr || 0) > 0
        ? Number(normalized.amount_idr)
        : currency === baseCurrency
          ? inferredAmount
          : inferredAmount > 0 && inferredRate > 0
            ? inferredAmount * inferredRate
            : null;

  return {
    ...normalized,
    currency,
    amount: inferredAmount,
    base_amount: inferredBaseAmount,
    rate: inferredRate,
    locked_rate: inferredRate,
  };
}

function normalizeTransactions(rows) {
  return rows.map((row, index) => normalizeTransaction(row, index));
}

function normalizeBudget(row) {
  const currency = normalizeCurrencyCode(row.currency || (row.limit_thb != null ? "THB" : getBaseCurrency()));
  const limitAmount = Number(row.limit_amount ?? row.limitAmount ?? row.limit_thb ?? 0);
  return {
    ...row,
    group_key: row.group_key || UNIVERSAL_BUDGET_GROUP,
    currency,
    limit_amount: limitAmount,
    limitAmount,
    limit_thb: Number(row.limit_thb ?? (currency === "THB" ? limitAmount : 0) ?? 0),
  };
}

function createLegacyGoalId(row, index = 0) {
  const seed = [
    row.created_at,
    row.name,
    row.target_amount_idr,
    row.saved_amount_idr,
    row.deadline,
    index,
  ]
    .map((part) => String(part ?? ""))
    .join("|");
  let hash = 0;
  for (let indexSeed = 0; indexSeed < seed.length; indexSeed += 1) {
    hash = (hash * 31 + seed.charCodeAt(indexSeed)) >>> 0;
  }
  return `legacy-goal-${hash.toString(36)}-${index}`;
}

function normalizeGoal(row, index = 0) {
  return {
    ...row,
    id: row.id || createLegacyGoalId(row, index),
    target_amount_idr: Number(row.target_amount_idr || 0),
    saved_amount_idr: Number(row.saved_amount_idr || 0),
  };
}

function orderTransactions(rows) {
  return [...rows].sort((a, b) => {
    const timeDiff =
      new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime();
    if (timeDiff !== 0) return timeDiff;
    return (
      new Date(a.created_at || a.occurred_at).getTime() -
      new Date(b.created_at || b.occurred_at).getTime()
    );
  });
}

function getLockedExchange(transactions, occurredAt) {
  const target = new Date(occurredAt).getTime();
  return orderTransactions(transactions)
    .filter(
      (item) =>
        item.type === "exchange" &&
        (item.to_currency === "THB" || item.from_currency === "THB" || Number(item.amount_thb || 0) !== 0) &&
        Number(item.rate || item.locked_rate || 0) > 0 &&
        new Date(item.occurred_at).getTime() <= target,
    )
    .at(-1);
}

function getExchangeRateToBase(transaction, currency, baseCurrency = getBaseCurrency()) {
  if (!transaction || transaction.type !== "exchange") return null;
  const code = normalizeCurrencyCode(currency);
  const base = normalizeCurrencyCode(baseCurrency);
  const fromCurrency = normalizeCurrencyCode(transaction.from_currency);
  const toCurrency = normalizeCurrencyCode(transaction.to_currency);
  const fromAmount = Number(transaction.from_amount || 0);
  const toAmount = Number(transaction.to_amount || 0);

  if (fromAmount <= 0 || toAmount <= 0) return null;
  if (fromCurrency === base && toCurrency === code) return fromAmount / toAmount;
  if (fromCurrency === code && toCurrency === base) return toAmount / fromAmount;
  return null;
}

function getLatestRateForCurrencyUntil(
  transactions,
  currency,
  endDate,
  baseCurrency = getBaseCurrency(),
) {
  const code = normalizeCurrencyCode(currency);
  const base = normalizeCurrencyCode(baseCurrency);
  if (code === base) return 1;
  const endTime = new Date(endDate).getTime();
  const exchange = orderTransactions(transactions)
    .filter(
      (item) =>
        item.type === "exchange" &&
        new Date(item.occurred_at).getTime() <= endTime &&
        getExchangeRateToBase(item, code, base) != null,
    )
    .at(-1);
  return getExchangeRateToBase(exchange, code, base) || 0;
}

function getLatestExchangeForCurrencyUntil(
  transactions,
  currency,
  endDate,
  baseCurrency = getBaseCurrency(),
) {
  const code = normalizeCurrencyCode(currency);
  const base = normalizeCurrencyCode(baseCurrency);
  if (code === base) return null;
  const endTime = new Date(endDate).getTime();

  return (
    orderTransactions(transactions)
      .filter(
        (item) =>
          item.type === "exchange" &&
          new Date(item.occurred_at).getTime() <= endTime &&
          getExchangeRateToBase(item, code, base) != null,
      )
      .at(-1) || null
  );
}

function resolveTransactionBaseValue(transaction, fallbackRate = 0) {
  const baseCurrency = normalizeCurrencyCode(transaction.base_currency);
  const currency = normalizeCurrencyCode(transaction.currency, baseCurrency);
  const amount = Math.abs(Number(transaction.amount || 0));
  const baseAmount = Math.abs(Number(transaction.base_amount || 0));
  const legacyAmountIdr = Math.abs(Number(transaction.amount_idr || 0));
  const rate = Number(transaction.rate || transaction.locked_rate || fallbackRate || 0);

  if (baseAmount > 0) return baseAmount;
  if (legacyAmountIdr > 0) return legacyAmountIdr;
  if (currency === baseCurrency) return amount;
  return amount > 0 && rate > 0 ? amount * rate : 0;
}

function getTransactionAmountValue(transaction) {
  const amount = Math.abs(Number(transaction.amount || 0));
  if (amount > 0) return amount;
  const currency = getTransactionCurrency(transaction);
  if (currency === "THB") return Math.abs(Number(transaction.amount_thb || 0));
  return Math.abs(Number(transaction.amount_idr || 0));
}

function getExchangeBaseVolume(transaction, fallbackRate = 0) {
  if (transaction.type !== "exchange") return 0;
  const baseCurrency = normalizeCurrencyCode(transaction.base_currency);
  const fromCurrency = normalizeCurrencyCode(transaction.from_currency);
  const toCurrency = normalizeCurrencyCode(transaction.to_currency);
  const fromAmount = Math.abs(Number(transaction.from_amount || 0));
  const toAmount = Math.abs(Number(transaction.to_amount || 0));
  const rate = Number(transaction.rate || transaction.locked_rate || fallbackRate || 0);

  if (fromCurrency === baseCurrency) return fromAmount;
  if (toCurrency === baseCurrency) return toAmount;
  return fromAmount > 0 && rate > 0 ? fromAmount * rate : 0;
}

function computeCurrencyBalances(transactions) {
  const balances = Object.fromEntries(getActiveCurrencies().map((code) => [code, 0]));

  function add(currency, amount) {
    const code = normalizeCurrencyCode(currency);
    balances[code] = Number(balances[code] || 0) + Number(amount || 0);
  }

  orderTransactions(transactions).forEach((item) => {
    if (item.type === "exchange") {
      add(item.from_currency, -Math.abs(Number(item.from_amount || 0)));
      add(item.to_currency, Math.abs(Number(item.to_amount || 0)));
      return;
    }

    const currency = getTransactionCurrency(item);
    const amount = getTransactionAmountValue(item);
    add(currency, item.type === "expense" ? -amount : amount);
  });

  return balances;
}

function buildExpenseChart(transactions, monthKey) {
  const now = new Date();
  const [year, month] = String(monthKey).split("-");
  const monthDate = new Date(Number(year), Number(month) - 1, 1);
  const isCurrentMonth = monthKey === getMonthKey(now);
  const lastDay = isCurrentMonth
    ? now.getDate()
    : new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();

  const days = [];
  for (let day = 1; day <= lastDay; day += 1) {
    const cursor = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
    days.push({
      key: getLocalDayKey(cursor),
      label: String(day).padStart(2, "0"),
      tooltipLabel: formatDay(cursor),
      value: 0,
    });
  }

  const map = new Map(days.map((item) => [item.key, item]));

  transactions
    .filter(
      (item) =>
        item.type === "expense" &&
        getTransactionCurrency(item) === "THB" &&
        getMonthKey(item.occurred_at) === monthKey,
    )
    .forEach((item) => {
      const dayKey = getLocalDayKey(item.occurred_at);
      const bucket = map.get(dayKey);
      if (bucket) {
        bucket.value += getTransactionAmountValue(item);
      }
    });

  return days;
}

function buildOverviewDailyExpenses(transactions, monthKey) {
  const now = new Date();
  const [year, month] = String(monthKey).split("-").map(Number);
  const monthDate = new Date(year, month - 1, 1);
  const isCurrentMonth = monthKey === getMonthKey(now);
  const lastDay = isCurrentMonth
    ? now.getDate()
    : new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();

  const days = [];
  for (let day = 1; day <= lastDay; day += 1) {
    const cursor = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
    days.push({
      key: getLocalDayKey(cursor),
      label: String(day).padStart(2, "0"),
      tooltipLabel: formatDay(cursor),
      valueIdr: 0,
      valueThb: 0,
    });
  }

  const map = new Map(days.map((item) => [item.key, item]));

  transactions
    .filter(
      (item) =>
        item.type === "expense" && getMonthKey(item.occurred_at) === monthKey,
    )
    .forEach((item) => {
      const bucket = map.get(getLocalDayKey(item.occurred_at));
      if (!bucket) return;

      bucket.valueIdr += resolveTransactionBaseValue(item);
      bucket.valueThb += getTransactionCurrency(item) === "THB" ? getTransactionAmountValue(item) : 0;
    });

  return days;
}

function computeBudgetInsights(monthlyExpenses, budgets, monthKey) {
  const now = new Date();
  const [year, month] = String(monthKey).split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const isCurrentMonth = monthKey === getMonthKey(now);
  const currentDay = isCurrentMonth ? now.getDate() : daysInMonth;
  const todayDate = new Date(year, month - 1, currentDay);
  const todayKey = getLocalDayKey(todayDate);

  const remainingDaysIncludingToday = Math.max(daysInMonth - currentDay + 1, 1);
  const remainingDaysAfterToday = Math.max(remainingDaysIncludingToday - 1, 0);

  const statusOrder = {
    over: 0,
    warning: 1,
    healthy: 2,
  };

  return budgets
    .filter(
      (item) =>
        item.month_key === monthKey &&
        (item.group_key || UNIVERSAL_BUDGET_GROUP) === UNIVERSAL_BUDGET_GROUP,
    )
    .map(normalizeBudget)
    .map((budget) => {
      const currency = normalizeCurrencyCode(budget.currency);
      const currencyExpenses = monthlyExpenses.filter(
        (item) => getTransactionCurrency(item) === currency,
      );
      const spentAmount = currencyExpenses.reduce(
        (sum, item) => sum + getTransactionAmountValue(item),
        0,
      );
      let spentBeforeToday = 0;
      let spentToday = 0;
      currencyExpenses.forEach((item) => {
        const amount = getTransactionAmountValue(item);
        const dayKey = getLocalDayKey(item.occurred_at);
        if (dayKey < todayKey) {
          spentBeforeToday += amount;
          return;
        }
        if (dayKey === todayKey) {
          spentToday += amount;
        }
      });

      const limitAmount = Number(budget.limit_amount || budget.limitAmount || 0);
      const remainingAmount = limitAmount - spentAmount;
      const usage = limitAmount > 0 ? spentAmount / limitAmount : 0;
      const baselineDailyLimit = daysInMonth > 0 ? limitAmount / daysInMonth : 0;
      const dynamicDailyLimit =
        remainingDaysIncludingToday > 0
          ? Math.max((limitAmount - spentBeforeToday) / remainingDaysIncludingToday, 0)
          : 0;
      const todayRemainingSafe = dynamicDailyLimit - spentToday;
      const projectedNextDailyLimit =
        remainingDaysAfterToday > 0
          ? Math.max((limitAmount - spentBeforeToday - spentToday) / remainingDaysAfterToday, 0)
          : 0;
      const dailyAdjustment = dynamicDailyLimit - baselineDailyLimit;

      let status = "healthy";
      let statusLabel = "Aman";
      let tone =
        "border-emerald-300/20 bg-emerald-400/10 text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200";
      let barClass = "from-emerald-400 to-emerald-500";

      if (usage > 1) {
        status = "over";
        statusLabel = "Lewat Budget Bulanan";
        tone =
          "border-rose-300/20 bg-rose-400/10 text-rose-900 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200";
        barClass = "from-rose-400 to-rose-500";
      } else if (todayRemainingSafe < 0) {
        status = "warning";
        statusLabel = "Over Batas Harian";
        tone =
          "border-rose-300/20 bg-rose-400/10 text-rose-900 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200";
        barClass = "from-rose-400 to-rose-500";
      } else if (usage >= 0.85) {
        status = "warning";
        statusLabel = "Mendekati Limit";
        tone =
          "border-amber-300/20 bg-amber-400/10 text-amber-900 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200";
        barClass = "from-amber-300 to-orange-500";
      }

      return {
        ...budget,
        group_key: UNIVERSAL_BUDGET_GROUP,
        currency,
        limitAmount,
        spentAmount,
        remainingAmount,
        usage,
        daysInMonth,
        currentDay,
        remainingDaysIncludingToday,
        remainingDaysAfterToday,
        spentBeforeToday,
        spentToday,
        baselineDailyLimit,
        dynamicDailyLimit,
        todayRemainingSafe,
        projectedNextDailyLimit,
        dailyAdjustment,
        spentThb: currency === "THB" ? spentAmount : 0,
        remainingThb: currency === "THB" ? remainingAmount : 0,
        spentTodayThb: currency === "THB" ? spentToday : 0,
        dynamicDailyLimitThb: currency === "THB" ? dynamicDailyLimit : 0,
        todayRemainingSafeThb: currency === "THB" ? todayRemainingSafe : 0,
        projectedNextDailyLimitThb: currency === "THB" ? projectedNextDailyLimit : 0,
        dailyAdjustmentThb: currency === "THB" ? dailyAdjustment : 0,
        status,
        statusLabel,
        tone,
        barClass,
        meta: {
          label: `Budget ${currency}`,
          chip: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
        },
      };
    })
    .sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
}

function computeGoalInsights(goals) {
  return [...goals]
    .map((goal) => {
      const targetAmount = Number(goal.target_amount_idr || 0);
      const savedAmount = Number(goal.saved_amount_idr || 0);
      const remainingIdr = Math.max(targetAmount - savedAmount, 0);
      const progress = targetAmount > 0 ? Math.min(savedAmount / targetAmount, 1) : 0;
      const daysLeft =
        goal.deadline && String(goal.deadline).trim()
          ? Math.ceil(
              (new Date(`${goal.deadline}T00:00:00`).getTime() - Date.now()) /
                86400000,
            )
          : null;

      let status = "steady";
      let statusLabel = "Bertumbuh";
      let tone =
        "border-sky-300/20 bg-sky-400/10 text-sky-900 dark:border-sky-400/20 dark:bg-sky-500/10 dark:text-sky-200";
      let barClass = "from-sky-300 to-indigo-500";

      if (progress >= 1) {
        status = "done";
        statusLabel = "Target Tercapai";
        tone =
          "border-emerald-300/20 bg-emerald-400/10 text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200";
        barClass = "from-emerald-400 to-emerald-500";
      } else if (daysLeft != null && daysLeft < 0) {
        status = "overdue";
        statusLabel = "Deadline Lewat";
        tone =
          "border-rose-300/20 bg-rose-400/10 text-rose-900 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200";
        barClass = "from-rose-400 to-rose-500";
      } else if (daysLeft != null && daysLeft <= 14) {
        status = "soon";
        statusLabel = "Perlu Didorong";
        tone =
          "border-amber-300/20 bg-amber-400/10 text-amber-900 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200";
        barClass = "from-amber-300 to-orange-500";
      } else if (progress >= 0.75) {
        status = "strong";
        statusLabel = "On Track";
        tone =
          "border-emerald-300/20 bg-emerald-400/10 text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200";
        barClass = "from-emerald-400 to-sky-500";
      }

      return {
        ...goal,
        targetAmount,
        savedAmount,
        remainingIdr,
        progress,
        daysLeft,
        status,
        statusLabel,
        tone,
        barClass,
      };
    })
    .sort((a, b) => {
      if (a.status === "done" && b.status !== "done") return 1;
      if (a.status !== "done" && b.status === "done") return -1;
      if (a.daysLeft != null && b.daysLeft != null) return a.daysLeft - b.daysLeft;
      if (a.daysLeft != null) return -1;
      if (b.daysLeft != null) return 1;
      return a.progress - b.progress;
    });
}

function computeMetrics(transactions, budgets, goals) {
  const ordered = orderTransactions(transactions);
  const currentMonthKey = getMonthKey(new Date());
  const currentMonthTransactions = ordered.filter(
    (item) => getMonthKey(item.occurred_at) === currentMonthKey,
  );
  const currentMonthExpenses = currentMonthTransactions.filter(
    (item) => item.type === "expense",
  );
  const thbExpenses = ordered.filter(
    (item) =>
      item.type === "expense" &&
      getTransactionCurrency(item) === "THB" &&
      getMonthKey(item.occurred_at) === currentMonthKey,
  );

  const currencyBalances = computeCurrencyBalances(ordered);
  const activeCurrencies = getActiveCurrencies();
  const resolveIdrValue = (item) => {
    const fallbackRate = getLatestRateForCurrencyUntil(
      ordered,
      getTransactionCurrency(item),
      new Date(item.occurred_at || Date.now()),
    );
    return resolveTransactionBaseValue(item, fallbackRate);
  };
  const incomeIdr = ordered
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + resolveIdrValue(item), 0);
  const receivedThb = Number(currencyBalances.THB || 0);
  const spentThb = ordered
    .filter((item) => item.type === "expense" && getTransactionCurrency(item) === "THB")
    .reduce((sum, item) => sum + getTransactionAmountValue(item), 0);
  const monthlyDirectSpentIdr = ordered
    .filter(
      (item) =>
        item.type === "expense" &&
        getTransactionCurrency(item) === DEFAULT_BASE_CURRENCY &&
        getMonthKey(item.occurred_at) === currentMonthKey,
    )
    .reduce((sum, item) => sum + resolveIdrValue(item), 0);
  const directSpentIdr = ordered
    .filter(
      (item) =>
        item.type === "expense" &&
        getTransactionCurrency(item) === DEFAULT_BASE_CURRENCY,
    )
    .reduce((sum, item) => sum + resolveIdrValue(item), 0);
  const spentIdr = ordered
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + resolveIdrValue(item), 0);

  const categoryAccumulator = {};

  currentMonthExpenses.forEach((item) => {
    const categoryName = item.category || "Lainnya";
    if (!categoryAccumulator[categoryName]) {
      categoryAccumulator[categoryName] = {
        valueThb: 0,
        valueIdr: 0,
        count: 0,
      };
    }
    const bucket = categoryAccumulator[categoryName];
    bucket.valueThb += getTransactionCurrency(item) === "THB" ? getTransactionAmountValue(item) : 0;
    bucket.valueIdr += resolveIdrValue(item);
    bucket.count += 1;
  });

  const monthlyThb = thbExpenses.reduce(
    (sum, item) => sum + getTransactionAmountValue(item),
    0,
  );
  const monthlyExpenseByCurrency = Object.fromEntries(
    activeCurrencies.map((currency) => [currency, 0]),
  );
  const monthlyExpenseBaseByCurrency = Object.fromEntries(
    activeCurrencies.map((currency) => [currency, 0]),
  );
  currentMonthExpenses.forEach((item) => {
    const currency = getTransactionCurrency(item);
    const amount = getTransactionAmountValue(item);
    monthlyExpenseByCurrency[currency] =
      Number(monthlyExpenseByCurrency[currency] || 0) + amount;
    monthlyExpenseBaseByCurrency[currency] =
      Number(monthlyExpenseBaseByCurrency[currency] || 0) + resolveIdrValue(item);
  });
  const unvaluedForeignExpenseCount = currentMonthExpenses.filter((item) => {
    const currency = getTransactionCurrency(item);
    return currency !== DEFAULT_BASE_CURRENCY && resolveIdrValue(item) <= 0;
  }).length;
  const monthlyCategoryIdr = Object.values(categoryAccumulator).reduce(
    (sum, data) => sum + Number(data.valueIdr || 0),
    0,
  );

  const categoryBreakdown = Object.entries(categoryAccumulator)
    .map(([category, data]) => ({
      key: category,
      label: getCategoryMeta(category).label,
      valueThb: data.valueThb,
      valueIdr: data.valueIdr,
      count: data.count,
      share:
        monthlyCategoryIdr > 0
          ? data.valueIdr / monthlyCategoryIdr
          : monthlyThb > 0
            ? data.valueThb / monthlyThb
            : 0,
      meta: getCategoryMeta(category),
    }))
    .sort((a, b) => b.valueIdr - a.valueIdr || b.valueThb - a.valueThb);

  const budgetInsights = computeBudgetInsights(currentMonthExpenses, budgets, currentMonthKey);
  const overspentCount = budgetInsights.filter((item) => item.status === "over").length;
  const warningCount = budgetInsights.filter((item) => item.status === "warning").length;
  const budgetInsightsBase = budgetInsights.map((item) => {
    const rate = getLatestRateForCurrencyUntil(
      ordered,
      item.currency,
      new Date(8640000000000000),
    );
    return {
      limitBase:
        item.currency === DEFAULT_BASE_CURRENCY
          ? item.limitAmount
          : rate > 0
            ? item.limitAmount * rate
            : 0,
      spentBase:
        item.currency === DEFAULT_BASE_CURRENCY
          ? item.spentAmount
          : rate > 0
            ? item.spentAmount * rate
            : 0,
    };
  });
  const budgetLimitTotal = budgetInsightsBase.reduce(
    (sum, item) => sum + Number(item.limitBase || 0),
    0,
  );
  const budgetSpentTotal = budgetInsightsBase.reduce(
    (sum, item) => sum + Number(item.spentBase || 0),
    0,
  );
  const budgetUsageTotal =
    budgetLimitTotal > 0 ? budgetSpentTotal / budgetLimitTotal : 0;

  const goalInsights = computeGoalInsights(goals);
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
    goalInsights.find((item) => item.status !== "done") || goalInsights[0] || null;
  const balanceIdrBase = Number(currencyBalances.IDR || 0);
  const allocatedToGoalsIdr = totalGoalSaved;
  const availableBalanceIdr = balanceIdrBase - allocatedToGoalsIdr;

  const activeExchange =
    [...ordered].reverse().find((item) => item.type === "exchange") || null;
  const latestRate = getLatestRateForCurrencyUntil(
    ordered,
    "THB",
    new Date(8640000000000000),
  );
  const balanceThb = Number(currencyBalances.THB || 0);
  const balanceThbValuationIdr =
    latestRate > 0 ? balanceThb * latestRate : null;
  const netWorthBeforeGoalsIdr = Object.entries(currencyBalances).reduce(
    (sum, [currency, balance]) => {
      if (currency === DEFAULT_BASE_CURRENCY) return sum + Number(balance || 0);
      const rate = getLatestRateForCurrencyUntil(
        ordered,
        currency,
        new Date(8640000000000000),
      );
      return sum + (rate > 0 ? Number(balance || 0) * rate : 0);
    },
    0,
  );
  const netWorthIdr = netWorthBeforeGoalsIdr - allocatedToGoalsIdr;
  const foreignBalanceItems = activeCurrencies
    .filter((currency) => currency !== DEFAULT_BASE_CURRENCY)
    .map((currency) => {
      const balance = Number(currencyBalances[currency] || 0);
      const rate = getLatestRateForCurrencyUntil(
        ordered,
        currency,
        new Date(8640000000000000),
      );
      return {
        currency,
        balance,
        rate,
        valuationIdr: rate > 0 ? balance * rate : null,
      };
    });
  const foreignBalanceValuationIdr = foreignBalanceItems.reduce(
    (sum, item) => sum + Number(item.valuationIdr || 0),
    0,
  );
  const monthlyIncomeIdr = currentMonthTransactions
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + resolveIdrValue(item), 0);
  const monthlyExpenseIdr = currentMonthTransactions
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + resolveIdrValue(item), 0);
  const monthlyExternalIncomeIdr = currentMonthTransactions
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + resolveIdrValue(item), 0);
  const monthlyNetChangeIdr = monthlyExternalIncomeIdr - monthlyExpenseIdr;
  const overviewDailyExpenses = buildOverviewDailyExpenses(
    ordered,
    currentMonthKey,
  );
  const currentDay = new Date().getDate();
  const averageDailyExpenseIdr =
    currentDay > 0 ? monthlyExpenseIdr / currentDay : 0;
  const topExpenseCategory = categoryBreakdown[0] || null;
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
      ? "Belum ada budget"
      : budgetStatus === "over"
        ? "Melewati batas"
        : budgetStatus === "warning"
          ? "Hati-hati"
          : "Aman";

  return {
    currentMonthKey,
    currentMonthLabel: formatMonthKey(currentMonthKey),
    balanceIdr: availableBalanceIdr,
    balanceIdrBase,
    allocatedToGoalsIdr,
    balanceThb,
    balanceThbValuationIdr,
    foreignBalanceItems,
    foreignBalanceValuationIdr,
    currencyBalances,
    netWorthIdr,
    latestRate,
    directSpentIdr,
    monthlyDirectSpentIdr,
    monthlyIncomeIdr,
    monthlyExpenseIdr,
    monthlyExternalIncomeIdr,
    monthlyNetChangeIdr,
    spentIdr,
    spentThb,
    monthlyThb,
    monthlyExpenseByCurrency,
    monthlyExpenseBaseByCurrency,
    unvaluedForeignExpenseCount,
    activeCurrencies,
    activeExchange,
    recent: [...ordered].reverse().slice(0, 10),
    chart: buildExpenseChart(ordered, currentMonthKey),
    categoryBreakdown,
    budgetInsights,
    overspentCount,
    warningCount,
    budgetLimitTotal,
    budgetSpentTotal,
    budgetRemainingThb,
    budgetUsageTotal,
    budgetStatus,
    budgetStatusLabel,
    overviewDailyExpenses,
    averageDailyExpenseIdr,
    topExpenseCategory,
    goalInsights,
    totalGoalTarget,
    totalGoalSaved,
    goalProgressTotal,
    nextGoal,
  };
}

const DEFAULT_TRANSACTION_FILTERS = {
  startDate: "",
  endDate: "",
  type: "all",
  category: "all",
  currency: "all",
  minAmount: "",
  maxAmount: "",
  search: "",
  sortBy: "newest",
};

const HISTORY_SORT_OPTIONS = [
  { value: "newest", label: "Terbaru" },
  { value: "oldest", label: "Terlama" },
  { value: "largest", label: "Nominal terbesar" },
  { value: "smallest", label: "Nominal terkecil" },
];

const HISTORY_TYPE_OPTIONS = [
  { value: "all", label: "Semua tipe" },
  { value: "income", label: "Uang masuk" },
  { value: "expense", label: "Uang keluar" },
  { value: "exchange", label: "Transfer / Exchange" },
];

function getHistoryCurrencyOptions(activeCurrencies = getActiveCurrencies()) {
  return [
    { value: "all", label: "Semua mata uang" },
    ...getCurrencyOptions(activeCurrencies),
  ];
}

const TRANSACTION_FILTER_TABS = [
  { value: "all", label: "Semua" },
  { value: "income", label: "Masuk" },
  { value: "expense", label: "Keluar" },
  { value: "exchange", label: "Exchange" },
];

function getTransactionPreview(transaction) {
  if (transaction.type === "income") {
    return formatCurrency(getTransactionAmountValue(transaction), getTransactionCurrency(transaction));
  }
  if (transaction.type === "exchange") {
    return `${formatCurrency(
      transaction.from_amount,
      transaction.from_currency,
    )} -> ${formatCurrency(transaction.to_amount, transaction.to_currency)}`;
  }
  return formatCurrency(getTransactionAmountValue(transaction), getTransactionCurrency(transaction));
}

function getTransactionFlow(transaction) {
  if (transaction.type === "exchange") return "exchange";
  return transaction.type === "expense" ? "expense" : "income";
}

function getTransactionTypeLabel(transaction) {
  const flow = getTransactionFlow(transaction);
  if (flow === "exchange") return "Tukar Mata Uang";
  return flow === "income" ? "Uang masuk" : "Uang keluar";
}

function getTransactionCurrency(transaction) {
  if (transaction.type === "exchange") {
    return normalizeCurrencyCode(transaction.from_currency);
  }
  return normalizeCurrencyCode(transaction.currency);
}

function getTransactionMainAmount(transaction) {
  return getTransactionAmountValue(transaction);
}

function getTransactionIdrValuation(transaction) {
  const valuation = resolveTransactionBaseValue(transaction);
  return valuation > 0 ? valuation : null;
}

function getTransactionIdrValuationWithRate(transaction, fallbackRate = 0) {
  const valuation = resolveTransactionBaseValue(transaction, fallbackRate);
  return valuation > 0 ? valuation : null;
}

function getTransactionComparableAmount(transaction) {
  return getTransactionIdrValuation(transaction) ?? getTransactionMainAmount(transaction);
}

function getExchangeTitle(transaction) {
  if (transaction.from_currency && transaction.to_currency) {
    return `${transaction.from_currency} ke ${transaction.to_currency}`;
  }
  return "Tukar Mata Uang";
}

function getExchangeVolumeIdr(transaction, fallbackRate = 0) {
  return getExchangeBaseVolume(transaction, fallbackRate);
}

function getTransactionCategoryKey(transaction) {
  if (transaction.category) return transaction.category;
  if (transaction.type === "expense") return "Lainnya";
  return transaction.type === "exchange" ? "exchange" : "income";
}

function getTransactionCategoryLabel(transaction) {
  if (transaction.category) return getCategoryMeta(transaction.category).label;
  if (transaction.type === "exchange") return "Transfer / Exchange";
  if (transaction.type === "income") return `Pemasukan ${getTransactionCurrency(transaction)}`;
  return "Lainnya";
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

function getHistoryCategoryOptions(transactions) {
  const knownCategories = new Set(CATEGORY_OPTIONS.map((item) => item.value));
  const extraCategories = [
    ...new Set(
      transactions
        .map((transaction) => transaction.category)
        .filter((category) => category && !knownCategories.has(category)),
    ),
  ].sort((a, b) => a.localeCompare(b, "id-ID"));

  return [
    { value: "all", label: "Semua kategori" },
    { value: "income", label: "Pemasukan" },
    { value: "exchange", label: "Transfer / Exchange" },
    ...CATEGORY_OPTIONS.map((category) => ({
      value: category.value,
      label: category.label,
    })),
    ...extraCategories.map((category) => ({
      value: category,
      label: category,
    })),
  ];
}

function getTransactionTimestamp(transaction) {
  const occurredAt = new Date(transaction.occurred_at).getTime();
  const createdAt = new Date(transaction.created_at || transaction.occurred_at).getTime();
  return {
    occurredAt: Number.isFinite(occurredAt) ? occurredAt : 0,
    createdAt: Number.isFinite(createdAt) ? createdAt : 0,
  };
}

function compareTransactionsByDate(a, b) {
  const aTime = getTransactionTimestamp(a);
  const bTime = getTransactionTimestamp(b);
  const occurredDiff = aTime.occurredAt - bTime.occurredAt;
  if (occurredDiff !== 0) return occurredDiff;
  return aTime.createdAt - bTime.createdAt;
}

function formatShortDateTime(value) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatShortTime(value) {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getTransactionGroupLabel(dayKey) {
  const todayKey = getLocalDayKey(new Date());
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayKey = getLocalDayKey(yesterdayDate);

  if (dayKey === todayKey) return "Hari Ini";
  if (dayKey === yesterdayKey) return "Kemarin";
  return formatLongDate(`${dayKey}T00:00:00`);
}

function groupTransactionsByDay(transactions) {
  const groups = [];
  const groupMap = new Map();

  transactions.forEach((transaction) => {
    const dayKey = getLocalDayKey(transaction.occurred_at);
    if (!groupMap.has(dayKey)) {
      const group = {
        key: dayKey,
        label: getTransactionGroupLabel(dayKey),
        transactions: [],
      };
      groupMap.set(dayKey, group);
      groups.push(group);
    }
    groupMap.get(dayKey).transactions.push(transaction);
  });

  return groups;
}

function hasActiveTransactionFilters(filters) {
  return Object.keys(DEFAULT_TRANSACTION_FILTERS).some(
    (key) => filters[key] !== DEFAULT_TRANSACTION_FILTERS[key],
  );
}

function filterAndSortTransactions(transactions, filters) {
  const normalizedSearch = filters.search.trim().toLowerCase();
  const minAmount = Number(normalizeNumericInput(filters.minAmount));
  const maxAmount = Number(normalizeNumericInput(filters.maxAmount));

  return transactions
    .filter((transaction) => {
      const dayKey = getLocalDayKey(transaction.occurred_at);
      const flow = getTransactionFlow(transaction);
      const categoryKey = getTransactionCategoryKey(transaction);
      const comparableAmount = getTransactionComparableAmount(transaction);
      const selectedCurrency = normalizeCurrencyCode(filters.currency, "all");
      const transactionCurrency = getTransactionCurrency(transaction);
      const exchangeFromCurrency = normalizeCurrencyCode(transaction.from_currency);
      const exchangeToCurrency = normalizeCurrencyCode(transaction.to_currency);
      const currencyMatches =
        filters.currency === "all" ||
        transactionCurrency === selectedCurrency ||
        (flow === "exchange" &&
          (exchangeFromCurrency === selectedCurrency ||
            exchangeToCurrency === selectedCurrency));
      const filterAmount =
        filters.currency !== "all"
          ? flow === "exchange" && exchangeFromCurrency === selectedCurrency
            ? Math.abs(Number(transaction.from_amount || 0))
            : flow === "exchange" && exchangeToCurrency === selectedCurrency
              ? Math.abs(Number(transaction.to_amount || 0))
              : transactionCurrency === selectedCurrency
                ? getTransactionAmountValue(transaction)
                : comparableAmount
          : comparableAmount;
      const description = String(transaction.description || "").toLowerCase();

      if (filters.startDate && dayKey < filters.startDate) return false;
      if (filters.endDate && dayKey > filters.endDate) return false;
      if (filters.type !== "all" && flow !== filters.type) return false;
      if (filters.category !== "all" && categoryKey !== filters.category) return false;
      if (!currencyMatches) return false;
      if (Number.isFinite(minAmount) && minAmount > 0 && filterAmount < minAmount) {
        return false;
      }
      if (Number.isFinite(maxAmount) && maxAmount > 0 && filterAmount > maxAmount) {
        return false;
      }
      if (normalizedSearch && !description.includes(normalizedSearch)) return false;

      return true;
    })
    .sort((a, b) => {
      if (filters.sortBy === "oldest") return compareTransactionsByDate(a, b);
      if (filters.sortBy === "largest") {
        return getTransactionComparableAmount(b) - getTransactionComparableAmount(a);
      }
      if (filters.sortBy === "smallest") {
        return getTransactionComparableAmount(a) - getTransactionComparableAmount(b);
      }
      return compareTransactionsByDate(b, a);
    });
}

function computeTransactionSummary(transactions, allTransactions = transactions) {
  const latestRate = getLatestRateUntil(
    allTransactions,
    new Date(8640000000000000),
  );

  return transactions.reduce(
    (summary, transaction) => {
      const valuation =
        resolveTransactionBaseValue(
          transaction,
          getLatestRateForCurrencyUntil(
            allTransactions,
            getTransactionCurrency(transaction),
            new Date(transaction.occurred_at || Date.now()),
          ) || (getTransactionCurrency(transaction) === "THB" ? latestRate : 0),
        ) || 0;
      if (transaction.type === "income") {
        summary.totalIncomeIdr += valuation;
      } else if (transaction.type === "expense") {
        summary.totalExpenseIdr += valuation;
      } else if (transaction.type === "exchange") {
        summary.totalExchangeIdr += getExchangeVolumeIdr(transaction, latestRate);
        summary.exchangeCount += 1;
      }
      summary.count += 1;
      summary.netIdr = summary.totalIncomeIdr - summary.totalExpenseIdr;
      return summary;
    },
    {
      totalIncomeIdr: 0,
      totalExpenseIdr: 0,
      totalExchangeIdr: 0,
      netIdr: 0,
      exchangeCount: 0,
      count: 0,
      fallbackRate: latestRate,
    },
  );
}

function getAvailableReportMonths(transactions, selectedMonthKey) {
  const months = new Set([selectedMonthKey, getMonthKey(new Date())]);
  transactions.forEach((transaction) => {
    if (transaction.occurred_at) {
      months.add(getMonthKey(transaction.occurred_at));
    }
  });

  return [...months].sort((a, b) => b.localeCompare(a));
}

function getLatestRateUntil(transactions, endDate) {
  return getLatestRateForCurrencyUntil(transactions, "THB", endDate);
}

function resolveReportValueIdr(transaction, rateSource = 0) {
  const fallbackRate = Array.isArray(rateSource)
    ? getLatestRateForCurrencyUntil(
        rateSource,
        getTransactionCurrency(transaction),
        new Date(transaction.occurred_at || Date.now()),
      )
    : Number(rateSource || 0);
  return resolveTransactionBaseValue(transaction, fallbackRate);
}

function addCurrencyTotal(target, currency, amount) {
  const code = normalizeCurrencyCode(currency);
  target[code] = Number(target[code] || 0) + Number(amount || 0);
}

function getReportExchangeVolumeIdr(transaction, transactions, fallbackRate = 0) {
  if (transaction.type !== "exchange") return 0;
  const rate =
    Number(fallbackRate || 0) ||
    getLatestRateForCurrencyUntil(
      transactions,
      normalizeCurrencyCode(transaction.from_currency),
      new Date(transaction.occurred_at || Date.now()),
    );
  return getExchangeVolumeIdr(transaction, rate);
}

function summarizeReportMonth(transactions, monthKey) {
  const monthTransactions = orderTransactions(transactions).filter(
    (item) => getMonthKey(item.occurred_at) === monthKey,
  );
  const baseCurrency = getBaseCurrency();

  return monthTransactions.reduce(
    (summary, transaction) => {
      const valueIdr = resolveReportValueIdr(transaction, transactions);
      const currency = getTransactionCurrency(transaction);
      const amount = getTransactionAmountValue(transaction);

      if (transaction.type === "income") {
        summary.externalIncomeIdr += valueIdr;
        addCurrencyTotal(summary.incomeByCurrency, currency, amount);
        if (currency !== baseCurrency && valueIdr <= 0) {
          summary.unvaluedIncomeCount += 1;
        }
      }

      if (transaction.type === "exchange") {
        const fromCurrency = normalizeCurrencyCode(transaction.from_currency);
        const toCurrency = normalizeCurrencyCode(transaction.to_currency);
        const fromAmount = Math.abs(Number(transaction.from_amount || 0));
        const toAmount = Math.abs(Number(transaction.to_amount || 0));
        const volumeIdr = getReportExchangeVolumeIdr(transaction, transactions);
        const pairKey = `${fromCurrency}->${toCurrency}`;

        addCurrencyTotal(summary.exchangeOutByCurrency, fromCurrency, fromAmount);
        addCurrencyTotal(summary.exchangeInByCurrency, toCurrency, toAmount);
        summary.exchangePairs[pairKey] = summary.exchangePairs[pairKey] || {
          key: pairKey,
          fromCurrency,
          toCurrency,
          fromAmount: 0,
          toAmount: 0,
          volumeIdr: 0,
          count: 0,
        };
        summary.exchangePairs[pairKey].fromAmount += fromAmount;
        summary.exchangePairs[pairKey].toAmount += toAmount;
        summary.exchangePairs[pairKey].volumeIdr += volumeIdr;
        summary.exchangePairs[pairKey].count += 1;
        summary.exchangeVolumeIdr += volumeIdr;
        summary.exchangeCount += 1;
        if (toCurrency !== baseCurrency) {
          addCurrencyTotal(summary.foreignReceivedByCurrency, toCurrency, toAmount);
          summary.foreignExchangeCostIdr += volumeIdr;
        }
        if (toCurrency === "THB") {
          summary.thbReceived += toAmount;
          summary.thbTopupCostIdr += volumeIdr;
        } else if (fromCurrency === "THB") {
          summary.thbReceived -= fromAmount;
        }
      }

      if (transaction.type === "expense") {
        summary.expenseIdr += valueIdr;
        addCurrencyTotal(summary.expenseByCurrency, currency, amount);
        if (currency === "THB") {
          summary.expenseThb += amount;
        }
        if (currency !== baseCurrency && valueIdr <= 0) {
          summary.unvaluedExpenseCount += 1;
        }
        if (currency !== baseCurrency) {
          summary.foreignExpenseValueIdr += valueIdr;
        } else {
          summary.directExpenseIdr += valueIdr;
        }
      }

      summary.count += 1;
      summary.netCashflowIdr = summary.externalIncomeIdr - summary.expenseIdr;
      return summary;
    },
    {
      monthKey,
      count: 0,
      externalIncomeIdr: 0,
      expenseIdr: 0,
      directExpenseIdr: 0,
      foreignExpenseValueIdr: 0,
      expenseThb: 0,
      thbReceived: 0,
      thbTopupCostIdr: 0,
      incomeByCurrency: {},
      expenseByCurrency: {},
      exchangeInByCurrency: {},
      exchangeOutByCurrency: {},
      exchangePairs: {},
      foreignReceivedByCurrency: {},
      foreignExchangeCostIdr: 0,
      exchangeVolumeIdr: 0,
      exchangeCount: 0,
      unvaluedIncomeCount: 0,
      unvaluedExpenseCount: 0,
      netCashflowIdr: 0,
    },
  );
}

function buildReportDailySeries(transactions, monthKey) {
  const meta = getMonthMeta(monthKey);
  const days = [];

  for (let day = 1; day <= meta.daysInMonth; day += 1) {
    const date = new Date(meta.year, meta.month - 1, day);
    days.push({
      key: getLocalDayKey(date),
      label: String(day).padStart(2, "0"),
      tooltipLabel: formatDay(date),
      incomeIdr: 0,
      expenseIdr: 0,
      netIdr: 0,
      transactionCount: 0,
    });
  }

  const map = new Map(days.map((item) => [item.key, item]));
  transactions
    .filter((transaction) => getMonthKey(transaction.occurred_at) === monthKey)
    .forEach((transaction) => {
      const bucket = map.get(getLocalDayKey(transaction.occurred_at));
      if (!bucket) return;

      const valueIdr = resolveReportValueIdr(transaction, transactions);
      const isIncome = transaction.type === "income";

      if (isIncome) bucket.incomeIdr += valueIdr;
      if (transaction.type === "expense") bucket.expenseIdr += valueIdr;
      bucket.netIdr = bucket.incomeIdr - bucket.expenseIdr;
      bucket.transactionCount += 1;
    });

  return days;
}

function buildMonthlyReport(transactions, budgets, selectedMonthKey) {
  const monthKey = selectedMonthKey || getMonthKey(new Date());
  const meta = getMonthMeta(monthKey);
  const previousMonthKey = shiftMonthKey(monthKey, -1);
  const fallbackRate = getLatestRateUntil(transactions, meta.end);
  const summary = summarizeReportMonth(transactions, monthKey);
  const previousSummary = summarizeReportMonth(
    transactions,
    previousMonthKey,
  );
  const monthTransactions = orderTransactions(transactions).filter(
    (item) => getMonthKey(item.occurred_at) === monthKey,
  );
  const expenseTransactions = monthTransactions.filter(
    (item) => item.type === "expense",
  );
  const dailySeries = buildReportDailySeries(transactions, monthKey);
  const categoryAccumulator = {};

  expenseTransactions.forEach((transaction) => {
    const category = transaction.category || "Lainnya";
    const valueIdr = resolveReportValueIdr(transaction, transactions);
    const currency = getTransactionCurrency(transaction);
    if (!categoryAccumulator[category]) {
      categoryAccumulator[category] = {
        valueIdr: 0,
        valueThb: 0,
        valueByCurrency: {},
        count: 0,
      };
    }

    categoryAccumulator[category].valueIdr += valueIdr;
    addCurrencyTotal(categoryAccumulator[category].valueByCurrency, currency, getTransactionAmountValue(transaction));
    categoryAccumulator[category].valueThb +=
      currency === "THB"
        ? getTransactionAmountValue(transaction)
        : 0;
    categoryAccumulator[category].count += 1;
  });

  const categoryBreakdown = Object.entries(categoryAccumulator)
    .map(([category, data]) => ({
      key: category,
      label: getCategoryMeta(category).label,
      meta: getCategoryMeta(category),
      valueIdr: data.valueIdr,
      valueThb: data.valueThb,
      valueByCurrency: data.valueByCurrency,
      count: data.count,
      share: summary.expenseIdr > 0 ? data.valueIdr / summary.expenseIdr : 0,
    }))
    .sort((a, b) => b.valueIdr - a.valueIdr);

  const budgetInsights = computeBudgetInsights(expenseTransactions, budgets, monthKey);
  const budgetBaseValues = budgetInsights.map((budget) => {
    const rate = getLatestRateForCurrencyUntil(transactions, budget.currency, meta.end);
    return {
      limitBase:
        budget.currency === getBaseCurrency()
          ? budget.limitAmount
          : rate > 0
            ? budget.limitAmount * rate
            : 0,
      spentBase:
        budget.currency === getBaseCurrency()
          ? budget.spentAmount
          : rate > 0
            ? budget.spentAmount * rate
            : 0,
    };
  });
  const budgetLimitBaseIdr = budgetBaseValues.reduce(
    (sum, item) => sum + Number(item.limitBase || 0),
    0,
  );
  const budgetSpentBaseIdr = budgetBaseValues.reduce(
    (sum, item) => sum + Number(item.spentBase || 0),
    0,
  );
  const budgetRemainingBaseIdr = budgetLimitBaseIdr - budgetSpentBaseIdr;
  const budgetUsage =
    budgetLimitBaseIdr > 0
      ? budgetSpentBaseIdr / budgetLimitBaseIdr
      : budgetInsights.length
        ? Math.max(...budgetInsights.map((budget) => budget.usage))
        : 0;
  const thbBudget = budgetInsights.find((budget) => budget.currency === "THB");
  const budgetLimitThb = Number(thbBudget?.limitAmount || 0);
  const budgetSpentThb = Number(thbBudget?.spentAmount || 0);
  const budgetRemainingThb = Number(thbBudget?.remainingAmount || 0);
  const budgetStatus =
    !budgetInsights.length
      ? "none"
      : budgetInsights.some((budget) => budget.status === "over")
        ? "over"
        : budgetInsights.some((budget) => budget.status === "warning")
          ? "warning"
          : "safe";
  const budgetStatusLabel =
    budgetStatus === "none"
      ? "Belum ada budget"
      : budgetStatus === "over"
        ? "Melewati batas"
        : budgetStatus === "warning"
          ? "Hati-hati"
          : "Aman";
  const dailyAverageExpenseIdr =
    meta.elapsedDays > 0 ? summary.expenseIdr / meta.elapsedDays : 0;
  const projectedExpenseIdr = meta.isCurrentMonth
    ? dailyAverageExpenseIdr * meta.daysInMonth
    : summary.expenseIdr;
  const savingsRatio =
    summary.externalIncomeIdr > 0
      ? summary.netCashflowIdr / summary.externalIncomeIdr
      : 0;
  const previousDeltaIdr =
    previousSummary.count > 0
      ? summary.netCashflowIdr - previousSummary.netCashflowIdr
      : null;
  const strongestDay = [...dailySeries].sort(
    (a, b) => b.expenseIdr - a.expenseIdr,
  )[0];
  const topCategory = categoryBreakdown[0] || null;
  const recentTransactions = [...monthTransactions].reverse().slice(0, 5);
  const reportCurrencies = normalizeCurrencyList([
    ...Object.keys(summary.incomeByCurrency),
    ...Object.keys(summary.expenseByCurrency),
    ...Object.keys(summary.exchangeInByCurrency),
    ...Object.keys(summary.exchangeOutByCurrency),
    ...budgets.map((budget) => normalizeBudget(budget).currency),
  ]);
  const currencyBreakdown = reportCurrencies.map((currency) => ({
    currency,
    income: Number(summary.incomeByCurrency[currency] || 0),
    expense: Number(summary.expenseByCurrency[currency] || 0),
    exchangeIn: Number(summary.exchangeInByCurrency[currency] || 0),
    exchangeOut: Number(summary.exchangeOutByCurrency[currency] || 0),
  }));

  return {
    monthKey,
    previousMonthKey,
    meta,
    fallbackRate,
    summary,
    previousSummary,
    previousDeltaIdr,
    dailySeries,
    categoryBreakdown,
    topCategory,
    strongestDay,
    recentTransactions,
    currencyBreakdown,
    exchangePairs: Object.values(summary.exchangePairs),
    budgetInsights,
    budgetLimitBaseIdr,
    budgetSpentBaseIdr,
    budgetRemainingBaseIdr,
    budgetLimitThb,
    budgetSpentThb,
    budgetUsage,
    budgetRemainingThb,
    budgetStatus,
    budgetStatusLabel,
    dailyAverageExpenseIdr,
    projectedExpenseIdr,
    savingsRatio,
    hasTransactions: monthTransactions.length > 0,
  };
}

function PremiumMeshBackground() {
  return html`
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <style>
        ${`
          @keyframes premium-float-a {
            0% { transform: translate3d(0, 0, 0) scale(1); opacity: 0.28; }
            33% { transform: translate3d(4rem, -2rem, 0) scale(1.06); opacity: 0.18; }
            66% { transform: translate3d(-2rem, 3rem, 0) scale(0.96); opacity: 0.24; }
            100% { transform: translate3d(3rem, 1rem, 0) scale(1.08); opacity: 0.2; }
          }
          @keyframes premium-float-b {
            0% { transform: translate3d(0, 0, 0) scale(1.02); opacity: 0.22; }
            30% { transform: translate3d(-3rem, 2rem, 0) scale(1.08); opacity: 0.18; }
            70% { transform: translate3d(2rem, -3rem, 0) scale(0.95); opacity: 0.25; }
            100% { transform: translate3d(-2rem, 3rem, 0) scale(1.04); opacity: 0.17; }
          }
          @keyframes premium-float-c {
            0% { transform: translate3d(0, 0, 0) scale(1); opacity: 0.18; }
            35% { transform: translate3d(3rem, 2rem, 0) scale(1.1); opacity: 0.14; }
            65% { transform: translate3d(-3rem, -2rem, 0) scale(0.92); opacity: 0.22; }
            100% { transform: translate3d(1rem, -1rem, 0) scale(1.06); opacity: 0.16; }
          }
          @keyframes premium-float-d {
            0% { transform: translate3d(0, 0, 0) scale(0.98); opacity: 0.18; }
            50% { transform: translate3d(-2rem, -3rem, 0) scale(1.08); opacity: 0.12; }
            100% { transform: translate3d(3rem, 1rem, 0) scale(1.02); opacity: 0.2; }
          }
        `}
      </style>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#f8fbff_0%,#eefbf6_44%,#edf6ff_100%)] dark:bg-[linear-gradient(180deg,#030712_0%,#071221_38%,#0f172a_100%)]"></div>
      <div className="absolute inset-x-0 top-0 h-[32rem] bg-[radial-gradient(circle_at_18%_10%,rgba(16,185,129,0.18),transparent_34%),radial-gradient(circle_at_84%_12%,rgba(56,189,248,0.14),transparent_30%),radial-gradient(circle_at_top,rgba(255,255,255,0.58),transparent_42%)] dark:bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.14),transparent_34%)]"></div>
      ${MESH_ORBS.map(
        (orb) => html`
          <div
            key=${orb.id}
            className=${`absolute rounded-full blur-[120px] motion-reduce:animate-none ${orb.className}`}
            style=${{ animation: orb.animation }}
          ></div>
        `,
      )}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.035)_1px,transparent_1px)] bg-[size:140px_140px] opacity-35 dark:bg-[linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] dark:opacity-[0.10]"></div>
      <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-white/60 to-transparent dark:from-slate-950/40"></div>
    </div>
  `;
}

function MetricCard({ title, value, helper, accent, glow = false }) {
  const accentClasses = {
    emerald: {
      halo: "from-emerald-200/50 via-emerald-400/25 to-transparent",
      shadow: "hover:shadow-[0_28px_80px_rgba(16,185,129,0.18)]",
      glow:
        "[text-shadow:0_0_18px_rgba(16,185,129,0.16)] dark:[text-shadow:0_0_24px_rgba(52,211,153,0.30)]",
    },
    sky: {
      halo: "from-indigo-200/45 via-indigo-400/22 to-transparent",
      shadow: "hover:shadow-[0_28px_80px_rgba(99,102,241,0.16)]",
      glow: "",
    },
    amber: {
      halo: "from-amber-200/45 via-orange-400/18 to-transparent",
      shadow: "hover:shadow-[0_28px_80px_rgba(245,158,11,0.16)]",
      glow: "",
    },
    slate: {
      halo: "from-sky-200/45 via-blue-500/18 to-transparent",
      shadow: "hover:shadow-[0_28px_80px_rgba(37,99,235,0.16)]",
      glow: "",
    },
  };

  return html`
    <div
      className=${`${PREMIUM_PANEL_SOFT} group p-5 md:p-6 transition duration-500 hover:-translate-y-1 hover:scale-[1.015] hover:border-white/20 ${accentClasses[accent].shadow}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.18),transparent_42%,rgba(255,255,255,0.04))] opacity-80"></div>
      <div className=${`pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-gradient-to-br ${accentClasses[accent].halo} blur-3xl transition duration-700 group-hover:scale-110`}></div>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-90"></div>
      <div className="relative">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-600 dark:text-slate-400">
          ${title}
        </p>
        <p
          className=${`mt-4 font-sans text-[2rem] font-black tracking-[-0.05em] text-slate-950 md:text-[2.35rem] dark:text-white ${glow ? accentClasses[accent].glow : ""}`}
        >
          ${value}
        </p>
        <p className="mt-3 max-w-[18rem] text-sm leading-6 text-slate-600 dark:text-slate-300/80">
          ${helper}
        </p>
      </div>
    </div>
  `;
}

function OverviewHero({ metrics }) {
  const changePositive = metrics.monthlyNetChangeIdr >= 0;
  const changeText = `${changePositive ? "+" : "-"}${formatCurrency(
    Math.abs(metrics.monthlyNetChangeIdr),
    "idr",
  )}`;

  return html`
    <section className=${`${PREMIUM_PANEL} p-5 md:p-6`}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.16),transparent_48%)] opacity-80"></div>
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-brand-400/18 blur-3xl dark:bg-brand-400/12"></div>
      <div className="relative grid gap-5 lg:grid-cols-[1.35fr_0.65fr] lg:items-end">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-600 dark:text-slate-400">
            Total kekayaan bersih
          </p>
          <h2 className="mt-3 break-words font-display text-4xl font-black text-slate-950 dark:text-white md:text-5xl">
            ${formatCurrency(metrics.netWorthIdr, "idr")}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-700 dark:text-slate-300">
            Gabungan saldo ${getBaseCurrency()} tersedia dan valuasi saldo mata uang aktif ke IDR.
            ${metrics.foreignBalanceItems?.length
              ? ` Valuasi mata uang asing saat ini ${formatCurrency(
                  metrics.foreignBalanceValuationIdr,
                  "idr",
                )}.`
              : " Mode satu mata uang aktif."}
          </p>
        </div>

        <div className="rounded-[24px] border border-brand-300/25 bg-brand-500/10 p-4 dark:border-brand-400/20 dark:bg-brand-500/10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-800 dark:text-brand-200">
            Perubahan bulan ini
          </p>
          <p className=${`mt-3 text-2xl font-black ${changePositive ? "text-brand-700 dark:text-brand-300" : "text-rose-700 dark:text-rose-300"}`}>
            ${changeText}
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
            Pemasukan eksternal dikurangi seluruh pengeluaran bulan berjalan.
          </p>
        </div>
      </div>
    </section>
  `;
}

function OverviewStatGrid({ metrics }) {
  const balanceStats = normalizeCurrencyList(metrics.activeCurrencies || getActiveCurrencies()).map(
    (currency) => {
      const balance =
        currency === DEFAULT_BASE_CURRENCY
          ? metrics.balanceIdr
          : Number(metrics.currencyBalances?.[currency] || 0);
      const foreignItem = metrics.foreignBalanceItems?.find(
        (item) => item.currency === currency,
      );
      return {
        title: `Saldo ${currency}`,
        value: formatCurrency(balance, currency),
        helper:
          currency === DEFAULT_BASE_CURRENCY
            ? "Tersedia"
            : foreignItem?.rate
              ? formatRate(foreignItem.rate, DEFAULT_BASE_CURRENCY, currency)
              : "Belum ada rate",
      };
    },
  );
  const spendingStats = normalizeCurrencyList(metrics.activeCurrencies || getActiveCurrencies())
    .filter((currency) => Number(metrics.monthlyExpenseByCurrency?.[currency] || 0) > 0)
    .map((currency) => ({
      title: `Belanja ${currency}`,
      value: formatCurrency(metrics.monthlyExpenseByCurrency[currency], currency),
      helper: "Bulan ini",
    }));
  const stats = [
    ...balanceStats,
    {
      title: "Pemasukan",
      value: formatCurrency(metrics.monthlyIncomeIdr, "idr"),
      helper: "Bulan ini",
    },
    {
      title: "Pengeluaran",
      value: formatCurrency(metrics.monthlyExpenseIdr, "idr"),
      helper: "Valuasi IDR",
    },
    ...spendingStats,
  ];

  return html`
    <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      ${stats.map(
        (item) => html`
          <div key=${item.title} className="cuan-card-soft rounded-[22px] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              ${item.title}
            </p>
            <p className="mt-2 break-words text-lg font-black text-slate-950 dark:text-white md:text-xl">
              ${item.value}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
              ${item.helper}
            </p>
          </div>
        `,
      )}
    </section>
  `;
}

function OverviewBudgetProgress({ metrics }) {
  const usage = metrics.budgetLimitTotal > 0 ? metrics.budgetUsageTotal : 0;
  const width = `${Math.min(Math.max(usage * 100, usage > 0 ? 8 : 0), 100)}%`;
  const barClass =
    metrics.budgetStatus === "over"
      ? "from-rose-500 to-rose-400"
      : metrics.budgetStatus === "warning"
        ? "from-amber-400 to-orange-500"
        : "from-brand-500 to-emerald-300";
  const chipClass =
    metrics.budgetStatus === "over"
      ? "border-rose-300/25 bg-rose-500/10 text-rose-700 dark:border-rose-400/20 dark:text-rose-200"
      : metrics.budgetStatus === "warning"
        ? "border-amber-300/25 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:text-amber-200"
        : "border-brand-300/25 bg-brand-500/10 text-brand-700 dark:border-brand-400/20 dark:text-brand-200";

  return html`
    <section className=${`${PREMIUM_PANEL} p-5 md:p-6`}>
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-bold text-slate-950 dark:text-white">
            Budget Bulanan
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Ringkasan semua budget aktif dalam valuasi IDR.
          </p>
        </div>
        <span className=${`rounded-full border px-3 py-1 text-xs font-semibold ${chipClass}`}>
          ${metrics.budgetStatusLabel}
        </span>
      </div>

      <div className="relative mt-5 grid grid-cols-3 gap-3">
        ${[
          ["Budget", formatCurrency(metrics.budgetLimitTotal, "idr")],
          ["Terpakai", formatCurrency(metrics.budgetSpentTotal, "idr")],
          ["Sisa", formatCurrency(Math.max(metrics.budgetRemainingThb, 0), "idr")],
        ].map(
          ([label, value]) => html`
            <div key=${label}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                ${label}
              </p>
              <p className="mt-2 break-words text-sm font-black text-slate-950 dark:text-white md:text-base">
                ${value}
              </p>
            </div>
          `,
        )}
      </div>

      <div className="relative mt-5 h-3 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
        <div
          className=${`h-full rounded-full bg-gradient-to-r ${barClass}`}
          style=${{ width }}
        ></div>
      </div>
      <p className="relative mt-2 text-xs text-slate-600 dark:text-slate-300">
        ${metrics.budgetLimitTotal > 0
          ? `${formatPercent(usage)} dari budget sudah terpakai.`
          : "Belum ada budget aktif untuk bulan ini."}
      </p>
    </section>
  `;
}

function OverviewCharts({ metrics }) {
  const cashflowMax = Math.max(
    metrics.monthlyIncomeIdr,
    metrics.monthlyExpenseIdr,
    1,
  );
  const dailyData = metrics.overviewDailyExpenses.slice(-14);
  const dailyMax = Math.max(
    ...dailyData.map((item) => item.valueIdr || item.valueThb),
    1,
  );

  return html`
    <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
      <div className=${`${PREMIUM_PANEL} p-5 md:p-6`}>
        <div className="relative">
          <h3 className="font-display text-lg font-bold text-slate-950 dark:text-white">
            Cashflow Bulan Ini
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Pemasukan vs pengeluaran dalam valuasi IDR.
          </p>
        </div>
        <div className="relative mt-5 grid gap-4">
          ${[
            ["Pemasukan", metrics.monthlyIncomeIdr, "from-brand-500 to-emerald-300"],
            ["Pengeluaran", metrics.monthlyExpenseIdr, "from-rose-500 to-amber-400"],
          ].map(([label, value, gradient]) => {
            const width = `${Math.max((Number(value) / cashflowMax) * 100, value > 0 ? 8 : 0)}%`;
            return html`
              <div key=${label}>
                <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                  <span className="font-semibold text-slate-600 dark:text-slate-300">
                    ${label}
                  </span>
                  <span className="font-bold text-slate-950 dark:text-white">
                    ${formatCurrency(value, "idr")}
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
                  <div
                    className=${`h-full rounded-full bg-gradient-to-r ${gradient}`}
                    style=${{ width }}
                  ></div>
                </div>
              </div>
            `;
          })}
        </div>
      </div>

      <div className=${`${PREMIUM_PANEL} p-5 md:p-6`}>
        <div className="relative">
          <h3 className="font-display text-lg font-bold text-slate-950 dark:text-white">
            Pengeluaran Harian
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            14 hari terakhir bulan ini.
          </p>
        </div>
        <div className="relative mt-5 flex h-36 items-end gap-1.5">
          ${dailyData.map((item) => {
            const value = item.valueIdr || item.valueThb;
            const height = Math.max((value / dailyMax) * 100, value > 0 ? 10 : 4);
            return html`
              <div key=${item.key} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <div className="flex h-24 w-full items-end">
                  <div
                    title=${`${item.tooltipLabel}: ${
                      item.valueIdr > 0
                        ? formatCurrency(item.valueIdr, "idr")
                        : formatCurrency(item.valueThb, "thb")
                    }`}
                    className="w-full rounded-t-xl bg-gradient-to-t from-brand-600 to-emerald-300 dark:from-brand-500 dark:to-emerald-200"
                    style=${{ height: `${height}%` }}
                  ></div>
                </div>
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                  ${item.label}
                </span>
              </div>
            `;
          })}
        </div>
      </div>
    </section>
  `;
}

function OverviewInsights({ metrics }) {
  const topCategory = metrics.topExpenseCategory;
  const topCategoryAmount = topCategory
    ? topCategory.valueIdr > 0
      ? formatCurrency(topCategory.valueIdr, "idr")
      : formatCurrency(topCategory.valueThb, "thb")
    : "";
  const insights = [
    {
      title: "Kategori terbesar",
      value: topCategory ? topCategory.label : "Belum ada",
      helper: topCategory
        ? `${topCategoryAmount} bulan ini`
        : "Transaksi pengeluaran akan muncul di sini.",
    },
    {
      title: "Rata-rata harian",
      value:
        metrics.averageDailyExpenseIdr > 0
          ? formatCurrency(metrics.averageDailyExpenseIdr, "idr")
          : "-",
      helper: "Rata-rata pengeluaran per hari bulan ini.",
    },
    {
      title: "Status budget",
      value: metrics.budgetStatusLabel,
      helper:
        metrics.budgetLimitTotal > 0
          ? `${formatPercent(metrics.budgetUsageTotal)} terpakai`
          : "Buat budget agar status aktif.",
    },
  ];

  return html`
    <section className="grid gap-3 md:grid-cols-3">
      ${insights.map(
        (item) => html`
          <div key=${item.title} className="cuan-card-soft rounded-[22px] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              ${item.title}
            </p>
            <p className="mt-2 break-words text-base font-black text-slate-950 dark:text-white">
              ${item.value}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
              ${item.helper}
            </p>
          </div>
        `,
      )}
    </section>
  `;
}

function OverviewRecentTransactions({ transactions, onNavigate }) {
  return html`
    <section className=${`${PREMIUM_PANEL} p-5 md:p-6`}>
      <div className="relative flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold text-slate-950 dark:text-white">
            Transaksi Terbaru
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            5 aktivitas terakhir.
          </p>
        </div>
        <button
          type="button"
          onClick=${() => onNavigate("history")}
          className="cuan-secondary min-h-11 rounded-2xl px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5"
        >
          Lihat semua
        </button>
      </div>

      <div className="relative mt-4 grid gap-2">
        ${transactions.map((item) => html`
          <div
            key=${item.id}
            className="grid grid-cols-[1fr_auto] gap-3 rounded-2xl border border-slate-200/70 bg-white/50 p-3 dark:border-white/10 dark:bg-slate-800/45"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-950 dark:text-white">
                ${item.description || TYPE_META[item.type]?.label || "Transaksi"}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                ${formatDateTime(item.occurred_at)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-black text-slate-950 dark:text-white">
                ${getTransactionPreview(item)}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                ${getTransactionTypeLabel(item)}
              </p>
            </div>
          </div>
        `)}
      </div>
    </section>
  `;
}

function OverviewEmptyState({ onNavigate }) {
  return html`
    <section className=${`${PREMIUM_PANEL} p-6 text-center md:p-8`}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(16,185,129,0.16),transparent_48%)]"></div>
      <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-brand-300/25 bg-brand-500/12 text-2xl font-black text-brand-700 dark:text-brand-200">
        +
      </div>
      <h3 className="relative mt-4 font-display text-2xl font-bold text-slate-950 dark:text-white">
        Overview siap diisi
      </h3>
      <p className="relative mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-300">
        Tambahkan transaksi pertama agar saldo, cashflow, budget, insight, dan riwayat mulai hidup.
      </p>
      <button
        type="button"
        onClick=${() => onNavigate("add")}
        className="relative mt-5 min-h-12 rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_44px_rgba(16,185,129,0.22)] transition hover:-translate-y-0.5 hover:bg-brand-700 dark:bg-emerald-500"
      >
        Tambah transaksi pertama
      </button>
    </section>
  `;
}

function OverviewPage({ metrics, transactions, onNavigate }) {
  const latestTransactions = metrics.recent.slice(0, 5);

  if (!transactions.length) {
    return html`
      <div className="grid gap-4">
        <${OverviewEmptyState} onNavigate=${onNavigate} />
      </div>
    `;
  }

  return html`
    <div className="grid gap-4">
      <${OverviewHero} metrics=${metrics} />
      <${OverviewStatGrid} metrics=${metrics} />
      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <${OverviewBudgetProgress} metrics=${metrics} />
        <${OverviewInsights} metrics=${metrics} />
      </div>
      <${OverviewCharts} metrics=${metrics} />
      <${OverviewRecentTransactions}
        transactions=${latestTransactions}
        onNavigate=${onNavigate}
      />
    </div>
  `;
}

function getControlCurrency(metrics, selectedCurrency) {
  const activeCurrencies = normalizeCurrencyList(metrics.activeCurrencies || getActiveCurrencies());
  const requested = normalizeCurrencyCode(selectedCurrency || activeCurrencies[0]);
  return activeCurrencies.includes(requested) ? requested : activeCurrencies[0];
}

function buildControlCenter(metrics, selectedCurrency = getBaseCurrency()) {
  const monthMeta = getMonthMeta(metrics.currentMonthKey);
  const remainingDays = Math.max(monthMeta.daysInMonth - monthMeta.elapsedDays, 0);
  const currency = getControlCurrency(metrics, selectedCurrency);
  const activeBudget =
    metrics.budgetInsights.find((item) => item.currency === currency) || null;
  const currencyBalance =
    currency === DEFAULT_BASE_CURRENCY
      ? metrics.balanceIdr
      : Number(metrics.currencyBalances?.[currency] || 0);
  const currencySpent = Number(metrics.monthlyExpenseByCurrency?.[currency] || 0);
  const currencyDailyAverage =
    monthMeta.elapsedDays > 0 ? currencySpent / monthMeta.elapsedDays : 0;
  const currencyRunwayDays =
    currencyDailyAverage > 0 ? Math.floor(currencyBalance / currencyDailyAverage) : null;
  const projectedExpenseIdr = metrics.averageDailyExpenseIdr * monthMeta.daysInMonth;
  const projectedNetIdr = metrics.monthlyExternalIncomeIdr - projectedExpenseIdr;
  const projectedCurrencyNeed = currencyDailyAverage * remainingDays;
  const projectedCurrencyGap = Math.max(projectedCurrencyNeed - currencyBalance, 0);
  const topCategory = metrics.topExpenseCategory;

  let score = 100;
  if (!activeBudget) score -= 8;
  if (activeBudget?.status === "warning") score -= 16;
  if (activeBudget?.status === "over") score -= 30;
  if (metrics.monthlyNetChangeIdr < 0) score -= 14;
  if (projectedNetIdr < 0) score -= 12;
  if (metrics.unvaluedForeignExpenseCount > 0) score -= 10;
  if (currency === DEFAULT_BASE_CURRENCY && currencyBalance < metrics.averageDailyExpenseIdr * 7) score -= 10;
  if (currencyRunwayDays != null && currencyRunwayDays < 3) score -= 18;
  else if (currencyRunwayDays != null && currencyRunwayDays < 7) score -= 10;
  if (topCategory?.share > 0.45) score -= 6;

  const controlScore = Math.max(Math.min(Math.round(score), 100), 0);
  const controlLabel =
    controlScore >= 82
      ? "Terkendali"
      : controlScore >= 66
        ? "Perlu dijaga"
        : controlScore >= 45
          ? "Waspada"
          : "Butuh tindakan";
  const controlTone =
    controlScore >= 82
      ? "text-brand-700 dark:text-brand-300"
      : controlScore >= 66
        ? "text-amber-700 dark:text-amber-300"
        : "text-rose-700 dark:text-rose-300";

  const alerts = [];
  if (!activeBudget) {
    alerts.push({
      title: `Budget ${currency} belum aktif`,
      body: `Buat limit bulanan ${currency} agar batas aman harian bisa dihitung.`,
      tone: "amber",
    });
  } else if (activeBudget.status === "over") {
    alerts.push({
      title: `Budget ${currency} melewati batas`,
      body: `Pengeluaran ${currency} sudah ${formatPercent(activeBudget.usage)} dari budget bulan ini.`,
      tone: "rose",
    });
  } else if (activeBudget.status === "warning") {
    alerts.push({
      title: `Budget ${currency} mendekati limit`,
      body: `Sisa budget sekitar ${formatCurrency(Math.max(activeBudget.remainingAmount, 0), currency)}.`,
      tone: "amber",
    });
  }

  if (currencyRunwayDays != null && currencyRunwayDays <= 7) {
    alerts.push({
      title: `Saldo ${currency} perlu dipantau`,
      body: `Dengan ritme sekarang, saldo ${currency} cukup sekitar ${Math.max(currencyRunwayDays, 0)} hari.`,
      tone: currencyRunwayDays <= 3 ? "rose" : "amber",
    });
  }

  if (metrics.unvaluedForeignExpenseCount > 0) {
    alerts.push({
      title: "Ada transaksi tanpa valuasi",
      body: `${metrics.unvaluedForeignExpenseCount} pengeluaran mata uang asing belum punya rate IDR.`,
      tone: "amber",
    });
  }

  if (projectedNetIdr < 0) {
    alerts.push({
      title: "Forecast bulan ini negatif",
      body: `Jika ritme sama, cashflow bulan ini bisa ${formatCurrency(projectedNetIdr, "idr")}.`,
      tone: "rose",
    });
  }

  if (topCategory?.share > 0.45) {
    alerts.push({
      title: "Kategori dominan",
      body: `${topCategory.label} mengambil ${formatPercent(topCategory.share)} dari pengeluaran bulan ini.`,
      tone: "amber",
    });
  }

  if (!alerts.length) {
    alerts.push({
      title: "Tidak ada risiko besar",
      body: "Cashflow, budget, dan saldo masih terlihat terkendali untuk saat ini.",
      tone: "emerald",
    });
  }

  const nextActions = [];
  if (!activeBudget) {
    nextActions.push({
      title: `Buat budget ${currency}`,
      body: `Aktifkan batas aman harian untuk pengeluaran ${currency}.`,
      target: "control-budget",
    });
  }
  if (projectedCurrencyGap > 0 && currency !== DEFAULT_BASE_CURRENCY) {
    nextActions.push({
      title: `Rencanakan tukar ke ${currency}`,
      body: `Estimasi kurang ${formatCurrency(projectedCurrencyGap, currency)} sampai akhir bulan.`,
      target: "add",
    });
  }
  if (activeBudget?.todayRemainingSafe != null && activeBudget.todayRemainingSafe < 0) {
    nextActions.push({
      title: `Tahan belanja ${currency} hari ini`,
      body: `Hari ini lewat ${formatCurrency(Math.abs(activeBudget.todayRemainingSafe), currency)} dari batas aman.`,
      target: "history",
    });
  }
  if (topCategory) {
    nextActions.push({
      title: `Review ${topCategory.label}`,
      body: "Cek transaksi kategori terbesar dan cari yang bisa dikurangi.",
      target: "history",
    });
  }
  if (!nextActions.length) {
    nextActions.push({
      title: "Catat transaksi berikutnya",
      body: "Jaga dashboard tetap akurat dengan input real-time.",
      target: "add",
    });
  }

  return {
    activeBudget,
    alerts: alerts.slice(0, 4),
    controlLabel,
    controlScore,
    controlTone,
    currency,
    currencyBalance,
    currencyDailyAverage,
    currencyRunwayDays,
    currencySpent,
    nextActions: nextActions.slice(0, 4),
    projectedCurrencyGap,
    projectedExpenseIdr,
    projectedNetIdr,
    remainingDays,
  };
}

function ControlMetric({ label, value, helper }) {
  return html`
    <div className="rounded-[22px] border border-slate-200/70 bg-white/58 p-4 dark:border-white/10 dark:bg-slate-900/44">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        ${label}
      </p>
      <p className="mt-2 break-words text-lg font-black text-slate-950 dark:text-white">
        ${value}
      </p>
      <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
        ${helper}
      </p>
    </div>
  `;
}

function ControlCurrencyTabs({ currencies, value, onChange }) {
  if (currencies.length <= 1) return null;

  return html`
    <section className=${`${PREMIUM_PANEL_SOFT} p-3`}>
      <div className="cuan-segment flex flex-wrap gap-1 rounded-[22px] p-1">
        ${currencies.map((currency) => {
          const active = value === currency;
          return html`
            <button
              key=${currency}
              type="button"
              onClick=${() => onChange(currency)}
              className=${`min-h-11 min-w-[4rem] flex-1 rounded-2xl px-2 text-xs font-black transition duration-300 ${
                active
                  ? "bg-brand-600 text-white shadow-[0_14px_34px_rgba(16,185,129,0.22)] dark:bg-emerald-500"
                  : "text-slate-600 hover:bg-white/75 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
              }`}
            >
              ${currency}
            </button>
          `;
        })}
      </div>
    </section>
  `;
}

function ControlCenterHero({ metrics, control }) {
  const scoreWidth = `${control.controlScore}%`;

  return html`
    <section className=${`${PREMIUM_PANEL} control-center-card p-5 md:p-6`}>
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand-400/14 blur-3xl"></div>
      <div className="relative grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
            Financial Control Center
          </p>
          <h2 className="mt-3 font-display text-3xl font-black tracking-[-0.04em] text-slate-950 dark:text-white md:text-4xl">
            ${control.controlLabel}
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Monitor risiko hari ini, budget ${control.currency}, dan keputusan yang perlu diambil.
          </p>
        </div>
        <div className="rounded-[28px] border border-slate-200/70 bg-white/62 p-4 dark:border-white/10 dark:bg-slate-950/40 md:w-52">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Skor Kontrol
          </p>
          <p className=${`mt-2 text-4xl font-black tracking-[-0.05em] ${control.controlTone}`}>
            ${control.controlScore}
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-600 to-emerald-300"
              style=${{ width: scoreWidth }}
            ></div>
          </div>
        </div>
      </div>

      <div className="relative mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <${ControlMetric}
          label="Net worth"
          value=${formatCurrency(metrics.netWorthIdr, "idr")}
          helper="Semua saldo aktif"
        />
        <${ControlMetric}
          label=${`Runway ${control.currency}`}
          value=${control.currencyRunwayDays == null ? "Stabil" : `${Math.max(control.currencyRunwayDays, 0)} hari`}
          helper=${control.currencyDailyAverage > 0 ? `${formatCurrency(control.currencyDailyAverage, control.currency)}/hari` : `Belum ada ritme ${control.currency}`}
        />
        <${ControlMetric}
          label="Forecast net"
          value=${formatCurrency(control.projectedNetIdr, "idr")}
          helper="Estimasi akhir bulan"
        />
        <${ControlMetric}
          label="Sisa budget"
          value=${control.activeBudget ? formatCurrency(Math.max(control.activeBudget.remainingAmount, 0), control.currency) : "-"}
          helper=${control.activeBudget ? control.activeBudget.statusLabel : `Belum ada budget ${control.currency}`}
        />
      </div>
    </section>
  `;
}

function ControlAlerts({ alerts }) {
  const toneClass = {
    emerald:
      "border-brand-300/25 bg-brand-500/10 text-brand-800 dark:border-brand-300/20 dark:text-brand-200",
    amber:
      "border-amber-300/30 bg-amber-400/10 text-amber-800 dark:border-amber-300/20 dark:text-amber-200",
    rose:
      "border-rose-300/30 bg-rose-400/10 text-rose-800 dark:border-rose-300/20 dark:text-rose-200",
  };

  return html`
    <section className=${`${PREMIUM_PANEL} p-5 md:p-6`}>
      <div className="relative">
        <h3 className="font-display text-xl font-black text-slate-950 dark:text-white">
          Alert & Risiko
        </h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Hal yang paling perlu diperhatikan sekarang.
        </p>
      </div>
      <div className="relative mt-4 grid gap-3">
        ${alerts.map(
          (alert) => html`
            <div key=${alert.title} className=${`rounded-[22px] border p-4 ${toneClass[alert.tone]}`}>
              <p className="font-black">${alert.title}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                ${alert.body}
              </p>
            </div>
          `,
        )}
      </div>
    </section>
  `;
}

function ControlNextActions({ actions, onNavigate }) {
  function handleAction(action) {
    if (action.target === "control-budget") {
      document
        .getElementById("control-budget-section")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    onNavigate(action.target);
  }

  return html`
    <section className=${`${PREMIUM_PANEL} p-5 md:p-6`}>
      <div className="relative">
        <h3 className="font-display text-xl font-black text-slate-950 dark:text-white">
          Aksi Berikutnya
        </h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Langkah kecil yang paling berguna hari ini.
        </p>
      </div>
      <div className="relative mt-4 grid gap-3">
        ${actions.map(
          (action) => html`
            <button
              key=${action.title}
              type="button"
              onClick=${() => handleAction(action)}
              className="grid min-h-[76px] grid-cols-[1fr_auto] items-center gap-3 rounded-[22px] border border-slate-200/70 bg-white/58 p-4 text-left transition hover:-translate-y-0.5 hover:bg-white/82 dark:border-white/10 dark:bg-slate-900/44 dark:hover:bg-slate-900/70"
            >
              <span className="min-w-0">
                <span className="block text-sm font-black text-slate-950 dark:text-white">
                  ${action.title}
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-600 dark:text-slate-300">
                  ${action.body}
                </span>
              </span>
              <span className="rounded-full border border-brand-300/25 bg-brand-500/10 px-3 py-1 text-xs font-black text-brand-700 dark:border-brand-300/20 dark:text-brand-200">
                Buka
              </span>
            </button>
          `,
        )}
      </div>
    </section>
  `;
}

function ControlForecast({ metrics, control }) {
  const budgetWidth =
    control.activeBudget
      ? `${Math.min(Math.max(control.activeBudget.usage * 100, 0), 100)}%`
      : "0%";
  const runwayLabel =
    control.currencyRunwayDays == null
      ? "Belum ada ritme"
      : `${Math.max(control.currencyRunwayDays, 0)} hari`;

  return html`
    <section className="grid gap-4 lg:grid-cols-2">
      <div className=${`${PREMIUM_PANEL} p-5 md:p-6`}>
        <div className="relative">
          <h3 className="font-display text-xl font-black text-slate-950 dark:text-white">
            Forecast Bulan Ini
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Proyeksi jika ritme pengeluaran tidak berubah.
          </p>
        </div>
        <div className="relative mt-5 grid gap-3">
          <${ControlMetric}
            label="Estimasi pengeluaran"
            value=${formatCurrency(control.projectedExpenseIdr, "idr")}
            helper="Sampai akhir bulan"
          />
          <${ControlMetric}
            label="Estimasi cashflow"
            value=${formatCurrency(control.projectedNetIdr, "idr")}
            helper=${control.projectedNetIdr >= 0 ? "Masih surplus" : "Berpotensi defisit"}
          />
        </div>
      </div>

      <div className=${`${PREMIUM_PANEL} p-5 md:p-6`}>
        <div className="relative">
          <h3 className="font-display text-xl font-black text-slate-950 dark:text-white">
            Runway ${control.currency}
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Daya tahan saldo ${control.currency} dan batas budget aktif.
          </p>
        </div>
        <div className="relative mt-5 grid gap-4">
          <div>
            <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
              <span>Budget ${control.currency}</span>
              <span>${control.activeBudget ? formatPercent(control.activeBudget.usage) : "-"}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
              <div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-emerald-300" style=${{ width: budgetWidth }}></div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <${ControlMetric}
              label="Runway"
              value=${runwayLabel}
              helper=${`Berdasarkan rata-rata ${control.currency}`}
            />
            <${ControlMetric}
              label=${`Gap ${control.currency}`}
              value=${formatCurrency(control.projectedCurrencyGap, control.currency)}
              helper="Estimasi kebutuhan tambahan"
            />
          </div>
        </div>
      </div>
    </section>
  `;
}

function ControlCenterEmptyState({ onNavigate }) {
  return html`
    <section className=${`${PREMIUM_PANEL} p-6 text-center md:p-8`}>
      <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-brand-300/25 bg-brand-500/12 text-2xl font-black text-brand-700 dark:text-brand-200">
        +
      </div>
      <h3 className="relative mt-4 font-display text-2xl font-bold text-slate-950 dark:text-white">
        Control Center siap dipakai
      </h3>
      <p className="relative mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-300">
        Tambahkan transaksi pertama agar CUANSYNC bisa membaca risiko dan rekomendasi harian.
      </p>
      <button
        type="button"
        onClick=${() => onNavigate("add")}
        className="history-action-primary relative mt-5 min-h-12 rounded-2xl px-5 py-3 text-sm font-semibold"
      >
        Tambah transaksi pertama
      </button>
    </section>
  `;
}

function ControlBudgetHub({
  metrics,
  activeCurrencies,
  selectedCurrency,
  onCurrencyChange,
  loading,
  onBudgetDelete,
  onBudgetSubmit,
}) {
  const selectedBudgets = metrics.budgetInsights.filter(
    (item) => item.currency === selectedCurrency,
  );

  return html`
    <section id="control-budget-section" className="grid scroll-mt-6 gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="grid gap-4">
        <section className=${`${PREMIUM_PANEL} p-5 md:p-6`}>
          <div className="relative">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
              Kontrol budget
            </p>
            <h3 className="mt-2 font-display text-xl font-black text-slate-950 dark:text-white">
              Atur batas aman ${selectedCurrency}
            </h3>
            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Budget mengikuti mata uang aktif. IDR-only tetap sederhana, multi-currency bisa dipantau per wallet.
            </p>
          </div>
        </section>
        <${BudgetForm}
          onSubmit=${onBudgetSubmit}
          loading=${loading}
          currentMonthKey=${metrics.currentMonthKey}
          currency=${selectedCurrency}
          activeCurrencies=${activeCurrencies}
          onCurrencyChange=${onCurrencyChange}
        />
      </div>

      <${BudgetTracker}
        budgets=${selectedBudgets}
        monthLabel=${metrics.currentMonthLabel}
        onDelete=${onBudgetDelete}
      />
    </section>
  `;
}

function ControlCenterPage({
  metrics,
  transactions,
  activeCurrencies = metrics.activeCurrencies || getActiveCurrencies(),
  onBudgetDelete,
  onBudgetSubmit,
  loading = false,
  onNavigate,
}) {
  const normalizedCurrencies = normalizeCurrencyList(activeCurrencies);
  const [selectedCurrency, setSelectedCurrency] = useState(normalizedCurrencies[0]);

  useEffect(() => {
    if (!normalizedCurrencies.includes(selectedCurrency)) {
      setSelectedCurrency(normalizedCurrencies[0]);
    }
  }, [normalizedCurrencies.join("|"), selectedCurrency]);

  const control = buildControlCenter(metrics, selectedCurrency);

  if (!transactions.length) {
    return html`
      <div className="grid gap-4">
        <${ControlCenterEmptyState} onNavigate=${onNavigate} />
        <${ControlCurrencyTabs}
          currencies=${normalizedCurrencies}
          value=${control.currency}
          onChange=${setSelectedCurrency}
        />
        <${ControlBudgetHub}
          metrics=${metrics}
          activeCurrencies=${normalizedCurrencies}
          selectedCurrency=${control.currency}
          onCurrencyChange=${setSelectedCurrency}
          loading=${loading}
          onBudgetDelete=${onBudgetDelete}
          onBudgetSubmit=${onBudgetSubmit}
        />
      </div>
    `;
  }

  return html`
    <div className="grid gap-4">
      <${ControlCurrencyTabs}
        currencies=${normalizedCurrencies}
        value=${control.currency}
        onChange=${setSelectedCurrency}
      />
      <${ControlCenterHero} metrics=${metrics} control=${control} />
      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <${ControlAlerts} alerts=${control.alerts} />
        <${ControlNextActions} actions=${control.nextActions} onNavigate=${onNavigate} />
      </div>
      <${ControlForecast} metrics=${metrics} control=${control} />
      <${ControlBudgetHub}
        metrics=${metrics}
        activeCurrencies=${normalizedCurrencies}
        selectedCurrency=${control.currency}
        onCurrencyChange=${setSelectedCurrency}
        loading=${loading}
        onBudgetDelete=${onBudgetDelete}
        onBudgetSubmit=${onBudgetSubmit}
      />
    </div>
  `;
}

function ReportMonthPicker({ months, value, onChange }) {
  const previousKey = shiftMonthKey(value, -1);
  const nextKey = shiftMonthKey(value, 1);
  const latestAllowed = getMonthKey(new Date());
  const nextDisabled = nextKey > latestAllowed && !months.includes(nextKey);

  return html`
    <div className="grid grid-cols-[44px_1fr_44px] items-center gap-2">
      <button
        type="button"
        onClick=${() => onChange(previousKey)}
        className="cuan-secondary inline-flex min-h-11 items-center justify-center rounded-2xl px-3 text-sm font-black transition hover:-translate-y-0.5"
        aria-label="Bulan sebelumnya"
      >
        ${"<"}
      </button>
      <select
        value=${value}
        onChange=${(event) => onChange(event.target.value)}
        className=${`${GLASS_INPUT} text-center font-semibold`}
        aria-label="Pilih bulan laporan"
      >
        ${months.map(
          (month) => html`
            <option key=${month} value=${month}>${formatMonthKey(month)}</option>
          `,
        )}
      </select>
      <button
        type="button"
        disabled=${nextDisabled}
        onClick=${() => onChange(nextKey)}
        className="cuan-secondary inline-flex min-h-11 items-center justify-center rounded-2xl px-3 text-sm font-black transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"
        aria-label="Bulan berikutnya"
      >
        ${">"}
      </button>
    </div>
  `;
}

function MonthlyReportHero({ report }) {
  const netPositive = report.summary.netCashflowIdr >= 0;
  const trendText =
    report.previousDeltaIdr == null
      ? "Belum ada pembanding bulan lalu"
      : `${report.previousDeltaIdr >= 0 ? "Naik" : "Turun"} ${formatCurrency(
          Math.abs(report.previousDeltaIdr),
          "idr",
        )} vs bulan lalu`;
  const statusLabel = netPositive ? "Surplus" : "Defisit";

  return html`
    <section className=${`${PREMIUM_PANEL} report-reveal report-glow-sweep p-5 md:p-6`}>
      <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-brand-400/20 blur-3xl dark:bg-brand-400/14"></div>
      <div className="pointer-events-none absolute -bottom-24 left-6 h-48 w-48 rounded-full bg-sky-300/16 blur-3xl dark:bg-sky-400/10"></div>
      <div className="relative grid gap-5 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
        <div>
          <div className="inline-flex rounded-full border border-brand-300/25 bg-brand-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-800 dark:border-brand-400/20 dark:text-brand-200">
            Laporan ${report.meta.label}
          </div>
          <p className="mt-4 text-sm font-semibold text-slate-600 dark:text-slate-300">
            Cashflow bersih bulan ini
          </p>
          <h2 className=${`mt-2 break-words font-display text-4xl font-black text-slate-950 dark:text-white md:text-5xl ${netPositive ? "" : "text-rose-700 dark:text-rose-300"}`}>
            ${netPositive ? "+" : "-"}${formatCurrency(Math.abs(report.summary.netCashflowIdr), "idr")}
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-700 dark:text-slate-300">
            ${statusLabel} dari pemasukan eksternal dikurangi semua pengeluaran.
            Tukar mata uang dicatat terpisah sebagai perpindahan aset, bukan pemasukan atau pengeluaran.
          </p>
        </div>

        <div className="grid gap-3 rounded-[24px] border border-slate-200/70 bg-white/58 p-4 shadow-[0_18px_44px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/45">
          <div className="flex items-center justify-between gap-3">
            <span className=${`rounded-full px-3 py-1 text-xs font-black ${netPositive ? "bg-brand-500/12 text-brand-700 dark:text-brand-200" : "bg-rose-500/12 text-rose-700 dark:text-rose-200"}`}>
              ${statusLabel}
            </span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              ${trendText}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Pemasukan
              </p>
              <p className="mt-2 break-words text-base font-black text-brand-700 dark:text-brand-300">
                ${formatCurrency(report.summary.externalIncomeIdr, "idr")}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Pengeluaran
              </p>
              <p className="mt-2 break-words text-base font-black text-rose-700 dark:text-rose-300">
                ${formatCurrency(report.summary.expenseIdr, "idr")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

function MonthlyReportKpis({ report }) {
  const stats = [
    {
      title: "Pemasukan",
      value: formatCurrency(report.summary.externalIncomeIdr, "idr"),
      helper: "Uang masuk eksternal",
    },
    {
      title: "Pengeluaran",
      value: formatCurrency(report.summary.expenseIdr, "idr"),
      helper: "Total belanja bulan ini",
    },
    {
      title: "Rasio simpan",
      value:
        report.summary.externalIncomeIdr > 0
          ? formatPercent(report.savingsRatio)
          : "-",
      helper: "Cashflow / pemasukan",
    },
    {
      title: "Exchange",
      value: formatCurrency(report.summary.exchangeVolumeIdr, "idr"),
      helper: `${report.summary.exchangeCount} tukar mata uang`,
    },
    {
      title: "Valuasi tertunda",
      value: report.summary.unvaluedExpenseCount,
      helper: "Expense asing tanpa rate",
    },
    {
      title: "Rata-rata",
      value: formatCurrency(report.dailyAverageExpenseIdr, "idr"),
      helper: "Pengeluaran per hari",
    },
    {
      title: "Transaksi",
      value: report.summary.count,
      helper: "Aktivitas bulan ini",
    },
  ];

  return html`
    <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-7">
      ${stats.map(
        (item, index) => html`
          <div
            key=${item.title}
            className="cuan-card-soft report-reveal rounded-[22px] p-4"
            style=${{ animationDelay: `${80 + index * 45}ms` }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              ${item.title}
            </p>
            <p className="mt-2 break-words text-base font-black text-slate-950 dark:text-white md:text-lg">
              ${item.value}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
              ${item.helper}
            </p>
          </div>
        `,
      )}
    </section>
  `;
}

function MonthlyBudgetPulse({ report }) {
  const chipClass =
    report.budgetStatus === "over"
      ? "bg-rose-500/12 text-rose-700 dark:text-rose-200"
      : report.budgetStatus === "warning"
        ? "bg-amber-500/12 text-amber-700 dark:text-amber-200"
        : report.budgetStatus === "safe"
          ? "bg-brand-500/12 text-brand-700 dark:text-brand-200"
          : "bg-slate-500/12 text-slate-600 dark:text-slate-300";

  return html`
    <section className=${`${PREMIUM_PANEL} report-reveal p-5 md:p-6`}>
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-bold text-slate-950 dark:text-white">
            Proteksi Budget
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Status semua budget aktif di ${report.meta.label}, mengikuti mata uang yang kamu pakai.
          </p>
        </div>
        <span className=${`rounded-full px-3 py-1 text-xs font-black ${chipClass}`}>
          ${report.budgetStatusLabel}
        </span>
      </div>

      ${report.budgetInsights.length
        ? html`
            <div className="relative mt-5 grid gap-3">
              ${report.budgetInsights.map((budget) => {
                const width = `${Math.min(
                  Math.max(budget.usage * 100, budget.spentAmount > 0 ? 8 : 0),
                  100,
                )}%`;
                return html`
                  <div
                    key=${budget.id || `${budget.month_key}-${budget.currency}`}
                    className="rounded-2xl border border-slate-200/70 bg-white/50 p-3 dark:border-white/10 dark:bg-slate-800/45"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                          ${budget.currency}
                        </p>
                        <p className="mt-1 text-sm font-black text-slate-950 dark:text-white">
                          ${formatCurrency(budget.spentAmount, budget.currency)} / ${formatCurrency(
                            budget.limitAmount,
                            budget.currency,
                          )}
                        </p>
                      </div>
                      <span className=${`rounded-full border px-2.5 py-1 text-[11px] font-black ${budget.tone}`}>
                        ${budget.statusLabel}
                      </span>
                    </div>
                    <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
                      <div
                        className=${`report-bar-fill h-full rounded-full bg-gradient-to-r ${budget.barClass}`}
                        style=${{ width }}
                      ></div>
                    </div>
                    <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                      Sisa ${formatCurrency(Math.max(budget.remainingAmount, 0), budget.currency)}
                      · Batas hari ini ${formatCurrency(budget.dynamicDailyLimit, budget.currency)}
                    </p>
                  </div>
                `;
              })}
            </div>
            <div className="relative mt-4 grid grid-cols-3 gap-3 rounded-2xl border border-slate-200/70 bg-white/45 p-3 dark:border-white/10 dark:bg-slate-900/35">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  Limit IDR
                </p>
                <p className="mt-1 text-sm font-black text-slate-950 dark:text-white">
                  ${formatCurrency(report.budgetLimitBaseIdr, "idr")}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  Terpakai
                </p>
                <p className="mt-1 text-sm font-black text-slate-950 dark:text-white">
                  ${formatCurrency(report.budgetSpentBaseIdr, "idr")}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  Sisa
                </p>
                <p className="mt-1 text-sm font-black text-slate-950 dark:text-white">
                  ${formatCurrency(Math.max(report.budgetRemainingBaseIdr, 0), "idr")}
                </p>
              </div>
            </div>
          `
        : html`
            <div className="relative mt-5 rounded-2xl border border-dashed border-slate-300/70 bg-white/45 p-5 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-800/35 dark:text-slate-300">
              Belum ada budget aktif untuk bulan ini. Buat budget di tab Kontrol agar laporan bisa membaca batas aman.
            </div>
          `}
    </section>
  `;
}

function MonthlyCurrencySummary({ report }) {
  const visibleCurrencies = report.currencyBreakdown.filter(
    (item) =>
      item.income > 0 ||
      item.expense > 0 ||
      item.exchangeIn > 0 ||
      item.exchangeOut > 0,
  );

  return html`
    <section className=${`${PREMIUM_PANEL} report-reveal p-5 md:p-6`}>
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold text-slate-950 dark:text-white">
            Ringkasan Mata Uang
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Income, expense, dan exchange dipisah supaya cashflow tidak tercampur.
          </p>
        </div>
      </div>

      ${visibleCurrencies.length
        ? html`
            <div className="relative mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              ${visibleCurrencies.map((item) => html`
                <div
                  key=${item.currency}
                  className="rounded-2xl border border-slate-200/70 bg-white/50 p-3 dark:border-white/10 dark:bg-slate-800/45"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-slate-950 dark:text-white">
                      ${item.currency}
                    </p>
                    <span className="rounded-full border border-brand-300/25 bg-brand-500/10 px-2.5 py-1 text-[11px] font-black text-brand-700 dark:border-brand-300/20 dark:text-brand-200">
                      Wallet
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Masuk</p>
                      <p className="mt-1 font-black text-brand-700 dark:text-brand-300">
                        ${formatCurrency(item.income, item.currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Keluar</p>
                      <p className="mt-1 font-black text-rose-700 dark:text-rose-300">
                        ${formatCurrency(item.expense, item.currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Exchange in</p>
                      <p className="mt-1 font-black text-sky-700 dark:text-sky-300">
                        ${formatCurrency(item.exchangeIn, item.currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Exchange out</p>
                      <p className="mt-1 font-black text-slate-700 dark:text-slate-200">
                        ${formatCurrency(item.exchangeOut, item.currency)}
                      </p>
                    </div>
                  </div>
                </div>
              `)}
            </div>
          `
        : html`
            <div className="relative mt-5 rounded-2xl border border-dashed border-slate-300/70 bg-white/45 p-5 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-800/35 dark:text-slate-300">
              Belum ada aktivitas mata uang di bulan ini.
            </div>
          `}
    </section>
  `;
}

function MonthlyReportCharts({ report }) {
  const cashflowMax = Math.max(
    report.summary.externalIncomeIdr,
    report.summary.expenseIdr,
    1,
  );
  const dailyMax = Math.max(
    ...report.dailySeries.map((item) => item.expenseIdr),
    1,
  );

  return html`
    <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
      <div className=${`${PREMIUM_PANEL} report-reveal p-5 md:p-6`}>
        <div className="relative">
          <h3 className="font-display text-lg font-bold text-slate-950 dark:text-white">
            Cashflow
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Pemasukan vs pengeluaran bulan ini.
          </p>
        </div>
        <div className="relative mt-5 grid gap-4">
          ${[
            ["Pemasukan", report.summary.externalIncomeIdr, "from-brand-500 to-emerald-300"],
            ["Pengeluaran", report.summary.expenseIdr, "from-rose-500 to-amber-400"],
          ].map(([label, value, gradient], index) => {
            const width = `${Math.max((Number(value) / cashflowMax) * 100, value > 0 ? 8 : 0)}%`;
            return html`
              <div key=${label}>
                <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                  <span className="font-semibold text-slate-600 dark:text-slate-300">
                    ${label}
                  </span>
                  <span className="font-bold text-slate-950 dark:text-white">
                    ${formatCurrency(value, "idr")}
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
                  <div
                    className=${`report-bar-fill h-full rounded-full bg-gradient-to-r ${gradient}`}
                    style=${{ width, animationDelay: `${index * 120}ms` }}
                  ></div>
                </div>
              </div>
            `;
          })}
        </div>
      </div>

      <div className=${`${PREMIUM_PANEL} report-reveal p-5 md:p-6`}>
        <div className="relative">
          <h3 className="font-display text-lg font-bold text-slate-950 dark:text-white">
            Ritme Pengeluaran
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Pola harian sepanjang ${report.meta.label}.
          </p>
        </div>
        <div className="relative mt-5 flex h-36 items-end gap-1">
          ${report.dailySeries.map((item, index) => {
            const height = Math.max((item.expenseIdr / dailyMax) * 100, item.expenseIdr > 0 ? 10 : 4);
            const showLabel =
              index === 0 ||
              index === report.dailySeries.length - 1 ||
              Number(item.label) % 5 === 0;
            return html`
              <div key=${item.key} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <div className="flex h-24 w-full items-end">
                  <div
                    title=${`${item.tooltipLabel}: ${formatCurrency(item.expenseIdr, "idr")}`}
                    className="report-column w-full rounded-t-xl bg-gradient-to-t from-brand-600 to-emerald-300 dark:from-brand-500 dark:to-emerald-200"
                    style=${{
                      height: `${height}%`,
                      animationDelay: `${index * 18}ms`,
                    }}
                  ></div>
                </div>
                <span className="h-3 text-[9px] font-semibold text-slate-500 dark:text-slate-400">
                  ${showLabel ? item.label : ""}
                </span>
              </div>
            `;
          })}
        </div>
      </div>
    </section>
  `;
}

function MonthlyCategoryBreakdown({ report }) {
  const topCategories = report.categoryBreakdown.slice(0, 5);

  return html`
    <section className=${`${PREMIUM_PANEL} report-reveal p-5 md:p-6`}>
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold text-slate-950 dark:text-white">
            Kategori Terbesar
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Ke mana uang paling banyak pergi.
          </p>
        </div>
      </div>

      ${topCategories.length
        ? html`
            <div className="relative mt-5 grid gap-3">
              ${topCategories.map((item, index) => html`
                <div key=${item.key} className="rounded-2xl border border-slate-200/70 bg-white/50 p-3 dark:border-white/10 dark:bg-slate-800/45">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-950 dark:text-white">
                        ${item.label}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        ${item.count} transaksi
                      </p>
                      <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                        ${Object.entries(item.valueByCurrency || {})
                          .filter(([, amount]) => Number(amount || 0) > 0)
                          .map(([currency, amount]) => formatCurrency(amount, currency))
                          .join(" + ")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-slate-950 dark:text-white">
                        ${formatCurrency(item.valueIdr, "idr")}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        ${formatPercent(item.share)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
                    <div
                      className=${`report-bar-fill h-full rounded-full bg-gradient-to-r ${item.meta.bar}`}
                      style=${{
                        width: `${Math.max(item.share * 100, 6)}%`,
                        animationDelay: `${index * 70}ms`,
                      }}
                    ></div>
                  </div>
                </div>
              `)}
            </div>
          `
        : html`
            <div className="relative mt-5 rounded-2xl border border-dashed border-slate-300/70 bg-white/45 p-5 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-800/35 dark:text-slate-300">
              Belum ada pengeluaran di bulan ini.
            </div>
          `}
    </section>
  `;
}

function MonthlyReportInsights({ report }) {
  const topCategory = report.topCategory;
  const budgetHelper =
    report.budgetInsights.length
      ? `${formatPercent(report.budgetUsage)} terpakai dari total budget bernilai ${formatCurrency(
          report.budgetLimitBaseIdr,
          "idr",
        )}`
      : "Tambahkan budget agar laporan bisa memberi sinyal risiko.";
  const rhythmHelper = report.meta.isCurrentMonth
    ? `Proyeksi akhir bulan ${formatCurrency(report.projectedExpenseIdr, "idr")}.`
    : "Rata-rata real dari bulan yang sudah selesai.";
  const focusHelper =
    topCategory && topCategory.share >= 0.45
      ? `${topCategory.label} mengambil ${formatPercent(topCategory.share)} dari pengeluaran.`
      : topCategory
        ? "Pengeluaran relatif tersebar di beberapa kategori."
        : "Belum ada kategori pengeluaran.";
  const insights = [
    {
      title: "Fokus kategori",
      value: topCategory ? topCategory.label : "-",
      helper: focusHelper,
    },
    {
      title: "Laju harian",
      value: formatCurrency(report.dailyAverageExpenseIdr, "idr"),
      helper: rhythmHelper,
    },
    {
      title: "Budget",
      value: report.budgetStatusLabel,
      helper: budgetHelper,
    },
  ];

  return html`
    <section className="grid gap-3 md:grid-cols-3">
      ${insights.map(
        (item, index) => html`
          <div
            key=${item.title}
            className="cuan-card-soft report-reveal rounded-[22px] p-4"
            style=${{ animationDelay: `${140 + index * 55}ms` }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              ${item.title}
            </p>
            <p className="mt-2 break-words text-base font-black text-slate-950 dark:text-white">
              ${item.value}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
              ${item.helper}
            </p>
          </div>
        `,
      )}
    </section>
  `;
}

function MonthlyReportRecent({ report, onNavigate }) {
  return html`
    <section className=${`${PREMIUM_PANEL} report-reveal p-5 md:p-6`}>
      <div className="relative flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold text-slate-950 dark:text-white">
            Transaksi Bulan Ini
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            5 aktivitas terakhir di ${report.meta.label}.
          </p>
        </div>
        <button
          type="button"
          onClick=${() => onNavigate("history")}
          className="cuan-secondary min-h-11 rounded-2xl px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5"
        >
          Riwayat
        </button>
      </div>

      <div className="relative mt-4 grid gap-2">
        ${report.recentTransactions.map((item) => html`
          <div
            key=${item.id}
            className="grid grid-cols-[1fr_auto] gap-3 rounded-2xl border border-slate-200/70 bg-white/50 p-3 dark:border-white/10 dark:bg-slate-800/45"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-950 dark:text-white">
                ${item.description || TYPE_META[item.type]?.label || "Transaksi"}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                ${formatDateTime(item.occurred_at)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-black text-slate-950 dark:text-white">
                ${getTransactionPreview(item)}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                ${getTransactionTypeLabel(item)}
              </p>
            </div>
          </div>
        `)}
      </div>
    </section>
  `;
}

function MonthlyReportEmptyState({ onNavigate }) {
  return html`
    <section className=${`${PREMIUM_PANEL} report-reveal p-6 text-center md:p-8`}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(16,185,129,0.16),transparent_48%)]"></div>
      <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-brand-300/25 bg-brand-500/12 text-2xl font-black text-brand-700 dark:text-brand-200">
        +
      </div>
      <h3 className="relative mt-4 font-display text-2xl font-bold text-slate-950 dark:text-white">
        Laporan bulan ini masih kosong
      </h3>
      <p className="relative mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-300">
        Tambahkan transaksi agar CUANSYNC bisa membuat cashflow, chart kategori, dan insight bulanan.
      </p>
      <button
        type="button"
        onClick=${() => onNavigate("add")}
        className="relative mt-5 min-h-12 rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_44px_rgba(16,185,129,0.22)] transition hover:-translate-y-0.5 hover:bg-brand-700 dark:bg-emerald-500"
      >
        Tambah transaksi
      </button>
    </section>
  `;
}

function MonthlyReportPage({
  transactions,
  budgets,
  selectedMonthKey,
  onMonthChange,
  onNavigate,
}) {
  const months = useMemo(
    () => getAvailableReportMonths(transactions, selectedMonthKey),
    [transactions, selectedMonthKey],
  );
  const report = useMemo(
    () => buildMonthlyReport(transactions, budgets, selectedMonthKey),
    [transactions, budgets, selectedMonthKey],
  );

  return html`
    <div className="grid gap-4">
      <section className="grid gap-3 md:grid-cols-[1fr_minmax(18rem,24rem)] md:items-end">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Monthly report
          </p>
          <h2 className="mt-2 font-display text-2xl font-black text-slate-950 dark:text-white md:text-3xl">
            Laporan Keuangan Bulanan
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Ringkasan cashflow, budget multi-currency, exchange, kategori, dan ritme pengeluaran dalam satu layar.
          </p>
        </div>
        <${ReportMonthPicker}
          months=${months}
          value=${selectedMonthKey}
          onChange=${onMonthChange}
        />
      </section>

      ${report.hasTransactions
        ? html`
            <${MonthlyReportHero} report=${report} />
            <${MonthlyReportKpis} report=${report} />
            <${MonthlyCurrencySummary} report=${report} />
            <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
              <${MonthlyBudgetPulse} report=${report} />
              <${MonthlyCategoryBreakdown} report=${report} />
            </div>
            <${MonthlyReportInsights} report=${report} />
            <${MonthlyReportCharts} report=${report} />
            <${MonthlyReportRecent} report=${report} onNavigate=${onNavigate} />
          `
        : html`<${MonthlyReportEmptyState} onNavigate=${onNavigate} />`}
    </div>
  `;
}

function ThemeToggle({ theme, onToggle }) {
  return html`
    <button type="button" onClick=${onToggle} className=${GLASS_PILL}>
      ${theme === "dark" ? "Mode Terang" : "Mode Gelap"}
    </button>
  `;
}

function ExpenseChart({ data, monthLabel }) {
  const max = Math.max(...data.map((item) => item.value), 1);

  return html`
    <div className=${`${PREMIUM_PANEL} p-5 md:p-6`}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.14),transparent_45%)] opacity-80"></div>
      <div className="flex items-start justify-between gap-4">
        <div className="relative">
          <h3 className="font-display text-xl font-bold">Dashboard Interaktif</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300/80">
            Grafik harian langsung berubah setiap kali angka transaksi diperbarui.
          </p>
        </div>
        <div className="relative inline-flex rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 backdrop-blur-xl dark:bg-slate-900/40 dark:text-slate-300">
          ${monthLabel}
        </div>
      </div>

      <div className="relative mt-6 overflow-x-auto pb-2">
        <div className="flex min-w-[640px] items-end gap-3">
          ${data.map((item) => {
            const height = Math.max((item.value / max) * 180, item.value > 0 ? 14 : 4);
            return html`
              <div key=${item.key} className="flex w-8 flex-col items-center gap-2">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  ${item.value > 0 ? numberFormatter.format(item.value) : ""}
                </span>
                <div
                  title=${`${item.tooltipLabel}: ${formatCurrency(item.value, "thb")}`}
                  className="chart-bar w-full rounded-t-2xl bg-gradient-to-t from-brand-600 to-emerald-300 dark:from-brand-500 dark:to-emerald-200"
                  style=${{ height: `${height}px` }}
                ></div>
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  ${item.label}
                </span>
              </div>
            `;
          })}
        </div>
      </div>
    </div>
  `;
}

function CategoryBreakdown({ categories, totalMonthlyThb }) {
  return html`
    <div className=${`${PREMIUM_PANEL} p-5 md:p-6`}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.14),transparent_50%)] opacity-80"></div>
      <div className="relative">
          <h3 className="font-display text-xl font-bold">Pengeluaran per Kategori</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300/80">
          Breakdown dibuat dari pengeluaran mata uang aktif yang kamu catat.
        </p>
      </div>

      ${totalMonthlyThb > 0
        ? html`
            <div className="relative mt-5 space-y-3">
              ${categories.map(
                (item) => html`
                  <div
                    key=${item.key}
                    className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-xl dark:bg-slate-900/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className=${`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${item.meta.chip}`}>
                          ${item.label}
                        </div>
                        <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
                          ${formatCurrency(item.valueThb, "thb")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          ${formatPercent(item.share)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          ${item.count} transaksi
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 h-2 rounded-full bg-slate-200/70 dark:bg-slate-800">
                      <div
                        className=${`h-full rounded-full bg-gradient-to-r ${item.meta.bar}`}
                        style=${{
                          width: `${Math.min(
                            Math.max(item.share * 100, item.valueThb > 0 ? 12 : 0),
                            100,
                          )}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                `,
              )}
            </div>
          `
        : html`
            <div className="relative mt-5 rounded-2xl border border-dashed border-white/15 bg-white/5 p-5 text-sm text-slate-600 backdrop-blur-xl dark:bg-slate-900/25 dark:text-slate-300/80">
              Belum ada pengeluaran bulan ini. Begitu kamu input expense, kategori akan langsung tampil di sini.
            </div>
          `}
    </div>
  `;
}

function BudgetTracker({ budgets, monthLabel, onDelete }) {
  return html`
    <div className=${`${PREMIUM_PANEL} p-5 md:p-6`}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),transparent_50%)] opacity-80"></div>
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-xl font-bold">Proteksi Budget</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300/80">
              Batas aman harian dihitung otomatis dari sisa budget dibagi sisa hari.
            </p>
          </div>
          <div className="inline-flex rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 backdrop-blur-xl dark:bg-slate-900/40 dark:text-slate-300">
            ${monthLabel}
          </div>
        </div>
      </div>

      ${budgets.length
        ? html`
            <div className="relative mt-5 space-y-3">
              ${budgets.map(
                (budget) => html`
                  <div
                    key=${budget.id}
                    className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-xl dark:bg-slate-900/40"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className=${`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${budget.meta.chip}`}>
                          ${budget.meta.label}
                        </div>
                        <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
                          Limit ${formatCurrency(budget.limitAmount, budget.currency)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Terpakai ${formatCurrency(budget.spentAmount, budget.currency)} /
                          Sisa ${formatCurrency(Math.max(budget.remainingAmount, 0), budget.currency)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Batas aman hari ini ${formatCurrency(budget.dynamicDailyLimit, budget.currency)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Pengeluaran hari ini ${formatCurrency(budget.spentToday, budget.currency)}
                        </p>
                        <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                          ${budget.todayRemainingSafe >= 0
                            ? `Sisa aman hari ini ${formatCurrency(budget.todayRemainingSafe, budget.currency)}`
                            : `Over hari ini ${formatCurrency(Math.abs(budget.todayRemainingSafe), budget.currency)}`}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          ${budget.remainingDaysAfterToday > 0
                            ? `Jatah harian besok ${formatCurrency(budget.projectedNextDailyLimit, budget.currency)} untuk ${budget.remainingDaysAfterToday} hari tersisa`
                            : "Hari terakhir bulan ini, tidak ada jatah hari berikutnya."}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          ${budget.dailyAdjustment >= 0
                            ? `Jatah harian naik ${formatCurrency(budget.dailyAdjustment, budget.currency)} dari rata-rata awal`
                            : `Jatah harian turun ${formatCurrency(Math.abs(budget.dailyAdjustment), budget.currency)} dari rata-rata awal`}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className=${`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${budget.tone}`}>
                          ${budget.statusLabel}
                        </div>
                        <button
                          type="button"
                          onClick=${() => onDelete(budget)}
                          className="mt-3 block text-sm font-semibold text-rose-600 transition hover:text-rose-500"
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                    <div className="mt-4 h-2 rounded-full bg-slate-200/70 dark:bg-slate-800">
                      <div
                        className=${`h-full rounded-full bg-gradient-to-r ${budget.barClass}`}
                        style=${{
                          width: `${Math.min(
                            Math.max(budget.usage * 100, budget.spentAmount > 0 ? 10 : 0),
                            100,
                          )}%`,
                        }}
                      ></div>
                    </div>
                    ${budget.status === "over"
                      ? html`
                          <p className="mt-3 text-xs font-semibold text-rose-600 dark:text-rose-300">
                            Overspending ${formatCurrency(
                              Math.abs(budget.remainingAmount),
                              budget.currency,
                            )} di atas limit.
                          </p>
                        `
                      : null}
                  </div>
                `,
              )}
            </div>
          `
        : html`
            <div className="relative mt-5 rounded-[24px] border border-dashed border-brand-300/25 bg-brand-400/10 p-6 text-center backdrop-blur-xl dark:border-brand-400/20 dark:bg-brand-500/10">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-brand-300/25 bg-brand-500/12 text-lg font-black text-brand-700 dark:text-brand-200">
                0
              </div>
              <h4 className="mt-4 font-display text-lg font-bold text-slate-950 dark:text-white">
                Budget belum aktif
              </h4>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-600 dark:text-slate-300/80">
                Buat limit uang keluar bulanan agar indikator batas aman harian mulai bekerja.
              </p>
            </div>
          `}
    </div>
  `;
}

function GoalTracker({ goals, onDelete, onContribute }) {
  const [openGoalId, setOpenGoalId] = useState(null);
  const [openAction, setOpenAction] = useState("deposit");
  const [amount, setAmount] = useState("");

  function submitContribution(event, goal) {
    event.preventDefault();
    onContribute(goal, normalizeNumericInput(amount), openAction).then((ok) => {
      if (ok) {
        setAmount("");
        setOpenGoalId(null);
        setOpenAction("deposit");
      }
    });
  }

  return html`
    <div className=${`${PREMIUM_PANEL} p-5 md:p-6`}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.14),transparent_50%)] opacity-80"></div>
      <div className="relative">
        <h3 className="font-display text-xl font-bold">Target Keuangan</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300/80">
          Daftar goal yang sedang kamu kejar, dibuat compact agar nyaman dipantau di mobile.
        </p>
      </div>

      ${goals.length
        ? html`
            <div className="relative mt-5 grid gap-3">
              ${goals.map(
                (goal) => html`
                  <div
                    key=${goal.id}
                    className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 dark:bg-slate-900/40"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                          ${goal.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          ${goal.deadline
                            ? `Deadline ${formatDateTime(`${goal.deadline}T00:00:00`)}`.replace(
                                ", 00.00",
                                "",
                              )
                            : "Tanpa deadline tetap"}
                        </p>
                      </div>
                      <div className=${`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${goal.tone}`}>
                        ${goal.statusLabel}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        ${formatCurrency(goal.savedAmount, "idr")}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Target ${formatCurrency(goal.targetAmount, "idr")}
                      </p>
                    </div>

                    <div className="mt-3 h-2 rounded-full bg-slate-200/70 dark:bg-slate-800">
                      <div
                        className=${`h-full rounded-full bg-gradient-to-r ${goal.barClass}`}
                        style=${{ width: `${Math.max(goal.progress * 100, goal.savedAmount > 0 ? 8 : 0)}%` }}
                      ></div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                      <span>${formatPercent(goal.progress)} tercapai</span>
                      <span>Sisa ${formatCurrency(goal.remainingIdr, "idr")}</span>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick=${() => {
                          setOpenAction("deposit");
                          setOpenGoalId((current) =>
                            current === goal.id ? null : goal.id,
                          );
                        }}
                        className="min-h-11 rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-black text-slate-700 backdrop-blur-xl transition hover:-translate-y-0.5 dark:bg-slate-900/40 dark:text-slate-200"
                      >
                        Setor
                      </button>
                      <button
                        type="button"
                        onClick=${() => {
                          setOpenAction("withdraw");
                          setOpenGoalId((current) =>
                            current === goal.id ? null : goal.id,
                          );
                        }}
                        className="min-h-11 rounded-2xl border border-sky-300/25 bg-sky-400/10 px-3 py-2 text-xs font-black text-sky-700 transition hover:-translate-y-0.5 dark:border-sky-400/20 dark:bg-sky-500/10 dark:text-sky-200"
                      >
                        Tarik
                      </button>
                      <button
                        type="button"
                        onClick=${() => onDelete(goal)}
                        className="min-h-11 rounded-2xl border border-rose-300/25 bg-rose-400/10 px-3 py-2 text-xs font-black text-rose-700 transition hover:-translate-y-0.5 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200"
                      >
                        Hapus
                      </button>
                    </div>

                    ${openGoalId === goal.id
                      ? html`
                          <form
                            className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]"
                            onSubmit=${(event) => submitContribution(event, goal)}
                          >
                            <input
                              type="text"
                              inputMode="decimal"
                              autoComplete="off"
                              placeholder=${openAction === "withdraw"
                                ? "Jumlah tarik (IDR)"
                                : "Jumlah setor (IDR)"}
                              value=${amount}
                              onChange=${(event) =>
                                setAmount(formatNumericInput(event.target.value))}
                              className=${GLASS_INPUT}
                            />
                            <button
                              type="submit"
                              className="rounded-2xl border border-white/10 bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-brand-700"
                            >
                              ${openAction === "withdraw" ? "Tarik" : "Setor"}
                            </button>
                          </form>
                        `
                      : null}
                  </div>
                `,
              )}
            </div>
          `
        : html`
            <div className="relative mt-5 rounded-2xl border border-dashed border-white/15 bg-white/5 p-5 text-sm text-slate-600 backdrop-blur-xl dark:bg-slate-900/25 dark:text-slate-300/80">
              Belum ada target keuangan. Tambahkan goal pertama agar CUANSYNC bisa menghitung progress dan sisa yang perlu dikejar.
            </div>
          `}
    </div>
  `;
}

function ExchangeSummaryPanel({ activeExchange, currentMonthLabel, monthlyExpenseThb }) {
  return html`
    <div className=${`${PREMIUM_PANEL} p-5 md:p-6`}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),transparent_50%)] opacity-80"></div>
      <div className="relative">
        <h3 className="font-display text-xl font-bold">Ringkasan Kurs & Modal</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300/80">
          Exchange ber-rate menjadi fondasi valuasi base currency untuk pengeluaran multi-currency.
        </p>
      </div>

      <div className="relative mt-5 space-y-3">
        ${activeExchange
          ? html`
              <div className="rounded-2xl border border-brand-300/25 bg-brand-400/10 p-4 backdrop-blur-xl dark:border-brand-300/20 dark:bg-brand-500/10">
                <p className="text-sm font-semibold text-brand-800 dark:text-brand-200">Rate aktif terakhir</p>
                <p className="mt-2 text-lg font-bold text-brand-900 dark:text-white">
                  ${formatCurrency(activeExchange.from_amount, activeExchange.from_currency)} ->
                  ${formatCurrency(activeExchange.to_amount, activeExchange.to_currency)}
                </p>
                <p className="mt-2 text-sm text-brand-800 dark:text-brand-200">
                  ${formatRate(activeExchange.rate || activeExchange.locked_rate, activeExchange.from_currency, activeExchange.to_currency)}
                </p>
              </div>
            `
          : html`
              <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-4 text-sm text-slate-600 backdrop-blur-xl dark:bg-slate-900/25 dark:text-slate-300/80">
                Belum ada exchange ber-rate. Tambahkan transaksi Tukar Mata Uang agar valuasi pengeluaran foreign currency bisa terkunci.
              </div>
            `}

        <div className="rounded-2xl border border-slate-900/[0.08] bg-white/[0.68] p-4 shadow-[0_12px_30px_rgba(15,23,42,0.07)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/40">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Total uang keluar ${currentMonthLabel}
          </p>
          <p className="mt-3 text-2xl font-black tracking-[-0.05em] text-slate-950 dark:text-white">
            ${formatCurrency(monthlyExpenseThb, "thb")}
          </p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300/80">
            Angka ini adalah total seluruh transaksi uang keluar di bulan berjalan.
          </p>
        </div>
      </div>
    </div>
  `;
}

function SubmitActionBar({
  label,
  loadingLabel = "Menyimpan...",
  loading,
  disabled = false,
}) {
  const isDisabled = loading || disabled;

  return html`
    <div className="cuan-card-soft mt-5 rounded-[24px] p-2 md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none">
      <button
        type="submit"
        disabled=${isDisabled}
        className="min-h-12 w-full rounded-2xl border border-white/10 bg-brand-600 px-4 py-3.5 text-sm font-semibold text-white shadow-[0_20px_50px_rgba(16,185,129,0.22)] transition duration-300 ease-out hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-[0_28px_70px_rgba(16,185,129,0.28)] disabled:cursor-not-allowed disabled:bg-slate-400 disabled:opacity-60 disabled:shadow-none dark:disabled:bg-slate-700"
      >
        ${loading ? loadingLabel : label}
      </button>
    </div>
  `;
}

function SummaryCards({ summary }) {
  const cards = [
    {
      title: "Total uang masuk",
      value: formatCurrency(summary.totalIncomeIdr, "idr"),
      tone: "text-emerald-700 dark:text-emerald-300",
      halo: "from-emerald-300/30 to-transparent",
    },
    {
      title: "Total uang keluar",
      value: formatCurrency(summary.totalExpenseIdr, "idr"),
      tone: "text-amber-700 dark:text-amber-300",
      halo: "from-amber-300/26 to-transparent",
    },
    {
      title: "Transfer / Exchange",
      value: formatCurrency(summary.totalExchangeIdr, "idr"),
      helper: `${summary.exchangeCount} transaksi`,
      tone: "text-sky-700 dark:text-sky-300",
      halo: "from-sky-300/26 to-transparent",
    },
    {
      title: "Saldo bersih",
      value: formatCurrency(summary.netIdr, "idr"),
      tone:
        summary.netIdr >= 0
          ? "text-brand-700 dark:text-brand-300"
          : "text-rose-700 dark:text-rose-300",
      halo:
        summary.netIdr >= 0
          ? "from-brand-300/28 to-transparent"
          : "from-rose-300/26 to-transparent",
    },
    {
      title: "Transaksi tampil",
      value: `${summary.count}`,
      tone: "text-slate-950 dark:text-white",
      halo: "from-sky-300/24 to-transparent",
    },
  ];

  return html`
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      ${cards.map(
        (card) => html`
          <div
            key=${card.title}
            className="cuan-card-soft relative overflow-hidden rounded-[24px] p-4"
          >
            <div className=${`pointer-events-none absolute -right-12 -top-16 h-36 w-36 rounded-full bg-gradient-to-br ${card.halo} blur-3xl`}></div>
            <div className="relative">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                ${card.title}
              </p>
              <p className=${`mt-3 break-words text-2xl font-black tracking-[-0.02em] ${card.tone}`}>
                ${card.value}
              </p>
              ${card.helper
                ? html`
                    <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      ${card.helper}
                    </p>
                  `
                : null}
            </div>
          </div>
        `,
      )}
    </div>
  `;
}

function TransactionFilter({
  filters,
  onChange,
  onReset,
  categoryOptions,
  currencyOptions = getHistoryCurrencyOptions(),
  showSearch = true,
}) {
  function updateFilter(field, value) {
    onChange((current) => ({ ...current, [field]: value }));
  }

  return html`
    <section className=${`${PREMIUM_PANEL_SOFT} p-4 md:p-5`}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),transparent_50%)] opacity-80"></div>
      <div className="relative grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        ${showSearch
          ? html`
              <label className="block md:col-span-2 xl:col-span-4">
                <span className="mb-2 block text-sm font-medium">Cari catatan</span>
                <input
                  type="search"
                  autoComplete="off"
                  placeholder="Cari dari deskripsi atau catatan"
                  value=${filters.search}
                  onChange=${(event) => updateFilter("search", event.target.value)}
                  className=${GLASS_INPUT}
                />
              </label>
            `
          : null}

        <label className="block">
          <span className="mb-2 block text-sm font-medium">Dari tanggal</span>
          <input
            type="date"
            value=${filters.startDate}
            onChange=${(event) => updateFilter("startDate", event.target.value)}
            className=${GLASS_INPUT}
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium">Sampai tanggal</span>
          <input
            type="date"
            value=${filters.endDate}
            onChange=${(event) => updateFilter("endDate", event.target.value)}
            className=${GLASS_INPUT}
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium">Tipe transaksi</span>
          <select
            value=${filters.type}
            onChange=${(event) => updateFilter("type", event.target.value)}
            className=${GLASS_INPUT}
          >
            ${HISTORY_TYPE_OPTIONS.map(
              (option) => html`
                <option key=${option.value} value=${option.value}>
                  ${option.label}
                </option>
              `,
            )}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium">Kategori</span>
          <select
            value=${filters.category}
            onChange=${(event) => updateFilter("category", event.target.value)}
            className=${GLASS_INPUT}
          >
            ${categoryOptions.map(
              (option) => html`
                <option key=${option.value} value=${option.value}>
                  ${option.label}
                </option>
              `,
            )}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium">Mata uang</span>
          <select
            value=${filters.currency}
            onChange=${(event) => updateFilter("currency", event.target.value)}
            className=${GLASS_INPUT}
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
          <span className="mb-2 block text-sm font-medium">Nominal minimum</span>
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            value=${filters.minAmount}
            onChange=${(event) =>
              updateFilter("minAmount", formatNumericInput(event.target.value))}
            className=${GLASS_INPUT}
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium">Nominal maksimum</span>
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            value=${filters.maxAmount}
            onChange=${(event) =>
              updateFilter("maxAmount", formatNumericInput(event.target.value))}
            className=${GLASS_INPUT}
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium">Urutkan</span>
          <select
            value=${filters.sortBy}
            onChange=${(event) => updateFilter("sortBy", event.target.value)}
            className=${GLASS_INPUT}
          >
            ${HISTORY_SORT_OPTIONS.map(
              (option) => html`
                <option key=${option.value} value=${option.value}>
                  ${option.label}
                </option>
              `,
            )}
          </select>
        </label>

        <div className="flex items-end">
          <button
            type="button"
            onClick=${onReset}
            className="cuan-secondary min-h-12 w-full rounded-2xl px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5"
          >
            Reset filter
          </button>
        </div>
      </div>
    </section>
  `;
}

function getTransactionIconLabel(transaction) {
  const flow = getTransactionFlow(transaction);
  if (flow === "income") return "IN";
  if (flow === "exchange") return "FX";
  const category = String(transaction.category || "");
  const match = CATEGORY_OPTIONS.find((item) => item.value === category);
  if (!match) return "OUT";
  return match.label
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getHistoryTransactionEmoji(transaction) {
  const flow = getTransactionFlow(transaction);
  if (flow === "exchange") return "🔄";
  if (flow === "income") return "💰";
  const category = String(transaction.category || "");
  const categoryLabel = getCategoryMeta(category).label;
  return HISTORY_CATEGORY_EMOJI[category] || HISTORY_CATEGORY_EMOJI[categoryLabel] || "🧾";
}

function getTransactionTone(transaction) {
  const flow = getTransactionFlow(transaction);
  if (flow === "income") {
    return {
      icon: "bg-emerald-100 text-emerald-700 ring-emerald-400/20 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-300/15",
      historyIcon: "bg-emerald-50 ring-emerald-200/75 dark:bg-emerald-400/10 dark:ring-emerald-300/20",
      amount: "text-emerald-700 dark:text-emerald-300",
      chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    };
  }
  if (flow === "exchange") {
    return {
      icon: "bg-sky-100 text-sky-700 ring-sky-400/20 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-300/15",
      historyIcon: "bg-sky-50 ring-sky-200/75 dark:bg-sky-400/10 dark:ring-sky-300/20",
      amount: "text-sky-700 dark:text-sky-300",
      chip: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
    };
  }
  return {
    icon: "bg-amber-100 text-amber-700 ring-amber-400/20 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-300/15",
    historyIcon: "bg-amber-50 ring-amber-200/75 dark:bg-amber-400/10 dark:ring-amber-300/20",
    amount: "text-rose-700 dark:text-rose-300",
    chip: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  };
}

function getTransactionDisplayTitle(transaction) {
  const isExchange = getTransactionFlow(transaction) === "exchange";
  return (
    transaction.description ||
    (isExchange ? getExchangeTitle(transaction) : TYPE_META[transaction.type]?.label) ||
    "Transaksi"
  );
}

function getTransactionCompactAmount(transaction, fallbackRate = 0) {
  const flow = getTransactionFlow(transaction);
  const currency = getTransactionCurrency(transaction);
  const mainAmount = getTransactionMainAmount(transaction);
  if (flow === "income") {
    return {
      primary: `+${formatCurrency(mainAmount, currency)}`,
      secondary: currency.toUpperCase(),
    };
  }
  if (flow === "expense") {
    const valuationIdr = getTransactionIdrValuationWithRate(transaction, fallbackRate);
    return {
      primary: `-${formatCurrency(mainAmount, currency)}`,
      secondary:
        currency !== DEFAULT_BASE_CURRENCY && valuationIdr != null
          ? `Valuasi ${formatCurrency(valuationIdr, "idr")}`
          : currency.toUpperCase(),
    };
  }

  return {
    primary: `-${formatCurrency(transaction.from_amount, transaction.from_currency)}`,
    secondary: `+${formatCurrency(transaction.to_amount, transaction.to_currency)}`,
  };
}

function TransactionItem({ transaction, onOpen, fallbackRate = 0 }) {
  const tone = getTransactionTone(transaction);
  const compactAmount = getTransactionCompactAmount(transaction, fallbackRate);
  const title = getTransactionDisplayTitle(transaction);
  const categoryLabel = getTransactionCategoryLabel(transaction);
  const flow = getTransactionFlow(transaction);

  return html`
    <button
      type="button"
      onClick=${() => onOpen(transaction)}
      className="history-transaction-item transaction-item group grid min-h-[76px] w-full grid-cols-[44px_1fr_auto] items-center gap-3 rounded-[22px] border border-slate-200/70 bg-white/60 px-3 py-2.5 text-left shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:border-brand-300/30 hover:bg-white/82 dark:border-white/10 dark:bg-slate-900/52 dark:shadow-black/20 dark:hover:bg-slate-900/75"
      aria-label=${`Buka detail ${title}`}
    >
      <span className=${`history-icon-badge flex h-11 w-11 items-center justify-center rounded-2xl text-[21px] leading-none ring-1 transition duration-300 group-hover:scale-105 ${tone.historyIcon}`}>
        ${getHistoryTransactionEmoji(transaction)}
      </span>

      <span className="min-w-0">
        <span className="history-item-title block truncate text-sm font-black text-slate-950 dark:text-white">
          ${title}
        </span>
        <span className="history-item-meta mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          <span className=${`history-chip max-w-[8rem] truncate rounded-full px-2 py-0.5 ${tone.chip}`}>
            ${flow === "exchange" ? "Exchange" : categoryLabel}
          </span>
          <span>${formatShortDateTime(transaction.occurred_at)}</span>
        </span>
      </span>

      <span className="min-w-0 text-right">
        <span className=${`block max-w-[8.5rem] truncate text-sm font-black ${tone.amount}`}>
          ${compactAmount.primary}
        </span>
        <span className="history-item-secondary mt-1 block max-w-[8.5rem] truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
          ${compactAmount.secondary}
        </span>
      </span>
    </button>
  `;
}

function TransactionEditForm({
  transaction,
  form,
  onChange,
  onSave,
  onCancel,
  loading = false,
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [exchangeAutoTarget, setExchangeAutoTarget] = useState("to_amount");
  const flow = form.type || getTransactionFlow(transaction);
  const isIncome = flow === "income";
  const isExpense = flow === "expense";
  const isExchange = flow === "exchange";
  const baseCurrency = getBaseCurrency();
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
    getActiveCurrencies(),
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
          className=${GLASS_INPUT}
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
                  className=${GLASS_INPUT}
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
                  className=${GLASS_INPUT}
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
                className=${GLASS_INPUT}
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
                className=${GLASS_INPUT}
              />
            </label>

            <label className="block space-y-2">
              <span className="block text-xs font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                Rate ${form.from_currency} / 1 ${form.to_currency}
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
                className=${GLASS_INPUT}
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
                className=${GLASS_INPUT}
              />
            </label>

            ${isExpense && isForeign
              ? html`
                  <div className="rounded-2xl border border-sky-300/25 bg-sky-400/10 px-4 py-3 text-xs leading-5 text-sky-900 dark:border-sky-300/20 dark:bg-sky-500/10 dark:text-sky-200">
                    ${lockedRate > 0
                      ? `Valuasi memakai rate tersimpan ${formatRate(
                          lockedRate,
                          baseCurrency,
                          transactionCurrency,
                        )}.`
                      : `Valuasi ${baseCurrency} akan mengikuti exchange terakhir yang relevan.`}
                  </div>
                `
              : null}
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
          className=${GLASS_INPUT}
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

function TransactionDetailSheet({
  transaction,
  onClose,
  onDelete,
  onUpdate,
  fallbackRate = 0,
  loading = false,
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
        ["Rate", rateText],
        ["Tanggal", formatShortDateTime(transaction.occurred_at)],
      ]
    : [
        ["Tanggal", formatShortDateTime(transaction.occurred_at)],
        ["Kategori", categoryLabel],
        ["Mata uang", currencyLabel],
        ["Rate", rateText],
      ];
  const receiptHelper = isExchange
    ? "Perpindahan aset, bukan income atau expense"
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
              />
            `
          : html`
              <div className="history-receipt-card mt-5 overflow-hidden rounded-[28px] p-4">
                <div className="flex items-start gap-3">
                  <span className=${`flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] text-2xl ring-1 ${tone.historyIcon}`}>
                    ${getHistoryTransactionEmoji(transaction)}
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

function TransactionFilterTabs({ value, onChange }) {
  return html`
    <div className="cuan-segment grid grid-cols-4 gap-1 rounded-[22px] p-1">
      ${TRANSACTION_FILTER_TABS.map((tab) => {
        const active = value === tab.value;
        return html`
          <button
            key=${tab.value}
            type="button"
            onClick=${() => onChange(tab.value)}
            className=${`min-h-11 rounded-2xl px-2 text-xs font-black transition duration-300 ${active ? "bg-brand-600 text-white shadow-[0_14px_34px_rgba(16,185,129,0.22)] dark:bg-emerald-500" : "text-slate-600 hover:bg-white/75 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"}`}
          >
            ${tab.label}
          </button>
        `;
      })}
    </div>
  `;
}

function TransactionList({
  transactions,
  onDelete,
  onUpdate,
  loading = false,
  activeCurrencies = getActiveCurrencies(),
  title = "Aktivitas Terakhir",
  description = "Semua perubahan angka langsung menggerakkan chart, kategori, dan budget.",
  emptyMessage = "Belum ada transaksi.",
}) {
  const [filters, setFilters] = useState(DEFAULT_TRANSACTION_FILTERS);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const categoryOptions = useMemo(
    () => getHistoryCategoryOptions(transactions),
    [transactions],
  );
  const currencyOptions = useMemo(
    () => getHistoryCurrencyOptions(activeCurrencies),
    [activeCurrencies],
  );
  const filteredTransactions = useMemo(
    () => filterAndSortTransactions(transactions, filters),
    [transactions, filters],
  );
  const summary = useMemo(
    () => computeTransactionSummary(filteredTransactions, transactions),
    [filteredTransactions, transactions],
  );
  const groupedTransactions = useMemo(
    () => groupTransactionsByDay(filteredTransactions),
    [filteredTransactions],
  );
  const latestRate = useMemo(
    () => getLatestRateUntil(transactions, new Date(8640000000000000)),
    [transactions],
  );
  const hasFilters = hasActiveTransactionFilters(filters);

  useEffect(() => {
    setFilters((current) => {
      if (
        current.currency === "all" ||
        activeCurrencies.includes(normalizeCurrencyCode(current.currency))
      ) {
        return current;
      }
      return { ...current, currency: "all" };
    });
  }, [activeCurrencies.join("|")]);

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function resetFilters() {
    setFilters({ ...DEFAULT_TRANSACTION_FILTERS });
  }

  return html`
    <div className="grid gap-5">
      <section className=${`${PREMIUM_PANEL} p-5 md:p-6`}>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),transparent_50%)] opacity-80"></div>
        <div className="relative">
          <h3 className="font-display text-2xl font-bold tracking-[-0.02em]">${title}</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300/80">
            ${description}
          </p>
        </div>
      </section>

      <${SummaryCards} summary=${summary} />

      <section className="history-filter-panel sticky top-3 z-20 rounded-[26px] border border-slate-200/70 bg-white/82 p-3 shadow-[0_18px_50px_rgba(15,23,42,0.10)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/82 dark:shadow-black/30">
        <div className="grid gap-3">
          <input
            type="search"
            autoComplete="off"
            placeholder="Cari transaksi"
            value=${filters.search}
            onChange=${(event) => updateFilter("search", event.target.value)}
            className=${GLASS_INPUT}
          />
          <${TransactionFilterTabs}
            value=${filters.type}
            onChange=${(value) => updateFilter("type", value)}
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              ${filteredTransactions.length} dari ${transactions.length} transaksi
            </p>
            <button
              type="button"
              onClick=${() => setShowAdvancedFilters((current) => !current)}
              className="cuan-secondary min-h-11 rounded-2xl px-4 py-2 text-xs font-black transition hover:-translate-y-0.5"
            >
              ${showAdvancedFilters ? "Tutup filter" : "Filter lanjutan"}
            </button>
          </div>
        </div>
      </section>

      ${showAdvancedFilters
        ? html`
            <${TransactionFilter}
              filters=${filters}
              onChange=${setFilters}
              onReset=${resetFilters}
              categoryOptions=${categoryOptions}
              currencyOptions=${currencyOptions}
              showSearch=${false}
            />
          `
        : null}

      <section className="history-list-panel relative overflow-hidden rounded-[30px] p-3 md:p-5">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),transparent_50%)] opacity-80"></div>
        ${filteredTransactions.length
          ? html`
              <div className="relative grid gap-5">
                ${groupedTransactions.map(
                  (group) => html`
                    <div key=${group.key} className="grid gap-3">
                      <div className="history-date-header relative z-0 mt-1 flex items-center justify-between rounded-2xl border border-slate-200/65 bg-white/80 px-3 py-2 text-xs font-black text-slate-600 shadow-[0_10px_28px_rgba(15,23,42,0.06)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/78 dark:text-slate-300">
                        <span>${group.label}</span>
                        <span>${group.transactions.length}</span>
                      </div>
                      <div className="grid gap-2.5">
                        ${group.transactions.map(
                          (transaction) => html`
                            <${TransactionItem}
                              key=${transaction.id}
                              transaction=${transaction}
                              onOpen=${setSelectedTransaction}
                              fallbackRate=${latestRate}
                            />
                          `,
                        )}
                      </div>
                    </div>
                  `,
                )}
              </div>
            `
          : html`
              <div className="relative rounded-[24px] border border-dashed border-slate-300/70 bg-white/52 p-6 text-center backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/25 md:p-8">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-brand-300/25 bg-brand-500/10 text-xl font-black text-brand-700 dark:border-brand-300/20 dark:text-brand-300">
                  0
                </div>
                <h4 className="mt-4 font-display text-xl font-bold text-slate-950 dark:text-white">
                  ${transactions.length ? "Tidak ada transaksi yang cocok" : emptyMessage}
                </h4>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-300/80">
                  ${transactions.length
                    ? "Coba longgarkan tanggal, kategori, nominal, atau kata kunci pencarian."
                    : "Begitu ada uang masuk atau uang keluar, daftar detailnya akan tampil di sini."}
                </p>
                ${hasFilters
                  ? html`
                      <button
                        type="button"
                        onClick=${resetFilters}
                        className="mt-5 min-h-12 rounded-2xl border border-white/10 bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_44px_rgba(16,185,129,0.18)] transition hover:-translate-y-0.5 hover:bg-brand-700"
                      >
                        Reset filter
                      </button>
                    ` 
                  : null}
              </div>
            `}
      </section>

      <${TransactionDetailSheet}
        transaction=${selectedTransaction}
        onClose=${() => setSelectedTransaction(null)}
        onDelete=${onDelete}
        onUpdate=${onUpdate}
        fallbackRate=${latestRate}
        loading=${loading}
      />
    </div>
  `;
}

function AuthScreen({ onGoogleLogin, onDemoLogin, supabaseReady }) {
  return html`
    <main className="relative isolate min-h-screen overflow-hidden px-4 py-8 md:px-6 lg:px-8">
      <${PremiumMeshBackground} />
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center justify-center">
        <section className=${`${PREMIUM_PANEL} w-full p-7 md:p-8`}>
          <div className="inline-flex rounded-full border border-white/10 bg-brand-600 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white shadow-[0_10px_30px_rgba(16,185,129,0.18)]">
            ${APP_NAME}
          </div>
          <h1 className="mt-5 font-display text-3xl font-bold text-slate-950 dark:text-white">
            Masuk
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300/80">
            Catat pengeluaran harian dengan cepat.
          </p>

          <div className="mt-8 space-y-3">
            <button
              type="button"
              onClick=${onGoogleLogin}
              disabled=${!supabaseReady}
              className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3.5 text-sm font-semibold text-white shadow-[0_20px_50px_rgba(15,23,42,0.22)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(15,23,42,0.28)] disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-white dark:text-slate-950 dark:disabled:bg-slate-800"
            >
              ${supabaseReady ? "Masuk dengan Google" : "Google login belum siap"}
            </button>
            <button
              type="button"
              onClick=${onDemoLogin}
              className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3.5 text-sm font-semibold text-slate-900 backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:border-white/20 dark:bg-slate-900/40 dark:text-slate-100"
            >
              Coba Demo Lokal
            </button>
          </div>

          <p className="mt-5 text-xs leading-6 text-slate-500 dark:text-slate-400">
            ${supabaseReady
              ? "Demo tetap tersedia kalau kamu ingin langsung mencoba alurnya."
              : "Supabase belum aktif. Demo lokal tetap bisa langsung dipakai."}
          </p>
        </section>
      </div>
    </main>
  `;
}

function DailyExpenseForm({
  onSubmit,
  loading,
  budget,
  todaySpentThb,
  todaySpentIdr,
  todaySpentCurrency = todaySpentThb,
  expenseCurrency = DEFAULT_BASE_CURRENCY,
}) {
  const [form, setForm] = useState({
    description: "",
    category: DEFAULT_CATEGORY,
    amount_thb: "",
  });
  const dailyCurrency = normalizeCurrencyCode(expenseCurrency);
  const hasBudget = Boolean(budget);

  const statusTone = !budget
    ? "border-slate-300/20 bg-slate-400/10 text-slate-900 dark:border-slate-400/20 dark:bg-slate-500/10 dark:text-slate-200"
    : budget.status === "over" || budget.todayRemainingSafe < 0
      ? "border-rose-300/20 bg-rose-400/10 text-rose-900 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200"
      : budget.status === "warning"
        ? "border-amber-300/20 bg-amber-400/10 text-amber-900 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200"
        : "border-emerald-300/20 bg-emerald-400/10 text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200";
  const statusLabel = !budget
    ? "Belum ada budget"
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
  const parsedAmount = Number(normalizeNumericInput(form.amount_thb));
  const submitDisabled = parsedAmount <= 0;

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const succeeded = await onSubmit({
      type: "expense",
      occurred_at: new Date().toISOString(),
      description: form.description.trim(),
      category_group: hasBudget ? UNIVERSAL_BUDGET_GROUP : null,
      category: form.category,
      currency: dailyCurrency,
      amount: normalizeNumericInput(form.amount_thb),
      amount_idr: dailyCurrency === "IDR" ? normalizeNumericInput(form.amount_thb) : null,
      amount_thb: dailyCurrency === "THB" ? normalizeNumericInput(form.amount_thb) : null,
      exchange_rate: null,
      expense_currency: dailyCurrency,
    });

    if (succeeded) {
      setForm({
        description: "",
        category: DEFAULT_CATEGORY,
        amount_thb: "",
      });
    }
  }

  return html`
    <div className=${`${PREMIUM_PANEL} p-4 md:p-6`}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),transparent_50%)] opacity-80"></div>
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold md:text-xl">Pengeluaran Hari Ini</h3>
            <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300/80">
              Catat pengeluaran cepat tanpa buka form lengkap.
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

      <div className="relative mt-4 rounded-2xl border border-slate-200/70 bg-white/58 p-3.5 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/40">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className=${`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusTone}`}>
            ${statusLabel}
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              Pengingat hari ini
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
              ${budget ? `Batas ${todayLimit}` : `Atur budget ${dailyCurrency} lewat Kontrol`}
            </p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="min-w-0 rounded-2xl border border-slate-200/60 bg-white/50 px-3 py-3 dark:border-white/10 dark:bg-slate-950/30">
            <p className="truncate text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
              Terpakai
            </p>
            <p className="mt-1.5 truncate text-sm font-black text-slate-950 dark:text-white md:text-lg">
              ${formatCurrency(todaySpentCurrency, dailyCurrency)}
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
              Valuasi IDR
            </p>
            <p className="mt-1.5 truncate text-sm font-black text-slate-950 dark:text-white md:text-lg">
              ${todaySpentIdr > 0 ? formatCurrency(todaySpentIdr, "idr") : "-"}
            </p>
          </div>
        </div>
      </div>

      <form className="relative mt-4 grid gap-3.5" onSubmit=${handleSubmit}>
        <label className="block">
          <span className="mb-2 block text-sm font-medium">Jumlah (${dailyCurrency})</span>
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            required
            value=${form.amount_thb}
            onChange=${(event) =>
              updateField("amount_thb", formatNumericInput(event.target.value))}
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

        <label className="block">
          <span className="mb-2 block text-sm font-medium">Catatan</span>
          <input
            type="text"
            placeholder="Contoh: makan siang"
            value=${form.description}
            onChange=${(event) => updateField("description", event.target.value)}
            className=${GLASS_INPUT}
          />
        </label>

        <${SubmitActionBar}
          label="Simpan pengeluaran"
          loading=${loading}
          disabled=${submitDisabled}
        />
      </form>
    </div>
  `;
}

function DailyBudgetGuard({
  budget,
  todaySpentThb,
  todaySpentIdr,
  monthLabel,
  currency = DEFAULT_BASE_CURRENCY,
  todaySpentCurrency = todaySpentThb,
}) {
  const budgetCurrency = normalizeCurrencyCode(budget?.currency || currency);
  const statusTone = !budget
    ? "border-slate-300/20 bg-slate-400/10 text-slate-900 dark:border-slate-400/20 dark:bg-slate-500/10 dark:text-slate-200"
    : budget.status === "over" || budget.todayRemainingSafe < 0
      ? "border-rose-300/20 bg-rose-400/10 text-rose-900 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200"
      : budget.status === "warning"
        ? "border-amber-300/20 bg-amber-400/10 text-amber-900 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200"
        : "border-emerald-300/20 bg-emerald-400/10 text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200";

  const statusLabel = !budget
    ? "Belum ada budget"
    : budget.todayRemainingSafe < 0
      ? "Lewat batas hari ini"
      : budget.status === "warning"
        ? "Mendekati batas"
        : "Masih aman";

  const todayLimit = budget ? formatCurrency(budget.dynamicDailyLimit, budgetCurrency) : "-";
  const safeRemaining = budget
    ? budget.todayRemainingSafe >= 0
      ? formatCurrency(budget.todayRemainingSafe, budgetCurrency)
      : `- ${formatCurrency(Math.abs(budget.todayRemainingSafe), budgetCurrency)}`
    : "-";

  return html`
    <div className=${`${PREMIUM_PANEL} p-5 md:p-6`}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),transparent_50%)] opacity-80"></div>
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-xl font-bold">Proteksi Harian</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300/80">
              Ringkasan cepat supaya kamu langsung tahu ritme hari ini.
            </p>
          </div>
          <div className="inline-flex rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600 backdrop-blur-xl dark:bg-slate-900/40 dark:text-slate-300">
            ${monthLabel}
          </div>
        </div>

        <div className=${`mt-5 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusTone}`}>
          ${statusLabel}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-xl dark:bg-slate-900/40">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Terpakai hari ini
            </p>
            <p className="mt-3 text-3xl font-black text-slate-950 dark:text-white">
              ${formatCurrency(todaySpentCurrency, budgetCurrency)}
            </p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300/80">
              ${todaySpentIdr > 0 ? formatCurrency(todaySpentIdr, "idr") : "Belum ada valuasi IDR"}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-xl dark:bg-slate-900/40">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Batas aman hari ini
            </p>
            <p className="mt-3 text-3xl font-black text-slate-950 dark:text-white">
              ${todayLimit}
            </p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300/80">
              ${budget
                ? `Sisa aman ${safeRemaining}`
                : "Atur budget bulanan supaya guard aktif."}
            </p>
          </div>
        </div>

        ${budget
          ? html`
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-xl dark:bg-slate-900/40">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-600 dark:text-slate-300/80">
                    Budget bulan ini
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    ${formatCurrency(budget.spentAmount, budgetCurrency)} / ${formatCurrency(
                      budget.limitAmount,
                      budgetCurrency,
                    )}
                  </span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-slate-200/70 dark:bg-slate-800">
                  <div
                    className=${`h-full rounded-full bg-gradient-to-r ${budget.barClass}`}
                    style=${{
                      width: `${Math.min(
                        Math.max(budget.usage * 100, budget.spentAmount > 0 ? 8 : 0),
                        100,
                      )}%`,
                    }}
                  ></div>
                </div>
              </div>
            `
          : null}
      </div>
    </div>
  `;
}

function InvestmentSnapshot({ metrics, onAddGoal }) {
  const totalSaved = Number(metrics.totalGoalSaved || 0);
  const totalTarget = Number(metrics.totalGoalTarget || 0);
  const nextGoal = metrics.nextGoal;
  const progress = totalTarget > 0 ? Math.min(totalSaved / totalTarget, 1) : 0;
  const activeGoalCount = metrics.goalInsights.filter(
    (goal) => goal.status !== "done",
  ).length;
  const totalTrackedAssets =
    Number(metrics.balanceIdr || 0) +
    totalSaved +
    Number(metrics.foreignBalanceValuationIdr || 0);
  const nextGoalDailyNeed =
    nextGoal?.daysLeft > 0 && nextGoal.remainingIdr > 0
      ? nextGoal.remainingIdr / nextGoal.daysLeft
      : 0;
  const statItems = [
    {
      label: "Aset tercatat",
      value: formatCurrency(totalTrackedAssets, "idr"),
      helper: "Saldo tersedia + goals + valuasi mata uang aktif",
    },
    {
      label: "Dana goals",
      value: formatCurrency(totalSaved, "idr"),
      helper: `${formatPercent(progress)} dari target`,
    },
    {
      label: "Saldo tersedia",
      value: formatCurrency(metrics.balanceIdr, "idr"),
      helper: "Bisa dipakai atau dialokasikan",
    },
    {
      label: "Target aktif",
      value: String(activeGoalCount),
      helper: activeGoalCount ? "Sedang dikejar" : "Belum ada target aktif",
    },
  ];

  return html`
    <div className=${`${PREMIUM_PANEL} p-5 md:p-6`}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(16,185,129,0.14),transparent_46%)] opacity-80"></div>
      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-brand-700 dark:text-brand-200">
              Aset & Goals
            </p>
            <h3 className="mt-2 font-display text-2xl font-black text-slate-950 dark:text-white">
              Pusat pertumbuhan uangmu
            </h3>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300/80">
              Pantau uang yang tersedia, dana yang sudah dikunci untuk target, dan tujuan berikutnya dalam satu layar.
            </p>
          </div>
          <button
            type="button"
            onClick=${onAddGoal}
            className="history-action-primary hidden min-h-11 shrink-0 rounded-2xl px-4 py-2.5 text-sm font-black transition hover:-translate-y-0.5 sm:inline-flex sm:items-center"
          >
            Tambah target
          </button>
        </div>
      </div>

      <div className="relative mt-5 grid gap-3 sm:grid-cols-2">
        ${statItems.map(
          (item) => html`
            <div
              key=${item.label}
              className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-xl dark:bg-slate-900/40"
            >
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                ${item.label}
              </p>
              <p className="mt-2 text-xl font-black text-slate-950 dark:text-white">
                ${item.value}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                ${item.helper}
              </p>
            </div>
          `,
        )}
      </div>

      <div className="relative mt-4 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-xl dark:bg-slate-900/40">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Progress semua target
            </p>
            <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">
              ${formatPercent(progress)}
            </p>
          </div>
          <p className="text-right text-sm font-semibold text-slate-600 dark:text-slate-300">
            ${formatCurrency(totalSaved, "idr")} / ${formatCurrency(totalTarget, "idr")}
          </p>
        </div>
        <div className="mt-4 h-2.5 rounded-full bg-slate-200/70 dark:bg-slate-800">
          <div
            className="report-bar-fill h-full rounded-full bg-gradient-to-r from-emerald-400 to-sky-500"
            style=${{
              width: `${Math.max(progress * 100, totalSaved > 0 ? 8 : 0)}%`,
            }}
          ></div>
        </div>
      </div>

      <div className="relative mt-4 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-xl dark:bg-slate-900/40">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
          Target berikutnya
        </p>
        ${nextGoal
          ? html`
              <div className="mt-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-black text-slate-950 dark:text-white">
                    ${nextGoal.name}
                  </p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300/80">
                    Sisa ${formatCurrency(nextGoal.remainingIdr, "idr")}
                    ${nextGoal.daysLeft != null
                      ? ` | ${nextGoal.daysLeft < 0 ? "deadline lewat" : `${nextGoal.daysLeft} hari lagi`}`
                      : ""}
                  </p>
                </div>
                <div className=${`shrink-0 rounded-full border px-3 py-1.5 text-xs font-black ${nextGoal.tone}`}>
                  ${nextGoal.statusLabel}
                </div>
              </div>
              <p className="mt-3 rounded-2xl border border-brand-300/20 bg-brand-400/10 px-4 py-3 text-sm font-semibold text-brand-800 dark:border-brand-400/20 dark:bg-brand-500/10 dark:text-brand-100">
                ${nextGoalDailyNeed > 0
                  ? `Butuh sekitar ${formatCurrency(nextGoalDailyNeed, "idr")} per hari agar tepat waktu.`
                  : "Target ini siap dipantau dari tracker di bawah."}
              </p>
            `
          : html`
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300/80">
                Belum ada target keuangan. Mulai dari dana darurat, target saldo asing, atau pembelian besar.
              </p>
            `}
      </div>

      <button
        type="button"
        onClick=${onAddGoal}
        className="history-action-primary relative mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-black transition hover:-translate-y-0.5 sm:hidden"
      >
        Tambah target
      </button>
    </div>
  `;
}

function CurrencyPicker({ value, onChange }) {
  const selected = normalizeCurrencyList(value);
  const selectedSet = new Set(selected);

  function toggleCurrency(currency) {
    const code = normalizeCurrencyCode(currency);
    if (code === DEFAULT_BASE_CURRENCY) return;
    const next = selectedSet.has(code)
      ? selected.filter((item) => item !== code)
      : [...selected, code];
    onChange(normalizeCurrencyList(next));
  }

  return html`
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        ${DEFAULT_ACTIVE_CURRENCIES.map((currency) => {
          const active = selectedSet.has(currency);
          const locked = currency === DEFAULT_BASE_CURRENCY;
          return html`
            <button
              key=${currency}
              type="button"
              onClick=${() => toggleCurrency(currency)}
              aria-pressed=${active}
              className=${`min-h-12 rounded-2xl border px-3 py-3 text-left transition duration-300 ${
                active
                  ? "border-brand-300/35 bg-brand-600 text-white shadow-[0_16px_36px_rgba(16,185,129,0.20)] dark:border-emerald-300/25 dark:bg-emerald-500 dark:text-white"
                  : "border-slate-200/70 bg-white/58 text-slate-600 hover:border-brand-300/35 hover:bg-white/82 hover:text-slate-950 dark:border-white/10 dark:bg-slate-900/45 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-white"
              }`}
            >
              <span className="block text-sm font-black">${currency}</span>
              <span className=${`mt-0.5 block text-[10px] font-bold uppercase tracking-[0.12em] ${
                active ? "text-white/72" : "text-slate-400 dark:text-slate-500"
              }`}>
                ${locked ? "Utama" : active ? "Aktif" : "Opsional"}
              </span>
            </button>
          `;
        })}
      </div>
      <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
        IDR dikunci sebagai mata uang utama agar valuasi, saldo bersih, dan laporan tetap konsisten.
      </p>
    </div>
  `;
}

function DailyCurrencySelector({
  currencies,
  value,
  onChange,
  title = "Mata uang harian",
  helper = "Dipakai untuk input cepat Pengeluaran Hari Ini.",
  compact = false,
}) {
  const options = getCurrencyOptions(normalizeCurrencyList(currencies));
  const selectedCurrency = options.some((option) => option.value === normalizeCurrencyCode(value))
    ? normalizeCurrencyCode(value)
    : options[0]?.value || DEFAULT_BASE_CURRENCY;

  return html`
    <div className=${compact
      ? "rounded-2xl border border-slate-200/70 bg-white/58 p-2.5 dark:border-white/10 dark:bg-slate-900/35"
      : "rounded-2xl border border-brand-300/20 bg-brand-400/10 p-4 dark:border-brand-300/20 dark:bg-brand-500/10"}>
      <div className=${compact ? "mb-2 flex items-center justify-between gap-3 px-1" : "mb-3"}>
        <div>
          <p className=${compact
            ? "text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400"
            : "text-sm font-black text-slate-900 dark:text-slate-100"}>
            ${title}
          </p>
          ${helper
            ? html`
                <p className=${compact
                  ? "mt-0.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400"
                  : "mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300/80"}>
                  ${helper}
                </p>
              `
            : null}
        </div>
        ${compact
          ? html`
              <span className="shrink-0 rounded-full border border-brand-300/25 bg-brand-500/10 px-3 py-1 text-xs font-black text-brand-700 dark:text-brand-200">
                ${selectedCurrency}
              </span>
            `
          : null}
      </div>

      <div className=${`grid gap-2 ${options.length <= 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
        ${options.map((option) => {
          const active = option.value === selectedCurrency;
          return html`
            <button
              key=${option.value}
              type="button"
              onClick=${() => onChange(option.value)}
              aria-pressed=${active}
              className=${`min-h-11 rounded-2xl border px-3 py-2.5 text-sm font-black transition duration-300 ${
                active
                  ? "border-brand-300/35 bg-brand-600 text-white shadow-[0_14px_32px_rgba(16,185,129,0.20)] dark:border-emerald-300/25 dark:bg-emerald-500 dark:text-white"
                  : "border-slate-200/70 bg-white/66 text-slate-600 hover:border-brand-300/35 hover:bg-white/90 hover:text-slate-950 dark:border-white/10 dark:bg-slate-900/45 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-white"
              }`}
            >
              ${option.value}
            </button>
          `;
        })}
      </div>
    </div>
  `;
}

function CurrencyOnboarding({ onSave }) {
  const [selectedCurrencies, setSelectedCurrencies] = useState(DEFAULT_SELECTED_CURRENCIES);
  const [dailyCurrency, setDailyCurrency] = useState(DEFAULT_BASE_CURRENCY);
  const selectedLabel = normalizeCurrencyList(selectedCurrencies).join(" + ");
  const normalizedSelectedCurrencies = normalizeCurrencyList(selectedCurrencies);
  const selectedDailyCurrency = normalizedSelectedCurrencies.includes(dailyCurrency)
    ? dailyCurrency
    : normalizedSelectedCurrencies[0] || DEFAULT_BASE_CURRENCY;

  useEffect(() => {
    setDailyCurrency((current) =>
      normalizedSelectedCurrencies.includes(current)
        ? current
        : normalizedSelectedCurrencies[0] || DEFAULT_BASE_CURRENCY,
    );
  }, [normalizedSelectedCurrencies.join("|")]);

  function applyPreset(currencies) {
    const nextCurrencies = normalizeCurrencyList(currencies);
    setSelectedCurrencies(nextCurrencies);
    setDailyCurrency((current) =>
      nextCurrencies.includes(current) ? current : nextCurrencies[0] || DEFAULT_BASE_CURRENCY,
    );
  }

  return html`
    <main className="relative isolate min-h-screen overflow-hidden px-4 py-7 md:px-6 lg:px-8">
      <${PremiumMeshBackground} />
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-xl items-center justify-center">
        <section className=${`${PREMIUM_PANEL} w-full p-6 md:p-8`}>
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.14),transparent_42%)] opacity-80"></div>
          <div className="relative">
            <div className="inline-flex rounded-full border border-brand-300/30 bg-brand-600 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-white shadow-[0_12px_30px_rgba(16,185,129,0.20)]">
              ${APP_NAME}
            </div>
            <p className="mt-6 text-[11px] font-black uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">
              Setup pertama
            </p>
            <h1 className="mt-2 font-display text-3xl font-black tracking-[-0.03em] text-slate-950 dark:text-white">
              Pilih mata uang yang kamu pakai
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300/80">
              CUANSYNC hanya akan menampilkan saldo, form, filter, dan exchange untuk mata uang yang kamu aktifkan.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick=${() => applyPreset(["IDR"])}
                className="cuan-secondary min-h-12 rounded-2xl px-4 py-3 text-sm font-black transition hover:-translate-y-0.5"
              >
                IDR saja
              </button>
              <button
                type="button"
                onClick=${() => applyPreset(["IDR", "THB"])}
                className="cuan-secondary min-h-12 rounded-2xl px-4 py-3 text-sm font-black transition hover:-translate-y-0.5"
              >
                IDR + THB
              </button>
            </div>

            <div className="mt-5">
              <${CurrencyPicker}
                value=${selectedCurrencies}
                onChange=${setSelectedCurrencies}
              />
            </div>

            <div className="mt-5">
              <${DailyCurrencySelector}
                currencies=${normalizedSelectedCurrencies}
                value=${selectedDailyCurrency}
                onChange=${setDailyCurrency}
                title="Mata uang harian"
                helper="Pilih mata uang default untuk Pengeluaran Hari Ini. Bisa diubah lagi dari Pengaturan."
              />
            </div>

            <div className="mt-5 rounded-2xl border border-brand-300/20 bg-brand-400/10 px-4 py-3 text-sm font-semibold text-brand-800 dark:border-brand-300/20 dark:bg-brand-500/10 dark:text-brand-100">
              Aktif: ${selectedLabel} | Harian: ${selectedDailyCurrency}
            </div>

            <button
              type="button"
              onClick=${() =>
                onSave({
                  activeCurrencies: selectedCurrencies,
                  dailyCurrency: selectedDailyCurrency,
                })}
              className="history-action-primary mt-5 w-full min-h-12 rounded-2xl px-4 py-3 text-sm font-black transition hover:-translate-y-0.5"
            >
              Mulai pakai CUANSYNC
            </button>
          </div>
        </section>
      </div>
    </main>
  `;
}

function SettingsPanel({
  user,
  profilePhoto,
  theme,
  onThemeChange,
  currencySettings,
  onCurrencySettingsChange,
  onUploadPhoto,
  onRemovePhoto,
  onSignOut,
}) {
  const initials = getUserInitials(user);
  const displayName = getUserDisplayName(user);
  const normalizedSettings = normalizeCurrencySettings(
    currencySettings || DEFAULT_SELECTED_CURRENCIES,
  );
  const [selectedCurrencies, setSelectedCurrencies] = useState(() =>
    normalizedSettings.activeCurrencies,
  );
  const savedCurrencies = normalizeCurrencyList(
    currencySettings?.activeCurrencies || DEFAULT_SELECTED_CURRENCIES,
  );
  const [selectedDailyCurrency, setSelectedDailyCurrency] = useState(
    normalizedSettings.dailyCurrency,
  );
  const savedDailyCurrency = normalizeCurrencySettings({
    activeCurrencies: savedCurrencies,
    dailyCurrency: currencySettings?.dailyCurrency,
  }).dailyCurrency;
  const effectiveDailyCurrency = selectedCurrencies.includes(selectedDailyCurrency)
    ? selectedDailyCurrency
    : selectedCurrencies[0] || DEFAULT_BASE_CURRENCY;
  const currencyChanged =
    selectedCurrencies.join("|") !== savedCurrencies.join("|") ||
    effectiveDailyCurrency !== savedDailyCurrency;

  useEffect(() => {
    const nextSettings = normalizeCurrencySettings(
      currencySettings || DEFAULT_SELECTED_CURRENCIES,
    );
    setSelectedCurrencies(nextSettings.activeCurrencies);
    setSelectedDailyCurrency(nextSettings.dailyCurrency);
  }, [currencySettings]);

  useEffect(() => {
    setSelectedDailyCurrency((current) =>
      selectedCurrencies.includes(current)
        ? current
        : selectedCurrencies[0] || DEFAULT_BASE_CURRENCY,
    );
  }, [selectedCurrencies.join("|")]);

  return html`
    <div className="grid gap-6">
      <div className=${`${PREMIUM_PANEL} p-5 md:p-6`}>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),transparent_50%)] opacity-80"></div>
        <div className="relative">
          <h3 className="font-display text-xl font-bold">Pengaturan</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300/80">
            Foto profil, tampilan, mata uang, dan akun.
          </p>
        </div>

        <div className="cuan-card-soft relative mt-5 rounded-2xl p-4">
          <div className="flex items-center gap-4">

            <${AvatarBadge} src=${profilePhoto} initials=${initials} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-slate-950 dark:text-white">
                ${displayName}
              </p>
              <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                ${user?.email || "Demo Lokal"}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <label className="cuan-secondary flex cursor-pointer items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5">
              Upload Profile Picture
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange=${onUploadPhoto}
              />
            </label>
            <button
              type="button"
              onClick=${onRemovePhoto}
              disabled=${!profilePhoto}
              className="cuan-secondary rounded-2xl px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Hapus foto
            </button>
          </div>
        </div>
      </div>

      <div className=${`${PREMIUM_PANEL} p-5 md:p-6`}>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),transparent_50%)] opacity-80"></div>
        <div className="relative">
          <h3 className="font-display text-xl font-bold">Mata Uang Aktif</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300/80">
            Pilih mata uang yang benar-benar kamu pakai dan tentukan default untuk pengeluaran harian.
          </p>
        </div>

        <div className="relative mt-5">
          <${CurrencyPicker}
            value=${selectedCurrencies}
            onChange=${setSelectedCurrencies}
          />
        </div>

        <div className="relative mt-5">
          <${DailyCurrencySelector}
            currencies=${selectedCurrencies}
            value=${effectiveDailyCurrency}
            onChange=${setSelectedDailyCurrency}
            title="Default Pengeluaran Hari Ini"
            helper="Cocok untuk user yang tinggal di Amerika, Australia, atau negara lain tanpa harus mengubah form setiap kali input."
          />
        </div>

        <button
          type="button"
          onClick=${() =>
            onCurrencySettingsChange({
              activeCurrencies: selectedCurrencies,
              dailyCurrency: effectiveDailyCurrency,
            })}
          disabled=${!currencyChanged}
          className="history-action-primary relative mt-4 w-full min-h-12 rounded-2xl px-4 py-3 text-sm font-black transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55"
        >
          ${currencyChanged ? "Simpan mata uang" : "Mata uang sudah tersimpan"}
        </button>
      </div>

      <div className=${`${PREMIUM_PANEL} p-5 md:p-6`}>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),transparent_50%)] opacity-80"></div>
        <div className="relative">
          <h3 className="font-display text-xl font-bold">Tampilan</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300/80">
            Pilih mode yang paling nyaman dipakai.
          </p>
        </div>

        <div className="cuan-segment relative mt-5 grid grid-cols-2 gap-2 rounded-2xl p-1">
          ${[
            { key: "light", label: "Mode Terang" },
            { key: "dark", label: "Mode Gelap" },
          ].map(
            (option) => html`
              <button
                key=${option.key}
                type="button"
                onClick=${() => onThemeChange(option.key)}
                className=${`rounded-2xl px-3 py-3 text-sm font-semibold transition ${
                  theme === option.key
                    ? "bg-brand-600 text-white shadow-[0_16px_40px_rgba(16,185,129,0.22)] dark:bg-emerald-500 dark:text-white dark:shadow-[0_16px_40px_rgba(16,185,129,0.22)]"
                    : "text-slate-700 hover:bg-white/70 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-white"
                }`}
              >
                ${option.label}
              </button>
            `,
          )}
        </div>
      </div>

      <div className=${`${PREMIUM_PANEL} p-5 md:p-6`}>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),transparent_50%)] opacity-80"></div>
        <div className="relative">
          <h3 className="font-display text-xl font-bold">Akun</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300/80">
            Keluar dari sesi saat ini.
          </p>
        </div>
        <button
          type="button"
          onClick=${onSignOut}
          className="cuan-secondary relative mt-5 w-full rounded-2xl px-4 py-3.5 text-sm font-semibold transition hover:-translate-y-0.5"
        >
          Keluar
        </button>
      </div>
    </div>
  `;
}

function TransactionForm({
  transactions,
  onSubmit,
  loading,
  activeCurrencies: activeCurrencySettings = getActiveCurrencies(),
}) {
  const [entryType, setEntryType] = useState("income");
  const [incomeCurrency, setIncomeCurrency] = useState("IDR");
  const [expenseCurrency, setExpenseCurrency] = useState(DEFAULT_BASE_CURRENCY);
  const [exchangeAutoTarget, setExchangeAutoTarget] = useState("to_amount");
  const [form, setForm] = useState({
    occurred_at: toInputDateTime(),
    description: "",
    category: DEFAULT_CATEGORY,
    amount_idr: "",
    amount_thb: "",
    amount: "",
    from_currency: "IDR",
    to_currency: "THB",
    from_amount: "",
    to_amount: "",
    exchange_rate: "",
  });

  const parsedAmountThb = Number(normalizeNumericInput(form.amount_thb));
  const parsedAmountIdr = Number(normalizeNumericInput(form.amount_idr));
  const parsedAmount = Number(normalizeNumericInput(form.amount));
  const baseCurrency = getBaseCurrency();
  const activeCurrencies = normalizeCurrencyList(activeCurrencySettings);
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
  const isThb = selectedCurrencyCode === "THB";
  const isIdr = selectedCurrencyCode === "IDR";
  const isForeign = selectedCurrencyCode !== baseCurrency;
  const latestExpenseExchange =
    isExpense && isForeign
      ? getLatestExchangeForCurrencyUntil(
          transactions,
          selectedCurrencyCode,
          new Date(form.occurred_at || Date.now()),
        )
      : null;
  const latestExpenseRate =
    latestExpenseExchange && isExpense && isForeign
      ? getExchangeRateToBase(latestExpenseExchange, selectedCurrencyCode, baseCurrency) || 0
      : 0;
  const parsedSelectedAmount = parsedAmount || (isIdr ? parsedAmountIdr : parsedAmountThb);
  const submitDisabled = isExchange
    ? parsedFromAmount <= 0 ||
      parsedToAmount <= 0 ||
      parsedExchangeRate <= 0 ||
      form.from_currency === form.to_currency
    : parsedSelectedAmount <= 0;
  const typeOptions = [
    { value: "income", label: "Pemasukan" },
    { value: "expense", label: "Pengeluaran" },
    ...(activeCurrencies.length > 1
      ? [{ value: "exchange", label: "Tukar Mata Uang" }]
      : []),
  ];
  const currencyOptions = getCurrencyOptions(activeCurrencies);

  useEffect(() => {
    if (!activeCurrencies.includes(incomeCurrency)) {
      setIncomeCurrency(activeCurrencies[0] || baseCurrency);
    }
    if (!activeCurrencies.includes(expenseCurrency)) {
      setExpenseCurrency(defaultForeignCurrency);
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
  ]);

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
    <div className=${`${PREMIUM_PANEL} p-5 md:p-6`}>
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
            className=${GLASS_INPUT}
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
            className=${GLASS_INPUT}
          />
        </label>

        ${isExchange
          ? html`
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium">Dari mata uang</span>
                  <select
                    value=${form.from_currency}
                    onChange=${(event) => updateField("from_currency", event.target.value)}
                    className=${GLASS_INPUT}
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
                    className=${GLASS_INPUT}
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
                  className=${GLASS_INPUT}
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
                  className=${GLASS_INPUT}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium">
                  Rate (${form.from_currency} / 1 ${form.to_currency})
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
                  className=${GLASS_INPUT}
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
                  className=${GLASS_INPUT}
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
                  className=${GLASS_INPUT}
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
                  className=${GLASS_INPUT}
                />
              </label>
            `
          : null}

        ${!isExchange && isExpense && isForeign
          ? html`
              <div className="rounded-2xl border border-sky-300/25 bg-sky-400/10 px-4 py-3 text-sm text-sky-900 backdrop-blur-xl dark:border-sky-300/20 dark:bg-sky-500/10 dark:text-sky-200">
                ${latestExpenseRate > 0
                  ? html`
                      <p className="font-semibold">
                        Valuasi otomatis ${formatRate(
                          latestExpenseRate,
                          baseCurrency,
                          selectedCurrencyCode,
                        )}
                      </p>
                      <p className="mt-1 text-sky-800/80 dark:text-sky-100/80">
                        Diambil dari exchange terakhir pada ${formatDateTime(latestExpenseExchange.occurred_at)}.
                      </p>
                    `
                  : html`
                      <p className="font-semibold">Belum ada rate exchange tersimpan.</p>
                      <p className="mt-1 text-sky-800/80 dark:text-sky-100/80">
                        Pengeluaran tetap dicatat dalam ${selectedCurrencyCode}. Valuasi ${baseCurrency}
                        akan otomatis terisi setelah ada transaksi Tukar Mata Uang yang relevan.
                      </p>
                    `}
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
                Belanja IDR akan langsung mengurangi saldo utama. Atur budget IDR di Kontrol jika ingin batas aman harian aktif.
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

function BudgetForm({
  onSubmit,
  loading,
  currentMonthKey,
  currency: initialCurrency = getBaseCurrency(),
  activeCurrencies = getActiveCurrencies(),
  onCurrencyChange = null,
}) {
  const [monthKey, setMonthKey] = useState(currentMonthKey);
  const [currency, setCurrency] = useState(normalizeCurrencyCode(initialCurrency));
  const [limitAmount, setLimitAmount] = useState("");
  const normalizedActiveCurrencies = normalizeCurrencyList(activeCurrencies);
  const currencyOptions = getCurrencyOptions(normalizedActiveCurrencies);

  useEffect(() => {
    setMonthKey(currentMonthKey);
  }, [currentMonthKey]);

  useEffect(() => {
    const nextCurrency = normalizeCurrencyCode(initialCurrency);
    setCurrency(
      normalizedActiveCurrencies.includes(nextCurrency)
        ? nextCurrency
        : normalizedActiveCurrencies[0],
    );
  }, [initialCurrency, normalizedActiveCurrencies.join("|")]);

  function handleCurrencyChange(value) {
    const nextCurrency = normalizeCurrencyCode(value);
    setCurrency(nextCurrency);
    if (onCurrencyChange) onCurrencyChange(nextCurrency);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const ok = await onSubmit({
      month_key: monthKey,
      group_key: UNIVERSAL_BUDGET_GROUP,
      currency,
      limit_amount: normalizeNumericInput(limitAmount),
    });
    if (ok) {
      setLimitAmount("");
    }
  }

  return html`
    <div className=${`${PREMIUM_PANEL} p-5 md:p-6`}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),transparent_50%)] opacity-80"></div>
      <div className="relative">
        <h3 className="font-display text-xl font-bold">Budget Uang Keluar Bulanan</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300/80">
          Satu limit untuk mata uang yang sedang kamu kontrol.
        </p>
      </div>

      <form className="relative mt-5 space-y-4" onSubmit=${handleSubmit}>
        <label className="block">
          <span className="mb-2 block text-sm font-medium">Bulan</span>
          <input
            type="month"
            value=${monthKey}
            onChange=${(event) => setMonthKey(event.target.value)}
            className=${GLASS_INPUT}
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium">Mata uang budget</span>
          <select
            value=${currency}
            onChange=${(event) => handleCurrencyChange(event.target.value)}
            className=${GLASS_INPUT}
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
          <span className="mb-2 block text-sm font-medium">Limit Uang Keluar (${currency})</span>
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            required
            value=${limitAmount}
            onChange=${(event) =>
              setLimitAmount(formatNumericInput(event.target.value))}
            placeholder="0"
            className=${GLASS_INPUT}
          />
        </label>

        <button
          type="submit"
          disabled=${loading}
          className="history-action-primary w-full min-h-12 rounded-2xl px-4 py-3 text-sm font-black transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Simpan budget
        </button>
      </form>
    </div>
  `;
}

function GoalForm({ onSubmit, loading, onCancel = null, onSuccess = null }) {
  const [form, setForm] = useState({
    name: "",
    target_amount_idr: "",
    saved_amount_idr: "",
    deadline: getDateInputValue(),
  });

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const ok = await onSubmit({
      ...form,
      target_amount_idr: normalizeNumericInput(form.target_amount_idr),
      saved_amount_idr: normalizeNumericInput(form.saved_amount_idr),
    });
    if (ok) {
      setForm({
        name: "",
        target_amount_idr: "",
        saved_amount_idr: "",
        deadline: getDateInputValue(),
      });
      if (onSuccess) onSuccess();
    }
  }

  return html`
    <div className=${`${PREMIUM_PANEL} p-5 md:p-6`}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),transparent_50%)] opacity-80"></div>
      <div className="relative">
        <h3 className="font-display text-xl font-bold">Tambah Target Finansial</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300/80">
          Cocok untuk dana darurat, mudik, modal bisnis, atau target pembelian besar.
          Saldo awal target akan langsung dipindahkan dari saldo utama IDR.
        </p>
      </div>

      <form className="relative mt-5 space-y-4" onSubmit=${handleSubmit}>
        <label className="block">
          <span className="mb-2 block text-sm font-medium">Nama target</span>
          <input
            type="text"
            required
            value=${form.name}
            onChange=${(event) => updateField("name", event.target.value)}
            placeholder="Dana darurat 6 bulan"
            className=${GLASS_INPUT}
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-medium">Target (IDR)</span>
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              required
              value=${form.target_amount_idr}
              onChange=${(event) =>
                updateField(
                  "target_amount_idr",
                  formatNumericInput(event.target.value),
                )}
              placeholder="0"
              className=${GLASS_INPUT}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium">Saldo awal (IDR)</span>
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value=${form.saved_amount_idr}
              onChange=${(event) =>
                updateField(
                  "saved_amount_idr",
                  formatNumericInput(event.target.value),
                )}
              placeholder="0"
              className=${GLASS_INPUT}
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-2 block text-sm font-medium">Deadline</span>
          <input
            type="date"
            value=${form.deadline}
            onChange=${(event) => updateField("deadline", event.target.value)}
            className=${GLASS_INPUT}
          />
        </label>

        <div className=${onCancel ? "grid gap-3 sm:grid-cols-[0.8fr_1fr]" : ""}>
          ${onCancel
            ? html`
                <button
                  type="button"
                  onClick=${onCancel}
                  className="history-action-secondary min-h-12 rounded-2xl px-4 py-3 text-sm font-black transition hover:-translate-y-0.5"
                >
                  Batal
                </button>
              `
            : null}
          <button
            type="submit"
            disabled=${loading}
            className="history-action-primary min-h-12 w-full rounded-2xl px-4 py-3 text-sm font-black transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Simpan target
          </button>
        </div>
      </form>
    </div>
  `;
}

function WealthGoalsPage({
  metrics,
  loading,
  onCreateGoal,
  onDeleteGoal,
  onContribute,
}) {
  const [showGoalForm, setShowGoalForm] = useState(
    metrics.goalInsights.length === 0,
  );

  useEffect(() => {
    if (!metrics.goalInsights.length) {
      setShowGoalForm(true);
    }
  }, [metrics.goalInsights.length]);

  async function handleCreateGoal(payload) {
    const ok = await onCreateGoal(payload);
    if (ok && metrics.goalInsights.length > 0) {
      setShowGoalForm(false);
    }
    return ok;
  }

  return html`
    <div className="grid gap-4">
      <${InvestmentSnapshot}
        metrics=${metrics}
        onAddGoal=${() => setShowGoalForm(true)}
      />

      ${showGoalForm
        ? html`
            <${GoalForm}
              onSubmit=${handleCreateGoal}
              loading=${loading}
              onCancel=${metrics.goalInsights.length
                ? () => setShowGoalForm(false)
                : null}
              onSuccess=${() => setShowGoalForm(false)}
            />
          `
        : null}

      <${GoalTracker}
        goals=${metrics.goalInsights}
        onDelete=${onDeleteGoal}
        onContribute=${onContribute}
      />
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

  return html`
    <div className="fixed inset-x-4 top-4 z-50 sm:left-auto sm:right-6 sm:w-[22rem]">
      <div className="rounded-[22px] border border-emerald-300/25 bg-emerald-500/14 px-4 py-3 text-sm font-semibold text-emerald-900 shadow-[0_22px_60px_rgba(16,185,129,0.22)] backdrop-blur-2xl transition duration-300 ease-out dark:border-emerald-400/20 dark:bg-emerald-500/16 dark:text-emerald-100">
        <div className="flex items-start justify-between gap-3">
          <p>${toast.message}</p>
          <button
            type="button"
            onClick=${onDismiss}
            aria-label="Tutup toast"
            className="min-h-0 rounded-full px-2 py-0.5 text-xs text-emerald-700 transition hover:bg-emerald-500/10 dark:text-emerald-200"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  `;
}

function MobileBottomNav({ activeTab, onChange }) {
  const items = [
    { key: "today", label: "Hari Ini" },
    { key: "overview", label: "Kontrol" },
    { key: "add", label: "Tambah", featured: true },
    { key: "history", label: "Riwayat" },
    { key: "report", label: "Laporan" },
  ];

  return html`
    <nav
      className="mobile-bottom-nav fixed inset-x-3 z-40 transition duration-300 md:hidden"
      style=${{ bottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
    >
      <div
        className=${`grid grid-cols-5 items-end gap-1 rounded-[26px] p-1.5 transition duration-300 ease-out ${navSurface}`}
      >
        ${items.map((item) => {
          const active = activeTab === item.key;
          const featuredClass = item.featured
            ? active
              ? "-mt-5 min-h-[4rem] bg-brand-600 text-white shadow-[0_18px_42px_rgba(16,185,129,0.34)] dark:bg-emerald-500 dark:text-white"
              : "-mt-5 min-h-[4rem] bg-brand-600 text-white shadow-[0_18px_42px_rgba(16,185,129,0.28)] hover:bg-brand-700 dark:bg-emerald-500 dark:text-white dark:hover:bg-emerald-400"
            : active
              ? "bg-brand-600 text-white shadow-[0_14px_34px_rgba(16,185,129,0.26)] dark:bg-emerald-500 dark:text-white"
              : "text-slate-500 hover:bg-slate-900/[0.05] hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white";
          return html`
            <button
              key=${item.key}
              type="button"
              aria-current=${active ? "page" : undefined}
              onClick=${() => onChange(item.key)}
              className=${`flex min-h-[3.25rem] min-w-0 flex-col items-center justify-center rounded-[20px] px-1 text-[10px] font-bold transition duration-300 ease-out min-[390px]:text-[11px] ${featuredClass}`}
            >
              ${item.featured
                ? html`
                    <span className="mb-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/18 text-lg leading-none">
                      +
                    </span>
                  `
                : null}
              <span className="truncate">${item.label}</span>
            </button>
          `;
        })}
      </div>
    </nav>
  `;
}

function App() {
  const [theme, setTheme] = useState(readAppStorage("theme", "light"));
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState("loading");
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [goals, setGoals] = useState([]);
  const [profilePhotos, setProfilePhotos] = useState(() =>
    readAppStorage("profilePhotos", {}),
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState("info");
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState("today");
  const [reportMonthKey, setReportMonthKey] = useState(getMonthKey(new Date()));
  const [balanceVisible, setBalanceVisible] = useState(() =>
    readAppStorage("balanceVisible", false),
  );
  const [currencySettings, setCurrencySettings] = useState(() =>
    readCurrencySettings(),
  );
  const [menuOpen, setMenuOpen] = useState(false);

  const supabaseReady = Boolean(supabase);
  setRuntimeCurrencySettings(currencySettings);
  const activeCurrencies = normalizeCurrencyList(
    currencySettings?.activeCurrencies || DEFAULT_SELECTED_CURRENCIES,
  );
  const currencySetupDone = Boolean(currencySettings?.configured);
  const metrics = useMemo(
    () => computeMetrics(transactions, budgets, goals),
    [transactions, budgets, goals, currencySettings],
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    writeAppStorage("theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

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

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const sessionUser = data.session?.user || null;
      setUser(sessionUser);
      setMode(sessionUser ? "supabase" : "signed-out");
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(session?.user || null);
      setMode(session?.user ? "supabase" : "signed-out");
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabaseReady]);

  useEffect(() => {
    if (!user) {
      setTransactions([]);
      setBudgets([]);
      setGoals([]);
      return;
    }

    let cancelled = false;

    async function loadDashboardData() {
      if (mode === "demo") {
        const normalizedDemoTransactions = orderTransactions(
          normalizeTransactions(readAppStorage("demoTransactions", [])),
        );
        writeAppStorage("demoTransactions", normalizedDemoTransactions);
        setTransactions(normalizedDemoTransactions);
        setBudgets(readAppStorage("demoBudgets", []).map(normalizeBudget));
        setGoals(readAppStorage("demoGoals", []).map(normalizeGoal));
        setCurrencySettings(readCurrencySettings());
        return;
      }

      setLoading(true);
      const [transactionResult, budgetResult, goalResult, settingsResult] = await Promise.all([
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
          .from("user_settings")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle(),
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
              ? "Tabel budget belum ada. Jalankan schema.sql terbaru agar fitur proteksi budget aktif."
              : budgetResult.error.message,
        });
      } else {
        setBudgets((budgetResult.data || []).map(normalizeBudget));
      }

      if (goalResult.error) {
        setGoals([]);
        notices.push({
          tone: goalResult.error.code === "42P01" ? "info" : "error",
          text:
            goalResult.error.code === "42P01"
              ? "Tabel goals belum ada. Jalankan schema.sql terbaru agar progress tracker aktif."
              : goalResult.error.message,
        });
      } else {
        setGoals((goalResult.data || []).map(normalizeGoal));
      }

      if (settingsResult.error) {
        const localSettings = readCurrencySettings();
        setCurrencySettings(localSettings);
        notices.push({
          tone: settingsResult.error.code === "42P01" ? "info" : "error",
          text:
            settingsResult.error.code === "42P01"
              ? "Tabel user_settings belum ada. Jalankan schema.sql terbaru agar pilihan mata uang tersimpan lintas device."
              : settingsResult.error.message,
        });
      } else {
        const databaseSettings = normalizeUserSettingsRow(settingsResult.data);
        const localSettings = readCurrencySettings();
        const nextSettings = databaseSettings || localSettings;
        setCurrencySettings(nextSettings);
        setRuntimeCurrencySettings(nextSettings);
        if (!databaseSettings && localSettings?.configured) {
          supabase
            .from("user_settings")
            .upsert(
              {
                user_id: user.id,
                base_currency: localSettings.baseCurrency,
                active_currencies: localSettings.activeCurrencies,
                daily_currency: localSettings.dailyCurrency,
                theme,
                balance_visible: balanceVisible,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "user_id" },
            )
            .then(() => {})
            .catch(() => {});
        }
        if (settingsResult.data?.theme) {
          setTheme(settingsResult.data.theme);
        }
        if (typeof settingsResult.data?.balance_visible === "boolean") {
          setBalanceVisible(settingsResult.data.balance_visible);
        }
      }

      if (notices.length) {
        setMessage(notices[0].text);
        setMessageTone(notices[0].tone);
      }

      setLoading(false);
    }

    loadDashboardData();

    return () => {
      cancelled = true;
    };
  }, [user, mode]);

  async function handleGoogleLogin() {
    if (!supabaseReady) return;
    setMessage("");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      setMessage(error.message);
      setMessageTone("error");
    }
  }

  function handleDemoLogin() {
    writeAppStorage("demoAuth", true);
    const normalizedDemoTransactions = orderTransactions(
      normalizeTransactions(readAppStorage("demoTransactions", [])),
    );
    writeAppStorage("demoTransactions", normalizedDemoTransactions);
    setUser(DEMO_USER);
    setMode("demo");
    setTransactions(normalizedDemoTransactions);
    setBudgets(readAppStorage("demoBudgets", []).map(normalizeBudget));
    setGoals(readAppStorage("demoGoals", []).map(normalizeGoal));
    setCurrencySettings(readCurrencySettings());
    setMessage("Demo lokal aktif. Semua modul analytics, budget, dan goals berjalan di browser ini.");
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
      return;
    }

    const { error } = await supabase.auth.signOut();
    if (error) {
      setMessage(error.message);
      setMessageTone("error");
    }
  }

  async function persistDemoTransactions(nextTransactions) {
    const ordered = orderTransactions(normalizeTransactions(nextTransactions));
    writeAppStorage("demoTransactions", ordered);
    setTransactions(ordered);
  }

  async function persistDemoBudgets(nextBudgets) {
    writeAppStorage("demoBudgets", nextBudgets);
    setBudgets(nextBudgets.map(normalizeBudget));
  }

  async function persistDemoGoals(nextGoals) {
    writeAppStorage("demoGoals", nextGoals);
    setGoals(nextGoals.map(normalizeGoal));
  }
function calculateTHBBalance(transactions) {
  return Number(computeCurrencyBalances(transactions).THB || 0);
}
  async function handleCreateTransaction(payload) {
    try {
      setLoading(true);
      setMessage("");
      setToast(null);

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
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (payload.type === "income") {
        const currency = normalizeCurrencyCode(payload.currency);
        const amount = Number(payload.amount || payload.amount_idr || payload.amount_thb);
        if (!amount || amount <= 0) {
          throw new Error(`Jumlah pemasukan ${currency} harus lebih besar dari 0.`);
        }
        record.currency = currency;
        record.amount = amount;
        record.rate = null;
        record.locked_rate = null;
        record.base_amount = currency === getBaseCurrency() ? amount : null;
        record.amount_idr = currency === getBaseCurrency() ? amount : null;
        record.amount_thb = currency === "THB" ? amount : null;
        record.category = null;
        record.category_group = null;
      }

      if (payload.type === "exchange") {
        const fromCurrency = normalizeCurrencyCode(payload.from_currency);
        const toCurrency = normalizeCurrencyCode(payload.to_currency, "THB");
        const fromAmount = Number(payload.from_amount);
        const toAmount = Number(payload.to_amount);
        const rate = Number(payload.rate || payload.exchange_rate);
        if (fromCurrency === toCurrency) {
          throw new Error("Dari mata uang dan ke mata uang tidak boleh sama.");
        }
        if (!fromAmount || fromAmount <= 0) {
          throw new Error("Jumlah yang ditukar harus lebih besar dari 0.");
        }
        if (!toAmount || toAmount <= 0) {
          throw new Error("Jumlah diterima harus lebih besar dari 0.");
        }
        if (!rate || rate <= 0) {
          throw new Error("Rate exchange wajib lebih besar dari 0.");
        }
        const balances = computeCurrencyBalances(transactions);
        const availableFromBalance =
          fromCurrency === getBaseCurrency()
            ? metrics.balanceIdr
            : Number(balances[fromCurrency] || 0);
        if (availableFromBalance < fromAmount) {
          throw new Error(`Saldo ${fromCurrency} tidak mencukupi.`);
        }
        record.from_currency = fromCurrency;
        record.to_currency = toCurrency;
        record.from_amount = fromAmount;
        record.to_amount = toAmount;
        record.rate = rate;
        record.locked_rate = rate;
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
                ) || 0);
        record.amount_idr =
          fromCurrency === "IDR" ? fromAmount : toCurrency === "IDR" ? toAmount : null;
        record.amount_thb =
          fromCurrency === "THB" ? -fromAmount : toCurrency === "THB" ? toAmount : null;
        record.category = null;
        record.category_group = null;
      }

      if (payload.type === "expense") {
        const expenseCurrency = normalizeCurrencyCode(payload.expense_currency || payload.currency);
        const amount = Number(payload.amount || payload.amount_idr || payload.amount_thb);

        if (!amount || amount <= 0) {
          throw new Error(`Jumlah pengeluaran ${expenseCurrency} harus lebih besar dari 0.`);
        }
        const balances = computeCurrencyBalances(transactions);
        const availableExpenseBalance =
          expenseCurrency === getBaseCurrency()
            ? metrics.balanceIdr
            : Number(balances[expenseCurrency] || 0);
        if (availableExpenseBalance < amount) {
          throw new Error(`Saldo ${expenseCurrency} tidak mencukupi.`);
        }

        const fallbackRate =
          expenseCurrency === getBaseCurrency()
            ? 1
            : Number(payload.exchange_rate || payload.rate || 0) ||
              getLatestRateForCurrencyUntil(
                transactions,
                expenseCurrency,
                new Date(payload.occurred_at),
              );

        record.currency = expenseCurrency;
        record.amount = amount;
        record.rate =
          expenseCurrency === getBaseCurrency() || !fallbackRate ? null : fallbackRate;
        record.locked_rate =
          expenseCurrency === getBaseCurrency() || !fallbackRate ? null : fallbackRate;
        record.base_amount =
          expenseCurrency === getBaseCurrency()
            ? amount
            : fallbackRate > 0
              ? amount * fallbackRate
              : null;
        record.amount_idr = record.base_amount;
        record.amount_thb = expenseCurrency === "THB" ? amount : null;
        record.category = payload.category;
        record.category_group = UNIVERSAL_BUDGET_GROUP;
      }

      if (mode === "demo") {
        await persistDemoTransactions([...transactions, record]);
      } else {
        const { data, error } = await supabase
          .from("transactions")
          .insert(record)
          .select()
          .single();
        if (error) throw error;
        setTransactions((current) =>
          orderTransactions([...current, normalizeTransaction(data)]),
        );
      }

      setMessage("Transaksi berhasil disimpan dan dashboard sudah diperbarui.");
      setMessageTone("success");
      setToast({
        message: "Transaksi berhasil disimpan.",
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

  async function handleUpdateTransaction(transaction, payload) {
    try {
      setLoading(true);
      setMessage("");
      setToast(null);

      const occurredAt = new Date(payload.occurred_at);
      if (Number.isNaN(occurredAt.getTime())) {
        throw new Error("Tanggal transaksi tidak valid.");
      }

      const nextType = ["income", "expense", "exchange"].includes(payload.type)
        ? payload.type
        : getTransactionFlow(transaction);
      const description = String(payload.description || "").trim();
      const amount = Number(normalizeNumericInput(payload.amount));
      const amountIdr = Number(normalizeNumericInput(payload.amount_idr));
      const amountThb = Number(normalizeNumericInput(payload.amount_thb));
      const fromAmount = Number(normalizeNumericInput(payload.from_amount));
      const toAmount = Number(normalizeNumericInput(payload.to_amount));
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
        record.rate = null;
        record.locked_rate = null;
        record.base_amount = currency === getBaseCurrency() ? nextAmount : null;
        record.amount_idr = currency === getBaseCurrency() ? nextAmount : null;
        record.amount_thb = currency === "THB" ? nextAmount : null;
      }

      if (nextType === "exchange") {
        const fromCurrency = normalizeCurrencyCode(payload.from_currency);
        const toCurrency = normalizeCurrencyCode(payload.to_currency, "THB");
        if (fromCurrency === toCurrency) {
          throw new Error("Dari mata uang dan ke mata uang tidak boleh sama.");
        }
        if (!fromAmount || fromAmount <= 0) {
          throw new Error("Jumlah ditukar harus lebih besar dari 0.");
        }
        if (!toAmount || toAmount <= 0) {
          throw new Error("Jumlah diterima harus lebih besar dari 0.");
        }
        if (!lockedRate || lockedRate <= 0) {
          throw new Error("Rate exchange wajib diisi.");
        }

        record.from_currency = fromCurrency;
        record.to_currency = toCurrency;
        record.from_amount = fromAmount;
        record.to_amount = toAmount;
        record.rate = lockedRate;
        record.locked_rate = lockedRate;
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
                ) || 0);
        record.amount_idr =
          fromCurrency === "IDR" ? fromAmount : toCurrency === "IDR" ? toAmount : null;
        record.amount_thb =
          fromCurrency === "THB" ? -fromAmount : toCurrency === "THB" ? toAmount : null;
      }

      if (nextType === "expense") {
        const expenseCurrency = normalizeCurrencyCode(payload.expense_currency || payload.currency);
        const nextAmount = amount || amountIdr || amountThb;
        record.category = payload.category || DEFAULT_CATEGORY;
        record.category_group = UNIVERSAL_BUDGET_GROUP;

        if (!nextAmount || nextAmount <= 0) {
          throw new Error(`Jumlah pengeluaran ${expenseCurrency} harus lebih besar dari 0.`);
        }
        const autoRate =
          expenseCurrency === getBaseCurrency()
            ? 1
            : lockedRate > 0
              ? lockedRate
              : getLatestRateForCurrencyUntil(
                  transactions.filter((item) => item.id !== transaction.id),
                  expenseCurrency,
                  occurredAt,
                );

        record.currency = expenseCurrency;
        record.amount = nextAmount;
        record.rate =
          expenseCurrency === getBaseCurrency() || !autoRate ? null : autoRate;
        record.locked_rate =
          expenseCurrency === getBaseCurrency() || !autoRate ? null : autoRate;
        record.base_amount =
          expenseCurrency === getBaseCurrency()
            ? nextAmount
            : autoRate > 0
              ? nextAmount * autoRate
              : null;
        record.amount_idr = record.base_amount;
        record.amount_thb = expenseCurrency === "THB" ? nextAmount : null;
      }

      if (mode === "demo") {
        const transactionId = transaction.id || createLegacyTransactionId(transaction);
        await persistDemoTransactions(
          transactions.map((item) =>
            item.id === transactionId ? { ...item, ...record } : item,
          ),
        );
      } else {
        const { data, error } = await supabase
          .from("transactions")
          .update(record)
          .eq("id", transaction.id)
          .eq("user_id", user.id)
          .select()
          .single();
        if (error) throw error;
        setTransactions((current) =>
          orderTransactions(
            current.map((item) =>
              item.id === transaction.id ? normalizeTransaction(data) : item,
            ),
          ),
        );
      }

      setMessage("Transaksi berhasil diperbarui.");
      setMessageTone("success");
      setToast({ message: "Transaksi diperbarui" });
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

      if (mode === "demo") {
        await persistDemoTransactions(
          transactions.filter((item) => item.id !== transactionId),
        );
      } else {
        const { error } = await supabase
          .from("transactions")
          .delete()
          .eq("id", transactionId)
          .eq("user_id", user.id);
        if (error) throw error;
        setTransactions((current) =>
          current.filter((item) => item.id !== transactionId),
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

      const budgetCurrency = normalizeCurrencyCode(payload.currency || getBaseCurrency());
      const limitAmount = Number(payload.limit_amount || payload.limit_thb);
      const groupKey = UNIVERSAL_BUDGET_GROUP;
      if (!limitAmount || limitAmount <= 0) {
        throw new Error(`Limit budget ${budgetCurrency} harus lebih besar dari 0.`);
      }

      const existing = budgets.find(
        (item) =>
            item.month_key === payload.month_key &&
            item.group_key === groupKey &&
            normalizeCurrencyCode(item.currency || getBaseCurrency()) === budgetCurrency,
      );

      const record = {
        id: existing?.id || crypto.randomUUID(),
        user_id: user.id,
        month_key: payload.month_key,
        group_key: groupKey,
        currency: budgetCurrency,
        limit_amount: limitAmount,
        created_at: existing?.created_at || new Date().toISOString(),
      };

      if (mode === "demo") {
        const next = [
          ...budgets.filter(
            (item) =>
              !(
                item.month_key === payload.month_key &&
                item.group_key === groupKey &&
                normalizeCurrencyCode(item.currency || getBaseCurrency()) === budgetCurrency
              ),
          ),
          record,
        ];
        await persistDemoBudgets(next);
      } else {
        const { data, error } = await supabase
          .from("budgets")
          .upsert(record, {
            onConflict: "user_id,month_key,group_key,currency",
          })
          .select()
          .single();
        if (error) throw error;

        setBudgets((current) => {
          const next = [
            ...current.filter((item) => item.id !== data.id),
            normalizeBudget(data),
          ];
          return next.sort((a, b) => String(a.month_key).localeCompare(String(b.month_key)));
        });
      }

      setMessage("Budget berhasil disimpan.");
      setMessageTone("success");
      return true;
    } catch (error) {
      setMessage(error.message || "Gagal menyimpan budget.");
      setMessageTone("error");
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteBudget(budget) {
    const confirmation = window.confirm(
      `Hapus budget ${budget.currency || getBaseCurrency()} untuk ${formatMonthKey(budget.month_key)}?`,
    );
    if (!confirmation) return;

    try {
      setLoading(true);
      setMessage("");

      if (mode === "demo") {
        await persistDemoBudgets(budgets.filter((item) => item.id !== budget.id));
      } else {
        const { error } = await supabase
          .from("budgets")
          .delete()
          .eq("id", budget.id)
          .eq("user_id", user.id);
        if (error) throw error;
        setBudgets((current) => current.filter((item) => item.id !== budget.id));
      }

      setMessage("Budget dihapus.");
      setMessageTone("info");
    } catch (error) {
      setMessage(error.message || "Gagal menghapus budget.");
      setMessageTone("error");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateGoal(payload) {
    try {
      setLoading(true);
      setMessage("");

      const targetAmount = Number(payload.target_amount_idr);
      const savedAmount = Number(payload.saved_amount_idr || 0);

      if (!payload.name.trim()) {
        throw new Error("Nama target wajib diisi.");
      }
      if (!targetAmount || targetAmount <= 0) {
        throw new Error("Target IDR harus lebih besar dari 0.");
      }
      if (savedAmount < 0) {
        throw new Error("Saldo awal tidak boleh negatif.");
      }
      if (savedAmount > metrics.balanceIdr) {
        throw new Error("Saldo utama IDR tidak cukup untuk menaruh saldo awal sebesar itu.");
      }

      const record = {
        id: crypto.randomUUID(),
        user_id: user.id,
        name: payload.name.trim(),
        target_amount_idr: targetAmount,
        saved_amount_idr: savedAmount,
        deadline: payload.deadline || null,
        created_at: new Date().toISOString(),
      };

      if (mode === "demo") {
        await persistDemoGoals([...goals, record]);
      } else {
        const { data, error } = await supabase
          .from("goals")
          .insert(record)
          .select()
          .single();
        if (error) throw error;
        setGoals((current) => [...current, normalizeGoal(data)]);
      }

      setMessage(
        savedAmount > 0
          ? `Target dibuat. ${formatCurrency(savedAmount, "idr")} dipindahkan dari saldo utama ke tabungan.`
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

  async function handleAddGoalProgress(goal, rawAmount, action = "deposit") {
    try {
      setLoading(true);
      setMessage("");

      const amount = Number(rawAmount);
      if (!amount || amount <= 0) {
        throw new Error("Nominal harus lebih besar dari 0.");
      }

      const currentSavedAmount = Number(goal.saved_amount_idr || goal.savedAmount || 0);
      const isWithdraw = action === "withdraw";
      if (!isWithdraw && amount > metrics.balanceIdr) {
        throw new Error("Saldo utama IDR tidak cukup untuk setor ke tabungan.");
      }
      if (isWithdraw && amount > currentSavedAmount) {
        throw new Error("Saldo tabungan pada target ini tidak mencukupi untuk ditarik.");
      }
      const nextSavedAmount = isWithdraw
        ? currentSavedAmount - amount
        : currentSavedAmount + amount;

      if (mode === "demo") {
        const next = goals.map((item) =>
          item.id === goal.id ? { ...item, saved_amount_idr: nextSavedAmount } : item,
        );
        await persistDemoGoals(next);
      } else {
        const { data, error } = await supabase
          .from("goals")
          .update({ saved_amount_idr: nextSavedAmount })
          .eq("id", goal.id)
          .eq("user_id", user.id)
          .select()
          .single();
        if (error) throw error;
        setGoals((current) =>
          current.map((item) =>
            item.id === goal.id ? normalizeGoal(data) : item,
          ),
        );
      }

      setMessage(
        isWithdraw
          ? `${formatCurrency(amount, "idr")} ditarik dari tabungan ke saldo utama.`
          : `${formatCurrency(amount, "idr")} dipindahkan dari saldo utama ke tabungan.`,
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

  async function persistUserSettings(nextSettings, overrides = {}) {
    if (mode !== "supabase" || !user || !supabaseReady) return true;

    const normalized = normalizeCurrencySettings(nextSettings, { configured: true });
    const record = {
      user_id: user.id,
      base_currency: normalized.baseCurrency,
      active_currencies: normalized.activeCurrencies,
      daily_currency: normalized.dailyCurrency,
      theme: overrides.theme || theme,
      balance_visible:
        typeof overrides.balanceVisible === "boolean"
          ? overrides.balanceVisible
          : balanceVisible,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("user_settings")
      .upsert(record, { onConflict: "user_id" });
    if (error) throw error;
    return true;
  }

  async function handleSaveCurrencySettings(nextCurrencySettings, options = {}) {
    const requestedSettings = Array.isArray(nextCurrencySettings)
      ? { activeCurrencies: nextCurrencySettings }
      : nextCurrencySettings || {};
    const activeCurrencyList = normalizeCurrencyList(
      requestedSettings.activeCurrencies ||
        currencySettings?.activeCurrencies ||
        DEFAULT_SELECTED_CURRENCIES,
    );
    const currentSettings = normalizeCurrencySettings({
      activeCurrencies: activeCurrencyList,
      dailyCurrency:
        requestedSettings.dailyCurrency ||
        currencySettings?.dailyCurrency ||
        activeCurrencyList[0],
    });
    const nextSettings = saveCurrencySettings({
      activeCurrencies: activeCurrencyList,
      dailyCurrency: currentSettings.dailyCurrency,
    });
    setRuntimeCurrencySettings(nextSettings);
    setCurrencySettings(nextSettings);
    try {
      await persistUserSettings(nextSettings);
      const successMessage = options.message || "Pilihan mata uang diperbarui.";
      setToast({ message: successMessage });
      setMessage(successMessage);
      setMessageTone("success");
    } catch (error) {
      const localMessage = options.localMessage || "Mata uang tersimpan lokal.";
      setToast({ message: localMessage });
      setMessage(
        error.code === "42P01"
          ? "Mata uang tersimpan lokal. Jalankan schema.sql terbaru agar sinkron ke database."
          : error.message || "Mata uang tersimpan lokal, tapi gagal sinkron ke database.",
      );
      setMessageTone(error.code === "42P01" ? "info" : "error");
    }
  }

  function handleThemeChange(value) {
    setTheme(value);
    persistUserSettings(currencySettings || normalizeCurrencySettings(null), {
      theme: value,
    }).catch(() => {});
  }

  if (!user) {
    return html`
      <${AuthScreen}
        onGoogleLogin=${handleGoogleLogin}
        onDemoLogin=${handleDemoLogin}
        supabaseReady=${supabaseReady}
      />
    `;
  }

  if (!currencySetupDone) {
    return html`
      <${CurrencyOnboarding}
        onSave=${handleSaveCurrencySettings}
      />
    `;
  }

  const dailyExpenseCurrency = normalizeCurrencySettings({
    activeCurrencies,
    dailyCurrency: currencySettings?.dailyCurrency,
  }).dailyCurrency;
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
      ? "Over Bulanan"
      : activeBudgetInsight.todayRemainingSafe < 0
        ? "Over Harian"
        : activeBudgetInsight.status === "warning"
          ? "Waspada"
          : "Aman";
  const overspendingHelper = !activeBudgetInsight
    ? "Buat budget bulanan agar proteksi budget aktif."
    : activeBudgetInsight.todayRemainingSafe < 0
      ? `Hari ini lewat ${formatCurrency(Math.abs(activeBudgetInsight.todayRemainingSafe), dailyExpenseCurrency)} dari batas aman. ${nextDayBudgetText}`
      : `Batas aman hari ini ${formatCurrency(activeBudgetInsight.dynamicDailyLimit, dailyExpenseCurrency)}. ${nextDayBudgetText}`;
  const userDisplayName = getUserDisplayName(user);
  const userInitials = getUserInitials(user);
  const userStorageId = getUserStorageId(user);
  const profilePhoto =
    profilePhotos[userStorageId] || user?.user_metadata?.avatar_url || "";
  const isDark = theme === "dark";
  const menuTabClass = (tab) =>
    tab === activeTab
      ? "bg-brand-600 text-white shadow-[0_16px_40px_rgba(16,185,129,0.22)] dark:bg-emerald-500 dark:text-white"
      : isDark
        ? "bg-slate-900/88 text-slate-100 hover:bg-slate-800 hover:text-white"
        : "bg-white/70 text-slate-700 hover:bg-white hover:text-slate-950";
  const menuPanelClass =
    "cuan-menu fixed right-3 top-20 z-30 max-h-[calc(100svh-6rem)] w-[min(18rem,calc(100vw-1.5rem))] overflow-y-auto rounded-[24px] p-3 md:right-4 md:top-24 md:w-[min(20rem,calc(100vw-2rem))] md:rounded-[28px] md:p-4";
  const menuProfileCardClass =
    "cuan-menu-card flex items-center gap-3 rounded-2xl p-3";
  const navigationTabs = [
    { key: "today", label: "Hari Ini" },
    { key: "overview", label: "Kontrol" },
    { key: "add", label: "Tambah" },
    { key: "history", label: "Riwayat" },
    { key: "report", label: "Laporan" },
    { key: "investment", label: "Aset & Goals" },
    { key: "settings", label: "Setting" },
  ];
  const historyTransactions = [...orderTransactions(transactions)].reverse();

  async function handleProfilePhotoUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const nextPhoto = await resizeProfileImage(file);
      setProfilePhotos((current) => {
        const next = {
          ...current,
          [userStorageId]: nextPhoto,
        };
        writeAppStorage("profilePhotos", next);
        return next;
      });
      setMessage("Foto profil diperbarui.");
      setMessageTone("success");
    } catch (error) {
      setMessage(error.message || "Gagal memperbarui foto profil.");
      setMessageTone("error");
    }
  }

  function handleRemoveProfilePhoto() {
    if (!profilePhotos[userStorageId]) return;
    setProfilePhotos((current) => {
      const next = { ...current };
      delete next[userStorageId];
      writeAppStorage("profilePhotos", next);
      return next;
    });
    setMessage("Foto profil dihapus.");
    setMessageTone("info");
  }

  function handleToggleBalanceVisibility() {
    setBalanceVisible((current) => {
      const next = !current;
      writeAppStorage("balanceVisible", next);
      persistUserSettings(currencySettings || normalizeCurrencySettings(null), {
        balanceVisible: next,
      }).catch(() => {});
      return next;
    });
  }

  return html`
    <main className="app-shell relative isolate min-h-screen overflow-hidden px-4 pt-5 md:px-6 md:py-6 lg:px-8">
      <${PremiumMeshBackground} />
      <${ToastMessage} toast=${toast} onDismiss=${() => setToast(null)} />
      <div className="relative z-10 mx-auto max-w-7xl">
        <header className=${`${PREMIUM_PANEL} px-5 py-4 md:px-6`}>
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.14),transparent_42%)] opacity-80"></div>
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex w-fit rounded-full border border-brand-300/30 bg-brand-600 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-white shadow-[0_12px_30px_rgba(16,185,129,0.20)]">
              ${APP_NAME}
            </div>

            <div className="flex min-w-0 items-center justify-between gap-3 sm:justify-end">
              <${CompactBalancePrivacyPill}
                balances=${{
                  ...metrics.currencyBalances,
                  [DEFAULT_BASE_CURRENCY]: metrics.balanceIdr,
                }}
                activeCurrencies=${activeCurrencies}
                visible=${balanceVisible}
                onToggle=${handleToggleBalanceVisibility}
              />

              <button
                type="button"
                onClick=${() => setMenuOpen((current) => !current)}
                className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-brand-500/20 bg-white/[0.76] text-sm font-semibold text-slate-900 shadow-[0_12px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white/[0.90] dark:border-slate-700/60 dark:bg-slate-950/78 dark:text-slate-100 dark:hover:bg-slate-900/80"
              >
                <${AvatarBadge} src=${profilePhoto} initials=${userInitials} size="sm" />
              </button>
            </div>
          </div>
        </header>

        ${menuOpen
          ? html`
              <button
                type="button"
                aria-label="Tutup menu"
                onClick=${() => setMenuOpen(false)}
                className="fixed inset-0 z-20 bg-slate-950/5 backdrop-blur-[1px]"
              ></button>
              <section
                className=${menuPanelClass}
                onClick=${(event) => event.stopPropagation()}
              >
                <div className=${menuProfileCardClass}>
                  <${AvatarBadge} src=${profilePhoto} initials=${userInitials} size="md" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">
                      ${userDisplayName}
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-300">
                      ${user?.email || "Demo Lokal"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  ${navigationTabs.map(
                    (tab) => html`
                      <button
                        key=${tab.key}
                        type="button"
                        onClick=${() => {
                          setActiveTab(tab.key);
                          setMenuOpen(false);
                        }}
                        className=${`flex min-h-11 w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${menuTabClass(tab.key)}`}
                      >
                        <span>${tab.label}</span>
                        ${activeTab === tab.key ? html`<span>Aktif</span>` : null}
                      </button>
                    `,
                  )}
                </div>
              </section>
            `
          : null}

        <div className="mt-5">
          <${InfoBanner} message=${message} tone=${messageTone} />
        </div>

        ${activeTab === "today"
          ? html`
              <section className="mt-6">
                <${DailyExpenseForm}
                  onSubmit=${handleCreateTransaction}
                  loading=${loading}
                  budget=${activeBudgetInsight}
                  todaySpentThb=${todaySpentCurrency}
                  todaySpentIdr=${todaySpentIdr}
                  todaySpentCurrency=${todaySpentCurrency}
                  expenseCurrency=${dailyExpenseCurrency}
                />
              </section>
            `
          : activeTab === "budget"
            ? html`
                <section className="mt-6 grid gap-6">
                  <${BudgetForm}
                    onSubmit=${handleSaveBudget}
                    loading=${loading}
                    currentMonthKey=${metrics.currentMonthKey}
                  />
                  <${BudgetTracker}
                    budgets=${metrics.budgetInsights}
                    monthLabel=${metrics.currentMonthLabel}
                    onDelete=${handleDeleteBudget}
                  />
                </section>
              `
            : activeTab === "add"
              ? html`
                  <section className="mt-6">
                    <${TransactionForm}
                      transactions=${transactions}
                      onSubmit=${handleCreateTransaction}
                      loading=${loading}
                      activeCurrencies=${activeCurrencies}
                    />
                  </section>
                `
              : activeTab === "history"
                ? html`
                    <section className="mt-6">
                      <${TransactionList}
                        transactions=${historyTransactions}
                        onDelete=${handleDeleteTransaction}
                        onUpdate=${handleUpdateTransaction}
                        loading=${loading}
                        activeCurrencies=${activeCurrencies}
                        title="Riwayat Transaksi"
                        description="Semua pemasukan, pengeluaran, dan pergerakan saldo ada di sini."
                        emptyMessage="Belum ada transaksi."
                      />
                    </section>
                  `
                : activeTab === "overview"
                  ? html`
                      <section className="mt-6">
                        <${ControlCenterPage}
                          metrics=${metrics}
                          transactions=${transactions}
                          activeCurrencies=${activeCurrencies}
                          loading=${loading}
                          onBudgetDelete=${handleDeleteBudget}
                          onBudgetSubmit=${handleSaveBudget}
                          onNavigate=${(tab) => {
                            setActiveTab(tab);
                            setMenuOpen(false);
                          }}
                        />
                      </section>
                    `
                  : activeTab === "report"
                    ? html`
                        <section className="mt-6">
                          <${MonthlyReportPage}
                            transactions=${transactions}
                            budgets=${budgets}
                            selectedMonthKey=${reportMonthKey}
                            onMonthChange=${setReportMonthKey}
                            onNavigate=${(tab) => {
                              setActiveTab(tab);
                              setMenuOpen(false);
                            }}
                          />
                        </section>
                      `
                    : activeTab === "settings"
                    ? html`
                        <section className="mt-6">
                          <${SettingsPanel}
                            user=${user}
                            profilePhoto=${profilePhoto}
                            theme=${theme}
                            onThemeChange=${handleThemeChange}
                            currencySettings=${currencySettings}
                            onCurrencySettingsChange=${handleSaveCurrencySettings}
                            onUploadPhoto=${handleProfilePhotoUpload}
                            onRemovePhoto=${handleRemoveProfilePhoto}
                            onSignOut=${handleSignOut}
                          />
                        </section>
                      `
                    : activeTab === "investment"
                    ? html`
                        <section className="mt-6">
                          <${WealthGoalsPage}
                            metrics=${metrics}
                            loading=${loading}
                            onCreateGoal=${handleCreateGoal}
                            onDeleteGoal=${handleDeleteGoal}
                            onContribute=${handleAddGoalProgress}
                          />
                        </section>
                      `
                  : html`
                      <section className="mt-6">
                        <${WealthGoalsPage}
                          metrics=${metrics}
                          loading=${loading}
                          onCreateGoal=${handleCreateGoal}
                          onDeleteGoal=${handleDeleteGoal}
                          onContribute=${handleAddGoalProgress}
                        />
                      </section>
                    `}
      </div>
      <${MobileBottomNav}
        activeTab=${activeTab}
        onChange=${(tab) => {
          setActiveTab(tab);
          setMenuOpen(false);
        }}
      />
    </main>
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
              ${APP_NAME} mengalami error runtime
            </h1>
            <p className="mt-2 text-sm text-rose-700 dark:text-rose-200">
              Ini biasanya bug frontend, bukan kerusakan database. Buka console browser (F12)
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
              Reload
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
