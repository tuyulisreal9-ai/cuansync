package com.cuansync.app;

import android.os.Bundle;

import com.cuansync.app.widget.CuansyncWidgetPlugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Plugin lokal harus terdaftar sebelum Bridge Capacitor dibangun.
        registerPlugin(CuansyncWidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
