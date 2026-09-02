import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildMonthlyStatement,
  getMonthlyStatementMonthOptions,
  getMonthlyStatementTransactions,
} from "../src/components/transactions/monthlyStatement.js";
import { createMonthlyStatementPdf } from "../src/lib/monthlyStatementPdf.js";

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
