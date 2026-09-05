import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { formatRelativeTime } from "../src/lib/dates.js";

const NOW = new Date("2026-09-02T17:00:00");
const pada = (iso) => formatRelativeTime(new Date(iso), NOW);

test("waktu relatif memakai satuan yang paling cepat dibaca", () => {
  assert.equal(pada("2026-09-02T16:59:30"), "baru saja");
  assert.equal(pada("2026-09-02T16:55:00"), "5 menit lalu");
  assert.equal(pada("2026-09-02T15:00:00"), "2 jam lalu");
  assert.equal(pada("2026-09-02T07:00:00"), "10 jam lalu");
});

test("hari kalender diperiksa sebelum selisih jam", () => {
  // Kemarin malam berjarak 21 jam dari sore ini. "21 jam lalu" menuntut
  // pembaca menghitung sendiri bahwa itu kemarin.
  assert.equal(pada("2026-09-01T20:00:00"), "kemarin");
  // Lewat sehari, tanggal lebih berguna daripada hitungan jam yang membesar.
  assert.equal(pada("2026-08-30T10:00:00"), "30 Agu");
});

test("jam perangkat yang tertinggal tidak menghasilkan waktu negatif", () => {
  // Stempel server bisa sedikit di depan jam perangkat.
  assert.equal(pada("2026-09-02T17:00:30"), "baru saja");
  assert.equal(pada("2026-09-02T17:05:00"), "baru saja");
});

test("nilai yang bukan tanggal menghasilkan teks kosong, bukan NaN", () => {
  assert.equal(formatRelativeTime("bukan tanggal", NOW), "");
  assert.equal(formatRelativeTime(null, NOW), "");
  assert.equal(formatRelativeTime(undefined, NOW), "");
});

test("baris aktivitas desktop menyebut kategori, dompet, dan kapan", async () => {
  const home = await readFile(
    new URL("../src/components/home/HomeDashboardPage.js", import.meta.url),
    "utf8",
  );

  // Transaksi hanya menyimpan id dompet, jadi namanya dicari lewat peta.
  assert.match(home, /accountNames\[transaction\.source_account_id\]/);
  assert.match(home, /getTransactionCategoryLabel\(transaction\)/);
  assert.match(home, /formatRelativeTime\(transaction\.occurred_at\)/);

  // Kode mata uang saja tidak memberi tahu apa apa, jadi tidak ikut dibawa.
  assert.match(home, /\/\^\[A-Z\]\{3\}\$\/\.test\(amount\.secondary/);

  // Ponsel tetap memakai keterangan ringkas yang lama.
  assert.match(home, /<span className="lg:hidden">/);
  assert.match(home, /<span className="hidden lg:inline">\$\{konteks\}<\/span>/);
});

test("jam tidak boleh terbaca sebagai tahun", async () => {
  const { formatDateTime, formatShortDateTime, formatShortTime } = await import(
    "../src/lib/dates.js"
  );
  const sore = "2026-09-04T20:17:00";

  /* Locale Indonesia memisahkan jam dengan titik, sehingga "04 Sep, 20.17"
     terbaca sebagai tanggal bertahun 2017. Titik dua tidak pernah muncul pada
     penulisan tahun, jadi bentuk itulah yang dipakai di semua tampilan jam. */
  assert.equal(formatShortDateTime(sore), "04 Sep, 20:17");
  assert.equal(formatShortTime(sore), "20:17");
  assert.match(formatDateTime(sore), /20:17$/);

  for (const hasil of [
    formatShortDateTime(sore),
    formatShortTime(sore),
    formatDateTime(sore),
  ]) {
    assert.doesNotMatch(
      hasil,
      /\d\.\d/,
      `jam masih memakai titik dan mudah dikira tahun: ${hasil}`,
    );
  }

  // Tanggal tak valid tidak boleh bocor sebagai "Invalid Date" ke layar.
  assert.equal(formatShortDateTime("bukan tanggal"), "");
  assert.equal(formatShortTime(undefined), "");
  assert.equal(formatDateTime("bukan tanggal"), "");
});

test("tenggat tanpa jam tetap membuang tengah malam", async () => {
  const { formatDateTime } = await import("../src/lib/dates.js");
  const [wealth, planning] = await Promise.all([
    readFile(
      new URL("../src/components/assets/WealthGoalsPage.js", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/components/budget/TargetPlanningSection.js",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  /* Ketiga pemanggil membuang jam tengah malam lewat pencocokan untaian.
     Kalau pemisah jam berubah tanpa memperbarui untaian ini, tenggat akan
     muncul sebagai "31 Des 2026, 00:00". */
  const sumber = wealth + planning;
  const untaianPembuang = (sumber.match(/", 00:00"/g) || []).length;
  assert.equal(untaianPembuang, 3, "ketiga pemanggil harus diperbarui");
  assert.doesNotMatch(sumber, /", 00\.00"/, "masih ada untaian pemisah lama");

  // Yang dibuang harus sama persis dengan yang dihasilkan formatter.
  assert.ok(
    formatDateTime("2026-12-31T00:00:00").endsWith(", 00:00"),
    "bentuk tengah malam tidak lagi cocok dengan untaian pembuangnya",
  );
  assert.equal(
    `Tenggat ${formatDateTime("2026-12-31T00:00:00")}`.replace(", 00:00", ""),
    "Tenggat 31 Des 2026",
  );
});
