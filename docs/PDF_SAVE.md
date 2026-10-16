# Simpan laporan PDF

Tombol laporan bulanan sekarang hanya **Simpan PDF**. Pembuatan isi, perhitungan,
dan tata letak PDF tidak berubah. Tidak ada panggilan Web Share/Capacitor Share.

- Web/PWA: unduhan melalui tautan blob. Hasil hanya menyatakan unduhan dimulai,
  karena browser tidak memberi konfirmasi bahwa file sudah tersimpan. Browser
  tertentu dapat menampilkan pratinjau; pengguna menyimpan lewat kontrol browser.
- Android native: plugin lokal `CuansyncDocuments` membuka dialog sistem **Simpan
  sebagai** (`ACTION_CREATE_DOCUMENT`). Pengguna memilih lokasi, lalu plugin
  menulis PDF ke URI pilihan tersebut. Tidak meminta izin seluruh penyimpanan.
  Membatalkan dialog tidak dianggap berhasil. APK lama harus diperbarui.
- iOS native: menyimpan ke Documents/Laporan dengan nama unik per ekspor. Folder
  CUANSYNC tersedia di aplikasi Files melalui konfigurasi Info.plist. Berkas ini
  bukan cache; pengguna dapat mengelolanya di Files. Menghapus aplikasi dapat ikut
  menghapus dokumen lokalnya, sehingga laporan penting perlu dicadangkan pengguna.

## Verifikasi perangkat sebelum rilis native

Build/sync ulang web bundle dan APK/iOS. Uji Android dengan memilih Downloads,
membatalkan dialog, mengulang ekspor, dan ruang penyimpanan tidak cukup. Pastikan
file dapat dibuka setelah app ditutup. Uji iPhone native di Files → CUANSYNC →
Laporan dan Safari/PWA terpisah karena jalur penyimpanannya berbeda.

Tes JavaScript menggunakan mock penyimpanan; bukan pengganti uji perangkat.
Build iOS memerlukan macOS/Xcode.

Verifikasi lokal perubahan ini: 446 tes JavaScript lulus dan build web berhasil.
Kompilasi Android belum terverifikasi: percobaan offline kekurangan dependensi,
dan percobaan berikutnya terhenti saat Gradle gagal memindahkan cache groovy-dsl
pada konfigurasi `capacitor-keyboard`, sebelum kompilasi Java aplikasi.
Belum diuji pada perangkat Android/iPhone fisik; belum menghasilkan APK baru.

Referensi implementasi: [Android Storage Access Framework](https://developer.android.com/training/data-storage/shared/documents-files)
dan [Capacitor Filesystem](https://capacitorjs.com/docs/apis/filesystem).
