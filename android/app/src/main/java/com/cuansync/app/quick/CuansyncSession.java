package com.cuansync.app.quick;

import android.content.Context;
import android.content.SharedPreferences;

import com.cuansync.app.R;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/* Sesi Supabase milik aplikasi web.

   @capacitor/preferences menyimpannya di SharedPreferences bernama
   "CapacitorStorage", jadi layar catat kilat membaca dari sana alih alih
   menyimpan salinan token sendiri. Tidak ada rahasia baru yang dibuat.

   Token akses Supabase berumur sekitar sejam. Karena catat kilat dipakai
   sekilas dan bisa berhari hari tidak menyentuh aplikasi, penyegaran token
   harus ada di sini; tanpa itu penyimpanan akan gagal justru pada pemakaian
   yang paling wajar. */
final class CuansyncSession {
    private static final String CAPACITOR_PREFS = "CapacitorStorage";
    /* Token dianggap basi sedikit lebih awal supaya tidak kedaluwarsa di
       tengah permintaan yang sedang berjalan. */
    private static final long AMBANG_SEGAR_MS = 60_000L;

    final String accessToken;
    final String userId;

    private CuansyncSession(String accessToken, String userId) {
        this.accessToken = accessToken;
        this.userId = userId;
    }

    static String supabaseUrl(Context context) {
        return context.getString(R.string.cuansync_supabase_url);
    }

    static String anonKey(Context context) {
        return context.getString(R.string.cuansync_supabase_anon_key);
    }

    /* Mengembalikan null bila pengguna belum masuk atau sesinya tidak dapat
       dipulihkan. Pemanggil wajib memperlakukan null sebagai "buka aplikasi
       dan masuk", bukan sebagai galat jaringan. */
    static CuansyncSession muat(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(
            CAPACITOR_PREFS,
            Context.MODE_PRIVATE
        );
        String mentah = prefs.getString(
            context.getString(R.string.cuansync_session_key),
            null
        );
        if (mentah == null || mentah.trim().isEmpty()) return null;

        try {
            JSONObject sesi = new JSONObject(mentah);
            String akses = sesi.optString("access_token", "");
            String refresh = sesi.optString("refresh_token", "");
            long kedaluwarsa = sesi.optLong("expires_at", 0L) * 1000L;
            String pengguna = sesi.optJSONObject("user") == null
                ? ""
                : sesi.optJSONObject("user").optString("id", "");

            if (akses.isEmpty() || pengguna.isEmpty()) return null;

            boolean masihSegar =
                kedaluwarsa > System.currentTimeMillis() + AMBANG_SEGAR_MS;
            if (masihSegar) return new CuansyncSession(akses, pengguna);

            if (refresh.isEmpty()) return null;
            return segarkan(context, refresh, prefs, sesi);
        } catch (Exception galat) {
            return null;
        }
    }

    private static CuansyncSession segarkan(
        Context context,
        String refreshToken,
        SharedPreferences prefs,
        JSONObject sesiLama
    ) {
        HttpURLConnection koneksi = null;
        try {
            URL url = new URL(
                supabaseUrl(context) + "/auth/v1/token?grant_type=refresh_token"
            );
            koneksi = (HttpURLConnection) url.openConnection();
            koneksi.setRequestMethod("POST");
            koneksi.setConnectTimeout(10_000);
            koneksi.setReadTimeout(15_000);
            koneksi.setDoOutput(true);
            koneksi.setRequestProperty("apikey", anonKey(context));
            koneksi.setRequestProperty("Content-Type", "application/json");

            JSONObject badan = new JSONObject();
            badan.put("refresh_token", refreshToken);
            try (OutputStream keluar = koneksi.getOutputStream()) {
                keluar.write(badan.toString().getBytes(StandardCharsets.UTF_8));
            }

            if (koneksi.getResponseCode() / 100 != 2) return null;
            JSONObject hasil = new JSONObject(CuansyncHttp.bacaSemua(koneksi));

            String akses = hasil.optString("access_token", "");
            if (akses.isEmpty()) return null;
            String pengguna = hasil.optJSONObject("user") == null
                ? sesiLama.optJSONObject("user") == null
                    ? ""
                    : sesiLama.optJSONObject("user").optString("id", "")
                : hasil.optJSONObject("user").optString("id", "");
            if (pengguna.isEmpty()) return null;

            /* Sesi yang disegarkan ditulis kembali dengan bentuk yang sama
               seperti yang ditulis pustaka Supabase, supaya aplikasi web
               memakai token yang sama dan tidak menyegarkan ulang. */
            simpanKembali(context, prefs, sesiLama, hasil);
            return new CuansyncSession(akses, pengguna);
        } catch (Exception galat) {
            return null;
        } finally {
            if (koneksi != null) koneksi.disconnect();
        }
    }

    private static void simpanKembali(
        Context context,
        SharedPreferences prefs,
        JSONObject sesiLama,
        JSONObject hasil
    ) {
        try {
            JSONObject baru = new JSONObject(sesiLama.toString());
            baru.put("access_token", hasil.optString("access_token"));
            if (!hasil.optString("refresh_token", "").isEmpty()) {
                baru.put("refresh_token", hasil.optString("refresh_token"));
            }
            long expiresIn = hasil.optLong("expires_in", 3600L);
            baru.put("expires_in", expiresIn);
            baru.put(
                "expires_at",
                (System.currentTimeMillis() / 1000L) + expiresIn
            );
            if (hasil.optJSONObject("user") != null) {
                baru.put("user", hasil.optJSONObject("user"));
            }
            prefs
                .edit()
                .putString(context.getString(R.string.cuansync_session_key), baru.toString())
                .apply();
        } catch (Exception abaikan) {
            /* Token yang baru tetap dipakai untuk permintaan ini walau gagal
               disimpan; paling buruk aplikasi web menyegarkan sekali lagi. */
        }
    }

}
