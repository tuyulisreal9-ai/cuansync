/* Halaman publik CUANSYNC.

   Dua tugas: menentukan alamat aplikasi, dan menghidupkan peraga saat orang
   menggulir ke sana.

   Aturan yang dipegang sepanjang berkas ini: halaman ditulis dalam keadaan
   selesai. Skrip hanya boleh menyembunyikan sesuatu yang memang masih di
   bawah lipatan ketika halaman dibuka, lalu mengembalikannya saat digulir.
   Jadi kalau skrip gagal dimuat, peramban terlalu tua, atau pengguna meminta
   gerak dikurangi, yang tampil tetap halaman lengkap sejak bingkai pertama —
   bukan kotak-kotak kosong yang menunggu animasi. */

/* Alamat aplikasi diambil dari satu meta di kepala halaman, supaya pindah
   domain cukup mengubah satu baris HTML tanpa menyentuh berkas ini.

   Di komputer sendiri alamat itu diabaikan: aplikasinya hidup di porta 5173
   sementara halaman ini di 5174, jadi tautannya menyeberang porta. */
const alamatMeta = document
  .querySelector('meta[name="cuansync-app-url"]')
  ?.content?.trim();
const diLokal =
  location.hostname === "localhost" || location.hostname === "127.0.0.1";
const alamatSiap = Boolean(alamatMeta) && !alamatMeta.startsWith("GANTI");

if (!diLokal && !alamatSiap) {
  console.warn(
    '[cuansync] Alamat aplikasi belum diisi pada <meta name="cuansync-app-url">, jadi tombolnya masih menunjuk ke halaman ini sendiri.',
  );
}

const APP_URL = diLokal
  ? `${location.protocol}//${location.hostname}:5173/`
  : alamatSiap
    ? alamatMeta
    : "/";

document.querySelectorAll("[data-app-link]").forEach((tautan) => {
  tautan.setAttribute("href", APP_URL);
});

/* Garis bawah navbar baru muncul setelah halaman digulir, supaya bagian
   paling atas terbaca sebagai satu bidang utuh. */
const nav = document.getElementById("nav");
if (nav) {
  const perbarui = () => {
    nav.dataset.scrolled = String(window.scrollY > 8);
  };
  perbarui();
  window.addEventListener("scroll", perbarui, { passive: true });
}

const tahun = document.getElementById("tahun");
if (tahun) tahun.textContent = String(new Date().getFullYear());

/* ---- Gerak saat digulir -------------------------------------------------- */

const kurangiGerak = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const bisaGerak = !kurangiGerak && typeof IntersectionObserver === "function";

/* Ambang 0.85 dipilih supaya apa pun yang sudah tersenggol layar saat halaman
   dibuka tidak ikut disembunyikan. Hero tidak pernah dianimasikan sama sekali:
   ia bingkai pertama halaman ini, dan tangkapan layar apa pun harus
   menunjukkannya utuh. */
function diBawahLipatan(el) {
  return el.getBoundingClientRect().top > window.innerHeight * 0.85;
}

function saatMasuk(el, kerjakan) {
  const pengamat = new IntersectionObserver(
    (entri) => {
      for (const satu of entri) {
        if (!satu.isIntersecting) continue;
        pengamat.disconnect();
        kerjakan();
        return;
      }
    },
    { threshold: 0.2, rootMargin: "0px 0px -8% 0px" },
  );
  pengamat.observe(el);
}

/* Kartu, langkah, dan judul bagian naik pelan saat gilirannya tiba. Jedanya
   dihitung dari urutan di dalam induknya, jadi sederet kartu masuk beruntun,
   bukan serentak. */
function siapkanKemunculan() {
  const pilihan =
    ".section__head, .band__head, .band__panel, .demo > .ui, .duo__visual > .ui," +
    " .trio > .ui, .strip__item, .step, .faq, .closing";
  document.querySelectorAll(pilihan).forEach((el) => {
    if (!diBawahLipatan(el)) return;
    el.setAttribute("data-reveal", "");
    el.classList.add("is-hidden");
    saatMasuk(el, () => {
      const sekelompok = [...el.parentElement.children].filter((anak) =>
        anak.hasAttribute("data-reveal"),
      );
      el.style.transitionDelay = `${Math.max(sekelompok.indexOf(el), 0) * 80}ms`;
      el.classList.remove("is-hidden");
    });
  });
}

/* Batang jatah dan batang tabungan tumbuh dari nol. Lebar tujuannya dibaca
   dari gaya sebaris yang sudah ada di HTML, jadi angka di halaman tetap satu
   sumber kebenaran. */
function siapkanBatang() {
  document
    .querySelectorAll(".track span, .split > span, .stat__track span")
    .forEach((batang) => {
      const tujuan = batang.style.width;
      const kartu = batang.closest(".ui, .band__panel");
      if (!tujuan || !kartu || !diBawahLipatan(kartu)) return;
      batang.style.width = "0%";
      saatMasuk(kartu, () => {
        batang.style.width = tujuan;
      });
    });
}

/* Skor kondisi keuangan dihitung naik dari nol. Memakai setInterval, bukan
   bingkai animasi, supaya tetap berjalan di tab yang sedang tidak digambar
   dan tidak berhenti separuh jalan di angka yang salah. */
function hitungNaik(el, teksAkhir) {
  const angka = Number(teksAkhir.replace(/\D/g, ""));
  if (!Number.isFinite(angka) || angka <= 0) {
    el.textContent = teksAkhir;
    return;
  }
  const format = new Intl.NumberFormat("id-ID");
  const mulai = Date.now();
  const durasi = 900;
  const jam = setInterval(() => {
    const maju = Math.min((Date.now() - mulai) / durasi, 1);
    const halus = 1 - (1 - maju) ** 3;
    el.textContent = format.format(Math.round(angka * halus));
    if (maju < 1) return;
    clearInterval(jam);
    el.textContent = teksAkhir;
  }, 16);
}

function siapkanHitungan() {
  document.querySelectorAll("[data-count]").forEach((el) => {
    const wadah = el.closest(".band__panel") || el;
    if (!diBawahLipatan(wadah)) return;
    const teksAkhir = el.textContent.trim();
    el.textContent = "0";
    saatMasuk(wadah, () => hitungNaik(el, teksAkhir));
  });
}

/* Peraga Catat Banyak: teksnya diketik ulang huruf demi huruf, dan tiap kali
   satu baris selesai, transaksinya muncul di kartu sebelah. Inilah yang
   menjelaskan fiturnya tanpa satu kalimat pun tambahan. */
function siapkanKetikan() {
  const kartuTeks = document.querySelector(".demo > .ui");
  const kartuHasil = document.querySelectorAll(".demo > .ui")[1];
  const teksEl = document.querySelector(".typed");
  if (!kartuTeks || !kartuHasil || !teksEl) return;

  const baris = [...kartuHasil.querySelectorAll(".row")];
  const bilah = kartuHasil.querySelector(".check");
  const petunjuk = kartuHasil.querySelector(".ui__hint");
  if (!baris.length || !bilah) return;

  // Sudah terlihat saat halaman dibuka? Biarkan apa adanya.
  if (!diBawahLipatan(kartuTeks) || !diBawahLipatan(kartuHasil)) return;

  const naskah = teksEl.textContent;
  const petunjukAkhir = petunjuk ? petunjuk.textContent : "";
  teksEl.textContent = "";
  [...baris, bilah].forEach((el) => {
    el.setAttribute("data-reveal", "");
    el.classList.add("is-hidden");
  });
  if (petunjuk) petunjuk.textContent = "0 baris terbaca";

  saatMasuk(kartuHasil, () => {
    let ke = 0;
    let tampil = 0;

    const munculkan = (sampai) => {
      while (tampil < sampai && tampil < baris.length) {
        baris[tampil].classList.remove("is-hidden");
        tampil += 1;
        if (petunjuk) petunjuk.textContent = `${tampil} baris terbaca`;
      }
    };

    const tulis = () => {
      ke += 1;
      teksEl.textContent = naskah.slice(0, ke);
      munculkan(naskah.slice(0, ke).split("\n").length - 1);

      if (ke < naskah.length) {
        setTimeout(tulis, 26);
        return;
      }

      // Baris terakhir tidak diakhiri baris baru, jadi ditutup di sini.
      munculkan(baris.length);
      teksEl.classList.remove("is-typing");
      if (petunjuk) petunjuk.textContent = petunjukAkhir;
      setTimeout(() => bilah.classList.remove("is-hidden"), 260);
    };

    teksEl.classList.add("is-typing");
    setTimeout(tulis, 240);
  });
}

if (bisaGerak) {
  siapkanKetikan();
  siapkanBatang();
  siapkanHitungan();
  siapkanKemunculan();
}
