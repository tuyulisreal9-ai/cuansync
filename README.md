# CuanSync

Aplikasi web pengatur keuangan pribadi untuk alur multi-mata uang:

- Pendapatan utama dalam `IDR`
- Pengeluaran operasional dalam `IDR`, `THB`, `USD`, `AUD`, `KRW`, dan currency aktif lain
- Flow `Tukar Mata Uang` terpisah dari income/expense
- Exchange mengurangi saldo currency asal dan menambah saldo currency tujuan
- Expense foreign currency tetap masuk pengeluaran dengan valuasi base currency
- Google OAuth melalui Supabase
- Aplikasi Android native melalui Capacitor 8, dengan safe area, deep link OAuth,
  splash screen, status bar, keyboard resize, dan tombol kembali Android
- Progressive Web App (PWA) yang dapat dipasang dari browser yang mendukung
- Dashboard responsif dengan dark mode
- Tab `Anggaran & Target` untuk batas kategori dan rencana dana per mata uang
- Budget tracker universal `uang keluar` dengan indikator overspending
- Overspending canggih: limit bulanan otomatis dipecah jadi batas aman harian dinamis (`sisa budget / sisa hari`)
- Target seperti dana darurat, mudik, dan liburan memakai alokasi dana per rekening dan mata uang
- Alokasi target tidak mengubah saldo rekening dan tidak menambah total aset
- Setiap rekening menampilkan saldo aktual, dana target yang dilindungi, dan dana yang tersedia dipakai
- Bank & wallet tracker untuk mencatat beberapa akun seperti BCA IDR, Wise USD, Cash, atau bank luar negeri
- Valuasi aset multi-currency memakai global current rate, bukan rate tukar historis

## Mata uang yang didukung

- Asia: `IDR`, `THB`, `SGD`, `MYR`, `JPY`, `KRW`, `TWD`, `HKD`, `CNY`, `VND`, `PHP`, `INR`, `LKR`
- Timur Tengah: `SAR`, `AED`
- Global: `USD`, `AUD`, `EUR`, `GBP`

Pemilih mata uang utama mendukung pencarian berdasarkan kode, negara, dan nama
mata uang. Contohnya: `LKR`, `Sri Lanka`, `Rupee Sri Lanka`, `Taiwan`,
`Hong Kong`, dan `Yuan`.

## Struktur

- `index.html`: entry aplikasi
- `src/main.js`: UI React, auth, orchestration transaksi, dashboard
- `src/config.js`: konfigurasi Supabase
- `src/lib/currency.js`: metadata, formatter, dan helper currency
- `src/lib/exchangeRates.js`: global current rate untuk valuasi saldo/aset
- `src/styles.css`: tampilan modern + dark mode
- `supabase/schema.sql`: tabel dan kebijakan RLS
- `server.mjs`: server lokal ringan tanpa dependency tambahan

## Menjalankan aplikasi

1. Buka `src/config.js`.
2. Isi `SUPABASE_URL` dan `SUPABASE_ANON_KEY` jika ingin mode produksi.
3. Jalankan server lokal:

```bash
node server.mjs
```

4. Buka [http://localhost:4173](http://localhost:4173).

Jika `src/config.js` masih kosong, aplikasi tetap bisa dijalankan melalui **Demo Lokal** dan semua data disimpan di browser.

## Menjalankan aplikasi Android

Project Android berada di folder `android` dan memakai application ID
`com.cuansync.app`.

```powershell
pnpm install
pnpm mobile:sync
pnpm mobile:open
```

Untuk membuat APK debug yang dapat dipasang:

```powershell
pnpm mobile:apk
```

Hasil build tersedia di `artifacts/CUANSYNC-debug.apk` (folder artefak tidak
disimpan ke Git).

Untuk login Google dari aplikasi, tambahkan
`com.cuansync.app://auth/callback` ke daftar redirect URL Supabase. Panduan build
APK, signing AAB, pengujian, dan rilis lengkap ada di
[`docs/MOBILE_RELEASE.md`](docs/MOBILE_RELEASE.md).

## Setup Supabase

1. Buat project Supabase.
2. Jalankan SQL dasar dari `supabase/schema.sql`.
3. Terapkan file di `supabase/migrations` menurut urutan timestamp. Migration
   `20260821090000_account_aware_goal_integrity.sql` wajib untuk sumber rekening
   target, preferensi rekening utama, dan RPC transaksi atomik.
4. Di menu `Authentication > Providers`, aktifkan `Google`.
5. Tambahkan redirect URL:

```text
http://localhost:4173
```

6. Salin `Project URL` dan `anon public key` ke `src/config.js`.

Untuk database yang sudah memiliki data lama, jalankan
`supabase/safe_expense_category_migration.sql`. Migrasi ini memindahkan
`Internet & Pulsa` ke `Tagihan`, mengubah `Transport` menjadi `Transportasi`,
dan menggabungkan limit budget yang bertabrakan tanpa mengubah nominal
transaksi.

## Logika exchange dan kurs terkunci

1. Tukar mata uang dicatat sebagai `type = exchange`, bukan income dan bukan expense.
2. Struktur exchange menyimpan `from_currency`, `to_currency`, `from_amount`, `to_amount`, dan `rate`.
3. Pemasukan dan pengeluaran bisa dikaitkan ke bank/cash/e-wallet sehingga saldo akun ikut berubah.
4. Exchange menyimpan riwayat kurs khusus transaksi tukar uang, bukan patokan total uang hari ini.
5. Expense foreign currency mengambil `locked_rate` dari rate transaksi atau exchange terakhir yang relevan.
6. Nilai ekuivalen base currency disimpan di `base_amount` agar histori tetap konsisten meski ada rate baru setelahnya.
7. Total kekayaan dan aset foreign currency memakai global current rate dari Open Access ExchangeRate-API, dengan cache lokal.

## Modul baru

- `Dashboard Interaktif`: chart harian dan insight kategori berubah otomatis setiap kali transaksi ditambah atau dihapus.
- `Tab Operasional Harian`: transaksi + chart + budget universal uang keluar ada di tab utama.
- `Overspending Guard`: satu limit uang keluar per bulan akan berubah jadi warning atau merah saat terlewati.
- `Anggaran & Target`: batas pengeluaran bulanan, ringkasan dana likuid, dan tujuan alokasi per mata uang.

## Tabel database

- `transactions`: menyimpan pemasukan, exchange, dan expense harian.
- `budgets`: limit budget bulanan universal untuk uang keluar.
- Kategori pengeluaran aktif: Makan Harian, Belanja Kebutuhan, Transportasi,
  Tagihan, Kesehatan, Tempat Tinggal, Hiburan & Gaya Hidup, dan Lainnya.
- `goals`: tujuan, nominal, jenis target, mata uang, status, dan batas waktu opsional.
- `goal_allocations`: ledger alokasi per rekening; baris lama tanpa sumber dipertahankan sebagai `unmapped_legacy` dan tidak mengunci saldo.
- `goal_funding_accounts`: rekening sumber yang sah untuk setiap target.
- `asset_accounts`: daftar bank, cash, e-wallet, dan akun investasi per mata uang, termasuk peran akun dan status arsip.
- `account_preferences`: rekening utama per mata uang dan jenis alur transaksi.
- `transactions.source_account_id` / `transactions.destination_account_id`: relasi opsional agar pengeluaran dan pemasukan bisa mengubah saldo akun.

## Catatan implementasi

- Stack UI: React 18 + Tailwind CSS via CDN
- Database/Auth: Supabase JS v2 via CDN
- Mode demo dibuat agar prototipe tetap bisa dicoba tanpa kredensial
