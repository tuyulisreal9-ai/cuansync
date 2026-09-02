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
