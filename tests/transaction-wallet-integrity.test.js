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
