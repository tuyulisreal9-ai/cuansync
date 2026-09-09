package com.cuansync.app.widget;

public final class CuansyncWidgetContract {
    static final String URI_SCHEME = "com.cuansync.app";
    static final String HOST_QUICK_ENTRY = "quick-entry";
    static final String HOST_MOVEMENT = "movement";

    static final String KIND_QUICK = "quick";
    static final String KIND_SUMMARY = "summary";

    static final String PREFS_NAME = "cuansync_widget_snapshot";
    static final String KEY_HAS_SNAPSHOT = "has_snapshot";
    static final String KEY_DAY_KEY = "day_key";
    static final String KEY_UPDATED_AT = "updated_at";
    static final String KEY_PRIMARY_WALLET = "primary_wallet_name";
    static final String KEY_TODAY_COUNT = "today_count";
    static final String KEY_TODAY_EXPENSE = "today_expense_formatted";
    static final String KEY_HIDE_AMOUNTS = "hide_amounts";
    static final String KEY_IS_SIGNED_IN = "is_signed_in";

    /* Catat kilat menulis transaksi tanpa membuka WebView, jadi ia butuh tahu
       dompet mana yang dipakai dan mata uang apa. Ketiganya bukan rahasia:
       pengenal dompet milik pengguna sendiri, di penyimpanan privat aplikasi.
       Token, surel, dan transaksi mentah tetap tidak pernah disimpan di sini. */
    static final String KEY_PRIMARY_WALLET_ID = "primary_wallet_id";
    static final String KEY_PRIMARY_WALLET_CURRENCY = "primary_wallet_currency";
    static final String KEY_BASE_CURRENCY = "base_currency";

    private CuansyncWidgetContract() {}
}
