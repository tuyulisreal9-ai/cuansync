/* Pemasangan hanya dapat ditawarkan ketika peramban memberi prompt.
   Tidak adanya prompt bukan bukti bahwa perangkat tidak didukung. Modul ini
   dimuat langsung oleh bootstrap, sebelum bundle aplikasi/Pengaturan. */

export const INSTALL_STATE = {
  TERPASANG: "terpasang",
  SIAP: "siap",
  PANDUAN: "panduan",
  KONFIRMASI: "konfirmasi",
  DISETUJUI: "disetujui",
  DIBATALKAN: "dibatalkan",
  GAGAL: "gagal",
};

/* Dipisah dari window supaya tiap cabang bisa diuji tanpa peramban. */
export function detectInstallPlatform({
  userAgent = "",
  platform = "",
  maxTouchPoints = 0,
} = {}) {
  const ua = String(userAgent);

  /* iPadOS 13 ke atas melaporkan dirinya sebagai Macintosh. Yang membedakan
     dari Mac sungguhan adalah adanya titik sentuh. */
  const iPadMenyamar = platform === "MacIntel" && maxTouchPoints > 1;
  const android = /Android/i.test(ua);
  const ios = !android && (/iPad|iPhone|iPod/i.test(ua) || iPadMenyamar);

  let iosBrowser = null;
  if (ios) {
    if (/CriOS/.test(ua)) iosBrowser = "chrome";
    else if (/FxiOS/.test(ua)) iosBrowser = "firefox";
    else if (/EdgiOS/.test(ua)) iosBrowser = "edge";
    else if (/OPiOS|OPT\//.test(ua)) iosBrowser = "opera";
    else iosBrowser = "safari";
  }

  return { ios, android, iosBrowser, desktop: !ios && !android };
}

const NAMA_PERAMBAN = {
  chrome: "Chrome",
  firefox: "Firefox",
  edge: "Edge",
  opera: "Opera",
};

/* Langkah yang ditampilkan ketika pemasangan tidak bisa dijalankan sendiri
   oleh aplikasi. Dipisah supaya kalimatnya bisa diuji tanpa merender apa pun. */
export function getInstallGuide(platform) {
  if (platform?.ios && platform.iosBrowser === "chrome") {
    return {
      judul: "Pasang lewat Chrome di iPhone/iPad",
      catatan: "Di Chrome untuk iPhone/iPad, pemasangan dilakukan melalui menu Bagikan.",
      langkah: [
        "Ketuk Bagikan di sebelah bilah alamat Chrome.",
        "Pilih Tambahkan ke Layar Utama.",
        "Periksa nama CUANSYNC, lalu ketuk Tambah.",
      ],
      bantuan: "Jika pilihan itu tidak ada, buka alamat CUANSYNC di Safari, lalu pilih Bagikan → Tambahkan ke Layar Utama.",
    };
  }

  if (platform?.ios && platform.iosBrowser && platform.iosBrowser !== "safari") {
    const nama = NAMA_PERAMBAN[platform.iosBrowser] || "peramban ini";
    return {
      judul: "Pasang lewat Safari",
      catatan: `Sedang memakai ${nama} di iPhone/iPad? Jika menu pemasangan tidak tersedia, gunakan Safari.`,
      langkah: [
        "Salin alamat halaman ini.",
        "Buka Safari, lalu tempel alamatnya.",
        "Ketuk tombol Bagikan di bilah bawah.",
        "Pilih Tambahkan ke Layar Utama.",
      ],
      bantuan: "Jika pilihan Tambahkan ke Layar Utama belum terlihat di Safari, periksa Edit Tindakan pada menu Bagikan.",
    };
  }

  if (platform?.ios) {
    return {
      judul: "Pasang lewat Safari",
      catatan:
        "iOS tidak mengizinkan aplikasi memasang dirinya sendiri, jadi langkahnya dilakukan dari menu Safari.",
      langkah: [
        "Buka menu Safari bila perlu, lalu ketuk Bagikan.",
        "Gulir daftarnya, lalu pilih Tambahkan ke Layar Utama.",
        "Ketuk Tambah di pojok kanan atas.",
      ],
      bantuan: "Jika pilihan Tambahkan ke Layar Utama belum terlihat, periksa Edit Tindakan pada menu Bagikan.",
    };
  }

  if (platform?.android) {
    return {
      judul: "Pasang dari menu peramban",
      catatan:
        "Di Android, pemasangan bergantung pada peramban. Tidak adanya tombol Pasang belum tentu berarti HP tidak didukung.",
      langkah: [
        "Buka alamat CUANSYNC langsung di Chrome, bukan di dalam WhatsApp/Instagram atau mode samaran.",
        "Ketuk menu ⋮. Cari Instal aplikasi, Instal dan buat pintasan, atau Tambahkan ke layar utama; nama menu bisa berbeda.",
        "Jika pilihan Instal tersedia, pilih lalu ikuti konfirmasi peramban.",
      ],
      bantuan: "Tidak menemukan menunya? Cek apakah CUANSYNC sudah ada di layar utama/daftar aplikasi. Jika belum, perbarui Chrome bila tersedia dan buka ulang situs. Jika tetap tidak tersedia, CUANSYNC tetap dapat digunakan lewat web; pemasangan tidak bisa dipaksa oleh situs.",
    };
  }

  return {
    judul: "Pasang dari bilah alamat",
    catatan:
      "Di komputer, ikon pemasangan muncul di ujung kanan bilah alamat ketika peramban mendukungnya.",
    langkah: [
      "Cari ikon pasang di ujung kanan bilah alamat.",
      "Kalau tidak ada, periksa pilihan pemasangan di menu peramban; nama dan ketersediaannya bisa berbeda.",
    ],
    bantuan: "Jika menunya tidak tersedia, coba Chrome atau Edge terbaru yang didukung perangkat. CUANSYNC tetap bisa digunakan lewat web tanpa dipasang.",
  };
}

/* Chrome menembakkan beforeinstallprompt sekali, dan kalau tidak dicegat,
   kesempatan memanggil prompt() hilang. Karena itu pendengarnya dipasang saat
   modul dimuat, jauh sebelum halaman Pengaturan dibuka. */
let promptTertunda = null;
let statusPemasangan = INSTALL_STATE.PANDUAN;
let sedangMeminta = false;
// Session-only evidence: persistent storage would become stale after uninstall.
let terpasangDiSesiIni = false;
const pendengar = new Set();

function beriTahu() {
  pendengar.forEach((fn) => {
    try {
      fn();
    } catch {
      /* Satu pendengar yang gagal tidak boleh menghentikan sisanya. */
    }
  });
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    promptTertunda = event;
    terpasangDiSesiIni = false;
    statusPemasangan = INSTALL_STATE.PANDUAN;
    beriTahu();
  });
  window.addEventListener("appinstalled", () => {
    promptTertunda = null;
    terpasangDiSesiIni = true;
    beriTahu();
  });
}

export function canPromptInstall() {
  return promptTertunda !== null && !sedangMeminta && !terpasangDiSesiIni;
}

export function subscribeInstallPrompt(listener) {
  pendengar.add(listener);
  return () => pendengar.delete(listener);
}

/* Mengembalikan "accepted", "dismissed", atau null bila tidak ada prompt yang
   bisa dipakai. Setelah dipakai, prompt tidak bisa dipanggil dua kali. */
export async function promptInstall() {
  if (!canPromptInstall()) return null;
  const event = promptTertunda;
  promptTertunda = null;
  sedangMeminta = true;
  beriTahu();
  try {
    await event.prompt();
    const { outcome } = await event.userChoice;
    statusPemasangan = outcome === "accepted"
      ? INSTALL_STATE.DISETUJUI
      : INSTALL_STATE.DIBATALKAN;
    return outcome;
  } catch {
    statusPemasangan = INSTALL_STATE.GAGAL;
    return null;
  } finally {
    sedangMeminta = false;
    beriTahu();
  }
}

export function getInstallState({ standalone = false, nativeApp = false } = {}) {
  if (nativeApp || standalone || terpasangDiSesiIni) return INSTALL_STATE.TERPASANG;
  if (sedangMeminta) return INSTALL_STATE.KONFIRMASI;
  return canPromptInstall() ? INSTALL_STATE.SIAP : statusPemasangan;
}

export function getInstallPresentation(state, platform = {}) {
  const common = { label: "Pasang aplikasi", value: "Panduan", disabled: false };
  switch (state) {
    case INSTALL_STATE.TERPASANG:
      return {
        ...common, label: "Aplikasi sudah terpasang", value: "Terpasang", disabled: true,
        helper: "Buka dari ikon CUANSYNC",
        detail: "Pemasangan terdeteksi. Buka CUANSYNC dari layar utama atau daftar aplikasi.",
      };
    case INSTALL_STATE.SIAP:
      return {
        ...common, value: "Pasang", helper: "Siap dipasang dari peramban ini",
        detail: "Peramban sudah menyediakan pemasangan. Ketuk Pasang untuk melanjutkan.",
      };
    case INSTALL_STATE.KONFIRMASI:
      return {
        ...common, value: "Menunggu", disabled: true, helper: "Selesaikan dialog peramban",
        detail: "Konfirmasi atau batalkan pemasangan pada dialog peramban.",
      };
    case INSTALL_STATE.DISETUJUI:
      return {
        ...common, value: "Cek", helper: "Disetujui; cek ikon di layar utama",
        detail: "Permintaan pemasangan disetujui. Peramban belum mengirim konfirmasi selesai; cek ikon CUANSYNC di layar utama atau daftar aplikasi.",
      };
    case INSTALL_STATE.DIBATALKAN:
      return {
        ...common, helper: "Dibatalkan; bisa lewat menu peramban",
        detail: "Pemasangan tadi dibatalkan. Gunakan menu peramban, atau ketuk Pasang jika peramban menawarkan pemasangan lagi.",
      };
    case INSTALL_STATE.GAGAL:
      return {
        ...common, helper: "Dialog pemasangan gagal dibuka",
        detail: "Dialog pemasangan tidak berhasil. Coba dari menu peramban atau muat ulang halaman. CUANSYNC tetap bisa digunakan lewat web.",
      };
    default:
      return {
        ...common,
        helper: platform.ios ? "Pasang lewat menu Bagikan" : "Belum ditawarkan oleh peramban",
        detail: platform.ios
          ? "Gunakan menu Bagikan untuk menambahkan CUANSYNC ke layar utama."
          : "Tombol Pasang akan tersedia jika peramban memberikan izin pemasangan. Sambil menunggu, periksa pilihan pada menu peramban.",
      };
  }
}
