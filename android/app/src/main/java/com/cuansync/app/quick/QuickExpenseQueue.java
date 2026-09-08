package com.cuansync.app.quick;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/* Antrean pengeluaran yang belum sampai ke server.

   Alasannya sederhana: catat kilat dipakai sambil berjalan, di warung, di
   tempat sinyal buruk. Pengeluaran yang sudah dianggap tercatat oleh pengguna
   tetapi diam diam hilang jauh lebih merugikan daripada widget yang lambat,
   sebab mereka tidak akan sadar sampai saldonya tidak cocok.

   Aman diulang karena setiap entri membawa client_request_id sendiri dan
   record_transaction_atomic menolak duplikatnya. */
final class QuickExpenseQueue {
    private static final String PREFS = "cuansync_quick_queue";
    private static final String KEY = "pending";
    /* Batas kasar supaya penyimpanan tidak menggelembung kalau seseorang
       mencatat berhari hari tanpa jaringan sama sekali. Yang terlama dibuang
       lebih dulu, karena yang terbaru paling diingat pengguna. */
    private static final int MAKS = 100;

    private QuickExpenseQueue() {}

    private static SharedPreferences prefs(Context context) {
        return context
            .getApplicationContext()
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static synchronized void tambah(Context context, QuickExpense expense) {
        try {
            JSONArray daftar = baca(context);
            daftar.put(expense.toJson());
            while (daftar.length() > MAKS) daftar.remove(0);
            prefs(context).edit().putString(KEY, daftar.toString()).apply();
        } catch (Exception abaikan) {
            /* Kegagalan menulis antrean tidak boleh menjatuhkan layar catat;
               pengguna sudah diberi tahu bahwa penyimpanan tertunda. */
        }
    }

    static synchronized List<QuickExpense> semua(Context context) {
        List<QuickExpense> hasil = new ArrayList<>();
        JSONArray daftar = baca(context);
        for (int i = 0; i < daftar.length(); i += 1) {
            JSONObject entri = daftar.optJSONObject(i);
            if (entri != null) hasil.add(QuickExpense.fromJson(entri));
        }
        return hasil;
    }

    static synchronized void hapus(Context context, String clientRequestId) {
        try {
            JSONArray daftar = baca(context);
            JSONArray sisa = new JSONArray();
            for (int i = 0; i < daftar.length(); i += 1) {
                JSONObject entri = daftar.optJSONObject(i);
                if (entri == null) continue;
                if (clientRequestId.equals(entri.optString("client_request_id"))) continue;
                sisa.put(entri);
            }
            prefs(context).edit().putString(KEY, sisa.toString()).apply();
        } catch (Exception abaikan) {
            /* Entri yang gagal dihapus akan dicoba lagi dan ditolak server
               sebagai duplikat, jadi tidak ada transaksi ganda. */
        }
    }

    static synchronized int jumlah(Context context) {
        return baca(context).length();
    }

    private static JSONArray baca(Context context) {
        String mentah = prefs(context).getString(KEY, "[]");
        try {
            return new JSONArray(mentah);
        } catch (Exception galat) {
            return new JSONArray();
        }
    }
}
