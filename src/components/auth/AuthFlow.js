import React, { useEffect, useState } from "https://esm.sh/react@18.3.1";
import htm from "https://esm.sh/htm@3.1.1";
import {
  DEFAULT_ACTIVE_CURRENCIES,
  DEFAULT_BASE_CURRENCY,
  DEFAULT_SELECTED_CURRENCIES,
  getCurrencyOptions,
  groupCurrencyOptions,
  normalizeCurrencyCode,
  normalizeCurrencyList,
} from "../../lib/currency.js";
import { PremiumMeshBackground } from "../shared/AppScaffold.js";

const html = htm.bind(React.createElement);
const PANEL_CLASS = "relative overflow-hidden rounded-[30px] cuan-card";

export function AuthScreen({ onGoogleLogin, onDemoLogin, supabaseReady, appName = "CUANSYNC" }) {
  return html`
    <main className="relative isolate min-h-screen overflow-hidden px-4 py-8 md:px-6 lg:px-8">
      <${PremiumMeshBackground} />
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center justify-center">
        <section className=${`${PANEL_CLASS} w-full p-7 md:p-8`}>
          <div className="inline-flex rounded-full border border-white/10 bg-brand-600 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white shadow-[0_10px_30px_rgba(16,185,129,0.18)]">
            ${appName}
          </div>
          <h1 className="mt-5 font-display text-3xl font-bold text-slate-950 dark:text-white">
            Masuk
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300/80">
            Catat pengeluaran harian dengan cepat.
          </p>

          <div className="mt-8 space-y-3">
            <button
              type="button"
              onClick=${onGoogleLogin}
              disabled=${!supabaseReady}
              className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3.5 text-sm font-semibold text-white shadow-[0_20px_50px_rgba(15,23,42,0.22)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(15,23,42,0.28)] disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-white dark:text-slate-950 dark:disabled:bg-slate-800"
            >
              ${supabaseReady ? "Masuk dengan Google" : "Google login belum siap"}
            </button>
            <button
              type="button"
              onClick=${onDemoLogin}
              className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3.5 text-sm font-semibold text-slate-900 backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:border-white/20 dark:bg-slate-900/40 dark:text-slate-100"
            >
              Coba Demo Lokal
            </button>
          </div>

          <p className="mt-5 text-xs leading-6 text-slate-500 dark:text-slate-400">
            ${supabaseReady
              ? "Demo tetap tersedia kalau kamu ingin langsung mencoba alurnya."
              : "Supabase belum aktif. Demo lokal tetap bisa langsung dipakai."}
          </p>
        </section>
      </div>
    </main>
  `;
}


function CurrencyPicker({ value, onChange, baseCurrency = DEFAULT_BASE_CURRENCY }) {
  const normalizedBaseCurrency = normalizeCurrencyCode(baseCurrency);
  const selected = normalizeCurrencyList(value, {
    baseCurrency: normalizedBaseCurrency,
  });
  const selectedSet = new Set(selected);
  const [query, setQuery] = useState("");
  const currencyGroups = groupCurrencyOptions(DEFAULT_ACTIVE_CURRENCIES, query);

  function toggleCurrency(currency) {
    const code = normalizeCurrencyCode(currency);
    if (code === normalizedBaseCurrency) return;
    const next = selectedSet.has(code)
      ? selected.filter((item) => item !== code)
      : [...selected, code];
    onChange(normalizeCurrencyList(next, { baseCurrency: normalizedBaseCurrency }));
  }

  return html`
    <div className="grid gap-3">
      <input
        type="search"
        value=${query}
        onChange=${(event) => setQuery(event.target.value)}
        placeholder="Cari IDR, Sri Lanka, Taiwan, Yuan..."
        aria-label="Cari mata uang"
        className="min-h-11 w-full rounded-2xl border border-slate-200/70 bg-white/70 px-4 text-sm text-slate-950 outline-none transition focus:border-brand-400 dark:border-white/10 dark:bg-slate-900/55 dark:text-white"
      />
      <div className="max-h-80 space-y-4 overflow-y-auto pr-1">
        ${currencyGroups.length
          ? currencyGroups.map(
              (group) => html`
                <section key=${group.region} aria-label=${group.label}>
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                    ${group.label}
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    ${group.options.map((option) => {
                      const active = selectedSet.has(option.value);
                      const locked = option.value === normalizedBaseCurrency;
                      return html`
                        <button
                          key=${option.value}
                          type="button"
                          onClick=${() => toggleCurrency(option.value)}
                          aria-pressed=${active}
                          className=${`min-h-14 rounded-2xl border px-3 py-2.5 text-left transition duration-300 ${
                            active
                              ? "border-brand-300/35 bg-brand-600 text-white shadow-[0_16px_36px_rgba(16,185,129,0.20)] dark:border-emerald-300/25 dark:bg-emerald-500 dark:text-white"
                              : "border-slate-200/70 bg-white/58 text-slate-600 hover:border-brand-300/35 hover:bg-white/82 hover:text-slate-950 dark:border-white/10 dark:bg-slate-900/45 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-white"
                          }`}
                        >
                          <span className="block text-sm font-black">${option.value}</span>
                          <span className=${`mt-0.5 block truncate text-[10px] font-semibold ${
                            active ? "text-white/72" : "text-slate-400 dark:text-slate-500"
                          }`}>
                            ${locked ? "Utama" : option.name}
                          </span>
                        </button>
                      `;
                    })}
                  </div>
                </section>
              `,
            )
          : html`
              <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                Mata uang tidak ditemukan.
              </p>
            `}
      </div>
      <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
        ${normalizedBaseCurrency} dikunci sebagai mata uang utama agar valuasi, saldo bersih, dan laporan tetap konsisten.
      </p>
    </div>
  `;
}

function DailyCurrencySelector({
  currencies,
  value,
  onChange,
  title = "Mata uang harian",
  helper = "Dipakai untuk pencatatan cepat Pengeluaran Hari Ini.",
  compact = false,
}) {
  const options = getCurrencyOptions(normalizeCurrencyList(currencies));
  const selectedCurrency = options.some((option) => option.value === normalizeCurrencyCode(value))
    ? normalizeCurrencyCode(value)
    : options[0]?.value || DEFAULT_BASE_CURRENCY;

  return html`
    <div className=${compact
      ? "rounded-2xl border border-slate-200/70 bg-white/58 p-2.5 dark:border-white/10 dark:bg-slate-900/35"
      : "rounded-2xl border border-brand-300/20 bg-brand-400/10 p-4 dark:border-brand-300/20 dark:bg-brand-500/10"}>
      <div className=${compact ? "mb-2 flex items-center justify-between gap-3 px-1" : "mb-3"}>
        <div>
          <p className=${compact
            ? "text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400"
            : "text-sm font-black text-slate-900 dark:text-slate-100"}>
            ${title}
          </p>
          ${helper
            ? html`
                <p className=${compact
                  ? "mt-0.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400"
                  : "mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300/80"}>
                  ${helper}
                </p>
              `
            : null}
        </div>
        ${compact
          ? html`
              <span className="shrink-0 rounded-full border border-brand-300/25 bg-brand-500/10 px-3 py-1 text-xs font-black text-brand-700 dark:text-brand-200">
                ${selectedCurrency}
              </span>
            `
          : null}
      </div>

      <div className=${`grid gap-2 ${options.length <= 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
        ${options.map((option) => {
          const active = option.value === selectedCurrency;
          return html`
            <button
              key=${option.value}
              type="button"
              onClick=${() => onChange(option.value)}
              aria-pressed=${active}
              className=${`min-h-11 rounded-2xl border px-3 py-2.5 text-sm font-black transition duration-300 ${
                active
                  ? "border-brand-300/35 bg-brand-600 text-white shadow-[0_14px_32px_rgba(16,185,129,0.20)] dark:border-emerald-300/25 dark:bg-emerald-500 dark:text-white"
                  : "border-slate-200/70 bg-white/66 text-slate-600 hover:border-brand-300/35 hover:bg-white/90 hover:text-slate-950 dark:border-white/10 dark:bg-slate-900/45 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-white"
              }`}
            >
              ${option.value}
            </button>
          `;
        })}
      </div>
    </div>
  `;
}

export function CurrencyOnboarding({ onSave, appName = "CUANSYNC", baseCurrency = DEFAULT_BASE_CURRENCY }) {
  const [selectedCurrencies, setSelectedCurrencies] = useState(DEFAULT_SELECTED_CURRENCIES);
  const [dailyCurrency, setDailyCurrency] = useState(DEFAULT_BASE_CURRENCY);
  const selectedLabel = normalizeCurrencyList(selectedCurrencies, { baseCurrency }).join(" + ");
  const normalizedSelectedCurrencies = normalizeCurrencyList(selectedCurrencies, { baseCurrency });
  const selectedDailyCurrency = normalizedSelectedCurrencies.includes(dailyCurrency)
    ? dailyCurrency
    : normalizedSelectedCurrencies[0] || DEFAULT_BASE_CURRENCY;

  useEffect(() => {
    setDailyCurrency((current) =>
      normalizedSelectedCurrencies.includes(current)
        ? current
        : normalizedSelectedCurrencies[0] || DEFAULT_BASE_CURRENCY,
    );
  }, [normalizedSelectedCurrencies.join("|")]);

  return html`
    <main className="relative isolate min-h-screen overflow-hidden px-4 py-7 md:px-6 lg:px-8">
      <${PremiumMeshBackground} />
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-xl items-center justify-center">
        <section className=${`${PANEL_CLASS} w-full p-6 md:p-8`}>
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.14),transparent_42%)] opacity-80"></div>
          <div className="relative">
            <div className="inline-flex rounded-full border border-brand-300/30 bg-brand-600 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-white shadow-[0_12px_30px_rgba(16,185,129,0.20)]">
              ${appName}
            </div>
            <p className="mt-6 text-[11px] font-black uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">
              Pengaturan awal
            </p>
            <h1 className="mt-2 font-display text-3xl font-black tracking-[-0.03em] text-slate-950 dark:text-white">
              Pilih mata uang yang kamu pakai
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300/80">
              CUANSYNC hanya menampilkan saldo, formulir, penyaring, dan exchange untuk mata uang yang kamu aktifkan.
            </p>

            <div className="mt-5">
              <${CurrencyPicker}
                value=${selectedCurrencies}
                baseCurrency=${baseCurrency}
                onChange=${setSelectedCurrencies}
              />
            </div>

            <div className="mt-5">
              <${DailyCurrencySelector}
                currencies=${normalizedSelectedCurrencies}
                value=${selectedDailyCurrency}
                onChange=${setDailyCurrency}
                title="Mata uang harian"
                helper="Pilih mata uang bawaan untuk Pengeluaran Hari Ini. Bisa diubah lagi dari Pengaturan."
              />
            </div>

            <div className="mt-5 rounded-2xl border border-brand-300/20 bg-brand-400/10 px-4 py-3 text-sm font-semibold text-brand-800 dark:border-brand-300/20 dark:bg-brand-500/10 dark:text-brand-100">
              Aktif: ${selectedLabel} | Harian: ${selectedDailyCurrency}
            </div>

            <button
              type="button"
              onClick=${() =>
                onSave({
                  activeCurrencies: selectedCurrencies,
                  dailyCurrency: selectedDailyCurrency,
                })}
              className="history-action-primary mt-5 w-full min-h-12 rounded-2xl px-4 py-3 text-sm font-black transition hover:-translate-y-0.5"
            >
              Mulai pakai CUANSYNC
            </button>
          </div>
        </section>
      </div>
    </main>
  `;
}

