package com.cuansync.app.quick;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.nio.charset.StandardCharsets;

final class CuansyncHttp {
    private CuansyncHttp() {}

    /* HttpURLConnection memisahkan aliran sukses dan galat. Pesan galat dari
       PostgREST justru yang paling berguna untuk ditampilkan, jadi keduanya
       dibaca lewat satu jalan. */
    static String bacaSemua(HttpURLConnection koneksi) {
        InputStream aliran = null;
        try {
            aliran = koneksi.getResponseCode() / 100 == 2
                ? koneksi.getInputStream()
                : koneksi.getErrorStream();
        } catch (Exception galat) {
            aliran = koneksi.getErrorStream();
        }
        if (aliran == null) return "";

        try (InputStream masuk = aliran) {
            ByteArrayOutputStream penampung = new ByteArrayOutputStream();
            byte[] penyangga = new byte[4096];
            int terbaca;
            while ((terbaca = masuk.read(penyangga)) != -1) {
                penampung.write(penyangga, 0, terbaca);
            }
            return penampung.toString(StandardCharsets.UTF_8.name());
        } catch (Exception galat) {
            return "";
        }
    }
}
