package com.cuansync.app.widget;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

import com.cuansync.app.R;

public final class CuansyncWidgetUpdater {
    private CuansyncWidgetUpdater() {}

    public static void refreshAll(Context context) {
        refreshQuick(context);
        refreshSummary(context);
    }

    static void refreshQuick(Context context) {
        Context appContext = context.getApplicationContext();
        AppWidgetManager manager = AppWidgetManager.getInstance(appContext);
        int[] appWidgetIds = manager.getAppWidgetIds(
            new ComponentName(appContext, CuansyncQuickWidgetProvider.class)
        );
        for (int appWidgetId : appWidgetIds) {
            updateQuick(appContext, manager, appWidgetId);
        }
    }

    static void refreshSummary(Context context) {
        Context appContext = context.getApplicationContext();
        AppWidgetManager manager = AppWidgetManager.getInstance(appContext);
        int[] appWidgetIds = manager.getAppWidgetIds(
            new ComponentName(appContext, CuansyncSummaryWidgetProvider.class)
        );
        for (int appWidgetId : appWidgetIds) {
            updateSummary(appContext, manager, appWidgetId);
        }
    }

    /* Kesegaran snapshot dinilai saat widget digambar, bukan saat jam berganti.
       Tanpa pemicu di pergantian hari, RemoteViews terakhir tetap terpampang
       dan total kemarin ikut terbaca sebagai pengeluaran hari ini. Tiga aksi
       ini adalah cara sistem memberi tahu bahwa kunci hari berpotensi berubah:
       lewat tengah malam, jam disetel ulang, dan zona waktu berpindah. */
    static boolean isDayBoundaryAction(Intent intent) {
        String action = intent == null ? null : intent.getAction();
        if (action == null) return false;
        return Intent.ACTION_DATE_CHANGED.equals(action) ||
            Intent.ACTION_TIME_CHANGED.equals(action) ||
            Intent.ACTION_TIMEZONE_CHANGED.equals(action);
    }

    static void updateQuick(
        Context context,
        AppWidgetManager manager,
        int appWidgetId
    ) {
        CuansyncWidgetSnapshot snapshot = CuansyncWidgetSnapshot.read(context);
        RemoteViews views = new RemoteViews(
            context.getPackageName(),
            R.layout.cuansync_widget_quick
        );

        String subtitle = context.getString(R.string.widget_quick_subtitle);
        if (snapshot.hasSnapshot && !snapshot.isSignedIn) {
            subtitle = context.getString(R.string.widget_signed_out_short);
        } else if (
            snapshot.isSignedIn &&
            snapshot.isFreshToday &&
            !snapshot.primaryWalletName.isEmpty()
        ) {
            subtitle = snapshot.primaryWalletName;
        }
        views.setTextViewText(R.id.widget_quick_subtitle, subtitle);

        views.setOnClickPendingIntent(
            R.id.widget_quick_root,
            CuansyncWidgetIntents.openApp(
                context,
                CuansyncWidgetContract.KIND_QUICK,
                appWidgetId
            )
        );
        views.setOnClickPendingIntent(
            R.id.widget_quick_expense,
            CuansyncWidgetIntents.quickEntry(
                context,
                CuansyncWidgetContract.KIND_QUICK,
                appWidgetId,
                "expense"
            )
        );
        views.setOnClickPendingIntent(
            R.id.widget_quick_income,
            CuansyncWidgetIntents.quickEntry(
                context,
                CuansyncWidgetContract.KIND_QUICK,
                appWidgetId,
                "income"
            )
        );
        manager.updateAppWidget(appWidgetId, views);
    }

    static void updateSummary(
        Context context,
        AppWidgetManager manager,
        int appWidgetId
    ) {
        CuansyncWidgetSnapshot snapshot = CuansyncWidgetSnapshot.read(context);
        RemoteViews views = new RemoteViews(
            context.getPackageName(),
            R.layout.cuansync_widget_summary
        );

        String walletLabel = context.getString(R.string.widget_primary_wallet);
        String amountLabel;
        String detailLabel;

        if (!snapshot.hasSnapshot || !snapshot.isSignedIn) {
            walletLabel = context.getString(R.string.widget_private_label);
            amountLabel = context.getString(R.string.widget_signed_out_prompt);
            detailLabel = context.getString(R.string.widget_signed_out_detail);
        } else if (!snapshot.isFreshToday) {
            walletLabel = context.getString(R.string.widget_stale_badge);
            amountLabel = context.getString(R.string.widget_stale_prompt);
            detailLabel = context.getString(R.string.widget_stale_detail);
        } else {
            if (!snapshot.primaryWalletName.isEmpty()) {
                walletLabel = snapshot.primaryWalletName;
            }
            amountLabel = snapshot.hideAmounts
                ? context.getString(R.string.widget_hidden_amount)
                : snapshot.todayExpenseFormatted;
            if (amountLabel == null || amountLabel.trim().isEmpty()) {
                amountLabel = context.getString(R.string.widget_zero_amount);
            }

            String transactionLabel = context.getResources().getQuantityString(
                R.plurals.widget_transaction_count,
                snapshot.todayCount,
                snapshot.todayCount
            );
            String updateTime = snapshot.updatedTimeLabel(context);
            detailLabel = updateTime.isEmpty()
                ? transactionLabel
                : context.getString(
                    R.string.widget_transaction_updated,
                    transactionLabel,
                    updateTime
                );
        }

        views.setTextViewText(R.id.widget_summary_wallet, walletLabel);
        views.setTextViewText(R.id.widget_summary_amount, amountLabel);
        views.setTextViewText(R.id.widget_summary_detail, detailLabel);

        views.setOnClickPendingIntent(
            R.id.widget_summary_root,
            CuansyncWidgetIntents.openApp(
                context,
                CuansyncWidgetContract.KIND_SUMMARY,
                appWidgetId
            )
        );
        views.setOnClickPendingIntent(
            R.id.widget_summary_expense,
            CuansyncWidgetIntents.quickEntry(
                context,
                CuansyncWidgetContract.KIND_SUMMARY,
                appWidgetId,
                "expense"
            )
        );
        views.setOnClickPendingIntent(
            R.id.widget_summary_income,
            CuansyncWidgetIntents.quickEntry(
                context,
                CuansyncWidgetContract.KIND_SUMMARY,
                appWidgetId,
                "income"
            )
        );
        views.setOnClickPendingIntent(
            R.id.widget_summary_transfer,
            CuansyncWidgetIntents.transfer(
                context,
                CuansyncWidgetContract.KIND_SUMMARY,
                appWidgetId
            )
        );
        manager.updateAppWidget(appWidgetId, views);
    }
}
