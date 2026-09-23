import React, { useEffect, useState } from "react";
import htm from "htm";
import { SheetShell } from "../shared/SheetShell.js";
import {
  DEFAULT_BASE_CURRENCY,
  formatNumericInput,
  getNumericInputOptions,
  normalizeCurrencyCode,
  normalizeNumericInput,
} from "../../lib/currency.js";

const html = htm.bind(React.createElement);

/* Perkiraan pemasukan bulanan, terutama untuk yang bergaji tetap. Ini bukan
   transaksi, jadi saldo tidak berubah. Arus kas memakainya selama pemasukan
   yang tercatat bulan ini masih lebih kecil dari perkiraan. */
export function IncomeEstimateSheet({
  open,
  onClose,
  estimate = null,
  currencies = [],
  baseCurrency = DEFAULT_BASE_CURRENCY,
  onSave,
  saving = false,
}) {
  const base = normalizeCurrencyCode(baseCurrency);
  const options = [
    ...new Set([base, ...currencies.map((code) => normalizeCurrencyCode(code))]),
  ];
  const [currency, setCurrency] = useState(base);
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (!open) return;
    const startCurrency = normalizeCurrencyCode(estimate?.currency || base);
    setCurrency(startCurrency);
    setAmount(
      Number(estimate?.amount) > 0
        ? formatNumericInput(
            String(estimate.amount),
            getNumericInputOptions(startCurrency),
          )
        : "",
    );
  }, [open]);

  const inputOptions = getNumericInputOptions(currency);
  const parsedAmount = Number(normalizeNumericInput(amount, inputOptions) || 0);
  const valid = parsedAmount > 0;
  const hasSavedEstimate = Number(estimate?.amount) > 0;

  function changeCurrency(nextCurrency) {
    setCurrency(nextCurrency);
    setAmount((current) =>
      formatNumericInput(current, getNumericInputOptions(nextCurrency)),
    );
  }

  async function submit(event) {
    event.preventDefault();
    if (!valid || saving) return;
    const ok = await onSave?.({ amount: parsedAmount, currency });
    if (ok) onClose?.();
  }

  async function clear() {
    if (saving) return;
    const ok = await onSave?.(null);
    if (ok) onClose?.();
  }

  return html`
    <${SheetShell}
      open=${open}
      onClose=${onClose}
      title="Perkiraan pemasukan bulanan"
      helper="Dipakai menilai arus kas selama pemasukan bulan ini belum tercatat penuh. Saldo tidak berubah."
      labelledBy="income-estimate-title"
    >
      <form className="grid gap-4" onSubmit=${submit}>
        <label className="block">
          <span
            className="mb-2 block px-0.5 text-xs font-bold"
            style=${{ color: "var(--cs-body)" }}
          >
            Kira-kira pemasukan per bulan
          </span>
          <span className="flex gap-2">
            ${options.length > 1
              ? html`
                  <select
                    value=${currency}
                    onChange=${(event) => changeCurrency(event.target.value)}
                    aria-label="Mata uang perkiraan"
                    className="cs-edit-input min-h-12 shrink-0 rounded-[14px] border px-3 text-[15px] font-medium"
                  >
                    ${options.map(
                      (code) => html`<option key=${code} value=${code}>${code}</option>`,
                    )}
                  </select>
                `
              : html`
                  <span className="flex min-h-12 shrink-0 items-center px-1 text-[15px] font-bold">
                    ${currency}
                  </span>
                `}
            <input
              type="text"
              inputMode=${inputOptions.allowDecimal ? "decimal" : "numeric"}
              autoComplete="off"
              value=${amount}
              onChange=${(event) =>
                setAmount(formatNumericInput(event.target.value, inputOptions))}
              placeholder="0"
              aria-label="Nominal perkiraan pemasukan"
              className="cs-edit-input min-h-12 w-full min-w-0 rounded-[14px] border px-3.5 text-[15px] font-medium"
            />
          </span>
        </label>

        <p
          className="px-0.5 text-[12px] leading-[1.5]"
          style=${{ color: "var(--cs-mut)" }}
        >
          Kalau pemasukan yang kamu catat bulan ini lebih besar, angka nyatanya
          yang dipakai. Skor dan saran akan menyebut bila hitungannya memakai
          perkiraan.
        </p>

        <button
          type="submit"
          disabled=${!valid || saving}
          className="dc-press dc-press-96 flex min-h-[52px] items-center justify-center rounded-[17px] text-[15px] font-bold"
          style=${valid && !saving
            ? { background: "var(--cs-acc)", color: "var(--cs-on-acc)" }
            : { background: "var(--cs-track)", color: "var(--cs-faint)" }}
        >
          ${saving
            ? "Menyimpan..."
            : valid
              ? "Simpan perkiraan"
              : "Isi nominalnya dulu"}
        </button>

        ${hasSavedEstimate
          ? html`
              <button
                type="button"
                onClick=${clear}
                disabled=${saving}
                className="dc-press dc-press-96 flex min-h-12 items-center justify-center rounded-[16px] border text-sm font-bold"
                style=${{ borderColor: "var(--cs-line)", color: "var(--cs-body)" }}
              >
                Hapus perkiraan
              </button>
            `
          : null}
      </form>
    </${SheetShell}>
  `;
}
