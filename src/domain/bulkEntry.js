import {
  formatCurrency,
  getCurrencyMeta,
  getNumericInputOptions,
  normalizeCurrencyCode,
  normalizeNumericInput,
} from "../lib/currency.js";
import {
  UNIVERSAL_BUDGET_GROUP,
  getExpenseCategoryLabel,
  normalizeExpenseCategory,
} from "./categories.js";

/* Catat banyak: satu baris teks menjadi satu transaksi.

   Modul ini murni dan tidak menyentuh jaringan. Semua yang berbau nominal
   diserahkan ke aturan angka mata uang yang sudah dipakai seluruh form,
   sehingga "25.000" tidak pernah menyusut menjadi 25 di jalur baru ini. */

export const BULK_ENTRY_MAX_LINES = 80;

/* Kata yang menandai pemasukan. Sengaja pendek dan spesifik: kata umum
   seperti "bayar" atau "masuk" muncul di kalimat pengeluaran juga, dan
   salah arah jauh lebih merugikan daripada satu baris yang perlu dibalik
   sendiri di langkah Periksa. */
const INCOME_KEYWORDS = [
  "gaji",
  "bonus",
  "thr",
  "cashback",
  "refund",
  "freelance",
  "komisi",
  "honor",
  "dividen",
  "jual",
  "penjualan",
  "omzet",
  "insentif",
  "tunjangan",
];

/* Kata kunci dipetakan ke kategori yang benar benar ada di aplikasi.
   "Jajan" milik desain tidak dipakai karena kategori itu tidak ada di sini;
   kopi dan camilan masuk Makan Harian, yang deskripsinya memang mencakup
   minuman dan makan di luar. */
const CATEGORY_KEYWORDS = [
  [
    "Makan",
    [
      "makan",
      "makanan",
      "minuman",
      "minum",
      "sarapan",
      "makan pagi",
      "makan siang",
      "makan malam",
      "brunch",
      "lunch",
      "dinner",
      "belanja dapur",
      "belanja sayur",
      "sembako",
      "nasi",
      "nasi padang",
      "nasi goreng",
      "nasi uduk",
      "nasi kuning",
      "nasi campur",
      "padang",
      "warteg",
      "warung",
      "warkop",
      "angkringan",
      "kantin",
      "kafe",
      "cafe",
      "restoran",
      "resto",
      "bakso",
      "soto",
      "sate",
      "mie",
      "mie ayam",
      "bakmi",
      "kwetiau",
      "ramen",
      "ayam",
      "ayam goreng",
      "geprek",
      "seblak",
      "pecel",
      "ketoprak",
      "gado gado",
      "gudeg",
      "rendang",
      "pempek",
      "siomay",
      "batagor",
      "dimsum",
      "bubur",
      "lontong",
      "rawon",
      "gulai",
      "sop",
      "sup",
      "ikan",
      "udang",
      "seafood",
      "steak",
      "salad",
      "kebab",
      "sandwich",
      "sushi",
      "pizza",
      "burger",
      "kfc",
      "mcd",
      "hokben",
      "yoshinoya",
      "richeese",
      "solaria",
      "gofood",
      "grabfood",
      "shopeefood",
      "katering",
      "catering",
      "kopi",
      "ngopi",
      "kopi susu",
      "es kopi",
      "americano",
      "latte",
      "cappuccino",
      "starbucks",
      "boba",
      "matcha",
      "thai tea",
      "teh",
      "es teh",
      "jus",
      "susu",
      "yogurt",
      "milkshake",
      "es krim",
      "ice cream",
      "air mineral",
      "aqua",
      "jajan",
      "snack",
      "camilan",
      "roti",
      "kue",
      "cake",
      "brownies",
      "puding",
      "donat",
      "martabak",
      "cilok",
      "cireng",
      "risol",
      "pastel",
      "gorengan",
      "bakwan",
      "keripik",
      "kerupuk",
      "biskuit",
      "coklat",
      "permen",
      "sayur",
      "buah",
      "beras",
      "telur",
      "daging",
      "bumbu",
      "minyak goreng",
      "gula",
      "garam",
      "kecap",
      "tepung",
      "tahu",
      "tempe",
      "indomie",
      "mie instan",
      "mi instan",
      "nugget",
      "sosis",
      "sarden",
    ],
  ],
  [
    "Transportasi",
    [
      "gojek",
      "goride",
      "gocar",
      "grab",
      "grabbike",
      "grabcar",
      "uber",
      "maxim",
      "indriver",
      "ojek",
      "ojol",
      "opang",
      "taksi",
      "bluebird",
      "bajaj",
      "becak",
      "angkot",
      "bus",
      "bis",
      "damri",
      "busway",
      "transjakarta",
      "krl",
      "mrt",
      "lrt",
      "kereta",
      "whoosh",
      "railink",
      "stasiun",
      "terminal",
      "bandara",
      "pelabuhan",
      "kapal",
      "ferry",
      "feri",
      "pesawat",
      "tiket pesawat",
      "tiket kereta",
      "tiket bus",
      "travel",
      "bensin",
      "isi bensin",
      "bbm",
      "pertamax",
      "pertalite",
      "dexlite",
      "solar",
      "spbu",
      "pom bensin",
      "shell",
      "vivo",
      "parkir",
      "tol",
      "e-toll",
      "etoll",
      "kartu tol",
      "e-money",
      "flazz",
      "brizzi",
      "tapcash",
      "bengkel",
      "servis motor",
      "servis mobil",
      "service motor",
      "service mobil",
      "ganti oli",
      "oli",
      "tune up",
      "tambal ban",
      "ban motor",
      "ban mobil",
      "aki",
      "busi",
      "kampas rem",
      "sparepart",
      "spare part",
      "cuci motor",
      "cuci mobil",
      "steam motor",
      "derek",
      "helm",
      "pajak motor",
      "pajak mobil",
      "stnk",
      "sim",
      "sewa motor",
      "rental motor",
      "rental mobil",
      "sepeda motor",
    ],
  ],
  [
    "Tagihan",
    [
      "tagihan",
      "listrik",
      "token listrik",
      "token pln",
      "token",
      "pln",
      "tagihan listrik",
      "pdam",
      "air",
      "tagihan air",
      "pulsa",
      "kuota",
      "paket data",
      "internet",
      "wifi",
      "indihome",
      "biznet",
      "myrepublic",
      "first media",
      "iconnet",
      "telkom",
      "telkomsel",
      "indosat",
      "smartfren",
      "tv kabel",
      "iuran",
      "iuran rt",
      "iuran sampah",
      "sampah",
      "bpjs",
      "asuransi",
      "premi",
      "cicilan",
      "angsuran",
      "paylater",
      "kredivo",
      "akulaku",
      "kartu kredit",
      "leasing",
      "spp",
      "uang sekolah",
      "sekolah",
      "kuliah",
      "ukt",
      "les",
      "bimbel",
      "kursus",
    ],
  ],
  [
    "Belanja",
    [
      "belanja",
      "belanja bulanan",
      "indomaret",
      "alfamart",
      "alfamidi",
      "minimarket",
      "swalayan",
      "supermarket",
      "superindo",
      "hypermart",
      "transmart",
      "giant",
      "grosir",
      "pasar",
      "toko",
      "shopee",
      "tokopedia",
      "tokped",
      "lazada",
      "blibli",
      "bukalapak",
      "tiktok shop",
      "olshop",
      "online shop",
      "baju",
      "kaos",
      "kemeja",
      "celana",
      "rok",
      "dress",
      "gamis",
      "jaket",
      "sweater",
      "hoodie",
      "hijab",
      "jilbab",
      "kerudung",
      "mukena",
      "sarung",
      "batik",
      "seragam",
      "sepatu",
      "sandal",
      "kaos kaki",
      "tas",
      "ransel",
      "topi",
      "ikat pinggang",
      "jam tangan",
      "laundry",
      "cuci baju",
      "binatu",
      "jahit",
      "permak",
      "sabun",
      "sabun cuci",
      "sabun mandi",
      "sampo",
      "shampo",
      "pasta gigi",
      "odol",
      "sikat gigi",
      "deterjen",
      "rinso",
      "molto",
      "pewangi",
      "pengharum",
      "pembersih",
      "karbol",
      "obat nyamuk",
      "tisu",
      "kapas",
      "pembalut",
      "popok",
      "handuk",
      "seprai",
      "bantal",
      "guling",
      "kasur",
      "galon",
      "galon air",
      "air galon",
      "gas",
      "elpiji",
      "peralatan",
      "perabot",
      "piring",
      "gelas",
      "sendok",
      "panci",
      "wajan",
      "kompor",
      "rice cooker",
      "kulkas",
      "mesin cuci",
      "kipas angin",
      "dispenser",
      "setrika",
      "lampu",
      "baterai",
      "charger",
      "kabel",
      "headset",
      "earphone",
      "powerbank",
      "hp",
      "handphone",
      "laptop",
      "mouse",
      "keyboard",
      "flashdisk",
      "tempered glass",
      "atk",
      "alat tulis",
      "buku tulis",
      "pulpen",
      "pensil",
      "penggaris",
      "spidol",
      "kertas",
      "tinta",
      "printer",
      "fotokopi",
      "foto copy",
      "makanan kucing",
      "pakan",
      "pasir kucing",
      "plastik",
      "kantong sampah",
      "ongkir",
      "ongkos kirim",
      "kurir",
      "jne",
      "j&t",
      "sicepat",
      "anteraja",
      "gosend",
      "paxel",
      "ninja express",
      "pos indonesia",
      "ekspedisi",
    ],
  ],
  [
    "Kesehatan",
    [
      "obat",
      "apotek",
      "apotik",
      "dokter",
      "klinik",
      "puskesmas",
      "rumah sakit",
      "bidan",
      "igd",
      "rawat inap",
      "rawat jalan",
      "opname",
      "resep",
      "vitamin",
      "suplemen",
      "paracetamol",
      "antibiotik",
      "periksa",
      "kontrol",
      "konsultasi dokter",
      "medical check up",
      "cek darah",
      "cek lab",
      "lab",
      "rontgen",
      "usg",
      "antigen",
      "swab",
      "vaksin",
      "imunisasi",
      "posyandu",
      "gigi",
      "tambal gigi",
      "cabut gigi",
      "behel",
      "kawat gigi",
      "scaling",
      "kacamata",
      "softlens",
      "terapi",
      "fisioterapi",
      "psikolog",
      "masker",
      "plester",
      "hansaplast",
      "betadine",
      "minyak kayu putih",
      "balsem",
      "koyo",
      "termometer",
    ],
  ],
  [
    "Tempat Tinggal",
    [
      "sewa",
      "sewa rumah",
      "sewa kamar",
      "sewa apartemen",
      "apartemen",
      "kos",
      "kost",
      "ngekos",
      "indekos",
      "uang kos",
      "kontrakan",
      "kontrak",
      "kpr",
      "cicilan rumah",
      "angsuran rumah",
      "pbb",
      "pajak rumah",
      "ipl",
      "iuran warga",
      "keamanan",
      "satpam",
      "renovasi",
      "perbaikan rumah",
      "tukang",
      "tukang ledeng",
      "bahan bangunan",
      "material",
      "semen",
      "cat tembok",
      "cat rumah",
      "keramik",
      "paku",
      "pipa",
      "genteng",
      "plafon",
      "servis ac",
      "service ac",
      "cuci ac",
      "asisten rumah tangga",
      "pembantu",
      "cleaning service",
    ],
  ],
  [
    "Hiburan & Gaya Hidup",
    [
      "netflix",
      "spotify",
      "disney",
      "youtube",
      "vidio",
      "wetv",
      "viu",
      "iqiyi",
      "prime video",
      "bioskop",
      "nonton",
      "film",
      "xxi",
      "cgv",
      "cinepolis",
      "tiket nonton",
      "konser",
      "tiket konser",
      "festival",
      "pameran",
      "museum",
      "kebun binatang",
      "taman hiburan",
      "dufan",
      "ancol",
      "waterpark",
      "wisata",
      "tiket wisata",
      "liburan",
      "staycation",
      "hotel",
      "villa",
      "resort",
      "penginapan",
      "camping",
      "hiking",
      "snorkeling",
      "game",
      "steam",
      "mobile legends",
      "top up game",
      "topup game",
      "voucher game",
      "diamond",
      "genshin",
      "roblox",
      "playstation",
      "nintendo",
      "xbox",
      "karaoke",
      "novel",
      "komik",
      "salon",
      "barbershop",
      "potong rambut",
      "pangkas rambut",
      "cukur",
      "creambath",
      "smoothing",
      "cat rambut",
      "facial",
      "spa",
      "pijat",
      "massage",
      "refleksi",
      "manicure",
      "pedicure",
      "nail art",
      "sulam alis",
      "skincare",
      "serum",
      "toner",
      "sunscreen",
      "makeup",
      "make up",
      "kosmetik",
      "lipstik",
      "bedak",
      "parfum",
      "minyak wangi",
      "gym",
      "fitness",
      "yoga",
      "zumba",
      "renang",
      "futsal",
      "badminton",
      "golf",
      "gowes",
      "sepeda",
      "rokok",
      "vape",
      "liquid",
      "hobi",
      "kado",
      "hadiah",
    ],
  ],
  [
    "Lainnya",
    [
      "sedekah",
      "zakat",
      "infaq",
      "infak",
      "donasi",
      "sumbangan",
      "amal",
      "santunan",
      "arisan",
      "kondangan",
      "hajatan",
      "angpao",
      "denda",
      "pajak",
      "biaya admin",
      "administrasi",
      "materai",
      "notaris",
      "legalisir",
      "paspor",
      "visa",
    ],
  ],
];

/* Satu pola gabungan dibangun sekali, bukan satu regex per kata kunci per
   baris. Pratinjau membaca ulang seluruh teks setiap kali pengguna mengetik,
   dan dengan ratusan kata kunci cara lama berarti puluhan ribu regex baru
   untuk satu ketukan tombol.

   Kata kunci diurutkan dari yang terpanjang supaya di satu posisi yang sama
   pilihan terpanjanglah yang cocok lebih dulu: "grabfood" adalah Makan, bukan
   Transportasi seperti "grab" di dalamnya, dan "pasta gigi" adalah Belanja,
   bukan Kesehatan seperti "gigi". */
const CATEGORY_BY_KEYWORD = new Map();
CATEGORY_KEYWORDS.forEach(([category, keywords]) => {
  keywords.forEach((keyword) => {
    if (!CATEGORY_BY_KEYWORD.has(keyword)) CATEGORY_BY_KEYWORD.set(keyword, category);
  });
});

export function getBulkCategoryKeywords() {
  return CATEGORY_KEYWORDS.map(([category, keywords]) => [category, [...keywords]]);
}

/* Kata depan yang biasa mendahului nama dompet, dibuang dari judul supaya
   "parkir 5000 pakai gopay" tidak tersimpan sebagai "Parkir pakai". */
const WALLET_PREPOSITIONS = ["pakai", "pake", "pk", "via", "lewat", "dari", "ke", "di"];

const YESTERDAY_PATTERN = /\bkemarin\b/i;

/* Nominal: angka terakhir pada baris, boleh berawalan rp dan bersufiks
   satuan ribuan atau jutaan. Angka terakhir dipilih karena judul transaksi
   sering memuat angka lain lebih dulu ("makan 2 orang 50rb"). */
const AMOUNT_PATTERN = /(?:rp\.?\s*)?(\d+(?:[.,]\d+)*)\s*(rb|ribu|k|jt|juta)?(?![a-z0-9])/gi;

const SUFFIX_MULTIPLIER = {
  rb: 1000,
  ribu: 1000,
  k: 1000,
  jt: 1000000,
  juta: 1000000,
};

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function roundToCurrency(value, currency) {
  const digits = Number(getCurrencyMeta(currency).fractionDigits ?? 2);
  const factor = 10 ** (Number.isFinite(digits) ? digits : 2);
  return Math.round(Number(value || 0) * factor) / factor;
}

/* Angka bersufiks selalu dibaca sebagai pecahan: "63,5rb" berarti 63.500,
   bukan 635.000. Aturan ribuan mata uang tidak berlaku di sini karena
   sufiksnya sendiri yang menyatakan skalanya. */
function readSuffixedNumber(token) {
  const cleaned = String(token).replace(/[^\d.,]/g, "");
  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");
  const separatorIndex = Math.max(lastDot, lastComma);
  if (separatorIndex === -1) return Number(cleaned);

  const decimalPart = cleaned.slice(separatorIndex + 1).replace(/[^\d]/g, "");
  const integerPart = cleaned.slice(0, separatorIndex).replace(/[^\d]/g, "");
  const repeatsSeparator = lastDot !== -1 && lastComma !== -1;
  /* Tiga angka di belakang pemisah tetap pola ribuan ("1.500rb"), selebihnya
     pecahan biasa. */
  if (repeatsSeparator || decimalPart.length === 3) {
    return Number(`${integerPart}${decimalPart}`);
  }
  return Number(`${integerPart}.${decimalPart}`);
}

export function readBulkAmount(token, suffix, currency) {
  const code = normalizeCurrencyCode(currency);
  const multiplier = SUFFIX_MULTIPLIER[String(suffix || "").toLowerCase()] || 0;
  if (multiplier) {
    return roundToCurrency(readSuffixedNumber(token) * multiplier, code);
  }
  /* Tanpa sufiks, angkanya dibaca dengan aturan mata uangnya sendiri lewat
     fungsi yang sama dengan semua kolom nominal di aplikasi. */
  const numeric = Number(
    normalizeNumericInput(token, getNumericInputOptions(code)) || 0,
  );
  return roundToCurrency(numeric, code);
}

function findWalletMatch(text, accounts) {
  let best = null;
  accounts.forEach((account) => {
    const name = String(account?.name || "").trim();
    if (name.length < 2) return;
    const pattern = new RegExp(`\\b${escapeRegExp(name)}\\b`, "i");
    const found = pattern.exec(text);
    if (!found) return;
    /* Nama terpanjang menang supaya "BCA Digital" tidak kalah oleh "BCA". */
    if (!best || name.length > best.name.length) {
      best = { account, name, index: found.index, length: found[0].length };
    }
  });
  return best;
}

function buildKeywordPattern(keywords) {
  const alternatives = [...keywords]
    .sort((a, b) => b.length - a.length)
    .map((keyword) => escapeRegExp(keyword))
    .join("|");
  return new RegExp(`\\b(${alternatives})\\b`, "i");
}

const CATEGORY_PATTERN = buildKeywordPattern([...CATEGORY_BY_KEYWORD.keys()]);
const INCOME_PATTERN = buildKeywordPattern(INCOME_KEYWORDS);

export function detectBulkCategory(text) {
  const found = CATEGORY_PATTERN.exec(String(text || ""));
  if (!found) return null;
  return CATEGORY_BY_KEYWORD.get(found[1].toLocaleLowerCase("id-ID")) || null;
}

function cleanDescription(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/^[\s,.;:+\-•*]+/, "")
    .replace(/[\s,.;:+\-]+$/, "")
    .trim();
}

function toSentenceCase(value) {
  const text = cleanDescription(value);
  if (!text) return "";
  return text.charAt(0).toLocaleUpperCase("id-ID") + text.slice(1);
}

export function getBulkRowTitle(row) {
  if (row?.description) return row.description;
  if (row?.type === "income") return "Pemasukan";
  return row?.category ? getExpenseCategoryLabel(row.category) : "Pengeluaran";
}

function pickDefaultAccount(accounts, baseCurrency) {
  const base = normalizeCurrencyCode(baseCurrency);
  const sameCurrency = accounts.filter(
    (account) => normalizeCurrencyCode(account.currency) === base,
  );
  const pool = sameCurrency.length ? sameCurrency : accounts;
  return pool.find((account) => account.isPrimary || account.is_primary) || pool[0] || null;
}

export function resolveBulkDefaultAccount(accounts = [], baseCurrency) {
  return pickDefaultAccount(accounts, baseCurrency);
}

function shiftDateKey(dateKey, days) {
  const [year, month, day] = String(dateKey || "").split("-").map(Number);
  if (!year || !month || !day) return dateKey;
  const moved = new Date(year, month - 1, day + days);
  const pad = (value) => String(value).padStart(2, "0");
  return `${moved.getFullYear()}-${pad(moved.getMonth() + 1)}-${pad(moved.getDate())}`;
}

/* Satu baris teks menjadi satu calon transaksi. Baris yang nominalnya tidak
   terbaca tidak dibuang diam diam: ia tetap muncul sebagai baris dilewati,
   supaya pengguna tahu persis apa yang tidak ikut tersimpan. */
export function parseBulkEntryLine(raw, context = {}) {
  const {
    accounts = [],
    defaultAccountId = "",
    defaultDateKey = "",
    baseCurrency,
  } = context;

  const original = String(raw || "");
  if (!original.trim()) return null;

  const fallbackAccount =
    accounts.find((account) => account.id === defaultAccountId) ||
    pickDefaultAccount(accounts, baseCurrency);

  let working = original.trim();
  const incomeMarked = /^\+/.test(working);
  working = working.replace(/^[+\-•*·]\s*/, "");

  const walletMatch = findWalletMatch(working, accounts);
  const account = walletMatch ? walletMatch.account : fallbackAccount;
  const currency = normalizeCurrencyCode(account?.currency || baseCurrency);

  if (walletMatch) {
    const before = working.slice(0, walletMatch.index);
    const after = working.slice(walletMatch.index + walletMatch.length);
    const prepositionPattern = new RegExp(
      `\\s(?:${WALLET_PREPOSITIONS.join("|")})\\s*$`,
      "i",
    );
    working = `${before.replace(prepositionPattern, " ")} ${after}`;
  }

  const dateKey = YESTERDAY_PATTERN.test(working)
    ? shiftDateKey(defaultDateKey, -1)
    : defaultDateKey;
  working = working.replace(YESTERDAY_PATTERN, " ");

  AMOUNT_PATTERN.lastIndex = 0;
  const matches = [...working.matchAll(AMOUNT_PATTERN)];
  const match = matches[matches.length - 1] || null;
  const amount = match ? readBulkAmount(match[1], match[2], currency) : 0;
  if (match) {
    working = `${working.slice(0, match.index)} ${working.slice(match.index + match[0].length)}`;
  }

  const type = incomeMarked || INCOME_PATTERN.test(original) ? "income" : "expense";
  /* Kategori dicari pada sisa baris, bukan pada teks aslinya: nama dompet,
     kata tanggal, dan nominalnya sudah dibuang di sini. Tanpa itu, dompet
     bernama "Belanja" atau "Jajan" akan mewarnai kategori setiap baris yang
     menyebut dompet tersebut. */
  const category = type === "income" ? null : detectBulkCategory(working);

  return {
    raw: original,
    type,
    description: toSentenceCase(working),
    amount,
    currency,
    accountId: account?.id || "",
    accountName: account?.name || "",
    dateKey,
    category,
    skipped: !(amount > 0),
    skipReason: amount > 0 ? "" : "Nominal tidak terbaca, baris dilewati",
  };
}

export function parseBulkEntryText(text, context = {}) {
  const lines = String(text || "").split(/\r?\n/).slice(0, BULK_ENTRY_MAX_LINES);
  const rows = [];
  lines.forEach((line, index) => {
    const parsed = parseBulkEntryLine(line, context);
    if (!parsed) return;
    rows.push({ ...parsed, id: `bulk-${index + 1}`, lineNumber: index + 1 });
  });
  return rows;
}

export function isBulkRowIncomplete(row) {
  if (!row) return true;
  if (!(Number(row.amount) > 0)) return true;
  if (!row.accountId) return true;
  return row.type === "expense" && !row.category;
}

/* Ringkasan tidak pernah menjumlahkan dua mata uang menjadi satu angka.
   Totalnya dikelompokkan per mata uang, persis seperti sisa aplikasi. */
export function summarizeBulkEntryRows(rows = []) {
  const usable = rows.filter((row) => !row.skipped);
  const totals = new Map();
  usable.forEach((row) => {
    const code = normalizeCurrencyCode(row.currency);
    const entry = totals.get(code) || { currency: code, income: 0, expense: 0 };
    if (row.type === "income") entry.income += Number(row.amount || 0);
    else entry.expense += Number(row.amount || 0);
    totals.set(code, entry);
  });

  return {
    readyCount: usable.length,
    skippedCount: rows.length - usable.length,
    incompleteCount: usable.filter((row) => isBulkRowIncomplete(row)).length,
    totals: [...totals.values()],
  };
}

/* Rekap layar Selesai: satu baris per kategori, pemasukan dikumpulkan
   terpisah karena di aplikasi ini pemasukan memang tidak berkategori. */
export function groupBulkEntryRows(rows = []) {
  const groups = new Map();
  rows.forEach((row) => {
    const currency = normalizeCurrencyCode(row.currency);
    const key =
      row.type === "income"
        ? `income|${currency}`
        : `${normalizeExpenseCategory(row.category, "Lainnya")}|${currency}`;
    const entry = groups.get(key) || {
      key,
      type: row.type,
      currency,
      label:
        row.type === "income"
          ? "Pemasukan"
          : getExpenseCategoryLabel(row.category),
      count: 0,
      total: 0,
    };
    entry.count += 1;
    entry.total += Number(row.amount || 0);
    groups.set(key, entry);
  });

  return [...groups.values()].sort((a, b) => {
    if (a.type !== b.type) return a.type === "income" ? 1 : -1;
    return b.total - a.total;
  });
}

/* Waktu kejadian mengikuti urutan ketikan: baris pertama paling awal,
   baris terakhir paling dekat dengan sekarang. Tanpa ini semua baris
   berbagi satu detik yang sama dan urutannya di Riwayat jadi acak. */
function buildOccurredAt(dateKey, now, offsetSeconds) {
  const [year, month, day] = String(dateKey || "").split("-").map(Number);
  const reference = new Date(now);
  if (!year || !month || !day) return new Date(reference.getTime() - offsetSeconds * 1000);
  const moment = new Date(
    year,
    month - 1,
    day,
    reference.getHours(),
    reference.getMinutes(),
    reference.getSeconds(),
  );
  const shifted = new Date(moment.getTime() - offsetSeconds * 1000);
  return shifted.getTime() > reference.getTime() ? reference : shifted;
}

/* Pemeriksaan saldo dilakukan per dompet untuk seluruh batch sekaligus.
   Server memeriksa saldo baris demi baris, jadi tanpa hitungan kumulatif di
   sini penyimpanan bisa berhenti di tengah dengan sebagian sudah masuk. */
export function planBulkEntrySave(rows = [], context = {}) {
  const { now = new Date(), accounts = [], availability = {} } = context;
  const usable = rows.filter((row) => !row.skipped);

  if (!usable.length) {
    return { ok: false, message: "Belum ada baris yang bisa disimpan.", payloads: [] };
  }

  const incomplete = usable.filter((row) => isBulkRowIncomplete(row));
  if (incomplete.length) {
    return {
      ok: false,
      message: `${incomplete.length} baris belum lengkap.`,
      payloads: [],
    };
  }

  const accountMap = new Map(accounts.map((account) => [account.id, account]));
  for (const row of usable) {
    const account = accountMap.get(row.accountId);
    if (!account) {
      return { ok: false, message: "Ada baris yang dompetnya tidak tersedia.", payloads: [] };
    }
    if (normalizeCurrencyCode(account.currency) !== normalizeCurrencyCode(row.currency)) {
      return {
        ok: false,
        message: `Mata uang baris "${getBulkRowTitle(row)}" tidak sesuai dompetnya.`,
        payloads: [],
      };
    }
  }

  const netByAccount = new Map();
  usable.forEach((row) => {
    const current = Number(netByAccount.get(row.accountId) || 0);
    const effect = row.type === "income" ? -Number(row.amount || 0) : Number(row.amount || 0);
    netByAccount.set(row.accountId, current + effect);
  });

  for (const [accountId, needed] of netByAccount) {
    if (needed <= 0) continue;
    const account = accountMap.get(accountId);
    const summary = availability[accountId];
    const available = Number(
      summary ? summary.availableBalance : (account?.availableBalance ?? account?.balance_amount ?? 0),
    );
    if (needed > available + 0.0001) {
      const short = roundToCurrency(needed - available, account?.currency);
      return {
        ok: false,
        message: `Dana tersedia ${account?.name || "dompet"} kurang ${formatCurrency(short, account?.currency)}.`,
        payloads: [],
        shortfall: { accountId, amount: short, currency: normalizeCurrencyCode(account?.currency) },
      };
    }
  }

  const payloads = usable.map((row, index) => {
    const isExpense = row.type === "expense";
    const occurredAt = buildOccurredAt(row.dateKey, now, usable.length - index);
    return {
      rowId: row.id,
      type: row.type,
      occurred_at: occurredAt.toISOString(),
      description: getBulkRowTitle(row),
      category: isExpense ? normalizeExpenseCategory(row.category, "Lainnya") : null,
      category_group: isExpense ? UNIVERSAL_BUDGET_GROUP : null,
      currency: normalizeCurrencyCode(row.currency),
      amount: String(row.amount),
      expense_currency: isExpense ? normalizeCurrencyCode(row.currency) : null,
      source_account_id: isExpense ? row.accountId : null,
      destination_account_id: isExpense ? null : row.accountId,
      target_id: null,
    };
  });

  /* Pemasukan disimpan lebih dulu supaya pengeluaran yang memang ditutup oleh
     pemasukan di batch yang sama tidak ditolak server karena saldo sesaat.
     Waktu kejadian sudah dihitung di atas, jadi urutan simpan tidak mengubah
     urutan di Riwayat. */
  const ordered = [
    ...payloads.filter((item) => item.type === "income"),
    ...payloads.filter((item) => item.type !== "income"),
  ];

  return { ok: true, message: "", payloads: ordered };
}
