import test from "node:test";
import assert from "node:assert/strict";
import {
  buildKeypad,
  clampAmountFraction,
  pressAmountKey,
} from "../src/lib/amountKeypad.js";
import { getCurrencyMeta, normalizeNumericInput } from "../src/lib/currency.js";

// Mengetik satu per satu seperti pengguna menekan tombol.
function type(keys, fractionDigits) {
  return keys.reduce(
    (digits, key) => pressAmountKey(digits, key, fractionDigits),
    "",
  );
}

test("tombol kiri bawah mengikuti pecahan mata uang", () => {
  assert.deepEqual(buildKeypad(2), [
    "1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫",
  ]);
  assert.deepEqual(buildKeypad(0), [
    "1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0", "⌫",
  ]);

  // Nilai itu datang dari registri mata uang, bukan tebakan.
  assert.equal(getCurrencyMeta("USD").fractionDigits, 2);
  assert.equal(getCurrencyMeta("IDR").fractionDigits, 0);
});

test("belanja 3.50 dolar tersimpan sebagai 3,5 bukan 350", () => {
  const digits = type(["3", ".", "5", "0"], 2);
  assert.equal(digits, "3.50");
  assert.equal(Number(normalizeNumericInput(digits)), 3.5);

  assert.equal(Number(normalizeNumericInput(type(["2", ".", "5"], 2))), 2.5);
});

test("pemisah desimal hanya boleh satu dan tidak melebihi pecahan mata uang", () => {
  assert.equal(pressAmountKey("3.5", ".", 2), "3.5");
  assert.equal(pressAmountKey("3.50", "7", 2), "3.50");
  assert.equal(pressAmountKey("3.5", "0", 2), "3.50");
});

test("titik di awal menjadi nol koma", () => {
  assert.equal(pressAmountKey("", ".", 2), "0.");
  assert.equal(Number(normalizeNumericInput(type([".", "7", "5"], 2))), 0.75);
});

test("rupiah tidak menerima desimal dan tetap punya tombol ribuan", () => {
  assert.equal(pressAmountKey("3", ".", 0), "3");
  assert.equal(pressAmountKey("25", "000", 0), "25000");
  assert.equal(Number(normalizeNumericInput(type(["7", "5", "000"], 0))), 75000);
});

test("hapus dan batas panjang tetap berlaku", () => {
  assert.equal(pressAmountKey("3.5", "⌫", 2), "3.");
  assert.equal(pressAmountKey("3.", "⌫", 2), "3");
  assert.equal(pressAmountKey("", "⌫", 2), "");

  // Nol di depan tidak menumpuk, dan 12 digit adalah batasnya.
  assert.equal(pressAmountKey("0", "5", 0), "5");
  assert.equal(pressAmountKey("123456789012", "3", 0), "123456789012");
});

test("pindah dompet memangkas desimal yang tak berlaku di sana", () => {
  // Ketik 3.50 di dompet dolar, lalu pilih dompet rupiah.
  assert.equal(clampAmountFraction("3.50", 0), "3");
  // Ke mata uang yang pecahannya lebih sedikit, bukan lebih banyak.
  assert.equal(clampAmountFraction("3.456", 2), "3.45");
  assert.equal(clampAmountFraction("3.5", 2), "3.5");
  assert.equal(clampAmountFraction("4500", 0), "4500");
});
