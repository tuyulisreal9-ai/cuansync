import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  addExchangeDecimals,
  calculateExchangeSourceAmount,
  calculateExchangeTargetAmount,
  deriveStoredExchangeRateOrientation,
  getDirectionalExchangeRate,
  normalizeExchangeRateOrientation,
  validateExchangeRate,
} from "../src/domain/exchangeRate.js";
import { settleExchangeCalculation } from "../src/domain/exchange.js";
import { normalizeNumericInput } from "../src/lib/currency.js";
import { buildAssetAccountBalancePlan } from "../src/domain/assets.js";
import { getTransactionAccountMovements } from "../src/domain/transactions.js";

test("constraint kurs menerima semua sumber rate transaksi", async () => {
  const migration = await readFile(
    new URL(
      "../supabase/manual_migrations/20260803_fix_transaction_rate_type_constraint.sql",
      import.meta.url,
    ),
    "utf8",
  );

  for (const rateType of [
    "realtime",
    "automatic",
    "custom",
    "historical",
    "transfer",
    "legacy",
    "base",
  ]) {
    assert.match(migration, new RegExp(`'${rateType}'`));
  }
  assert.equal(/\b(update|delete|truncate)\b/i.test(migration), false);
});

test("kurs IDR ke THB dinormalisasi menjadi THB per IDR", () => {
  const result = normalizeExchangeRateOrientation("0.001859", "IDR", "THB");
  assert.equal(result.rateBaseCurrency, "THB");
  assert.equal(result.rateQuoteCurrency, "IDR");
  assert.ok(Math.abs(Number(result.exchangeRate) - 537.9236148467) < 0.000001);
});

test("kurs custom money changer memakai 1 THB = 540 IDR", () => {
  const result = normalizeExchangeRateOrientation("540", "THB", "IDR");
  assert.deepEqual(
    {
      base: result.rateBaseCurrency,
      quote: result.rateQuoteCurrency,
      rate: result.exchangeRate,
    },
    { base: "THB", quote: "IDR", rate: "540" },
  );
});

test("IDR ke THB membagi nominal dengan kurs terorientasi", () => {
  assert.equal(
    calculateExchangeTargetAmount({
      sourceCurrency: "IDR",
      targetCurrency: "THB",
      sourceAmount: "5400000",
      rateBaseCurrency: "THB",
      rateQuoteCurrency: "IDR",
      exchangeRate: "540",
    }),
    "10000",
  );
});

test("nominal THB yang diterima menghitung mundur jumlah IDR", () => {
  assert.equal(
    calculateExchangeSourceAmount({
      sourceCurrency: "IDR",
      targetCurrency: "THB",
      targetAmount: "4000",
      rateBaseCurrency: "THB",
      rateQuoteCurrency: "IDR",
      exchangeRate: "543",
    }),
    "2172000",
  );
});

test("nominal USD yang diterima menghitung mundur jumlah IDR", () => {
  assert.equal(
    calculateExchangeSourceAmount({
      sourceCurrency: "IDR",
      targetCurrency: "USD",
      targetAmount: "100",
      rateBaseCurrency: "USD",
      rateQuoteCurrency: "IDR",
      exchangeRate: "16000",
    }),
    "1600000",
  );
});

test("kolom penerimaan menjadi acuan saat kurs berubah", () => {
  const result = settleExchangeCalculation(
    {
      from_currency: "IDR",
      to_currency: "THB",
      from_amount: "2,000,000",
      to_amount: "4,000",
      exchange_rate: "543",
      rate_base_currency: "THB",
      rate_quote_currency: "IDR",
    },
    "exchange_rate",
    {
      preferredTarget: "from_amount",
      rateBaseCurrency: "THB",
      rateQuoteCurrency: "IDR",
    },
  );

  assert.equal(result.from_amount, "2,172,000");
  assert.equal(result.to_amount, "4,000");
});

test("mengosongkan penerimaan ikut mengosongkan nominal asal otomatis", () => {
  const result = settleExchangeCalculation(
    {
      from_currency: "IDR",
      to_currency: "THB",
      from_amount: "2,172,000",
      to_amount: "",
      exchange_rate: "543",
      rate_base_currency: "THB",
      rate_quote_currency: "IDR",
    },
    "exchange_rate",
    {
      preferredTarget: "from_amount",
      rateBaseCurrency: "THB",
      rateQuoteCurrency: "IDR",
    },
  );

  assert.equal(result.from_amount, "");
  assert.equal(result.to_amount, "");
});

test("THB ke IDR mengalikan nominal dengan kurs terorientasi", () => {
  assert.equal(
    calculateExchangeTargetAmount({
      sourceCurrency: "THB",
      targetCurrency: "IDR",
      sourceAmount: "10000",
      rateBaseCurrency: "THB",
      rateQuoteCurrency: "IDR",
      exchangeRate: "540",
    }),
    "5400000",
  );
});

test("membalik arah tidak membalik orientasi tampilan kurs", () => {
  const forward = normalizeExchangeRateOrientation("0.001859", "IDR", "THB");
  const reverse = normalizeExchangeRateOrientation(
    forward.exchangeRate,
    "THB",
    "IDR",
  );
  assert.equal(reverse.rateBaseCurrency, forward.rateBaseCurrency);
  assert.equal(reverse.rateQuoteCurrency, forward.rateQuoteCurrency);
  assert.equal(reverse.exchangeRate, forward.exchangeRate);
});

test("raw rate di atas satu tidak diinversi", () => {
  const result = normalizeExchangeRateOrientation("1.52", "USD", "AUD");
  assert.equal(result.rateBaseCurrency, "USD");
  assert.equal(result.rateQuoteCurrency, "AUD");
  assert.equal(result.exchangeRate, "1.52");
});

test("kurs kosong, nol, negatif, NaN, dan teks ditolak", () => {
  for (const value of ["", "0", "-1", "NaN", "abc"]) {
    assert.equal(validateExchangeRate(value).valid, false, String(value));
  }
  assert.equal(validateExchangeRate("540.25").valid, true);
});

test("perubahan nominal memakai rate tanpa kehilangan orientasi", () => {
  const first = calculateExchangeTargetAmount({
    sourceCurrency: "IDR",
    targetCurrency: "THB",
    sourceAmount: "5400000",
    rateBaseCurrency: "THB",
    rateQuoteCurrency: "IDR",
    exchangeRate: "540",
  });
  const second = calculateExchangeTargetAmount({
    sourceCurrency: "IDR",
    targetCurrency: "THB",
    sourceAmount: "10800000",
    rateBaseCurrency: "THB",
    rateQuoteCurrency: "IDR",
    exchangeRate: "540",
  });
  assert.equal(first, "10000");
  assert.equal(second, "20000");
});

test("perubahan kurs custom langsung mengubah hasil", () => {
  const at540 = calculateExchangeTargetAmount({
    sourceCurrency: "IDR",
    targetCurrency: "THB",
    sourceAmount: "5400000",
    rateBaseCurrency: "THB",
    rateQuoteCurrency: "IDR",
    exchangeRate: "540",
  });
  const at600 = calculateExchangeTargetAmount({
    sourceCurrency: "IDR",
    targetCurrency: "THB",
    sourceAmount: "5400000",
    rateBaseCurrency: "THB",
    rateQuoteCurrency: "IDR",
    exchangeRate: "600",
  });
  assert.equal(at540, "10000");
  assert.equal(at600, "9000");
});

test("biaya admin terpisah dari kurs dan hasil konversi", () => {
  const received = calculateExchangeTargetAmount({
    sourceCurrency: "IDR",
    targetCurrency: "THB",
    sourceAmount: "5400000",
    rateBaseCurrency: "THB",
    rateQuoteCurrency: "IDR",
    exchangeRate: "540",
  });
  assert.equal(received, "10000");
  assert.equal(addExchangeDecimals("5400000", "25000"), "5425000");
});

test("rate arah transaksi tetap bisa diturunkan untuk kompatibilitas lama", () => {
  assert.equal(
    getDirectionalExchangeRate({
      sourceCurrency: "IDR",
      targetCurrency: "THB",
      rateBaseCurrency: "THB",
      rateQuoteCurrency: "IDR",
      exchangeRate: "540",
    }),
    "0.001851851852",
  );
});

test("transaksi historis diturunkan dari nominal tanpa mengubah nominalnya", () => {
  const legacy = {
    type: "exchange",
    from_currency: "IDR",
    to_currency: "THB",
    from_amount: 5400000,
    to_amount: 10000,
    rate: 0.00185185,
  };
  const before = JSON.stringify(legacy);
  const orientation = deriveStoredExchangeRateOrientation(legacy);
  assert.equal(orientation.rateBaseCurrency, "THB");
  assert.equal(orientation.rateQuoteCurrency, "IDR");
  assert.equal(orientation.exchangeRate, "540");
  assert.equal(JSON.stringify(legacy), before);
});

test("presisi perhitungan memakai rate penuh sebelum pembulatan akhir", () => {
  const rate = normalizeExchangeRateOrientation(
    "0.001859",
    "IDR",
    "THB",
  );
  const received = calculateExchangeTargetAmount({
    sourceCurrency: "IDR",
    targetCurrency: "THB",
    sourceAmount: "1000000",
    ...rate,
  });
  assert.equal(received, "1859");
});

test("saldo asal berkurang sebesar nominal ditukar ditambah biaya", () => {
  const accounts = [
    {
      id: "source-idr",
      user_id: "user-1",
      name: "BCA",
      type: "bank",
      currency: "IDR",
      balance_amount: 6000000,
      is_active: true,
    },
    {
      id: "destination-thb",
      user_id: "user-1",
      name: "Cash THB",
      type: "cash",
      currency: "THB",
      balance_amount: 0,
      is_active: true,
    },
  ];
  const transaction = {
    type: "exchange",
    from_currency: "IDR",
    to_currency: "THB",
    from_amount: 5400000,
    to_amount: 10000,
    fee_amount: 25000,
    fee_currency: "IDR",
    source_account_id: "source-idr",
    destination_account_id: "destination-thb",
  };
  const plan = buildAssetAccountBalancePlan(
    accounts,
    getTransactionAccountMovements(transaction),
  );
  const source = plan.nextAccounts.find((account) => account.id === "source-idr");
  assert.equal(source.balance_amount, 575000);
});

test("saldo tujuan bertambah sebesar hasil konversi tanpa dipotong biaya", () => {
  const accounts = [
    {
      id: "source-idr",
      user_id: "user-1",
      name: "BCA",
      type: "bank",
      currency: "IDR",
      balance_amount: 6000000,
      is_active: true,
    },
    {
      id: "destination-thb",
      user_id: "user-1",
      name: "Cash THB",
      type: "cash",
      currency: "THB",
      balance_amount: 0,
      is_active: true,
    },
  ];
  const transaction = {
    type: "exchange",
    from_currency: "IDR",
    to_currency: "THB",
    from_amount: 5400000,
    to_amount: 10000,
    fee_amount: 25000,
    fee_currency: "IDR",
    source_account_id: "source-idr",
    destination_account_id: "destination-thb",
  };
  const plan = buildAssetAccountBalancePlan(
    accounts,
    getTransactionAccountMovements(transaction),
  );
  const destination = plan.nextAccounts.find(
    (account) => account.id === "destination-thb",
  );
  assert.equal(destination.balance_amount, 10000);
});

test("nominal tukar dapat diisi dari sisi penerima dan mengisi balik sumbernya", () => {
  // Skenario: tukar rupiah ke rupee dengan kurs 1 LKR = Rp 45. Mengetik
  // 100.000 di sisi penerima harus mengisi Rp 4.500.000 di sisi sumber.
  const settled = settleExchangeCalculation(
    {
      from_currency: "IDR",
      to_currency: "LKR",
      from_amount: "",
      to_amount: "100000",
      exchange_rate: "45",
      rate_base_currency: "LKR",
      rate_quote_currency: "IDR",
    },
    "to_amount",
    { rateField: "exchange_rate" },
  );

  assert.equal(normalizeNumericInput(settled.from_amount), "4500000");
  assert.equal(normalizeNumericInput(settled.to_amount), "100000");

  // Arah sebaliknya tetap bekerja seperti sebelumnya.
  const back = settleExchangeCalculation(
    {
      from_currency: "IDR",
      to_currency: "LKR",
      from_amount: "4500000",
      to_amount: "",
      exchange_rate: "45",
      rate_base_currency: "LKR",
      rate_quote_currency: "IDR",
    },
    "from_amount",
    { rateField: "exchange_rate" },
  );

  assert.equal(normalizeNumericInput(back.to_amount), "100000");
});

test("kolom penerima pada layar pindah uang berupa input, bukan tampilan", async () => {
  const form = await readFile(
    new URL("../src/components/transactions/TransactionForm.js", import.meta.url),
    "utf8",
  );

  // Tanpa input ini pengguna hanya bisa mengisi dari sisi sumber.
  assert.match(form, /aria-label=\$\{`Jumlah diterima dalam \$\{form\.to_currency\}`\}/);
  assert.match(form, /updateField\(\s*"to_amount"/);
  assert.match(form, /onBlur=\$\{\(\) => settleExchangeField\("to_amount"\)\}/);

  // Pada transfer kedua sisi memakai mata uang sama, jadi mengetik di sisi
  // penerima harus mengisi balik sumbernya supaya nominal kirim tidak kosong.
  assert.match(form, /isTransfer && field === "to_amount"/);
});
