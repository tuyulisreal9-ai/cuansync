import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatCurrencyInput,
  getNumericInputOptions,
  normalizeNumericInput,
  parseCurrencyInput,
} from "../src/lib/currency.js";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("peringatan saldo tabungan tidak menempelkan kata ke nama dompet", async () => {
  const form = await source("src/components/transactions/TransactionForm.js");
  /* htm membuang spasi dan baris baru di batas teks dan ${...}. Kalimat yang
     dipotong tepat sebelum ${...} terbaca "tersimpan diBCA". */
  assert.doesNotMatch(form, /tersimpan di\s*\r?\n\s*\$\{/);
});

/* Rp 25.000 pernah tersimpan sebagai 25 karena titik selalu dibaca sebagai
   desimal. Transfer Rp 25.000 hanya memindahkan Rp 25, tanpa peringatan. */
test("nominal rupiah bertitik dibaca sebagai ribuan", () => {
  assert.equal(parseCurrencyInput("25.000", "IDR"), "25000");
  assert.equal(parseCurrencyInput("1.500.000", "IDR"), "1500000");
  assert.equal(parseCurrencyInput("25,000", "IDR"), "25000");
  assert.equal(parseCurrencyInput("1,500,000", "IDR"), "1500000");
  // Rupiah tidak berpecahan, jadi koma pun hanya pemisah ribuan.
  assert.equal(parseCurrencyInput("20,50", "IDR"), "2050");
});

test("mata uang berpecahan tetap menerima desimal", () => {
  assert.equal(parseCurrencyInput("20.50", "USD"), "20.50");
  // Keyboard Indonesia mengetik koma sebagai desimal.
  assert.equal(parseCurrencyInput("20,50", "USD"), "20.50");
  assert.equal(parseCurrencyInput("1,234.56", "USD"), "1234.56");
  assert.equal(parseCurrencyInput("1.234,56", "USD"), "1234.56");
  // Pola ribuan tetap dikenali walau mata uangnya berpecahan.
  assert.equal(parseCurrencyInput("1.500.000", "USD"), "1500000");
  assert.equal(parseCurrencyInput("25.000", "USD"), "25000");
  // Titik yang baru diketik harus bertahan supaya desimal bisa dilanjutkan.
  assert.equal(parseCurrencyInput("20.", "USD"), "20.");
});

test("kolom kurs tidak kehilangan angka kecil", () => {
  assert.equal(normalizeNumericInput("0.0000625"), "0.0000625");
  assert.equal(normalizeNumericInput("0.075"), "0.075");
  assert.equal(normalizeNumericInput("17543.86"), "17543.86");
  assert.equal(normalizeNumericInput("16.000"), "16000");
  assert.equal(normalizeNumericInput("16.000.000"), "16000000");
});

test("keypad Catat cepat tidak terpengaruh", () => {
  assert.equal(normalizeNumericInput(".75"), ".75");
  assert.equal(normalizeNumericInput("2.5"), "2.5");
  assert.equal(normalizeNumericInput("75000"), "75000");
});

test("kolom nominal dikelompokkan mengikuti mata uangnya", () => {
  assert.equal(formatCurrencyInput("25000", "IDR"), "25.000");
  assert.equal(formatCurrencyInput("25.000", "IDR"), "25.000");
  assert.equal(formatCurrencyInput("1234.5", "USD"), "1,234.5");
  assert.deepEqual(getNumericInputOptions("IDR"), {
    allowDecimal: false,
    fractionDigits: 0,
    locale: "id-ID",
  });
  // Tanpa mata uang, aturan paling longgar dipakai agar desimal tidak hilang.
  assert.equal(getNumericInputOptions(null).allowDecimal, true);
});

/* Kurs "16.000" yang diketik dengan pemisah ribuan terbaca sebagai 16,
   sehingga Rp 160.000 ditukar menjadi 10.000 dolar, bukan 10 dolar. */
test("kolom kurs membakukan nilainya saat diketik", async () => {
  const { RATE_INPUT_OPTIONS } = await import("../src/lib/currency.js");
  const { serializeExchangeRate } = await import("../src/domain/exchangeRate.js");

  const dibakukan = normalizeNumericInput("16.000", RATE_INPUT_OPTIONS);
  assert.equal(dibakukan, "16000");
  assert.equal(serializeExchangeRate(dibakukan), "16000");
  // Kurs kecil dan berpecahan tetap utuh.
  assert.equal(normalizeNumericInput("0.0000625", RATE_INPUT_OPTIONS), "0.0000625");
  assert.equal(normalizeNumericInput("17543.86", RATE_INPUT_OPTIONS), "17543.86");

  const form = await source("src/components/transactions/TransactionForm.js");
  assert.match(
    form,
    /updateField\(\s*"exchange_rate",\s*normalizeNumericInput\(/,
    "kolom kurs harus dibakukan saat diketik",
  );
});

test("kolom nominal transaksi membawa mata uangnya sendiri", async () => {
  const form = await source("src/components/transactions/TransactionForm.js");
  const sheet = await source("src/components/transactions/TransactionDetailSheet.js");

  /* Tanpa opsi mata uang, kolom rupiah memakai aturan desimal en-US dan
     nominal bertitik kembali terbaca seperseribu. */
  for (const [nama, berkas] of [
    ["form transaksi", form],
    ["sheet edit", sheet],
  ]) {
    assert.doesNotMatch(
      berkas,
      /formatNumericInput\(event\.target\.value\)/,
      `${nama}: kolom nominal harus memakai opsi mata uang`,
    );
  }
});
