import React from "https://esm.sh/react@18.3.1";
import htm from "https://esm.sh/htm@3.1.1";
import {
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpRight,
  ChevronRight,
  Gauge,
  Plus,
  ReceiptText,
  Repeat2,
  ShieldCheck,
  Target,
  WalletCards,
} from "https://esm.sh/lucide-react@0.468.0?deps=react@18.3.1";
import { formatControlMoney } from "../../domain/control.js";
import { getTransactionFlow } from "../../domain/transactions.js";
import {
  DEFAULT_BASE_CURRENCY,
  HIDDEN_BALANCE_TEXT,
  formatCurrency,
  formatPercent,
  normalizeCurrencyCode,
} from "../../lib/currency.js";
import { formatShortTime } from "../../lib/dates.js";
import {
  getTransactionCategoryLabel,
  getTransactionCompactAmount,
  getTransactionDisplayTitle,
  getTransactionTone,
} from "../transactions/presentation.js";

const html = htm.bind(React.createElement);

function getWalletCount(metrics, currencyValuations) {
  if (metrics.assetAccountCount > 0) return metrics.assetAccountCount;
  return Object.values(currencyValuations).filter((value) => Number(value || 0) > 0)
    .length;
}

function AssetComposition({
  currencies,
  valuations,
  totalValue,
}) {
  const items = currencies
    .map((currency) => ({
      currency,
      value: Number(valuations[currency] || 0),
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  if (!items.length) {
    return html`
      <p className="mt-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
        Belum ada saldo untuk diringkas.
      </p>
    `;
  }

  return html`
    <div className="mt-3 flex flex-wrap gap-1.5 sm:mt-4 sm:gap-2" aria-label="Komposisi aset per mata uang">
      ${items.map((item) => {
        const share = totalValue > 0 ? item.value / totalValue : 0;
        return html`
          <span
            key=${item.currency}
            className="inline-flex min-h-0 items-center gap-1 rounded-md border border-white/10 bg-white/[0.07] px-2 py-1 text-[9px] font-bold text-slate-200 sm:gap-1.5 sm:px-2.5 sm:py-1.5 sm:text-[10px]"
          >
            <span className="text-white">${item.currency}</span>
            <span className="text-emerald-300">${formatPercent(share)}</span>
          </span>
        `;
      })}
    </div>
  `;
}

function HeroAction({
  icon: Icon,
  label,
  primary = false,
  onClick,
}) {
  return html`
    <button
      type="button"
      onClick=${onClick}
      className=${`cs-home-hero-action inline-flex min-w-0 items-center justify-center gap-1.5 rounded-md px-2.5 text-[10px] font-extrabold transition ${
        primary
          ? "border border-emerald-300/30 bg-emerald-500 text-white shadow-[0_10px_24px_rgba(16,185,129,0.22)] hover:bg-emerald-400"
          : "border border-white/10 bg-white/[0.08] text-slate-100 hover:bg-white/[0.13]"
      }`}
    >
      <${Icon} aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">${label}</span>
    </button>
  `;
}

function AssetHero({
  metrics,
  currencies,
  valuations,
  totalValue,
  baseCurrency,
  visible,
  canExchange,
  onAddTransaction,
  onExchange,
}) {
  const walletCount = getWalletCount(metrics, valuations);

  return html`
    <section className="cs-home-hero relative overflow-hidden rounded-lg p-4 text-white md:p-6">
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-emerald-300">
            Total aset bersih (${baseCurrency})
          </p>
          <p className="mt-2.5 break-words font-display text-[1.75rem] font-bold leading-none tabular-nums md:mt-3 md:text-4xl">
            ${visible ? formatCurrency(totalValue, baseCurrency) : HIDDEN_BALANCE_TEXT}
          </p>
        </div>
        <span className="shrink-0 rounded-md border border-emerald-300/15 bg-emerald-400/10 px-2.5 py-1.5 text-[10px] font-bold text-emerald-200">
          ${walletCount} dompet aktif
        </span>
      </div>

      <${AssetComposition}
        currencies=${currencies}
        valuations=${valuations}
        totalValue=${totalValue}
      />

      <div className=${`cs-home-hero-actions mt-3 grid gap-2 md:hidden ${canExchange ? "is-multi" : "is-single"}`}>
        ${canExchange
          ? html`
              <${HeroAction}
                icon=${ArrowRightLeft}
                label="Transfer"
                onClick=${() => onExchange("transfer")}
              />
              <${HeroAction}
                icon=${Repeat2}
                label="Tukar valas"
                onClick=${() => onExchange("exchange")}
              />
            `
          : null}
        <${HeroAction}
          icon=${Plus}
          label=${canExchange ? "Catat" : "Catat transaksi"}
          primary=${true}
          onClick=${onAddTransaction}
        />
      </div>
    </section>
  `;
}

function ControlSummary({
  summary,
  visible,
  onOpen,
}) {
  const runwayLabel =
    summary.runway.months == null
      ? "Belum terbaca"
      : summary.runway.months < 1
        ? `${Math.max(Math.round(Math.max(summary.runway.months, 0) * 30), 0)} hari`
        : `${summary.runway.months.toLocaleString("id-ID", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          })} bulan`;
  const safeLabel = summary.safeToSpend.available
    ? formatControlMoney(
        summary.safeToSpend.amount,
        summary.baseCurrency,
        visible,
      )
    : "Belum dapat dihitung";
  const issueCount = summary.budget.attentionCount;
  const statusLabel =
    issueCount > 0
      ? `${issueCount} kategori perlu dilihat`
      : summary.budget.available
        ? "Anggaran sesuai ritme"
        : "Anggaran belum diatur";

  return html`
    <button
      type="button"
      onClick=${onOpen}
      aria-label="Buka Pusat Kontrol"
      className="cs-home-section cs-home-control w-full rounded-lg p-4 text-left transition hover:border-emerald-400/35 md:p-5"
    >
      <span className="flex items-center justify-between gap-4">
        <span className="flex min-w-0 items-center gap-3">
          <span className="cs-home-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-emerald-400">
            <${ShieldCheck} aria-hidden="true" className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-extrabold text-slate-950 dark:text-white md:text-base">
              Pusat Kontrol
            </span>
            <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
              ${statusLabel}
            </span>
          </span>
        </span>
        <${ChevronRight} aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-400" />
      </span>

      <span className="cs-home-control-metrics mt-3 grid grid-cols-2 gap-2.5 md:mt-4 md:gap-3">
        <span className="cs-home-metric cs-home-control-metric block rounded-lg p-3 md:p-3.5">
          <span className="flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
            <${Gauge} aria-hidden="true" className="h-3.5 w-3.5 text-emerald-400" />
            Sisa aman
          </span>
          <strong className="mt-2 block truncate text-sm font-black text-slate-950 dark:text-white md:text-base">
            ${safeLabel}
          </strong>
          <span className="mt-1 block truncate text-[10px] text-slate-500 dark:text-slate-400">
            ${summary.safeToSpend.status}
          </span>
        </span>

        <span className="cs-home-metric cs-home-control-metric block rounded-lg p-3 md:p-3.5">
          <span className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
            Dana cadangan
          </span>
          <strong className="mt-2 block truncate text-sm font-black text-amber-600 dark:text-amber-300 md:text-base">
            ${runwayLabel}
          </strong>
          <span className="mt-1 block truncate text-[10px] text-slate-500 dark:text-slate-400">
            ${summary.runway.status}
          </span>
        </span>
      </span>
    </button>
  `;
}

function PlanningSummary({
  metrics,
  onOpen,
}) {
  const categoryCount = metrics.budgetInsights.length;
  const budgetRemaining = Number(metrics.budgetLimitTotal || 0) -
    Number(metrics.budgetSpentTotal || 0);
  const nextGoal = metrics.nextGoal;
  const helper = categoryCount
    ? `${categoryCount} kategori - ${metrics.budgetStatusLabel}`
    : nextGoal
      ? `Target terdekat: ${nextGoal.name}`
      : "Atur batas bulanan dan target dana.";

  return html`
    <button
      type="button"
      onClick=${onOpen}
      className="cs-home-planning flex w-full items-center justify-between gap-3 rounded-lg p-3.5 text-left transition hover:border-emerald-400/35 md:p-4"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="cs-home-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-emerald-400">
          <${Target} aria-hidden="true" className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-extrabold text-slate-950 dark:text-white">
            Anggaran dan target
          </span>
          <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
            ${helper}
          </span>
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        ${categoryCount
          ? html`
              <span className=${`hidden text-xs font-bold sm:inline ${
                budgetRemaining < 0 ? "text-rose-500" : "text-emerald-500"
              }`}>
                ${budgetRemaining < 0 ? "Lewat batas" : "Masih aman"}
              </span>
            `
          : null}
        <${ChevronRight} aria-hidden="true" className="h-5 w-5 text-slate-400" />
      </span>
    </button>
  `;
}

function WalletRow({
  account,
  baseCurrency,
  visible,
}) {
  const nativeBalance = visible
    ? formatCurrency(account.balanceAmount, account.currency)
    : HIDDEN_BALANCE_TEXT;
  const baseValuation =
    account.currency !== baseCurrency && account.valuationIdr != null
      ? visible
        ? formatCurrency(account.valuationIdr, baseCurrency)
        : HIDDEN_BALANCE_TEXT
      : "";

  return html`
    <article className="cs-home-wallet min-w-[10.5rem] flex-1 rounded-lg p-3 sm:min-w-[13.5rem] sm:p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-extrabold text-slate-950 dark:text-white">
            ${account.name}
          </h3>
          <p className="mt-1 truncate text-[10px] font-semibold text-slate-500 dark:text-slate-400">
            ${account.typeLabel}
          </p>
        </div>
        <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-[10px] font-extrabold text-emerald-500">
          ${account.currency}
        </span>
      </div>
      <p className="mt-3 text-[9px] font-bold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400 sm:mt-4 sm:text-[10px]">
        Saldo
      </p>
      <p className="mt-1 truncate text-base font-black tabular-nums text-slate-950 dark:text-white">
        ${nativeBalance}
      </p>
      ${baseValuation
        ? html`
            <p className="mt-1 truncate text-[11px] font-bold text-emerald-500">
              ${baseValuation}
            </p>
          `
        : null}
    </article>
  `;
}

function WalletSummary({
  accounts,
  baseCurrency,
  visible,
  onOpen,
}) {
  return html`
    <section className="cs-home-wallet-section min-w-0 max-w-full">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
          Dompet
        </h2>
        <button
          type="button"
          onClick=${onOpen}
          className="inline-flex min-h-9 items-center gap-1 rounded-md px-2.5 text-xs font-bold text-emerald-500 transition hover:bg-emerald-500/10"
        >
          Kelola
          <${ChevronRight} aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>

      ${accounts.length
        ? html`
            <div className="balance-strip cs-home-wallet-strip flex w-full min-w-0 max-w-full gap-3 overflow-x-auto pb-1">
              ${accounts.slice(0, 6).map(
                (account) => html`
                  <${WalletRow}
                    key=${account.id}
                    account=${account}
                    baseCurrency=${baseCurrency}
                    visible=${visible}
                  />
                `,
              )}
            </div>
          `
        : html`
            <button
              type="button"
              onClick=${onOpen}
              className="cs-home-empty flex min-h-24 w-full items-center justify-center gap-3 rounded-lg p-4 text-sm font-bold text-slate-600 transition hover:border-emerald-400/35 dark:text-slate-300"
            >
              <${WalletCards} aria-hidden="true" className="h-5 w-5 text-emerald-500" />
              Tambah dompet pertama
            </button>
          `}
    </section>
  `;
}

function getTransactionAccountLabel(transaction, accountMap) {
  const flow = getTransactionFlow(transaction);
  if (flow === "exchange") {
    const from = accountMap.get(transaction.source_account_id);
    const to = accountMap.get(transaction.destination_account_id);
    return from && to ? `${from.name} ke ${to.name}` : "Tukar mata uang";
  }
  const accountId =
    flow === "income"
      ? transaction.destination_account_id
      : transaction.source_account_id;
  return accountMap.get(accountId)?.name || getTransactionCategoryLabel(transaction);
}

function TransactionIcon({ flow }) {
  const Icon =
    flow === "income"
      ? ArrowDownLeft
      : flow === "exchange"
        ? Repeat2
        : ArrowUpRight;
  return html`<${Icon} aria-hidden="true" className="h-4 w-4" />`;
}

function RecentTransactionRow({
  transaction,
  accountMap,
  fallbackRate,
}) {
  const flow = getTransactionFlow(transaction);
  const amount = getTransactionCompactAmount(transaction, fallbackRate);
  const tone = getTransactionTone(transaction);

  return html`
    <div className="grid min-h-[58px] grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 border-b border-slate-200/70 px-1 py-2.5 last:border-b-0 dark:border-slate-800">
      <span className=${`flex h-9 w-9 items-center justify-center rounded-lg ${tone.historyIcon}`}>
        <${TransactionIcon} flow=${flow} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-extrabold text-slate-950 dark:text-white">
          ${getTransactionDisplayTitle(transaction)}
        </span>
        <span className="mt-0.5 block truncate text-[10px] font-semibold text-slate-500 dark:text-slate-400">
          ${getTransactionAccountLabel(transaction, accountMap)} ·
          ${formatShortTime(transaction.occurred_at)}
        </span>
      </span>
      <span className="min-w-0 text-right">
        <span className=${`block max-w-[8rem] truncate text-sm font-black ${tone.amount}`}>
          ${amount.primary}
        </span>
        ${amount.secondary
          ? html`
              <span className="mt-0.5 block max-w-[8rem] truncate text-[9px] font-bold uppercase text-slate-500 dark:text-slate-400">
                ${amount.secondary}
              </span>
            `
          : null}
      </span>
    </div>
  `;
}

function RecentTransactions({
  transactions,
  accounts,
  fallbackRate,
  onOpen,
}) {
  const accountMap = new Map(accounts.map((account) => [account.id, account]));
  const rows = transactions.slice(0, 5);

  return html`
    <section className="cs-home-section rounded-lg p-4 md:p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <${ReceiptText} aria-hidden="true" className="h-4 w-4 text-emerald-500" />
          <h2 className="text-sm font-extrabold text-slate-950 dark:text-white">
            Transaksi terbaru
          </h2>
        </span>
        <button
          type="button"
          onClick=${onOpen}
          className="inline-flex min-h-9 items-center gap-1 rounded-md px-2.5 text-xs font-bold text-emerald-500 transition hover:bg-emerald-500/10"
        >
          Lihat semua
          <${ChevronRight} aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3">
        ${rows.length
          ? rows.map(
              (transaction) => html`
                <${RecentTransactionRow}
                  key=${transaction.id}
                  transaction=${transaction}
                  accountMap=${accountMap}
                  fallbackRate=${fallbackRate}
                />
              `,
            )
          : html`
              <div className="flex min-h-28 flex-col items-center justify-center text-center">
                <${ReceiptText} aria-hidden="true" className="h-5 w-5 text-slate-400" />
                <p className="mt-2 text-sm font-bold text-slate-600 dark:text-slate-300">
                  Belum ada transaksi.
                </p>
              </div>
            `}
      </div>
    </section>
  `;
}

export function HomeDashboardPage({
  metrics,
  controlSummary,
  activeCurrencies = [],
  dailyCurrency = DEFAULT_BASE_CURRENCY,
  baseCurrency = DEFAULT_BASE_CURRENCY,
  valuationsByCurrency = {},
  totalValueBase = 0,
  visible = true,
  fallbackRate = 0,
  onNavigate,
  canExchange = false,
  onAddTransaction,
  onExchange,
}) {
  const normalizedBaseCurrency = normalizeCurrencyCode(baseCurrency);

  return html`
    <div className="cs-home-dashboard grid w-full min-w-0 max-w-full gap-4">
      <${AssetHero}
        metrics=${metrics}
        currencies=${activeCurrencies}
        valuations=${valuationsByCurrency}
        totalValue=${totalValueBase}
        baseCurrency=${normalizedBaseCurrency}
        visible=${visible}
        canExchange=${canExchange}
        onAddTransaction=${onAddTransaction}
        onExchange=${onExchange}
      />
      <${ControlSummary}
        summary=${controlSummary}
        visible=${visible}
        onOpen=${() => onNavigate("control")}
      />
      <${PlanningSummary}
        metrics=${metrics}
        onOpen=${() => onNavigate("budget")}
      />
      <${WalletSummary}
        accounts=${metrics.assetAccountInsights}
        baseCurrency=${normalizedBaseCurrency}
        visible=${visible}
        onOpen=${() => onNavigate("investment")}
      />
      <${RecentTransactions}
        transactions=${metrics.recent}
        accounts=${metrics.assetAccountInsights}
        fallbackRate=${fallbackRate}
        onOpen=${() => onNavigate("history")}
      />
    </div>
  `;
}
