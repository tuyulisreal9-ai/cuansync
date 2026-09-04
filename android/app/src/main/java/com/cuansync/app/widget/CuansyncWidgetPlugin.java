package com.cuansync.app.widget;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

@CapacitorPlugin(name = "CuansyncWidget")
public class CuansyncWidgetPlugin extends Plugin {
    private static final int MAX_WALLET_LENGTH = 40;
    private static final int MAX_AMOUNT_LENGTH = 48;

    @PluginMethod
    public void updateSnapshot(PluginCall call) {
        boolean isSignedIn = call.getBoolean("isSignedIn", false);
        long updatedAt = sanitizeUpdatedAt(call.getData().opt("updatedAt"));
        SharedPreferences preferences = getContext().getSharedPreferences(
            CuansyncWidgetContract.PREFS_NAME,
            Context.MODE_PRIVATE
        );
        SharedPreferences.Editor editor = preferences.edit().clear()
            .putBoolean(CuansyncWidgetContract.KEY_HAS_SNAPSHOT, true)
            .putBoolean(CuansyncWidgetContract.KEY_IS_SIGNED_IN, isSignedIn)
            .putLong(CuansyncWidgetContract.KEY_UPDATED_AT, updatedAt);

        if (!isSignedIn) {
            // Logout harus menghapus nama dompet dan nominal pengguna lama.
            editor
                .putBoolean(CuansyncWidgetContract.KEY_HIDE_AMOUNTS, true)
                .putString(
                    CuansyncWidgetContract.KEY_DAY_KEY,
                    CuansyncWidgetSnapshot.currentDayKey()
                )
                .apply();
            CuansyncWidgetUpdater.refreshAll(getContext());
            resolveUpdated(call);
            return;
        }

        String dayKey = sanitizeDayKey(call.getString("dayKey"));
        String walletName = sanitizeText(
            call.getString("primaryWalletName"),
            MAX_WALLET_LENGTH
        );
        String expense = sanitizeText(
            call.getString("todayExpenseFormatted"),
            MAX_AMOUNT_LENGTH
        );
        int todayCount = clampCount(call.getInt("todayCount", 0));
        boolean hideAmounts = call.getBoolean("hideAmounts", true);

        editor
            .putString(CuansyncWidgetContract.KEY_DAY_KEY, dayKey)
            .putString(CuansyncWidgetContract.KEY_PRIMARY_WALLET, walletName)
            .putInt(CuansyncWidgetContract.KEY_TODAY_COUNT, todayCount)
            .putString(CuansyncWidgetContract.KEY_TODAY_EXPENSE, expense)
            .putBoolean(CuansyncWidgetContract.KEY_HIDE_AMOUNTS, hideAmounts)
            .apply();

        CuansyncWidgetUpdater.refreshAll(getContext());
        resolveUpdated(call);
    }

    @PluginMethod
    public void clearSnapshot(PluginCall call) {
        getContext()
            .getSharedPreferences(
                CuansyncWidgetContract.PREFS_NAME,
                Context.MODE_PRIVATE
            )
            .edit()
            .clear()
            .apply();
        CuansyncWidgetUpdater.refreshAll(getContext());
        resolveUpdated(call);
    }

    @PluginMethod
    public void requestPin(PluginCall call) {
        String kind = call.getString("kind", CuansyncWidgetContract.KIND_QUICK);
        if (
            !CuansyncWidgetContract.KIND_QUICK.equals(kind) &&
            !CuansyncWidgetContract.KIND_SUMMARY.equals(kind)
        ) {
            call.reject("Jenis widget harus 'quick' atau 'summary'.", "INVALID_KIND");
            return;
        }

        JSObject result = new JSObject();
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            result.put("supported", false);
            result.put("requested", false);
            call.resolve(result);
            return;
        }

        AppWidgetManager manager = AppWidgetManager.getInstance(getContext());
        boolean supported = manager.isRequestPinAppWidgetSupported();
        boolean requested = false;
        if (supported) {
            Class<?> providerClass = CuansyncWidgetContract.KIND_SUMMARY.equals(kind)
                ? CuansyncSummaryWidgetProvider.class
                : CuansyncQuickWidgetProvider.class;
            requested = manager.requestPinAppWidget(
                new ComponentName(getContext(), providerClass),
                null,
                null
            );
        }
        result.put("supported", supported);
        result.put("requested", requested);
        call.resolve(result);
    }

    private static void resolveUpdated(PluginCall call) {
        JSObject result = new JSObject();
        result.put("updated", true);
        call.resolve(result);
    }

    private static String sanitizeDayKey(String value) {
        if (value != null && value.matches("\\d{4}-\\d{2}-\\d{2}")) {
            return value;
        }
        return CuansyncWidgetSnapshot.currentDayKey();
    }

    private static String sanitizeText(String value, int maxLength) {
        if (value == null) return "";
        String sanitized = value
            .replace('\n', ' ')
            .replace('\r', ' ')
            .trim();
        if (sanitized.length() <= maxLength) return sanitized;
        return sanitized.substring(0, maxLength).trim();
    }

    private static int clampCount(Integer value) {
        if (value == null) return 0;
        return Math.max(0, Math.min(value, 9999));
    }

    private static long sanitizeUpdatedAt(Object rawValue) {
        long now = System.currentTimeMillis();
        long parsed = now;
        if (rawValue instanceof Number) {
            parsed = ((Number) rawValue).longValue();
        } else if (rawValue instanceof String) {
            String text = ((String) rawValue).trim();
            try {
                parsed = Long.parseLong(text);
            } catch (NumberFormatException ignored) {
                Long isoValue = parseIsoDate(text);
                if (isoValue != null) parsed = isoValue;
            }
        } else if (rawValue == null || rawValue == JSONObject.NULL) {
            parsed = now;
        }

        // Detik Unix juga diterima agar kontrak tidak rapuh antar pemanggil.
        if (parsed > 0L && parsed < 10_000_000_000L) parsed *= 1000L;
        if (parsed <= 0L || parsed > now + 300_000L) return now;
        return parsed;
    }

    private static Long parseIsoDate(String value) {
        String[] patterns = {
            "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
            "yyyy-MM-dd'T'HH:mm:ssXXX"
        };
        for (String pattern : patterns) {
            try {
                SimpleDateFormat formatter = new SimpleDateFormat(pattern, Locale.US);
                formatter.setLenient(false);
                Date parsed = formatter.parse(value);
                if (parsed != null) return parsed.getTime();
            } catch (ParseException ignored) {
                // Coba pola ISO berikutnya lalu gunakan waktu perangkat.
            }
        }
        return null;
    }
}
