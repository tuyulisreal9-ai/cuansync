import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("halaman Dompet menyatukan Dompet dan Tabungan tanpa menggandakan total", async () => {
  const page = await source("src/components/assets/WalletAccountsPage.js");

  assert.match(page, />\s*Dompet\s*</);
  assert.match(page, />\s*Tabungan\s*</);
  assert.match(page, /\+ Tambah Baru/);
  assert.doesNotMatch(page, /Kantong/i);
  assert.match(page, /metrics\.assetAccountTotalValueIdr/);
  assert.doesNotMatch(page, /assetAccountTotalValueIdr\s*\+\s*.*totalGoalSaved/);
});

test("rincian Tabungan membuka popup, menampilkan asal dana, dan dapat dipakai", async () => {
  const page = await source("src/components/assets/WalletAccountsPage.js");

  assert.match(page, /<\$\{SheetShell\}/);
  assert.match(page, /Sumber dana tercatat/);
  assert.match(page, /goal\.accountBreakdown/);
  assert.match(page, /Sumber belum dipetakan/);
  assert.match(page, /Alokasi virtual/);
  assert.match(page, /Gunakan tabungan/);
  assert.match(page, /onUseGoal/);
});

test("klik kartu hanya memilih mutasi sedangkan titik tiga membuka pengaturan", async () => {
  const page = await source("src/components/assets/WalletAccountsPage.js");

  assert.match(page, /aria-label=\$\{`Lihat mutasi \$\{account\.name\}`\}/);
  assert.match(page, /aria-label=\$\{`Kelola \$\{account\.name\}`\}/);
  assert.match(page, /aria-label=\$\{`Lihat aktivitas \$\{goal\.name\}`\}/);
  assert.match(page, /function selectAccount\(account\)/);
  assert.match(page, /function manageAccount\(account\)/);
  assert.match(page, /function selectGoal\(goal\)/);
  assert.match(page, /function manageGoal\(goal\)/);
  assert.match(page, /<\$\{GoalActivity\} goal=\$\{selectedGoal\}/);
  assert.match(page, /Aktivitas →/);
});

test("tile Tambah Baru membuka pilihan Dompet atau Tabungan", async () => {
  const page = await source("src/components/assets/WealthGoalsPage.js");

  assert.match(page, /title="Tambah Baru"/);
  assert.match(page, />Dompet</);
  assert.match(page, />Tabungan</);
  assert.match(page, /Dana tabungan dengan dompet sumber yang jelas/);
  assert.doesNotMatch(page, /Kantong/i);
});

test("form pengeluaran memakai ringkasan sumber dana yang compact", async () => {
  const page = await source("src/components/transactions/TransactionForm.js");

  assert.match(page, /cs-entry-funding-compact/);
  assert.match(page, /expenseFundingTitle/);
  assert.match(page, /fundingPickerOpen/);
  assert.match(page, /Saldo Dompet/);
  assert.match(page, /Opsi lainnya/);
  assert.match(page, /grid-cols-\[minmax\(0,1\.15fr\)_minmax\(0,\.85fr\)\]/);
  assert.doesNotMatch(page, /Ambil dana dari/);
  assert.doesNotMatch(page, /Pengeluaran akan mengurangi saldo Dompet/);
  assert.doesNotMatch(page, /Gunakan target|Tanpa target/);
});
