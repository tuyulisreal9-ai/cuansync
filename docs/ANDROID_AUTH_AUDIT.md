# Audit Android dan autentikasi CUANSYNC

Tanggal audit: 26 Agustus 2026  
Status: perubahan source lokal; belum di-push, belum di-deploy, dan belum mengubah konfigurasi production.

## Verdict

**Siap diuji di perangkat, tetapi belum siap dinyatakan selesai untuk production.**

Build, unit test, lint, pemasangan update APK, cold start, intent deep link, dan identitas
activity sudah terverifikasi. Login Google interaktif, sepuluh kali buka/tutup, restart
perangkat, serta callback Supabase production masih memerlukan pengujian manual setelah
redirect URL native dipastikan ada di dashboard Supabase.

## 1. Arsitektur yang ditemukan

Android CUANSYNC adalah **Capacitor 8 dengan WebView dan bundle web lokal**, bukan TWA.

Bukti:

- `capacitor.config.json` menetapkan `appId: com.cuansync.app`, `webDir: dist`, host
  internal `localhost`, dan tidak memiliki `server.url` production.
- `MainActivity.java` mewarisi `com.getcapacitor.BridgeActivity`.
- `android/app/build.gradle` memakai project `:capacitor-android`.
- APK memuat hasil build web di `android/app/src/main/assets/public`.
- Tidak ditemukan `twa-manifest.json`, Bubblewrap, PWABuilder, Android Browser Helper,
  Trusted Web Activity dependency, atau `.well-known/assetlinks.json`.
- `@capacitor/browser` ada, tetapi hanya dipanggil oleh `openNativeAuthBrowser()` untuk
  OAuth Google.
- Sesudah cold start pada perangkat, Android melaporkan activity aplikasi sebagai
  `com.cuansync.app/.MainActivity`, bukan Chrome.

Konfigurasi PWA web tetap terpisah:

- `start_url: /`
- `scope: /`
- `display: standalone`
- service worker hanya didaftarkan jika bukan native app.

Origin WebView native adalah `https://localhost`. Origin website production tidak
ditetapkan di repository dan harus dikonfirmasi dari Vercel/Supabase.

## 2. Akar masalah toolbar Chrome

MainActivity Capacitor tidak dapat menghasilkan toolbar Chrome yang berisi tombol X,
domain, bagikan, terjemahan, dan menu. Toolbar tersebut adalah UI Custom Tab.

Dengan arsitektur yang ditemukan, penyebab yang paling sesuai dengan bukti adalah:

1. Google OAuth memang dibuka melalui `Browser.open()` sebagai Custom Tab; lalu
2. callback native `com.cuansync.app://auth/callback` tidak dipakai atau tidak diizinkan
   oleh Supabase production; lalu
3. Auth kembali ke Site URL/Vercel di dalam Custom Tab, sehingga website tampak seperti
   Beranda aplikasi tetapi toolbar browser tetap ada.

Kemungkinan lain adalah pengguna membuka shortcut/URL web, bukan ikon package
`com.cuansync.app`. Namun cold start APK yang diuji mengarah langsung ke MainActivity.

Tidak dibuat TWA atau `assetlinks.json`, karena source ini bukan TWA dan pencampuran
TWA dengan Capacitor tidak diperlukan untuk memperbaiki masalah.

## 3. Akar masalah login berulang

Implementasi sebelumnya sudah memiliki `persistSession` dan `autoRefreshToken`, tetapi
memiliki celah berikut:

- callback hanya mendengarkan `appUrlOpen` dan tidak memeriksa `App.getLaunchUrl()`;
  callback dapat terlewat ketika OAuth membuka aplikasi dari kondisi proses mati;
- OAuth memakai implicit callback dengan token pada URL;
- bila Supabase kembali ke Vercel, sesi tersimpan pada origin browser/Vercel dan bukan
  storage aplikasi native;
- kegagalan pemulihan `getSession()` sebelumnya tidak ditangani dan UI dapat berakhir
  di halaman login tanpa penjelasan.

Perbaikan lokal:

- satu singleton Supabase client;
- `persistSession: true`, `autoRefreshToken: true`, `detectSessionInUrl: false` pada
  native, dan `flowType: pkce`;
- storage native tetap memakai Capacitor Preferences/Android SharedPreferences;
- callback mendukung `appUrlOpen` dan cold start `App.getLaunchUrl()`;
- PKCE code diselesaikan melalui `exchangeCodeForSession()`;
- callback implicit lama masih dapat diselesaikan sementara untuk kompatibilitas;
- startup tetap pada splash sampai `getSession()` dan validasi `getUser()` selesai;
- kegagalan pemulihan menampilkan layar retry dan tidak menghapus sesi;
- lifecycle foreground/background menyalakan atau menghentikan auto-refresh secara
  berurutan;
- tidak ada logout otomatis untuk HTTP 401 atau `PGRST303`.

## 4. Analisis `JWT issued at future`

JWT memakai claim `iat` untuk waktu penerbitan. `PGRST303` berarti PostgREST menilai
`iat` lebih baru daripada waktu server pemeriksa.

Hasil diagnosis lokal:

- aplikasi memakai token Supabase Auth, bukan custom JWT;
- tidak ditemukan `service_role`, secret key, atau kode pembuat JWT custom di frontend;
- waktu UTC perangkat dan komputer saat audit berbeda sekitar satu detik, sehingga tidak
  ada clock skew besar pada perangkat yang diuji;
- request production asli yang memunculkan error belum dapat diidentifikasi karena sesi
  belum selesai diuji ulang dan token tidak boleh diambil dari log;
- kasus token Supabase Auth baru yang diterima Auth tetapi ditolak Data API dengan
  `PGRST303` juga telah dilaporkan sebagai dugaan clock skew Auth/PostgREST.

Perilaku baru:

1. Mendeteksi hanya `PGRST303`/pesan `JWT issued at future` pada respons 401/403.
2. Mencatat diagnosis yang disanitasi: path request, UTC client/server, `iat`, `exp`, dan
   selisih waktu. Token, user ID, dan email tidak dicatat.
3. Semua request bersamaan berbagi satu proses refresh (`single-flight`).
4. Setiap request mendapat maksimal satu refresh dan satu retry.
5. Jika token baru tetap ditolak, aplikasi menampilkan penjelasan waktu yang jelas dan
   mempertahankan sesi.
6. Tidak ada modifikasi JWT, toleransi waktu buatan, retry tanpa batas, atau logout paksa.

Diagnosis terakhir disimpan lokal pada key
`cuansync-auth-clock-diagnostic`. Logging native Capacitor diatur ke `none` karena log
debug plugin dapat membocorkan nilai yang dikirim ke Preferences.

## 5. File source yang diubah untuk audit ini

- `capacitor.config.json`
- `src/lib/authSession.js` (baru)
- `src/lib/mobile.js`
- `src/main.js`
- `src/components/auth/AuthFlow.js`
- `src/components/auth/index.js`
- `scripts/build-android.ps1`
- `tests/auth-session.test.js` (baru)
- `tests/mobile-shell.test.js`
- `docs/ANDROID_AUTH_AUDIT.md` (baru)

Folder Android generated assets juga disinkronkan dari `dist` melalui Capacitor. Tidak ada
perubahan schema, migration, transaksi, saldo, anggaran, target, atau data production.

## 6. Perilaku sebelum dan sesudah

| Area | Sebelum | Sesudah |
|---|---|---|
| Shell utama | Capacitor bundle lokal | Tetap Capacitor bundle lokal |
| Browser | OAuth Custom Tab dapat berhenti di Vercel | Callback native menangani resume dan cold start |
| OAuth | Implicit token callback | PKCE code exchange; implicit lama tetap kompatibel |
| Session startup | Error pemulihan diabaikan | Splash sampai restore + validasi selesai |
| Session storage | Preferences sudah dikonfigurasi | Tetap Preferences; lifecycle diperkuat |
| Foreground refresh | Listener sederhana | Update lifecycle diserialkan |
| `PGRST303` | Error langsung ke UI | Satu shared refresh + satu retry, tanpa logout |
| Log native | Debug plugin dapat mencatat parameter | Logging Capacitor dimatikan |

## 7. Hasil build dan test

- Web production build: lulus.
- Node test: **121 lulus, 0 gagal**.
- Android `testDebugUnitTest`: lulus.
- Android `lintDebug`: lulus.
- Android `assembleDebug`: lulus.
- APK final lokal: `artifacts/CUANSYNC-debug.apk`.
- SHA-256 APK: `24C7F8B28980D6671D0A563A0651B64901EF48AF8E74764BF86B3E3B2F12D185`.
- APK di-update dengan `adb install -r`: lulus; data aplikasi dipertahankan.
- Cold start `MainActivity` setelah force-stop: lulus.
- Resolusi deep link `com.cuansync.app://auth/callback`: mengarah ke MainActivity.
- Log final terfilter tidak menampilkan parameter Preferences atau console output.

## 8. Yang belum dapat diverifikasi

- toolbar hilang secara visual karena layar perangkat terkunci/dozing saat audit;
- redirect URL native benar-benar ada di allowlist Supabase production;
- login Google selesai dan Custom Tab menutup;
- sesi bertahan setelah 10 kali tutup/buka;
- sesi bertahan setelah restart perangkat;
- refresh token nyata ketika access token kedaluwarsa;
- `PGRST303` nyata pada request/table tertentu;
- website production biasa di Chrome setelah deployment;
- release certificate dan Google Play App Signing certificate.

## 9. Langkah manual yang harus dilakukan

### Konfigurasi Supabase

Di `Authentication > URL Configuration > Redirect URLs`, tambahkan persis:

```text
com.cuansync.app://auth/callback
```

Jangan menghapus URL web production. Google Cloud OAuth callback tetap callback Supabase
yang ditampilkan oleh provider, bukan custom scheme di atas.

### Uji perangkat

1. Pastikan tanggal, waktu, dan zona waktu otomatis aktif.
2. Buka CUANSYNC dari ikon aplikasi, bukan link Vercel.
3. Login Google sekali. Custom Tab boleh tampil selama login.
4. Pastikan callback kembali ke CUANSYNC dan toolbar Chrome menghilang.
5. Tutup/buka aplikasi sepuluh kali.
6. Force-stop lalu buka lagi.
7. Restart perangkat lalu buka lagi.
8. Tunggu access token melewati siklus refresh dan pastikan tidak diminta login.
9. Ulangi pada perangkat Android kedua.
10. Uji website Vercel secara terpisah di Chrome.

Perintah verifikasi activity/deep link:

```powershell
adb shell cmd package resolve-activity --brief `
  -a android.intent.action.VIEW `
  -c android.intent.category.BROWSABLE `
  -d "com.cuansync.app://auth/callback?code=redacted"

adb shell am force-stop com.cuansync.app
adb shell am start -W -n com.cuansync.app/.MainActivity
adb shell dumpsys window | Select-String "mCurrentFocus|mFocusedApp"
```

Jika login tetap berakhir di Vercel, rekam redirect URL yang terlihat tanpa membagikan
token atau query string sensitif, kemudian periksa allowlist Supabase.

## 10. Domain, package, dan fingerprint

- Package ID: `com.cuansync.app`.
- Deep link: `com.cuansync.app://auth/callback`.
- Origin internal Capacitor: `https://localhost`.
- Domain production: belum tercatat di source; perlu dikonfirmasi.
- Debug certificate SHA-256 yang cocok dengan APK terpasang:
  `C8:A3:CC:57:C6:CB:2D:84:D3:5B:50:6B:2F:6D:3B:E3:6F:51:79:F4:27:D2:7D:4E:C7:B4:35:FC:B5:B8:BB:35`.
- Release certificate SHA-256: belum tersedia.
- Google Play App Signing SHA-256: belum tersedia.

Fingerprint di atas bukan private key. Private keystore dan password tidak ditampilkan
atau dipindahkan.

Karena ini bukan TWA, fingerprint tidak perlu dimasukkan ke `assetlinks.json` pada
arsitektur sekarang. Fingerprint release/Play baru diperlukan untuk Digital Asset Links
jika kemudian diputuskan bermigrasi ke TWA/App Links HTTPS.

## 11. Rencana deployment dan rollback

Deployment belum dilakukan. Urutan aman:

1. selesaikan checklist manual pada debug build;
2. konfirmasi domain production dan redirect allowlist;
3. review diff lalu commit/push setelah persetujuan;
4. deploy website terpisah dan smoke-test Chrome;
5. build AAB release dengan upload key yang sudah disepakati;
6. rilis ke Play Internal Testing;
7. lakukan closed testing sebelum production.

Rollback tidak membutuhkan perubahan database:

- revert commit source auth/mobile;
- build ulang versi sebelumnya memakai signing key/package ID yang sama;
- distribusikan melalui track internal sebelumnya atau rollback Play release.

Jangan menghapus aplikasi untuk rollback karena uninstall menghapus Preferences/session
lokal. Tidak ada migration atau perubahan data yang perlu dibalik.

## Referensi resmi yang diperiksa

- Supabase Native Mobile Deep Linking:
  https://supabase.com/docs/guides/auth/native-mobile-deep-linking
- Supabase User Sessions:
  https://supabase.com/docs/guides/auth/sessions
- Supabase JavaScript `getSession`:
  https://supabase.com/docs/reference/javascript/auth-getsession
- Capacitor App API (`appUrlOpen`, `getLaunchUrl`, `getState`):
  https://capacitorjs.com/docs/apis/app
- Capacitor Preferences:
  https://capacitorjs.com/docs/apis/preferences
- Capacitor configuration/logging behavior:
  https://capacitorjs.com/docs/config
- Supabase changelog breaking changes:
  https://supabase.com/changelog?types=breaking-change
- Laporan Supabase terkait `PGRST303` untuk JWT baru:
  https://github.com/orgs/supabase/discussions/48123

Changelog tidak menunjukkan breaking change managed Auth/PostgREST yang mewajibkan
perubahan berbeda untuk kasus ini. Perubahan status endpoint OAuth `201` ke `200` tidak
relevan karena aplikasi memakai Supabase JS dan tidak memeriksa status `201` secara manual.
