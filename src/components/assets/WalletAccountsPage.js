import React, {
  useEffect,
  useMemo,
  useState,
} from "react";
import htm from "htm";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Building2,
  Info,
  MoreHorizontal,
  Palette,
  Plus,
  Repeat2,
  ShieldCheck,
  Star,
  Trash2,
  WalletCards,
} from "lucide-react";
import {
  getTransactionAccountActivity,
  getTransactionFlow,
  transactionBelongsToAccount,
} from "../../domain/transactions.js";
import {
  getDefaultGoalFundingAccountId,
  getGoalActivityEffect,
  getGoalFundingAccountOptions,
} from "../../domain/goals.js";
import {
  DEFAULT_BASE_CURRENCY,
  formatCurrency,
  formatNumericInput,
  formatPercent,
  normalizeCurrencyCode,
  normalizeNumericInput,
} from "../../lib/currency.js";
import { formatShortDateTime } from "../../lib/dates.js";
import { SheetShell } from "../shared/SheetShell.js";
import { getTransactionDisplayTitle } from "../transactions/presentation.js";

const html = htm.bind(React.createElement);

const WALLET_COLOR_STORAGE_KEY = "cuansync.wallet-account-colors.v1";
const WALLET_COLOR_PRESETS = [
  { id: "emerald", label: "Hijau", accent: "#10b981", soft: "rgba(16, 185, 129, 0.14)" },
  { id: "blue", label: "Biru", accent: "#3b82f6", soft: "rgba(59, 130, 246, 0.14)" },
  { id: "violet", label: "Ungu", accent: "#8b5cf6", soft: "rgba(139, 92, 246, 0.14)" },
  { id: "amber", label: "Kuning", accent: "#f59e0b", soft: "rgba(245, 158, 11, 0.14)" },
  { id: "rose", label: "Merah", accent: "#f43f5e", soft: "rgba(244, 63, 94, 0.14)" },
  { id: "cyan", label: "Biru muda", accent: "#06b6d4", soft: "rgba(6, 182, 212, 0.14)" },
];

function readWalletColorPreferences() {
  if (typeof window === "undefined") return {};
  try {
    const stored = window.localStorage.getItem(WALLET_COLOR_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function getWalletColor(colorPreferences, account, index) {
  const colorId = colorPreferences[account.id];
  return WALLET_COLOR_PRESETS.find((color) => color.id === colorId) ||
    WALLET_COLOR_PRESETS[index % WALLET_COLOR_PRESETS.length];
}

function getWalletValuation(account, baseCurrency) {
  if (account.currency === baseCurrency) return null;
  const valuation = Number(account.valuationIdr);
  if (!Number.isFinite(valuation)) return "Kurs belum tersedia";
  return `≈ ${formatCurrency(valuation, baseCurrency)}`;
}

function getAccountIcon(accountType) {
  if (accountType === "cash") return Banknote;
  if (accountType === "bank") return Building2;
  return WalletCards;
}

function getGoalPrimarySource(goal) {
  const breakdown = goal.accountBreakdown || [];
  return breakdown.find(
    (item) => item.accountId === goal.primaryFundingAccountId,
  ) || breakdown[0] || null;
}

function getGoalSourceLabel(goal) {
  const source = getGoalPrimarySource(goal);
  const sourceCount = goal.accountBreakdown?.length || 0;
  if (source) {
    const mappedLabel = sourceCount > 1
      ? `Dari ${source.accountName} +${sourceCount - 1}`
      : `Dari ${source.accountName}`;
    return goal.hasUnmappedFunding ? `${mappedLabel} + sumber lama` : mappedLabel;
  }
  if (goal.hasUnmappedFunding) return "Sumber perlu dipetakan";
  return "Belum dialokasikan";
}

function getGoalActivityLabel(activity) {
  const labels = {
    assign: "Saldo ditambahkan",
    release: "Alokasi dilepas",
    spend: "Tabungan digunakan",
    transfer_in: "Pindahan masuk",
    transfer_out: "Pindahan keluar",
    adjustment: "Penyesuaian saldo",
  };
  return labels[activity.type] || "Aktivitas tabungan";
}

function AccountCard({
  account,
  baseCurrency,
  selected,
  onSelect,
  onManage,
  accent,
}) {
  const Icon = getAccountIcon(account.account_type);
  const valuation = getWalletValuation(account, baseCurrency);
  const reservedBalance = Number(account.reservedBalance || 0);

  return html`
    <article
      className=${`cs-pocket-tile cs-pocket-pay ${selected ? "is-selected" : ""}`}
      style=${{
        "--wallet-accent": accent.accent,
        "--wallet-accent-soft": accent.soft,
      }}
    >
      <button
        type="button"
        onClick=${onSelect}
        aria-pressed=${selected}
        aria-label=${`Lihat mutasi ${account.name}`}
        className="flex h-full min-h-0 w-full flex-col justify-between p-3 text-left"
      >
        <span className="block min-w-0">
          <span className="flex items-start justify-between gap-2">
            <span className="cs-pocket-icon flex h-9 w-9 items-center justify-center rounded-lg">
              <${Icon} aria-hidden="true" className="h-4 w-4" />
            </span>
            <span className="mr-8 flex items-center gap-1.5">
              ${account.isPrimary
                ? html`<span className="rounded-md bg-amber-500/15 px-1.5 py-1 text-[8px] font-black text-amber-500">UTAMA</span>`
                : null}
              <span className="rounded-md bg-slate-500/10 px-1.5 py-1 text-[8px] font-black text-slate-500 dark:text-slate-300">
                ${account.currency}
              </span>
            </span>
          </span>
          <span className="mt-3 block text-[9px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Dompet
          </span>
          <strong className="mt-1 block truncate font-display text-sm font-black text-slate-950 dark:text-white">
            ${account.name}
          </strong>
        </span>

        <span className="mt-4 block min-w-0">
          <strong className="block truncate font-display text-base font-black tabular-nums text-emerald-500">
            ${formatCurrency(account.balanceAmount, account.currency)}
          </strong>
          ${valuation
            ? html`<span className="cs-pocket-valuation mt-1 block truncate text-[9px] font-bold">${valuation}</span>`
            : null}
          <span className="mt-3 flex items-center justify-between gap-2 border-t border-slate-200/70 pt-2.5 text-[9px] dark:border-slate-800">
            <span className="truncate text-slate-500 dark:text-slate-400">
              ${account.typeLabel}${reservedBalance > 0
                ? ` • ${formatCurrency(reservedBalance, account.currency)} ditabung`
                : ""}
            </span>
            <span className=${selected ? "shrink-0 font-black text-emerald-500" : "shrink-0 font-bold text-sky-500"}>
              ${selected ? "• Dipilih" : "Mutasi →"}
            </span>
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick=${onManage}
        aria-label=${`Kelola ${account.name}`}
        title=${`Kelola ${account.name}`}
        className="cs-pocket-manage absolute right-1.5 top-1.5 z-10 flex h-10 w-10 items-center justify-center rounded-lg text-slate-400"
      >
        <${MoreHorizontal} aria-hidden="true" className="h-4 w-4" />
      </button>
    </article>
  `;
}

function GoalCard({ goal, selected, onSelect, onManage }) {
  const progress = Math.max(0, Math.min(Number(goal.progress || 0), 1));
  return html`
    <article className=${`cs-pocket-tile cs-pocket-saving ${selected ? "is-selected" : ""}`}>
      <button
        type="button"
        onClick=${onSelect}
        aria-pressed=${selected}
        aria-label=${`Lihat aktivitas ${goal.name}`}
        className="flex h-full min-h-0 w-full flex-col justify-between p-3 text-left"
      >
        <span className="block min-w-0">
          <span className="flex items-start justify-between gap-2">
            <span className="cs-pocket-icon flex h-9 w-9 items-center justify-center rounded-lg">
              <${ShieldCheck} aria-hidden="true" className="h-4 w-4" />
            </span>
            <span className="mr-8 flex items-center gap-1.5">
              <span className="rounded-md bg-cyan-500/15 px-1.5 py-1 text-[8px] font-black text-cyan-600 dark:text-cyan-300">
                ${formatPercent(progress)}
              </span>
            </span>
          </span>
          <span className="mt-3 block text-[9px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Tabungan
          </span>
          <strong className="mt-1 block truncate font-display text-sm font-black text-slate-950 dark:text-white">
            ${goal.name}
          </strong>
        </span>

        <span className="mt-4 block min-w-0">
          <strong className="block truncate font-display text-base font-black tabular-nums text-slate-950 dark:text-white">
            ${formatCurrency(goal.availableAmount || 0, goal.currency)}
          </strong>
          <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
            <span className="block h-full rounded-full bg-cyan-400" style=${{ width: `${progress * 100}%` }}></span>
          </span>
          <span className="mt-2 flex items-center justify-between gap-2 text-[9px]">
            <span className="truncate text-slate-500 dark:text-slate-400">
              ${getGoalSourceLabel(goal)}
            </span>
            <span className="shrink-0 font-bold text-cyan-500">
              ${selected ? "• Dipilih" : "Aktivitas →"}
            </span>
          </span>
          <span className="mt-1 block truncate text-[8px] text-slate-500 dark:text-slate-400">
            Target ${formatCurrency(goal.targetAmount || 0, goal.currency)} • Alokasi virtual
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick=${onManage}
        aria-label=${`Kelola ${goal.name}`}
        title=${`Kelola ${goal.name}`}
        className="cs-pocket-manage absolute right-1.5 top-1.5 z-10 flex h-10 w-10 items-center justify-center rounded-lg text-slate-400"
      >
        <${MoreHorizontal} aria-hidden="true" className="h-4 w-4" />
      </button>
    </article>
  `;
}

function CreatePocketTile({ onClick }) {
  return html`
    <button
      type="button"
      onClick=${onClick}
      className="cs-pocket-create flex min-h-[11rem] flex-col items-center justify-center rounded-lg p-4 text-center"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-500">
        <${Plus} aria-hidden="true" className="h-5 w-5" />
      </span>
      <strong className="mt-3 text-xs font-black text-slate-950 dark:text-white">
        + Tambah Baru
      </strong>
      <span className="mt-1 text-[9px] text-slate-500 dark:text-slate-400">
        Dompet atau Tabungan
      </span>
    </button>
  `;
}

function ActivityRow({ transaction, accountId }) {
  const flow = getTransactionFlow(transaction);
  const relativeAmount = getTransactionAccountActivity(transaction, accountId);
  const incoming = relativeAmount.direction === "in";
  const Icon = flow === "exchange"
    ? Repeat2
    : incoming
      ? ArrowDownLeft
      : ArrowUpRight;

  return html`
    <li className="cs-wallet-activity-row grid min-w-0 grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg p-2.5">
      <span className=${`flex h-9 w-9 items-center justify-center rounded-lg ${
        flow === "exchange"
          ? "bg-sky-500/10 text-sky-400"
          : incoming
            ? "bg-emerald-500/10 text-emerald-400"
            : "bg-rose-500/10 text-rose-400"
      }`}>
        <${Icon} aria-hidden="true" className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <strong className="block truncate text-xs font-extrabold text-slate-950 dark:text-white">
          ${getTransactionDisplayTitle(transaction)}
        </strong>
        <span className="mt-1 block truncate text-[9px] font-medium text-slate-500 dark:text-slate-400">
          ${formatShortDateTime(transaction.occurred_at)}
        </span>
      </span>
      <strong className=${`max-w-[8.5rem] truncate text-right text-xs font-black tabular-nums ${
        incoming ? "text-emerald-500" : "text-rose-500"
      }`}>
        ${incoming ? "+" : "-"}${formatCurrency(
          relativeAmount.amount,
          relativeAmount.currency,
        )}
      </strong>
    </li>
  `;
}

function AccountActivity({ account, transactions }) {
  return html`
    <section className="cs-wallet-activity min-w-0 rounded-lg p-3.5">
      <div className="flex min-w-0 items-start justify-between gap-3 border-b border-slate-200/70 pb-3 dark:border-slate-800">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-xs font-extrabold text-slate-950 dark:text-white">
              Mutasi: ${account.name}
            </h2>
            <span className="shrink-0 rounded-md bg-emerald-500/10 px-2 py-1 text-[8px] font-extrabold text-emerald-500">
              ${account.currency}
            </span>
          </div>
        </div>
        <span className="shrink-0 text-[9px] text-sky-500">Transaksi terbaru</span>
      </div>

      ${transactions.length
        ? html`
            <ul className="mt-3 grid min-w-0 gap-2">
              ${transactions.map(
                (transaction) => html`
                  <${ActivityRow}
                    key=${transaction.id}
                    transaction=${transaction}
                    accountId=${account.id}
                  />
                `,
              )}
            </ul>
          `
        : html`
            <div className="flex min-h-24 flex-col items-center justify-center px-4 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Belum ada transaksi di dompet ini.
              </p>
            </div>
          `}
    </section>
  `;
}

function GoalActivity({ goal }) {
  const activities = [...(goal.activities || [])]
    .sort(
      (left, right) =>
        new Date(right.created_at).getTime() -
        new Date(left.created_at).getTime(),
    )
    .slice(0, 7);

  return html`
    <section className="cs-wallet-activity min-w-0 rounded-lg p-3.5">
      <div className="flex min-w-0 items-start justify-between gap-3 border-b border-slate-200/70 pb-3 dark:border-slate-800">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-xs font-extrabold text-slate-950 dark:text-white">
            Mutasi: ${goal.name}
          </h2>
          <span className="shrink-0 rounded-md bg-cyan-500/10 px-2 py-1 text-[8px] font-extrabold text-cyan-500">
            TABUNGAN
          </span>
        </div>
        <span className="shrink-0 text-[9px] text-sky-500">Aktivitas terbaru</span>
      </div>

      ${activities.length
        ? html`
            <ul className="mt-3 grid min-w-0 gap-2">
              ${activities.map((activity) => {
                const effect = getGoalActivityEffect(activity);
                const incoming = effect >= 0;
                const source = goal.accountBreakdown?.find(
                  (item) => item.accountId === activity.account_id,
                );
                const Icon = incoming ? ArrowDownLeft : ArrowUpRight;
                return html`
                  <li
                    key=${activity.id}
                    className="cs-wallet-activity-row grid min-w-0 grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg p-2.5"
                  >
                    <span className=${`flex h-9 w-9 items-center justify-center rounded-lg ${
                      incoming
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-rose-500/10 text-rose-400"
                    }`}>
                      <${Icon} aria-hidden="true" className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <strong className="block truncate text-xs font-extrabold text-slate-950 dark:text-white">
                        ${getGoalActivityLabel(activity)}
                      </strong>
                      <span className="mt-1 block truncate text-[9px] font-medium text-slate-500 dark:text-slate-400">
                        ${source?.accountName || activity.note || "Catatan Tabungan"} • ${formatShortDateTime(activity.created_at)}
                      </span>
                    </span>
                    <strong className=${`max-w-[8.5rem] truncate text-right text-xs font-black tabular-nums ${
                      incoming ? "text-emerald-500" : "text-rose-500"
                    }`}>
                      ${incoming ? "+" : "-"}${formatCurrency(
                        Math.abs(effect),
                        activity.currency || goal.currency,
                      )}
                    </strong>
                  </li>
                `;
              })}
            </ul>
          `
        : html`
            <div className="flex min-h-24 flex-col items-center justify-center px-4 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Belum ada aktivitas baru di Tabungan ini.
              </p>
            </div>
          `}
    </section>
  `;
}

function AccountDetail({
  account,
  goals,
  accent,
  onSetAccent,
  onSetPrimary,
  onDelete,
}) {
  const Icon = getAccountIcon(account.account_type);
  const linkedGoals = goals.filter((goal) =>
    goal.accountBreakdown?.some((item) => item.accountId === account.id),
  );

  return html`
    <div className="grid gap-4">
      <div className="flex items-center gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style=${{ color: accent.accent, background: accent.soft }}
        >
          <${Icon} aria-hidden="true" className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Dompet • ${account.currency}
          </p>
          <p className="mt-1 truncate font-display text-xl font-black text-slate-950 dark:text-white">
            ${formatCurrency(account.balanceAmount, account.currency)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-100/80 p-3 dark:bg-slate-900/70">
        <div className="min-w-0">
          <span className="block text-[8px] font-black uppercase text-slate-500 dark:text-slate-400">Saldo aktual</span>
          <strong className="mt-1 block truncate text-[11px] tabular-nums">${formatCurrency(account.balanceAmount, account.currency)}</strong>
        </div>
        <div className="min-w-0">
          <span className="block text-[8px] font-black uppercase text-slate-500 dark:text-slate-400">Ditabung</span>
          <strong className="mt-1 block truncate text-[11px] tabular-nums text-amber-500">${formatCurrency(account.reservedBalance || 0, account.currency)}</strong>
        </div>
        <div className="min-w-0">
          <span className="block text-[8px] font-black uppercase text-slate-500 dark:text-slate-400">Tersedia</span>
          <strong className=${`mt-1 block truncate text-[11px] tabular-nums ${Number(account.availableBalance || 0) < 0 ? "text-rose-500" : "text-emerald-500"}`}>${formatCurrency(account.availableBalance || 0, account.currency)}</strong>
        </div>
      </div>

      <section>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-black text-slate-950 dark:text-white">Dipakai untuk tabungan</h3>
          <span className="text-[9px] text-slate-500 dark:text-slate-400">${linkedGoals.length} tujuan</span>
        </div>
        ${linkedGoals.length
          ? html`
              <div className="mt-2 grid gap-2">
                ${linkedGoals.map((goal) => {
                  const source = goal.accountBreakdown.find(
                    (item) => item.accountId === account.id,
                  );
                  return html`
                    <div key=${goal.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                      <div className="flex min-w-0 items-center gap-2">
                        <${ShieldCheck} aria-hidden="true" className="h-4 w-4 shrink-0 text-cyan-500" />
                        <div className="min-w-0">
                          <strong className="block truncate text-xs">${goal.name}</strong>
                          <span className="text-[9px] text-slate-500 dark:text-slate-400">Alokasi virtual</span>
                        </div>
                      </div>
                      <strong className="shrink-0 text-xs tabular-nums">${formatCurrency(source?.amount || 0, goal.currency)}</strong>
                    </div>
                  `;
                })}
              </div>
            `
          : html`
              <div className="mt-2 rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                Belum menjadi sumber Tabungan.
              </div>
            `}
      </section>

      <div>
        <p className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Warna dompet</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <${Palette} aria-hidden="true" className="h-4 w-4 text-slate-400" />
          ${WALLET_COLOR_PRESETS.map(
            (color) => html`
              <button
                key=${color.id}
                type="button"
                onClick=${() => onSetAccent(color.id)}
                aria-label=${color.label}
                aria-pressed=${color.id === accent.id}
                title=${color.label}
                style=${{ "--wallet-choice": color.accent }}
                className=${`cs-wallet-color-choice ${color.id === accent.id ? "is-selected" : ""}`}
              ></button>
            `,
          )}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <button
          type="button"
          onClick=${() => onSetPrimary(account)}
          className=${`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-xs font-black ${account.isPrimary ? "bg-amber-500/15 text-amber-500" : "bg-emerald-500 text-white"}`}
        >
          <${Star} aria-hidden="true" className="h-4 w-4" />
          ${account.isPrimary ? "Utama pengeluaran" : "Jadikan utama"}
        </button>
        <button
          type="button"
          onClick=${() => onDelete(account)}
          aria-label=${`Hapus ${account.name}`}
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500"
        >
          <${Trash2} aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </div>
  `;
}

function GoalDetail({ goal, accounts, loading, onContribute, onDelete, onUse }) {
  const [actionType, setActionType] = useState("assign");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const progress = Math.max(0, Math.min(Number(goal.progress || 0), 1));
  const mappedAvailableAmount = (goal.accountBreakdown || []).reduce(
    (sum, source) => sum + Math.max(Number(source.amount || 0), 0),
    0,
  );
  const accountOptions = getGoalFundingAccountOptions({
    goal,
    type: actionType,
    accounts,
  });

  useEffect(() => {
    if (!formOpen) return;
    setAccountId(
      getDefaultGoalFundingAccountId({
        goal,
        type: actionType,
        accounts,
      }),
    );
    setAmount("");
  }, [goal.id, actionType, formOpen]);

  async function submit(event) {
    event.preventDefault();
    const ok = await onContribute(
      goal,
      normalizeNumericInput(amount),
      actionType === "release" ? "withdraw" : "deposit",
      accountId,
    );
    if (ok) {
      setAmount("");
      setFormOpen(false);
    }
  }

  return html`
    <div className="grid gap-4">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-500">
          <${ShieldCheck} aria-hidden="true" className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-wide text-cyan-500">Tabungan • Alokasi virtual</p>
          <p className="mt-1 truncate font-display text-xl font-black text-slate-950 dark:text-white">${formatCurrency(goal.availableAmount || 0, goal.currency)}</p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-3 text-[10px] text-slate-500 dark:text-slate-400">
          <span>${formatPercent(progress)} tercapai</span>
          <span>Target ${formatCurrency(goal.targetAmount || 0, goal.currency)}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div className="h-full rounded-full bg-cyan-400" style=${{ width: `${progress * 100}%` }}></div>
        </div>
      </div>

      <section>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-black text-slate-950 dark:text-white">Sumber dana tercatat</h3>
          <span className="text-[9px] text-slate-500 dark:text-slate-400">${goal.accountBreakdown?.length || 0} sumber</span>
        </div>

        ${goal.accountBreakdown?.length
          ? html`
              <div className="mt-2 grid gap-2">
                ${goal.accountBreakdown.map((source) => {
                  const account = accounts.find((item) => item.id === source.accountId);
                  const Icon = getAccountIcon(account?.account_type);
                  const primary = source.accountId === goal.primaryFundingAccountId;
                  return html`
                    <div key=${source.accountId} className="flex items-center justify-between gap-3 rounded-lg bg-slate-100/80 p-3 dark:bg-slate-900/70">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/12 text-emerald-500"><${Icon} aria-hidden="true" className="h-4 w-4" /></span>
                        <div className="min-w-0">
                          <strong className="block truncate text-xs">${source.accountName}</strong>
                          <span className="text-[9px] text-slate-500 dark:text-slate-400">${account?.typeLabel || "Sumber dana"}${primary ? " • Sumber utama" : ""}</span>
                        </div>
                      </div>
                      <strong className="shrink-0 text-xs tabular-nums">${formatCurrency(source.amount, goal.currency)}</strong>
                    </div>
                  `;
                })}
                ${goal.unmappedAmount > 0.0001
                  ? html`
                      <div className="flex items-center justify-between gap-3 rounded-lg bg-amber-500/10 p-3 text-amber-600 dark:text-amber-300">
                        <div className="flex min-w-0 items-center gap-2">
                          <${Info} aria-hidden="true" className="h-4 w-4 shrink-0" />
                          <div className="min-w-0">
                            <strong className="block truncate text-xs">Sumber belum dipetakan</strong>
                            <span className="text-[9px]">Progres lama sebelum pelacakan rekening</span>
                          </div>
                        </div>
                        <strong className="shrink-0 text-xs tabular-nums">${formatCurrency(goal.unmappedAmount, goal.currency)}</strong>
                      </div>
                    `
                  : null}
              </div>
            `
          : html`
              <div className="mt-2 rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                ${goal.hasUnmappedFunding
                  ? "Progres lama masih ada, tetapi sumber rekeningnya belum dipetakan."
                  : "Belum ada dana yang dialokasikan."}
              </div>
            `}

        <div className="mt-3 flex items-start gap-2 rounded-lg bg-emerald-500/10 p-3 text-[10px] leading-4 text-emerald-700 dark:text-emerald-300">
          <${Info} aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Uang tetap berada di rekening atau cash sumber. CUANSYNC hanya menandai tujuan pemakaiannya dan tidak menambah total aset.</span>
        </div>
      </section>

      ${formOpen
        ? html`
            <form className="grid gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800" onSubmit=${submit}>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  aria-pressed=${actionType === "assign"}
                  onClick=${() => setActionType("assign")}
                  className=${`min-h-10 rounded-lg border px-3 text-xs font-black ${actionType === "assign" ? "border-emerald-500 bg-emerald-500/15 text-emerald-500" : "border-slate-300 text-slate-500 dark:border-slate-700"}`}
                >
                  Alokasikan
                </button>
                <button
                  type="button"
                  aria-pressed=${actionType === "release"}
                  onClick=${() => setActionType("release")}
                  className=${`min-h-10 rounded-lg border px-3 text-xs font-black ${actionType === "release" ? "border-sky-500 bg-sky-500/15 text-sky-500" : "border-slate-300 text-slate-500 dark:border-slate-700"}`}
                >
                  Batalkan alokasi
                </button>
              </div>
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Sumber dana</span>
                <select
                  required
                  value=${accountId}
                  onChange=${(event) => setAccountId(event.target.value)}
                  className="cs-entry-input min-h-11 w-full rounded-lg px-3 text-sm"
                >
                  <option value="">Pilih sumber ${goal.currency}</option>
                  ${accountOptions.map(
                    (account) => html`
                      <option key=${account.id} value=${account.id}>
                        ${account.name} — ${actionType === "release"
                          ? `dialokasikan ${formatCurrency(account.allocatedAmount, account.currency)}`
                          : `tersedia ${formatCurrency(account.availableBalance, account.currency)}`}
                      </option>
                    `,
                  )}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Nominal</span>
                <input
                  required
                  inputMode="decimal"
                  value=${amount}
                  onChange=${(event) => setAmount(formatNumericInput(event.target.value))}
                  placeholder="0"
                  className="cs-entry-input min-h-11 w-full rounded-lg px-3 text-sm"
                />
              </label>
              <button
                type="submit"
                disabled=${loading || !accountId || !normalizeNumericInput(amount)}
                className="min-h-11 rounded-lg bg-emerald-500 px-3 text-xs font-black text-white disabled:opacity-50"
              >
                ${loading ? "Menyimpan..." : actionType === "release" ? "Batalkan alokasi" : "Tambah saldo tabungan"}
              </button>
            </form>
          `
        : html`
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick=${() => {
                  setActionType("assign");
                  setFormOpen(true);
                }}
                className="min-h-11 rounded-lg bg-emerald-500 px-3 text-xs font-black text-white"
              >
                Tambah saldo
              </button>
              <button
                type="button"
                onClick=${() => onUse?.(goal)}
                disabled=${mappedAvailableAmount <= 0.0001}
                className="min-h-11 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 text-xs font-black text-cyan-700 disabled:cursor-not-allowed disabled:opacity-40 dark:text-cyan-200"
              >
                Gunakan tabungan
              </button>
              <button
                type="button"
                onClick=${() => {
                  setActionType("release");
                  setFormOpen(true);
                }}
                disabled=${mappedAvailableAmount <= 0.0001}
                className="min-h-11 rounded-lg border border-slate-300 px-3 text-xs font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"
              >
                Batalkan alokasi
              </button>
              <button
                type="button"
                onClick=${() => onDelete(goal)}
                aria-label=${`Hapus ${goal.name}`}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-rose-500/10 px-3 text-xs font-black text-rose-500"
              >
                <${Trash2} aria-hidden="true" className="h-4 w-4" />
                Hapus
              </button>
            </div>
            ${mappedAvailableAmount <= 0.0001 && goal.hasUnmappedFunding
              ? html`
                  <p className="rounded-lg border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-[10px] leading-4 text-amber-700 dark:text-amber-200">
                    Saldo lama belum terhubung ke dompet sumber, sehingga belum aman dipakai untuk transaksi. Tambah Saldo hanya untuk dana baru dan tidak perlu memasukkan ulang nominal lama.
                  </p>
                `
              : null}
          `}
    </div>
  `;
}

export function WalletAccountsPage({
  metrics,
  transactions = [],
  baseCurrency = DEFAULT_BASE_CURRENCY,
  loading = false,
  onCreatePocket,
  onDeleteAccount,
  onSetPrimaryAccount,
  onDeleteGoal,
  onContributeGoal,
  onUseGoal,
  onSelectAccountCurrency,
}) {
  const accounts = metrics.assetAccountInsights || [];
  const goals = (metrics.goalInsights || []).filter(
    (goal) => goal.status !== "archived",
  );
  const normalizedBaseCurrency = normalizeCurrencyCode(baseCurrency);
  const [filter, setFilter] = useState("all");
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || null);
  const [selectedGoalId, setSelectedGoalId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [accountColors, setAccountColors] = useState(readWalletColorPreferences);

  useEffect(() => {
    if (!accounts.length) {
      setSelectedAccountId(null);
      return;
    }
    if (!accounts.some((account) => account.id === selectedAccountId)) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts.map((account) => account.id).join("|"), selectedAccountId]);

  useEffect(() => {
    if (
      selectedGoalId &&
      !goals.some((goal) => goal.id === selectedGoalId)
    ) {
      setSelectedGoalId(null);
    }
  }, [goals.map((goal) => goal.id).join("|"), selectedGoalId]);

  const selectedAccount = accounts.find((account) => account.id === selectedAccountId) || accounts[0] || null;
  const selectedGoal = goals.find((goal) => goal.id === selectedGoalId) || null;
  const selectedTransactions = useMemo(() => {
    if (!selectedAccount?.id) return [];
    return transactions
      .filter((transaction) => transactionBelongsToAccount(transaction, selectedAccount.id))
      .sort((left, right) => new Date(right.occurred_at).getTime() - new Date(left.occurred_at).getTime())
      .slice(0, 7);
  }, [transactions, selectedAccount?.id]);

  const detailAccount = detail?.type === "account"
    ? accounts.find((account) => account.id === detail.id)
    : null;
  const detailGoal = detail?.type === "goal"
    ? goals.find((goal) => goal.id === detail.id)
    : null;
  const allocatedBase = Number(
    metrics.goalAllocationSummaries?.[normalizedBaseCurrency]?.allocatedAmount || 0,
  );

  function handleSetAccountColor(accountId, colorId) {
    setAccountColors((current) => {
      const next = { ...current, [accountId]: colorId };
      try {
        window.localStorage.setItem(WALLET_COLOR_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // The preference remains active for this session when storage is unavailable.
      }
      return next;
    });
  }

  function selectAccount(account) {
    setSelectedAccountId(account.id);
    setSelectedGoalId(null);
    onSelectAccountCurrency?.(account.currency);
  }

  function manageAccount(account) {
    setDetail({ type: "account", id: account.id });
  }

  function selectGoal(goal) {
    setSelectedGoalId(goal.id);
  }

  function manageGoal(goal) {
    setDetail({ type: "goal", id: goal.id });
  }

  return html`
    <div className="cs-wallet-page grid w-full min-w-0 max-w-full gap-4">
      <section className="cs-wallet-summary relative min-w-0 overflow-hidden rounded-lg p-4">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[9px] font-extrabold uppercase text-emerald-300">
              Total saldo aktual (${normalizedBaseCurrency})
            </p>
            <h1 className="mt-1 truncate font-display text-2xl font-black tabular-nums text-white">
              ${formatCurrency(metrics.assetAccountTotalValueIdr || 0, normalizedBaseCurrency)}
            </h1>
            <p className="mt-1 text-[10px] font-medium text-slate-300">
              ${accounts.length} dompet • ${goals.length} tabungan${allocatedBase > 0
                ? ` • ${formatCurrency(allocatedBase, normalizedBaseCurrency)} dialokasikan`
                : ""}
            </p>
          </div>

          <div className="relative flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick=${onCreatePocket}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3 text-[10px] font-black text-white shadow-[0_10px_24px_rgba(16,185,129,0.25)] transition hover:bg-emerald-400"
            >
              <${Plus} aria-hidden="true" className="h-4 w-4" />
              Tambah
            </button>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter Dompet dan Tabungan">
        ${[
          ["all", "Semua", accounts.length + goals.length],
          ["pay", "Dompet", accounts.length],
          ["saving", "Tabungan", goals.length],
        ].map(
          ([value, label, count]) => html`
            <button
              key=${value}
              type="button"
              aria-pressed=${filter === value}
              onClick=${() => setFilter(value)}
              className=${`cs-pocket-filter min-h-10 rounded-lg px-3 text-[10px] font-black ${filter === value ? "is-active" : ""}`}
            >
              ${label} <span className="ml-1 rounded-md bg-slate-500/10 px-1.5 py-0.5">${count}</span>
            </button>
          `,
        )}
      </div>

      <section className="min-w-0">
        <div className="cs-pocket-grid grid min-w-0 grid-cols-2 gap-2.5 xl:grid-cols-3">
          ${filter === "all" || filter === "pay"
            ? accounts.map(
                (account, index) => html`
                  <${AccountCard}
                    key=${account.id}
                    account=${account}
                    baseCurrency=${normalizedBaseCurrency}
                    selected=${!selectedGoal && account.id === selectedAccount?.id}
                    accent=${getWalletColor(accountColors, account, index)}
                    onSelect=${() => selectAccount(account)}
                    onManage=${() => manageAccount(account)}
                  />
                `,
              )
            : null}
          ${filter === "all" || filter === "saving"
            ? goals.map(
                (goal) => html`
                  <${GoalCard}
                    key=${goal.id}
                    goal=${goal}
                    selected=${selectedGoal?.id === goal.id}
                    onSelect=${() => selectGoal(goal)}
                    onManage=${() => manageGoal(goal)}
                  />
                `,
              )
            : null}
          <${CreatePocketTile} onClick=${onCreatePocket} />
        </div>
      </section>

      ${selectedGoal
        ? html`<${GoalActivity} goal=${selectedGoal} />`
        : selectedAccount
          ? html`<${AccountActivity} account=${selectedAccount} transactions=${selectedTransactions} />`
          : null}

      <${SheetShell}
        open=${Boolean(detailAccount || detailGoal)}
        title=${detailGoal?.name || detailAccount?.name || "Rincian Dompet"}
        helper=${detailGoal
          ? "Lihat progres tabungan dan asal dana yang dialokasikan."
          : detailAccount
            ? "Saldo aktual tetap berada pada sumber dana ini."
            : ""}
        onClose=${() => setDetail(null)}
        labelledBy="wallet-pocket-detail-title"
      >
        ${detailAccount
          ? html`
              <${AccountDetail}
                account=${detailAccount}
                goals=${goals}
                accent=${getWalletColor(
                  accountColors,
                  detailAccount,
                  accounts.findIndex((account) => account.id === detailAccount.id),
                )}
                onSetAccent=${(colorId) => handleSetAccountColor(detailAccount.id, colorId)}
                onSetPrimary=${onSetPrimaryAccount}
                onDelete=${onDeleteAccount}
              />
            `
          : null}
        ${detailGoal
          ? html`
              <${GoalDetail}
                key=${detailGoal.id}
                goal=${detailGoal}
                accounts=${accounts}
                loading=${loading}
                onContribute=${onContributeGoal}
                onDelete=${onDeleteGoal}
                onUse=${onUseGoal}
              />
            `
          : null}
      <//>
    </div>
  `;
}
