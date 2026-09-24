import React, { useEffect, useMemo, useState } from "react";
import htm from "htm";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  CircleAlert,
  Plus,
} from "lucide-react";
import { getDateInputValue } from "../../lib/dates.js";
import { useSheetClose } from "../../lib/sheetClose.js";
import {
  DEFAULT_BASE_CURRENCY,
  formatCurrency,
  formatNumericInput,
  getCurrencyMeta,
  getNumericInputOptions,
  normalizeCurrencyCode,
  normalizeNumericInput,
} from "../../lib/currency.js";
import {
  getBulkRowTitle,
  groupBulkEntryRows,
  isBulkRowIncomplete,
  parseBulkEntryText,
  planBulkEntrySave,
  resolveBulkDefaultAccount,
  summarizeBulkEntryRows,
} from "../../domain/bulkEntry.js";

const html = htm.bind(React.createElement);

const CONTOH_TEKS = [
  "kopi 18rb",
  "gojek ke kantor 24rb",
  "makan siang nasi padang 32k",
  "parkir 5000 pakai gopay",
  "kemarin bensin 30rb",
  "indomaret 63,5rb",
  "+gaji september 8,2jt",
].join("\n");

function describeDate(dateKey, todayKey) {
  if (!dateKey || dateKey === todayKey) return "Hari ini";
  const [tahun, bulan, tanggal] = String(dateKey).split("-").map(Number);
  if (!tahun || !bulan || !tanggal) return "Hari ini";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(tahun, bulan - 1, tanggal));
}

function signedAmount(row) {
  const nominal = formatCurrency(Number(row.amount || 0), row.currency);
  return row.type === "income" ? `+${nominal}` : `−${nominal}`;
}

/* Satu baris ringkasan untuk tiap mata uang, tidak pernah dijumlahkan jadi
   satu angka. Dipisah per mata uang juga menjaga barisnya tetap pendek:
   digabung jadi satu kalimat, dua mata uang sudah terpotong di layar 375px.

   Teksnya dirakit di JavaScript, bukan di templat, karena htm memangkas spasi
   di batas teks sehingga "Keluar" dan angkanya akan menempel tanpa jeda. */
function describeTotals(totals) {
  return totals
    .map((item) => {
      const bagian = [];
      if (item.expense > 0) bagian.push(`Keluar ${formatCurrency(item.expense, item.currency)}`);
      if (item.income > 0) bagian.push(`Masuk ${formatCurrency(item.income, item.currency)}`);
      return { currency: item.currency, text: bagian.join(" · ") };
    })
    .filter((item) => item.text);
}

/* Catat banyak: tulis seperti di catatan, periksa hasil bacaannya, lalu simpan
   sekali tekan. Sheet ini hanya membuat pemasukan dan pengeluaran. Kirim,
   Tukar, dan pemakaian dana Target tetap lewat pintunya masing masing karena
   ketiganya butuh dua dompet atau kurs yang tidak muat di satu baris teks. */
export function BulkEntrySheet({
  open,
  onClose,
  onSubmit,
  onUndo,
  accounts = [],
  categories = [],
  availability = {},
  baseCurrency = DEFAULT_BASE_CURRENCY,
  loading = false,
}) {
  const baseCode = normalizeCurrencyCode(baseCurrency);
  const todayKey = getDateInputValue(new Date());
  const { closing, requestClose } = useSheetClose(onClose, open);

  const [step, setStep] = useState("write");
  const [text, setText] = useState("");
  const [parsedFrom, setParsedFrom] = useState(null);
  const [defaultAccountId, setDefaultAccountId] = useState("");
  const [defaultDateKey, setDefaultDateKey] = useState(todayKey);
  const [rows, setRows] = useState([]);
  const [openRowId, setOpenRowId] = useState(null);
  const [notice, setNotice] = useState("");
  const [doneRows, setDoneRows] = useState([]);
  const [savedTransactions, setSavedTransactions] = useState([]);

  useEffect(() => {
    if (!open) return;
    const starting = resolveBulkDefaultAccount(accounts, baseCode);
    setStep("write");
    setText("");
    setParsedFrom(null);
    setDefaultAccountId(starting?.id || "");
    setDefaultDateKey(getDateInputValue(new Date()));
    setRows([]);
    setOpenRowId(null);
    setNotice("");
    setDoneRows([]);
    setSavedTransactions([]);
  }, [open]);

  const parseContext = useMemo(
    () => ({
      accounts,
      defaultAccountId,
      defaultDateKey,
      baseCurrency: baseCode,
    }),
    [accounts, defaultAccountId, defaultDateKey, baseCode],
  );

  const liveRows = useMemo(
    () => (open ? parseBulkEntryText(text, parseContext) : []),
    [open, text, parseContext],
  );
  const liveSummary = summarizeBulkEntryRows(liveRows);
  const reviewSummary = summarizeBulkEntryRows(rows);
  const incompleteRows = rows.filter((row) => isBulkRowIncomplete(row));
  const defaultAccount =
    accounts.find((item) => item.id === defaultAccountId) ||
    resolveBulkDefaultAccount(accounts, baseCode);

  function updateRow(id, patch) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  /* Pindah ke dompet lain berarti pindah mata uang: nominalnya dibulatkan ulang
     ke pecahan mata uang baru supaya "3,50" dari dompet baht tidak tersimpan
     sebagai angka yang tidak bisa diketik ulang di dompet rupiah. */
  function selectRowAccount(row, accountId) {
    const account = accounts.find((item) => item.id === accountId);
    const currency = normalizeCurrencyCode(account?.currency || baseCode);
    const digits = Number(getCurrencyMeta(currency).fractionDigits ?? 2);
    const factor = 10 ** digits;
    updateRow(row.id, {
      accountId,
      accountName: account?.name || "",
      currency,
      amount: Math.round(Number(row.amount || 0) * factor) / factor,
    });
  }

  function goReview() {
    if (!liveSummary.readyCount) return;
    /* Teks yang tidak berubah tidak dibaca ulang, supaya perbaikan kategori
       dan nominal di langkah Periksa tidak hilang saat pengguna menengok
       teksnya sebentar lalu kembali. */
    const nextRows =
      parsedFrom === text && rows.length
        ? rows
        : liveRows.filter((row) => !row.skipped);
    const firstIncomplete = nextRows.find((row) => isBulkRowIncomplete(row));
    setRows(nextRows);
    setParsedFrom(text);
    setOpenRowId(firstIncomplete ? firstIncomplete.id : null);
    setNotice("");
    setStep("review");
  }

  function addRow() {
    const id = `bulk-baru-${Date.now()}`;
    setRows((current) => [
      ...current,
      {
        id,
        raw: "",
        type: "expense",
        description: "",
        amount: 0,
        currency: normalizeCurrencyCode(defaultAccount?.currency || baseCode),
        accountId: defaultAccount?.id || "",
        accountName: defaultAccount?.name || "",
        dateKey: defaultDateKey,
        category: null,
        skipped: false,
        skipReason: "",
      },
    ]);
    setOpenRowId(id);
  }

  async function save() {
    const rencana = planBulkEntrySave(rows, {
      now: new Date(),
      accounts,
      availability,
    });
    if (!rencana.ok) {
      setNotice(rencana.message);
      const pertama = rows.find((row) => isBulkRowIncomplete(row));
      if (pertama) setOpenRowId(pertama.id);
      return;
    }

    const hasil = await onSubmit?.(rencana.payloads);
    const savedIds = new Set(hasil?.savedRowIds || []);
    const tersimpan = rows.filter((row) => savedIds.has(row.id));

    if (!hasil?.ok) {
      /* Gagal di tengah tidak menghapus apa pun: baris yang sudah masuk
         dikeluarkan dari daftar, sisanya tetap di layar supaya bisa dicoba
         lagi tanpa mengetik ulang. */
      setRows((current) => current.filter((row) => !savedIds.has(row.id)));
      setNotice(hasil?.message || "Sebagian transaksi belum tersimpan.");
      return;
    }

    setDoneRows(tersimpan.length ? tersimpan : rows);
    setSavedTransactions(hasil.transactions || []);
    setOpenRowId(null);
    setNotice("");
    setStep("done");
  }

  async function undoAll() {
    const ok = await onUndo?.(savedTransactions);
    if (!ok) return;
    setRows(doneRows);
    setSavedTransactions([]);
    setOpenRowId(null);
    setNotice("Dibatalkan. Daftarnya masih di sini, belum ada yang tersimpan.");
    setStep("review");
  }

  if (!open) return null;

  const isWrite = step === "write";
  const isReview = step === "review";
  const isDone = step === "done";
  const doneGroups = isDone ? groupBulkEntryRows(doneRows) : [];
  const doneSummary = summarizeBulkEntryRows(doneRows);

  const chip = (label, active, onPick, key) => html`
    <button
      key=${key || label}
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

  const walletChip = (item, active, onPick) => {
    const code = normalizeCurrencyCode(item.currency);
    const label = code === baseCode ? item.name : `${item.name} · ${code}`;
    return chip(label, active, onPick, item.id);
  };

  const dateRow = (value, onChange, label) => html`
    <label className="flex min-h-11 items-center gap-[11px]">
      <${CalendarDays}
        aria-hidden="true"
        className="h-[17px] w-[17px] shrink-0"
        style=${{ color: "var(--cs-mut)" }}
        strokeWidth=${1.75}
      />
      <span className="flex-1 truncate text-[13.5px]" style=${{ color: "var(--cs-body)" }}>
        ${describeDate(value, todayKey)}
      </span>
      <span className="relative flex items-center">
        <span
          className="pointer-events-none text-xs font-bold"
          style=${{ color: "var(--cs-link)" }}
        >
          Ubah
        </span>
        ${/* Kolom tanggal asli ditumpuk transparan supaya pemilih bawaan
              sistem yang muncul, sama seperti di Catat cepat. */ null}
        <input
          type="date"
          value=${value}
          max=${todayKey}
          onChange=${(event) => onChange(event.target.value || todayKey)}
          aria-label=${label}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </span>
    </label>
  `;

  const headerTitle = isWrite ? "Catat banyak" : isReview ? "Periksa dulu" : "Selesai";
  const headerAction = isDone ? "" : isWrite ? "Batal" : "Ubah teks";

  const primaryLabel = isWrite
    ? liveSummary.readyCount
      ? `Periksa ${liveSummary.readyCount} transaksi`
      : "Tulis minimal satu baris"
    : isReview
      ? loading
        ? "Menyimpan..."
        : !rows.length
          ? "Belum ada baris"
          : incompleteRows.length
            ? `Lengkapi ${incompleteRows.length} baris dulu`
            : `Simpan ${rows.length} transaksi`
      : "Selesai";

  const primaryEnabled = isWrite
    ? liveSummary.readyCount > 0
    : isReview
      ? rows.length > 0 && !incompleteRows.length && !loading
      : true;

  const primaryAction = isWrite ? goReview : isReview ? save : requestClose;

  return html`
    <div className="fixed inset-0 z-50 lg:flex lg:items-center lg:justify-center lg:p-4">
      <button
        type="button"
        aria-label="Tutup catat banyak"
        onClick=${requestClose}
        className=${`cs-sheet-scrim ${closing ? "dc-overlay-out" : "dc-overlay-in"} absolute inset-0`}
      ></button>

      ${/* Ponsel memakai lembar penuh karena daftarnya panjang; desktop tetap
            dialog terpusat selebar 560 seperti sheet lain di aplikasi. */ null}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Catat banyak transaksi"
        className=${`cs-sheet-panel ${closing ? "dc-sheet-down" : "dc-sheet-up"} absolute inset-x-0 bottom-0 top-8 flex flex-col overflow-hidden pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 lg:relative lg:inset-auto lg:top-auto lg:h-[calc(100dvh-4rem)] lg:max-h-[760px] lg:w-full lg:max-w-[560px] lg:pb-[26px] lg:pt-6`}
      >
        <span
          className="mx-auto mb-3 block h-1 w-[42px] shrink-0 rounded-full lg:hidden"
          style=${{ background: "var(--cs-dim)" }}
        ></span>

        <div className="flex shrink-0 items-center gap-2 px-5 lg:px-[26px]">
          <div className="flex min-w-[72px] justify-start">
            ${headerAction
              ? html`
                  <button
                    type="button"
                    onClick=${isWrite ? requestClose : () => setStep("write")}
                    className="flex min-h-11 items-center pr-3 text-[13px]"
                    style=${{ color: "var(--cs-mut)" }}
                  >
                    ${headerAction}
                  </button>
                `
              : null}
          </div>
          <span className="flex-1 text-center text-[17px] font-bold tracking-[-0.2px]">
            ${headerTitle}
          </span>
          <div className="min-w-[72px]"></div>
        </div>

        ${/* Isinya dibungkus satu kolom di dalam wadah gulir. Kalau wadah
              gulirnya sendiri yang menjadi flex column, anak anaknya ikut
              menyusut mengikuti tinggi wadah, sehingga baris yang dibuka
              terpotong oleh kartu alih alih menggulir. */ null}
        <div
          data-sheet-scroll="true"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-2 pt-3 lg:px-[26px]"
        >
        <div className="flex flex-col gap-4">
          ${isWrite
            ? html`
                <div
                  className="flex flex-col gap-2 rounded-[18px] border p-4"
                  style=${{ background: "var(--cs-soft)", borderColor: "var(--cs-line)" }}
                >
                  <span className="text-xs" style=${{ color: "var(--cs-mut)" }}>
                    Berlaku untuk semua baris, kecuali kamu tulis lain
                  </span>
                  ${dateRow(defaultDateKey, setDefaultDateKey, "Tanggal semua baris")}
                  ${accounts.length
                    ? html`
                        <div className="dc-scroll-x flex gap-2 overflow-x-auto pb-0.5">
                          ${accounts.map((item) =>
                            walletChip(item, item.id === defaultAccount?.id, () =>
                              setDefaultAccountId(item.id),
                            ),
                          )}
                        </div>
                      `
                    : null}
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-baseline justify-between gap-3 px-0.5">
                    <span className="text-xs" style=${{ color: "var(--cs-mut)" }}>
                      Satu transaksi per baris
                    </span>
                    ${text
                      ? html`
                          <button
                            type="button"
                            onClick=${() => setText("")}
                            className="text-xs font-bold"
                            style=${{ color: "var(--cs-link)" }}
                          >
                            Kosongkan
                          </button>
                        `
                      : html`
                          <button
                            type="button"
                            onClick=${() => setText(CONTOH_TEKS)}
                            className="text-xs font-bold"
                            style=${{ color: "var(--cs-link)" }}
                          >
                            Isi contoh
                          </button>
                        `}
                  </div>
                  <textarea
                    value=${text}
                    onChange=${(event) => setText(event.target.value)}
                    rows=${8}
                    spellCheck=${false}
                    placeholder=${"kopi 18rb\ngojek 24rb\n+gaji 8,2jt"}
                    aria-label="Daftar transaksi"
                    className="min-h-[168px] resize-none rounded-[16px] border p-[14px] text-[13.5px] leading-[1.7]"
                    style=${{
                      background: "var(--cs-card)",
                      borderColor: "var(--cs-line)",
                      color: "var(--cs-ink)",
                    }}
                  ></textarea>
                  <p
                    className="px-0.5 text-[11.5px] leading-[1.5]"
                    style=${{ color: "var(--cs-faint)" }}
                  >
                    ${'Tulis + di depan untuk pemasukan. Sebut nama dompet atau "kemarin" di baris mana pun untuk mengganti default.'}
                  </p>
                </div>

                ${liveRows.length
                  ? html`
                      <div className="flex flex-col gap-2">
                        <span className="px-0.5 text-xs" style=${{ color: "var(--cs-mut)" }}>
                          ${[
                            `${liveSummary.readyCount} transaksi terbaca`,
                            liveSummary.incompleteCount
                              ? `${liveSummary.incompleteCount} perlu kategori`
                              : "",
                            liveSummary.skippedCount
                              ? `${liveSummary.skippedCount} dilewati`
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                        <div className="dc-card overflow-hidden">
                          ${liveRows.map(
                            (row) => html`
                              <${PreviewRow}
                                key=${row.id}
                                row=${row}
                                todayKey=${todayKey}
                                baseCode=${baseCode}
                              />
                            `,
                          )}
                        </div>
                      </div>
                    `
                  : null}
              `
            : null}

          ${isReview
            ? html`
                <div className="flex items-start justify-between gap-3 px-0.5">
                  <span className="shrink-0 text-xs" style=${{ color: "var(--cs-mut)" }}>
                    ${`${rows.length} baris`}
                  </span>
                  <span className="flex min-w-0 flex-col items-end gap-0.5">
                    ${describeTotals(reviewSummary.totals).map(
                      (item) => html`
                        <span
                          key=${item.currency}
                          className="dc-num max-w-full truncate text-right text-[12px]"
                          style=${{ color: "var(--cs-body)" }}
                        >
                          ${item.text}
                        </span>
                      `,
                    )}
                  </span>
                </div>

                ${notice
                  ? html`
                      <p
                        className="rounded-[14px] px-[14px] py-3 text-[12.5px] leading-[1.5]"
                        style=${{ background: "var(--cs-soft)", color: "var(--cs-body)" }}
                      >
                        ${notice}
                      </p>
                    `
                  : incompleteRows.length
                    ? html`
                        <button
                          type="button"
                          onClick=${() => setOpenRowId(incompleteRows[0].id)}
                          className="dc-press dc-press-96 flex min-h-[46px] items-center gap-2.5 rounded-[14px] px-[14px] text-left"
                          style=${{ background: "var(--cs-soft)" }}
                        >
                          <${CircleAlert}
                            aria-hidden="true"
                            className="h-[17px] w-[17px] shrink-0"
                            style=${{ color: "var(--cs-warn)" }}
                            strokeWidth=${1.75}
                          />
                          <span className="text-[12.5px]" style=${{ color: "var(--cs-body)" }}>
                            ${`${incompleteRows.length} baris belum lengkap. Ketuk untuk melengkapi.`}
                          </span>
                        </button>
                      `
                    : null}

                <div className="dc-card overflow-hidden">
                  ${rows.map(
                    (row) => html`
                      <${ReviewRow}
                        key=${row.id}
                        row=${row}
                        open=${openRowId === row.id}
                        todayKey=${todayKey}
                        baseCode=${baseCode}
                        categories=${categories}
                        accounts=${accounts}
                        chip=${chip}
                        walletChip=${walletChip}
                        dateRow=${dateRow}
                        onToggle=${() =>
                          setOpenRowId((current) => (current === row.id ? null : row.id))}
                        onChange=${(patch) => updateRow(row.id, patch)}
                        onSelectAccount=${(accountId) => selectRowAccount(row, accountId)}
                        onRemove=${() => {
                          setRows((current) => current.filter((item) => item.id !== row.id));
                          setOpenRowId(null);
                        }}
                      />
                    `,
                  )}
                </div>

                <button
                  type="button"
                  onClick=${addRow}
                  className="dc-press dc-press-96 flex min-h-12 items-center justify-center gap-2 rounded-[16px] border text-[13px] font-bold"
                  style=${{ borderColor: "var(--cs-line)", color: "var(--cs-body)" }}
                >
                  <${Plus}
                    aria-hidden="true"
                    className="h-4 w-4"
                    strokeWidth=${1.9}
                  />
                  Tambah baris
                </button>
              `
            : null}

          ${isDone
            ? html`
                <div className="flex flex-col items-center gap-1 pb-1 pt-2">
                  <span className="text-[26px] font-bold tracking-[-0.8px]">
                    ${`${doneRows.length} transaksi tercatat`}
                  </span>
                  ${describeTotals(doneSummary.totals).map(
                    (item) => html`
                      <span
                        key=${item.currency}
                        className="dc-num text-[12.5px]"
                        style=${{ color: "var(--cs-mut)" }}
                      >
                        ${item.text}
                      </span>
                    `,
                  )}
                </div>

                <div className="dc-card overflow-hidden">
                  ${doneGroups.map(
                    (group) => html`
                      <div
                        key=${group.key}
                        className="dc-row flex min-h-[60px] items-center gap-4 px-4 py-3"
                      >
                        ${/* Kategori yang sama bisa muncul dua kali kalau
                              transaksinya beda mata uang, jadi kodenya
                              ditempel supaya dua barisnya tidak terbaca
                              kembar. */ null}
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="truncate text-sm font-medium">
                            ${group.currency === baseCode
                              ? group.label
                              : `${group.label} · ${group.currency}`}
                          </span>
                          <span className="text-xs" style=${{ color: "var(--cs-mut)" }}>
                            ${`${group.count} transaksi`}
                          </span>
                        </span>
                        <span
                          className="dc-num shrink-0 text-[13.5px]"
                          style=${{
                            color: group.type === "income" ? "var(--cs-pos)" : "var(--cs-ink)",
                          }}
                        >
                          ${group.type === "income"
                            ? `+${formatCurrency(group.total, group.currency)}`
                            : `−${formatCurrency(group.total, group.currency)}`}
                        </span>
                      </div>
                    `,
                  )}
                </div>
              `
            : null}
        </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 px-5 pt-3 lg:px-[26px]">
          <button
            type="button"
            onClick=${primaryAction}
            disabled=${!primaryEnabled}
            className="flex min-h-[52px] items-center justify-center rounded-[17px] text-[15px] font-bold"
            style=${primaryEnabled
              ? { background: "var(--cs-acc)", color: "var(--cs-on-acc)" }
              : { background: "var(--cs-track)", color: "var(--cs-faint)" }}
          >
            ${primaryLabel}
          </button>
          ${isDone && savedTransactions.length
            ? html`
                <button
                  type="button"
                  onClick=${undoAll}
                  disabled=${loading}
                  className="flex min-h-12 items-center justify-center rounded-[16px] text-[13px] font-bold disabled:opacity-40"
                  style=${{ color: "var(--cs-danger)" }}
                >
                  Batalkan semua
                </button>
              `
            : null}
        </div>
      </div>
    </div>
  `;
}

/* Pratinjau di langkah Tulis hanya memperlihatkan hasil bacaan, tidak bisa
   diubah. Barisnya sengaja lebih pendek daripada baris Periksa supaya daftar
   panjang tetap terbaca sekali layar. */
function PreviewRow({ row, todayKey, baseCode }) {
  const incomplete = isBulkRowIncomplete(row);
  const code = normalizeCurrencyCode(row.currency);
  const konteks = row.skipped
    ? row.skipReason
    : [
        row.type === "income" ? "Masuk" : row.category || "Belum ada kategori",
        row.accountName,
        row.dateKey === todayKey ? "" : describeDate(row.dateKey, todayKey),
        code === baseCode ? "" : code,
      ]
        .filter(Boolean)
        .join(" · ");

  return html`
    <div className="dc-row flex min-h-[56px] items-center gap-3 px-4 py-2.5">
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className="truncate text-[13.5px] font-medium"
          style=${{ color: row.skipped ? "var(--cs-faint)" : "var(--cs-ink)" }}
        >
          ${getBulkRowTitle(row)}
        </span>
        <span
          className="truncate text-[11.5px]"
          style=${{ color: incomplete ? "var(--cs-warn)" : "var(--cs-mut)" }}
        >
          ${konteks}
        </span>
      </span>
      <span
        className="dc-num shrink-0 text-[12.5px]"
        style=${{
          color: row.skipped
            ? "var(--cs-faint)"
            : row.type === "income"
              ? "var(--cs-pos)"
              : "var(--cs-ink)",
        }}
      >
        ${row.skipped ? "—" : signedAmount(row)}
      </span>
    </div>
  `;
}

/* Baris Periksa memakai metrik baris aktivitas di Beranda: tinggi 72, ikon
   40, judul 14px/500, keterangan 12px, nominal 13.5px DM Mono. Penyuntingnya
   terbuka di tempat, bukan di sheet kedua, supaya tidak ada tumpukan lembar
   di atas lembar. */
function ReviewRow({
  row,
  open,
  todayKey,
  baseCode,
  categories,
  accounts,
  chip,
  walletChip,
  dateRow,
  onToggle,
  onChange,
  onSelectAccount,
  onRemove,
}) {
  const rowRef = React.useRef(null);
  const incomplete = isBulkRowIncomplete(row);
  const isExpense = row.type === "expense";
  const code = normalizeCurrencyCode(row.currency);
  const Icon = incomplete ? CircleAlert : isExpense ? ArrowUpRight : ArrowDownLeft;

  /* Baris yang terbuka sendiri karena belum lengkap, atau yang dibuka dari
     bilah peringatan, digulir ke atas daftar. Memakai "nearest" tidak cukup:
     baris yang terbuka lebih tinggi daripada areanya, dan selama tepi atasnya
     masih terlihat peramban menganggap tidak ada yang perlu digulir, sehingga
     penyuntingnya tetap tersembunyi di bawah lipatan. */
  useEffect(() => {
    if (!open) return undefined;
    /* Digulir setelah satu bingkai. Dipanggil langsung di dalam efek, daftar
       belum dihitung ulang tingginya sehingga peramban menyimpulkan tidak ada
       yang perlu digulir dan penyuntingnya tetap di bawah lipatan. */
    const timer = setTimeout(() => {
      /* Seketika, bukan halus. Gulir halus digerakkan oleh bingkai animasi,
         dan di tab yang tidak sedang digambar bingkainya tidak pernah jalan,
         sehingga barisnya bisa diam di tempat. */
      rowRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
    }, 0);
    return () => clearTimeout(timer);
  }, [open]);
  const konteks = [
    isExpense ? row.category || "Pilih kategori" : "Masuk",
    row.accountName,
    row.dateKey === todayKey ? "" : describeDate(row.dateKey, todayKey),
    code === baseCode ? "" : code,
  ]
    .filter(Boolean)
    .join(" · ");
  const amountOptions = getNumericInputOptions(code);

  const segment = (active) =>
    active
      ? { background: "var(--cs-sel-bg)", color: "var(--cs-sel-fg)" }
      : { background: "transparent", color: "var(--cs-body)" };

  return html`
    <div
      ref=${rowRef}
      className="dc-row flex flex-col"
      style=${open ? { background: "var(--cs-soft)" } : null}
      data-bulk-row=${row.id}
    >
      <button
        type="button"
        onClick=${onToggle}
        aria-expanded=${open}
        className="dc-press dc-press-96 flex min-h-[72px] items-center gap-4 p-4 text-left"
      >
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style=${{ background: incomplete ? "var(--cs-track)" : "var(--cs-chip)" }}
        >
          <${Icon}
            aria-hidden="true"
            className="h-[18px] w-[18px]"
            style=${{ color: incomplete ? "var(--cs-warn)" : "var(--cs-body)" }}
            strokeWidth=${1.75}
          />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-sm font-medium">${getBulkRowTitle(row)}</span>
          <span
            className="truncate text-xs"
            style=${{ color: incomplete ? "var(--cs-warn)" : "var(--cs-mut)" }}
          >
            ${Number(row.amount) > 0 ? konteks : "Isi nominalnya"}
          </span>
        </span>
        <span
          className="dc-num shrink-0 text-[13.5px]"
          style=${{ color: row.type === "income" ? "var(--cs-pos)" : "var(--cs-ink)" }}
        >
          ${signedAmount(row)}
        </span>
      </button>

      ${open
        ? html`
            <div className="flex flex-col gap-3 px-4 pb-4">
              <div className="flex gap-2">
                <input
                  value=${row.description}
                  onChange=${(event) => onChange({ description: event.target.value })}
                  placeholder="Nama transaksi"
                  aria-label="Nama transaksi"
                  className="min-h-11 min-w-0 flex-1 rounded-[13px] border px-[13px] text-[13.5px]"
                  style=${{
                    background: "var(--cs-card)",
                    borderColor: "var(--cs-line)",
                    color: "var(--cs-ink)",
                  }}
                />
                <input
                  value=${row.amount ? formatNumericInput(String(row.amount), amountOptions) : ""}
                  onChange=${(event) =>
                    onChange({
                      amount: Number(
                        normalizeNumericInput(event.target.value, amountOptions) || 0,
                      ),
                    })}
                  inputMode="decimal"
                  placeholder="0"
                  aria-label="Nominal"
                  className="dc-num min-h-11 w-[124px] shrink-0 rounded-[13px] border px-[13px] text-right text-[13.5px]"
                  style=${{
                    background: "var(--cs-card)",
                    borderColor: "var(--cs-line)",
                    color: "var(--cs-ink)",
                  }}
                />
              </div>

              <div
                className="flex gap-1 rounded-[14px] p-1"
                style=${{ background: "var(--cs-seg)" }}
              >
                <button
                  type="button"
                  onClick=${() => onChange({ type: "expense" })}
                  aria-pressed=${isExpense}
                  className="min-h-10 flex-1 rounded-[11px] text-[13px] font-bold"
                  style=${segment(isExpense)}
                >
                  Keluar
                </button>
                <button
                  type="button"
                  onClick=${() => onChange({ type: "income", category: null })}
                  aria-pressed=${!isExpense}
                  className="min-h-10 flex-1 rounded-[11px] text-[13px] font-bold"
                  style=${segment(!isExpense)}
                >
                  Masuk
                </button>
              </div>

              ${isExpense && categories.length
                ? html`
                    <div className="flex flex-col gap-1.5">
                      <span className="px-0.5 text-xs" style=${{ color: "var(--cs-mut)" }}>
                        Masuk kategori apa?
                      </span>
                      <div className="dc-scroll-x flex gap-2 overflow-x-auto pb-0.5">
                        ${categories.map((item) =>
                          chip(item.label, item.value === row.category, () =>
                            onChange({ category: item.value }),
                          ),
                        )}
                      </div>
                    </div>
                  `
                : null}

              ${accounts.length
                ? html`
                    <div className="flex flex-col gap-1.5">
                      <span className="px-0.5 text-xs" style=${{ color: "var(--cs-mut)" }}>
                        ${isExpense ? "Dari dompet mana?" : "Masuk ke dompet mana?"}
                      </span>
                      <div className="dc-scroll-x flex gap-2 overflow-x-auto pb-0.5">
                        ${accounts.map((item) =>
                          walletChip(item, item.id === row.accountId, () =>
                            onSelectAccount(item.id),
                          ),
                        )}
                      </div>
                    </div>
                  `
                : null}

              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  ${dateRow(
                    row.dateKey,
                    (value) => onChange({ dateKey: value }),
                    "Tanggal transaksi",
                  )}
                </div>
                <button
                  type="button"
                  onClick=${onRemove}
                  className="flex min-h-11 shrink-0 items-center pl-3 text-[12.5px] font-bold"
                  style=${{ color: "var(--cs-danger)" }}
                >
                  Hapus baris
                </button>
              </div>
            </div>
          `
        : null}
    </div>
  `;
}
