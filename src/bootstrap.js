function renderBootstrapError(error) {
  const root = document.getElementById("root");
  const details = error?.message || String(error || "Masalah tidak diketahui");

  root.innerHTML = `
    <main class="boot-shell">
      <section class="boot-card">
        <div class="boot-badge">Aplikasi bermasalah</div>
        <h1 class="boot-title">Aplikasi belum berhasil dimuat.</h1>
        <p class="boot-copy">
          Penyebab paling umum di project ini adalah dependensi eksternal tidak bisa diakses,
          terutama <code>esm.sh</code> untuk React dan <code>cdn.tailwindcss.com</code> untuk Tailwind.
        </p>
        <div class="boot-panel">
          <p class="boot-label">Detail masalah</p>
          <pre class="boot-pre">${escapeHtml(details)}</pre>
        </div>
        <div class="boot-panel">
          <p class="boot-label">Yang bisa dilakukan sekarang</p>
          <ol class="boot-list">
            <li>1. Pastikan browser bisa mengakses internet dan CDN eksternal.</li>
            <li>2. Muat ulang halaman setelah koneksi tersedia.</li>
            <li>3. Jika mau, saya bisa lanjut ubah project ini jadi versi lokal penuh tanpa CDN.</li>
          </ol>
        </div>
      </section>
    </main>
  `;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

import("./main.js").catch((error) => {
  console.error("Aplikasi gagal dimuat", error);
  renderBootstrapError(error);
});
