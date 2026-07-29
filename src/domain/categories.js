export const CATEGORY_OPTIONS = [
  {
    value: "Makan",
    label: "Makan Harian",
    description: "Makanan, minuman, bahan makanan, dan makan di luar.",
    groupKey: "needs",
    chip:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    bar: "from-emerald-400 to-emerald-500",
  },
  {
    value: "Belanja",
    label: "Belanja Kebutuhan",
    description: "Kebutuhan rumah tangga dan kebutuhan harian nonmakanan.",
    groupKey: "needs",
    chip: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
    bar: "from-sky-300 to-indigo-500",
  },
  {
    value: "Transportasi",
    label: "Transportasi",
    description:
      "BBM, kendaraan, transportasi umum, ojek online, parkir, dan tol.",
    groupKey: "needs",
    chip:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    bar: "from-amber-300 to-orange-500",
  },
  {
    value: "Tagihan",
    label: "Tagihan",
    description:
      "Listrik, air, internet, Wi-Fi, pulsa, paket data, dan langganan rutin.",
    groupKey: "needs",
    chip:
      "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
    bar: "from-violet-300 to-fuchsia-500",
  },
  {
    value: "Kesehatan",
    label: "Kesehatan",
    description: "Dokter, obat, pemeriksaan, dan kebutuhan kesehatan.",
    groupKey: "needs",
    chip: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    bar: "from-rose-300 to-pink-500",
  },
  {
    value: "Tempat Tinggal",
    label: "Tempat Tinggal",
    description: "Sewa, kontrakan, KPR, kos, dan perawatan tempat tinggal.",
    groupKey: "needs",
    chip: "bg-lime-100 text-lime-700 dark:bg-lime-500/15 dark:text-lime-300",
    bar: "from-lime-300 to-emerald-500",
  },
  {
    value: "Hiburan & Gaya Hidup",
    label: "Hiburan & Gaya Hidup",
    description:
      "Hiburan, hobi, rekreasi, perawatan pribadi, dan aktivitas gaya hidup.",
    groupKey: "wants",
    chip: "bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300",
    bar: "from-pink-400 to-fuchsia-500",
  },
  {
    value: "Lainnya",
    label: "Lainnya",
    description: "Pengeluaran yang tidak sesuai dengan kategori lain.",
    groupKey: "needs",
    chip:
      "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
    bar: "from-slate-400 to-slate-700",
  },
];

export const DEFAULT_CATEGORY = "Makan";
export const UNIVERSAL_BUDGET_GROUP = "needs";

function getLookupKey(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("id-ID")
    .replace(/\s*&\s*/g, " dan ")
    .replace(/[\/_-]+/g, " ")
    .replace(/\s+/g, " ");
}

const CATEGORY_ALIAS_LOOKUP = new Map();

function registerAliases(value, aliases) {
  [value, ...aliases].forEach((alias) => {
    CATEGORY_ALIAS_LOOKUP.set(getLookupKey(alias), value);
  });
}

registerAliases("Makan", ["Makan Harian", "Makanan"]);
registerAliases("Belanja", ["Belanja Kebutuhan", "Kebutuhan Harian"]);
registerAliases("Transportasi", ["Transport"]);
registerAliases("Tagihan", [
  "Internet",
  "Internet & Pulsa",
  "Internet dan Pulsa",
  "Pulsa",
  "Paket Data",
  "Wi-Fi",
  "Wifi",
]);
registerAliases("Kesehatan", []);
registerAliases("Tempat Tinggal", [
  "Hunian",
  "Sewa Tempat",
  "Sewa Tempat / Hunian",
  "Sewa Tempat & Hunian",
]);
registerAliases("Hiburan & Gaya Hidup", [
  "Hiburan",
  "Gaya Hidup",
  "Ngopi",
  "Hadiah",
  "Travel",
  "Rekreasi",
  "Hobi",
  "Perawatan Pribadi",
]);
registerAliases("Lainnya", ["Lain-lain", "Other", "needs", "wants", "invest"]);

const CATEGORY_LOOKUP = Object.fromEntries(
  CATEGORY_OPTIONS.map((item) => [item.value, item]),
);

export function normalizeExpenseCategory(
  category,
  fallback = DEFAULT_CATEGORY,
) {
  const normalizedFallback =
    CATEGORY_ALIAS_LOOKUP.get(getLookupKey(fallback)) || DEFAULT_CATEGORY;
  const raw = String(category || "").trim();
  if (!raw) return normalizedFallback;
  return CATEGORY_ALIAS_LOOKUP.get(getLookupKey(raw)) || "Lainnya";
}

export function getExpenseCategoryMeta(category) {
  return (
    CATEGORY_LOOKUP[normalizeExpenseCategory(category, "Lainnya")] ||
    CATEGORY_LOOKUP.Lainnya
  );
}

export function getExpenseCategoryKey(category) {
  return normalizeExpenseCategory(category, "Lainnya").toLocaleLowerCase(
    "id-ID",
  );
}

export function getExpenseCategoryLabel(category) {
  return getExpenseCategoryMeta(category).label;
}

export function getDefaultCategoryGroup(category) {
  return getExpenseCategoryMeta(category).groupKey;
}

export function isFinalExpenseCategory(category) {
  const rawKey = getLookupKey(category);
  const normalized = CATEGORY_ALIAS_LOOKUP.get(rawKey);
  return Boolean(
    normalized &&
      getLookupKey(normalized) === rawKey &&
      CATEGORY_LOOKUP[normalized],
  );
}
