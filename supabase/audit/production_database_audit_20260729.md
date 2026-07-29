# Audit Database Production CUANSYNC

Tanggal audit: 2026-07-29

Status awal: audit metadata dan agregat baca-saja.

Pembaruan 2026-07-30: setelah persetujuan pengguna, migrasi darurat
`is_allocatable` diterapkan ke production dan berhasil diverifikasi. Tidak ada
perubahan pada transaksi, anggaran, target, RLS, policy, deployment, atau
migration history.

## Hasil penerapan 2026-07-30

SQL yang dijalankan tercatat di:

`supabase/manual_migrations/20260730_add_asset_accounts_is_allocatable.sql`

Hasil sebelum migrasi:

- `is_allocatable` belum ada.
- `asset_accounts`: 2 row, semuanya `bank`.
- `transactions`: 60 row.
- `budgets`: 7 row.
- `goals`: 2 row.
- RLS `asset_accounts`: aktif.

Hasil setelah migrasi:

- `is_allocatable` tersedia sebagai `boolean`, nullable, tanpa default.
- Dua akun lama berhasil di-backfill menjadi `true`.
- Nilai `NULL`: 0.
- `asset_accounts`: tetap 2 row.
- `transactions`: tetap 60 row.
- `budgets`: tetap 7 row.
- `goals`: tetap 2 row.
- RLS tetap aktif dan empat policy tetap tersedia.

Verifikasi aplikasi:

- Halaman dompet berhasil dimuat tanpa error schema.
- Form tambah dompet berhasil dibuka.
- Pilihan IDR, THB, USD, AUD, KRW, JPY, SGD, MYR, EUR, dan GBP tersedia.
- USD dapat dipilih dan label saldo berubah ke USD.
- Tidak ada akun uji yang disimpan ke data pengguna.
- Seluruh 31 tes domain lokal lulus.

## Project yang diverifikasi

- Supabase project ref: `kltwuquisrequgralzzh`
- Dashboard yang diperiksa:
  `https://supabase.com/dashboard/project/kltwuquisrequgralzzh/sql/new`
- Konfigurasi source lokal juga menunjuk ke project ref yang sama.
- Pemeriksaan berhenti bila project ref berbeda. Kondisi itu tidak terjadi.

## Batasan alat

`supabase`, `npm`, `npx`, dan `pg_dump` tidak tersedia pada PATH. Pemasangan
sementara Supabase CLI sudah diminta melalui mekanisme resmi, tetapi eksekusi
paket eksternal ditolak oleh pengaman lingkungan. Karena itu:

- `supabase migration list` belum dapat dijalankan.
- `supabase db push --dry-run` belum dapat dijalankan.
- Schema-only `pg_dump` asli belum dapat dibuat.

Dokumen ini adalah snapshot metadata production yang diperoleh langsung melalui
query `SELECT` di SQL Editor Supabase. Ini bukan pengganti permanen untuk
schema-only dump.

## Query baca-saja yang dijalankan

Kelompok query yang dijalankan:

- `information_schema.columns`, `information_schema.tables`, dan
  `information_schema.schemata`
- `pg_class`, `pg_namespace`, `pg_constraint`, `pg_indexes`, `pg_trigger`,
  `pg_proc`, dan `pg_policies`
- `aclexplode` untuk grants tabel
- Agregat `count`, `filter`, `group by`, dan `exists` untuk pemeriksaan
  integritas tanpa menampilkan row pengguna
- Pemeriksaan `auth.users` hanya berupa jumlah dan relasi orphan

Tidak ada nama akun, saldo per akun, email, catatan transaksi, atau row pribadi
yang diambil.

## Ringkasan utama

1. Error `is_allocatable` bukan masalah cache saja. Kolom tersebut benar-benar
   tidak ada secara fisik pada `public.asset_accounts`.
2. RLS seluruh delapan tabel publik aktif dan mempunyai policy CRUD yang
   membatasi row dengan `auth.uid()`.
3. Schema production tertinggal dari source saat ini pada exchange, target,
   alokasi target, dan indeks unik anggaran.
4. RPC `create_exchange_transaction_atomic(jsonb)` belum terpasang.
5. Production tidak mempunyai migration history Supabase.
6. Data yang diperiksa bersih dari orphan lintas-user, currency invalid, saldo
   negatif, dan duplikasi budget berdasarkan kategori.
7. Seluruh 60 transaksi lama belum terhubung ke `asset_accounts` karena semua
   referensi source/destination masih `NULL`.

## Schema aktual

### `asset_accounts`

Kolom fisik production:

| Posisi | Kolom | Tipe | Nullable | Default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | tidak | `gen_random_uuid()` |
| 2 | `user_id` | `uuid` | tidak | - |
| 3 | `name` | `text` | tidak | - |
| 4 | `account_type` | `text` | tidak | `'bank'` |
| 5 | `currency` | `text` | tidak | `'IDR'` |
| 6 | `balance_amount` | `numeric(18,4)` | tidak | `0` |
| 7 | `note` | `text` | ya | - |
| 8 | `created_at` | `timestamptz` | tidak | `now()` |
| 9 | `updated_at` | `timestamptz` | ya | - |

`is_allocatable` tidak ada.

Constraint:

- Primary key pada `id`.
- Foreign key `user_id -> auth.users(id) ON DELETE CASCADE`.
- `account_type` dibatasi ke `bank`, `cash`, `ewallet`, `investment`, `other`.
- `currency` wajib tiga huruf kapital.
- `balance_amount >= 0`.
- Ada dua constraint account type dan dua constraint saldo yang setara.
  Duplikasi ini tidak merusak data, tetapi perlu dirapikan dalam baseline nanti.

Index:

- `asset_accounts_pkey`
- `asset_accounts_user_created_idx (user_id, created_at DESC)`
- `asset_accounts_user_currency_idx (user_id, currency)`

Trigger non-internal: tidak ada.

### Tabel publik lain

| Tabel | Status production | Perbedaan penting dengan source saat ini |
|---|---|---|
| `transactions` | ada, 26 kolom | kehilangan 7 kolom exchange/target dan memiliki 3 kolom wallet lama |
| `budgets` | ada, 9 kolom | kolom sesuai, tetapi unique index masih berdasarkan `group_key` |
| `goals` | ada, 7 kolom lama | kehilangan 8 kolom model target baru |
| `goal_allocations` | tidak ada | source dan UI saat ini menggunakannya |
| `profiles` | ada, 11 kolom | sesuai model profil saat ini |
| `user_currencies` | ada, 8 kolom | `user_id` masih nullable secara fisik |
| `user_settings` | ada, 8 kolom | hanya 1 dari 13 user memiliki row |
| `wallets` | ada, 14 kolom | tabel legacy, kosong, dan tidak ada di source saat ini |

Kolom `transactions` yang dibutuhkan source tetapi tidak ada di production:

- `rate_base_currency`
- `rate_quote_currency`
- `exchange_rate`
- `rate_type`
- `fee_amount`
- `fee_currency`
- `target_id`

Kolom transaction legacy yang hanya ada di production:

- `wallet_id`
- `from_wallet_id`
- `to_wallet_id`

Kolom `goals` yang dibutuhkan source tetapi tidak ada di production:

- `currency`
- `target_amount`
- `target_type`
- `status`
- `note`
- `completed_at`
- `archived_at`
- `updated_at`

## RLS, policy, dan grants

RLS aktif pada:

- `asset_accounts`
- `budgets`
- `goals`
- `profiles`
- `transactions`
- `user_currencies`
- `user_settings`
- `wallets`

Masing-masing tabel memiliki empat policy untuk `SELECT`, `INSERT`, `UPDATE`,
dan `DELETE`. Seluruh policy yang diperiksa memakai kondisi kepemilikan
`auth.uid()`.

Policy `asset_accounts`:

| Operasi | Role policy | USING | WITH CHECK |
|---|---|---|---|
| `SELECT` | `public` | `auth.uid() = user_id` | - |
| `INSERT` | `public` | - | `auth.uid() = user_id` |
| `UPDATE` | `public` | `auth.uid() = user_id` | `auth.uid() = user_id` |
| `DELETE` | `public` | `auth.uid() = user_id` | - |

Policy untuk role `public` tetap menolak anon yang tidak mempunyai
`auth.uid()`, karena nilai `NULL` tidak sama dengan `user_id`.

Table grants `asset_accounts`:

- `anon`: `DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE`
- `authenticated`: privilege yang sama
- `PUBLIC`: tidak ada privilege langsung

RLS menjaga akses per-row melalui Data API. Grants `TRUNCATE`, `TRIGGER`,
`REFERENCES`, dan `MAINTAIN` lebih luas dari kebutuhan aplikasi dan harus
ditinjau sebagai hardening terpisah. Tidak ada SQL endpoint atau RPC production
yang ditemukan yang memungkinkan role anon menjalankan operasi table-level
tersebut.

## Function dan RPC

Function public production hanya:

1. `handle_new_user_profile()`
   - `SECURITY DEFINER`
   - owner `postgres`
   - `search_path=public`
   - hanya dipasang sebagai trigger setelah insert pada `auth.users`
2. `set_updated_at()`
   - `SECURITY INVOKER`
   - hanya dipasang pada update tabel legacy `wallets`

Keduanya masih memiliki default execute untuk `PUBLIC`, `anon`, dan
`authenticated`. Karena return type-nya trigger, function tersebut tidak dapat
dipakai seperti RPC biasa, tetapi grants dapat dipersempit dalam hardening
berikutnya.

`create_exchange_transaction_atomic(jsonb)` tidak ada di production.

Draft RPC dalam repository sudah mempunyai karakteristik yang benar:

- `SECURITY INVOKER`
- `auth.uid()` sebagai sumber user
- validasi kepemilikan kedua akun
- `SELECT ... FOR UPDATE` untuk row locking
- transaksi, pemotongan, dan penambahan saldo dilakukan dalam satu function
- `search_path=public`

Sebelum diterapkan, default execute untuk `PUBLIC` dan `anon` sebaiknya dicabut
dan hanya `authenticated` yang diberi execute.

## Constraint dan index penting

`transactions` mempunyai foreign key valid ke:

- `auth.users`
- `asset_accounts` untuk source dan destination
- tabel legacy `wallets`

Constraint `transactions_currency_code_chk` dan `transactions_shape_chk`
berstatus `NOT VALID`. Artinya aturan berlaku untuk row baru, tetapi belum
divalidasi terhadap seluruh row lama. Audit agregat saat ini tidak menemukan
row yang melanggar bentuk dasar tersebut.

`budgets_currency_code_chk` juga `NOT VALID`.

Unique index production:

`budgets_user_month_group_currency_idx
(user_id, month_key, group_key, currency)`

Index ini membatasi satu budget per group, bukan satu budget per kategori.
Inilah penyebab error duplicate key saat beberapa kategori dengan `group_key`
yang sama dibuat pada bulan dan currency yang sama.

Index yang dibutuhkan source:

`(user_id, month_key, currency,
lower(trim(coalesce(category, group_key))))`

## Hasil integritas data

### Akun aset

- Total akun: 2
- `account_type`: `bank` = 2
- Currency: `IDR` = 2
- Currency kosong/invalid: 0
- Akun tanpa user: 0
- Saldo negatif: 0
- Duplicate group: 0
- Akun foreign currency: 0

Default `IDR` dan regex tiga huruf tidak menghalangi USD, AUD, THB, JPY, atau
currency tiga huruf lain. Insert foreign account gagal lebih awal karena source
selalu mengirim `is_allocatable`, sedangkan kolom itu tidak ada.

### Transaksi

- Total: 60
- Expense: 53
- Income: 4
- Exchange: 3
- Currency income/expense: IDR 8, THB 49
- Pasangan exchange: IDR/THB 3
- Source account terisi: 0
- Destination account terisi: 0
- Legacy wallet reference terisi: 0
- Orphan source/destination: 0
- Referensi akun milik user berbeda: 0
- Source sama dengan destination: 0
- Exchange dengan currency sama: 0
- Currency invalid: 0

Tidak ada orphan karena referensinya kosong. Ini juga berarti transaksi lama
belum menjadi ledger untuk dua row `asset_accounts` yang ada.

### Anggaran

- Total: 7
- Orphan user: 0
- Category kosong: 0
- Currency invalid: 0
- Limit negatif: 0
- Label legacy `Internet & Pulsa`: 0
- Label legacy `Transport`: 0
- Duplicate kategori/bulan/currency: 0

Data siap untuk mengganti unique index lama tanpa proses merge tambahan, tetapi
tetap harus diuji pada staging.

### Target

- Total: 2
- Orphan user: 0
- Target tidak valid: 0
- Saved negatif: 0
- Saved melebihi target: 0
- Tabel `goal_allocations`: tidak ada

Tidak ada relasi target/alokasi ke account yang dapat diaudit karena model
production lama belum mempunyai relasi tersebut.

### Preferensi currency

- `user_currencies`: 23 row
- Kode: IDR 13, THB 10
- User tanpa row currency: 0
- User tanpa base flag: 0
- User tanpa daily flag: 0
- Duplicate user/currency: 0
- Multiple base atau daily flag: 0
- Currency akun yang tidak terdaftar: 0
- `profiles`: 13 row untuk 13 user
- `user_settings`: 1 row; 12 user belum mempunyai row

Saat ini ada tiga sumber preferensi yang tumpang tindih:
`profiles`, `user_currencies`, dan `user_settings`. Aplikasi mempunyai fallback,
tetapi baseline berikutnya perlu menetapkan satu sumber utama.

### Wallet legacy

- Total row: 0
- Tabel tetap mempunyai RLS dan policy lengkap
- Tidak ada transaksi yang mengacu ke tabel ini

## Migration history

Schema `supabase_migrations` tidak ada di production. Tidak ada tabel
`schema_migrations` dan tidak ada versi remote yang dapat dibandingkan.

Repository juga belum memakai folder migration bertimestamp. File di folder
`supabase` berupa schema gabungan dan beberapa script mandiri. Jangan menandai
baseline sebagai applied pada tahap ini.

## Perbedaan repository dan production

Objek hanya atau lebih lengkap di repository:

- Kolom `asset_accounts.is_allocatable`
- Tujuh kolom transaksi exchange/target
- Delapan kolom model goal baru
- Tabel `goal_allocations`
- Trigger sinkronisasi alokasi target
- RPC exchange atomik
- Unique index budget berbasis kategori

Objek hanya di production:

- Tabel legacy `wallets` yang kosong
- Tiga kolom referensi wallet legacy pada `transactions`

Objek yang berasal dari schema lama:

- Definisi lengkap `asset_accounts` ada pada salinan repo lama
  `apa/cuansync/supabase/schema.sql`.
- `supabase/schema.sql` repo utama saat ini hanya menambah
  `is_allocatable` jika tabel `asset_accounts` sudah ada. Jadi file itu belum
  merupakan baseline mandiri yang aman untuk database kosong.

## Root cause final

`handleCreateAssetAccount` selalu mengirim field `is_allocatable` pada insert.
PostgREST memvalidasi payload terhadap schema fisik production. Karena kolom
tersebut tidak ada, request gagal dengan pesan bahwa column tidak ditemukan di
schema cache.

Ini bukan kegagalan khusus foreign currency. Semua jenis akun baru dapat gagal
dengan payload source saat ini.

Exchange juga belum dapat bekerja penuh setelah perbaikan kolom tersebut,
karena source memanggil RPC yang belum ada dan mengirim kolom exchange yang
belum ada di production.

Target baru juga gagal disimpan karena source mengirim delapan kolom goal baru
dan memakai `goal_allocations`, sementara production masih memakai model lama.

## Migrasi darurat

File migrasi yang telah diterapkan:

`supabase/manual_migrations/20260730_add_asset_accounts_is_allocatable.sql`

Pilihan desain:

- Tambahkan kolom nullable tanpa default.
- Backfill `true` untuk `bank`, `cash`, dan `ewallet`.
- Backfill `false` untuk `investment` dan `other`.
- Production saat ini hanya mempunyai dua row `bank`, sehingga keduanya menjadi
  `true`.
- Jangan set default global pada tahap darurat.

Alasan tanpa default:

- Default `true` membuat investment/other baru berpotensi ikut dialokasikan.
- Default `false` membuat bank/cash dari klien lama berpotensi tidak dapat
  dialokasikan.
- Klien baru sudah selalu mengirim nilai eksplisit.
- Normalizer source sudah mempunyai fallback berdasarkan `account_type` untuk
  row nullable.

Tidak diperlukan perubahan RLS darurat karena policy production sudah aman
terhadap akses lintas-user.

## Risiko migrasi

- `ALTER TABLE` memerlukan lock singkat. Migrasi memakai `lock_timeout` agar gagal
  cepat bila tabel sedang sibuk.
- Backfill hanya menyentuh row yang nilainya `NULL`.
- Tanpa default, klien lama dapat membuat nilai `NULL`; source saat ini tetap
  menurunkannya dari `account_type`.
- Migrasi ini hanya memulihkan create account. Exchange, goals, dan indeks
  budget harus ditangani dalam migrasi terpisah.

Rollback tanpa `DROP`:

- Kembalikan frontend ke versi yang tidak mengirim/membaca `is_allocatable`.
- Biarkan kolom dan data tetap ada sebagai field dormant.
- Tidak ada data pengguna yang perlu dihapus.

## Test plan staging

1. Buat project Supabase staging terpisah.
2. Pulihkan schema production aktual dan data uji yang sudah dianonimkan.
3. Catat agregat awal seluruh tabel.
4. Jalankan ulang migrasi yang sama pada staging baru untuk membuktikan proses
   bootstrap dari snapshot production.
5. Pastikan dua akun bank lama bernilai `true`.
6. Uji create akun `bank`, `cash`, `ewallet`, `investment`, dan `other`.
7. Uji IDR, USD, AUD, THB, JPY, dan satu kode tiga huruf lain.
8. Uji dua user berbeda untuk memastikan RLS tidak bocor.
9. Pastikan agregat transaksi, budget, goal, dan saldo tidak berubah.
10. Jalankan build frontend dengan environment staging.
11. Baru setelah itu uji migrasi exchange, budget index, dan goal allocation
    sebagai perubahan terpisah.

## Rencana baseline

1. Pasang Supabase CLI melalui lingkungan yang disetujui.
2. Ambil schema-only dump production yang sebenarnya.
3. Simpan dump sebagai baseline arsip yang tidak dieksekusi.
4. Pisahkan perubahan menjadi migration bertimestamp dan additive.
5. Uji seluruh migration dari baseline production pada staging.
6. Bandingkan schema staging dengan target source.
7. Setelah persetujuan terpisah, baru rencanakan pencatatan baseline remote.
8. Jangan memakai `migration repair` atau menandai baseline applied sebelum
   seluruh langkah di atas lolos.

## Rencana environment

- Local: project lokal atau Supabase local.
- Preview: project preview tersendiri.
- Staging: clone schema production dan data uji anonim.
- Production: `kltwuquisrequgralzzh`.
- Pindahkan URL dan publishable key dari `src/config.js` ke environment variable
  Vite, misalnya `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`.
- Tambahkan guard build agar preview tidak dapat memakai project ref production.

Source saat ini hard-coded ke project production, sehingga local dan build
preview dari source yang sama berisiko membaca/menulis production.

Bundle live yang teridentifikasi:

- JavaScript: `/assets/index-DPQzjLKF.js`
- CSS: `/assets/index-D9FRjfcy.css`

Commit deployment belum dapat diverifikasi ulang karena sesi Vercel tidak login.
Local checkout berada pada `ui-redesign` commit `76a6d12`; local
`origin/main` masih menunjuk `28f949d` dan dapat tertinggal dari remote.

## Tindakan yang membutuhkan persetujuan berikutnya

1. Membuat atau memilih project staging.
2. Mengambil schema-only dump dengan Supabase CLI.
3. Menjalankan migration list dan push dry-run setelah CLI tersedia.
4. Menerapkan migrasi exchange dan RPC atomik.
5. Mengganti unique index budget lama.
6. Menerapkan model goal dan `goal_allocations`.
7. Mempersempit grants table/function.
8. Memisahkan environment dan redeploy Vercel.

Migrasi darurat `is_allocatable` sudah selesai. Seluruh tindakan lain pada daftar
di atas belum dijalankan.

## Perbaikan pencatatan transaksi 2026-07-30

Pencatatan pemasukan dan pengeluaran gagal karena payload frontend selalu
menyertakan `fee_amount`, `fee_currency`, dan `target_id`, sedangkan ketiga kolom
tersebut belum tersedia pada tabel production `public.transactions`.

Migrasi additive berikut sudah diterapkan:

- `fee_amount numeric(18, 4)` nullable
- `fee_currency text` nullable
- `target_id uuid` nullable

Verifikasi sesudah migrasi:

- Jumlah transaksi tetap 60.
- Jumlah akun tetap 3.
- Jumlah budget tetap 7.
- Jumlah goal tetap 2.
- RLS tabel transaksi tetap aktif.
- Empat policy transaksi tetap tersedia.
- Payload berbentuk transaksi berhasil di-insert di dalam `BEGIN` lalu
  dibatalkan dengan `ROLLBACK`, sehingga tidak ada data uji yang tertinggal.

File rekaman migrasi:

- `supabase/manual_migrations/20260730_add_transaction_recording_columns.sql`

Perubahan ini hanya memulihkan pencatatan pemasukan/pengeluaran biasa. Integrasi
alokasi target lengkap dan RPC exchange atomik tetap dipisahkan agar tidak
memperbesar risiko perubahan production.
