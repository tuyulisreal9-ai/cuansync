# CuanSync

Aplikasi web pengatur keuangan pribadi untuk alur multi-mata uang:

- Pendapatan utama dalam `IDR`
- Pengeluaran harian operasional dalam `THB`
- Kurs patokan otomatis dari pemasukan THB ber-rate
- Form pemasukan THB universal: bisa `tukar/beli` (potong IDR) atau `bonus/pemberian` (tanpa potong IDR)
- Google OAuth melalui Supabase
- Dashboard responsif dengan dark mode
- Tab terpisah: `Utama` untuk transaksi harian dan `Investasi & Tabungan` untuk target IDR
- Budget tracker universal `uang keluar` dengan indikator overspending
- Overspending canggih: limit bulanan otomatis dipecah jadi batas aman harian dinamis (`sisa budget / sisa hari`)
- Goal tracker untuk target seperti dana darurat (fokus IDR)
- Dana investasi/tabungan terhubung dengan saldo utama (setor mengurangi, tarik menambah)

## Struktur

- `index.html`: entry aplikasi
- `src/main.js`: UI React, auth, logika transaksi, dashboard
- `src/config.js`: konfigurasi Supabase
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

## Setup Supabase

1. Buat project Supabase.
2. Jalankan SQL terbaru dari `supabase/schema.sql`.
3. Di menu `Authentication > Providers`, aktifkan `Google`.
4. Tambahkan redirect URL:

```text
http://localhost:4173
```

5. Salin `Project URL` dan `anon public key` ke `src/config.js`.

## Logika kurs terkunci

1. Catat transaksi `pemasukan THB` dengan rate (bisa dari tukar/beli atau bonus/pemberian).
2. Jika sumbernya `tukar/beli`, sistem menghitung potongan IDR otomatis: `amount_idr = amount_thb * rate`.
3. Setiap transaksi `expense` mengambil `locked_rate` dari pemasukan THB ber-rate terakhir yang terjadi sebelum waktu pengeluaran.
4. Nilai ekuivalen IDR disimpan langsung di transaksi expense agar histori tetap konsisten meski ada rate baru setelahnya.

## Modul baru

- `Dashboard Interaktif`: chart harian dan insight kategori berubah otomatis setiap kali transaksi ditambah atau dihapus.
- `Tab Operasional Harian`: transaksi + chart + budget universal uang keluar ada di tab utama.
- `Overspending Guard`: satu limit uang keluar per bulan akan berubah jadi warning atau merah saat terlewati.
- `Tab Investasi & Tabungan`: target seperti dana darurat disimpan di tabel `goals` dan progress tetap di IDR.

## Tabel database

- `transactions`: menyimpan pemasukan, exchange, dan expense harian.
- `budgets`: limit budget bulanan universal untuk uang keluar.
- `goals`: target tabungan/investasi dengan saldo saat ini dan deadline opsional.

## Catatan implementasi

- Stack UI: React 18 + Tailwind CSS via CDN
- Database/Auth: Supabase JS v2 via CDN
- Mode demo dibuat agar prototipe tetap bisa dicoba tanpa kredensial
