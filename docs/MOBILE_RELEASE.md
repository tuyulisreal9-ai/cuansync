# CUANSYNC Mobile

CUANSYNC memakai satu codebase React/Vite untuk web dan Android. Lapisan native
dibuat dengan Capacitor 8, sedangkan data dan autentikasi tetap memakai Supabase.

## Identitas aplikasi

- Nama aplikasi: `CUANSYNC`
- Android application ID: `com.cuansync.app`
- OAuth callback native: `com.cuansync.app://auth/callback`
- Minimum Android: API 24
- Target/compile Android: API 36

Application ID harus dianggap permanen setelah aplikasi pertama kali diterbitkan.
Jika nama paket ingin diganti, lakukan sebelum membuat listing Play Store pertama.

## Persiapan Supabase

Tambahkan URL berikut ke `Authentication > URL Configuration > Redirect URLs`:

```text
com.cuansync.app://auth/callback
```

Biarkan URL web lokal/produksi yang sudah dipakai tetap berada dalam daftar.
Provider Google di Supabase harus aktif. Callback OAuth Google tetap memakai
callback Supabase yang ditampilkan pada halaman konfigurasi provider; custom URL
di atas adalah jalur kembali dari Supabase ke aplikasi Android.

## Menjalankan Android

Prasyarat:

- Node.js 22 atau lebih baru
- Java/JDK 21
- Android SDK API 36 dan Build Tools 36
- Android Studio versi stabil terbaru

Jalankan:

```powershell
pnpm install
pnpm mobile:sync
pnpm mobile:open
```

Pilih emulator atau perangkat Android yang USB debugging-nya aktif, lalu tekan
Run di Android Studio. Alternatif dari terminal:

```powershell
pnpm mobile:run
```

Setiap perubahan React harus diikuti `pnpm mobile:sync` sebelum build native.

## Membangun APK uji

```powershell
pnpm mobile:apk
```

Hasilnya berada di:

```text
artifacts/CUANSYNC-debug.apk
```

APK debug hanya untuk pengujian internal dan tidak boleh dipublikasikan ke Play
Store.

## Menyiapkan rilis Play Store

Google Play menerima Android App Bundle (`.aab`). Buat upload keystore milik
pengembang dan simpan password di password manager. Jangan commit file keystore,
password, `key.properties`, APK, atau AAB ke Git.

Cara yang disarankan untuk rilis pertama:

1. Buka folder `android` lewat `pnpm mobile:open`.
2. Pilih `Build > Generate Signed Bundle / APK`.
3. Pilih `Android App Bundle` dan buat/pilih upload key.
4. Pilih variant `release`, lalu simpan `.aab` yang dihasilkan.
5. Aktifkan Play App Signing ketika membuat aplikasi di Play Console.
6. Uji dahulu melalui track Internal testing sebelum Production.

Nomor versi ada di `android/app/build.gradle` melalui `versionCode` dan
`versionName`. Naikkan `versionCode` pada setiap upload Play Store.

## Pemeriksaan sebelum rilis

- `pnpm test` lulus.
- `pnpm build` lulus.
- `pnpm mobile:sync` lulus.
- APK debug terpasang dan dapat membuka mode demo.
- Login Google kembali ke aplikasi, bukan berhenti di browser.
- Tambah/edit/hapus transaksi dan target teruji dengan akun Supabase uji.
- Tombol kembali Android menutup modal sebelum keluar dari aplikasi.
- Tampilan diuji pada ponsel kecil, keyboard terbuka, dark mode, dan light mode.
- Keystore rilis memiliki backup terenkripsi di luar repository.

## iOS

Codebase web dan callback auth sudah dapat digunakan lintas platform, tetapi
proyek iOS, signing, dan build App Store wajib diselesaikan pada macOS dengan
Xcode serta akun Apple Developer. Buat target iOS setelah bundle identifier final
diputuskan agar identitas Android/iOS konsisten.
