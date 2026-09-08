package com.cuansync.app.quick;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.TextView;
import android.widget.Toast;

import com.cuansync.app.MainActivity;
import com.cuansync.app.R;
import com.cuansync.app.widget.CuansyncWidgetSnapshot;
import com.cuansync.app.widget.CuansyncWidgetUpdater;

import java.text.SimpleDateFormat;
import java.util.Currency;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/* Catat pengeluaran tanpa membuka aplikasi.

   Alasan layar ini asli Android dan bukan WebView: jalur lama membuka
   MainActivity, menyalakan Capacitor, memuat bundel, lalu mem-mount React
   sebelum sheet muncul. Beberapa detik, dan pengguna merasakannya sebagai
   "membuka aplikasi". Layar ini tampil seketika karena tidak ada satu pun dari
   itu yang dijalankan.

   Konsekuensinya jalur simpan tidak bisa menumpang kode web, sehingga
   penulisan dikerjakan langsung ke record_transaction_atomic. Seluruh
   validasi tetap milik server; tidak ada aturan bisnis yang disalin ke sini. */
public class QuickExpenseActivity extends Activity {
    private final ExecutorService pekerja = Executors.newSingleThreadExecutor();
    private final Handler utama = new Handler(Looper.getMainLooper());

    private CuansyncWidgetSnapshot snapshot;
    private String digit = "";
    private int pecahan;
    private boolean menyimpan;

    private TextView tampilanNominal;
    private TextView tampilanDompet;
    private TextView tampilanPetunjuk;
    private TextView tombolSimpan;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        setContentView(R.layout.cuansync_quick_expense);

        Window jendela = getWindow();
        if (jendela != null) {
            jendela.setLayout(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.WRAP_CONTENT
            );
            jendela.setGravity(android.view.Gravity.BOTTOM);
        }

        tampilanNominal = findViewById(R.id.quick_amount);
        tampilanDompet = findViewById(R.id.quick_wallet);
        tampilanPetunjuk = findViewById(R.id.quick_hint);
        tombolSimpan = findViewById(R.id.quick_save);

        snapshot = CuansyncWidgetSnapshot.read(this);
        pecahan = pecahanMataUang(snapshot.primaryWalletCurrency);

        pasangKeypad();
        tombolSimpan.setOnClickListener(view -> simpan());
        tampilanDompet.setOnClickListener(view -> bukaAplikasi());

        if (!snapshot.bisaCatatKilat()) {
            tampilkanBelumSiap();
            return;
        }

        tampilanDompet.setText(snapshot.primaryWalletName);
        perbaruiNominal();

        /* Kesempatan paling wajar untuk mengosongkan antrean: pengguna baru
           saja membuka layar ini, jadi kemungkinan besar ada jaringan. */
        pekerja.execute(() ->
            QuickExpenseSender.kirimAntrean(getApplicationContext(), snapshot.baseCurrency)
        );
    }

    private void tampilkanBelumSiap() {
        tampilanDompet.setText(R.string.quick_wallet_placeholder);
        tampilanPetunjuk.setText(R.string.quick_not_ready);
        tombolSimpan.setText(R.string.quick_open_app);
        tombolSimpan.setOnClickListener(view -> bukaAplikasi());
        for (int id : TOMBOL_ANGKA) findViewById(id).setEnabled(false);
        findViewById(R.id.quick_key_extra).setEnabled(false);
        findViewById(R.id.quick_key_back).setEnabled(false);
    }

    private static final int[] TOMBOL_ANGKA = {
        R.id.quick_key_0, R.id.quick_key_1, R.id.quick_key_2,
        R.id.quick_key_3, R.id.quick_key_4, R.id.quick_key_5,
        R.id.quick_key_6, R.id.quick_key_7, R.id.quick_key_8,
        R.id.quick_key_9,
    };

    private void pasangKeypad() {
        for (int i = 0; i < TOMBOL_ANGKA.length; i += 1) {
            final String angka = String.valueOf(i);
            findViewById(TOMBOL_ANGKA[i]).setOnClickListener(view -> tekan(angka));
        }

        TextView ekstra = findViewById(R.id.quick_key_extra);
        /* Mata uang tanpa pecahan mendapat "000" karena nominal rupiah selalu
           ribuan; yang berpecahan mendapat pemisah desimal. */
        ekstra.setText(pecahan > 0 ? "." : "000");
        ekstra.setOnClickListener(view -> tekan(pecahan > 0 ? "." : "000"));

        findViewById(R.id.quick_key_back).setOnClickListener(view -> hapus());
    }

    private void tekan(String tombol) {
        if (menyimpan) return;
        if (".".equals(tombol)) {
            if (digit.contains(".")) return;
            digit = digit.isEmpty() ? "0." : digit + ".";
        } else if (digit.isEmpty() && "0".equals(tombol)) {
            return;
        } else if (digit.isEmpty() && "000".equals(tombol)) {
            return;
        } else {
            int titik = digit.indexOf('.');
            if (titik >= 0 && digit.length() - titik - 1 + tombol.length() > pecahan) return;
            if (digit.length() + tombol.length() > 15) return;
            digit = digit + tombol;
        }
        perbaruiNominal();
    }

    private void hapus() {
        if (menyimpan || digit.isEmpty()) return;
        digit = digit.substring(0, digit.length() - 1);
        if ("0.".equals(digit) || "0".equals(digit)) digit = "";
        perbaruiNominal();
    }

    private void perbaruiNominal() {
        tampilanNominal.setText(
            snapshot.primaryWalletCurrency + " " + (digit.isEmpty() ? "0" : digit)
        );
        tombolSimpan.setEnabled(nominal() > 0);
        tombolSimpan.setAlpha(nominal() > 0 ? 1f : 0.45f);
    }

    private double nominal() {
        if (digit.isEmpty()) return 0d;
        try {
            return Double.parseDouble(digit);
        } catch (NumberFormatException galat) {
            return 0d;
        }
    }

    private void simpan() {
        if (menyimpan) return;
        final double jumlah = nominal();
        if (jumlah <= 0) return;

        menyimpan = true;
        tombolSimpan.setText(R.string.quick_saving);
        tombolSimpan.setEnabled(false);

        final QuickExpense pengeluaran = QuickExpense.baru(
            snapshot.primaryWalletId,
            snapshot.primaryWalletCurrency,
            jumlah,
            waktuSekarang(),
            getString(R.string.quick_default_description)
        );

        pekerja.execute(() -> {
            CuansyncSession sesi = CuansyncSession.muat(getApplicationContext());
            if (sesi == null) {
                /* Sesi tidak dapat dipulihkan. Diantrekan juga, karena membuka
                   aplikasi sekali akan menyegarkannya dan antrean ikut
                   terkirim; nominalnya tidak perlu diketik ulang. */
                QuickExpenseQueue.tambah(getApplicationContext(), pengeluaran);
                utama.post(() -> selesai(getString(R.string.quick_queued_session)));
                return;
            }

            QuickExpenseSender.Hasil hasil = QuickExpenseSender.kirim(
                getApplicationContext(),
                sesi,
                pengeluaran,
                snapshot.baseCurrency
            );

            if (hasil.kode == QuickExpenseSender.SUKSES) {
                CuansyncWidgetUpdater.refreshAll(getApplicationContext());
                utama.post(() -> selesai(getString(R.string.quick_saved)));
                return;
            }
            if (hasil.kode == QuickExpenseSender.DITOLAK) {
                /* Penolakan server bersifat tetap. Mengantrekannya hanya akan
                   mengulang kegagalan yang sama, jadi pesannya ditampilkan
                   apa adanya dan layar tetap terbuka agar bisa diperbaiki. */
                utama.post(() -> gagalTetap(hasil.pesan));
                return;
            }

            QuickExpenseQueue.tambah(getApplicationContext(), pengeluaran);
            utama.post(() -> selesai(getString(R.string.quick_queued_offline)));
        });
    }

    private void selesai(String pesan) {
        Toast.makeText(getApplicationContext(), pesan, Toast.LENGTH_SHORT).show();
        finish();
    }

    private void gagalTetap(String pesan) {
        menyimpan = false;
        tombolSimpan.setText(R.string.quick_save);
        tombolSimpan.setEnabled(true);
        tampilanPetunjuk.setText(pesan);
    }

    private void bukaAplikasi() {
        Intent intent = new Intent(this, MainActivity.class)
            .setAction(Intent.ACTION_MAIN)
            .addCategory(Intent.CATEGORY_LAUNCHER)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        startActivity(intent);
        finish();
    }

    private static String waktuSekarang() {
        SimpleDateFormat format = new SimpleDateFormat(
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
            Locale.US
        );
        format.setTimeZone(TimeZone.getTimeZone("UTC"));
        return format.format(new Date());
    }

    /* java.util.Currency tahu jumlah pecahan tiap mata uang, jadi tidak perlu
       daftar sendiri yang bisa melenceng dari daftar di aplikasi web. */
    private static int pecahanMataUang(String kode) {
        try {
            int digit = Currency.getInstance(kode).getDefaultFractionDigits();
            return Math.max(digit, 0);
        } catch (Exception galat) {
            return 2;
        }
    }

    @Override
    protected void onDestroy() {
        pekerja.shutdown();
        super.onDestroy();
    }
}
