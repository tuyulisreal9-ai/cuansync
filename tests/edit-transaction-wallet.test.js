import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

const SHEET = "src/components/transactions/TransactionDetailSheet.js";
const HISTORY = "src/components/transactions/TransactionHistoryPage.js";
const MAIN = "src/main.js";

test("dompet bisa diganti saat mengubah transaksi", async () => {
  const sheet = await source(SHEET);

  /* Dulu ketiga daftar dipersempit menjadi dompet asal saja, sehingga salah
     pilih dompet hanya bisa diperbaiki dengan menghapus lalu mencatat ulang.
     Jalur simpannya sendiri sudah lama sanggup: klien membalik mutasi dompet
     lama lalu menerapkan yang baru, dan update_transaction_atomic mengunci
     keempat akun sebelum menghitung ulang saldo. */
  for (const [nama, pola] of [
    ["entry", /const selectableEntryAccounts = getSelectableAssetAccounts\(/],
    ["source", /const sourceAccountOptions = getSelectableAssetAccounts\(/],
    [
      "destination",
      /const destinationAccountOptions = getSelectableAssetAccounts\(/,
    ],
  ]) {
    assert.match(sheet, pola, `daftar dompet ${nama} harus dari daftar penuh`);
  }

  // Penyempitan lama selalu memakai id dari transaksi yang sedang dibuka.
  assert.doesNotMatch(
    sheet,
    /allEntryAccountOptions|allSourceAccountOptions|allDestinationAccountOptions/,
    "daftar dompet tidak boleh dikunci lagi ke dompet asal",
  );

  // Dompet tujuan tetap tidak boleh sama dengan dompet asal.
  assert.match(
    sheet,
    /\.filter\(\(account\) => account\.id !== form\.source_account_id\)/,
  );
});

test("pengeluaran berdana target dibatasi ke dompet pendana", async () => {
  const sheet = await source(SHEET);

  /* Aturannya disalin dari record_transaction_atomic, yang menolak sumber di
     luar goal_funding_accounts dengan "Target tidak terhubung ke akun sumber
     transaksi". Tanpa salinan ini, penolakan baru muncul setelah Simpan. */
  assert.match(sheet, /funding\.goal_id === goalTargetId/);
  assert.match(
    sheet,
    /normalizeCurrencyCode\(funding\.currency\) === transactionCurrency/,
  );
  assert.match(sheet, /goalFundingAccountIds\.has\(account\.id\)/);

  // Hanya pengeluaran yang bisa memakai dana target.
  assert.match(sheet, /const goalTargetId = isExpense \? transaction\.target_id/);
});

test("data pendana target sampai ke form edit", async () => {
  const [sheet, history, main] = await Promise.all([
    source(SHEET),
    source(HISTORY),
    source(MAIN),
  ]);

  assert.match(main, /goalFundingAccounts=\$\{goalFundingAccounts\}/);
  assert.match(history, /goalFundingAccounts = \[\],/);
  assert.match(history, /goalFundingAccounts=\$\{goalFundingAccounts\}/);
  assert.match(sheet, /goalFundingAccounts = \[\],/);
  assert.match(sheet, /goalFundingAccounts=\$\{goalFundingAccounts\}/);
});

test("form edit bertahan saat penyimpanan ditolak", async () => {
  const sheet = await source(SHEET);

  /* onClose adalah fungsi anonim milik induk, jadi identitasnya berubah tiap
     render. Selama ia menjadi dependensi efek yang memanggil setIsEditing,
     penolakan simpan menutup form dan membuang isian pengguna. */
  const efekReset = sheet.match(
    /useEffect\(\(\) => \{\s*if \(!transaction\) return;[\s\S]*?\}, \[([^\]]*)\]\);/,
  );
  assert.ok(efekReset, "efek yang mengatur ulang form edit tidak ditemukan");
  assert.match(efekReset[1], /^\s*transaction\s*$/);
  assert.match(efekReset[0], /setIsEditing\(false\)/);
  assert.match(efekReset[0], /setEditForm\(getTransactionEditForm\(transaction\)\)/);

  // Form hanya ditutup ketika pembaruan benar benar berhasil.
  assert.match(
    sheet,
    /const succeeded = await onUpdate\(transaction, nextForm\);\s*if \(succeeded\) \{/,
  );
});
