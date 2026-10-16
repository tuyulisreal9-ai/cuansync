# Menghubungkan landing dan aplikasi

## Yang sudah disiapkan di kode

- Aplikasi tetap di `https://cuansync.vercel.app/`. Semua tombol masuk/mulai di
  `landing/index.html` memiliki href langsung ke sana, termasuk tanpa JavaScript.
- Saat landing dibuka di localhost/127.0.0.1, JavaScript mengarahkan CTA ke port
  5173 pada hostname yang sama. Jalankan aplikasi dan landing bersamaan.
- Salinan penjelasan fitur sudah disesuaikan: email/password dan Google, tabungan
  dari beberapa dompet dalam mata uang yang sama, pencatatan transfer, dan ekspor
  PDF dari Pengaturan → Data & laporan → Laporan transaksi bulanan.
- Layar login/daftar/pemulihan memiliki dukungan tautan dokumen publik melalui
  `VITE_LEGAL_SITE_URL`. Jika kosong/tidak valid, tautan tidak ditampilkan.
  Ini disengaja agar dokumen draf tidak ditawarkan sebagai kebijakan final.

## Informasi pemilik yang masih diperlukan

Jangan menerbitkan folder landing apa adanya sebelum bagian ini selesai.
`privasi.html` dan `ketentuan.html` masih memiliki penanda `[ISI: ...]`.

- Nama pengelola/badan usaha, alamat, dan email dukungan yang memang bisa menerima
  permintaan pengguna.
- Tanggal berlaku dan yurisdiksi yang disetujui pemilik.
- Tinjau dan setujui isi dokumen, termasuk retensi, penghapusan data, serta janji
  kepada pengguna. Penyuntingan teknis ini bukan pemeriksaan kepatuhan hukum.
- Ganti seluruh penanda, uji tautan email, lalu ubah robots dokumen dari
  `noindex, follow` menjadi `index, follow` bila sudah layak dipublikasikan.
  `noindex` bukan proteksi akses: siapa pun yang memiliki URL tetap bisa membukanya.
- Tambahkan kembali tautan Kontak di footer landing dengan email yang dikonfirmasi.

## Dua deployment yang terpisah

1. Pertahankan proyek aplikasi saat ini dengan root repository dan build Vite.
   Jangan mengganti `/` pada domain aplikasi menjadi landing: PWA yang sudah
   terpasang menggunakan origin tersebut dengan `start_url` dan scope `/`.
2. Gunakan proyek Vercel terpisah untuk landing, Root Directory `landing`.
   Konfigurasi statis ada di `landing/vercel.json`; tidak perlu memindahkan aplikasi.
3. Setelah alamat HTTPS landing final diketahui, isi `canonical` dan `og:url`
   dengan alamat **landing**, bukan alamat aplikasi. Isi `og:image` dan
   `twitter:image` dengan URL absolut `/branding/og-cuansync.png` pada domain
   landing. Gunakan `twitter:card=summary_large_image` setelah gambar tersedia.
   Metadata berisi alamat placeholder telah dihapus agar tidak dikirim ke crawler.
4. Setelah dokumen final diterbitkan, atur **di proyek aplikasi**:
   `VITE_LEGAL_SITE_URL` = origin HTTPS landing, tanpa path/query/hash.
   Ini informasi publik, bukan rahasia. Build/deploy ulang aplikasi agar link
   privasi dan ketentuan muncul. Untuk APK/iOS, build/sync ulang bundle native juga.
5. Jika nanti alamat aplikasi berubah, perbarui meta `cuansync-app-url` dan semua
   `href` pada `[data-app-link]` di landing serta uji regresi URL terkait.

## Yang harus diverifikasi di layanan produksi

- Supabase: Email provider, konfirmasi email, SMTP, Site URL dan redirect URL
  aplikasi. Panduan lengkap: [EMAIL_PASSWORD_AUTH.md](./EMAIL_PASSWORD_AUTH.md).
  URL landing tidak menggantikan URL callback login/pemulihan aplikasi.
- Jika domain aplikasi berubah, tambahkan URL aplikasi baru beserta varian reset
  password ke allowlist; pertahankan callback native yang masih digunakan.
- Konfigurasi produksi Supabase, Google OAuth, SMTP, domain dan DNS tidak berubah
  hanya karena kode lokal ini diperbaiki. Periksa masing-masing dashboard.

## Uji sebelum dibuka ke publik

- Semua CTA landing → aplikasi, termasuk saat JavaScript dimatikan.
- Login Google; daftar email → verifikasi; lupa sandi → ubah sandi → masuk kembali.
- Akun Google lama menambah password tanpa akun/data keuangan baru.
- Link privasi/ketentuan dari login membuka dokumen final dan bisa kembali ke app.
- Tampilan HP/laptop, PWA yang sudah terpasang, serta callback Android/iOS.
- Pratinjau share menampilkan judul/gambar dan canonical domain landing yang benar.

Tes otomatis/build lokal tidak membuktikan pengiriman email, DNS, atau login
produksi sudah berhasil. Gunakan akun uji untuk verifikasi ujung-ke-ujung.
