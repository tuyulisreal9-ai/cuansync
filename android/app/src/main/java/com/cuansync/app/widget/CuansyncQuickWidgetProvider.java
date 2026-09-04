package com.cuansync.app.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;

public class CuansyncQuickWidgetProvider extends AppWidgetProvider {
    /* AppWidgetProvider.onReceive hanya meneruskan aksi appwidget; aksi lain
       diabaikan tanpa jejak. Pergantian hari karena itu harus ditangani di
       sini, bukan cukup didaftarkan di manifest. */
    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (CuansyncWidgetUpdater.isDayBoundaryAction(intent)) {
            CuansyncWidgetUpdater.refreshQuick(context);
        }
    }

    @Override
    public void onUpdate(
        Context context,
        AppWidgetManager appWidgetManager,
        int[] appWidgetIds
    ) {
        for (int appWidgetId : appWidgetIds) {
            CuansyncWidgetUpdater.updateQuick(
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
        CuansyncWidgetUpdater.updateQuick(context, appWidgetManager, appWidgetId);
    }
}
