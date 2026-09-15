import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  getMovementBlockReason,
  getMovementHelperText,
} from "../src/components/transactions/TransactionForm.js";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

const BCA = { id: "bca", name: "BCA", currency: "IDR" };
const JAGO = { id: "jago", name: "Jago", currency: "IDR" };
const WISE = { id: "wise", name: "Wise USD", currency: "USD" };

function alasan(overrides = {}) {
  return getMovementBlockReason({
    sourceAccount: BCA,
    destinationAccount: JAGO,
    isTransfer: true,
    rateValid: true,
    fromAmount: 100_000,
    toAmount: 100_000,
    balanceSufficient: true,
    dateInvalid: false,
    disabled: true,
    ...overrides,
  });
}

/* Saat saldo kurang, tombol tetap berbunyi "Isi jumlahnya dulu", sehingga
   saldo yang tidak cukup terbaca seperti nominal yang belum diisi. */
test("tombol menyebut alasan yang sebenarnya", () => {
  assert.equal(alasan({ balanceSufficient: false }), "Saldo BCA tidak cukup");
  assert.equal(alasan({ fromAmount: 0 }), "Isi jumlahnya dulu");
  assert.equal(alasan({ toAmount: 0 }), "Jumlah diterima belum terisi");
  assert.equal(alasan({ sourceAccount: null }), "Pilih dompet asal");
  assert.equal(alasan({ destinationAccount: null }), "Pilih dompet tujuan");
  assert.equal(
    alasan({ destinationAccount: BCA }),
    "Pilih dua dompet berbeda",
  );
  assert.equal(alasan({ dateInvalid: true }), "Tanggalnya belum benar");
});

test("tukar dan transfer punya syarat mata uangnya sendiri", () => {
  assert.equal(
    alasan({ destinationAccount: WISE }),
    "Transfer perlu mata uang yang sama",
  );
  assert.equal(
    alasan({ isTransfer: false, destinationAccount: JAGO }),
    "Tukar perlu dua mata uang berbeda",
  );
  assert.equal(
    alasan({ isTransfer: false, destinationAccount: WISE, rateValid: false }),
    "Isi kursnya dulu",
  );
});

test("tanpa penghalang, tombol tidak menyimpan alasan", () => {
  assert.equal(alasan({ disabled: false }), null);
});

/* Dengan nominal yang sudah valid, form tetap meminta "Isi jumlahnya dulu"
   lewat teks bantuan di atas tombol. */
test("teks bantuan hanya muncul saat memang ada yang kurang", () => {
  assert.equal(
    getMovementHelperText({ sourceAccount: BCA, fromAmount: 100_000 }),
    "",
  );
  assert.match(
    getMovementHelperText({ sourceAccount: BCA, fromAmount: 0 }),
    /Isi jumlahnya dulu/,
  );
  assert.equal(
    getMovementHelperText({
      sourceAccount: BCA,
      fromAmount: 2_000_000,
      balanceSufficient: false,
    }),
    "Saldo BCA tidak mencukupi.",
  );
});

test("istilah memakai satu bahasa", async () => {
  const berkas = await Promise.all(
    [
      "src/components/transactions/history.js",
      "src/components/transactions/HistoryListParts.js",
      "src/components/transactions/RecentTransactionsPreview.js",
      "src/components/transactions/TransactionDetailSheet.js",
      "src/components/layout/DesktopWorkspace.js",
    ].map((path) => source(path)),
  );

  for (const isi of berkas) {
    assert.doesNotMatch(isi, /"Exchange"|Transfer \/ Exchange|Wallet Aktif/);
  }
});
