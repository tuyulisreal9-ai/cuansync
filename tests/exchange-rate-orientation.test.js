import assert from "node:assert/strict";
import test from "node:test";
import {
  addExchangeDecimals,
  calculateExchangeTargetAmount,
  deriveStoredExchangeRateOrientation,
  getDirectionalExchangeRate,
  normalizeExchangeRateOrientation,
  validateExchangeRate,
} from "../src/domain/exchangeRate.js";
import { buildAssetAccountBalancePlan } from "../src/domain/assets.js";
import { getTransactionAccountMovements } from "../src/domain/transactions.js";

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
