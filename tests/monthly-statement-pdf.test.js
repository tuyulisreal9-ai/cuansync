import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import test from "node:test";
import {
  buildMonthlyStatement,
  getMonthlyStatementMonthOptions,
  getMonthlyStatementTransactions,
  getStatementMissingRateCurrencies,
  formatStatementUtcOffset,
} from "../src/components/transactions/monthlyStatement.js";
import { createMonthlyStatementPdf, exportMonthlyStatementPdf } from "../src/lib/monthlyStatementPdf.js";
import { loadMonthlyStatementRates } from "../src/lib/monthlyStatementRates.js";
import { fetchGlobalCurrencyRates } from "../src/lib/exchangeRates.js";
import { CURRENCY_REGISTRY } from "../src/lib/currency.js";

const accounts = [
  { id: "jago", name: "BANK JAGO", currency: "IDR", account_type: "bank" },
  { id: "sofian", name: "SOFIAN", currency: "IDR", account_type: "bank" },
  { id: "lkr", name: "CASH LKR", currency: "LKR", account_type: "cash" },
];

const transactions = [
  {
    id: "income",
    type: "income",
    description: "Gaji bulanan",
    currency: "IDR",
    amount: 11_000_000,
    base_currency: "IDR",
    base_amount: 11_000_000,
    destination_account_id: "sofian",
    occurred_at: "2026-08-23T11:37:00.000Z",
    created_at: "2026-08-23T11:37:00.000Z",
  },
  {
    id: "expense",
    type: "expense",
    description: "Beli headset",
    category: "Belanja",
    currency: "IDR",
    amount: 5_000_000,
    base_currency: "IDR",
    base_amount: 5_000_000,
    source_account_id: "sofian",
    target_id: "dana-darurat",
    occurred_at: "2026-08-27T05:04:00.000Z",
    created_at: "2026-08-27T05:04:00.000Z",
  },
  {
    id: "foreign-expense",
    type: "expense",
    description: "Makan siang",
    category: "Makan Harian",
    currency: "USD",
    amount: 10,
    base_currency: "IDR",
    base_amount: 150_000,
    source_account_id: "sofian",
    occurred_at: "2026-08-26T05:04:00.000Z",
    created_at: "2026-08-26T05:04:00.000Z",
  },
  {
    id: "unvalued-expense",
    type: "expense",
    description: "Belanja THB lama",
    category: "Belanja",
    currency: "THB",
    amount: 100,
    base_currency: "IDR",
    source_account_id: "sofian",
    occurred_at: "2026-08-25T05:04:00.000Z",
    created_at: "2026-08-25T05:04:00.000Z",
  },
  {
    id: "transfer",
    type: "exchange",
    description: "Transfer ke Sofian",
    from_currency: "IDR",
    to_currency: "IDR",
    from_amount: 300_000,
    to_amount: 300_000,
    source_account_id: "jago",
    destination_account_id: "sofian",
    rate_type: "transfer",
    occurred_at: "2026-08-18T03:42:00.000Z",
    created_at: "2026-08-18T03:42:00.000Z",
  },
  {
    id: "exchange",
    type: "exchange",
    description: "Tukar IDR ke LKR",
    from_currency: "IDR",
    to_currency: "LKR",
    from_amount: 2_232_162,
    to_amount: 41_170,
    base_currency: "IDR",
    base_amount: 2_232_162,
    fee_amount: 10_000,
    fee_currency: "IDR",
    source_account_id: "sofian",
    destination_account_id: "lkr",
    occurred_at: "2026-08-11T07:20:00.000Z",
    created_at: "2026-08-11T07:20:00.000Z",
  },
  {
    id: "outside-month",
    type: "expense",
    description: "Bulan berikutnya",
    currency: "IDR",
    amount: 99_000,
    base_currency: "IDR",
    base_amount: 99_000,
    source_account_id: "sofian",
    occurred_at: "2026-09-01T05:04:00.000Z",
    created_at: "2026-09-01T05:04:00.000Z",
  },
];

test("laporan bulanan hanya mengambil transaksi pada bulan pilihan", () => {
  const august = getMonthlyStatementTransactions(transactions, "2026-08");
  assert.equal(august.length, 6);
  assert.equal(august[0].id, "expense");
  assert.equal(august.at(-1).id, "exchange");
});

test("bulan lama tetap tersedia dan diurutkan dari yang terbaru", () => {
  const options = getMonthlyStatementMonthOptions(
    transactions,
    new Date("2026-09-02T12:00:00.000Z"),
  );
  assert.deepEqual(
    options.map((option) => [option.key, option.count]),
    [
      ["2026-09", 1],
      ["2026-08", 6],
    ],
  );
});

test("transfer tidak menggandakan arus kas dan biaya tukar tetap menjadi pengeluaran", () => {
  const statement = buildMonthlyStatement({
    transactions,
    assetAccounts: accounts,
    monthKey: "2026-08",
    baseCurrency: "IDR",
    ownerName: "Tuyul Isreal",
  });

  assert.equal(statement.summary.transactionCount, 6);
  assert.equal(statement.summary.income, 11_000_000);
  assert.equal(statement.summary.expense, 5_160_000);
  assert.equal(statement.summary.feeExpense, 10_000);
  assert.equal(statement.summary.net, 5_840_000);
  assert.equal(statement.summary.movementCount, 2);
  assert.equal(statement.summary.unvaluedCount, 1);
  assert.equal(statement.summary.isValuationComplete, false);

  const transfer = statement.rows.find((row) => row.id === "transfer");
  assert.equal(transfer.internalTransfer, true);
  assert.equal(transfer.accountLabel, "BANK JAGO -> SOFIAN");
  const expense = statement.rows.find((row) => row.id === "expense");
  assert.equal(expense.usesSavings, true);
});

test("generator menghasilkan PDF vektor dan memecah laporan panjang menjadi beberapa halaman", async () => {
  const longTransactions = Array.from({ length: 72 }, (_, index) => ({
    ...transactions[1],
    id: `expense-${index}`,
    description: `Belanja kebutuhan bulanan nomor ${index + 1}`,
    amount: 25_000 + index,
    base_amount: 25_000 + index,
    occurred_at: `2026-08-${String((index % 27) + 1).padStart(2, "0")}T05:04:00.000Z`,
    created_at: `2026-08-${String((index % 27) + 1).padStart(2, "0")}T05:04:00.000Z`,
  }));
  const statement = buildMonthlyStatement({
    transactions: longTransactions,
    assetAccounts: accounts,
    monthKey: "2026-08",
    baseCurrency: "IDR",
    ownerName: "Tuyul Isreal",
  });
  const doc = await createMonthlyStatementPdf(statement);
  const bytes = new Uint8Array(doc.output("arraybuffer"));
  assert.equal(new TextDecoder("latin1").decode(bytes.slice(0, 5)), "%PDF-");
  assert.ok(doc.getNumberOfPages() > 1);
});

test("Pengaturan membuka ekspor PDF dan main memuat ulang satu bulan penuh", async () => {
  const [settings, main] = await Promise.all([
    readFile(new URL("../src/components/settings/SettingsPage.js", import.meta.url), "utf8"),
    readFile(new URL("../src/main.js", import.meta.url), "utf8"),
  ]);
  assert.match(settings, /Laporan transaksi bulanan/);
  assert.match(settings, /MonthlyStatementExportSheet/);
  assert.match(main, /loadStatementTransactions/);
  assert.match(main, /\.gte\("occurred_at", start\.toISOString\(\)\)/);
  assert.match(main, /\.range\(offset, offset \+ pageSize - 1\)/);
  assert.match(main, /\.order\("id", \{ ascending: true \}\)/);
  const sheet = await readFile(
    new URL("../src/components/settings/MonthlyStatementExportSheet.js", import.meta.url),
    "utf8",
  );
  assert.match(sheet, /isValidStatementMonthKey\(monthKey\)/);
  assert.match(sheet, /loadFailed/);
});

const latestRates = {
  baseCurrency: "IDR", rates: { THB: 500, USD: 17_000, LKR: 55 },
  provider: "exchangerate-api-open", sourceDate: "2026-09-08T00:00:00Z",
  fetchedAt: "2026-09-08T05:00:00Z",
};
const makeStatement = (overrides = {}) => buildMonthlyStatement({
  transactions, assetAccounts: accounts, monthKey: "2026-08", ...overrides,
});

test("rekap nominal asli memisahkan mata uang dan mengecualikan pokok transfer/tukar", () => {
  const statement = makeStatement();
  assert.deepEqual(statement.summary.byCurrency, [
    { currency: "IDR", income: 11_000_000, expense: 5_010_000, feeExpense: 10_000, net: 5_990_000 },
    { currency: "THB", income: 0, expense: 100, feeExpense: 0, net: -100 },
    { currency: "USD", income: 0, expense: 10, feeExpense: 0, net: -10 },
  ]);
  assert.deepEqual(getStatementMissingRateCurrencies(statement), ["THB"]);
});

test("kurs terbaru melengkapi bulan lama tanpa menimpa valuasi historis atau data tersimpan", () => {
  const original = structuredClone(transactions);
  const statement = makeStatement({ rateSnapshot: latestRates });
  const oldExpense = statement.rows.find((row) => row.id === "unvalued-expense");
  assert.equal(oldExpense.baseValue, 50_000);
  assert.equal(oldExpense.historicalValue, null);
  assert.equal(oldExpense.valuationSource, "latest");
  const historical = statement.rows.find((row) => row.id === "foreign-expense");
  assert.equal(historical.baseValue, 150_000);
  assert.equal(historical.valuationSource, "historical");
  assert.equal(statement.summary.expense, 5_210_000);
  assert.equal(statement.summary.estimatedCount, 1);
  assert.equal(statement.summary.unvaluedCount, 0);
  assert.equal(statement.summary.isValuationComplete, true);
  assert.equal(statement.valuation.sourceDate, latestRates.sourceDate);
  assert.deepEqual(getStatementMissingRateCurrencies(statement), []);
  assert.deepEqual(transactions, original);
});

test("pemasukan LKR dan biaya asing ikut konversi, bukan pokok tukar", () => {
  const statement = makeStatement({ rateSnapshot: latestRates, transactions: [
    { ...transactions[0], currency: "LKR", amount: 1600, base_amount: null },
    { ...transactions[5], from_currency: "USD", from_amount: 100,
      base_amount: null, fee_amount: 2, fee_currency: "THB" },
  ] });
  assert.equal(statement.summary.income, 88_000);
  assert.equal(statement.summary.expense, 1000);
  assert.equal(statement.summary.feeExpense, 1000);
  assert.equal(statement.summary.estimatedCount, 2);
  assert.equal(statement.rows.find((row) => row.flow === "exchange").feeValuationSource, "latest");
  assert.deepEqual(statement.summary.byCurrency, [
    { currency: "LKR", income: 1600, expense: 0, feeExpense: 0, net: 1600 },
    { currency: "THB", income: 0, expense: 2, feeExpense: 2, net: -2 },
  ]);
});

test("biaya dengan kurs historis tidak diganti oleh kurs terbaru", () => {
  const statement = makeStatement({ rateSnapshot: latestRates, transactions: [
    { ...transactions[5], from_currency: "USD", from_amount: 100,
      base_amount: 1_500_000, fee_amount: 2, fee_currency: "USD" },
  ] });
  assert.equal(statement.summary.feeExpense, 30_000);
  assert.equal(statement.summary.estimatedCount, 0);
  assert.equal(statement.rows[0].feeValuationSource, "historical");
});

test("arah rate tetap base-per-unit, bukan dibalik dua kali", async () => {
  const snapshot = await fetchGlobalCurrencyRates({
    baseCurrency: "IDR", currencies: ["LKR"],
    fetchImpl: async (url) => {
      assert.equal(url, "https://open.er-api.com/v6/latest/IDR");
      return { ok: true, json: async () => ({
        result: "success", rates: { LKR: 0.02 }, time_last_update_utc: latestRates.sourceDate,
      }) };
    },
  });
  const statement = makeStatement({ rateSnapshot: snapshot, transactions: [
    { ...transactions[0], currency: "LKR", amount: 1600, base_amount: null },
  ] });
  assert.equal(statement.summary.income, 80_000);
});

test("rate invalid atau base yang berbeda tidak menghasilkan valuasi palsu", () => {
  for (const rate of [0, -50, Infinity, NaN]) {
    const statement = makeStatement({ rateSnapshot: { ...latestRates, rates: { THB: rate } } });
    assert.equal(statement.summary.unvaluedCount, 1);
    assert.equal(statement.summary.estimatedCount, 0);
  }
  assert.equal(makeStatement({ rateSnapshot: { ...latestRates, baseCurrency: "USD" } }).summary.unvaluedCount, 1);
});

test("mata uang dasar lain dan pecahan sen tetap dihitung tepat", () => {
  const statement = makeStatement({ baseCurrency: "USD", rateSnapshot: {
    ...latestRates, baseCurrency: "USD", rates: { LKR: 0.005 },
  }, transactions: [
    { ...transactions[0], currency: "USD", amount: 0.1, base_amount: null },
    { ...transactions[0], id: "second", currency: "USD", amount: 0.2, base_amount: null },
    { ...transactions[1], currency: "LKR", amount: 1600, base_amount: null },
  ] });
  assert.equal(statement.summary.income, 0.3);
  assert.equal(statement.summary.expense, 8);
  assert.equal(statement.summary.net, -7.7);
  assert.equal(statement.summary.byCurrency[0].income, 0.3);
});

test("pemuat kurs hanya meminta mata uang yang hilang dan melewati laporan historis lengkap", async () => {
  let called = 0;
  const fetchRates = async (args) => {
    called++;
    assert.equal(args.baseCurrency, "IDR");
    assert.deepEqual(args.currencies, ["THB"]);
    assert.equal("transactions" in args, false);
    return latestRates;
  };
  assert.equal(await loadMonthlyStatementRates(makeStatement(), { fetchRates }), latestRates);
  assert.equal(await loadMonthlyStatementRates(makeStatement({ transactions: [transactions[0]] }), { fetchRates }), null);
  assert.equal(called, 1);
});

test("kurs gagal, parsial, tidak bertanggal atau timeout menolak ekspor tidak lengkap", async () => {
  const statement = makeStatement();
  for (const snapshot of [
    { ...latestRates, rates: {} }, { ...latestRates, rates: { THB: Infinity } },
    { ...latestRates, sourceDate: null }, { ...latestRates, baseCurrency: "USD" },
  ]) {
    await assert.rejects(loadMonthlyStatementRates(statement, { fetchRates: async () => snapshot }), /Kurs terbaru THB belum bisa dimuat/);
  }
  await assert.rejects(loadMonthlyStatementRates(statement, { fetchRates: async () => { throw new Error("offline"); } }), /Periksa koneksi/);
  await assert.rejects(loadMonthlyStatementRates(statement, { fetchRates: () => new Promise(() => {}), timeoutMs: 5 }), /Periksa koneksi/);
  await assert.rejects(exportMonthlyStatementPdf(statement), /Kurs terbaru belum lengkap/);
});

test("label zona waktu PDF menggunakan UTC offset, termasuk zona setengah jam", () => {
  const moduleUrl = new URL("../src/components/transactions/monthlyStatement.js", import.meta.url).href;
  for (const [timeZone, date, expected] of [
    ["Asia/Bangkok", "2026-09-08T05:00:00Z", "UTC+7"],
    ["Asia/Colombo", "2026-09-08T05:00:00Z", "UTC+5:30"],
    ["America/St_Johns", "2026-01-08T05:00:00Z", "UTC-3:30"],
  ]) {
    const result = execFileSync(process.execPath, ["--input-type=module", "-e",
      `import { formatStatementUtcOffset } from ${JSON.stringify(moduleUrl)}; console.log(formatStatementUtcOffset(${JSON.stringify(date)}));`,
    ], { env: { ...process.env, TZ: timeZone }, encoding: "utf8" });
    assert.equal(result.trim(), expected);
  }
  assert.equal(formatStatementUtcOffset("invalid"), "UTC");
});

test("PDF kurs terbaru memiliki rekap asli dan setiap halaman tetap bernomor", async () => {
  const statement = makeStatement({ rateSnapshot: latestRates });
  const doc = await createMonthlyStatementPdf(statement);
  const content = doc.internal.pages.flat().join("\n");
  assert.match(content, /Masuk & keluar per mata uang/);
  assert.match(content, /KELUAR/);
  assert.match(content, /Estimasi Rp 50.000/);
  assert.match(content, /Setara Rp 150.000/);
  assert.match(content, /Data kurs: 8 Sep 2026/);
  assert.doesNotMatch(content, /Valuasi IDR tidak tersedia|Asia\/Bangkok/);
  assert.match(content, /Halaman 1/);
});

test("rekap 19 mata uang memindahkan riwayat tanpa menimpa tabel atau kehilangan transaksi", async () => {
  const currencies = CURRENCY_REGISTRY.map((item) => item.code);
  const statement = makeStatement({
    transactions: currencies.map((currency) => ({
      ...transactions[1], id: currency, currency, amount: 1_234_567.89,
      base_amount: null, description: `Contoh-${currency}`,
    })),
    rateSnapshot: { ...latestRates, rates: Object.fromEntries(currencies.map((code) => [code, 100])) },
  });
  const doc = await createMonthlyStatementPdf(statement);
  assert.equal(statement.summary.byCurrency.length, 19);
  assert.ok(doc.getNumberOfPages() >= 2);
  const content = doc.internal.pages.flat().join("\n");
  for (const currency of currencies) assert.ok(content.includes(`Contoh-${currency}`));
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    const pageContent = doc.internal.pages[page].join("\n");
    assert.ok(pageContent.includes(`Halaman ${page}`));
    assert.equal((pageContent.match(/\(CUANSYNC\) Tj/g) || []).length, 1);
  }
});
