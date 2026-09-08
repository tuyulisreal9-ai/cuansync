package com.cuansync.app.widget;

import android.content.Context;
import android.content.SharedPreferences;

import java.text.DateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

public final class CuansyncWidgetSnapshot {
    public final boolean hasSnapshot;
    public final boolean isSignedIn;
    public final boolean isFreshToday;
    public final boolean hideAmounts;
    public final String primaryWalletName;
    public final String primaryWalletId;
    public final String primaryWalletCurrency;
    public final String baseCurrency;
    public final String todayExpenseFormatted;
    public final int todayCount;
    public final long updatedAt;

    private CuansyncWidgetSnapshot(
        boolean hasSnapshot,
        boolean isSignedIn,
        boolean isFreshToday,
        boolean hideAmounts,
        String primaryWalletName,
        String primaryWalletId,
        String primaryWalletCurrency,
        String baseCurrency,
        String todayExpenseFormatted,
        int todayCount,
        long updatedAt
    ) {
        this.hasSnapshot = hasSnapshot;
        this.isSignedIn = isSignedIn;
        this.isFreshToday = isFreshToday;
        this.hideAmounts = hideAmounts;
        this.primaryWalletName = primaryWalletName;
        this.primaryWalletId = primaryWalletId;
        this.primaryWalletCurrency = primaryWalletCurrency;
        this.baseCurrency = baseCurrency;
        this.todayExpenseFormatted = todayExpenseFormatted;
        this.todayCount = todayCount;
        this.updatedAt = updatedAt;
    }

    /* Catat kilat hanya mungkin kalau pengguna masih masuk dan dompet
       tujuannya diketahui. Kesegaran hari tidak diperiksa di sini: dompet
       utama tidak berubah karena hari berganti. */
    public boolean bisaCatatKilat() {
        return hasSnapshot
            && isSignedIn
            && !primaryWalletId.isEmpty()
            && !primaryWalletCurrency.isEmpty();
    }

    public static CuansyncWidgetSnapshot read(Context context) {
        SharedPreferences preferences = context.getSharedPreferences(
            CuansyncWidgetContract.PREFS_NAME,
            Context.MODE_PRIVATE
        );
        boolean hasSnapshot = preferences.getBoolean(
            CuansyncWidgetContract.KEY_HAS_SNAPSHOT,
            false
        );
        boolean isSignedIn = preferences.getBoolean(
            CuansyncWidgetContract.KEY_IS_SIGNED_IN,
            false
        );
        String dayKey = preferences.getString(
            CuansyncWidgetContract.KEY_DAY_KEY,
            ""
        );
        boolean isFreshToday = hasSnapshot && currentDayKey().equals(dayKey);

        return new CuansyncWidgetSnapshot(
            hasSnapshot,
            isSignedIn,
            isFreshToday,
            preferences.getBoolean(CuansyncWidgetContract.KEY_HIDE_AMOUNTS, true),
            preferences.getString(CuansyncWidgetContract.KEY_PRIMARY_WALLET, ""),
            preferences.getString(CuansyncWidgetContract.KEY_PRIMARY_WALLET_ID, ""),
            preferences.getString(CuansyncWidgetContract.KEY_PRIMARY_WALLET_CURRENCY, ""),
            preferences.getString(CuansyncWidgetContract.KEY_BASE_CURRENCY, "IDR"),
            preferences.getString(CuansyncWidgetContract.KEY_TODAY_EXPENSE, ""),
            Math.max(0, preferences.getInt(CuansyncWidgetContract.KEY_TODAY_COUNT, 0)),
            Math.max(0L, preferences.getLong(CuansyncWidgetContract.KEY_UPDATED_AT, 0L))
        );
    }

    static String currentDayKey() {
        Calendar calendar = Calendar.getInstance();
        return String.format(
            Locale.ROOT,
            "%04d-%02d-%02d",
            calendar.get(Calendar.YEAR),
            calendar.get(Calendar.MONTH) + 1,
            calendar.get(Calendar.DAY_OF_MONTH)
        );
    }

    String updatedTimeLabel(Context context) {
        if (updatedAt <= 0L) return "";
        DateFormat formatter = android.text.format.DateFormat.getTimeFormat(context);
        return formatter.format(new Date(updatedAt));
    }
}
