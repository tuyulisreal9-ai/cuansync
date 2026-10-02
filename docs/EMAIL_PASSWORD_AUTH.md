# Login email + kata sandi CUANSYNC

## Alur yang tersedia

- Masuk dengan email dan kata sandi, atau tetap dengan Google.
- Daftar akun baru, verifikasi email, kirim ulang verifikasi.
- Lupa kata sandi → email pemulihan → formulir kata sandi baru.
- Pengguna Google lama: masuk dengan Google → Pengaturan → Metode masuk → Email & kata sandi → buat dan simpan kata sandi. Panel menampilkan email akun yang akan digunakan, Google tetap terhubung, dan data tidak dipindahkan. `updateUser({ password })` menambah kata sandi pada **ID akun yang sama**, tanpa memindahkan atau menggandakan data keuangan. Tidak perlu daftar ulang; kata sandi Google tidak digunakan.
- Status Google di Pengaturan dibaca dari identitas/app_metadata Supabase. Status kata sandi tidak ditebak dari provider `email`, karena akun magic-link juga dapat memiliki provider itu. Konfirmasi login email siap dipakai hanya ditampilkan setelah penyimpanan berhasil.
- Tidak ada tabel kata sandi, service-role key, atau migrasi data tambahan. Supabase Auth menangani kredensial. Browser/native menyimpan sesi melalui mekanisme yang sudah ada, bukan kata sandi.

## Konfigurasi Supabase sebelum produksi (belum diubah otomatis)

1. Authentication → Sign In / Providers → Email: aktifkan email/password dan pendaftaran jika pendaftaran umum memang dibuka. **Confirm email tetap aktif.** Terapkan batas minimal kata sandi di server minimal 8 karakter, bukan hanya validasi UI. Aktifkan proteksi kata sandi bocor bila tersedia.
2. Authentication → URL Configuration:
   - Site URL: `https://cuansync.vercel.app/` (aplikasi, bukan landing).
   - Redirect URLs: `https://cuansync.vercel.app/` dan `https://cuansync.vercel.app/?auth=reset-password`.
   - Untuk lokal: URL origin/port Vite yang benar dengan `/` dan `/?auth=reset-password`.
   - Untuk native: `com.cuansync.app://auth/callback` dan `com.cuansync.app://auth/callback?auth=reset-password`.
   - Setelah punya domain sendiri, tambahkan origin aplikasi baru, misalnya `https://app.DOMAIN-ANDA/` beserta varian recovery. Jangan memasukkan domain contoh secara literal atau wildcard produksi yang terlalu luas.
3. Konfigurasikan **custom SMTP** untuk pengguna umum. SMTP bawaan Supabase dibatasi ke alamat anggota tim proyek dan kuota sangat rendah; bukan pengiriman email produksi. Kredensial SMTP hanya di dashboard/server, tidak di variabel `VITE_*` atau repo.
4. Template Confirm signup dan Reset password: tombol memakai `{{ .ConfirmationURL }}` supaya token, jenis email, dan redirect yang ditentukan SDK dipertahankan. Jangan menggantinya dengan tautan landing biasa. Sesuaikan bahasa/branding. Aktifkan notifikasi perubahan kata sandi bila tersedia.
5. Atur rate limit server. UI menahan kirim ulang 60 detik, tetapi itu bukan pengganti rate limit backend. Jika CAPTCHA diwajibkan di Supabase, integrasikan token/widget CAPTCHA sebelum membuka pendaftaran publik; kode saat ini belum mengirim captchaToken.

## Callback dan batasan yang disengaja

Web dan native menggunakan PKCE. Tautan verifikasi/pemulihan perlu dibuka pada aplikasi/peramban yang memulai permintaan karena verifier disimpan di situ. Login **email + password biasa** tetap bisa dilakukan dari perangkat lain tanpa akun Google aktif. Jika email dibuka pada browser lain (termasuk PWA yang penyimpanannya terpisah), minta tautan baru dari browser tujuan. Untuk onboarding lintas-browser yang lebih mulus, OTP email dapat ditambahkan kemudian, dengan template dan pengujian tersendiri.

Callback ditukar secara eksplisit karena auth-js 2.70.0 tidak mempertahankan `redirectType` pada auto-detection PKCE. Callback Google, verifikasi, dan recovery memakai handler yang sama; kode sekali-pakai tidak ditukar dua kali untuk URL yang sama. Recovery hanya dibuka setelah SDK berhasil memperoleh sesi. Parameter `auth=reset-password` sendiri bukan otorisasi. Penanda UI recovery menyimpan ID akun di sessionStorage agar reload web tidak melompati formulir; tidak berisi kredensial. Kata sandi disimpan hanya setelah `getUser()` memverifikasi bahwa ID sesi masih sama.

## Uji rilis manual dengan akun uji

- Google lama → buat kata sandi → keluar → masuk email/password di perangkat yang Google-nya belum login; pastikan `user.id`, dompet, dan transaksi sama.
- Email baru → verifikasi → masuk → onboarding mata uang. Coba resend, email belum diverifikasi, password salah, serta error SMTP/rate limit.
- Lupa password → link valid → ubah → keluar → password baru bekerja, password lama ditolak. Coba tautan kedaluwarsa/dipakai ulang dan browser berbeda: muncul petunjuk, tidak otomatis mengubah password.
- Buka link saat demo aktif; akun nyata tidak boleh bercampur dengan demo. Keluar dari demo, lalu login email tanpa reload.
- Native: callback cold launch/warm launch, keyboard terbuka, layar kecil, tombol Batal. Pastikan Google tetap bekerja.
- Hasil tes otomatis/mock dan build bukan bukti email produksi terkirim. SMTP, deliverability, dan kedua perangkat perlu diuji setelah konfigurasi deploy. APK lama perlu dibangun ulang untuk menerima UI ini.

Referensi: [Password auth](https://supabase.com/docs/guides/auth/passwords), [menambah password ke akun OAuth](https://supabase.com/docs/guides/auth/auth-identity-linking), [SMTP produksi](https://supabase.com/docs/guides/auth/auth-smtp), [email templates](https://supabase.com/docs/guides/auth/auth-email-templates).
