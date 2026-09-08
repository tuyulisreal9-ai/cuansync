package com.cuansync.app.quick;

import android.content.Context;

import org.json.JSONObject;

import java.util.UUID;

/* Satu pengeluaran yang dicatat dari layar kilat.

   client_request_id dibuat sekali di sini dan ikut tersimpan di antrean.
   record_transaction_atomic memakainya sebagai kunci idempotensi, sehingga
   pengiriman ulang setelah sinyal pulih tidak akan pernah menghasilkan
   transaksi ganda walau permintaan pertama sebenarnya sudah sampai. */
final class QuickExpense {
    /* Dipilih pengguna sebagai pencatatan paling sering. Nilainya harus sama
       persis dengan CATEGORY_OPTIONS di src/domain/categories.js, dan grupnya
       dengan UNIVERSAL_BUDGET_GROUP. */
    static final String KATEGORI = "Makan";
    static final String GRUP_KATEGORI = "needs";

    final String id;
    final String clientRequestId;
    final String accountId;
    final String currency;
    final double amount;
    final String occurredAt;
    final String description;

    QuickExpense(
        String id,
        String clientRequestId,
        String accountId,
        String currency,
        double amount,
        String occurredAt,
        String description
    ) {
        this.id = id;
        this.clientRequestId = clientRequestId;
        this.accountId = accountId;
        this.currency = currency;
        this.amount = amount;
        this.occurredAt = occurredAt;
        this.description = description;
    }

    static QuickExpense baru(
        String accountId,
        String currency,
        double amount,
        String occurredAt,
        String description
    ) {
        return new QuickExpense(
            UUID.randomUUID().toString(),
            UUID.randomUUID().toString(),
            accountId,
            currency,
            amount,
            occurredAt,
            description
        );
    }

    JSONObject toJson() throws Exception {
        JSONObject json = new JSONObject();
        json.put("id", id);
        json.put("client_request_id", clientRequestId);
        json.put("account_id", accountId);
        json.put("currency", currency);
        json.put("amount", amount);
        json.put("occurred_at", occurredAt);
        json.put("description", description);
        return json;
    }

    static QuickExpense fromJson(JSONObject json) {
        return new QuickExpense(
            json.optString("id", UUID.randomUUID().toString()),
            json.optString("client_request_id", UUID.randomUUID().toString()),
            json.optString("account_id", ""),
            json.optString("currency", "IDR"),
            json.optDouble("amount", 0d),
            json.optString("occurred_at", ""),
            json.optString("description", "")
        );
    }

    /* Bentuk payload mengikuti record_transaction_atomic. Kolom yang tidak
       relevan bagi pengeluaran satu mata uang tetap dikirim sebagai null agar
       fungsi server tidak perlu menebak.

       base_amount hanya diisi ketika mata uang dompet sama dengan mata uang
       dasar. Untuk dompet valas, kurs historis dihitung aplikasi web dan tidak
       tersedia di sini; membiarkannya null jauh lebih benar daripada mengarang
       angka yang akan merusak laporan. */
    JSONObject payload(Context context, String userId, String baseCurrency) throws Exception {
        boolean samaDenganDasar = currency.equalsIgnoreCase(baseCurrency);
        JSONObject transaksi = new JSONObject();
        transaksi.put("id", id);
        transaksi.put("user_id", userId);
        transaksi.put("type", "expense");
        transaksi.put("occurred_at", occurredAt);
        transaksi.put("description", description);
        transaksi.put("category", KATEGORI);
        transaksi.put("category_group", GRUP_KATEGORI);
        transaksi.put("currency", currency);
        transaksi.put("amount", amount);
        transaksi.put("base_currency", baseCurrency);
        transaksi.put("base_amount", samaDenganDasar ? amount : JSONObject.NULL);
        transaksi.put("amount_idr", samaDenganDasar ? amount : JSONObject.NULL);
        transaksi.put("amount_thb", JSONObject.NULL);
        transaksi.put("locked_rate", JSONObject.NULL);
        transaksi.put("rate", JSONObject.NULL);
        transaksi.put("rate_base_currency", JSONObject.NULL);
        transaksi.put("rate_quote_currency", JSONObject.NULL);
        transaksi.put("exchange_rate", JSONObject.NULL);
        transaksi.put("rate_type", JSONObject.NULL);
        transaksi.put("from_currency", JSONObject.NULL);
        transaksi.put("to_currency", JSONObject.NULL);
        transaksi.put("from_amount", JSONObject.NULL);
        transaksi.put("to_amount", JSONObject.NULL);
        transaksi.put("fee_amount", JSONObject.NULL);
        transaksi.put("fee_currency", JSONObject.NULL);
        transaksi.put("source_account_id", accountId);
        transaksi.put("destination_account_id", JSONObject.NULL);
        /* target_id sengaja null. Pengeluaran dari dana target menuntut
           pemilihan target dan pemeriksaan dompet pendananya, dan itu bukan
           sesuatu yang bisa diputuskan dalam satu ketukan. */
        transaksi.put("target_id", JSONObject.NULL);
        transaksi.put("client_request_id", clientRequestId);

        JSONObject badan = new JSONObject();
        badan.put("p_transaction", transaksi);
        badan.put("p_reserved_action", JSONObject.NULL);
        return badan;
    }
}
