import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("halaman Dompet menyatukan Dompet dan Tabungan tanpa menggandakan total", async () => {
  const page = await source("src/components/assets/WalletAccountsPage.js");

  assert.match(page, />\s*Dompetmu\s*</);
  assert.match(page, />\s*Tabungan\s*</);
  assert.match(page, /Tambah dompet/);
  assert.match(page, /Tambah tabungan/);
  assert.doesNotMatch(page, /Kantong/i);
  assert.match(page, /metrics\.assetAccountTotalValueIdr/);
  assert.doesNotMatch(page, /assetAccountTotalValueIdr\s*\+\s*.*totalGoalSaved/);

  // Ringkasan atas membedakan tiga angka: total tercatat, yang bebas dipakai,
  // dan yang sudah disisihkan ke Tabungan.
  assert.match(page, /Semua uang yang kamu catat/);
  assert.match(page, /Bisa dipakai/);
  assert.match(page, /Disisihkan/);
});

test("Tabungan berdiri sebagai seksi turunan, bukan sejajar Dompet", async () => {
  const page = await source("src/components/assets/WalletAccountsPage.js");

  assert.match(page, /function GoalFundSection/);
  assert.match(page, /Dana ini bagian dari saldo dompet, bukan saldo tambahan/);

  // Daftar Dompet hanya boleh memetakan accounts. Tabungan dirender oleh
  // GoalFundSection di bawahnya, bukan sebagai baris sejajar di daftar yang
  // sama, supaya tidak terbaca sebagai saldo kedua.
  const walletList = page.slice(
    page.indexOf(">Dompetmu<"),
    page.indexOf("<${GoalFundSection}"),
  );
  assert.match(walletList, /accounts\.map/);
  assert.doesNotMatch(walletList, /goals\.map/);

  // Filter tab lama dihapus: kedua seksi kini selalu terlihat.
  assert.doesNotMatch(page, /cs-pocket-filter/);
  assert.doesNotMatch(page, /filter === "all"/);
});

test("baris Dompet menonjolkan dana bisa dipakai beserta saldo asalnya", async () => {
  const page = await source("src/components/assets/WalletAccountsPage.js");

  // Angka utama = availableBalance saat ada pencadangan, dengan saldo rekening
  // sebagai keterangan "dari ...". Tanpa pencadangan, angka utama = saldo asli.
  assert.match(page, /dari \$\{money\(balanceAmount, account\.currency\)\}/);
  assert.match(
    page,
    /hasReservedBalance \? availableBalance : balanceAmount/,
  );
  assert.match(page, /const fullyReserved = hasReservedBalance && availableBalance <= 0\.0001/);
  // Saat seluruh saldo tercadang, angka Rp 0 tidak boleh tampil hijau.
  assert.match(page, /fullyReserved \? "text-\[color:var\(--cs-mut\)\]" : ""/);
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
  // Panel mutasi di bawah daftar sudah dihapus. Riwayat aktivitas Tabungan
  // pindah ke dalam sheet rinciannya supaya tidak hilang aksesnya: alokasi dan
  // pelepasan bukan transaksi biasa, jadi tidak muncul di halaman Riwayat.
  assert.doesNotMatch(page, /<\$\{AccountActivity\}/);
  assert.match(page, /<\$\{GoalActivity\} goal=\$\{detailGoal\}/);

  // Pemilihan dan pengaturan tetap dua tombol terpisah walau tata letaknya
  // kini baris daftar: badan baris memilih mutasi, titik tiga membuka sheet.
  assert.match(page, /onSelect=\$\{\(\) => selectAccount\(account\)\}/);
  assert.match(page, /onManage=\$\{\(\) => manageAccount\(account\)\}/);
  assert.match(page, /onSelect=\$\{\(\) => onSelect\(goal\)\}/);
  assert.match(page, /onManage=\$\{\(\) => onManage\(goal\)\}/);
});

test("tambah dompet dan tambah tabungan punya tombolnya sendiri tanpa sheet pemilih", async () => {
  const wallet = await source("src/components/assets/WalletAccountsPage.js");
  const page = await source("src/components/assets/WealthGoalsPage.js");

  // Dua tombol terpisah menggantikan satu tile yang dulu membuka sheet pemilih.
  assert.match(wallet, /Tambah dompet/);
  assert.match(wallet, /Tambah tabungan/);
  assert.match(wallet, /onCreateWallet/);
  assert.match(wallet, /onCreateGoal/);

  // Sheet pemilih beserta state-nya sudah tidak ada lagi.
  assert.doesNotMatch(page, /showPocketChooser/);
  assert.doesNotMatch(page, /Pilih Dompet untuk saldo aktual/);

  // Kedua tombol menuju langsung ke formnya masing-masing.
  assert.match(page, /onCreateWallet=\$\{openAssetForm\}/);
  assert.match(page, /onCreateGoal=\$\{openGoalForm\}/);
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

test("Riwayat memakai segmented dan tombol saring seperti desain", async () => {
  const page = await source("src/components/transactions/TransactionHistoryPage.js");
  const parts = await source("src/components/transactions/HistoryListParts.js");
  const sheets = await source("src/components/transactions/HistoryToolSheets.js");

  // Tab aktif memakai pil tinta (selBg/selFg), bukan aksen hijau.
  assert.match(parts, /var\(--cs-sel-bg\)/);
  assert.match(parts, /var\(--cs-sel-fg\)/);
  assert.doesNotMatch(parts, /bg-brand-600/);

  // Toolbar hanya segmented + satu tombol saring berbadge.
  assert.match(page, /aria-label=\$\{advancedFilterCount/);
  assert.doesNotMatch(page, /history-filter-panel/);

  // Pencarian dan unduh mutasi tidak boleh hilang: keduanya pindah ke sheet.
  assert.match(sheets, /showSearch=\$\{true\}/);
  assert.match(sheets, /Unduh mutasi bulanan/);
  assert.match(page, /onExport=\$\{\(\) => setExportSheetOpen\(true\)\}/);
});

test("Jatah memakai baris kategori yang bisa dibuka seperti desain", async () => {
  const page = await source("src/components/budget/BudgetWorkspacePage.js");
  const history = await source("src/components/transactions/TransactionHistoryPage.js");

  // Header dan aksi mengikuti desain: "Per kategori" + tautan "Atur",
  // serta "+ Tambah kategori" di dasar kartu.
  assert.match(page, />Per kategori</);
  assert.match(page, /Tambah kategori/);
  assert.doesNotMatch(page, /Batas Anggaran Bulanan/);

  // Baris kategori dapat dibuka dan memunculkan catatan beserta tiga aksi.
  assert.match(page, /aria-expanded=\$\{open\}/);
  assert.match(page, /Atur jatah/);
  assert.match(page, /Lihat transaksinya/);

  // Kartu kategori lama beserta warna acaknya sudah dihapus, bukan disembunyikan.
  assert.doesNotMatch(page, /CATEGORY_COLORS/);
  assert.doesNotMatch(page, /\$\{false/);

  // "Lihat transaksinya" harus benar benar menyaring Riwayat, bukan sekadar
  // membuka daftar penuh.
  assert.match(page, /onOpenCategoryHistory\?\.\(budget\)/);
  assert.match(history, /if \(!focusCategory\) return;/);
});

test("catat uang memakai sheet keypad seperti desain", async () => {
  const sheet = await source("src/components/transactions/QuickEntrySheet.js");
  const main = await source("src/main.js");

  // Susunan keypad datang dari lib, dan tombol kiri bawahnya mengikuti
  // pecahan mata uang dompet yang sedang dipilih.
  assert.match(sheet, /keypad = buildKeypad\(fractionDigits\)/);
  assert.match(sheet, /getCurrencyMeta\(currency\)\.fractionDigits/);
  assert.match(sheet, /Catat transaksi/);
  assert.match(sheet, /Berapa\?/);
  assert.match(sheet, />\s*Nanti\s*</);
  assert.match(sheet, /Simpan catatan/);
  assert.match(sheet, /Isi jumlahnya dulu/);

  // Segmented Keluar/Masuk memakai pil tinta, bukan aksen hijau.
  assert.match(sheet, /var\(--cs-sel-bg\)/);

  // FAB dan tile Catat membuka sheet ini, bukan form halaman penuh.
  assert.match(main, /onAddTransaction=\$\{openQuickEntry\}/);
  assert.match(main, /function openQuickEntry\(\)/);

  // Form lengkap tidak boleh hilang: tetap dapat dibuka dari dalam sheet untuk
  // tanggal, dompet non-utama, transfer, dan tukar mata uang.
  assert.match(sheet, /onOpenFullForm/);
  assert.match(main, /onOpenFullForm=\$\{\(entryType\) => openTransactionForm\(entryType\)\}/);
});
