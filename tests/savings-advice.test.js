import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  RUNWAY_TARGET_MONTHS,
  SAVINGS_RATIO_BENCHMARK,
  buildSavingsAdvice,
} from "../src/domain/savingsAdvice.js";
import { formatCurrency } from "../src/lib/currency.js";

/* Intl menyisipkan spasi tak-putus setelah "Rp", jadi ekspektasi dirakit
   lewat formatCurrency ketimbang mengunci karakter pemisahnya. */
const rp = (nilai) => formatCurrency(nilai, "IDR");

function ringkasan(ubah = {}) {
  return {
    baseCurrency: "IDR",
    monthMeta: { elapsedDays: 10, remainingDays: 20, daysInMonth: 30 },
    budget: { available: true, attentionCategories: [] },
    cashFlow: { evaluable: true, savingsRatio: 0.35, income: 10000000, netCashFlow: 3500000 },
    runway: { evaluable: true, months: 6, monthlyBurn: 5000000, freeLiquidFunds: 30000000 },
    goal: { available: true, name: "Motor", remainingAmount: 0, currency: "IDR" },
    ...ubah,
  };
}

const cari = (hasil, key) => hasil.items.find((item) => item.key === key);

test("kategori yang ritmenya terlalu cepat menyebut potongan harian", () => {
  const hasil = buildSavingsAdvice(
    ringkasan({
      budget: {
        available: true,
        attentionCategories: [
          {
            categoryLabel: "Transportasi",
            categoryKey: "transportasi",
            spentAmount: 600000,
            remainingAmount: 150000,
            paceStatus: "too_fast",
          },
        ],
      },
    }),
  );

  const item = cari(hasil, "category_pace");
  assert.ok(item, "saran ritme harus muncul");
  // Ritme 600.000/10 hari = 60.000. Jatah sisa 150.000/20 hari = 7.500.
  assert.ok(item.detail.includes(rp(60000)), item.detail);
  assert.ok(item.detail.includes(rp(52500)), item.detail);
});

test("kategori yang sudah lewat batas tidak disuruh mengurangi harian", () => {
  // Uangnya sudah terpakai. "Kurangi sekian per hari" tidak mengembalikan
  // apa pun, jadi yang jujur adalah menyebut selisih dan asal tambalannya.
  const hasil = buildSavingsAdvice(
    ringkasan({
      budget: {
        available: true,
        attentionCategories: [
          {
            categoryLabel: "Transportasi",
            categoryKey: "transportasi",
            spentAmount: 900000,
            remainingAmount: -150000,
            paceStatus: "over",
          },
        ],
      },
    }),
  );

  const item = cari(hasil, "category_over");
  assert.ok(item, "saran lewat batas harus muncul");
  assert.equal(item.rank, 1);
  assert.ok(item.title.includes(rp(150000)), item.title);
  assert.doesNotMatch(item.detail, /per hari/);
});

test("selisih rasio menabung dihitung dari pemasukan sungguhan", () => {
  const hasil = buildSavingsAdvice(
    ringkasan({
      cashFlow: { evaluable: true, savingsRatio: 0.12, income: 11750000, netCashFlow: 1410000 },
    }),
  );

  const item = cari(hasil, "savings_ratio");
  assert.ok(item);
  assert.match(item.title, /12%/);
  // (0,20 - 0,12) x 11.750.000 = 940.000
  assert.ok(item.detail.includes(rp(940000)), item.detail);
});

test("rasio yang sudah mencapai acuan tidak memunculkan saran", () => {
  const hasil = buildSavingsAdvice(
    ringkasan({
      cashFlow: {
        evaluable: true,
        savingsRatio: SAVINGS_RATIO_BENCHMARK,
        income: 10000000,
        netCashFlow: 2000000,
      },
    }),
  );
  assert.equal(cari(hasil, "savings_ratio"), undefined);
});

test("kekurangan dana cadangan dihitung dari pengeluaran bulanan", () => {
  const hasil = buildSavingsAdvice(
    ringkasan({
      runway: { evaluable: true, months: 1.4, monthlyBurn: 5000000, freeLiquidFunds: 7000000 },
    }),
  );

  const item = cari(hasil, "runway");
  assert.ok(item);
  // 3 x 5.000.000 - 7.000.000 = 8.000.000
  assert.ok(item.detail.includes(rp(RUNWAY_TARGET_MONTHS * 5000000 - 7000000)), item.detail);
  assert.match(item.title, /1,4 bulan/);
});

test("dana bebas di bawah satu bulan naik jadi prioritas teratas", () => {
  const hasil = buildSavingsAdvice(
    ringkasan({
      runway: { evaluable: true, months: 0.4, monthlyBurn: 5000000, freeLiquidFunds: 2000000 },
    }),
  );
  const item = cari(hasil, "runway");
  assert.equal(item.rank, 1);
  assert.equal(item.tone, "danger");
});

test("perkiraan kapan target tercapai butuh arus kas yang terbaca", () => {
  const denganArusKas = buildSavingsAdvice(
    ringkasan({
      cashFlow: { evaluable: true, savingsRatio: 0.35, income: 10000000, netCashFlow: 1410000 },
      goal: { available: true, name: "Motor", remainingAmount: 8000000, currency: "IDR" },
    }),
  );
  // 8.000.000 / 1.410.000 = 5,67 -> 6 bulan
  assert.match(cari(denganArusKas, "goal").detail, /6 bulan lagi/);

  const tanpaArusKas = buildSavingsAdvice(
    ringkasan({
      cashFlow: { evaluable: false },
      goal: { available: true, name: "Motor", remainingAmount: 8000000, currency: "IDR" },
    }),
  );
  // Tanpa arus kas, jangan menebak kapan.
  assert.doesNotMatch(cari(tanpaArusKas, "goal").detail, /bulan lagi/);
});

test("saran diurutkan berdasarkan kepentingan", () => {
  const hasil = buildSavingsAdvice(
    ringkasan({
      budget: {
        available: true,
        attentionCategories: [
          {
            categoryLabel: "Transportasi",
            categoryKey: "transportasi",
            spentAmount: 900000,
            remainingAmount: -150000,
            paceStatus: "over",
          },
        ],
      },
      cashFlow: { evaluable: true, savingsRatio: 0.12, income: 11750000, netCashFlow: 1410000 },
      runway: { evaluable: true, months: 1.4, monthlyBurn: 5000000, freeLiquidFunds: 7000000 },
      goal: { available: true, name: "Motor", remainingAmount: 8000000, currency: "IDR" },
    }),
  );

  const urutan = hasil.items.map((item) => item.key);
  assert.deepEqual(urutan.slice(0, 3), ["category_over", "savings_ratio", "runway"]);
  const peringkat = hasil.items.map((item) => item.rank);
  assert.deepEqual([...peringkat].sort((a, b) => a - b), peringkat);
});

test("data yang belum lengkap memberi langkah, bukan daftar kosong", () => {
  const hasil = buildSavingsAdvice({
    baseCurrency: "IDR",
    budget: { available: false },
    cashFlow: { evaluable: false },
    goal: { available: false },
  });

  assert.equal(hasil.hasAdvice, true);
  assert.deepEqual(hasil.items.map((item) => item.key), [
    "need_budget",
    "need_income",
    "need_goal",
  ]);
});

test("semuanya sehat menghasilkan daftar kosong, bukan saran karangan", () => {
  const hasil = buildSavingsAdvice(ringkasan());
  assert.equal(hasil.hasAdvice, false);
  assert.deepEqual(hasil.items, []);
});

test("dipanggil tanpa ringkasan tetap aman", () => {
  const hasil = buildSavingsAdvice();
  assert.ok(Array.isArray(hasil.items));
  // Tanpa data apa pun, yang muncul adalah langkah melengkapi data.
  assert.equal(hasil.items.length, 3);
});

test("saran tidak menyeberang jadi nasihat keuangan", async () => {
  const halaman = await readFile(
    new URL("../src/components/control/ControlCenterPage.js", import.meta.url),
    "utf8",
  );

  // Diperiksa pada teks yang benar benar sampai ke pengguna, bukan pada
  // sumbernya: komentar yang menjelaskan batas ini justru perlu menyebut
  // kata yang dilarang munculnya di layar.
  const terlarang = /investasi|saham|reksa ?dana|deposito|kripto|sebaiknya kamu/i;
  const skenario = [
    ringkasan(),
    ringkasan({ cashFlow: { evaluable: true, savingsRatio: 0.02, income: 9000000, netCashFlow: 180000 } }),
    ringkasan({ runway: { evaluable: true, months: 0.3, monthlyBurn: 4000000, freeLiquidFunds: 1200000 } }),
    ringkasan({ goal: { available: true, name: "Motor", remainingAmount: 8000000, currency: "IDR" } }),
    { baseCurrency: "IDR", budget: { available: false }, cashFlow: { evaluable: false }, goal: { available: false } },
  ];

  skenario.forEach((data, index) => {
    buildSavingsAdvice(data).items.forEach((item) => {
      const teks = `${item.title} ${item.detail} ${item.actionLabel}`;
      assert.doesNotMatch(teks, terlarang, `skenario ${index}: ${teks}`);
    });
  });

  // Halaman menyatakan batas itu kepada pengguna.
  // Sumbernya boleh terpotong baris; yang penting kalimatnya utuh saat
  // dirender, jadi spasi berturut diperlakukan sama.
  assert.match(halaman.replace(/\s+/g, " "), /bukan saran investasi/);
});
