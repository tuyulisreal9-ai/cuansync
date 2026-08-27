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
  assert.match(page, /Total uang tercatat/);
  assert.match(page, /Bisa dipakai/);
  assert.match(page, /Dana dicadangkan/);
});

test("tampilan Semua menempatkan Tabungan sebagai bagian dana dari Dompet sumber", async () => {
  const page = await source("src/components/assets/WalletAccountsPage.js");

  assert.match(page, /function getAccountGoalAllocations/);
  assert.match(page, /Dicadangkan untuk/);
  assert.match(page, /allocations=\$\{getAccountGoalAllocations\(account, goals\)\}/);
  assert.doesNotMatch(page, /filter === "all" \|\| filter === "saving"/);
  assert.match(page, /Dana ini bagian dari saldo dompet, bukan saldo tambahan/);

  const walletGrid = page.slice(
    page.indexOf("${showsAccounts"),
    page.indexOf("${showsGoals"),
  );
  assert.match(walletGrid, /accounts\.map/);
  assert.doesNotMatch(walletGrid, /goals\.map/);
});

test("Tabungan berdiri sebagai seksi turunan, bukan kartu sejajar Dompet", async () => {
  const page = await source("src/components/assets/WalletAccountsPage.js");

  assert.match(page, /function GoalFundSection/);
  assert.match(page, /const showsAccounts = filter !== "saving"/);
  assert.match(page, /const showsGoals = filter !== "pay"/);
  assert.match(page, /Dicadangkan dari dompet di atas, bukan saldo tambahan/);
  assert.match(page, /\["all", "Semua", accounts\.length \+ goals\.length\]/);
});

test("kartu Dompet menonjolkan dana bisa dipakai beserta saldo asalnya", async () => {
  const page = await source("src/components/assets/WalletAccountsPage.js");

  assert.match(page, /dari \$\{formatCurrency\(balanceAmount, account\.currency\)\}/);
  assert.match(page, /const reservedRatio = balanceAmount > 0\.0001/);
  assert.match(page, /cs-pocket-split-reserved/);
  assert.match(page, /fullyReserved \? "text-slate-500 dark:text-slate-400" : "text-emerald-500"/);
  assert.doesNotMatch(page, /dicadangkan`\s*:\s*""/);
});

test("dompet utama dapat dilepas kembali, bukan hanya dipindah", async () => {
  const page = await source("src/components/assets/WalletAccountsPage.js");
  const main = await source("src/main.js");

  assert.match(page, /clear: Boolean\(account\.isPrimary\)/);
  assert.match(page, /Lepas dari utama/);
  assert.doesNotMatch(page, /Utama pengeluaran/);

  assert.match(main, /const clearPrimary = options\.clear === true/);
  assert.match(main, /\.\.\.\(clearPrimary \? \[\] : \[preference\]\)/);
  assert.match(main, /!clearPrimary && item\.id === preference\.account_id/);
  assert.match(main, /from\("account_preferences"\)\s*\n?\s*\.delete\(\)/);
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
