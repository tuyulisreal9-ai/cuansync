package com.cuansync.app.widget;

final class CuansyncWidgetContract {
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

    private CuansyncWidgetContract() {}
}
