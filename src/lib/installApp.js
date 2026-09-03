/* Pemasangan aplikasi dari dalam Pengaturan.

   Kenyataan yang menentukan seluruh bentuk berkas ini: iOS tidak punya API
   pemasangan sama sekali. Tidak ada yang bisa dipanggil dari JavaScript untuk
   memasang aplikasi ke Layar Utama; Safari mewajibkan pengguna menekan tombol
   Bagikan lalu memilih Tambahkan ke Layar Utama. Jadi tombol yang sama harus
   berperilaku beda: di Android ia benar benar memasang, di iOS ia hanya bisa
   menunjukkan caranya.

   Semua peramban di iOS memakai WebKit, tetapi hanya Safari yang punya menu
   Tambahkan ke Layar Utama. Chrome atau Firefox di iPhone tidak bisa, dan
   pengguna perlu diberi tahu untuk membuka lewat Safari lebih dulu. */

export const INSTALL_STATE = {
  TERPASANG: "terpasang",
  SIAP: "siap",
  PANDUAN: "panduan",
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
  const ios = /iPad|iPhone|iPod/.test(ua) || iPadMenyamar;
  const android = /Android/.test(ua);

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
  if (platform?.ios && platform.iosBrowser && platform.iosBrowser !== "safari") {
    const nama = NAMA_PERAMBAN[platform.iosBrowser] || "peramban ini";
    return {
      judul: `Buka lewat Safari dulu`,
      catatan: `${nama} di iPhone tidak punya menu Tambahkan ke Layar Utama. Menu itu hanya ada di Safari.`,
      langkah: [
        "Salin alamat halaman ini.",
        "Buka Safari, lalu tempel alamatnya.",
        "Ketuk tombol Bagikan di bilah bawah.",
        "Pilih Tambahkan ke Layar Utama.",
      ],
    };
  }

  if (platform?.ios) {
    return {
      judul: "Pasang lewat Safari",
      catatan:
        "iOS tidak mengizinkan aplikasi memasang dirinya sendiri, jadi langkahnya dilakukan dari menu Safari.",
      langkah: [
        "Ketuk tombol Bagikan di bilah bawah Safari.",
        "Gulir daftarnya, lalu pilih Tambahkan ke Layar Utama.",
        "Ketuk Tambah di pojok kanan atas.",
      ],
    };
  }

  if (platform?.android) {
    return {
      judul: "Pasang dari menu peramban",
      catatan:
        "Peramban ini belum menawarkan pemasangan otomatis. Menunya tetap tersedia secara manual.",
      langkah: [
        "Ketuk menu tiga titik di pojok kanan atas.",
        "Pilih Instal aplikasi atau Tambahkan ke layar utama.",
        "Konfirmasi pemasangan.",
      ],
    };
  }

  return {
    judul: "Pasang dari bilah alamat",
    catatan:
      "Di komputer, ikon pemasangan muncul di ujung kanan bilah alamat ketika peramban mendukungnya.",
    langkah: [
      "Cari ikon pasang di ujung kanan bilah alamat.",
      "Kalau tidak ada, buka menu peramban lalu pilih Instal.",
    ],
  };
}

/* Chrome menembakkan beforeinstallprompt sekali, dan kalau tidak dicegat,
   kesempatan memanggil prompt() hilang. Karena itu pendengarnya dipasang saat
   modul dimuat, jauh sebelum halaman Pengaturan dibuka. */
let promptTertunda = null;
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
    beriTahu();
  });
  window.addEventListener("appinstalled", () => {
    promptTertunda = null;
    beriTahu();
  });
}

export function canPromptInstall() {
  return promptTertunda !== null;
}

export function subscribeInstallPrompt(listener) {
  pendengar.add(listener);
  return () => pendengar.delete(listener);
}

/* Mengembalikan "accepted", "dismissed", atau null bila tidak ada prompt yang
   bisa dipakai. Setelah dipakai, prompt tidak bisa dipanggil dua kali. */
export async function promptInstall() {
  if (!promptTertunda) return null;
  const event = promptTertunda;
  promptTertunda = null;
  beriTahu();
  try {
    await event.prompt();
    const { outcome } = await event.userChoice;
    return outcome;
  } catch {
    return null;
  }
}

export function getInstallState({ standalone = false, nativeApp = false } = {}) {
  if (nativeApp || standalone) return INSTALL_STATE.TERPASANG;
  return canPromptInstall() ? INSTALL_STATE.SIAP : INSTALL_STATE.PANDUAN;
}
