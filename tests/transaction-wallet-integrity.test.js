import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  getTransactionAccountMovements,
  validateTransactionAccountLinks,
} from "../src/domain/transactions.js";
import { buildAssetAccountBalancePlan } from "../src/domain/assets.js";

const accounts = [
  {
    id: "cash-idr",
    name: "Cash IDR",
    account_type: "cash",
    currency: "IDR",
    balance_amount: 100000,
  },
  {
    id: "bank-idr",
    name: "Bank IDR",
    account_type: "bank",
    currency: "IDR",
    balance_amount: 250000,
  },
  {
    id: "cash-thb",
    name: "Cash THB",
    account_type: "cash",
    currency: "THB",
    balance_amount: 1000,
  },
  {
    id: "investment-idr",
    name: "Reksa Dana",
    account_type: "investment",
    currency: "IDR",
    balance_amount: 500000,
  },
];

test("income wajib menunjuk dompet tujuan", () => {
  assert.throws(
    () =>
      validateTransactionAccountLinks(
        { type: "income", currency: "IDR", amount: 50000 },
        accounts,
      ),
    /Pilih dompet tujuan/,
  );

  const result = validateTransactionAccountLinks(
    {
      type: "income",
      currency: "IDR",
      amount: 50000,
      destination_account_id: "cash-idr",
    },
    accounts,
  );
  assert.equal(result.destinationAccount.id, "cash-idr");
});

test("expense wajib menunjuk dompet sumber dengan mata uang yang sama", () => {
  assert.throws(
    () =>
      validateTransactionAccountLinks(
        { type: "expense", currency: "IDR", amount: 10000 },
        accounts,
      ),
    /Pilih dompet sumber/,
  );
  assert.throws(
    () =>
      validateTransactionAccountLinks(
        {
          type: "expense",
          currency: "THB",
          amount: 100,
          source_account_id: "cash-idr",
        },
        accounts,
      ),
    /memakai IDR, bukan THB/,
  );
});

test("akun investasi tidak dapat dipakai sebagai dompet transaksi", () => {
  assert.throws(
    () =>
      validateTransactionAccountLinks(
        {
          type: "income",
          currency: "IDR",
          amount: 50000,
          destination_account_id: "investment-idr",
        },
        accounts,
      ),
    /bukan dompet transaksi/,
  );
});

test("transfer dan exchange wajib memakai dua dompet yang valid", () => {
  assert.throws(
    () =>
      validateTransactionAccountLinks(
        {
          type: "exchange",
          from_currency: "IDR",
          to_currency: "IDR",
          source_account_id: "cash-idr",
          destination_account_id: "cash-idr",
        },
        accounts,
      ),
    /tidak boleh sama/,
  );

  const exchange = validateTransactionAccountLinks(
    {
      type: "exchange",
      from_currency: "IDR",
      to_currency: "THB",
      source_account_id: "cash-idr",
      destination_account_id: "cash-thb",
    },
    accounts,
  );
  assert.equal(exchange.sourceAccount.id, "cash-idr");
  assert.equal(exchange.destinationAccount.id, "cash-thb");
});

test("saldo dompet mengikuti transaksi tervalidasi", () => {
  const transaction = {
    type: "expense",
    currency: "IDR",
    amount: 25000,
    source_account_id: "cash-idr",
  };
  validateTransactionAccountLinks(transaction, accounts);
  const plan = buildAssetAccountBalancePlan(
    accounts,
    getTransactionAccountMovements(transaction),
  );
  assert.equal(
    plan.nextAccounts.find((account) => account.id === "cash-idr").balance_amount,
    75000,
  );
});

test("onboarding mata uang tidak lagi memblokir pengguna baru", () => {
  const mainSource = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
  assert.doesNotMatch(mainSource, /<\$\{CurrencyOnboarding\}/);
  assert.match(mainSource, /Mulai dengan dompet pertamamu|onAddWallet/);
});

test("database menolak transaksi baru tanpa relasi dompet", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/20260819110746_enforce_wallet_transaction_integrity.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(migration, /type = 'income'[\s\S]*destination_account_id is not null/);
  assert.match(migration, /type = 'expense'[\s\S]*source_account_id is not null/);
  assert.match(migration, /transactions_source_account_owner_fkey/);
  assert.match(migration, /validate_wallet_transaction_links_before_write/);
  assert.match(migration, /not valid/i);
});

test("catat cepat memakai mata uang dompet terpilih, bukan mata uang dasar", () => {
  const sheet = readFileSync(
    new URL("../src/components/transactions/QuickEntrySheet.js", import.meta.url),
    "utf8",
  );

  // Mata uang transaksi harus diturunkan dari dompet yang dipilih. Ketika ia
  // dipatok ke mata uang dasar, memilih dompet valas membuat payload memakai
  // IDR sementara dompetnya USD, dan validasi di bawah menolaknya.
  assert.match(
    sheet,
    /const currency = normalizeCurrencyCode\(account\?\.currency \|\| baseCode\)/,
  );
  assert.doesNotMatch(sheet, /const currency = normalizeCurrencyCode\(baseCurrency\)/);

  // Payload memakai currency yang sama untuk nominal dan expense_currency.
  assert.match(sheet, /expense_currency: isExpense \? currency : null/);

  // Inilah penolakan yang dulu terpicu: nominal THB pada dompet IDR.
  assert.throws(
    () =>
      validateTransactionAccountLinks(
        {
          type: "expense",
          currency: "THB",
          amount: 100,
          source_account_id: "cash-idr",
        },
        accounts,
      ),
    /memakai IDR, bukan THB/,
  );

  // Dan inilah yang sekarang dihasilkan komponennya: mata uang mengikuti dompet.
  const ok = validateTransactionAccountLinks(
    {
      type: "expense",
      currency: "THB",
      amount: 100,
      source_account_id: "cash-thb",
    },
    accounts,
  );
  assert.equal(ok.sourceAccount.id, "cash-thb");
});

test("sheet menunda onClose supaya animasi menutup sempat berjalan", async () => {
  const { SHEET_CLOSE_MS } = await import("../src/lib/sheetClose.js");
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

  // Jeda tutup harus sama dengan --dc-element, kalau tidak sheet dilepas
  // sebelum animasinya selesai atau menggantung sesudahnya.
  assert.equal(SHEET_CLOSE_MS, 200);
  assert.match(css, /--dc-element:\s*200ms/);
  assert.match(css, /@keyframes dcSheetDown/);
  assert.match(css, /\.dc-sheet-down\s*\{[^}]*dcSheetDown/);

  for (const path of [
    "src/components/transactions/QuickEntrySheet.js",
    "src/components/transactions/TransactionDetailSheet.js",
    "src/components/shared/SheetShell.js",
  ]) {
    const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
    assert.match(source, /useSheetClose/, `${path} belum memakai useSheetClose`);
    assert.match(source, /dc-sheet-down/, `${path} belum punya gerak menutup`);
  }
});
