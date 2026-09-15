export const DEFAULT_BASE_CURRENCY = "IDR";

export const CURRENCY_REGION_META = {
  asia: { label: "Asia", order: 0 },
  middleEast: { label: "Timur Tengah", order: 1 },
  global: { label: "Global", order: 2 },
};

export const CURRENCY_REGISTRY = [
  {
    code: "IDR",
    name: "Rupiah Indonesia",
    region: "asia",
    locale: "id-ID",
    fractionDigits: 0,
    searchTerms: ["indonesia", "rupiah", "rupiah indonesia"],
  },
  {
    code: "THB",
    name: "Baht Thailand",
    region: "asia",
    locale: "th-TH",
    fractionDigits: 2,
    searchTerms: ["thailand", "baht", "baht thailand"],
  },
  {
    code: "SGD",
    name: "Dolar Singapura",
    region: "asia",
    locale: "en-SG",
    fractionDigits: 2,
    searchTerms: ["singapura", "singapore", "dolar singapura"],
  },
  {
    code: "MYR",
    name: "Ringgit Malaysia",
    region: "asia",
    locale: "ms-MY",
    fractionDigits: 2,
    searchTerms: ["malaysia", "ringgit", "ringgit malaysia"],
  },
  {
    code: "JPY",
    name: "Yen Jepang",
    region: "asia",
    locale: "ja-JP",
    fractionDigits: 0,
    searchTerms: ["jepang", "japan", "yen", "yen jepang"],
  },
  {
    code: "KRW",
    name: "Won Korea Selatan",
    region: "asia",
    locale: "ko-KR",
    fractionDigits: 0,
    searchTerms: ["korea", "korea selatan", "south korea", "won"],
  },
  {
    code: "TWD",
    name: "Dolar Taiwan",
    region: "asia",
    locale: "zh-TW",
    fractionDigits: 2,
    currencyDisplay: "symbol",
    searchTerms: ["taiwan", "dolar taiwan", "new taiwan dollar", "nt dollar"],
  },
  {
    code: "HKD",
    name: "Dolar Hong Kong",
    region: "asia",
    locale: "zh-HK",
    fractionDigits: 2,
    currencyDisplay: "symbol",
    searchTerms: ["hong kong", "dolar hong kong", "hong kong dollar"],
  },
  {
    code: "CNY",
    name: "Yuan Tiongkok",
    region: "asia",
    locale: "zh-CN",
    fractionDigits: 2,
    searchTerms: ["tiongkok", "china", "yuan", "renminbi", "yuan tiongkok"],
  },
  {
    code: "VND",
    name: "Dong Vietnam",
    region: "asia",
    locale: "vi-VN",
    fractionDigits: 0,
    searchTerms: ["vietnam", "dong", "dong vietnam"],
  },
  {
    code: "PHP",
    name: "Peso Filipina",
    region: "asia",
    locale: "en-PH",
    fractionDigits: 2,
    searchTerms: ["filipina", "philippines", "peso", "peso filipina"],
  },
  {
    code: "INR",
    name: "Rupee India",
    region: "asia",
    locale: "en-IN",
    fractionDigits: 2,
    searchTerms: ["india", "rupee", "rupee india", "indian rupee"],
  },
  {
    code: "LKR",
    name: "Rupee Sri Lanka",
    region: "asia",
    locale: "en-LK",
    fractionDigits: 2,
    currencyDisplay: "code",
    searchTerms: ["sri lanka", "rupee", "rupee sri lanka"],
  },
  {
    code: "SAR",
    name: "Riyal Arab Saudi",
    region: "middleEast",
    locale: "ar-SA",
    fractionDigits: 2,
    currencyDisplay: "code",
    searchTerms: ["arab saudi", "saudi arabia", "riyal", "riyal arab saudi"],
  },
  {
    code: "AED",
    name: "Dirham Uni Emirat Arab",
    region: "middleEast",
    locale: "ar-AE",
    fractionDigits: 2,
    currencyDisplay: "code",
    searchTerms: ["uni emirat arab", "united arab emirates", "uae", "dirham"],
  },
  {
    code: "USD",
    name: "Dolar Amerika Serikat",
    region: "global",
    locale: "en-US",
    fractionDigits: 2,
    searchTerms: ["amerika", "amerika serikat", "united states", "dolar amerika"],
  },
  {
    code: "AUD",
    name: "Dolar Australia",
    region: "global",
    locale: "en-AU",
    fractionDigits: 2,
    searchTerms: ["australia", "dolar australia"],
  },
  {
    code: "EUR",
    name: "Euro",
    region: "global",
    locale: "de-DE",
    fractionDigits: 2,
    searchTerms: ["eropa", "europe", "euro"],
  },
  {
    code: "GBP",
    name: "Pound Inggris",
    region: "global",
    locale: "en-GB",
    fractionDigits: 2,
    searchTerms: ["inggris", "britania", "united kingdom", "pound", "sterling"],
  },
];

export const DEFAULT_ACTIVE_CURRENCIES = CURRENCY_REGISTRY.map(
  (currency) => currency.code,
);

export const DEFAULT_SELECTED_CURRENCIES = ["IDR"];

export const CURRENCY_META = Object.fromEntries(
  CURRENCY_REGISTRY.map((currency) => [
    currency.code,
    {
      ...currency,
      label: currency.code,
      digits: currency.fractionDigits,
      regionLabel: CURRENCY_REGION_META[currency.region]?.label || currency.region,
    },
  ]),
);

export const HIDDEN_BALANCE_TEXT = "\u2022\u2022\u2022\u2022\u2022\u2022";

export const numberFormatter = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("id-ID", {
  style: "percent",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const inputGroupingFormatters = {};
const inputDecimalSeparators = {};

function getInputGroupingFormatter(locale = "en-US") {
  const key = locale || "en-US";
  if (!inputGroupingFormatters[key]) {
    inputGroupingFormatters[key] = new Intl.NumberFormat(key, {
      maximumFractionDigits: 0,
    });
  }
  return inputGroupingFormatters[key];
}

function getDecimalSeparator(locale = "en-US") {
  const key = locale || "en-US";
  if (!inputDecimalSeparators[key]) {
    const part = new Intl.NumberFormat(key, { minimumFractionDigits: 1 })
      .formatToParts(1.1)
      .find((item) => item.type === "decimal");
    inputDecimalSeparators[key] = part?.value || ".";
  }
  return inputDecimalSeparators[key];
}

const currencyFormatters = {};
const moneyFormatters = {};

export function normalizeCurrencyCode(currency, fallback = DEFAULT_BASE_CURRENCY) {
  const code = String(currency || fallback || DEFAULT_BASE_CURRENCY)
    .trim()
    .toUpperCase();
  return code || DEFAULT_BASE_CURRENCY;
}

export function getCurrencyMeta(currency) {
  const code = normalizeCurrencyCode(currency);
  return (
    CURRENCY_META[code] || {
      code,
      label: code,
      name: code,
      region: "global",
      regionLabel: CURRENCY_REGION_META.global.label,
      locale: "en-US",
      digits: 2,
      fractionDigits: 2,
      searchTerms: [],
    }
  );
}

function normalizeCurrencySearchTerm(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("id-ID");
}

export function searchCurrencyOptions(
  query,
  currencies = DEFAULT_ACTIVE_CURRENCIES,
) {
  const normalizedQuery = normalizeCurrencySearchTerm(query);
  const options = getCurrencyOptions(currencies);
  if (!normalizedQuery) return options;

  return options.filter((option) =>
    normalizeCurrencySearchTerm(
      [
        option.value,
        option.name,
        option.regionLabel,
        ...(option.searchTerms || []),
      ].join(" "),
    ).includes(normalizedQuery),
  );
}

export function groupCurrencyOptions(
  currencies = DEFAULT_ACTIVE_CURRENCIES,
  query = "",
) {
  const options = searchCurrencyOptions(query, currencies);
  return Object.entries(CURRENCY_REGION_META)
    .sort(([, left], [, right]) => left.order - right.order)
    .map(([region, regionMeta]) => ({
      region,
      label: regionMeta.label,
      options: options.filter((option) => option.region === region),
    }))
    .filter((group) => group.options.length);
}

export function formatCurrency(value, currency) {
  const code = normalizeCurrencyCode(currency);
  if (!currencyFormatters[code]) {
    const meta = getCurrencyMeta(code);
    currencyFormatters[code] = new Intl.NumberFormat(meta.locale, {
      style: "currency",
      currency: code,
      currencyDisplay: meta.currencyDisplay || "symbol",
      minimumFractionDigits: meta.digits,
      maximumFractionDigits: meta.digits,
    });
  }
  return currencyFormatters[code].format(Number(value || 0));
}

export function formatCurrencyCompact(value, currency) {
  const code = normalizeCurrencyCode(currency);
  const numeric = Number(value || 0);
  const absolute = Math.abs(numeric);
  if (absolute < 10000) return formatCurrency(numeric, code);

  const meta = getCurrencyMeta(code);
  return new Intl.NumberFormat(meta.locale, {
    style: "currency",
    currency: code,
    notation: "compact",
    minimumFractionDigits: 0,
    maximumFractionDigits: absolute >= 1000000 ? 1 : 0,
  }).format(numeric);
}

export function formatMoney(value, currency, options = {}) {
  const code = normalizeCurrencyCode(currency);
  const meta = getCurrencyMeta(code);
  const numeric = Number(value || 0);
  const formatOptions = {
    style: "currency",
    currency: code,
    currencyDisplay:
      options.currencyDisplay || meta.currencyDisplay || "narrowSymbol",
  };

  if (options.notation) formatOptions.notation = options.notation;
  if (typeof options.minimumFractionDigits === "number") {
    formatOptions.minimumFractionDigits = options.minimumFractionDigits;
  }
  if (typeof options.maximumFractionDigits === "number") {
    formatOptions.maximumFractionDigits = options.maximumFractionDigits;
  }

  const cacheKey = JSON.stringify([meta.locale, code, formatOptions]);
  try {
    if (!moneyFormatters[cacheKey]) {
      moneyFormatters[cacheKey] = new Intl.NumberFormat(meta.locale, formatOptions);
    }
    return moneyFormatters[cacheKey].format(numeric);
  } catch {
    return `${code} ${numberFormatter.format(numeric)}`;
  }
}

export function formatMoneyCompact(value, currency) {
  const numeric = Number(value || 0);
  const absolute = Math.abs(numeric);
  if (absolute < 10000) return formatMoney(numeric, currency);

  return formatMoney(numeric, currency, {
    notation: "compact",
    maximumFractionDigits: absolute >= 1000000 ? 1 : 0,
  });
}

export function normalizeCurrencyList(
  currencies,
  { ensureBase = true, baseCurrency = DEFAULT_BASE_CURRENCY } = {},
) {
  const source = Array.isArray(currencies) ? currencies : [];
  const selected = [];
  const seen = new Set();
  const requiredBase = normalizeCurrencyCode(baseCurrency);

  function addCurrency(currency) {
    const code = normalizeCurrencyCode(currency);
    if (!code || seen.has(code)) return;
    seen.add(code);
    selected.push(code);
  }

  if (ensureBase) addCurrency(requiredBase);
  source.forEach(addCurrency);

  const order = new Map(DEFAULT_ACTIVE_CURRENCIES.map((code, index) => [code, index]));
  selected.sort((left, right) => {
    const leftOrder = order.has(left) ? order.get(left) : Number.MAX_SAFE_INTEGER;
    const rightOrder = order.has(right) ? order.get(right) : Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder || left.localeCompare(right);
  });

  return selected.length ? selected : [DEFAULT_BASE_CURRENCY];
}

export function getCurrencyOptions(currencies = DEFAULT_ACTIVE_CURRENCIES) {
  const source = Array.isArray(currencies)
    ? currencies
    : normalizeCurrencyList(currencies);
  return source.map((currency) => {
    const code = normalizeCurrencyCode(currency);
    const meta = getCurrencyMeta(code);
    return {
      value: code,
      label: meta.label,
      name: meta.name,
      region: meta.region,
      regionLabel: meta.regionLabel,
      fractionDigits: meta.fractionDigits,
      searchTerms: meta.searchTerms,
    };
  });
}

export function formatRate(
  value,
  fromCurrency = DEFAULT_BASE_CURRENCY,
  toCurrency = "THB",
) {
  if (!value) return "-";
  return `${numberFormatter.format(Number(value))} ${normalizeCurrencyCode(
    fromCurrency,
  )} / 1 ${normalizeCurrencyCode(toCurrency, "THB")}`;
}

export function formatPercent(value) {
  return percentFormatter.format(Number(value || 0));
}

/* Kolom kurs bukan nominal mata uang: nilainya bisa jauh di bawah satu
   (0,0000625) sehingga aturan desimal umum yang dipakai, bukan aturan
   mata uang dompet. */
export const RATE_INPUT_OPTIONS = {
  allowDecimal: true,
  fractionDigits: 2,
  locale: "en-US",
};

export function getNumericInputOptions(currency) {
  /* Tanpa mata uang yang jelas, pakai aturan paling longgar supaya kolom
     berpecahan tidak pernah kehilangan angka di belakang koma. */
  if (!currency) return { allowDecimal: true, fractionDigits: 2, locale: "en-US" };
  const meta = getCurrencyMeta(currency);
  const digits = Number(meta.fractionDigits);
  const fractionDigits = Number.isFinite(digits) ? digits : 2;
  return {
    allowDecimal: fractionDigits > 0,
    fractionDigits,
    locale: meta.locale || "en-US",
  };
}

function resolveNumericInputOptions({
  allowDecimal = true,
  fractionDigits,
  locale = "en-US",
} = {}) {
  const digits = Number(fractionDigits);
  const resolvedDigits = Number.isFinite(digits) ? digits : allowDecimal ? 2 : 0;
  return {
    maxDecimals: allowDecimal ? Math.max(resolvedDigits, 0) : 0,
    locale: locale || "en-US",
  };
}

/* "25.000" yang diketik pengguna Indonesia pernah tersimpan sebagai 25
   karena titik selalu dianggap desimal. Pemisahnya sekarang ditentukan
   dari bentuk angkanya, bukan dari satu locale tetap: pemisah terakhir
   baru dibaca sebagai desimal kalau masuk akal untuk mata uang itu. */
export function normalizeNumericInput(value, options = {}) {
  const { maxDecimals } = resolveNumericInputOptions(options);
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (maxDecimals <= 0) return raw.replace(/[^\d]/g, "");

  const cleaned = raw.replace(/[^\d.,]/g, "");
  if (!cleaned) return "";

  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");
  const separatorIndex = Math.max(lastDot, lastComma);
  if (separatorIndex === -1) return cleaned;

  const separator = cleaned[separatorIndex];
  const integerPart = cleaned.slice(0, separatorIndex).replace(/[^\d]/g, "");
  const decimalPart = cleaned.slice(separatorIndex + 1).replace(/[^\d]/g, "");
  const mixesSeparators = lastDot !== -1 && lastComma !== -1;
  const repeatsSeparator = cleaned.split(separator).length - 1 > 1;

  /* Tiga angka di belakang pemisah adalah pola ribuan: tidak ada mata uang
     di aplikasi ini yang berpecahan tiga digit. Nilai di bawah satu
     ("0.075" untuk kurs) tetap dibaca sebagai desimal. */
  const looksLikeThousands =
    decimalPart.length === 3 &&
    maxDecimals < 3 &&
    integerPart !== "" &&
    !integerPart.startsWith("0");

  if (!mixesSeparators && (repeatsSeparator || looksLikeThousands)) {
    return `${integerPart}${decimalPart}`;
  }
  return `${integerPart}.${decimalPart}`;
}

export function formatNumericInput(value, options = {}) {
  const { locale } = resolveNumericInputOptions(options);
  const cleaned = normalizeNumericInput(value, options);
  if (!cleaned) return "";

  const formatter = getInputGroupingFormatter(locale);
  if (!cleaned.includes(".")) return formatter.format(Number(cleaned));

  const [integerPartRaw, decimalPart = ""] = cleaned.split(".");
  const integerPart = integerPartRaw
    ? formatter.format(Number(integerPartRaw))
    : "0";
  return `${integerPart}${getDecimalSeparator(locale)}${decimalPart}`;
}

/* Dua pembungkus di bawah ini yang dipakai kolom nominal: pemisah ribuan
   dan desimalnya ikut mata uang dompet, sama seperti tampilan saldo. */
export function formatCurrencyInput(value, currency) {
  return formatNumericInput(value, getNumericInputOptions(currency));
}

export function parseCurrencyInput(value, currency) {
  return normalizeNumericInput(value, getNumericInputOptions(currency));
}

export function formatAutoNumericValue(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return "";
  const rounded =
    Math.abs(numeric) >= 100
      ? Math.round(numeric * 100) / 100
      : Math.round(numeric * 1000000) / 1000000;
  return formatNumericInput(String(rounded));
}
