import React, { useEffect, useState } from "react";
import htm from "htm";
import {
  DEFAULT_BASE_CURRENCY,
  DEFAULT_SELECTED_CURRENCIES,
  HIDDEN_BALANCE_TEXT,
  formatCurrency,
  formatCurrencyCompact,
  formatMoney,
  normalizeCurrencyCode,
  normalizeCurrencyList,
} from "../../lib/currency.js";
import { AmountFormatter } from "../shared/AmountFormatter.js";
import { AvatarBadge } from "../shared/AvatarBadge.js";

const html = htm.bind(React.createElement);

function EyeToggleIcon({ visible }) {
  if (visible) {
    return html`
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </svg>
    `;
  }

  return html`
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M9.88 9.88A3 3 0 0 0 14.12 14.12"></path>
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c6.5 0 10 7 10 7a17.56 17.56 0 0 1-2.07 3.02"></path>
      <path d="M6.61 6.61C3.7 8.63 2 12 2 12s3.5 7 10 7a9.76 9.76 0 0 0 5.39-1.61"></path>
      <path d="M2 2l20 20"></path>
    </svg>
  `;
}

function BalancePrivacyPill({ balanceIdr, balanceThb, visible, onToggle }) {
  const idrText = visible ? formatCurrency(balanceIdr, "idr") : HIDDEN_BALANCE_TEXT;
  const thbText = visible ? formatCurrency(balanceThb, "thb") : HIDDEN_BALANCE_TEXT;

  return html`
    <div className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-2xl border border-brand-300/30 bg-brand-600 px-3 py-1.5 text-[11px] font-semibold uppercase text-white shadow-[0_12px_30px_rgba(16,185,129,0.22)] sm:flex-none sm:rounded-full sm:text-xs">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-white/75">IDR</span>
        <span className="min-w-[4.75rem] break-all tabular-nums">${idrText}</span>
        <span className="hidden text-white/45 min-[360px]:inline">|</span>
        <span className="text-white/75">THB</span>
        <span className="min-w-[4.25rem] break-all tabular-nums">${thbText}</span>
      </div>
      <button
        type="button"
        onClick=${onToggle}
        aria-label=${visible ? "Sembunyikan saldo" : "Tampilkan saldo"}
        title=${visible ? "Sembunyikan saldo" : "Tampilkan saldo"}
        className="inline-flex min-h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/18 bg-white/12 text-white transition hover:-translate-y-0.5 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/45"
      >
        <${EyeToggleIcon} visible=${visible} />
      </button>
    </div>
  `;
}

function CompactBalancePrivacyPill({
  balances = {},
  activeCurrencies = DEFAULT_SELECTED_CURRENCIES,
  visible,
  onToggle,
}) {
  const [expanded, setExpanded] = useState(false);
  const hiddenText = "\u2022\u2022\u2022\u2022\u2022\u2022";
  const balanceItems = normalizeCurrencyList(activeCurrencies).map((currency) => ({
    label: currency,
    value: visible ? formatCurrency(balances[currency] || 0, currency) : hiddenText,
    compactValue: visible
      ? formatCurrencyCompact(balances[currency] || 0, currency)
      : hiddenText,
  }));
  const visibleItems = balanceItems.slice(0, 2);
  const hiddenItems = balanceItems.slice(2);

  useEffect(() => {
    if (!hiddenItems.length && expanded) setExpanded(false);
  }, [hiddenItems.length, expanded]);

  return html`
    <div className="relative flex min-w-0 flex-1 items-center gap-1 rounded-[22px] border border-brand-300/30 bg-gradient-to-br from-brand-600 via-emerald-600 to-teal-700 p-1.5 text-white shadow-[0_16px_38px_rgba(16,185,129,0.24)] ring-1 ring-white/10 sm:flex-none sm:min-w-[19rem] sm:rounded-full">
      <div className=${`grid min-w-0 flex-1 gap-1 ${visibleItems.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
        ${visibleItems.map(
          (item) => html`
            <div
              key=${item.label}
              className="min-w-0 rounded-2xl bg-white/[0.08] px-2.5 py-2 ring-1 ring-white/[0.08] sm:rounded-full sm:px-3"
            >
              <p className="text-[10px] font-black uppercase leading-none tracking-[0.12em] text-white/72">
                ${item.label}
              </p>
              <p className="mt-1 truncate text-[11px] font-black leading-none tabular-nums text-white min-[390px]:text-xs">
                ${item.compactValue}
              </p>
            </div>
          `,
        )}
      </div>
      ${hiddenItems.length
        ? html`
            <button
              type="button"
              onClick=${() => setExpanded((current) => !current)}
              aria-expanded=${expanded}
              aria-label="Lihat semua saldo"
              className="inline-flex h-11 min-h-11 w-10 shrink-0 items-center justify-center rounded-full border border-white/18 bg-white/10 text-xs font-black text-white transition hover:-translate-y-0.5 hover:bg-white/18 focus:outline-none focus:ring-2 focus:ring-white/45"
            >
              +${hiddenItems.length}
            </button>
          `
        : null}
      <button
        type="button"
        onClick=${onToggle}
        aria-label=${visible ? "Sembunyikan saldo" : "Tampilkan saldo"}
        title=${visible ? "Sembunyikan saldo" : "Tampilkan saldo"}
        className="inline-flex h-11 min-h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/22 bg-white/14 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] transition hover:-translate-y-0.5 hover:bg-white/22 focus:outline-none focus:ring-2 focus:ring-white/45"
      >
        <${EyeToggleIcon} visible=${visible} />
      </button>
      ${expanded
        ? html`
            <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(19rem,calc(100vw-6rem))] rounded-[22px] border border-slate-200/70 bg-white/92 p-2.5 text-slate-900 shadow-[0_22px_70px_rgba(15,23,42,0.18)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/92 dark:text-white dark:shadow-black/40">
              <div className="grid gap-1.5">
                ${balanceItems.map(
                  (item) => html`
                    <div
                      key=${`detail-${item.label}`}
                      className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white/64 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900/70"
                    >
                      <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                        ${item.label}
                      </span>
                      <span className="truncate text-right font-black tabular-nums text-slate-950 dark:text-white">
                        ${item.value}
                      </span>
                    </div>
                  `,
                )}
              </div>
            </div>
          `
        : null}
    </div>
  `;
}

function PrivacyToggle({ visible, onToggle }) {
  const label = visible ? "Sembunyikan saldo" : "Tampilkan saldo";

  return html`
    <button
      type="button"
      onClick=${onToggle}
      aria-label=${label}
      aria-pressed=${!visible}
      title=${label}
      className="inline-flex h-11 min-h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-300/70 bg-white/70 text-slate-800 shadow-[0_10px_26px_rgba(15,23,42,0.08)] backdrop-blur-xl transition duration-200 hover:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/70 dark:border-white/10 dark:bg-white/5 dark:text-white dark:shadow-black/20 dark:hover:bg-white/10 lg:h-9 lg:min-h-9 lg:w-9"
    >
      <${EyeToggleIcon} visible=${visible} />
    </button>
  `;
}

function AvatarButton({ src, initials, onClick }) {
  return html`
    <button
      type="button"
      onClick=${onClick}
      aria-label="Buka profil dan menu akun"
      className="inline-flex h-11 min-h-11 w-11 shrink-0 items-center justify-center rounded-full border border-emerald-500/25 bg-white/74 text-sm font-semibold text-slate-950 shadow-[0_12px_30px_rgba(15,23,42,0.09)] backdrop-blur-xl transition duration-200 hover:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/70 dark:border-emerald-300/20 dark:bg-white/5 dark:text-white dark:shadow-black/24 dark:hover:bg-white/10 lg:h-9 lg:min-h-9 lg:w-9"
    >
      <${AvatarBadge} src=${src} initials=${initials} size="sm" />
    </button>
  `;
}

function CurrencyChip({ currency, selected, daily, base, onSelect }) {
  const labelParts = [`Fokuskan saldo ${currency}`];
  if (daily) labelParts.push("bawaan transaksi");
  if (base) labelParts.push("mata uang laporan");

  return html`
    <button
      type="button"
      onClick=${() => onSelect(currency)}
      aria-label=${labelParts.join(", ")}
      aria-current=${selected ? "true" : undefined}
      className=${`inline-flex h-11 min-h-11 shrink-0 items-center justify-center gap-2 rounded-2xl border px-3 text-sm font-bold transition duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/70 lg:h-9 lg:min-h-9 lg:text-xs ${
        selected
          ? "border-emerald-400/70 bg-emerald-500 text-white shadow-[0_12px_28px_rgba(16,185,129,0.24)] ring-2 ring-emerald-200/70 dark:ring-emerald-300/20"
          : "border-slate-300/70 bg-white/66 text-slate-800 hover:border-emerald-500/35 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10"
      }`}
    >
      <span
        aria-hidden="true"
        className=${`${selected ? "h-2.5 w-2.5 ring-2 ring-white/35" : "h-2 w-2"} ${
          selected
            ? "rounded-full bg-white"
            : daily
              ? "rounded-sm bg-cyan-400"
              : base
                ? "rounded-full bg-emerald-400"
                : "rounded-full bg-slate-400 dark:bg-slate-500"
        }`}
      ></span>
      <span>${currency}</span>
    </button>
  `;
}

function getRailCurrencies(currencies, selectedCurrency) {
  if (currencies.length <= 3) return currencies;
  const firstCurrencies = currencies.slice(0, 3);
  if (firstCurrencies.includes(selectedCurrency)) return firstCurrencies;

  const visible = [currencies[0], currencies[1], selectedCurrency].filter(Boolean);
  return [...new Set(visible)].slice(0, 3);
}

function CurrencySelectorRail({
  currencies,
  selectedCurrency,
  dailyCurrency,
  baseCurrency,
  onSelectCurrency,
  onOpenAll,
}) {
  if (currencies.length <= 1) return null;

  const railCurrencies = getRailCurrencies(currencies, selectedCurrency);
  const hiddenCount = currencies.filter((currency) => !railCurrencies.includes(currency)).length;

  return html`
    <div
      className="wallet-selector-rail mt-3 flex flex-wrap items-center gap-2 lg:absolute lg:bottom-4 lg:right-5 lg:mt-0"
      role="list"
      aria-label="Pilih mata uang fokus wallet"
    >
      ${railCurrencies.map(
        (currency) => html`
          <span key=${currency} role="listitem">
            <${CurrencyChip}
              currency=${currency}
              selected=${currency === selectedCurrency}
              daily=${currency === dailyCurrency}
              base=${currency === baseCurrency}
              onSelect=${onSelectCurrency}
            />
          </span>
        `,
      )}
      ${hiddenCount > 0
        ? html`
            <button
              type="button"
              onClick=${onOpenAll}
              aria-label=${`Lihat ${hiddenCount} mata uang lainnya`}
              className="inline-flex h-11 min-h-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/35 bg-cyan-500/10 px-3 text-sm font-bold text-cyan-700 transition duration-200 hover:bg-cyan-500/16 focus:outline-none focus:ring-2 focus:ring-cyan-500/60 dark:border-cyan-300/24 dark:bg-cyan-300/10 dark:text-cyan-200 dark:hover:bg-cyan-300/16"
            >
              +${hiddenCount}
            </button>
          `
        : null}
    </div>
  `;
}

function PrimaryBalanceHero({
  focusCurrency,
  focusBalance,
  totalValueBase,
  baseCurrency,
  dailyCurrency,
  visible,
}) {
  const focusState = focusCurrency === dailyCurrency ? "Harian" : "Fokus";
  const amountLabel = visible
    ? formatMoney(focusBalance, focusCurrency)
    : "saldo disembunyikan";
  const totalLabel = visible
    ? formatMoney(totalValueBase, baseCurrency)
    : "total aset disembunyikan";

  return html`
    <section
      className="mt-4 lg:mt-2 lg:pr-64"
      aria-label=${`${focusCurrency} ${focusState}. ${amountLabel}. Total aset ${totalLabel}.`}
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="inline-flex min-h-8 items-center rounded-full bg-emerald-500 px-2.5 text-xs font-bold text-white shadow-[0_10px_24px_rgba(16,185,129,0.22)] lg:min-h-6 lg:px-2 lg:text-[11px]">
            ${focusCurrency}
          </span>
          <span className="inline-flex min-h-8 items-center rounded-full border border-slate-300/70 bg-white/58 px-2.5 text-xs font-bold text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 lg:min-h-6 lg:px-2 lg:text-[11px]">
            ${focusState}
          </span>
        </div>
        <span className="shrink-0 rounded-full border border-slate-300/70 bg-white/58 px-2.5 py-1.5 text-xs font-bold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 lg:px-2 lg:py-0.5 lg:text-[11px]">
          Utama ${baseCurrency}
        </span>
      </div>

      <p className="mt-3 min-h-[2.35rem] max-w-full text-[2rem] font-black leading-none text-slate-950 min-[390px]:text-[2.125rem] md:text-[2.35rem] lg:mt-1 lg:min-h-[2rem] lg:text-[2rem] dark:text-white">
        <${AmountFormatter}
          amount=${focusBalance}
          currency=${focusCurrency}
          visible=${visible}
          className="min-w-[9ch]"
        />
      </p>

      <p className="mt-2 flex min-h-6 min-w-0 flex-wrap items-center gap-1 text-sm font-semibold text-slate-600 dark:text-slate-300 lg:mt-0.5 lg:min-h-5 lg:text-xs">
        <${AmountFormatter}
          amount=${totalValueBase}
          currency=${baseCurrency}
          visible=${visible}
          className="min-w-[8ch]"
        />
        <span>total aset</span>
      </p>
    </section>
  `;
}

function WalletBottomSheet({
  open,
  onClose,
  currencies,
  selectedCurrency,
  dailyCurrency,
  baseCurrency,
  balances,
  valuationsByCurrency,
  visible,
  onSelectCurrency,
}) {
  useEffect(() => {
    if (!open) return undefined;
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return html`
    <div
      className="fixed inset-0 flex items-end justify-center px-3 pb-3 pt-20 md:items-center md:p-6"
      style=${{ zIndex: 1000 }}
    >
      <button
        type="button"
        aria-label="Tutup daftar mata uang"
        onClick=${onClose}
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
      ></button>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-currency-sheet-title"
        className="wallet-bottom-sheet relative z-10 w-full max-w-md overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/94 p-4 text-slate-950 shadow-[0_-24px_80px_rgba(15,23,42,0.24)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/94 dark:text-white dark:shadow-black/50"
      >
        <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-slate-300 dark:bg-slate-700"></div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="wallet-currency-sheet-title" className="text-base font-black">
              Semua mata uang
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Pilihanmu menjadi bawaan untuk transaksi berikutnya.
            </p>
          </div>
          <button
            type="button"
            onClick=${onClose}
            aria-label="Tutup pilihan mata uang"
            className="inline-flex h-11 min-h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-300/70 bg-white/70 text-sm font-black text-slate-700 transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/70 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
          >
            X
          </button>
        </div>

        <div className="mt-4 grid max-h-[58svh] gap-2 overflow-y-auto pr-1">
          ${currencies.map((currency) => {
            const selected = currency === selectedCurrency;
            const daily = currency === dailyCurrency;
            const base = currency === baseCurrency;
            return html`
              <button
                key=${currency}
                type="button"
                onClick=${() => {
                  onSelectCurrency(currency);
                  onClose();
                }}
                aria-label=${`Fokuskan saldo ${currency}${daily ? ", bawaan transaksi" : ""}${base ? ", mata uang laporan" : ""}`}
                aria-current=${selected ? "true" : undefined}
                className=${`flex min-h-14 items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-left transition duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/70 ${
                  selected
                    ? "border-emerald-400/70 bg-emerald-500/12 shadow-[0_14px_30px_rgba(16,185,129,0.14)] dark:bg-emerald-400/12"
                    : "border-slate-200/80 bg-white/62 hover:border-emerald-400/36 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                }`}
              >
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-black">${currency}</span>
                    ${selected
                      ? html`<span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">Fokus</span>`
                      : null}
                    ${daily
                      ? html`<span className="rounded-full bg-cyan-500/14 px-2 py-0.5 text-[10px] font-bold text-cyan-700 dark:text-cyan-200">Harian</span>`
                      : null}
                    ${base
                      ? html`<span className="rounded-full bg-slate-900/6 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-white/10 dark:text-slate-300">Utama</span>`
                      : null}
                  </span>
                  <span className="mt-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <${AmountFormatter}
                      amount=${valuationsByCurrency[currency] || 0}
                      currency=${baseCurrency}
                      visible=${visible}
                      compact=${true}
                    />
                  </span>
                </span>
                <span className="max-w-[42%] text-right text-sm font-black text-slate-950 dark:text-white">
                  <${AmountFormatter}
                    amount=${balances[currency] || 0}
                    currency=${currency}
                    visible=${visible}
                    compact=${true}
                  />
                </span>
              </button>
            `;
          })}
        </div>
      </section>
    </div>
  `;
}

function HistoryBalanceSummary({
  currencies,
  selectedCurrency,
  dailyCurrency,
  baseCurrency,
  focusBalance,
  totalValueBase,
  visible,
  onSelectCurrency,
  onOpenAll,
}) {
  const railCurrencies = getRailCurrencies(currencies, selectedCurrency);

  return html`
    <div className="mt-3 border-t border-slate-200/60 pt-2.5 dark:border-white/10">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-display text-[22px] font-black leading-none text-slate-950 dark:text-white">
            <${AmountFormatter}
              amount=${focusBalance}
              currency=${selectedCurrency}
              visible=${visible}
            />
          </p>
          <p className="mt-1 truncate text-[10px] font-semibold text-slate-500 dark:text-slate-400">
            <${AmountFormatter}
              amount=${totalValueBase}
              currency=${baseCurrency}
              visible=${visible}
              compact=${true}
            />
            total aset
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 text-[9px] font-bold text-slate-500 dark:text-slate-300">
          <span className="rounded-lg border border-slate-300/60 bg-white/55 px-2 py-1 dark:border-white/10 dark:bg-white/5">
            Harian ${dailyCurrency}
          </span>
          <span className="rounded-lg border border-slate-300/60 bg-white/55 px-2 py-1 dark:border-white/10 dark:bg-white/5">
            Utama ${baseCurrency}
          </span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        ${railCurrencies.map((currency) => {
          const selected = currency === selectedCurrency;
          return html`
            <button
              key=${currency}
              type="button"
              onClick=${() => onSelectCurrency(currency)}
              aria-current=${selected ? "true" : undefined}
              className=${`min-h-11 rounded-lg border px-2 text-[11px] font-black transition ${
                selected
                  ? "border-emerald-400/70 bg-emerald-500 text-white shadow-[0_8px_22px_rgba(16,185,129,0.18)]"
                  : "border-slate-300/60 bg-white/55 text-slate-700 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
              }`}
            >
              ${currency}
            </button>
          `;
        })}
        ${currencies.length > 3
          ? html`
              <button
                type="button"
                onClick=${onOpenAll}
                className="min-h-11 rounded-lg border border-slate-300/60 bg-white/55 px-2 text-[11px] font-black text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
              >
                Lainnya
              </button>
            `
          : null}
      </div>
    </div>
  `;
}

/* Judul per layar mengikuti TITLES di project desain. */
const PAGE_TITLES = {
  overview: "Uangmu hari ini",
  investment: "Dompet & tabungan",
  budget: "Jatah bulan ini",
  history: "Riwayat",
  control: "Kondisi keuanganmu",
  settings: "Pengaturan",
  movement: "Pindah & tukar uang",
  report: "Laporan",
};

function getGreeting(activeTab, userName) {
  if (activeTab === "control") return "‹ Kembali ke Jatah";
  if (activeTab === "settings") return "‹ Kembali";
  const hour = new Date().getHours();
  const part =
    hour < 11 ? "Pagi" : hour < 15 ? "Siang" : hour < 19 ? "Sore" : "Malam";
  return userName ? `${part}, ${userName}` : part;
}

/* Header desain: satu baris berisi sapaan, judul halaman, dan avatar.
   Wordmark dan tombol mata dihapus dari sini karena desain tidak memilikinya —
   sembunyikan saldo tetap tersedia di Pengaturan > Tampilan. */
function DesignHeader({
  activeTab,
  userName,
  avatarSrc,
  avatarInitials,
  onAvatarClick,
  onBack,
}) {
  const greeting = getGreeting(activeTab, userName);
  const isBack = greeting.startsWith("‹");

  return html`
    <header className="flex items-center justify-between gap-3 px-1 pb-3.5 pt-1">
      <div className="flex min-w-0 flex-col gap-px">
        ${isBack
          ? html`
              <button
                type="button"
                onClick=${onBack}
                className="self-start text-left text-[13px]"
                style=${{ color: "var(--cs-mut)" }}
              >
                ${greeting}
              </button>
            `
          : html`
              <span className="text-[13px]" style=${{ color: "var(--cs-mut)" }}>
                ${greeting}
              </span>
            `}
        <span className="truncate text-[17px] font-bold tracking-[-0.2px]">
          ${PAGE_TITLES[activeTab] || "CUANSYNC"}
        </span>
      </div>
      <${AvatarButton}
        src=${avatarSrc}
        initials=${avatarInitials}
        onClick=${onAvatarClick}
      />
    </header>
  `;
}

export function WalletHeader({
  appName,
  balances = {},
  valuationsByCurrency = {},
  totalValueBase = 0,
  activeCurrencies = DEFAULT_SELECTED_CURRENCIES,
  selectedCurrency,
  dailyCurrency,
  baseCurrency = DEFAULT_BASE_CURRENCY,
  visible,
  onToggleVisibility,
  onSelectCurrency,
  avatarSrc,
  avatarInitials,
  onAvatarClick,
  compact = false,
  historyCompact = false,
  activeTab = "overview",
  userName = "",
  onBack,
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const currencies = normalizeCurrencyList(activeCurrencies, { baseCurrency });
  const normalizedDailyCurrency = currencies.includes(normalizeCurrencyCode(dailyCurrency))
    ? normalizeCurrencyCode(dailyCurrency)
    : currencies[0] || baseCurrency;
  const normalizedSelectedCurrency =
    selectedCurrency && currencies.includes(normalizeCurrencyCode(selectedCurrency))
      ? normalizeCurrencyCode(selectedCurrency)
      : normalizedDailyCurrency;
  const normalizedBaseCurrency = normalizeCurrencyCode(baseCurrency);
  const focusBalance = Number(balances[normalizedSelectedCurrency] || 0);
  const normalizedTotalValueBase = Number(totalValueBase || 0);
  const wordmark = String(appName || "CUANSYNC").toUpperCase();

  useEffect(() => {
    if (currencies.length <= 3 && sheetOpen) setSheetOpen(false);
  }, [currencies.length, sheetOpen]);

  // Layar utama memakai header desain yang ramping. Ringkasan saldo lama hanya
  // dipertahankan untuk mode non-compact (rute yang belum dirombak).
  if (compact) {
    return html`
      <${DesignHeader}
        activeTab=${activeTab}
        userName=${userName}
        avatarSrc=${avatarSrc}
        avatarInitials=${avatarInitials}
        onAvatarClick=${onAvatarClick}
        onBack=${onBack}
      />
    `;
  }

  return html`
    <${React.Fragment}>
    <header className=${`wallet-header cs-topbar relative isolate overflow-hidden rounded-lg px-4 pb-4 pt-4 lg:pb-3 md:px-5 lg:px-5 lg:pt-3`}>
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5" aria-label=${wordmark}>
            <img
              src="/icons/icon-96.webp"
              alt=""
              className="h-9 w-9 shrink-0 rounded-2xl object-contain lg:h-8 lg:w-8"
            />
            <span className="min-w-0">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate font-display text-sm font-bold sm:text-base">
                  ${wordmark}
                </span>
              </span>
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <${PrivacyToggle}
              visible=${visible}
              onToggle=${onToggleVisibility}
            />
            <${AvatarButton}
              src=${avatarSrc}
              initials=${avatarInitials}
              onClick=${onAvatarClick}
            />
          </div>
        </div>

        ${compact
          ? historyCompact
            ? html`
                <${HistoryBalanceSummary}
                  currencies=${currencies}
                  selectedCurrency=${normalizedSelectedCurrency}
                  dailyCurrency=${normalizedDailyCurrency}
                  baseCurrency=${normalizedBaseCurrency}
                  focusBalance=${focusBalance}
                  totalValueBase=${normalizedTotalValueBase}
                  visible=${visible}
                  onSelectCurrency=${onSelectCurrency}
                  onOpenAll=${() => setSheetOpen(true)}
                />
              `
            : null
          : html`
              <${PrimaryBalanceHero}
                key="primary-balance"
                focusCurrency=${normalizedSelectedCurrency}
                focusBalance=${focusBalance}
                totalValueBase=${normalizedTotalValueBase}
                baseCurrency=${normalizedBaseCurrency}
                dailyCurrency=${normalizedDailyCurrency}
                visible=${visible}
              />

              <${CurrencySelectorRail}
                key="currency-selector"
                currencies=${currencies}
                selectedCurrency=${normalizedSelectedCurrency}
                dailyCurrency=${normalizedDailyCurrency}
                baseCurrency=${normalizedBaseCurrency}
                onSelectCurrency=${onSelectCurrency}
                onOpenAll=${() => setSheetOpen(true)}
              />
            `}
      </div>

    </header>

    <${WalletBottomSheet}
        key="wallet-currency-sheet"
        open=${sheetOpen}
        onClose=${() => setSheetOpen(false)}
        currencies=${currencies}
        selectedCurrency=${normalizedSelectedCurrency}
        dailyCurrency=${normalizedDailyCurrency}
        baseCurrency=${normalizedBaseCurrency}
        balances=${balances}
        valuationsByCurrency=${valuationsByCurrency}
        visible=${visible}
        onSelectCurrency=${onSelectCurrency}
      />
    <//>
  `;
}
