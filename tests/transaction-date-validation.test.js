import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  FUTURE_TRANSACTION_DATE_MESSAGE,
  validateTransactionOccurredAt,
} from "../src/domain/transactions.js";

test("tanggal transaksi sekarang atau masa lalu diterima", () => {
  const now = new Date("2026-08-23T10:00:00.000Z");

  assert.equal(
    validateTransactionOccurredAt("2026-08-23T10:00:00.000Z", now).toISOString(),
    "2026-08-23T10:00:00.000Z",
  );
  assert.equal(
    validateTransactionOccurredAt("2026-08-22T10:00:00.000Z", now).toISOString(),
    "2026-08-22T10:00:00.000Z",
  );
});

test("tanggal transaksi masa depan dan tanggal tidak valid ditolak", () => {
  const now = new Date("2026-08-23T10:00:00.000Z");

  assert.throws(
    () => validateTransactionOccurredAt("2026-08-23T10:00:00.001Z", now),
    new RegExp(FUTURE_TRANSACTION_DATE_MESSAGE),
  );
  assert.throws(
    () => validateTransactionOccurredAt("bukan-tanggal", now),
    /Tanggal transaksi tidak valid/,
  );
});

test("form tambah dan edit membatasi pemilih tanggal sampai waktu sekarang", async () => {
  const [createForm, editForm, main] = await Promise.all([
    readFile(new URL("../src/components/transactions/TransactionForm.js", import.meta.url), "utf8"),
    readFile(new URL("../src/components/transactions/TransactionDetailSheet.js", import.meta.url), "utf8"),
    readFile(new URL("../src/main.js", import.meta.url), "utf8"),
  ]);

  assert.match(createForm, /max=\$\{toInputDateTime\(\)\}/);
  assert.match(createForm, /transactionDateInvalid/);
  assert.match(editForm, /max=\$\{toInputDateTime\(\)\}/);
  assert.match(editForm, /transactionDateInvalid/);
  assert.match(main, /validateTransactionOccurredAt\(payload\.occurred_at\)/);
});
