import React from "https://esm.sh/react@18.3.1";
import htm from "https://esm.sh/htm@3.1.1";
import {
  DEFAULT_BASE_CURRENCY,
  HIDDEN_BALANCE_TEXT,
  formatCurrency,
  normalizeCurrencyCode,
} from "../../lib/currency.js";
import { AmountFormatter } from "../shared/AmountFormatter.js";

const html = htm.bind(React.createElement);
const PANEL_SOFT_CLASS =
  "relative overflow-hidden rounded-[26px] cuan-card-soft";

const DESKTOP_NAV_TABS = [
  { key: "overview", label: "Kontrol" },
  { key: "history", label: "Riwayat" },
  { key: "budget", label: "Anggaran" },
  { key: "investment", label: "Aset" },
  { key: "settings", label: "Pengaturan" },
];

function getDesktopActiveTab(activeTab) {
  if (activeTab === "report") return "investment";
  if (activeTab === "add" || activeTab === "today") return "overview";
  return activeTab;
}

export function DesktopTopTabs({ activeTab, onChange }) {
  const activeKey = getDesktopActiveTab(activeTab);

  return html`
    <nav className="mt-4 hidden items-center justify-center rounded-[28px] border border-slate-200/70 bg-white/64 p-1.5 shadow-[0_18px_54px_rgba(15,23,42,0.08)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/58 dark:shadow-black/22 lg:flex">
      <div className="grid w-full grid-cols-5 gap-1">
        ${DESKTOP_NAV_TABS.map((tab) => {
          const active = activeKey === tab.key;
          return html`
            <button
              key=${tab.key}
              type="button"
              aria-current=${active ? "page" : undefined}
              onClick=${() => onChange(tab.key)}
              className=${`min-h-[46px] rounded-[22px] px-4 text-sm font-black transition duration-300 ${
                active
                  ? "bg-brand-600 text-white shadow-[0_16px_36px_rgba(16,185,129,0.24)] dark:bg-emerald-500"
                  : "text-slate-600 hover:bg-white/70 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
              }`}
            >
              ${tab.label}
            </button>
          `;
        })}
      </div>
    </nav>
  `;
}

function DesktopPanelStat({ label, value, helper = "" }) {
  return html`
    <div className="rounded-2xl border border-slate-200/60 bg-white/48 px-3 py-3 dark:border-white/10 dark:bg-slate-950/30">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
        ${label}
      </p>
      <div className="mt-1.5 truncate text-sm font-black text-slate-950 dark:text-white">
        ${value}
      </div>
      ${helper
        ? html`
            <p className="mt-1 truncate text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              ${helper}
            </p>
          `
        : null}
    </div>
  `;
}

export function DesktopRightPanel({
  assetAccounts = [],
  budget = null,
  todaySpentCurrency = 0,
  todaySpentIdr = 0,
  dailyCurrency = DEFAULT_BASE_CURRENCY,
  baseCurrency = DEFAULT_BASE_CURRENCY,
  visible = true,
  onNavigate,
}) {
  const normalizedDailyCurrency = normalizeCurrencyCode(dailyCurrency);
  const normalizedBaseCurrency = normalizeCurrencyCode(baseCurrency);
  const budgetCurrency = normalizeCurrencyCode(
    budget?.currency || normalizedDailyCurrency,
  );
  const safeRemaining = !budget
    ? "-"
    : !visible
      ? HIDDEN_BALANCE_TEXT
      : budget.todayRemainingSafe >= 0
        ? formatCurrency(budget.todayRemainingSafe, budgetCurrency)
        : `- ${formatCurrency(Math.abs(budget.todayRemainingSafe), budgetCurrency)}`;
  const budgetLimit = budget
    ? visible
      ? formatCurrency(budget.limitAmount, budgetCurrency)
      : HIDDEN_BALANCE_TEXT
    : "-";
  const baseValuation =
    todaySpentIdr > 0
      ? visible
        ? formatCurrency(todaySpentIdr, normalizedBaseCurrency)
        : HIDDEN_BALANCE_TEXT
      : "-";
  const walletRows = assetAccounts.slice(0, 5);
  const quickActions = [
    { label: "Transaksi", target: "add" },
    { label: "Wallet", target: "investment" },
  ];

  return html`
    <aside className="hidden lg:block">
      <div className="sticky top-6 grid gap-4">
        <section className=${`${PANEL_SOFT_CLASS} p-5`}>
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.10),transparent_55%)] opacity-80"></div>
          <div className="relative">
            <h3 className="font-display text-lg font-bold text-slate-950 dark:text-white">
              Ringkasan Hari Ini
            </h3>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <${DesktopPanelStat}
                label="Terpakai"
                value=${html`
                  <${AmountFormatter}
                    amount=${todaySpentCurrency}
                    currency=${normalizedDailyCurrency}
                    visible=${visible}
                    compact=${true}
                  />
                `}
              />
              <${DesktopPanelStat} label="Sisa aman" value=${safeRemaining} />
              <${DesktopPanelStat} label="Anggaran" value=${budgetLimit} />
              <${DesktopPanelStat}
                label=${`Valuasi ${normalizedBaseCurrency}`}
                value=${baseValuation}
              />
            </div>
          </div>
        </section>

        <section className=${`${PANEL_SOFT_CLASS} p-5`}>
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.10),transparent_55%)] opacity-80"></div>
          <div className="relative">
            <h3 className="font-display text-lg font-bold text-slate-950 dark:text-white">
              Wallet Aktif
            </h3>
            <div className="mt-4 grid gap-2.5">
              ${walletRows.length
                ? walletRows.map(
                    (account) => html`
                      <div
                        key=${account.id}
                        className="rounded-2xl border border-slate-200/60 bg-white/48 px-3 py-3 dark:border-white/10 dark:bg-slate-950/30"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-slate-950 dark:text-white">
                              ${account.name}
                            </p>
                            <p className="mt-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                              ${account.typeLabel} - ${account.currency}
                            </p>
                          </div>
                          <p className="shrink-0 text-right text-sm font-black text-slate-950 dark:text-white">
                            <${AmountFormatter}
                              amount=${account.balanceAmount}
                              currency=${account.currency}
                              visible=${visible}
                              compact=${true}
                            />
                          </p>
                        </div>
                        <p className="mt-2 truncate text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          ${account.valuationIdr == null
                            ? "Kurs belum tersedia"
                            : visible
                              ? formatCurrency(
                                  account.valuationIdr,
                                  normalizedBaseCurrency,
                                )
                              : HIDDEN_BALANCE_TEXT}
                        </p>
                      </div>
                    `,
                  )
                : html`
                    <div className="rounded-2xl border border-dashed border-slate-300/70 bg-white/40 px-4 py-5 text-center text-sm font-semibold text-slate-600 dark:border-white/10 dark:bg-slate-950/24 dark:text-slate-300">
                      <p>Belum ada wallet tambahan.</p>
                      <button
                        type="button"
                        onClick=${() => onNavigate("investment")}
                        className="mt-3 min-h-10 rounded-2xl bg-brand-600 px-3 py-2 text-xs font-black text-white transition hover:bg-brand-700 dark:bg-emerald-500"
                      >
                        Tambah wallet
                      </button>
                    </div>
                  `}
            </div>
          </div>
        </section>

        <section className=${`${PANEL_SOFT_CLASS} p-5`}>
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.10),transparent_55%)] opacity-80"></div>
          <div className="relative">
            <h3 className="font-display text-lg font-bold text-slate-950 dark:text-white">
              Aksi Cepat
            </h3>
            <div className="mt-4 grid grid-cols-2 gap-2">
              ${quickActions.map(
                (action) => html`
                  <button
                    key=${action.label}
                    type="button"
                    onClick=${() => onNavigate(action.target)}
                    className="cuan-secondary min-h-11 rounded-2xl px-3 py-2 text-xs font-black"
                  >
                    ${action.label}
                  </button>
                `,
              )}
            </div>
          </div>
        </section>
      </div>
    </aside>
  `;
}
