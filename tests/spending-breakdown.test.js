import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  UNCATEGORIZED_KEY,
  buildSpendingBreakdown,
} from "../src/domain/spendingBreakdown.js";

const BULAN = "2026-09";

function belanja(id, category, amount, occurred_at = "2026-09-02T10:00:00Z") {
  return {
    id,
    type: "expense",
    occurred_at,
    category,
    currency: "IDR",
    base_currency: "IDR",
    amount,
    base_amount: amount,
  };
}

const jatah = (categoryKey) => ({ categoryKey, baseCurrency: "IDR" });

test("belanja dikelompokkan per kategori dengan porsinya", () => {
  const hasil = buildSpendingBreakdown({
    transactions: [
      belanja("a", "Makan", 1200000),
      belanja("b", "Transportasi", 600000),
      belanja("c", "Makan", 200000),
    ],
    budgetInsights: [jatah("makan")],
    baseCurrency: "IDR",
    monthKey: BULAN,
  });

  assert.equal(hasil.total, 2000000);
  assert.equal(hasil.rows[0].label, "Makan Harian");
  assert.equal(hasil.rows[0].amount, 1400000);
  assert.equal(hasil.rows[0].count, 2);
  assert.equal(hasil.rows[0].share, 0.7);
  assert.equal(hasil.rows[0].hasBudget, true);
  assert.equal(hasil.rows[1].hasBudget, false);
});

test("kategori tanpa jatah diringkas terpisah", () => {
  // Inilah titik butanya: BudgetSection hanya membaca budgetInsights, jadi
  // belanja di kategori tanpa jatah tidak terlihat sama sekali di halaman.
  const hasil = buildSpendingBreakdown({
    transactions: [
      belanja("a", "Makan", 1200000),
      belanja("b", "Transportasi", 620000),
      belanja("c", "Hiburan", 530000),
    ],
    budgetInsights: [jatah("makan")],
    baseCurrency: "IDR",
    monthKey: BULAN,
  });

  assert.equal(hasil.unbudgeted.count, 2);
  assert.equal(hasil.unbudgeted.amount, 1150000);
  assert.ok(Math.abs(hasil.unbudgeted.share - 1150000 / 2350000) < 1e-9);
});

test("belanja tanpa kategori tidak dianggap punya jatah", () => {
  // computeBudgetInsights menyaring Boolean(item.category), jadi belanja tanpa
  // kategori memang tidak pernah masuk hitungan jatah mana pun. Menandainya
  // sebagai berjatah akan menyembunyikan uang yang tidak terpantau.
  const hasil = buildSpendingBreakdown({
    transactions: [belanja("a", null, 90000), belanja("b", "Makan", 10000)],
    budgetInsights: [jatah("lainnya"), jatah("makan")],
    baseCurrency: "IDR",
    monthKey: BULAN,
  });

  const tanpa = hasil.rows.find((row) => row.key === UNCATEGORIZED_KEY);
  assert.ok(tanpa, "baris tanpa kategori harus ada");
  assert.equal(tanpa.label, "Tanpa kategori");
  assert.equal(tanpa.hasBudget, false);
  assert.equal(hasil.unbudgeted.amount, 90000);
});

test("hanya bulan yang diminta dan hanya pengeluaran yang dihitung", () => {
  const hasil = buildSpendingBreakdown({
    transactions: [
      belanja("a", "Makan", 100000),
      belanja("b", "Makan", 999999, "2026-08-15T10:00:00Z"),
      {
        id: "c",
        type: "income",
        occurred_at: "2026-09-02T10:00:00Z",
        currency: "IDR",
        base_currency: "IDR",
        amount: 5000000,
      },
    ],
    budgetInsights: [],
    baseCurrency: "IDR",
    monthKey: BULAN,
  });

  assert.equal(hasil.total, 100000);
});

test("kategori di luar batas tampil diringkas, bukan hilang", () => {
  const banyak = [
    belanja("a", "Makan", 800000),
    belanja("b", "Transportasi", 700000),
    belanja("c", "Hiburan", 600000),
    belanja("d", "Kesehatan", 500000),
    belanja("e", "Tagihan", 400000),
    belanja("f", "Belanja", 300000),
    belanja("g", "Tempat Tinggal", 200000),
    belanja("h", "Lainnya", 100000),
  ];
  const hasil = buildSpendingBreakdown({
    transactions: banyak,
    budgetInsights: [],
    baseCurrency: "IDR",
    monthKey: BULAN,
    limit: 6,
  });

  assert.equal(hasil.rows.length, 6);
  assert.equal(hasil.rest.count, 2);
  assert.equal(hasil.rest.amount, 300000);
  // Totalnya tetap utuh walau barisnya dipotong.
  const jumlahBaris = hasil.rows.reduce((sum, row) => sum + row.amount, 0);
  assert.equal(jumlahBaris + hasil.rest.amount, hasil.total);
});

test("tanpa pengeluaran, hasData false dan tidak ada pembagian nol", () => {
  const hasil = buildSpendingBreakdown({
    transactions: [],
    budgetInsights: [],
    baseCurrency: "IDR",
    monthKey: BULAN,
  });

  assert.equal(hasil.hasData, false);
  assert.equal(hasil.total, 0);
  assert.deepEqual(hasil.rows, []);
  assert.equal(hasil.unbudgeted.share, 0);
  assert.ok(Number.isFinite(hasil.unbudgeted.share));
});

test("dipanggil tanpa argumen sama sekali tetap aman", () => {
  const hasil = buildSpendingBreakdown();
  assert.equal(hasil.hasData, false);
  assert.equal(hasil.total, 0);
});

test("rincian memakai valuasi yang sama dengan baris jatah", async () => {
  const sumber = await readFile(
    new URL("../src/domain/spendingBreakdown.js", import.meta.url),
    "utf8",
  );

  // metrics.categoryBreakdown menilai valas dengan kurs saat ini, sedangkan
  // baris jatah memakai kurs historis. Ditaruh berdampingan dengan dua cara
  // hitung, kategori yang sama akan tampil dua nilai dan itu terbaca sebagai
  // bug, bukan dua sudut pandang.
  assert.match(sumber, /resolveBudgetActivityAmount/);
  assert.match(sumber, /getBudgetCategoryKey/);
  assert.doesNotMatch(sumber, /resolveTransactionCurrentBaseValue/);
});
