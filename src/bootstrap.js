function renderBootstrapError(error) {
  const root = document.getElementById("root");
  const details = error?.message || String(error || "Masalah tidak diketahui");

  root.innerHTML = `
    <main class="boot-shell">
      <section class="boot-card">
        <div class="boot-badge">Aplikasi bermasalah</div>
        <h1 class="boot-title">Aplikasi belum berhasil dimuat.</h1>
        <p class="boot-copy">
          Aplikasi tidak dapat memuat bundle lokal atau terhubung ke layanan data.
        </p>
        <div class="boot-panel">
          <p class="boot-label">Detail masalah</p>
          <pre class="boot-pre">${escapeHtml(details)}</pre>
        </div>
        <div class="boot-panel">
          <p class="boot-label">Yang bisa dilakukan sekarang</p>
          <ol class="boot-list">
            <li>1. Muat ulang halaman untuk mencoba kembali.</li>
            <li>2. Pastikan proses build atau development server masih berjalan.</li>
            <li>3. Periksa detail masalah di atas bila kendala tetap muncul.</li>
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
