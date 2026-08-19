function formatRunway(months) {
  if (months == null) return "belum dapat dihitung";
  if (months < 1) {
    const days = Math.max(Math.round(Math.max(months, 0) * 30), 0);
    return days > 0 ? `sekitar ${days} hari` : "belum mencukupi";
  }
  return `sekitar ${months.toLocaleString("id-ID", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} bulan`;
}

export function getControlReadiness(summary) {
  const items = [
    {
      key: "budget",
      label: "Anggaran",
      ready: Boolean(summary?.budget?.available),
    },
    {
      key: "cashFlow",
      label: "Arus kas",
      ready: Boolean(summary?.cashFlow?.evaluable),
    },
    {
      key: "goal",
      label: "Target",
      ready: Boolean(summary?.goal?.available),
    },
  ];

  return {
    items,
    readyCount: items.filter((item) => item.ready).length,
    totalCount: items.length,
  };
}

export function buildControlCoach(summary) {
  const recommendation = summary?.recommendation || {};
  const urgentCodes = new Set([
    "negative_safe_to_spend",
    "category_over",
    "category_projected_over",
    "negative_cash_flow",
  ]);

  if (urgentCodes.has(recommendation.code)) {
    return {
      tone:
        recommendation.code === "category_projected_over"
          ? "warning"
          : "danger",
      eyebrow: "Fokus terbaikmu",
      title: recommendation.title,
      body: recommendation.body,
      why:
        recommendation.target === "budget"
          ? "Menyesuaikan batas lebih awal menjaga kebutuhan penting tetap punya ruang sampai akhir bulan."
          : "Arus kas negatif yang dibiarkan dapat menggerus dana cadangan tanpa terasa.",
      actionLabel:
        recommendation.target === "budget"
          ? "Tinjau anggaran"
          : "Lihat transaksi",
      actionTarget: recommendation.target,
      categoryKey: recommendation.categoryKey || null,
    };
  }

  if (!summary?.budget?.available) {
    return {
      tone: "progress",
      eyebrow: "Langkah pertama",
      title: "Beri setiap rupiah sebuah arah",
      body:
        "Buat satu batas pengeluaran yang realistis agar CUANSYNC dapat membedakan uang yang masih aman dipakai dan uang yang perlu dijaga.",
      why:
        "Anggaran bukan larangan belanja; anggaran membantu keputusan harian tetap sejalan dengan prioritasmu.",
      actionLabel: "Buat anggaran pertama",
      actionTarget: "budget",
      categoryKey: null,
    };
  }

  if (!summary?.cashFlow?.evaluable) {
    return {
      tone: "progress",
      eyebrow: "Lengkapi gambaranmu",
      title: "Ceritakan dari mana uangmu datang",
      body:
        "Catat pemasukan bulan ini agar sisa uang, rasio tabungan, dan kemampuan mencapai target tidak lagi sekadar perkiraan.",
      why:
        "Saldo menunjukkan apa yang kamu punya sekarang; arus kas menjelaskan apakah kebiasaan bulan ini bisa bertahan.",
      actionLabel: "Catat pemasukan",
      actionTarget: "income",
      categoryKey: null,
    };
  }

  if (summary?.runway?.evaluable && summary.runway.months < 3) {
    return {
      tone: summary.runway.months < 1 ? "danger" : "warning",
      eyebrow: "Perkuat perlindunganmu",
      title: "Bangun ruang bernapas untuk hal tak terduga",
      body: `Dana bebasmu saat ini dapat menopang ${formatRunway(summary.runway.months)} pengeluaran. Jadikan tiga bulan sebagai tonggak awal yang dapat disesuaikan dengan kondisimu.`,
      why:
        "Dana cadangan memberi waktu mengambil keputusan tanpa langsung bergantung pada utang ketika pemasukan terganggu.",
      actionLabel: "Buat target dana cadangan",
      actionTarget: "goal",
      categoryKey: null,
    };
  }

  if (!summary?.goal?.available) {
    return {
      tone: "progress",
      eyebrow: "Langkah berikutnya",
      title: "Ubah rencana menjadi target yang nyata",
      body:
        "Pilih satu tujuan yang paling penting, lalu pecah nominal besarnya menjadi progres kecil yang mudah dipantau.",
      why:
        "Target membuat uang yang disisihkan memiliki tujuan dan membantu menjaga motivasi saat prioritas lain muncul.",
      actionLabel: "Buat target pertama",
      actionTarget: "goal",
      categoryKey: null,
    };
  }

  return {
    tone: "safe",
    eyebrow: "Kamu berada di jalur yang baik",
    title: "Fondasi keuanganmu mulai bekerja bersama",
    body:
      "Anggaran, arus kas, dan targetmu sudah terbaca. Lanjutkan kebiasaan mencatat agar saran berikutnya tetap relevan.",
    why:
      "Konsistensi data membantu CUANSYNC mengenali perubahan lebih awal sebelum menjadi masalah besar.",
    actionLabel: "Lihat riwayat bulan ini",
    actionTarget: "history",
    categoryKey: null,
  };
}
