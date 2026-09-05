import { formatCurrency } from "../lib/currency.js";

/* Menyusun kalimat ritme untuk satu kategori jatah.

   getBudgetPace di domain/control.js sudah menghitung semuanya: statusLabel,
   daysUntilLimit, daysEarly, dan projectedSpending. Yang belum ada adalah
   kalimat yang menerjemahkan angka itu jadi akibat yang bisa ditindaklanjuti.
   "Rp 620.000 / Rp 750.000" tidak menjawab pertanyaan yang sebenarnya dicari,
   yaitu apakah ritme ini aman sampai akhir bulan.

   Dipisah ke sini supaya tiap cabangnya bisa diuji tanpa merender komponen. */

/* Nada dipakai untuk memilih warna, jadi namanya mengikuti token yang ada
   ketimbang warna mentah. */
export const PACE_TONES = {
  over: "danger",
  // Jatah yang tepat habis sudah tidak menyisakan apa pun untuk sisa bulan,
  // jadi nadanya sama seriusnya dengan yang sudah terlampaui.
  limit_reached: "danger",
  projected_over: "danger",
  too_fast: "warn",
  near_limit: "warn",
  on_track: "mut",
  no_transactions: "mut",
};

export function getBudgetPaceTone(paceStatus) {
  return PACE_TONES[paceStatus] || "mut";
}

/* Mengembalikan { label, detail }. label adalah kata dari domain, detail
   adalah akibatnya. detail sengaja kosong ketika datanya belum cukup, karena
   menjanjikan "cukup sampai akhir bulan" dari dua transaksi di tanggal 3
   adalah klaim yang tidak bisa dipertanggungjawabkan. */
export function buildBudgetPaceSentence(pace, baseCurrency) {
  if (!pace) return null;

  const label = pace.statusLabel || "";
  const limit = Number(pace.limitAmount || 0);
  const spent = Number(pace.spentAmount || 0);
  const sisa = limit - spent;
  const uang = (nilai) => formatCurrency(Math.abs(Number(nilai) || 0), baseCurrency);

  if (pace.paceStatus === "no_transactions") {
    return { label, detail: "" };
  }

  if (pace.paceStatus === "over") {
    return { label, detail: `lewat ${uang(sisa)}` };
  }

  /* "sisa Rp 0" hanya mengulang labelnya. Yang belum diketahui pembaca adalah
     berapa lama lagi ia harus bertahan tanpa sisa, dan itu yang disampaikan. */
  if (pace.paceStatus === "limit_reached") {
    const sisaHari = Math.max(Number(pace.remainingDays || 0), 0);
    return {
      label,
      detail:
        sisaHari > 0
          ? `tidak ada sisa untuk ${sisaHari} hari lagi`
          : "tepat habis di akhir bulan",
    };
  }

  if (pace.paceStatus === "projected_over") {
    const perkiraan = Number(pace.projectedSpending || 0);
    return {
      label,
      detail: `perkiraan ${uang(perkiraan)} sampai tutup bulan`,
    };
  }

  if (pace.paceStatus === "too_fast") {
    // daysEarly bisa 0 kalau jatahnya justru pas sampai akhir bulan; angka nol
    // tidak memberi tahu apa apa, jadi jatuh ke sisa saldonya.
    const lebihAwal = Number(pace.daysEarly || 0);
    return {
      label,
      detail:
        lebihAwal > 0
          ? `habis ${lebihAwal} hari lebih awal`
          : `sisa ${uang(sisa)}`,
    };
  }

  if (pace.paceStatus === "near_limit") {
    return { label, detail: `sisa ${uang(sisa)}` };
  }

  // on_track. Tanpa data yang cukup, ritmenya belum benar benar terukur.
  if (!pace.enoughPaceData) {
    return { label, detail: "belum cukup data untuk menilai ritme" };
  }
  return { label, detail: `sisa ${uang(sisa)}` };
}
