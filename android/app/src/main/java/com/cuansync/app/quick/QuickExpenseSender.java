package com.cuansync.app.quick;

import android.content.Context;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.List;

/* Pengiriman pengeluaran ke record_transaction_atomic.

   Seluruh validasi tetap milik server: kepemilikan dompet, kecocokan mata
   uang, dompet terarsip, kecukupan saldo, dan perlindungan dana target.
   Kelas ini tidak menduplikasi satu pun dari aturan itu, sehingga tidak ada
   kemungkinan aturan versi Java menyimpang dari aturan sebenarnya. */
public final class QuickExpenseSender {
    private QuickExpenseSender() {}

    static final int SUKSES = 0;
    static final int GAGAL_JARINGAN = 1;
    static final int GAGAL_SESI = 2;
    static final int DITOLAK = 3;

    static final class Hasil {
        final int kode;
        final String pesan;

        Hasil(int kode, String pesan) {
            this.kode = kode;
            this.pesan = pesan;
        }
    }

    static Hasil kirim(Context context, CuansyncSession sesi, QuickExpense expense, String baseCurrency) {
        HttpURLConnection koneksi = null;
        try {
            URL url = new URL(
                CuansyncSession.supabaseUrl(context)
                    + "/rest/v1/rpc/record_transaction_atomic"
            );
            koneksi = (HttpURLConnection) url.openConnection();
            koneksi.setRequestMethod("POST");
            koneksi.setConnectTimeout(10_000);
            koneksi.setReadTimeout(20_000);
            koneksi.setDoOutput(true);
            koneksi.setRequestProperty("apikey", CuansyncSession.anonKey(context));
            koneksi.setRequestProperty("Authorization", "Bearer " + sesi.accessToken);
            koneksi.setRequestProperty("Content-Type", "application/json");

            byte[] badan = expense
                .payload(context, sesi.userId, baseCurrency)
                .toString()
                .getBytes(StandardCharsets.UTF_8);
            try (OutputStream keluar = koneksi.getOutputStream()) {
                keluar.write(badan);
            }

            int status = koneksi.getResponseCode();
            String balasan = CuansyncHttp.bacaSemua(koneksi);
            if (status / 100 == 2) return new Hasil(SUKSES, "");

            if (status == 401 || status == 403) {
                return new Hasil(GAGAL_SESI, pesanDari(balasan, "Sesi sudah tidak berlaku."));
            }
            /* Penolakan server bersifat tetap: saldo kurang, dompet terarsip,
               mata uang tidak cocok. Mengantrekannya hanya akan mengulang
               kegagalan yang sama, jadi pengguna diberi tahu sekarang. */
            return new Hasil(DITOLAK, pesanDari(balasan, "Transaksi ditolak server."));
        } catch (Exception galat) {
            return new Hasil(GAGAL_JARINGAN, "Tidak ada koneksi.");
        } finally {
            if (koneksi != null) koneksi.disconnect();
        }
    }

    /* Mengirim ulang antrean. Dipanggil saat layar catat dibuka dan saat
       aplikasi menyegarkan snapshot widget, jadi tidak butuh WorkManager.

       Mengembalikan jumlah yang berhasil terkirim. */
    public static int kirimAntrean(Context context, String baseCurrency) {
        List<QuickExpense> tertunda = QuickExpenseQueue.semua(context);
        if (tertunda.isEmpty()) return 0;

        CuansyncSession sesi = CuansyncSession.muat(context);
        if (sesi == null) return 0;

        int terkirim = 0;
        for (QuickExpense expense : tertunda) {
            Hasil hasil = kirim(context, sesi, expense, baseCurrency);
            if (hasil.kode == SUKSES || hasil.kode == DITOLAK) {
                /* Yang ditolak ikut dibuang: penolakannya tetap dan mengulang
                   selamanya hanya menahan antrean di belakangnya. */
                QuickExpenseQueue.hapus(context, expense.clientRequestId);
                if (hasil.kode == SUKSES) terkirim += 1;
            } else {
                /* Jaringan atau sesi: berhenti, sisanya menunggu kesempatan
                   berikutnya. */
                break;
            }
        }
        return terkirim;
    }

    private static String pesanDari(String balasan, String cadangan) {
        if (balasan == null || balasan.trim().isEmpty()) return cadangan;
        try {
            Object terurai = new org.json.JSONTokener(balasan).nextValue();
            JSONObject objek = terurai instanceof JSONArray
                ? ((JSONArray) terurai).optJSONObject(0)
                : (JSONObject) terurai;
            if (objek == null) return cadangan;
            String pesan = objek.optString("message", "");
            return pesan.isEmpty() ? cadangan : pesan;
        } catch (Exception galat) {
            return cadangan;
        }
    }
}
