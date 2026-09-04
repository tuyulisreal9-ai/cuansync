package com.cuansync.app.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;

public class CuansyncSummaryWidgetProvider extends AppWidgetProvider {
    /* Widget inilah yang menampilkan nominal, jadi pergantian hari wajib
       menggambar ulang supaya total kemarin segera berganti menjadi ajakan
       memperbarui, bukan tetap terbaca sebagai pengeluaran hari ini. */
    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (CuansyncWidgetUpdater.isDayBoundaryAction(intent)) {
            CuansyncWidgetUpdater.refreshSummary(context);
        }
    }

    @Override
    public void onUpdate(
        Context context,
        AppWidgetManager appWidgetManager,
        int[] appWidgetIds
    ) {
        for (int appWidgetId : appWidgetIds) {
            CuansyncWidgetUpdater.updateSummary(
                context,
                appWidgetManager,
                appWidgetId
            );
        }
    }

    @Override
    public void onAppWidgetOptionsChanged(
        Context context,
        AppWidgetManager appWidgetManager,
        int appWidgetId,
        Bundle newOptions
    ) {
        super.onAppWidgetOptionsChanged(
            context,
            appWidgetManager,
            appWidgetId,
            newOptions
        );
        CuansyncWidgetUpdater.updateSummary(context, appWidgetManager, appWidgetId);
    }
}
