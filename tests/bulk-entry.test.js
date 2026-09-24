import test from "node:test";
import assert from "node:assert/strict";
import {
  detectBulkCategory,
  getBulkCategoryKeywords,
  groupBulkEntryRows,
  isBulkRowIncomplete,
  parseBulkEntryText,
  planBulkEntrySave,
  readBulkAmount,
  summarizeBulkEntryRows,
} from "../src/domain/bulkEntry.js";
import { CATEGORY_OPTIONS, isFinalExpenseCategory } from "../src/domain/categories.js";

const DOMPET = [
  {
    id: "acc-tunai",
    name: "Tunai",
    currency: "IDR",
    is_primary: true,
    balance_amount: 5000000,
    availableBalance: 5000000,
  },
  {
    id: "acc-gopay",
    name: "GoPay",
    currency: "IDR",
    balance_amount: 300000,
    availableBalance: 300000,
  },
  {
    id: "acc-kbank",
    name: "KBank",
    currency: "THB",
    balance_amount: 20000,
    availableBalance: 20000,
  },
];

const KONTEKS = {
  accounts: DOMPET,
  defaultAccountId: "acc-tunai",
  defaultDateKey: "2026-09-23",
  baseCurrency: "IDR",
};

function baca(teks, konteks = KONTEKS) {
  return parseBulkEntryText(teks, konteks);
}

test("satu baris jadi satu transaksi dengan kategori tebakan", () => {
  const [kopi, makan, gojek] = baca(
    "kopi 18rb\nmakan siang nasi padang 32k\ngojek ke kantor 24rb",
  );

  assert.equal(kopi.amount, 18000);
  assert.equal(kopi.category, "Makan");
  assert.equal(kopi.type, "expense");
  assert.equal(kopi.accountId, "acc-tunai");
  assert.equal(kopi.description, "Kopi");

  assert.equal(makan.amount, 32000);
  assert.equal(makan.category, "Makan");

  assert.equal(gojek.amount, 24000);
  assert.equal(gojek.category, "Transportasi");
});

test("nominal bersufiks dibaca sebagai pecahan, bukan ribuan", () => {
  /* "63,5rb" pernah menjadi 635.000 kalau angkanya dibersihkan lebih dulu
     dengan aturan rupiah yang membuang koma. */
  const [indomaret, kos] = baca("indomaret 63,5rb\nsewa kos 1,5jt");
  assert.equal(indomaret.amount, 63500);
  assert.equal(indomaret.category, "Belanja");
  assert.equal(kos.amount, 1500000);
  assert.equal(kos.category, "Tempat Tinggal");
});

test("angka tanpa sufiks dibaca apa adanya menurut mata uangnya", () => {
  const [lima, ribuan] = baca("kopi 5\nbelanja 25.000");
  assert.equal(lima.amount, 5);
  assert.equal(ribuan.amount, 25000);
});

test("nama dompet di baris mengubah dompet dan mata uangnya", () => {
  const [parkir, makan] = baca("parkir 5000 pakai gopay\nmakan 250,50 pakai kbank");

  assert.equal(parkir.accountId, "acc-gopay");
  assert.equal(parkir.currency, "IDR");
  assert.equal(parkir.description, "Parkir");

  /* Baris valas dibaca dengan aturan angka mata uangnya sendiri: baht punya
     dua angka di belakang koma, rupiah tidak punya sama sekali. */
  assert.equal(makan.accountId, "acc-kbank");
  assert.equal(makan.currency, "THB");
  assert.equal(makan.amount, 250.5);
});

test("angka yang sama dibaca berbeda pada dompet rupiah dan baht", () => {
  assert.equal(readBulkAmount("250.500", "", "IDR"), 250500);
  assert.equal(readBulkAmount("250.50", "", "THB"), 250.5);
  assert.equal(readBulkAmount("1.500", "", "THB"), 1500);
  assert.equal(readBulkAmount("18", "rb", "THB"), 18000);
});

test("kemarin memundurkan tanggal satu hari", () => {
  const [bensin] = baca("kemarin bensin 30rb");
  assert.equal(bensin.dateKey, "2026-09-22");
  assert.equal(bensin.description, "Bensin");
  assert.equal(bensin.category, "Transportasi");
});

test("pemasukan dikenali dari tanda tambah maupun kata kunci", () => {
  const [gaji, jual] = baca("+gaji agustus 8,2jt\njual kamera bekas 2,4jt");

  assert.equal(gaji.type, "income");
  assert.equal(gaji.amount, 8200000);
  assert.equal(gaji.category, null);
  assert.equal(jual.type, "income");
  assert.equal(jual.amount, 2400000);
});

test("kata kunci terpanjang menentukan kategorinya", () => {
  const [gofood] = baca("grabfood 45rb");
  assert.equal(gofood.category, "Makan");
});

test("baris tanpa nominal dilewati, bukan dibuang diam diam", () => {
  const rows = baca("beli hadiah\nkopi 18rb");
  assert.equal(rows.length, 2);
  assert.equal(rows[0].skipped, true);
  assert.equal(rows[0].skipReason, "Nominal tidak terbaca, baris dilewati");
  assert.equal(rows[1].skipped, false);

  const ringkas = summarizeBulkEntryRows(rows);
  assert.equal(ringkas.readyCount, 1);
  assert.equal(ringkas.skippedCount, 1);
});

test("ringkasan tidak menjumlahkan dua mata uang jadi satu angka", () => {
  const rows = baca("kopi 18rb\nmakan 250 pakai kbank\n+gaji 8jt");
  const ringkas = summarizeBulkEntryRows(rows);
  const idr = ringkas.totals.find((item) => item.currency === "IDR");
  const thb = ringkas.totals.find((item) => item.currency === "THB");

  assert.equal(idr.expense, 18000);
  assert.equal(idr.income, 8000000);
  assert.equal(thb.expense, 250);
  assert.equal(thb.income, 0);
});

test("pengeluaran tanpa kategori ditandai belum lengkap", () => {
  const [misterius] = baca("titipan xyz 25rb");
  assert.equal(misterius.category, null);
  assert.equal(isBulkRowIncomplete(misterius), true);
  assert.equal(isBulkRowIncomplete({ ...misterius, category: "Lainnya" }), false);
});

test("rencana simpan menolak batch yang barisnya belum lengkap", () => {
  const rows = baca("belanja misterius 25rb").map((row) => ({ ...row, category: null }));
  const rencana = planBulkEntrySave(rows, { accounts: DOMPET, availability: {} });
  assert.equal(rencana.ok, false);
  assert.match(rencana.message, /belum lengkap/);
});

test("rencana simpan memeriksa saldo seluruh batch per dompet", () => {
  const rows = baca("belanja 200rb pakai gopay\nbelanja lagi 150rb pakai gopay");
  const rencana = planBulkEntrySave(rows, {
    accounts: DOMPET,
    availability: {
      "acc-gopay": { availableBalance: 300000 },
      "acc-tunai": { availableBalance: 5000000 },
    },
  });

  assert.equal(rencana.ok, false);
  assert.equal(rencana.shortfall.accountId, "acc-gopay");
  assert.equal(rencana.shortfall.amount, 50000);
  assert.match(rencana.message, /GoPay/);
});

test("pemasukan di batch yang sama ikut menutup pengeluarannya", () => {
  const rows = baca("belanja 400rb pakai gopay\n+cashback 200rb pakai gopay");
  const rencana = planBulkEntrySave(rows, {
    accounts: DOMPET,
    availability: { "acc-gopay": { availableBalance: 300000 } },
  });
  assert.equal(rencana.ok, true);
});

test("pemasukan disimpan lebih dulu tetapi urutan waktunya tetap urutan ketikan", () => {
  const rows = baca("kopi 18rb\n+gaji 8jt\nbensin 30rb");
  const rencana = planBulkEntrySave(rows, {
    accounts: DOMPET,
    availability: {},
    now: new Date("2026-09-23T10:00:00"),
  });

  assert.equal(rencana.ok, true);
  assert.equal(rencana.payloads[0].type, "income");
  assert.equal(rencana.payloads.length, 3);

  const waktu = new Map(
    rencana.payloads.map((item) => [item.rowId, new Date(item.occurred_at).getTime()]),
  );
  assert.ok(waktu.get("bulk-1") < waktu.get("bulk-2"));
  assert.ok(waktu.get("bulk-2") < waktu.get("bulk-3"));
});

test("muatan pengeluaran dan pemasukan memakai kolom dompet yang benar", () => {
  const rows = baca("kopi 18rb\n+gaji 8jt");
  const { payloads } = planBulkEntrySave(rows, { accounts: DOMPET, availability: {} });
  const masuk = payloads.find((item) => item.type === "income");
  const keluar = payloads.find((item) => item.type === "expense");

  assert.equal(masuk.destination_account_id, "acc-tunai");
  assert.equal(masuk.source_account_id, null);
  assert.equal(masuk.category, null);
  assert.equal(keluar.source_account_id, "acc-tunai");
  assert.equal(keluar.destination_account_id, null);
  assert.equal(keluar.category, "Makan");
  assert.equal(keluar.expense_currency, "IDR");
  assert.equal(keluar.target_id, null);
});

test("rekap akhir dikelompokkan per kategori dan per mata uang", () => {
  const rows = baca("kopi 18rb\nmakan 32rb\nbensin 30rb\n+gaji 8jt");
  const grup = groupBulkEntryRows(rows.filter((row) => !row.skipped));

  const makan = grup.find((item) => item.label === "Makan Harian");
  assert.equal(makan.count, 2);
  assert.equal(makan.total, 50000);
  assert.equal(grup[grup.length - 1].label, "Pemasukan");
});

test("kata sehari hari di luar makanan ikut dikenali", () => {
  const harapan = [
    ["uber ke kantor", "Transportasi"],
    ["indriver ke stasiun", "Transportasi"],
    ["isi bensin", "Transportasi"],
    ["beli baju", "Belanja"],
    ["sepatu sekolah", "Belanja"],
    ["laundry seminggu", "Belanja"],
    ["ongkir jne", "Belanja"],
    ["beli hp", "Belanja"],
    ["bayar listrik", "Tagihan"],
    ["kuota internet", "Tagihan"],
    ["spp anak", "Tagihan"],
    ["kartu kredit", "Tagihan"],
    ["obat batuk", "Kesehatan"],
    ["kontrol ke dokter gigi", "Kesehatan"],
    ["bayar kos", "Tempat Tinggal"],
    ["beli semen", "Tempat Tinggal"],
    ["langganan netflix", "Hiburan & Gaya Hidup"],
    ["potong rambut", "Hiburan & Gaya Hidup"],
    ["top up game", "Hiburan & Gaya Hidup"],
    ["rokok sebungkus", "Hiburan & Gaya Hidup"],
    ["zakat", "Lainnya"],
    ["kondangan", "Lainnya"],
  ];

  harapan.forEach(([teks, kategori]) => {
    assert.equal(detectBulkCategory(teks), kategori, teks);
  });
});

test("kata majemuk mengalahkan kata pendek di dalamnya", () => {
  /* Pasangan ini yang paling mudah salah: satu kata kunci berada persis di
     dalam kata kunci lain, tetapi kategorinya berbeda. */
  const pasangan = [
    ["pasta gigi", "Belanja", "sakit gigi", "Kesehatan"],
    ["obat nyamuk", "Belanja", "obat demam", "Kesehatan"],
    ["servis ac", "Tempat Tinggal", "servis motor", "Transportasi"],
    ["cuci baju", "Belanja", "cuci motor", "Transportasi"],
    ["air mineral", "Makan", "tagihan air", "Tagihan"],
    ["sepeda motor", "Transportasi", "sepeda lipat", "Hiburan & Gaya Hidup"],
    ["tiket pesawat", "Transportasi", "tiket konser", "Hiburan & Gaya Hidup"],
    ["pajak motor", "Transportasi", "pajak rumah", "Tempat Tinggal"],
    ["sewa motor", "Transportasi", "sewa rumah", "Tempat Tinggal"],
    ["makanan kucing", "Belanja", "makanan ringan", "Makan"],
    ["grabfood ayam", "Makan", "grabcar ke mall", "Transportasi"],
    ["air galon", "Belanja", "es teh", "Makan"],
  ];

  pasangan.forEach(([kiriTeks, kiriKategori, kananTeks, kananKategori]) => {
    assert.equal(detectBulkCategory(kiriTeks), kiriKategori, kiriTeks);
    assert.equal(detectBulkCategory(kananTeks), kananKategori, kananTeks);
  });
});

test("kamus kata kunci tidak punya kata ganda dan semuanya kategori nyata", () => {
  const terpakai = new Map();
  getBulkCategoryKeywords().forEach(([category, keywords]) => {
    /* Kategori harus yang benar benar ada di aplikasi, bukan nama karangan:
       kategori asing akan berubah menjadi Lainnya saat disimpan. */
    assert.ok(isFinalExpenseCategory(category), category);
    keywords.forEach((keyword) => {
      assert.equal(
        terpakai.get(keyword),
        undefined,
        `"${keyword}" ada di ${terpakai.get(keyword)} dan ${category}`,
      );
      assert.equal(keyword, keyword.toLocaleLowerCase("id-ID"), keyword);
      terpakai.set(keyword, category);
    });
  });

  // Tiap kategori pengeluaran punya kata kuncinya sendiri.
  const berkategori = new Set(getBulkCategoryKeywords().map(([category]) => category));
  CATEGORY_OPTIONS.forEach((option) => {
    assert.ok(berkategori.has(option.value), option.value);
  });
});

test("nama dompet tidak ikut menentukan kategori", () => {
  /* Kategori dibaca dari sisa baris setelah nama dompet dibuang. Tanpa itu,
     dompet bernama "Belanja" akan membuat setiap barisnya jadi Belanja. */
  const dompetBelanja = [
    { id: "acc-belanja", name: "Belanja", currency: "IDR", is_primary: true, balance_amount: 1000000 },
    { id: "acc-tunai2", name: "Tunai", currency: "IDR", balance_amount: 1000000 },
  ];
  const [baris] = parseBulkEntryText("makan siang 32rb pakai belanja", {
    accounts: dompetBelanja,
    defaultAccountId: "acc-tunai2",
    defaultDateKey: "2026-09-24",
    baseCurrency: "IDR",
  });

  assert.equal(baris.accountId, "acc-belanja");
  assert.equal(baris.category, "Makan");
  assert.equal(baris.description, "Makan siang");
});
