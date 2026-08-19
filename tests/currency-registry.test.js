import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { getExchangeAmountDigits } from "../src/domain/exchangeRate.js";
import {
  CURRENCY_REGISTRY,
  DEFAULT_ACTIVE_CURRENCIES,
  formatCurrency,
  getCurrencyMeta,
  groupCurrencyOptions,
  searchCurrencyOptions,
} from "../src/lib/currency.js";
import {
  fetchGlobalCurrencyRates,
  hasGlobalRatesForCurrencies,
} from "../src/lib/exchangeRates.js";

const EXPECTED_CURRENCIES = [
  "IDR",
  "THB",
  "SGD",
  "MYR",
  "JPY",
  "KRW",
  "TWD",
  "HKD",
  "CNY",
  "VND",
  "PHP",
  "INR",
  "LKR",
  "SAR",
  "AED",
  "USD",
  "AUD",
  "EUR",
  "GBP",
];

test("registry memuat 19 mata uang dalam urutan produk", () => {
  assert.deepEqual(DEFAULT_ACTIVE_CURRENCIES, EXPECTED_CURRENCIES);
  assert.deepEqual(
    CURRENCY_REGISTRY.map((currency) => currency.code),
    EXPECTED_CURRENCIES,
  );
});

test("registry mengelompokkan mata uang berdasarkan wilayah", () => {
  const groups = groupCurrencyOptions(DEFAULT_ACTIVE_CURRENCIES);
  assert.deepEqual(
    groups.map((group) => group.label),
    ["Asia", "Timur Tengah", "Global"],
  );
  assert.deepEqual(
    groups[0].options.map((option) => option.value),
    EXPECTED_CURRENCIES.slice(0, 13),
  );
  assert.deepEqual(
    groups[1].options.map((option) => option.value),
    ["SAR", "AED"],
  );
  assert.deepEqual(
    groups[2].options.map((option) => option.value),
    ["USD", "AUD", "EUR", "GBP"],
  );
});

for (const [query, expected] of [
  ["LKR", "LKR"],
  ["Sri Lanka", "LKR"],
  ["Rupee Sri Lanka", "LKR"],
  ["Taiwan", "TWD"],
  ["Hong Kong", "HKD"],
  ["Yuan", "CNY"],
]) {
  test(`pencarian mata uang menerima ${query}`, () => {
    assert.equal(searchCurrencyOptions(query)[0]?.value, expected);
  });
}

test("digit pecahan mengikuti metadata setiap mata uang", () => {
  for (const code of ["IDR", "JPY", "KRW", "VND"]) {
    assert.equal(getCurrencyMeta(code).fractionDigits, 0);
    assert.equal(getExchangeAmountDigits(code), 0);
  }

  for (const code of [
    "THB",
    "TWD",
    "HKD",
    "CNY",
    "PHP",
    "INR",
    "LKR",
    "SAR",
    "AED",
    "USD",
  ]) {
    assert.equal(getCurrencyMeta(code).fractionDigits, 2);
    assert.equal(getExchangeAmountDigits(code), 2);
  }
});

test("mata uang dengan simbol ambigu tetap menampilkan identitas yang jelas", () => {
  assert.match(formatCurrency(1_000, "LKR"), /LKR/);
  assert.match(formatCurrency(1_000, "SAR"), /SAR/);
  assert.match(formatCurrency(1_000, "AED"), /AED/);
});

test("provider kurs dinilai lengkap untuk seluruh registry", async () => {
  const rates = Object.fromEntries(
    DEFAULT_ACTIVE_CURRENCIES.filter((code) => code !== "IDR").map(
      (code, index) => [code, (index + 1) / 10_000],
    ),
  );
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({
      result: "success",
      base_code: "IDR",
      rates: { IDR: 1, ...rates },
      time_last_update_utc: "Wed, 19 Aug 2026 00:00:00 +0000",
    }),
  });

  const snapshot = await fetchGlobalCurrencyRates({ fetchImpl });
  assert.equal(
    hasGlobalRatesForCurrencies(snapshot, DEFAULT_ACTIVE_CURRENCIES, "IDR"),
    true,
  );
  assert.ok(snapshot.rates.LKR > 0);
  assert.ok(snapshot.rates.AED > 0);
});

test("schema dan migration menerima seluruh kode registry", async () => {
  const [schema, migration] = await Promise.all([
    readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../supabase/migrations/20260819093218_expand_currency_registry.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  for (const code of EXPECTED_CURRENCIES) {
    assert.match(schema, new RegExp(`'${code}'`));
    assert.match(migration, new RegExp(`'${code}'`));
  }
  assert.match(
    migration,
    /drop constraint if exists user_settings_currency_code_chk/i,
  );
  assert.match(
    migration,
    /validate constraint user_settings_daily_currency_chk/i,
  );
});
