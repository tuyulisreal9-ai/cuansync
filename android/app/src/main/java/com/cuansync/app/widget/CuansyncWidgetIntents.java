package com.cuansync.app.widget;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;

import com.cuansync.app.MainActivity;

final class CuansyncWidgetIntents {
    private static final int ACTION_OPEN = 1;
    private static final int ACTION_EXPENSE = 2;
    private static final int ACTION_INCOME = 3;
    private static final int ACTION_TRANSFER = 4;

    private CuansyncWidgetIntents() {}

    static PendingIntent openApp(
        Context context,
        String providerKind,
        int appWidgetId
    ) {
        Intent intent = new Intent(context, MainActivity.class)
            .setAction(Intent.ACTION_MAIN)
            .addCategory(Intent.CATEGORY_LAUNCHER)
            .addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK |
                Intent.FLAG_ACTIVITY_CLEAR_TOP |
                Intent.FLAG_ACTIVITY_SINGLE_TOP
            );
        return activityPendingIntent(
            context,
            intent,
            requestCode(providerKind, appWidgetId, ACTION_OPEN)
        );
    }

    static PendingIntent quickEntry(
        Context context,
        String providerKind,
        int appWidgetId,
        String type
    ) {
        boolean income = "income".equals(type);
        Uri uri = new Uri.Builder()
            .scheme(CuansyncWidgetContract.URI_SCHEME)
            .authority(CuansyncWidgetContract.HOST_QUICK_ENTRY)
            .appendQueryParameter("type", income ? "income" : "expense")
            .build();
        Intent intent = widgetIntent(context, uri);
        return activityPendingIntent(
            context,
            intent,
            requestCode(
                providerKind,
                appWidgetId,
                income ? ACTION_INCOME : ACTION_EXPENSE
            )
        );
    }

    static PendingIntent transfer(
        Context context,
        String providerKind,
        int appWidgetId
    ) {
        Uri uri = new Uri.Builder()
            .scheme(CuansyncWidgetContract.URI_SCHEME)
            .authority(CuansyncWidgetContract.HOST_MOVEMENT)
            .appendQueryParameter("type", "transfer")
            .build();
        return activityPendingIntent(
            context,
            widgetIntent(context, uri),
            requestCode(providerKind, appWidgetId, ACTION_TRANSFER)
        );
    }

    private static Intent widgetIntent(Context context, Uri uri) {
        return new Intent(Intent.ACTION_VIEW, uri, context, MainActivity.class)
            .addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK |
                Intent.FLAG_ACTIVITY_CLEAR_TOP |
                Intent.FLAG_ACTIVITY_SINGLE_TOP
            );
    }

    private static PendingIntent activityPendingIntent(
        Context context,
        Intent intent,
        int requestCode
    ) {
        return PendingIntent.getActivity(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private static int requestCode(
        String providerKind,
        int appWidgetId,
        int actionCode
    ) {
        int result = 17;
        result = 31 * result + providerKind.hashCode();
        result = 31 * result + appWidgetId;
        result = 31 * result + actionCode;
        return result & 0x7fffffff;
    }
}
