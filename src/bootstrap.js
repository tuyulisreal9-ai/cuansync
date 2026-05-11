function renderBootstrapError(error) {
  const root = document.getElementById("root");
  const details = error?.message || String(error || "Unknown error");

  root.innerHTML = `
    <main class="boot-shell">
      <section class="boot-card">
        <div class="boot-badge">App Load Error</div>
        <h1 class="boot-title">Aplikasi belum berhasil dimuat.</h1>
        <p class="boot-copy">
          Penyebab paling umum di project ini adalah dependency eksternal tidak bisa diakses,
          terutama <code>esm.sh</code> untuk React dan <code>cdn.tailwindcss.com</code> untuk Tailwind.
        </p>
        <div class="boot-panel">
          <p class="boot-label">Detail error</p>
          <pre class="boot-pre">${escapeHtml(details)}</pre>
        </div>
        <div class="boot-panel">
          <p class="boot-label">Yang bisa dilakukan sekarang</p>
          <ol class="boot-list">
            <li>1. Pastikan browser bisa mengakses internet dan CDN eksternal.</li>
            <li>2. Refresh halaman setelah koneksi tersedia.</li>
            <li>3. Jika mau, saya bisa lanjut ubah project ini jadi versi fully local tanpa dependency CDN.</li>
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
  console.error("Failed to load app", error);
  renderBootstrapError(error);
});
