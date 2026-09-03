import { formatCurrency } from "../lib/currency.js";

/* Saran menabung, disusun berurut kepentingan.

   buildControlCoach di controlGuidance.js hanya mengembalikan satu saran dari
   rantai if berurutan, jadi begitu satu kondisi terpenuhi sisanya tidak pernah
   terlihat. Di sini semua yang relevan dikumpulkan lalu diurutkan.

   Batas yang dipegang: tiap saran hanya berisi aritmetika dari data pengguna
   sendiri, bukan rekomendasi finansial. "Kurangi Rp 29.000 per hari supaya
   tetap di dalam jatahmu" adalah hitungan; "sebaiknya kamu investasikan di X"
   adalah nasihat keuangan, dan aplikasi ini tidak punya dasar untuk itu.

   Saran yang datanya belum lengkap tidak ditampilkan sama sekali, bukan diisi
   angka perkiraan. */

/* Rasio menabung yang dipakai sebagai pembanding. Bukan anjuran, hanya titik
   acuan supaya selisihnya bisa dihitung dan ditunjukkan. */
export const SAVINGS_RATIO_BENCHMARK = 0.2;

/* Bulan pengeluaran yang lazim dijadikan tonggak dana cadangan. Dipakai
   sebagai pembanding yang sama alasannya dengan di atas. */
export const RUNWAY_TARGET_MONTHS = 3;

function uang(nilai, currency) {
  return formatCurrency(Math.abs(Number(nilai) || 0), currency);
}

function bulat(nilai) {
  return Math.round(Number(nilai) || 0);
}

/* Kategori yang ritmenya terlalu cepat tetapi belum lewat batas. Di sini
   pengurangan harian masih masuk akal karena jatahnya memang masih ada. */
function adviceFromPace(summary, currency) {
  const remainingDays = Number(summary?.monthMeta?.remainingDays || 0);
  const elapsedDays = Number(summary?.monthMeta?.elapsedDays || 0);
  const kategori = (summary?.budget?.attentionCategories || [])[0];
  if (!kategori) return null;

  const sisa = Number(kategori.remainingAmount || 0);
  const terpakai = Number(kategori.spentAmount || 0);

  if (kategori.paceStatus === "over" || sisa <= 0) {
    /* Uangnya sudah terpakai. Menyuruh "kurangi sekian per hari" tidak
       mengembalikan apa pun, jadi yang jujur adalah menyebut selisihnya dan
       dari mana sisanya akan diambil. */
    return {
      key: "category_over",
      rank: 1,
      tone: "danger",
      title: `${kategori.categoryLabel} lewat ${uang(sisa, currency)}`,
      detail:
        "Kelebihannya akan terambil dari jatah kategori lain. Setel ulang batasnya atau tahan pengeluaran di sini sampai akhir bulan.",
      actionLabel: "Tinjau jatah",
      actionTarget: "budget",
      categoryKey: kategori.categoryKey || null,
    };
  }

  if (remainingDays <= 0 || elapsedDays <= 0) return null;

  const jatahHarian = sisa / remainingDays;
  const ritmeHarian = terpakai / elapsedDays;
  const potongan = ritmeHarian - jatahHarian;
  if (!(potongan > 0)) return null;

  return {
    key: "category_pace",
    rank: 2,
    tone: "warn",
    title: `${kategori.categoryLabel} jalan terlalu cepat`,
    detail: `Sekarang rata-rata ${uang(ritmeHarian, currency)} per hari. Kurangi ${uang(
      potongan,
      currency,
    )} per hari supaya sisa ${uang(sisa, currency)} cukup sampai akhir bulan.`,
    actionLabel: "Tinjau jatah",
    actionTarget: "budget",
    categoryKey: kategori.categoryKey || null,
  };
}

function adviceFromSavingsRatio(summary, currency) {
  const cashFlow = summary?.cashFlow;
  if (!cashFlow?.evaluable) return null;

  const ratio = Number(cashFlow.savingsRatio);
  const income = Number(cashFlow.income || 0);
  if (!Number.isFinite(ratio) || income <= 0) return null;
  if (ratio >= SAVINGS_RATIO_BENCHMARK) return null;

  const selisih = (SAVINGS_RATIO_BENCHMARK - ratio) * income;
  if (!(selisih > 0)) return null;

  return {
    key: "savings_ratio",
    rank: 3,
    tone: ratio < 0 ? "danger" : "warn",
    title: `Rasio menabungmu ${bulat(ratio * 100)}%`,
    detail: `Dari pemasukan ${uang(income, currency)} bulan ini. Menyisihkan ${uang(
      selisih,
      currency,
    )} lagi membuatnya menyentuh ${bulat(SAVINGS_RATIO_BENCHMARK * 100)}%.`,
    actionLabel: "Atur jatah",
    actionTarget: "budget",
    categoryKey: null,
  };
}

function adviceFromRunway(summary, currency) {
  const runway = summary?.runway;
  if (!runway?.evaluable) return null;

  const months = Number(runway.months);
  const burn = Number(runway.monthlyBurn || 0);
  if (!Number.isFinite(months) || burn <= 0) return null;
  if (months >= RUNWAY_TARGET_MONTHS) return null;

  const kurang = RUNWAY_TARGET_MONTHS * burn - Number(runway.freeLiquidFunds || 0);
  if (!(kurang > 0)) return null;

  return {
    key: "runway",
    rank: months < 1 ? 1 : 4,
    tone: months < 1 ? "danger" : "warn",
    title: `Dana bebasmu menopang ${months.toLocaleString("id-ID", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} bulan`,
    detail: `Dihitung dari pengeluaran ${uang(
      burn,
      currency,
    )} per bulan. Butuh ${uang(kurang, currency)} lagi untuk mencapai ${RUNWAY_TARGET_MONTHS} bulan.`,
    actionLabel: "Buat target",
    actionTarget: "goal",
    categoryKey: null,
  };
}

function adviceFromGoal(summary, currency) {
  const goal = summary?.goal;
  const cashFlow = summary?.cashFlow;
  if (!goal?.available) return null;

  const kurang = Number(goal.remainingAmount || 0);
  if (!(kurang > 0)) return null;

  const sisaBulanan = cashFlow?.evaluable
    ? Number(cashFlow.netCashFlow || 0)
    : null;

  /* Tanpa arus kas yang terbaca, lama pencapaian tidak bisa dihitung. Targetnya
     tetap ditampilkan dengan sisa nominalnya saja, tanpa menebak kapan. */
  if (sisaBulanan == null || !(sisaBulanan > 0)) {
    return {
      key: "goal",
      rank: 6,
      tone: "info",
      title: `${goal.name} kurang ${uang(kurang, goal.currency || currency)}`,
      detail:
        "Catat pemasukan bulan ini supaya perkiraan kapan target tercapai bisa dihitung.",
      actionLabel: "Kelola target",
      actionTarget: "goal",
      categoryKey: null,
    };
  }

  const bulan = Math.ceil(kurang / sisaBulanan);
  return {
    key: "goal",
    rank: 5,
    tone: "info",
    title: `${goal.name} kurang ${uang(kurang, goal.currency || currency)}`,
    detail: `Dengan sisa ${uang(
      sisaBulanan,
      currency,
    )} per bulan seperti bulan ini, kira-kira ${bulan} bulan lagi.`,
    actionLabel: "Kelola target",
    actionTarget: "goal",
    categoryKey: null,
  };
}

/* Ketika datanya belum cukup untuk menghitung apa pun, yang berguna bukan
   daftar kosong melainkan langkah yang membuat perhitungan jadi mungkin. */
function adviceFromMissingData(summary) {
  const hasil = [];
  if (!summary?.budget?.available) {
    hasil.push({
      key: "need_budget",
      rank: 10,
      tone: "info",
      title: "Belum ada jatah bulan ini",
      detail:
        "Satu batas pengeluaran saja sudah cukup untuk mulai membedakan uang yang aman dipakai dan yang perlu dijaga.",
      actionLabel: "Buat jatah",
      actionTarget: "budget",
      categoryKey: null,
    });
  }
  if (!summary?.cashFlow?.evaluable) {
    hasil.push({
      key: "need_income",
      rank: 11,
      tone: "info",
      title: "Pemasukan bulan ini belum tercatat",
      detail:
        "Rasio menabung dan perkiraan kapan target tercapai keduanya dihitung dari pemasukan.",
      actionLabel: "Catat pemasukan",
      actionTarget: "income",
      categoryKey: null,
    });
  }
  if (!summary?.goal?.available) {
    hasil.push({
      key: "need_goal",
      rank: 12,
      tone: "info",
      title: "Belum ada target",
      detail:
        "Uang yang disisihkan lebih mudah dijaga kalau punya tujuan yang jelas.",
      actionLabel: "Buat target",
      actionTarget: "goal",
      categoryKey: null,
    });
  }
  return hasil;
}

export function buildSavingsAdvice(summary, { limit = 5 } = {}) {
  const currency = summary?.baseCurrency || "IDR";

  const semua = [
    adviceFromPace(summary, currency),
    adviceFromSavingsRatio(summary, currency),
    adviceFromRunway(summary, currency),
    adviceFromGoal(summary, currency),
    ...adviceFromMissingData(summary),
  ].filter(Boolean);

  semua.sort((a, b) => a.rank - b.rank);

  return {
    items: semua.slice(0, limit),
    total: semua.length,
    /* Dipakai untuk membedakan "semua sudah baik" dari "belum ada data". */
    hasAdvice: semua.length > 0,
  };
}
