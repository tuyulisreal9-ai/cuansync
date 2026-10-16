package com.cuansync.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;

/** System Save As picker: only the user-selected document is writable. */
@CapacitorPlugin(name = "CuansyncDocuments")
public class CuansyncDocumentsPlugin extends Plugin {
    private volatile boolean saving;

    @PluginMethod
    public synchronized void savePdf(PluginCall call) {
        if (saving) {
            call.reject("Penyimpanan PDF masih berlangsung.");
            return;
        }
        String filename = call.getString("filename", "Laporan-CUANSYNC.pdf");
        String data = call.getString("data", "");
        if (!filename.toLowerCase(java.util.Locale.ROOT).endsWith(".pdf") ||
            filename.contains("/") || filename.contains("\\") || !data.startsWith("JVBERi0")) {
            call.reject("Berkas PDF tidak valid.");
            return;
        }
        saving = true;
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/pdf");
        intent.putExtra(Intent.EXTRA_TITLE, filename);
        try {
            startActivityForResult(call, intent, "pdfLocationSelected");
        } catch (Exception error) {
            saving = false;
            call.reject("Pemilih lokasi penyimpanan tidak tersedia.");
        }
    }

    @ActivityCallback
    private void pdfLocationSelected(PluginCall call, ActivityResult result) {
        if (call == null) {
            saving = false;
            return;
        }
        if (result.getResultCode() == Activity.RESULT_CANCELED) {
            saving = false;
            JSObject response = new JSObject();
            response.put("cancelled", true);
            call.resolve(response);
            return;
        }
        Uri uri = result.getData() == null ? null : result.getData().getData();
        if (result.getResultCode() != Activity.RESULT_OK || uri == null) {
            saving = false;
            call.reject("Lokasi penyimpanan belum dapat dibuka.");
            return;
        }
        execute(() -> {
            try {
                byte[] pdf = Base64.decode(call.getString("data", ""), Base64.DEFAULT);
                try (OutputStream output = getContext().getContentResolver().openOutputStream(uri, "w")) {
                    if (output == null) throw new java.io.IOException("No output stream");
                    output.write(pdf);
                    output.flush();
                }
                JSObject response = new JSObject();
                response.put("cancelled", false);
                call.resolve(response);
            } catch (Exception error) {
                call.reject("PDF gagal disimpan. Periksa ruang penyimpanan dan coba lagi.");
            } finally {
                saving = false;
            }
        });
    }
}
