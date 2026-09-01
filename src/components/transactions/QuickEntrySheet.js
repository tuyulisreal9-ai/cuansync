import React, { useEffect, useState } from "react";
import htm from "htm";
import { StickyNote } from "lucide-react";
import { UNIVERSAL_BUDGET_GROUP } from "../../domain/budgets.js";
import { useSheetClose } from "../../lib/sheetClose.js";
import {
  DEFAULT_BASE_CURRENCY,
  formatCurrency,
  normalizeCurrencyCode,
} from "../../lib/currency.js";

const html = htm.bind(React.createElement);

/* Keypad mengikuti susunan desain: tiga kolom, 000 dan hapus di baris akhir. */
const KEYPAD = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0", "⌫"];

function pickDefaultAccount(accounts, currency) {
  const sameCurrency = accounts.filter(
    (account) => normalizeCurrencyCode(account.currency) === currency,
  );
  const pool = sameCurrency.length ? sameCurrency : accounts;
  return pool.find((account) => account.isPrimary || account.is_primary) || pool[0] || null;
}

/* Catat cepat: satu layar untuk pemasukan dan pengeluaran sederhana. Transfer,
   tukar mata uang, tanggal mundur, dan pemilihan dompet non-utama tetap
   dikerjakan form lengkap lewat tautan "Atur detail". */
export function QuickEntrySheet({
  open,
  onClose,
  onSubmit,
  onOpenFullForm,
  accounts = [],
  categories = [],
  baseCurrency = DEFAULT_BASE_CURRENCY,
  loading = false,
}) {
  const baseCode = normalizeCurrencyCode(baseCurrency);
  const [entryType, setEntryType] = useState("expense");
  const [digits, setDigits] = useState("");
  const [category, setCategory] = useState(categories[0]?.value || "");
  const [accountId, setAccountId] = useState("");
  const [note, setNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const { closing, requestClose } = useSheetClose(onClose, open);

  useEffect(() => {
    if (!open) return;
    setEntryType("expense");
    setDigits("");
    setCategory(categories[0]?.value || "");
    setAccountId(pickDefaultAccount(accounts, baseCode)?.id || "");
    setNote("");
    setNoteOpen(false);
  }, [open]);

  if (!open) return null;

  const amount = Number(digits || 0);
  const hasAmount = amount > 0;
  const account =
    accounts.find((item) => item.id === accountId) ||
    pickDefaultAccount(accounts, baseCode);
  /* Mata uang transaksi mengikuti dompet yang dipilih, bukan mata uang dasar.
     validateTransactionAccountLinks menolak transaksi yang mata uangnya beda
     dari dompetnya, jadi memakai mata uang dasar untuk dompet valas membuat
     simpanan gagal sekaligus salah catat. */
  const currency = normalizeCurrencyCode(account?.currency || baseCode);
  const isExpense = entryType === "expense";
  const categoryHint =
    categories.find((item) => item.value === category)?.description || "";

  function press(key) {
    if (key === "⌫") {
      setDigits((current) => current.slice(0, -1));
      return;
    }
    setDigits((current) => {
      const next = `${current}${key}`.replace(/^0+(?=\d)/, "");
      // Batasi 12 digit agar nominal tetap terbaca pada satu baris.
      return next.length > 12 ? current : next;
    });
  }

  async function save() {
    if (!hasAmount || !account) return;
    const payload = {
      type: entryType,
      occurred_at: new Date().toISOString(),
      description:
        note.trim() ||
        (isExpense
          ? categories.find((item) => item.value === category)?.label ||
            "Pengeluaran"
          : "Pemasukan"),
      category_group: isExpense ? UNIVERSAL_BUDGET_GROUP : null,
      category: isExpense ? category : null,
      currency,
      amount: String(amount),
      amount_idr: null,
      amount_thb: null,
      exchange_rate: null,
      expense_currency: isExpense ? currency : null,
      from_currency: null,
      to_currency: null,
      from_amount: null,
      to_amount: null,
      rate: null,
      rate_base_currency: null,
      rate_quote_currency: null,
      rate_type: null,
      fee_amount: null,
      source_account_id: isExpense ? account.id : null,
      destination_account_id: isExpense ? null : account.id,
      target_id: null,
    };
    const ok = await onSubmit(payload);
    if (ok) requestClose();
  }

  const segment = (active) =>
    active
      ? { background: "var(--cs-sel-bg)", color: "var(--cs-sel-fg)" }
      : { background: "transparent", color: "var(--cs-body)" };

  /* Chip kategori dan chip dompet memakai metrik yang sama di desain:
     tinggi 38, radius 99, padding 0 15, teks 12.5px/500. */
  const chip = (label, active, onPick) => html`
    <button
      key=${label}
      type="button"
      onClick=${onPick}
      aria-pressed=${active}
      className="dc-press dc-press-94 flex min-h-[38px] flex-none items-center whitespace-nowrap rounded-full border px-[15px] text-[12.5px] font-medium"
      style=${active
        ? {
            background: "var(--cs-sel-bg)",
            color: "var(--cs-sel-fg)",
            borderColor: "var(--cs-sel-bg)",
          }
        : {
            background: "var(--cs-card)",
            color: "var(--cs-body)",
            borderColor: "var(--cs-line)",
          }}
    >
      ${label}
    </button>
  `;

  return html`
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Tutup catat transaksi"
        onClick=${requestClose}
        className=${`${closing ? "dc-overlay-out" : "dc-overlay-in"} absolute inset-0`}
        style=${{ background: "rgba(20,18,15,0.42)" }}
      ></button>

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Catat transaksi"
        className=${`${closing ? "dc-sheet-down" : "dc-sheet-up"} absolute inset-x-0 bottom-0 flex max-h-[92svh] flex-col gap-4 overflow-y-auto px-5 pb-6 pt-3`}
        style=${{
          background: "var(--cs-bg)",
          borderRadius: "26px 26px 0 0",
          boxShadow: "0 -12px 40px rgba(0,0,0,0.18)",
        }}
      >
        <span
          className="mx-auto block h-1 w-[42px] shrink-0 rounded-full"
          style=${{ background: "var(--cs-dim)" }}
        ></span>

        <div className="flex items-center justify-between">
          <span className="text-[17px] font-bold tracking-[-0.2px]">
            Catat transaksi
          </span>
          <button
            type="button"
            onClick=${requestClose}
            className="flex min-h-10 items-center pl-3.5 text-[13px]"
            style=${{ color: "var(--cs-mut)" }}
          >
            Nanti
          </button>
        </div>

        <div
          className="flex gap-1 rounded-[14px] p-1"
          style=${{ background: "var(--cs-seg)" }}
        >
          <button
            type="button"
            onClick=${() => setEntryType("expense")}
            aria-pressed=${isExpense}
            className="min-h-10 flex-1 rounded-[11px] text-[13px] font-bold"
            style=${segment(isExpense)}
          >
            Keluar
          </button>
          <button
            type="button"
            onClick=${() => setEntryType("income")}
            aria-pressed=${!isExpense}
            className="min-h-10 flex-1 rounded-[11px] text-[13px] font-bold"
            style=${segment(!isExpense)}
          >
            Masuk
          </button>
        </div>

        <div className="flex flex-col items-center gap-1 py-1">
          <span className="text-xs" style=${{ color: "var(--cs-mut)" }}>Berapa?</span>
          <div className="flex items-end gap-[5px]">
            <span className="pb-[5px] text-[18px]" style=${{ color: "var(--cs-mut)" }}>
              ${currency === "IDR" ? "Rp" : currency}
            </span>
            <span
              className="dc-num text-[34px] leading-none tracking-[-1.4px]"
              style=${{ color: hasAmount ? "var(--cs-ink)" : "var(--cs-faint)" }}
            >
              ${hasAmount
                ? formatCurrency(amount, currency).replace(/^[^\d-]*/, "")
                : "0"}
            </span>
          </div>
        </div>

        ${isExpense && categories.length
          ? html`
              <div className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3 px-0.5">
                  <span
                    className="shrink-0 whitespace-nowrap text-xs"
                    style=${{ color: "var(--cs-mut)" }}
                  >
                    Masuk kategori apa?
                  </span>
                  <span
                    className="min-w-0 truncate text-right text-xs"
                    style=${{ color: "var(--cs-faint)" }}
                  >
                    ${categoryHint}
                  </span>
                </div>
                <div className="dc-scroll-x flex gap-2 overflow-x-auto pb-0.5">
                  ${categories.map((item) =>
                    chip(item.label, item.value === category, () =>
                      setCategory(item.value),
                    ),
                  )}
                </div>
              </div>
            `
          : null}

        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick=${() => setNoteOpen((current) => !current)}
            className="flex min-h-11 items-center gap-[11px] px-0.5 text-left"
          >
            <${StickyNote}
              aria-hidden="true"
              className="h-[17px] w-[17px] shrink-0"
              style=${{ color: "var(--cs-mut)" }}
              strokeWidth=${1.75}
            />
            <span
              className="flex-1 truncate text-[13.5px]"
              style=${{ color: "var(--cs-body)" }}
            >
              ${!noteOpen && note ? note : "Tambah catatan (opsional)"}
            </span>
            <span
              className="text-xs font-bold"
              style=${{ color: "var(--cs-link)" }}
            >
              ${noteOpen ? "Tutup" : "Tulis"}
            </span>
          </button>
          ${noteOpen
            ? html`
                <input
                  value=${note}
                  onChange=${(event) => setNote(event.target.value)}
                  placeholder="Contoh: kopi sama teman"
                  className="min-h-11 rounded-[13px] border px-[13px] text-[13.5px]"
                  style=${{
                    background: "var(--cs-card)",
                    borderColor: "var(--cs-line)",
                    color: "var(--cs-ink)",
                  }}
                />
              `
            : null}
        </div>

        ${accounts.length
          ? html`
              <div className="flex flex-col gap-1.5">
                <span
                  className="px-0.5 text-xs"
                  style=${{ color: "var(--cs-mut)" }}
                >
                  ${isExpense ? "Dari dompet mana?" : "Masuk ke dompet mana?"}
                </span>
                <div className="dc-scroll-x flex gap-2 overflow-x-auto pb-0.5">
                  ${/* Kode mata uang ditempel pada dompet valas supaya jelas
                        bahwa nominal yang diketik mengikuti mata uang dompet
                        itu, bukan mata uang dasar. */ null}
                  ${accounts.map((item) => {
                    const code = normalizeCurrencyCode(item.currency);
                    const label =
                      code === baseCode ? item.name : `${item.name} · ${code}`;
                    return chip(label, item.id === account?.id, () =>
                      setAccountId(item.id),
                    );
                  })}
                </div>
              </div>
            `
          : null}

        <div className="grid grid-cols-3 gap-2">
          ${KEYPAD.map(
            (key) => html`
              <button
                key=${key}
                type="button"
                onClick=${() => press(key)}
                aria-label=${key === "⌫" ? "Hapus satu angka" : key}
                className="dc-num dc-press dc-press-96 flex min-h-[50px] items-center justify-center rounded-[15px] border text-[19px]"
                style=${{
                  background: "var(--cs-card)",
                  borderColor: "var(--cs-line)",
                }}
              >
                ${key}
              </button>
            `,
          )}
        </div>

        <button
          type="button"
          onClick=${save}
          disabled=${!hasAmount || !account || loading}
          className="flex min-h-[52px] items-center justify-center rounded-[17px] text-[15px] font-bold"
          style=${hasAmount && account
            ? { background: "var(--cs-acc)", color: "var(--cs-on-acc)" }
            : { background: "var(--cs-track)", color: "var(--cs-faint)" }}
        >
          ${loading
            ? "Menyimpan..."
            : !account
              ? "Tambahkan dompet dulu"
              : hasAmount
                ? "Simpan catatan"
                : "Isi jumlahnya dulu"}
        </button>

        <button
          type="button"
          onClick=${() => {
            onClose();
            onOpenFullForm?.(entryType, digits);
          }}
          className="min-h-10 text-[13px] font-medium"
          style=${{ color: "var(--cs-link)" }}
        >
          Atur detail — tanggal atau tukar mata uang
        </button>
      </div>
    </div>
  `;
}
