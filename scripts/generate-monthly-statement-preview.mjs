import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildMonthlyStatement } from "../src/components/transactions/monthlyStatement.js";
import { createMonthlyStatementPdf } from "../src/lib/monthlyStatementPdf.js";
import { loadMonthlyStatementRates } from "../src/lib/monthlyStatementRates.js";

const accounts = [
  { id: "jago", name: "BANK JAGO", currency: "IDR", account_type: "bank" },
  { id: "sofian", name: "SOFIAN", currency: "IDR", account_type: "bank" },
  { id: "lkr", name: "CASH LKR", currency: "LKR", account_type: "cash" },
];

const categories = [
  "Makan Harian",
  "Transportasi",
  "Belanja",
  "Tagihan",
  "Kesehatan",
];
const transactions = [
  {
    id: "foreign-income", type: "income", description: "Pengembalian belanja",
    currency: "LKR", amount: 1600, destination_account_id: "lkr",
    occurred_at: "2026-08-29T08:00:00Z",
  },
  {
    id: "foreign-expense", type: "expense", description: "Belanja kebutuhan harian",
    category: "Belanja", currency: "LKR", amount: 7500, source_account_id: "lkr",
    occurred_at: "2026-08-29T06:00:00Z",
  },
  {
    id: "historical-expense", type: "expense", description: "Langganan aplikasi kerja",
    category: "Tagihan", currency: "USD", amount: 12,
    base_currency: "IDR", base_amount: 192000, source_account_id: "sofian",
    occurred_at: "2026-08-28T06:00:00Z",
  },
  {
    id: "salary",
    type: "income",
    description: "Gaji bulanan",
    currency: "IDR",
    amount: 12_500_000,
    base_currency: "IDR",
    base_amount: 12_500_000,
    destination_account_id: "sofian",
    occurred_at: "2026-08-28T11:37:00.000Z",
    created_at: "2026-08-28T11:37:00.000Z",
  },
  {
    id: "transfer",
    type: "exchange",
    description: "Transfer dana harian",
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
  ...Array.from({ length: 32 }, (_, index) => {
    const day = String(27 - (index % 25)).padStart(2, "0");
    const amount = 45_000 + index * 17_500;
    return {
      id: `expense-${index + 1}`,
      type: "expense",
      description:
        index === 0
          ? "Belanja kebutuhan rumah dan perlengkapan kerja"
          : `Transaksi ${categories[index % categories.length].toLowerCase()}`,
      category: categories[index % categories.length],
      currency: "IDR",
      amount,
      base_currency: "IDR",
      base_amount: amount,
      source_account_id: "sofian",
      target_id: index === 7 ? "dana-darurat" : null,
      occurred_at: `2026-08-${day}T${String(2 + (index % 14)).padStart(2, "0")}:15:00.000Z`,
      created_at: `2026-08-${day}T${String(2 + (index % 14)).padStart(2, "0")}:15:00.000Z`,
    };
  }),
];

const statementOptions = {
  transactions,
  assetAccounts: accounts,
  monthKey: "2026-08",
  baseCurrency: "IDR",
  ownerName: "Pengguna Contoh - Data Demo",
};
const draft = buildMonthlyStatement(statementOptions);
const rateSnapshot = await loadMonthlyStatementRates(draft);
const statement = buildMonthlyStatement({ ...statementOptions, rateSnapshot });

const icon = await readFile(path.resolve("public/icons/icon-192.webp"));
const brandIconDataUrl = `data:image/webp;base64,${icon.toString("base64")}`;
const doc = await createMonthlyStatementPdf(statement, { brandIconDataUrl });
const outputDirectory = path.resolve("output/pdf");
const outputPath = path.join(
  outputDirectory,
  "CUANSYNC-contoh-laporan-transaksi.pdf",
);
await mkdir(outputDirectory, { recursive: true });
await writeFile(outputPath, Buffer.from(doc.output("arraybuffer")));
console.log(outputPath);
