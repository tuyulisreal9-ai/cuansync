import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildAccountReconciliationRecord,
  calculateReconciliation,
  getLatestAccountReconciliation,
  isReconciliableAccountType,
  normalizeAccountReconciliation,
  normalizeAccountReconciliations,
  roundReconciliationAmount,
} from "../src/domain/reconciliations.js";

const USER_ID = "user-a";
const ACCOUNT_ID = "account-sofian";
const NOW = new Date("2026-09-04T12:00:00.000Z");

function account(overrides = {}) {
  return {
    id: ACCOUNT_ID,
    account_type: "bank",
    currency: "IDR",
    balanceAmount: 15_000_000,
    reservedBalance: 10_000_000,
    availableBalance: 5_000_000,
    is_archived: false,
    ...overrides,
  };
}

test("selisih rekonsiliasi selalu saldo bank dikurangi saldo aktual CUANSYNC", () => {
  const lower = calculateReconciliation({
    appBalance: 15_000_000,
    bankBalance: 14_950_000,
    currency: "IDR",
  });
  const higher = calculateReconciliation({
    actualBalance: 15_000_000,
    bankBalance: 15_020_000,
    currency: "IDR",
  });
  const matched = calculateReconciliation({
    appBalance: 15_000_000,
    bankBalance: 15_000_000,
    currency: "IDR",
  });

  assert.equal(lower.differenceAmount, -50_000);
  assert.equal(lower.direction, "bank_lower");
  assert.equal(lower.status, "different");
  assert.equal(higher.differenceAmount, 20_000);
  assert.equal(higher.direction, "bank_higher");
  assert.equal(matched.differenceAmount, 0);
  assert.equal(matched.direction, "matched");
  assert.equal(matched.status, "matched");
  assert.equal(matched.isMatched, true);
  assert.equal(Object.isFrozen(matched), true);
});

test("pembulatan mengikuti digit pecahan mata uang sebelum dibandingkan", () => {
  const idr = calculateReconciliation({
    appBalance: 1_000_000.4,
    bankBalance: 1_000_000.49,
    currency: "IDR",
  });
  const usd = calculateReconciliation({
    appBalance: 100.004,
    bankBalance: 100.005,
    currency: "USD",
  });

  assert.equal(roundReconciliationAmount(10.6, "IDR"), 11);
  assert.equal(roundReconciliationAmount(10.125, "USD"), 10.13);
  assert.equal(idr.appBalance, 1_000_000);
  assert.equal(idr.bankBalance, 1_000_000);
  assert.equal(idr.isMatched, true);
  assert.equal(usd.appBalance, 100);
  assert.equal(usd.bankBalance, 100.01);
  assert.equal(usd.differenceAmount, 0.01);
});

test("saldo kosong, bukan angka, tak hingga, dan negatif ditolak", () => {
  for (const invalid of ["", "abc", Number.NaN, Number.POSITIVE_INFINITY, -1]) {
    assert.throws(
      () =>
        calculateReconciliation({
          appBalance: 100,
          bankBalance: invalid,
          currency: "IDR",
        }),
      /Saldo bank/,
    );
  }
  assert.throws(
    () =>
      calculateReconciliation({
        appBalance: -1,
        bankBalance: 100,
        currency: "IDR",
      }),
    /Saldo CUANSYNC/,
  );
});

test("tipe rekening yang dapat dicocokkan dibatasi ke dompet likuid utama", () => {
  assert.equal(isReconciliableAccountType("bank"), true);
  assert.equal(isReconciliableAccountType("cash"), true);
  assert.equal(isReconciliableAccountType("ewallet"), true);
  assert.equal(isReconciliableAccountType("investment"), false);
  assert.equal(isReconciliableAccountType("other"), false);
});

test("record memakai saldo aktual, bukan saldo bebas setelah alokasi tabungan", () => {
  const record = buildAccountReconciliationRecord(
    {
      id: "reconciliation-a",
      userId: USER_ID,
      account: account(),
      bankBalance: 15_000_000,
      checkedAt: "2026-09-04T11:30:00.000Z",
      note: "  Dicek dari aplikasi bank  ",
    },
    { now: NOW },
  );

  assert.deepEqual(record, {
    id: "reconciliation-a",
    user_id: USER_ID,
    account_id: ACCOUNT_ID,
    currency: "IDR",
    checked_at: "2026-09-04T11:30:00.000Z",
    app_balance: 15_000_000,
    bank_balance: 15_000_000,
    difference: 0,
    status: "matched",
    note: "Dicek dari aplikasi bank",
    created_at: NOW.toISOString(),
  });
  assert.notEqual(record.app_balance, account().availableBalance);
  assert.equal(Object.isFrozen(record), true);
  assert.throws(() => {
    record.bank_balance = 1;
  }, TypeError);
});

test("builder menolak waktu masa depan, akun arsip, dan tipe yang tidak didukung", () => {
  assert.throws(
    () =>
      buildAccountReconciliationRecord(
        {
          id: "future",
          userId: USER_ID,
          account: account(),
          bankBalance: 15_000_000,
          checkedAt: "2026-09-04T12:00:01.000Z",
        },
        { now: NOW },
      ),
    /masa depan/,
  );
  assert.throws(
    () =>
      buildAccountReconciliationRecord(
        {
          id: "archived",
          userId: USER_ID,
          account: account({ is_archived: true }),
          bankBalance: 15_000_000,
        },
        { now: NOW },
      ),
    /diarsipkan/,
  );
  assert.throws(
    () =>
      buildAccountReconciliationRecord(
        {
          id: "investment",
          userId: USER_ID,
          account: account({ account_type: "investment" }),
          bankBalance: 15_000_000,
        },
        { now: NOW },
      ),
    /Bank, Cash, dan E-wallet/,
  );
});

test("normalizer memberi alias UI dan menghitung ulang status dari snapshot", () => {
  const normalized = normalizeAccountReconciliation({
    id: "row-a",
    user_id: USER_ID,
    account_id: ACCOUNT_ID,
    currency: "usd",
    checked_at: "2026-09-03T10:00:00.000Z",
    app_balance: "100.004",
    bank_balance: "100.005",
    difference: 999,
    status: "matched",
    created_at: "2026-09-03T10:00:01.000Z",
  });

  assert.equal(normalized.userId, USER_ID);
  assert.equal(normalized.accountId, ACCOUNT_ID);
  assert.equal(normalized.currency, "USD");
  assert.equal(normalized.appBalance, 100);
  assert.equal(normalized.bankBalance, 100.01);
  assert.equal(normalized.difference, 0.01);
  assert.equal(normalized.differenceAmount, 0.01);
  assert.equal(normalized.status, "different");
  assert.equal(normalized.direction, "bank_higher");
  assert.equal(Object.isFrozen(normalized), true);
});

test("riwayat dinormalisasi tanpa mengubah input, diurutkan terbaru, dan dapat dicari per dompet", () => {
  const sourceRows = [
    {
      id: "older-a",
      user_id: USER_ID,
      account_id: "account-a",
      currency: "IDR",
      checked_at: "2026-09-01T08:00:00.000Z",
      app_balance: 100,
      bank_balance: 100,
    },
    {
      id: "newer-b",
      user_id: USER_ID,
      account_id: "account-b",
      currency: "IDR",
      checked_at: "2026-09-04T08:00:00.000Z",
      app_balance: 200,
      bank_balance: 190,
    },
    {
      id: "newest-a",
      user_id: USER_ID,
      account_id: "account-a",
      currency: "IDR",
      checked_at: "2026-09-03T08:00:00.000Z",
      app_balance: 150,
      bank_balance: 150,
    },
  ];
  const originalIds = sourceRows.map((row) => row.id);
  const normalized = normalizeAccountReconciliations(sourceRows);

  assert.deepEqual(
    normalized.map((row) => row.id),
    ["newer-b", "newest-a", "older-a"],
  );
  assert.deepEqual(sourceRows.map((row) => row.id), originalIds);
  assert.equal(getLatestAccountReconciliation(sourceRows)?.id, "newer-b");
  assert.equal(
    getLatestAccountReconciliation(sourceRows, "account-a")?.id,
    "newest-a",
  );
  assert.equal(getLatestAccountReconciliation(sourceRows, "missing"), null);
  assert.equal(Object.isFrozen(normalized), true);
});

test("migration menyimpan snapshot lewat RPC server-side dan membatasi akses ke pemilik", async () => {
  const migration = await readFile(
    new URL(
      "../supabase/migrations/20260904090000_account_reconciliations.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(
    migration,
    /create table if not exists public\.account_reconciliations/i,
  );
  assert.match(
    migration,
    /foreign key \(account_id, user_id\)[\s\S]*references public\.asset_accounts \(id, user_id\)[\s\S]*on delete cascade/i,
  );
  assert.match(
    migration,
    /account_reconciliations_user_account_checked_idx[\s\S]*user_id, account_id, checked_at desc/i,
  );
  assert.match(
    migration,
    /account_reconciliations_user_checked_idx[\s\S]*user_id, checked_at desc, created_at desc/i,
  );
  assert.match(
    migration,
    /difference = 0 and status = 'matched'[\s\S]*difference <> 0 and status = 'different'/i,
  );
  assert.match(
    migration,
    /alter table public\.account_reconciliations enable row level security/i,
  );
  assert.match(
    migration,
    /for select to authenticated[\s\S]*auth\.uid\(\)[\s\S]*user_id/i,
  );
  assert.doesNotMatch(migration, /for insert to authenticated/i);
  assert.doesNotMatch(
    migration,
    /grant\s+insert\s+on table public\.account_reconciliations/i,
  );
  assert.match(
    migration,
    /grant select on table public\.account_reconciliations to authenticated/i,
  );

  const rpc = migration.slice(
    migration.indexOf("create or replace function public.record_account_reconciliation"),
  );
  assert.match(rpc, /security definer\s+set search_path = ''/i);
  assert.match(rpc, /v_user_id uuid := auth\.uid\(\)/i);
  assert.match(
    rpc,
    /account\.id = p_account_id[\s\S]*account\.user_id = v_user_id[\s\S]*account\.is_archived = false[\s\S]*for update/i,
  );
  assert.match(rpc, /p_bank_balance is null or p_bank_balance < 0/i);
  assert.match(rpc, /v_account\.account_type not in \('bank', 'cash', 'ewallet'\)/i);
  assert.match(rpc, /v_account\.balance_amount/i);
  assert.match(rpc, /v_bank_balance - v_account\.balance_amount/i);
  assert.match(rpc, /when v_bank_balance = v_account\.balance_amount then 'matched'/i);
  assert.match(rpc, /now\(\),\s*v_account\.balance_amount/i);
  assert.doesNotMatch(rpc, /p_checked_at/i);
  assert.match(
    rpc,
    /grant execute on function public\.record_account_reconciliation[\s\S]*to authenticated/i,
  );

  assert.doesNotMatch(migration, /update\s+public\.asset_accounts/i);
  assert.doesNotMatch(migration, /delete\s+from/i);
  assert.doesNotMatch(migration, /\btruncate\b/i);
  assert.doesNotMatch(migration, /drop\s+table/i);
  assert.match(migration.trim(), /^--[\s\S]*\bbegin;/i);
  assert.match(migration.trim(), /commit;$/i);
});

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("selisih menawarkan jalan keluar, bukan sekadar dicatat", async () => {
  const form = await source(
    "src/components/assets/AccountReconciliationForm.js",
  );

  // Tindakan hanya muncul ketika saldonya memang berbeda.
  assert.match(form, /comparison && !comparison\.isMatched/);
  assert.match(form, /Periksa transaksi/);
  assert.match(form, /Catat yang tertinggal/);

  /* Arah transaksinya harus mengikuti arah selisih: bank lebih besar berarti
     ada pemasukan yang belum dicatat, bukan pengeluaran. */
  assert.match(
    form,
    /comparison\.direction === "bank_higher"\s*\?\s*"income"\s*:\s*"expense"/,
  );

  // Daftar periksa memakai mutasi dompet yang bersangkutan, bukan nominal
  // mentah transaksi, supaya sisi transfer yang benar yang ditampilkan.
  assert.match(form, /transactionBelongsToAccount\(transaction, account\.id\)/);
  assert.match(form, /getTransactionAccountActivity\(transaction, account\.id\)/);
});

test("nominal selisih hanya mengisi formulir, tidak menyimpan sendiri", async () => {
  const main = await source("src/main.js");
  const handler = main.match(
    /function handleRecordMissingTransaction\([\s\S]*?\n  \}/,
  );
  assert.ok(handler, "handleRecordMissingTransaction tidak ditemukan");

  // Membuka sheet, bukan memanggil penyimpanan.
  assert.match(handler[0], /setQuickEntryOpen\(true\)/);
  assert.doesNotMatch(handler[0], /handleCreateTransaction|supabase/);
});

test("nominal awal catat cepat tidak bocor antar pemanggil", async () => {
  const main = await source("src/main.js");

  /* Nominal awal hanya milik Cocokkan Saldo. Pemanggil lain wajib
     menyetelnya kembali ke nol, kalau tidak selisih dari pengecekan
     sebelumnya akan muncul di keypad catat cepat biasa. */
  const openers = [...main.matchAll(/setQuickEntryRequestKey\(/g)];
  const resets = [...main.matchAll(/setQuickEntryInitialAmount\(/g)];
  assert.ok(openers.length >= 3, "pemanggil catat cepat tidak ditemukan");
  assert.equal(
    resets.length,
    openers.length,
    "setiap pemanggil catat cepat harus menetapkan nominal awalnya sendiri",
  );

  // Hanya Cocokkan Saldo yang boleh mengisi nominal; sisanya wajib nol.
  const nilaiYangDisetel = resets.map((match) =>
    main.slice(match.index).match(/setQuickEntryInitialAmount\(([^)]*)\)/)[1],
  );
  assert.equal(nilaiYangDisetel.filter((nilai) => nilai === "0").length, 2);
});

test("status pengecekan sampai ke kartu dompet dan formulir", async () => {
  const [page, wealth, main] = await Promise.all([
    source("src/components/assets/WalletAccountsPage.js"),
    source("src/components/assets/WealthGoalsPage.js"),
    source("src/main.js"),
  ]);

  assert.match(page, /latestReconciliation=\$\{getLatestAccountReconciliation\(/);
  assert.match(page, /transactions=\$\{transactions\}/);
  assert.match(page, /onRecordMissingTransaction/);
  assert.match(wealth, /onRecordMissingTransaction=\$\{onRecordMissingTransaction\}/);
  assert.match(
    main,
    /onRecordMissingTransaction=\$\{handleRecordMissingTransaction\}/,
  );
});
