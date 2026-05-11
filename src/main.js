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
};

const LEGACY_STORAGE_KEYS = {
  theme: "kas-poipet-theme",
  demoAuth: "kas-poipet-demo-auth",
  demoTransactions: "kas-poipet-demo-transactions",
  demoBudgets: "kas-poipet-demo-budgets",
  demoGoals: "kas-poipet-demo-goals",
  profilePhotos: "kas-poipet-profile-photos",
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

const DEFAULT_CATEGORY = "Makan";
const UNIVERSAL_BUDGET_GROUP = "needs";

const TYPE_META = {
  income: {
    label: "Pemasukan",
    chip:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  exchange: {
    label: "Pemasukan THB",
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

function normalizeTransaction(row) {
  return {
    ...row,
    amount_idr: row.amount_idr == null ? null : Number(row.amount_idr),
    amount_thb: row.amount_thb == null ? null : Number(row.amount_thb),
    locked_rate: row.locked_rate == null ? null : Number(row.locked_rate),
  };
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
  const exchangedIdr = ordered
    .filter((item) => item.type === "exchange")
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
  const balanceIdrBase = incomeIdr - exchangedIdr - directSpentIdr;
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
    .filter((item) => item.type === "income" || item.type === "exchange")
    .reduce((sum, item) => sum + resolveIdrValue(item), 0);
  const monthlyExpenseIdr = currentMonthTransactions
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + resolveIdrValue(item), 0);
  const monthlyExternalIncomeIdr = currentMonthTransactions
    .filter(
      (item) =>
        item.type === "income" ||
        (item.type === "exchange" && Number(item.amount_idr || 0) <= 0),
    )
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
];

const HISTORY_CURRENCY_OPTIONS = [
  { value: "all", label: "Semua mata uang" },
  { value: "idr", label: "IDR" },
  { value: "thb", label: "THB" },
];

function getTransactionPreview(transaction) {
  if (transaction.type === "income") {
    return formatCurrency(transaction.amount_idr, "idr");
  }
  if (transaction.type === "exchange") {
    if (Number(transaction.amount_idr || 0) > 0) {
      return `${formatCurrency(transaction.amount_idr, "idr")} -> ${formatCurrency(transaction.amount_thb, "thb")}`;
    }
    return `+ ${formatCurrency(transaction.amount_thb, "thb")}`;
  }
  if (Number(transaction.amount_thb || 0) <= 0) {
    return formatCurrency(transaction.amount_idr, "idr");
  }
  return `${formatCurrency(transaction.amount_thb, "thb")} (${formatCurrency(transaction.amount_idr, "idr")})`;
}

function getTransactionFlow(transaction) {
  return transaction.type === "expense" ? "expense" : "income";
}

function getTransactionTypeLabel(transaction) {
  return getTransactionFlow(transaction) === "income"
    ? "Uang masuk"
    : "Uang keluar";
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

function getTransactionComparableAmount(transaction) {
  return getTransactionIdrValuation(transaction) ?? getTransactionMainAmount(transaction);
}

function getTransactionCategoryKey(transaction) {
  if (transaction.category) return transaction.category;
  if (transaction.type === "expense") return "Lainnya";
  return transaction.type === "exchange" ? "exchange" : "income";
}

function getTransactionCategoryLabel(transaction) {
  if (transaction.category) return getCategoryMeta(transaction.category).label;
  if (transaction.type === "exchange") return "Pemasukan THB";
  if (transaction.type === "income") return "Pemasukan IDR";
  return "Lainnya";
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
    { value: "exchange", label: "Pemasukan THB" },
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
      const currency = getTransactionCurrency(transaction);
      const categoryKey = getTransactionCategoryKey(transaction);
      const comparableAmount = getTransactionComparableAmount(transaction);
      const filterAmount =
        filters.currency === "all"
          ? comparableAmount
          : getTransactionMainAmount(transaction);
      const description = String(transaction.description || "").toLowerCase();

      if (filters.startDate && dayKey < filters.startDate) return false;
      if (filters.endDate && dayKey > filters.endDate) return false;
      if (filters.type !== "all" && flow !== filters.type) return false;
      if (filters.category !== "all" && categoryKey !== filters.category) return false;
      if (filters.currency !== "all" && currency !== filters.currency) return false;
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

function computeTransactionSummary(transactions) {
  return transactions.reduce(
    (summary, transaction) => {
      const valuation = getTransactionIdrValuation(transaction) ?? 0;
      if (getTransactionFlow(transaction) === "income") {
        summary.totalIncomeIdr += valuation;
      } else {
        summary.totalExpenseIdr += valuation;
      }
      summary.count += 1;
      summary.netIdr = summary.totalIncomeIdr - summary.totalExpenseIdr;
      return summary;
    },
    {
      totalIncomeIdr: 0,
      totalExpenseIdr: 0,
      netIdr: 0,
      count: 0,
    },
  );
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
          Pemasukan THB ber-rate menjadi fondasi valuasi IDR untuk semua uang keluar harian.
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
                Belum ada pemasukan THB ber-rate. Tambahkan rate pada pemasukan THB agar valuasi pengeluaran THB terhadap IDR bisa terkunci.
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
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
            </div>
          </div>
        `,
      )}
    </div>
  `;
}

function TransactionFilter({ filters, onChange, onReset, categoryOptions }) {
  function updateFilter(field, value) {
    onChange((current) => ({ ...current, [field]: value }));
  }

  return html`
    <section className=${`${PREMIUM_PANEL_SOFT} p-4 md:p-5`}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),transparent_50%)] opacity-80"></div>
      <div className="relative grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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

function TransactionCard({ transaction, onDelete }) {
  const flow = getTransactionFlow(transaction);
  const currency = getTransactionCurrency(transaction);
  const mainAmount = getTransactionMainAmount(transaction);
  const valuationIdr = getTransactionIdrValuation(transaction);
  const categoryLabel = getTransactionCategoryLabel(transaction);
  const categoryMeta = getCategoryMeta(transaction.category);
  const typeChip =
    flow === "income"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
      : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";
  const amountTone =
    flow === "income"
      ? "text-emerald-700 dark:text-emerald-300"
      : "text-rose-700 dark:text-rose-300";
  const signedPrefix = flow === "income" ? "+" : "-";
  const description =
    transaction.description || TYPE_META[transaction.type]?.label || "Transaksi";
  const showThbValuation = currency === "thb";

  return html`
    <article className=${`${PREMIUM_ITEM} p-4 md:p-5`}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.16),transparent_45%,rgba(255,255,255,0.04))] opacity-0 transition duration-500 group-hover:opacity-100"></div>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent opacity-0 transition duration-500 group-hover:opacity-100"></div>

      <div className="relative grid min-w-0 gap-4 lg:grid-cols-[1.05fr_0.8fr_0.9fr_1.2fr_1fr_auto] lg:items-center">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Tanggal & waktu
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
            ${formatDateTime(transaction.occurred_at)}
          </p>
        </div>

        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Tipe
          </p>
          <span className=${`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${typeChip}`}>
            ${getTransactionTypeLabel(transaction)}
          </span>
        </div>

        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Kategori
          </p>
          <span className=${`mt-2 inline-flex max-w-full rounded-full px-2.5 py-1 text-xs font-semibold ${transaction.category ? categoryMeta.chip : "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300"}`}>
            <span className="truncate">${categoryLabel}</span>
          </span>
        </div>

        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Deskripsi
          </p>
          <p className="mt-1 break-words text-sm font-semibold text-slate-900 dark:text-slate-100">
            ${description}
          </p>
          ${transaction.locked_rate
            ? html`
                <p className="mt-1 text-xs font-medium text-brand-700 dark:text-brand-300">
                  Rate terkunci: ${formatRate(transaction.locked_rate)}
                </p>
              `
            : null}
        </div>

        <div className="min-w-0 lg:text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Jumlah
          </p>
          <p className=${`mt-1 break-words text-lg font-black ${amountTone}`}>
            ${signedPrefix}${formatCurrency(mainAmount, currency)}
          </p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            ${currency.toUpperCase()}
          </p>
          ${showThbValuation
            ? html`
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-300/80">
                  Valuasi IDR:
                  ${valuationIdr ? formatCurrency(valuationIdr, "idr") : "Belum tersedia"}
                </p>
              `
            : null}
        </div>

        <div className="flex lg:justify-end">
          <button
            type="button"
            onClick=${() => onDelete(transaction)}
            className="min-h-11 rounded-2xl border border-rose-300/25 bg-rose-400/10 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:-translate-y-0.5 hover:bg-rose-400/15 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200"
          >
            Hapus
          </button>
        </div>
      </div>
    </article>
  `;
}

function TransactionList({
  transactions,
  onDelete,
  title = "Aktivitas Terakhir",
  description = "Semua perubahan angka langsung menggerakkan chart, kategori, dan budget.",
  emptyMessage = "Belum ada transaksi.",
}) {
  const [filters, setFilters] = useState(DEFAULT_TRANSACTION_FILTERS);
  const categoryOptions = useMemo(
    () => getHistoryCategoryOptions(transactions),
    [transactions],
  );
  const filteredTransactions = useMemo(
    () => filterAndSortTransactions(transactions, filters),
    [transactions, filters],
  );
  const summary = useMemo(
    () => computeTransactionSummary(filteredTransactions),
    [filteredTransactions],
  );
  const hasFilters = hasActiveTransactionFilters(filters);

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

      <${TransactionFilter}
        filters=${filters}
        onChange=${setFilters}
        onReset=${resetFilters}
        categoryOptions=${categoryOptions}
      />

      <section className=${`${PREMIUM_PANEL} p-4 md:p-5`}>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),transparent_50%)] opacity-80"></div>
        ${filteredTransactions.length
          ? html`
              <div className="relative space-y-3">
                ${filteredTransactions.map(
                  (transaction) => html`
                    <${TransactionCard}
                      key=${transaction.id}
                      transaction=${transaction}
                      onDelete=${onDelete}
                    />
                  `,
                )}
              </div>
            `
          : html`
              <div className="relative rounded-[24px] border border-dashed border-white/15 bg-white/5 p-6 text-center backdrop-blur-xl dark:bg-slate-900/25 md:p-8">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-brand-500/10 text-xl font-black text-brand-700 dark:text-brand-300">
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
              ${budget ? `Batas ${todayLimit}` : "Atur budget lewat menu Budget"}
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
                  <option value="bonus">Pemasukan THB</option>
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
                  ${isIncome ? "Jumlah uang masuk (THB)" : "Jumlah uang keluar (THB)"}
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
                        Pengeluaran ini otomatis dihitung ke IDR dari pemasukan THB ber-rate pada ${formatDateTime(activeExchange.occurred_at)}.
                      </p>
                    `
                  : html`
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        Belum ada rate aktif
                      </p>
                      <p className="mt-1 text-slate-600 dark:text-slate-300/80">
                        Tambahkan pemasukan THB ber-rate dulu kalau kamu ingin valuasi otomatis ke IDR.
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
          label=${isIncome ? "Simpan uang masuk" : "Simpan uang keluar"}
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
          className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 dark:bg-white dark:text-slate-950"
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
    { key: "budget", label: "Budget" },
    { key: "add", label: "Tambah", featured: true },
    { key: "history", label: "Riwayat" },
  ];

  return html`
    <nav
      className="fixed inset-x-3 z-40 md:hidden"
      style=${{ bottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
    >
      <div
        className=${`grid grid-cols-4 items-end gap-1 rounded-[26px] p-1.5 transition duration-300 ease-out ${navSurface}`}
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
              className=${`flex min-h-[3.25rem] min-w-0 flex-col items-center justify-center rounded-[20px] px-1 text-[11px] font-bold transition duration-300 ease-out ${featuredClass}`}
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
        setTransactions(orderTransactions(readAppStorage("demoTransactions", [])));
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
          orderTransactions((transactionResult.data || []).map(normalizeTransaction)),
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
    setUser(DEMO_USER);
    setMode("demo");
    setTransactions(orderTransactions(readAppStorage("demoTransactions", [])));
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
    const ordered = orderTransactions(nextTransactions);
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
          throw new Error("Masukkan nominal THB masuk yang valid.");
        }
        if (exchangeSource === "purchase" && (!exchangeRate || exchangeRate <= 0)) {
          throw new Error("Masukkan rate yang valid untuk pemasukan THB dari beli/tukar.");
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

  async function handleDeleteTransaction(transaction) {
    const confirmation = window.confirm(
      `Hapus transaksi "${transaction.description || TYPE_META[transaction.type].label}"?`,
    );
    if (!confirmation) return;

    try {
      setLoading(true);
      setMessage("");

      if (mode === "demo") {
        await persistDemoTransactions(
          transactions.filter((item) => item.id !== transaction.id),
        );
      } else {
        const { error } = await supabase
          .from("transactions")
          .delete()
          .eq("id", transaction.id)
          .eq("user_id", user.id);
        if (error) throw error;
        setTransactions((current) =>
          current.filter((item) => item.id !== transaction.id),
        );
      }

      setMessage("Transaksi dihapus.");
      setMessageTone("info");
    } catch (error) {
      setMessage(error.message || "Gagal menghapus transaksi.");
      setMessageTone("error");
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
    { key: "budget", label: "Budget" },
    { key: "add", label: "Tambah" },
    { key: "history", label: "Riwayat" },
    { key: "overview", label: "Overview" },
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
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-brand-300/30 bg-brand-600 px-3 py-2 text-[11px] font-semibold uppercase text-white shadow-[0_12px_30px_rgba(16,185,129,0.22)] sm:flex-none sm:rounded-full sm:text-xs">
                <span className="text-white/75">IDR</span>
                <span className="break-all">${formatCurrency(metrics.balanceIdr, "idr")}</span>
                <span className="text-white/45">|</span>
                <span className="text-white/75">THB</span>
                <span className="break-all">${formatCurrency(metrics.balanceThb, "thb")}</span>
              </div>

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
                        title="Riwayat Transaksi"
                        description="Semua pemasukan, pengeluaran, dan pergerakan saldo ada di sini."
                        emptyMessage="Belum ada transaksi."
                      />
                    </section>
                  `
                : activeTab === "overview"
                  ? html`
                      <section className="mt-6">
                        <${OverviewPage}
                          metrics=${metrics}
                          transactions=${transactions}
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
