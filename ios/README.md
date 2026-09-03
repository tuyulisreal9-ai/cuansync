# Proyek iOS CUANSYNC

Kerangka proyek ini dibuat dari Windows, jadi **belum pernah dibangun atau
dijalankan sama sekali**. Semua yang tertulis di bawah sudah diperiksa sebagai
berkas, bukan sebagai aplikasi yang berjalan.

## Langkah pertama di Mac

```bash
pnpm install
pnpm build
npx cap sync ios
npx cap open ios
```

`cap sync ios` wajib dijalankan lebih dulu. Perintah itu menulis ulang
`App/CapApp-SPM/Package.swift` dengan path yang benar untuk mesin tersebut, dan
menyalin hasil build web ke `App/App/public` yang sengaja tidak ikut di-commit.

Capacitor 8 memakai Swift Package Manager, **bukan CocoaPods**, jadi tidak ada
`pod install`.

## Yang sudah disiapkan

| Bagian | Keterangan |
|---|---|
| Bundle id | `com.cuansync.app`, sama dengan Android |
| Skema URL OAuth | `com.cuansync.app` terdaftar di `Info.plist` |
| Warna latar | `#080d0c`, sama dengan splash dan status bar Android |
| `contentInset` | `never` |
| Ikon dan splash | dibuat dari `assets-native/logo.png` |
| Plugin | kedelapannya punya implementasi iOS |

### Kenapa `contentInset` disetel `never`

Aplikasi ini sudah menghitung sendiri area aman lewat `env(safe-area-inset-*)`
di `src/styles.css` dengan `viewport-fit=cover`. Kalau WebView ikut menambahkan
sisipannya sendiri, jaraknya menumpuk dan bagian atas layar iPhone berponi akan
terlihat terdorong dua kali.

Kalau ternyata di perangkat sungguhan konten justru tertutup poni atau home
indicator, berarti asumsi ini salah dan nilainya perlu diubah ke `automatic`.

## Yang belum diverifikasi sama sekali

Semua ini tidak bisa diuji dari Windows dan perlu diperiksa langsung di Mac:

- Aplikasi berhasil dibangun di Xcode
- Login Google kembali ke aplikasi lewat `com.cuansync.app://auth/callback`
- Papan ketik tidak menutupi kolom isian (`Keyboard.resize: "body"` disetel
  untuk Android; perilakunya di iOS belum dilihat)
- Area aman di iPhone berponi, terkait `contentInset` di atas
- Splash dan status bar memakai warna yang benar
- Ekspor PDF laporan bulanan lewat `@capacitor/filesystem` dan `@capacitor/share`

## Untuk mengirim ke App Store

Perlu keanggotaan Apple Developer Program berbayar, penandatanganan di Xcode,
dan lolos review Apple.
