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
};

const LEGACY_STORAGE_KEYS = {
  theme: "kas-poipet-theme",
  demoAuth: "kas-poipet-demo-auth",
  demoTransactions: "kas-poipet-demo-transactions",
  demoBudgets: "kas-poipet-demo-budgets",
  demoGoals: "kas-poipet-demo-goals",
  profilePhotos: "kas-poipet-profile-photos",
  balanceVisible: "kas-poipet-balance-visible",
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

const currencyFormatters = {
  idr: new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }),
  thb: new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
};

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

function formatCurrency(value, currency) {
  return currencyFormatters[currency].format(Number(value || 0));
}

function formatRate(value) {
  if (!value) return "-";
  return `${numberFormatter.format(Number(value))} IDR / 1 THB`;
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
  "tukar thb",
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
  const normalized = {
    ...row,
    id: row.id || createLegacyTransactionId(row, index),
    amount_idr: row.amount_idr == null ? null : Number(row.amount_idr),
    amount_thb: row.amount_thb == null ? null : Number(row.amount_thb),
    locked_rate: row.locked_rate == null ? null : Number(row.locked_rate),
  };

  if (!looksLikeLegacyExchange(normalized)) return normalized;

  const amountIdr = Number(normalized.amount_idr || 0);
  const amountThb = Number(normalized.amount_thb || 0);
  const inferredRate =
    Number(normalized.locked_rate || 0) > 0
      ? Number(normalized.locked_rate)
      : amountIdr > 0 && amountThb > 0
        ? amountIdr / amountThb
        : null;

  return {
    ...normalized,
    type: "exchange",
    category: null,
    category_group: null,
    locked_rate: inferredRate,
  };
}

function normalizeTransactions(rows) {
  return rows.map((row, index) => normalizeTransaction(row, index));
}

function normalizeBudget(row) {
  return {
    ...row,
    group_key: row.group_key || UNIVERSAL_BUDGET_GROUP,
    limit_thb: Number(row.limit_thb || 0),
  };
}

function normalizeGoal(row) {
  return {
    ...row,
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
        Number(item.locked_rate || 0) > 0 &&
        new Date(item.occurred_at).getTime() <= target,
    )
    .at(-1);
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
        Number(item.amount_thb || 0) > 0 &&
        getMonthKey(item.occurred_at) === monthKey,
    )
    .forEach((item) => {
      const dayKey = getLocalDayKey(item.occurred_at);
      const bucket = map.get(dayKey);
      if (bucket) {
        bucket.value += Number(item.amount_thb || 0);
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

      bucket.valueIdr += Number(item.amount_idr || 0);
      bucket.valueThb += Number(item.amount_thb || 0);
    });

  return days;
}

function computeBudgetInsights(monthlyExpenses, budgets, monthKey) {
  const spentThbTotal = monthlyExpenses.reduce(
    (sum, item) => sum + Number(item.amount_thb || 0),
    0,
  );
  const now = new Date();
  const [year, month] = String(monthKey).split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const isCurrentMonth = monthKey === getMonthKey(now);
  const currentDay = isCurrentMonth ? now.getDate() : daysInMonth;
  const todayDate = new Date(year, month - 1, currentDay);
  const todayKey = getLocalDayKey(todayDate);

  let spentBeforeTodayThb = 0;
  let spentTodayThb = 0;
  monthlyExpenses.forEach((item) => {
    const amount = Number(item.amount_thb || 0);
    const dayKey = getLocalDayKey(item.occurred_at);
    if (dayKey < todayKey) {
      spentBeforeTodayThb += amount;
      return;
    }
    if (dayKey === todayKey) {
      spentTodayThb += amount;
    }
  });

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
    .map((budget) => {
      const spentThb = spentThbTotal;
      const limitThb = Number(budget.limit_thb || 0);
      const remainingThb = limitThb - spentThb;
      const usage = limitThb > 0 ? spentThb / limitThb : 0;
      const baselineDailyLimitThb = daysInMonth > 0 ? limitThb / daysInMonth : 0;
      const dynamicDailyLimitThb =
        remainingDaysIncludingToday > 0
          ? Math.max((limitThb - spentBeforeTodayThb) / remainingDaysIncludingToday, 0)
          : 0;
      const todayRemainingSafeThb = dynamicDailyLimitThb - spentTodayThb;
      const projectedNextDailyLimitThb =
        remainingDaysAfterToday > 0
          ? Math.max((limitThb - spentBeforeTodayThb - spentTodayThb) / remainingDaysAfterToday, 0)
          : 0;
      const dailyAdjustmentThb = dynamicDailyLimitThb - baselineDailyLimitThb;

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
      } else if (todayRemainingSafeThb < 0) {
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
        spentThb,
        remainingThb,
        usage,
        daysInMonth,
        currentDay,
        remainingDaysIncludingToday,
        remainingDaysAfterToday,
        spentBeforeTodayThb,
        spentTodayThb,
        baselineDailyLimitThb,
        dynamicDailyLimitThb,
        todayRemainingSafeThb,
        projectedNextDailyLimitThb,
        dailyAdjustmentThb,
        status,
        statusLabel,
        tone,
        barClass,
        meta: {
          label: "Uang Keluar",
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
      Number(item.amount_thb || 0) > 0 &&
      getMonthKey(item.occurred_at) === currentMonthKey,
  );

  const incomeIdr = ordered
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + Number(item.amount_idr || 0), 0);
  const exchangeIdrOut = ordered
    .filter(
      (item) =>
        item.type === "exchange" &&
        Number(item.amount_thb || 0) > 0 &&
        Number(item.amount_idr || 0) > 0,
    )
    .reduce((sum, item) => sum + Number(item.amount_idr || 0), 0);
  const exchangeIdrIn = ordered
    .filter(
      (item) =>
        item.type === "exchange" &&
        Number(item.amount_thb || 0) < 0 &&
        Number(item.amount_idr || 0) > 0,
    )
    .reduce((sum, item) => sum + Number(item.amount_idr || 0), 0);
  const receivedThb = ordered
    .filter((item) => item.type === "exchange")
    .reduce((sum, item) => sum + Number(item.amount_thb || 0), 0);
  const spentThb = ordered
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + Number(item.amount_thb || 0), 0);
  const monthlyDirectSpentIdr = ordered
    .filter(
      (item) =>
        item.type === "expense" &&
        Number(item.amount_thb || 0) <= 0 &&
        Number(item.amount_idr || 0) > 0 &&
        getMonthKey(item.occurred_at) === currentMonthKey,
    )
    .reduce((sum, item) => sum + Number(item.amount_idr || 0), 0);
  const directSpentIdr = ordered
    .filter(
      (item) =>
        item.type === "expense" &&
        Number(item.amount_thb || 0) <= 0 &&
        Number(item.amount_idr || 0) > 0,
    )
    .reduce((sum, item) => sum + Number(item.amount_idr || 0), 0);
  const spentIdr = ordered
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + Number(item.amount_idr || 0), 0);

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
    bucket.valueThb += Number(item.amount_thb || 0);
    bucket.valueIdr += Number(item.amount_idr || 0);
    bucket.count += 1;
  });

  const monthlyThb = thbExpenses.reduce(
    (sum, item) => sum + Number(item.amount_thb || 0),
    0,
  );
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

  const budgetInsights = computeBudgetInsights(thbExpenses, budgets, currentMonthKey);
  const overspentCount = budgetInsights.filter((item) => item.status === "over").length;
  const warningCount = budgetInsights.filter((item) => item.status === "warning").length;
  const budgetLimitTotal = budgetInsights.reduce(
    (sum, item) => sum + Number(item.limit_thb || 0),
    0,
  );
  const budgetSpentTotal = budgetInsights.reduce(
    (sum, item) => sum + Number(item.spentThb || 0),
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
  const balanceIdrBase = incomeIdr + exchangeIdrIn - exchangeIdrOut - directSpentIdr;
  const allocatedToGoalsIdr = totalGoalSaved;
  const availableBalanceIdr = balanceIdrBase - allocatedToGoalsIdr;

  const activeExchange =
    [...ordered].reverse().find((item) => item.type === "exchange") || null;
  const latestRate = Number(activeExchange?.locked_rate || 0);
  const balanceThb = receivedThb - spentThb;
  const balanceThbValuationIdr =
    latestRate > 0 ? balanceThb * latestRate : null;
  const netWorthIdr =
    availableBalanceIdr + Number(balanceThbValuationIdr || 0);
  const resolveIdrValue = (item) => {
    const amountIdr = Number(item.amount_idr || 0);
    if (amountIdr > 0) return amountIdr;

    const amountThb = Number(item.amount_thb || 0);
    const itemRate = Number(item.locked_rate || latestRate || 0);
    return amountThb > 0 && itemRate > 0 ? amountThb * itemRate : 0;
  };
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

const HISTORY_CURRENCY_OPTIONS = [
  { value: "all", label: "Semua mata uang" },
  { value: "idr", label: "IDR" },
  { value: "thb", label: "THB" },
];

const TRANSACTION_FILTER_TABS = [
  { value: "all", label: "Semua" },
  { value: "income", label: "Masuk" },
  { value: "expense", label: "Keluar" },
  { value: "exchange", label: "Exchange" },
];

function getTransactionPreview(transaction) {
  if (transaction.type === "income") {
    return formatCurrency(transaction.amount_idr, "idr");
  }
  if (transaction.type === "exchange") {
    const amountIdr = Number(transaction.amount_idr || 0);
    const amountThb = Number(transaction.amount_thb || 0);
    if (amountThb < 0 && amountIdr > 0) {
      return `THB -${formatCurrency(Math.abs(amountThb), "thb")} -> IDR +${formatCurrency(amountIdr, "idr")}`;
    }
    if (amountIdr > 0 && amountThb > 0) {
      return `IDR -${formatCurrency(amountIdr, "idr")} -> THB ${formatCurrency(amountThb, "thb")}`;
    }
    if (amountThb > 0) {
      return `THB +${formatCurrency(amountThb, "thb")}`;
    }
    return "Transfer / Exchange";
  }
  if (Number(transaction.amount_thb || 0) <= 0) {
    return formatCurrency(transaction.amount_idr, "idr");
  }
  return `${formatCurrency(transaction.amount_thb, "thb")} (${formatCurrency(transaction.amount_idr, "idr")})`;
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
  if (transaction.type === "income") return "idr";
  if (Number(transaction.amount_thb || 0) > 0) return "thb";
  return "idr";
}

function getTransactionMainAmount(transaction) {
  const currency = getTransactionCurrency(transaction);
  return currency === "thb"
    ? Number(transaction.amount_thb || 0)
    : Number(transaction.amount_idr || 0);
}

function getTransactionIdrValuation(transaction) {
  const amountIdr = Number(transaction.amount_idr || 0);
  if (amountIdr > 0) return amountIdr;

  const amountThb = Number(transaction.amount_thb || 0);
  const lockedRate = Number(transaction.locked_rate || 0);
  if (amountThb > 0 && lockedRate > 0) {
    return amountThb * lockedRate;
  }

  return null;
}

function getTransactionIdrValuationWithRate(transaction, fallbackRate = 0) {
  const directValuation = getTransactionIdrValuation(transaction);
  if (directValuation != null) return directValuation;

  const amountThb = Number(transaction.amount_thb || 0);
  const rate = Number(transaction.locked_rate || fallbackRate || 0);
  if (amountThb > 0 && rate > 0) {
    return amountThb * rate;
  }

  return null;
}

function getTransactionComparableAmount(transaction) {
  return getTransactionIdrValuation(transaction) ?? getTransactionMainAmount(transaction);
}

function getExchangeTitle(transaction) {
  const amountIdr = Number(transaction.amount_idr || 0);
  const amountThb = Number(transaction.amount_thb || 0);
  if (amountThb < 0 && amountIdr > 0) return "Jual THB";
  if (amountThb > 0 && amountIdr > 0) return "Beli THB";
  return "Tukar Mata Uang";
}

function getExchangeVolumeIdr(transaction, fallbackRate = 0) {
  if (transaction.type !== "exchange") return 0;
  const amountIdr = Math.abs(Number(transaction.amount_idr || 0));
  if (amountIdr > 0) return amountIdr;
  return Math.abs(getTransactionIdrValuationWithRate(transaction, fallbackRate) || 0);
}

function getTransactionCategoryKey(transaction) {
  if (transaction.category) return transaction.category;
  if (transaction.type === "expense") return "Lainnya";
  return transaction.type === "exchange" ? "exchange" : "income";
}

function getTransactionCategoryLabel(transaction) {
  if (transaction.category) return getCategoryMeta(transaction.category).label;
  if (transaction.type === "exchange") return "Transfer / Exchange";
  if (transaction.type === "income") return "Pemasukan IDR";
  return "Lainnya";
}

function formatEditNumericValue(value) {
  const numericValue = Math.abs(Number(value || 0));
  return numericValue > 0 ? formatNumericInput(String(numericValue)) : "";
}

function getTransactionEditForm(transaction) {
  const flow = getTransactionFlow(transaction);
  const amountThb = Number(transaction.amount_thb || 0);
  const amountIdr = Number(transaction.amount_idr || 0);
  const inferredRate =
    Number(transaction.locked_rate || 0) > 0
      ? Number(transaction.locked_rate)
      : Math.abs(amountThb) > 0 && amountIdr > 0
        ? amountIdr / Math.abs(amountThb)
        : null;

  return {
    type: flow,
    occurred_at: toInputDateTime(new Date(transaction.occurred_at || Date.now())),
    description: transaction.description || "",
    category: transaction.category || DEFAULT_CATEGORY,
    expense_currency: flow === "expense" && amountThb > 0 ? "thb" : "idr",
    amount_idr: formatEditNumericValue(transaction.amount_idr),
    amount_thb: formatEditNumericValue(transaction.amount_thb),
    locked_rate: formatEditNumericValue(inferredRate),
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
    { value: "income", label: "Pemasukan IDR" },
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
      const amountIdr = Math.abs(Number(transaction.amount_idr || 0));
      const amountThb = Math.abs(Number(transaction.amount_thb || 0));
      const currencyMatches =
        filters.currency === "all" ||
        (filters.currency === "idr" && amountIdr > 0) ||
        (filters.currency === "thb" && amountThb > 0);
      const filterAmount =
        filters.currency === "idr"
          ? amountIdr
          : filters.currency === "thb"
            ? amountThb
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
      const valuation = getTransactionIdrValuationWithRate(transaction, latestRate) ?? 0;
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
  return Number(
    orderTransactions(transactions)
      .filter(
        (item) =>
          item.type === "exchange" &&
          Number(item.locked_rate || 0) > 0 &&
          new Date(item.occurred_at).getTime() <= endDate.getTime(),
      )
      .at(-1)?.locked_rate || 0,
  );
}

function resolveReportValueIdr(transaction, fallbackRate = 0) {
  const amountIdr = Number(transaction.amount_idr || 0);
  if (amountIdr > 0) return amountIdr;

  const amountThb = Number(transaction.amount_thb || 0);
  const rate = Number(transaction.locked_rate || fallbackRate || 0);
  return amountThb > 0 && rate > 0 ? amountThb * rate : 0;
}

function summarizeReportMonth(transactions, monthKey, fallbackRate = 0) {
  const monthTransactions = orderTransactions(transactions).filter(
    (item) => getMonthKey(item.occurred_at) === monthKey,
  );

  return monthTransactions.reduce(
    (summary, transaction) => {
      const valueIdr = resolveReportValueIdr(transaction, fallbackRate);

      if (transaction.type === "income") {
        summary.externalIncomeIdr += valueIdr;
      }

      if (transaction.type === "exchange") {
        const thbAmount = Number(transaction.amount_thb || 0);
        summary.thbReceived += thbAmount;
        summary.exchangeVolumeIdr += getExchangeVolumeIdr(transaction);
        summary.exchangeCount += 1;
        if (Number(transaction.amount_idr || 0) > 0 && thbAmount > 0) {
          summary.thbTopupCostIdr += Number(transaction.amount_idr || 0);
        }
      }

      if (transaction.type === "expense") {
        summary.expenseIdr += valueIdr;
        summary.expenseThb += Number(transaction.amount_thb || 0);
        if (Number(transaction.amount_thb || 0) > 0) {
          summary.thbExpenseValueIdr += valueIdr;
        } else {
          summary.directExpenseIdr += Number(transaction.amount_idr || 0);
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
      thbExpenseValueIdr: 0,
      expenseThb: 0,
      thbReceived: 0,
      thbTopupCostIdr: 0,
      exchangeVolumeIdr: 0,
      exchangeCount: 0,
      netCashflowIdr: 0,
    },
  );
}

function buildReportDailySeries(transactions, monthKey, fallbackRate = 0) {
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

      const valueIdr = resolveReportValueIdr(transaction, fallbackRate);
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
  const summary = summarizeReportMonth(transactions, monthKey, fallbackRate);
  const previousSummary = summarizeReportMonth(
    transactions,
    previousMonthKey,
    getLatestRateUntil(transactions, getMonthMeta(previousMonthKey).end),
  );
  const monthTransactions = orderTransactions(transactions).filter(
    (item) => getMonthKey(item.occurred_at) === monthKey,
  );
  const expenseTransactions = monthTransactions.filter(
    (item) => item.type === "expense",
  );
  const dailySeries = buildReportDailySeries(transactions, monthKey, fallbackRate);
  const categoryAccumulator = {};

  expenseTransactions.forEach((transaction) => {
    const category = transaction.category || "Lainnya";
    const valueIdr = resolveReportValueIdr(transaction, fallbackRate);
    if (!categoryAccumulator[category]) {
      categoryAccumulator[category] = {
        valueIdr: 0,
        valueThb: 0,
        count: 0,
      };
    }

    categoryAccumulator[category].valueIdr += valueIdr;
    categoryAccumulator[category].valueThb += Number(transaction.amount_thb || 0);
    categoryAccumulator[category].count += 1;
  });

  const categoryBreakdown = Object.entries(categoryAccumulator)
    .map(([category, data]) => ({
      key: category,
      label: getCategoryMeta(category).label,
      meta: getCategoryMeta(category),
      valueIdr: data.valueIdr,
      valueThb: data.valueThb,
      count: data.count,
      share: summary.expenseIdr > 0 ? data.valueIdr / summary.expenseIdr : 0,
    }))
    .sort((a, b) => b.valueIdr - a.valueIdr);

  const budgetLimitThb = budgets
    .filter(
      (budget) =>
        budget.month_key === monthKey &&
        (budget.group_key || UNIVERSAL_BUDGET_GROUP) === UNIVERSAL_BUDGET_GROUP,
    )
    .reduce((sum, budget) => sum + Number(budget.limit_thb || 0), 0);
  const budgetSpentThb = summary.expenseThb;
  const budgetUsage = budgetLimitThb > 0 ? budgetSpentThb / budgetLimitThb : 0;
  const budgetRemainingThb = budgetLimitThb - budgetSpentThb;
  const budgetStatus =
    budgetLimitThb <= 0
      ? "none"
      : budgetUsage > 1
        ? "over"
        : budgetUsage >= 0.85
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
            Gabungan saldo IDR tersedia dan valuasi saldo THB ke IDR.
            ${metrics.balanceThbValuationIdr != null
              ? ` Valuasi THB saat ini ${formatCurrency(
                  metrics.balanceThbValuationIdr,
                  "idr",
                )}.`
              : " Valuasi THB menunggu rate aktif."}
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
  const stats = [
    {
      title: "Saldo IDR",
      value: formatCurrency(metrics.balanceIdr, "idr"),
      helper: "Tersedia",
    },
    {
      title: "Saldo THB",
      value: formatCurrency(metrics.balanceThb, "thb"),
      helper: metrics.latestRate ? formatRate(metrics.latestRate) : "Belum ada rate",
    },
    {
      title: "Uang masuk",
      value: formatCurrency(metrics.monthlyIncomeIdr, "idr"),
      helper: "Bulan ini",
    },
    {
      title: "Uang keluar",
      value: formatCurrency(metrics.monthlyExpenseIdr, "idr"),
      helper: "Valuasi IDR",
    },
    {
      title: "Belanja IDR",
      value: formatCurrency(metrics.monthlyDirectSpentIdr, "idr"),
      helper: "Bulan ini",
    },
    {
      title: "Belanja THB",
      value: formatCurrency(metrics.monthlyThb, "thb"),
      helper: "Bulan ini",
    },
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
            Ringkasan limit uang keluar THB bulan berjalan.
          </p>
        </div>
        <span className=${`rounded-full border px-3 py-1 text-xs font-semibold ${chipClass}`}>
          ${metrics.budgetStatusLabel}
        </span>
      </div>

      <div className="relative mt-5 grid grid-cols-3 gap-3">
        ${[
          ["Budget", formatCurrency(metrics.budgetLimitTotal, "thb")],
          ["Terpakai", formatCurrency(metrics.budgetSpentTotal, "thb")],
          ["Sisa", formatCurrency(Math.max(metrics.budgetRemainingThb, 0), "thb")],
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

function buildControlCenter(metrics) {
  const monthMeta = getMonthMeta(metrics.currentMonthKey);
  const remainingDays = Math.max(monthMeta.daysInMonth - monthMeta.elapsedDays, 0);
  const activeBudget = metrics.budgetInsights[0] || null;
  const thbDailyAverage =
    monthMeta.elapsedDays > 0 ? metrics.monthlyThb / monthMeta.elapsedDays : 0;
  const thbRunwayDays =
    thbDailyAverage > 0 ? Math.floor(metrics.balanceThb / thbDailyAverage) : null;
  const projectedExpenseIdr = metrics.averageDailyExpenseIdr * monthMeta.daysInMonth;
  const projectedNetIdr = metrics.monthlyExternalIncomeIdr - projectedExpenseIdr;
  const projectedThbNeed = thbDailyAverage * remainingDays;
  const projectedThbGap = Math.max(projectedThbNeed - metrics.balanceThb, 0);
  const topCategory = metrics.topExpenseCategory;

  let score = 100;
  if (metrics.budgetStatus === "none") score -= 8;
  if (metrics.budgetStatus === "warning") score -= 16;
  if (metrics.budgetStatus === "over") score -= 30;
  if (metrics.monthlyNetChangeIdr < 0) score -= 14;
  if (projectedNetIdr < 0) score -= 12;
  if (metrics.latestRate <= 0 && metrics.balanceThb > 0) score -= 8;
  if (metrics.balanceIdr < metrics.averageDailyExpenseIdr * 7) score -= 10;
  if (thbRunwayDays != null && thbRunwayDays < 3) score -= 18;
  else if (thbRunwayDays != null && thbRunwayDays < 7) score -= 10;
  if (topCategory?.share > 0.45) score -= 6;

  const healthScore = Math.max(Math.min(Math.round(score), 100), 0);
  const healthLabel =
    healthScore >= 82
      ? "Stabil"
      : healthScore >= 66
        ? "Perlu dijaga"
        : healthScore >= 45
          ? "Waspada"
          : "Kritis";
  const healthTone =
    healthScore >= 82
      ? "text-brand-700 dark:text-brand-300"
      : healthScore >= 66
        ? "text-amber-700 dark:text-amber-300"
        : "text-rose-700 dark:text-rose-300";

  const alerts = [];
  if (metrics.budgetStatus === "none") {
    alerts.push({
      title: "Budget belum aktif",
      body: "Buat limit bulanan agar CUANSYNC bisa menjaga batas aman harian.",
      tone: "amber",
    });
  } else if (metrics.budgetStatus === "over") {
    alerts.push({
      title: "Budget melewati batas",
      body: `Pengeluaran THB sudah ${formatPercent(metrics.budgetUsageTotal)} dari budget bulan ini.`,
      tone: "rose",
    });
  } else if (metrics.budgetStatus === "warning") {
    alerts.push({
      title: "Budget mendekati limit",
      body: `Sisa budget sekitar ${formatCurrency(Math.max(metrics.budgetRemainingThb, 0), "thb")}.`,
      tone: "amber",
    });
  }

  if (thbRunwayDays != null && thbRunwayDays <= 7) {
    alerts.push({
      title: "Saldo THB perlu dipantau",
      body: `Dengan ritme sekarang, THB cukup sekitar ${Math.max(thbRunwayDays, 0)} hari.`,
      tone: thbRunwayDays <= 3 ? "rose" : "amber",
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
  if (metrics.budgetStatus === "none") {
    nextActions.push({
      title: "Buat budget bulan ini",
      body: "Aktifkan batas aman harian untuk belanja THB.",
      target: "control-budget",
    });
  }
  if (projectedThbGap > 0) {
    nextActions.push({
      title: "Rencanakan top up THB",
      body: `Estimasi kurang ${formatCurrency(projectedThbGap, "thb")} sampai akhir bulan.`,
      target: "add",
    });
  }
  if (activeBudget?.todayRemainingSafeThb != null && activeBudget.todayRemainingSafeThb < 0) {
    nextActions.push({
      title: "Tahan belanja THB hari ini",
      body: `Hari ini lewat ${formatCurrency(Math.abs(activeBudget.todayRemainingSafeThb), "thb")} dari batas aman.`,
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
    healthLabel,
    healthScore,
    healthTone,
    nextActions: nextActions.slice(0, 4),
    projectedExpenseIdr,
    projectedNetIdr,
    projectedThbGap,
    remainingDays,
    thbDailyAverage,
    thbRunwayDays,
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

function ControlCenterHero({ metrics, control }) {
  const scoreWidth = `${control.healthScore}%`;

  return html`
    <section className=${`${PREMIUM_PANEL} control-center-card p-5 md:p-6`}>
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand-400/14 blur-3xl"></div>
      <div className="relative grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
            Financial Control Center
          </p>
          <h2 className="mt-3 font-display text-3xl font-black tracking-[-0.04em] text-slate-950 dark:text-white md:text-4xl">
            ${control.healthLabel}
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Monitor risiko hari ini, runway saldo, dan keputusan yang perlu diambil.
          </p>
        </div>
        <div className="rounded-[28px] border border-slate-200/70 bg-white/62 p-4 dark:border-white/10 dark:bg-slate-950/40 md:w-52">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Health score
          </p>
          <p className=${`mt-2 text-4xl font-black tracking-[-0.05em] ${control.healthTone}`}>
            ${control.healthScore}
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
          helper="IDR + valuasi THB"
        />
        <${ControlMetric}
          label="Runway THB"
          value=${control.thbRunwayDays == null ? "Stabil" : `${Math.max(control.thbRunwayDays, 0)} hari`}
          helper=${control.thbDailyAverage > 0 ? `${formatCurrency(control.thbDailyAverage, "thb")}/hari` : "Belum ada ritme THB"}
        />
        <${ControlMetric}
          label="Forecast net"
          value=${formatCurrency(control.projectedNetIdr, "idr")}
          helper="Estimasi akhir bulan"
        />
        <${ControlMetric}
          label="Sisa budget"
          value=${metrics.budgetLimitTotal > 0 ? formatCurrency(Math.max(metrics.budgetRemainingThb, 0), "thb") : "-"}
          helper=${metrics.budgetStatusLabel}
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
          Next Best Action
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
    metrics.budgetLimitTotal > 0
      ? `${Math.min(Math.max(metrics.budgetUsageTotal * 100, 0), 100)}%`
      : "0%";
  const runwayLabel =
    control.thbRunwayDays == null
      ? "Belum ada ritme"
      : `${Math.max(control.thbRunwayDays, 0)} hari`;

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
            Cash Runway
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Daya tahan saldo THB dan batas budget.
          </p>
        </div>
        <div className="relative mt-5 grid gap-4">
          <div>
            <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
              <span>Budget THB</span>
              <span>${metrics.budgetLimitTotal > 0 ? formatPercent(metrics.budgetUsageTotal) : "-"}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
              <div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-emerald-300" style=${{ width: budgetWidth }}></div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <${ControlMetric}
              label="Runway"
              value=${runwayLabel}
              helper="Berdasarkan rata-rata THB"
            />
            <${ControlMetric}
              label="Gap THB"
              value=${formatCurrency(control.projectedThbGap, "thb")}
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
  loading,
  onBudgetDelete,
  onBudgetSubmit,
}) {
  return html`
    <section id="control-budget-section" className="grid scroll-mt-6 gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="grid gap-4">
        <section className=${`${PREMIUM_PANEL} p-5 md:p-6`}>
          <div className="relative">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
              Budget control
            </p>
            <h3 className="mt-2 font-display text-xl font-black text-slate-950 dark:text-white">
              Atur batas aman bulanan
            </h3>
            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Budget sekarang jadi bagian dari Kontrol, supaya risiko dan action hari ini langsung tersambung.
            </p>
          </div>
        </section>
        <${BudgetForm}
          onSubmit=${onBudgetSubmit}
          loading=${loading}
          currentMonthKey=${metrics.currentMonthKey}
        />
      </div>

      <${BudgetTracker}
        budgets=${metrics.budgetInsights}
        monthLabel=${metrics.currentMonthLabel}
        onDelete=${onBudgetDelete}
      />
    </section>
  `;
}

function ControlCenterPage({
  metrics,
  transactions,
  onBudgetDelete,
  onBudgetSubmit,
  loading = false,
  onNavigate,
}) {
  const control = buildControlCenter(metrics);

  if (!transactions.length) {
    return html`
      <div className="grid gap-4">
        <${ControlCenterEmptyState} onNavigate=${onNavigate} />
        <${ControlBudgetHub}
          metrics=${metrics}
          loading=${loading}
          onBudgetDelete=${onBudgetDelete}
          onBudgetSubmit=${onBudgetSubmit}
        />
      </div>
    `;
  }

  return html`
    <div className="grid gap-4">
      <${ControlCenterHero} metrics=${metrics} control=${control} />
      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <${ControlAlerts} alerts=${control.alerts} />
        <${ControlNextActions} actions=${control.nextActions} onNavigate=${onNavigate} />
      </div>
      <${ControlForecast} metrics=${metrics} control=${control} />
      <${ControlBudgetHub}
        metrics=${metrics}
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
            Top up THB dicatat terpisah sebagai perpindahan aset.
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
      title: "Top up THB",
      value: formatCurrency(report.summary.thbTopupCostIdr, "idr"),
      helper: `${formatCurrency(report.summary.thbReceived, "thb")} diterima`,
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
    <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
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
  const width = `${Math.min(Math.max(report.budgetUsage * 100, report.budgetUsage > 0 ? 8 : 0), 100)}%`;
  const barClass =
    report.budgetStatus === "over"
      ? "from-rose-500 to-rose-400"
      : report.budgetStatus === "warning"
        ? "from-amber-400 to-orange-500"
        : "from-brand-500 to-emerald-300";
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
            Budget Pulse
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Status budget THB untuk ${report.meta.label}.
          </p>
        </div>
        <span className=${`rounded-full px-3 py-1 text-xs font-black ${chipClass}`}>
          ${report.budgetStatusLabel}
        </span>
      </div>

      <div className="relative mt-5 grid grid-cols-3 gap-3">
        ${[
          ["Budget", formatCurrency(report.budgetLimitThb, "thb")],
          ["Terpakai", formatCurrency(report.budgetSpentThb, "thb")],
          ["Sisa", formatCurrency(Math.max(report.budgetRemainingThb, 0), "thb")],
        ].map(
          ([label, value]) => html`
            <div key=${label}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                ${label}
              </p>
              <p className="mt-2 break-words text-sm font-black text-slate-950 dark:text-white">
                ${value}
              </p>
            </div>
          `,
        )}
      </div>

      <div className="relative mt-5 h-3 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
        <div
          className=${`report-bar-fill h-full rounded-full bg-gradient-to-r ${barClass}`}
          style=${{ width }}
        ></div>
      </div>
      <p className="relative mt-2 text-xs text-slate-600 dark:text-slate-300">
        ${report.budgetLimitThb > 0
          ? `${formatPercent(report.budgetUsage)} dari budget sudah terpakai.`
          : "Belum ada budget aktif untuk bulan ini."}
      </p>
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
    report.budgetLimitThb > 0
      ? `${formatPercent(report.budgetUsage)} terpakai dari ${formatCurrency(report.budgetLimitThb, "thb")}`
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
            Ringkasan cashflow, budget, kategori, dan ritme pengeluaran dalam satu layar.
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
          Semua THB di sini dianggap operasional Poipet, jadi breakdown dibuat langsung per kategori belanja.
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
              Belum ada pengeluaran bulan ini. Begitu kamu input expense, kategori operasional THB akan langsung tampil di sini.
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
            <h3 className="font-display text-xl font-bold">Overspending Guard</h3>
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
                          Limit ${formatCurrency(budget.limit_thb, "thb")}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Terpakai ${formatCurrency(budget.spentThb, "thb")} /
                          Sisa ${formatCurrency(Math.max(budget.remainingThb, 0), "thb")}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Batas aman hari ini ${formatCurrency(budget.dynamicDailyLimitThb, "thb")}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Pengeluaran hari ini ${formatCurrency(budget.spentTodayThb, "thb")}
                        </p>
                        <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                          ${budget.todayRemainingSafeThb >= 0
                            ? `Sisa aman hari ini ${formatCurrency(budget.todayRemainingSafeThb, "thb")}`
                            : `Over hari ini ${formatCurrency(Math.abs(budget.todayRemainingSafeThb), "thb")}`}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          ${budget.remainingDaysAfterToday > 0
                            ? `Jatah harian besok ${formatCurrency(budget.projectedNextDailyLimitThb, "thb")} untuk ${budget.remainingDaysAfterToday} hari tersisa`
                            : "Hari terakhir bulan ini, tidak ada jatah hari berikutnya."}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          ${budget.dailyAdjustmentThb >= 0
                            ? `Jatah harian naik ${formatCurrency(budget.dailyAdjustmentThb, "thb")} dari rata-rata awal`
                            : `Jatah harian turun ${formatCurrency(Math.abs(budget.dailyAdjustmentThb), "thb")} dari rata-rata awal`}
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
                            Math.max(budget.usage * 100, budget.spentThb > 0 ? 10 : 0),
                            100,
                          )}%`,
                        }}
                      ></div>
                    </div>
                    ${budget.status === "over"
                      ? html`
                          <p className="mt-3 text-xs font-semibold text-rose-600 dark:text-rose-300">
                            Overspending ${formatCurrency(
                              Math.abs(budget.remainingThb),
                              "thb",
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
                Buat limit uang keluar bulanan agar indikator overspending dan batas aman harian mulai bekerja.
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
        <h3 className="font-display text-xl font-bold">Progress Tracker Tujuan</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300/80">
          Pantau capaian dana darurat atau target finansial lain dengan progress bar yang hidup.
        </p>
      </div>

      ${goals.length
        ? html`
            <div className="relative mt-5 space-y-3">
              ${goals.map(
                (goal) => html`
                  <div
                    key=${goal.id}
                    className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-xl dark:bg-slate-900/40"
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

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick=${() => {
                          setOpenAction("deposit");
                          setOpenGoalId((current) =>
                            current === goal.id ? null : goal.id,
                          );
                        }}
                        className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-700 backdrop-blur-xl transition hover:-translate-y-0.5 dark:bg-slate-900/40 dark:text-slate-200"
                      >
                        Setor dari Saldo Utama
                      </button>
                      <button
                        type="button"
                        onClick=${() => {
                          setOpenAction("withdraw");
                          setOpenGoalId((current) =>
                            current === goal.id ? null : goal.id,
                          );
                        }}
                        className="rounded-full border border-sky-300/25 bg-sky-400/10 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:-translate-y-0.5 dark:border-sky-400/20 dark:bg-sky-500/10 dark:text-sky-200"
                      >
                        Tarik ke Saldo Utama
                      </button>
                      <button
                        type="button"
                        onClick=${() => onDelete(goal)}
                        className="rounded-full border border-rose-300/25 bg-rose-400/10 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:-translate-y-0.5 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200"
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
              Belum ada tujuan tabungan. Tambahkan target seperti dana darurat agar progress tracker mulai terisi.
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
          Transfer THB ber-rate menjadi fondasi valuasi IDR untuk semua uang keluar harian.
        </p>
      </div>

      <div className="relative mt-5 space-y-3">
        ${activeExchange
          ? html`
              <div className="rounded-2xl border border-brand-300/25 bg-brand-400/10 p-4 backdrop-blur-xl dark:border-brand-300/20 dark:bg-brand-500/10">
                <p className="text-sm font-semibold text-brand-800 dark:text-brand-200">Rate aktif terakhir</p>
                <p className="mt-2 text-lg font-bold text-brand-900 dark:text-white">
                  ${formatCurrency(activeExchange.amount_idr, "idr")} ->
                  ${formatCurrency(activeExchange.amount_thb, "thb")}
                </p>
                <p className="mt-2 text-sm text-brand-800 dark:text-brand-200">
                  ${formatRate(activeExchange.locked_rate)}
                </p>
              </div>
            `
          : html`
              <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-4 text-sm text-slate-600 backdrop-blur-xl dark:bg-slate-900/25 dark:text-slate-300/80">
                Belum ada transfer THB ber-rate. Tambahkan rate pada transaksi beli/tukar THB agar valuasi pengeluaran THB terhadap IDR bisa terkunci.
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
            ${HISTORY_CURRENCY_OPTIONS.map(
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
        currency === "thb" && valuationIdr != null
          ? `Valuasi ${formatCurrency(valuationIdr, "idr")}`
          : currency.toUpperCase(),
    };
  }

  const amountIdr = Number(transaction.amount_idr || 0);
  const amountThb = Number(transaction.amount_thb || 0);
  if (amountThb < 0 && amountIdr > 0) {
    return {
      primary: `+${formatCurrency(amountIdr, "idr")}`,
      secondary: `THB -${formatCurrency(Math.abs(amountThb), "thb")}`,
    };
  }
  if (amountIdr > 0 && amountThb > 0) {
    return {
      primary: `-${formatCurrency(amountIdr, "idr")}`,
      secondary: `THB +${formatCurrency(amountThb, "thb")}`,
    };
  }
  return {
    primary: getTransactionPreview(transaction),
    secondary: "Exchange",
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
  const flow = form.type || getTransactionFlow(transaction);
  const isIncome = flow === "income";
  const isExpense = flow === "expense";
  const isExchange = flow === "exchange";
  const isExpenseThb = isExpense && form.expense_currency === "thb";
  const amountIdr = Number(normalizeNumericInput(form.amount_idr));
  const amountThb = Number(normalizeNumericInput(form.amount_thb));
  const lockedRate = Number(normalizeNumericInput(form.locked_rate));
  const descriptionValid = String(form.description || "").trim().length > 0;
  const submitDisabled =
    loading ||
    !descriptionValid ||
    (isIncome && amountIdr <= 0) ||
    (isExpense && (isExpenseThb ? amountThb <= 0 || lockedRate <= 0 : amountIdr <= 0)) ||
    (isExchange && (amountIdr <= 0 || amountThb <= 0 || lockedRate <= 0));
  const typeOptions = [
    { value: "income", label: "Uang Masuk" },
    { value: "expense", label: "Uang Keluar" },
    { value: "exchange", label: "Exchange" },
  ];
  const formSubtitle = isExchange
    ? "Exchange"
    : isIncome
      ? "Uang masuk • IDR"
      : `Uang keluar • ${isExpenseThb ? "THB" : "IDR"}`;

  function updateField(field, value) {
    onChange({ ...form, [field]: value });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await onSave(form);
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

      ${(isIncome || (isExpense && !isExpenseThb) || isExchange)
        ? html`
            <label className="block space-y-2">
              <span className="block text-xs font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                ${isExchange ? "IDR keluar" : isIncome ? "Nominal IDR" : "Nominal IDR"}
              </span>
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value=${form.amount_idr}
                onChange=${(event) =>
                  updateField("amount_idr", formatNumericInput(event.target.value))}
                placeholder="0"
                required
                className=${GLASS_INPUT}
              />
            </label>
          `
        : null}

      ${(isExpenseThb || isExchange)
        ? html`
            <label className="block space-y-2">
              <span className="block text-xs font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                ${isExchange ? "THB masuk" : "Nominal THB"}
              </span>
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

            <label className="block space-y-2">
              <span className="block text-xs font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                Rate IDR/THB
              </span>
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value=${form.locked_rate}
                onChange=${(event) =>
                  updateField("locked_rate", formatNumericInput(event.target.value))}
                placeholder="539"
                required
                className=${GLASS_INPUT}
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
                                  ? form.expense_currency || "idr"
                                  : form.expense_currency,
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
                        <div className="cuan-segment grid grid-cols-2 gap-2 rounded-2xl p-1">
                          ${["idr", "thb"].map((currency) => {
                            const active = form.expense_currency === currency;
                            return html`
                              <button
                                key=${currency}
                                type="button"
                                onClick=${() => updateField("expense_currency", currency)}
                                className=${`min-h-11 rounded-2xl px-3 py-2 text-sm font-black transition ${active ? "bg-brand-600 text-white shadow-[0_14px_34px_rgba(16,185,129,0.20)] dark:bg-emerald-500" : "text-slate-600 hover:bg-white/75 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"}`}
                              >
                                ${currency.toUpperCase()}
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
    ? compactAmount.primary
    : `${signedPrefix}${formatCurrency(mainAmount, currency)}`;
  const currencyLabel = isExchange ? "Transfer / Exchange" : currency.toUpperCase();
  const showValuation = valuationIdr != null;
  const rateText = transaction.locked_rate ? formatRate(transaction.locked_rate) : "-";
  const receiptMeta = [
    ["Tanggal", formatShortDateTime(transaction.occurred_at)],
    ["Kategori", categoryLabel],
    ["Mata uang", currencyLabel],
    ["Rate", rateText],
  ];
  const receiptHelper = isExchange
    ? compactAmount.secondary
    : showValuation && currency === "thb"
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
}) {
  const [form, setForm] = useState({
    description: "",
    category: DEFAULT_CATEGORY,
    amount_thb: "",
  });

  const statusTone = !budget
    ? "border-slate-300/20 bg-slate-400/10 text-slate-900 dark:border-slate-400/20 dark:bg-slate-500/10 dark:text-slate-200"
    : budget.status === "over" || budget.todayRemainingSafeThb < 0
      ? "border-rose-300/20 bg-rose-400/10 text-rose-900 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200"
      : budget.status === "warning"
        ? "border-amber-300/20 bg-amber-400/10 text-amber-900 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200"
        : "border-emerald-300/20 bg-emerald-400/10 text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200";
  const statusLabel = !budget
    ? "Belum ada budget"
    : budget.todayRemainingSafeThb < 0
      ? "Lewat batas"
      : budget.status === "warning"
        ? "Waspada"
        : "Aman";
  const todayLimit = budget
    ? formatCurrency(budget.dynamicDailyLimitThb, "thb")
    : "-";
  const safeRemaining = budget
    ? budget.todayRemainingSafeThb >= 0
      ? formatCurrency(budget.todayRemainingSafeThb, "thb")
      : `- ${formatCurrency(Math.abs(budget.todayRemainingSafeThb), "thb")}`
    : "-";
  const parsedAmountThb = Number(normalizeNumericInput(form.amount_thb));
  const submitDisabled = parsedAmountThb <= 0;

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const succeeded = await onSubmit({
      type: "expense",
      occurred_at: new Date().toISOString(),
      description: form.description.trim(),
      category_group: UNIVERSAL_BUDGET_GROUP,
      category: form.category,
      amount_idr: null,
      amount_thb: normalizeNumericInput(form.amount_thb),
      exchange_rate: null,
      exchange_source: null,
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
    <div className=${`${PREMIUM_PANEL} p-5 md:p-6`}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),transparent_50%)] opacity-80"></div>
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-xl font-bold">Pengeluaran Hari Ini</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300/80">
              Input cepat untuk makan, jajan, dan pengeluaran harian lain.
            </p>
          </div>
          <div className="inline-flex rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-slate-600 backdrop-blur-xl dark:bg-slate-900/40 dark:text-slate-300">
            Sekarang
          </div>
        </div>
      </div>

      <div className="relative mt-5 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-xl dark:bg-slate-900/40">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className=${`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusTone}`}>
            ${statusLabel}
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Pengingat hari ini
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
              ${budget ? `Batas ${todayLimit}` : "Atur budget lewat Kontrol"}
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Terpakai
            </p>
            <p className="mt-2 text-lg font-bold text-slate-950 dark:text-white">
              ${formatCurrency(todaySpentThb, "thb")}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Sisa aman
            </p>
            <p className="mt-2 text-lg font-bold text-slate-950 dark:text-white">
              ${safeRemaining}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Valuasi IDR
            </p>
            <p className="mt-2 text-lg font-bold text-slate-950 dark:text-white">
              ${todaySpentIdr > 0 ? formatCurrency(todaySpentIdr, "idr") : "-"}
            </p>
          </div>
        </div>
      </div>

      <form className="relative mt-5 grid gap-4" onSubmit=${handleSubmit}>
        <label className="block">
          <span className="mb-2 block text-sm font-medium">Jumlah (THB)</span>
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

function DailyBudgetGuard({ budget, todaySpentThb, todaySpentIdr, monthLabel }) {
  const statusTone = !budget
    ? "border-slate-300/20 bg-slate-400/10 text-slate-900 dark:border-slate-400/20 dark:bg-slate-500/10 dark:text-slate-200"
    : budget.status === "over" || budget.todayRemainingSafeThb < 0
      ? "border-rose-300/20 bg-rose-400/10 text-rose-900 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200"
      : budget.status === "warning"
        ? "border-amber-300/20 bg-amber-400/10 text-amber-900 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200"
        : "border-emerald-300/20 bg-emerald-400/10 text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200";

  const statusLabel = !budget
    ? "Belum ada budget"
    : budget.todayRemainingSafeThb < 0
      ? "Lewat batas hari ini"
      : budget.status === "warning"
        ? "Mendekati batas"
        : "Masih aman";

  const todayLimit = budget ? formatCurrency(budget.dynamicDailyLimitThb, "thb") : "-";
  const safeRemaining = budget
    ? budget.todayRemainingSafeThb >= 0
      ? formatCurrency(budget.todayRemainingSafeThb, "thb")
      : `- ${formatCurrency(Math.abs(budget.todayRemainingSafeThb), "thb")}`
    : "-";

  return html`
    <div className=${`${PREMIUM_PANEL} p-5 md:p-6`}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),transparent_50%)] opacity-80"></div>
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-xl font-bold">Overspending Guard</h3>
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
              ${formatCurrency(todaySpentThb, "thb")}
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
                    ${formatCurrency(budget.spentThb, "thb")} / ${formatCurrency(
                      budget.limit_thb,
                      "thb",
                    )}
                  </span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-slate-200/70 dark:bg-slate-800">
                  <div
                    className=${`h-full rounded-full bg-gradient-to-r ${budget.barClass}`}
                    style=${{
                      width: `${Math.min(
                        Math.max(budget.usage * 100, budget.spentThb > 0 ? 8 : 0),
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

function InvestmentSnapshot({ totalSaved, totalTarget, nextGoal }) {
  const progress =
    totalTarget > 0 ? Math.min(totalSaved / totalTarget, 1) : 0;

  return html`
    <div className=${`${PREMIUM_PANEL} p-5 md:p-6`}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),transparent_50%)] opacity-80"></div>
      <div className="relative">
        <h3 className="font-display text-xl font-bold">Investasi</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300/80">
          Ringkasan target yang sedang kamu bangun.
        </p>
      </div>

      <div className="relative mt-5 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-xl dark:bg-slate-900/40">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Total tersimpan
            </p>
            <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">
              ${formatCurrency(totalSaved, "idr")}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Target
            </p>
            <p className="mt-2 text-lg font-bold text-slate-950 dark:text-white">
              ${formatCurrency(totalTarget, "idr")}
            </p>
          </div>
        </div>
        <div className="mt-4 h-2 rounded-full bg-slate-200/70 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-sky-500"
            style=${{
              width: `${Math.max(progress * 100, totalSaved > 0 ? 8 : 0)}%`,
            }}
          ></div>
        </div>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300/80">
          ${formatPercent(progress)} tercapai
        </p>
      </div>

      <div className="relative mt-4 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-xl dark:bg-slate-900/40">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
          Target berikutnya
        </p>
        ${nextGoal
          ? html`
              <p className="mt-2 text-lg font-bold text-slate-950 dark:text-white">
                ${nextGoal.name}
              </p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300/80">
                Sisa ${formatCurrency(nextGoal.remainingIdr, "idr")}
              </p>
            `
          : html`
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300/80">
                Belum ada target investasi atau tabungan.
              </p>
            `}
      </div>
    </div>
  `;
}

function SettingsPanel({
  user,
  profilePhoto,
  theme,
  onThemeChange,
  onUploadPhoto,
  onRemovePhoto,
  onSignOut,
}) {
  const initials = getUserInitials(user);
  const displayName = getUserDisplayName(user);

  return html`
    <div className="grid gap-6">
      <div className=${`${PREMIUM_PANEL} p-5 md:p-6`}>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),transparent_50%)] opacity-80"></div>
        <div className="relative">
          <h3 className="font-display text-xl font-bold">Pengaturan</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300/80">
            Foto profil, tampilan, dan akun.
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
              Upload foto
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

function TransactionForm({ transactions, onSubmit, loading }) {
  const [entryType, setEntryType] = useState("income");
  const [incomeCurrency, setIncomeCurrency] = useState("idr");
  const [expenseCurrency, setExpenseCurrency] = useState("thb");
  const [form, setForm] = useState({
    occurred_at: toInputDateTime(),
    description: "",
    category: DEFAULT_CATEGORY,
    amount_idr: "",
    amount_thb: "",
    exchange_rate: "",
    exchange_source: "purchase",
  });

  const activeExchange = useMemo(
    () =>
      form.occurred_at
        ? getLockedExchange(transactions, new Date(form.occurred_at).toISOString())
        : null,
    [form.occurred_at, transactions],
  );
  const parsedAmountThb = Number(normalizeNumericInput(form.amount_thb));
  const parsedAmountIdr = Number(normalizeNumericInput(form.amount_idr));
  const parsedExchangeRate = Number(normalizeNumericInput(form.exchange_rate));
  const isIncome = entryType === "income";
  const selectedCurrency = isIncome ? incomeCurrency : expenseCurrency;
  const isThb = selectedCurrency === "thb";
  const isIdr = selectedCurrency === "idr";
  const parsedSelectedAmount = isIdr ? parsedAmountIdr : parsedAmountThb;
  const submitDisabled = parsedSelectedAmount <= 0;
  const typeOptions = [
    { value: "income", label: "Uang Masuk" },
    { value: "expense", label: "Uang Keluar" },
  ];
  const currencyOptions = [
    { value: "idr", label: "IDR" },
    { value: "thb", label: "THB" },
  ];

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
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

    const payload = {
      type: isIncome ? (isThb ? "exchange" : "income") : "expense",
      occurred_at: new Date(form.occurred_at).toISOString(),
      description: form.description.trim(),
      category_group: !isIncome && isThb ? UNIVERSAL_BUDGET_GROUP : null,
      category: !isIncome ? form.category : null,
      amount_idr: isIdr ? normalizeNumericInput(form.amount_idr) : null,
      amount_thb: isThb ? normalizeNumericInput(form.amount_thb) : null,
      exchange_rate: isIncome && isThb ? normalizeNumericInput(form.exchange_rate) : null,
      exchange_source: isIncome && isThb ? form.exchange_source : null,
      expense_currency: !isIncome ? selectedCurrency : null,
    };

    const succeeded = await onSubmit(payload);
    if (succeeded) {
      setForm({
        occurred_at: toInputDateTime(),
        description: "",
        category: DEFAULT_CATEGORY,
        amount_idr: "",
        amount_thb: "",
        exchange_rate: "",
        exchange_source: "purchase",
      });
    }
  }

  const typeButtonClass = (value) =>
    value === entryType
      ? "bg-brand-600 text-white shadow-[0_16px_40px_rgba(16,185,129,0.22)] dark:bg-emerald-500 dark:text-white"
      : "text-slate-700 hover:bg-white/70 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-white";
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

      <div className="cuan-segment relative mt-5 grid grid-cols-2 gap-2 rounded-2xl p-1">
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

      <div className="relative mt-4">
        <span className="mb-2 block text-sm font-medium">Mata uang</span>
        <div className="cuan-segment grid grid-cols-2 gap-2 rounded-2xl p-1">
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
            placeholder=${isIncome
              ? isThb
                ? "Bonus THB / pemberian / beli THB"
                : "Gaji bulanan"
              : isThb
                ? "Makan siang"
                : "Belanja bulanan"}
            value=${form.description}
            onChange=${(event) => updateField("description", event.target.value)}
            className=${GLASS_INPUT}
          />
        </label>

        ${isIncome && isThb
          ? html`
              <label className="block">
                <span className="mb-2 block text-sm font-medium">Sumber THB Masuk</span>
                <select
                  value=${form.exchange_source}
                  onChange=${(event) => updateField("exchange_source", event.target.value)}
                  className=${GLASS_INPUT}
                >
                  <option value="purchase">Tukar / Beli THB</option>
                  <option value="bonus">THB masuk non-cashflow</option>
                </select>
              </label>
            `
          : null}

        ${!isIncome
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

        ${isIdr
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

        ${isThb
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

        ${isIncome && isThb
          ? html`
              <label className="block">
                <span className="mb-2 block text-sm font-medium">Rate (IDR / 1 THB)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  required=${form.exchange_source === "purchase"}
                  value=${form.exchange_rate}
                  onChange=${(event) =>
                    updateField("exchange_rate", formatNumericInput(event.target.value))}
                  placeholder=${form.exchange_source === "purchase" ? "539" : "Opsional"}
                  className=${GLASS_INPUT}
                />
              </label>
            `
          : null}

        ${isIncome && isThb && parsedAmountThb > 0
          ? html`
              <div className="rounded-2xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-900 backdrop-blur-xl dark:border-emerald-300/20 dark:bg-emerald-400/10 dark:text-emerald-200">
                ${form.exchange_source === "purchase"
                  ? html`
                      <p className="font-semibold">
                        Potong saldo utama otomatis: ${formatCurrency(
                          parsedAmountThb * parsedExchangeRate,
                          "idr",
                        )}
                      </p>
                      <p className="mt-1">
                        Rate dipakai: ${formatRate(parsedExchangeRate)}
                      </p>
                    `
                  : html`
                      <p className="font-semibold">
                        THB masuk tanpa potong saldo utama IDR.
                      </p>
                      <p className="mt-1">
                        ${parsedExchangeRate > 0
                          ? `Rate patokan disimpan: ${formatRate(parsedExchangeRate)}`
                          : activeExchange
                            ? `Rate patokan mengikuti rate aktif: ${formatRate(activeExchange.locked_rate)}`
                            : "Rate patokan belum ada. Isi rate jika ingin valuasi IDR lebih akurat."}
                      </p>
                    `}
              </div>
            `
          : null}

        ${!isIncome && isThb
          ? html`
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm backdrop-blur-xl dark:bg-slate-900/40">
                ${activeExchange
                  ? html`
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        Rate aktif: ${formatRate(activeExchange.locked_rate)}
                      </p>
                      <p className="mt-1 text-slate-600 dark:text-slate-300/80">
                        Pengeluaran ini otomatis dihitung ke IDR dari transfer THB ber-rate pada ${formatDateTime(activeExchange.occurred_at)}.
                      </p>
                    `
                  : html`
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        Belum ada rate aktif
                      </p>
                      <p className="mt-1 text-slate-600 dark:text-slate-300/80">
                        Tambahkan transfer THB ber-rate dulu kalau kamu ingin valuasi otomatis ke IDR.
                      </p>
                    `}
              </div>
            `
          : null}

        ${!isIncome && isIdr
          ? html`
              <div className="rounded-2xl border border-sky-300/30 bg-sky-400/10 px-4 py-3 text-sm text-sky-900 backdrop-blur-xl dark:border-sky-300/20 dark:bg-sky-500/10 dark:text-sky-200">
                Belanja IDR akan langsung mengurangi saldo utama dan tidak masuk ke overspending guard THB.
              </div>
            `
          : null}

        <${SubmitActionBar}
          label=${isIncome && isThb
            ? "Simpan transfer THB"
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

function BudgetForm({ onSubmit, loading, currentMonthKey }) {
  const [monthKey, setMonthKey] = useState(currentMonthKey);
  const [limitThb, setLimitThb] = useState("");

  useEffect(() => {
    setMonthKey(currentMonthKey);
  }, [currentMonthKey]);

  async function handleSubmit(event) {
    event.preventDefault();
    const ok = await onSubmit({
      month_key: monthKey,
      group_key: UNIVERSAL_BUDGET_GROUP,
      limit_thb: normalizeNumericInput(limitThb),
    });
    if (ok) {
      setLimitThb("");
    }
  }

  return html`
    <div className=${`${PREMIUM_PANEL} p-5 md:p-6`}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),transparent_50%)] opacity-80"></div>
      <div className="relative">
        <h3 className="font-display text-xl font-bold">Budget Uang Keluar Bulanan</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300/80">
          Satu limit universal untuk seluruh uang keluar bulanan.
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
          <span className="mb-2 block text-sm font-medium">Limit Uang Keluar (THB)</span>
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            required
            value=${limitThb}
            onChange=${(event) =>
              setLimitThb(formatNumericInput(event.target.value))}
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

function GoalForm({ onSubmit, loading }) {
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

        <button
          type="submit"
          disabled=${loading}
          className="w-full rounded-2xl border border-white/10 bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-brand-700"
        >
          Simpan target
        </button>
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
  const [menuOpen, setMenuOpen] = useState(false);

  const supabaseReady = Boolean(supabase);
  const metrics = useMemo(
    () => computeMetrics(transactions, budgets, goals),
    [transactions, budgets, goals],
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
        return;
      }

      setLoading(true);
      const [transactionResult, budgetResult, goalResult] = await Promise.all([
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
              ? "Tabel budget belum ada. Jalankan schema.sql terbaru agar fitur overspending aktif."
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
  let balance = 0;

  transactions.forEach((item) => {
    if (item.type === "income" || item.type === "exchange") {
      balance += Number(item.amount_thb || 0);
    }

    if (item.type === "expense") {
      balance -= Number(item.amount_thb || 0);
    }
  });

  return balance;
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
        created_at: new Date().toISOString(),
      };

      if (payload.type === "income") {
        const amountIdr = Number(payload.amount_idr);
        if (!amountIdr || amountIdr <= 0) {
          throw new Error("Jumlah pemasukan IDR harus lebih besar dari 0.");
        }
        record.amount_idr = amountIdr;
        record.category = null;
        record.category_group = null;
      }

      if (payload.type === "exchange") {
        const amountThb = Number(payload.amount_thb);
        const exchangeRate = Number(payload.exchange_rate);
        const exchangeSource =
          payload.exchange_source === "bonus" ? "bonus" : "purchase";
        const fallbackRate = Number(
          getLockedExchange(transactions, payload.occurred_at)?.locked_rate || 0,
        );
        const resolvedRate =
          exchangeRate > 0 ? exchangeRate : fallbackRate > 0 ? fallbackRate : null;
        if (!amountThb || amountThb <= 0) {
          throw new Error("Masukkan nominal THB diterima yang valid.");
        }
        if (exchangeSource === "purchase" && (!exchangeRate || exchangeRate <= 0)) {
          throw new Error("Masukkan rate yang valid untuk beli/tukar THB.");
        }
        record.amount_idr =
          exchangeSource === "purchase" ? amountThb * exchangeRate : 0;
        record.amount_thb = amountThb;
        record.locked_rate = resolvedRate;
        record.category = null;
        record.category_group = null;
      }

      if (payload.type === "expense") {
        const expenseCurrency =
          payload.expense_currency === "idr" ? "idr" : "thb";

        if (expenseCurrency === "idr") {
          const amountIdr = Number(payload.amount_idr);
          if (!amountIdr || amountIdr <= 0) {
            throw new Error("Jumlah belanja IDR harus lebih besar dari 0.");
          }
          if (metrics.balanceIdr < amountIdr) {
            throw new Error("Saldo utama IDR tidak mencukupi.");
          }

          record.amount_idr = amountIdr;
          record.amount_thb = null;
          record.locked_rate = null;
          record.category = payload.category;
          record.category_group = null;
        } else {
          const amountThb = Number(payload.amount_thb);

          if (!amountThb || amountThb <= 0) {
            throw new Error("Jumlah pengeluaran THB harus lebih besar dari 0.");
          }

          const currentBalance = calculateTHBBalance(transactions);

          if (currentBalance < amountThb) {
            throw new Error("Saldo THB tidak mencukupi.");
          }

          const activeExchange = getLockedExchange(transactions, payload.occurred_at);

          record.amount_thb = amountThb;

          if (activeExchange) {
            record.locked_rate = activeExchange.locked_rate;
            record.amount_idr = amountThb * activeExchange.locked_rate;
          } else {
            record.locked_rate = null;
            record.amount_idr = null;
          }

          record.category = payload.category;
          record.category_group = payload.category_group;
        }
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
      const amountIdr = Number(normalizeNumericInput(payload.amount_idr));
      const amountThb = Number(normalizeNumericInput(payload.amount_thb));
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
      };

      if (!description) {
        throw new Error("Deskripsi transaksi wajib diisi.");
      }

      if (nextType === "income") {
        if (!amountIdr || amountIdr <= 0) {
          throw new Error("Jumlah pemasukan IDR harus lebih besar dari 0.");
        }
        record.amount_idr = amountIdr;
      }

      if (nextType === "exchange") {
        if (!amountIdr || amountIdr <= 0) {
          throw new Error("Jumlah IDR exchange harus lebih besar dari 0.");
        }
        if (!amountThb || amountThb <= 0) {
          throw new Error("Nominal THB exchange harus lebih besar dari 0.");
        }
        if (!lockedRate || lockedRate <= 0) {
          throw new Error("Rate exchange wajib diisi.");
        }
        const previousThb = Number(transaction.amount_thb || 0);
        const isSellExchange = previousThb < 0;

        record.amount_idr = amountIdr;
        record.amount_thb = isSellExchange ? -amountThb : amountThb;
        record.locked_rate = lockedRate;
      }

      if (nextType === "expense") {
        const expenseCurrency =
          payload.expense_currency === "idr" ? "idr" : "thb";
        record.category = payload.category || DEFAULT_CATEGORY;
        record.category_group =
          expenseCurrency === "thb" ? UNIVERSAL_BUDGET_GROUP : null;

        if (expenseCurrency === "idr") {
          if (!amountIdr || amountIdr <= 0) {
            throw new Error("Jumlah pengeluaran IDR harus lebih besar dari 0.");
          }
          record.amount_idr = amountIdr;
          record.amount_thb = null;
          record.locked_rate = null;
        } else {
          if (!amountThb || amountThb <= 0) {
            throw new Error("Jumlah pengeluaran THB harus lebih besar dari 0.");
          }
          if (!lockedRate || lockedRate <= 0) {
            throw new Error("Rate pengeluaran THB wajib diisi.");
          }

          record.amount_thb = amountThb;
          record.locked_rate = lockedRate;
          record.amount_idr = amountThb * lockedRate;
        }
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

      const limitThb = Number(payload.limit_thb);
      const groupKey = UNIVERSAL_BUDGET_GROUP;
      if (!limitThb || limitThb <= 0) {
        throw new Error("Limit budget THB harus lebih besar dari 0.");
      }

      const existing = budgets.find(
        (item) =>
          item.month_key === payload.month_key && item.group_key === groupKey,
      );

      const record = {
        id: existing?.id || crypto.randomUUID(),
        user_id: user.id,
        month_key: payload.month_key,
        group_key: groupKey,
        limit_thb: limitThb,
        created_at: existing?.created_at || new Date().toISOString(),
      };

      if (mode === "demo") {
        const next = [
          ...budgets.filter(
            (item) =>
              !(
                item.month_key === payload.month_key &&
                item.group_key === groupKey
              ),
          ),
          record,
        ];
        await persistDemoBudgets(next);
      } else {
        const { data, error } = await supabase
          .from("budgets")
          .upsert(record, {
            onConflict: "user_id,month_key,group_key",
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
      `Hapus budget uang keluar untuk ${formatMonthKey(budget.month_key)}?`,
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

  if (!user) {
    return html`
      <${AuthScreen}
        onGoogleLogin=${handleGoogleLogin}
        onDemoLogin=${handleDemoLogin}
        supabaseReady=${supabaseReady}
      />
    `;
  }

  const activeBudgetInsight = metrics.budgetInsights[0] || null;
  const todayKey = getLocalDayKey(new Date());
  const todayExpenses = orderTransactions(transactions)
    .filter(
      (item) =>
        item.type === "expense" &&
        Number(item.amount_thb || 0) > 0 &&
        getLocalDayKey(item.occurred_at) === todayKey,
    )
    .reverse();
  const todaySpentThb = todayExpenses.reduce(
    (sum, item) => sum + Number(item.amount_thb || 0),
    0,
  );
  const todaySpentIdr = todayExpenses.reduce(
    (sum, item) => sum + Number(item.amount_idr || 0),
    0,
  );
  const nextDayBudgetText = !activeBudgetInsight
    ? ""
    : activeBudgetInsight.remainingDaysAfterToday > 0
      ? `Jatah besok ${formatCurrency(activeBudgetInsight.projectedNextDailyLimitThb, "thb")}.`
      : "Hari terakhir bulan ini.";
  const overspendingValue = !activeBudgetInsight
    ? "Belum ada"
    : activeBudgetInsight.remainingThb < 0
      ? "Over Bulanan"
      : activeBudgetInsight.todayRemainingSafeThb < 0
        ? "Over Harian"
        : activeBudgetInsight.status === "warning"
          ? "Waspada"
          : "Aman";
  const overspendingHelper = !activeBudgetInsight
    ? "Buat budget bulanan agar guard overspending aktif."
    : activeBudgetInsight.todayRemainingSafeThb < 0
      ? `Hari ini lewat ${formatCurrency(Math.abs(activeBudgetInsight.todayRemainingSafeThb), "thb")} dari batas aman. ${nextDayBudgetText}`
      : `Batas aman hari ini ${formatCurrency(activeBudgetInsight.dynamicDailyLimitThb, "thb")}. ${nextDayBudgetText}`;
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
    { key: "investment", label: "Investasi" },
    { key: "settings", label: "Profil" },
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
              <${BalancePrivacyPill}
                balanceIdr=${metrics.balanceIdr}
                balanceThb=${metrics.balanceThb}
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
                  todaySpentThb=${todaySpentThb}
                  todaySpentIdr=${todaySpentIdr}
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
                            onThemeChange=${(value) => setTheme(value)}
                            onUploadPhoto=${handleProfilePhotoUpload}
                            onRemovePhoto=${handleRemoveProfilePhoto}
                            onSignOut=${handleSignOut}
                          />
                        </section>
                      `
                  : html`
                      <section className="mt-6 grid gap-6">
                        <${GoalForm} onSubmit=${handleCreateGoal} loading=${loading} />
                        <${GoalTracker}
                          goals=${metrics.goalInsights}
                          onDelete=${handleDeleteGoal}
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
