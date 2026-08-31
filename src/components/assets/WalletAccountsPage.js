import React, { useEffect, useState } from "react";
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
  ShieldCheck,
  Star,
  Target,
  Trash2,
  WalletCards,
} from "lucide-react";
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
      ? `Tersimpan di ${source.accountName} +${sourceCount - 1}`
      : `Tersimpan di ${source.accountName}`;
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
  const balanceAmount = Number(account.balanceAmount || 0);
  const availableBalance = Number(
    account.availableBalance ?? account.balanceAmount ?? 0,
  );
  const hasReservedBalance = reservedBalance > 0.0001;
  const fullyReserved = hasReservedBalance && availableBalance <= 0.0001;

  // Baris kanan: angka utama adalah dana yang bisa dipakai ketika ada
  // pencadangan, dengan saldo rekening sebagai keterangan kecil. Prinsipnya
  // tidak berubah, hanya letaknya yang mengikuti tata letak daftar.
  const subLabel = hasReservedBalance
    ? `dari ${formatCurrency(balanceAmount, account.currency)}`
    : valuation || `${account.typeLabel} · ${account.currency}`;

  return html`
    <div className=${`dc-row flex items-center gap-[13px] px-4 py-[15px] ${selected ? "bg-[color:var(--cs-soft)]" : ""}`}>
      <button
        type="button"
        onClick=${onSelect}
        aria-pressed=${selected}
        aria-label=${`Lihat mutasi ${account.name}`}
        className="flex min-w-0 flex-1 items-center gap-[13px] text-left"
      >
        <span
          className="dc-chip flex h-[38px] w-[38px] shrink-0 items-center justify-center"
          style=${accent ? { background: accent.soft } : undefined}
        >
          <${Icon}
            aria-hidden="true"
            className="h-[19px] w-[19px]"
            style=${{ color: accent ? accent.accent : "var(--cs-body)" }}
            strokeWidth=${1.8}
          />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm font-medium">${account.name}</span>
            ${account.isPrimary
              ? html`<${Star}
                  aria-hidden="true"
                  className="h-3 w-3 shrink-0"
                  style=${{ color: "var(--cs-warn)", fill: "var(--cs-warn)" }}
                />`
              : null}
          </span>
          <span className="truncate text-xs text-[color:var(--cs-mut)]">
            ${hasReservedBalance ? "Bisa dipakai" : account.typeLabel}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5">
          <span className=${`dc-num text-[13.5px] ${fullyReserved ? "text-[color:var(--cs-mut)]" : ""}`}>
            ${formatCurrency(
              hasReservedBalance ? availableBalance : balanceAmount,
              account.currency,
            )}
          </span>
          <span className="text-[11px] text-[color:var(--cs-mut)]">${subLabel}</span>
        </span>
      </button>
      <button
        type="button"
        onClick=${onManage}
        aria-label=${`Kelola ${account.name}`}
        title=${`Kelola ${account.name}`}
        className="cs-pocket-manage -mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style=${{ color: "var(--cs-faint)" }}
      >
        <${MoreHorizontal} aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  `;
}

function GoalCard({ goal, selected, onSelect, onManage }) {
  const progress = Math.max(0, Math.min(Number(goal.progress || 0), 1));
  return html`
    <article className=${`dc-card relative p-[18px] ${selected ? "ring-1 ring-[color:var(--cs-acc)]" : ""}`}>
      <button
        type="button"
        onClick=${onSelect}
        aria-pressed=${selected}
        aria-label=${`Lihat aktivitas ${goal.name}`}
        className="flex w-full flex-col gap-3.5 text-left"
      >
        <span className="flex items-baseline justify-between gap-3 pr-7">
          <span className="truncate text-[15px] font-bold">${goal.name}</span>
          <span className="shrink-0 text-xs text-[color:var(--cs-mut)]">
            target ${formatCurrency(goal.targetAmount || 0, goal.currency)}
          </span>
        </span>

        <span className="flex flex-col gap-2">
          <span className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="text-[color:var(--cs-body)]">
              Terkumpul ${formatCurrency(goal.availableAmount || 0, goal.currency)}
            </span>
            <span className="shrink-0 font-bold">${formatPercent(progress)}</span>
          </span>
          <span className="dc-track h-2.5">
            <span style=${{ width: `${progress * 100}%` }}></span>
          </span>
          <span className="block text-xs leading-[1.45] text-[color:var(--cs-mut)]">
            ${getGoalSourceLabel(goal)}. Dana ini bagian dari saldo dompet, bukan saldo tambahan.
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick=${onManage}
        aria-label=${`Kelola ${goal.name}`}
        title=${`Kelola ${goal.name}`}
        className="cs-pocket-manage absolute right-2.5 top-2.5 z-10 flex h-9 w-9 items-center justify-center rounded-xl"
        style=${{ color: "var(--cs-faint)" }}
      >
        <${MoreHorizontal} aria-hidden="true" className="h-4 w-4" />
      </button>
    </article>
  `;
}

function GoalFundSection({ goals, selectedGoalId, onSelect, onManage }) {
  return html`
    <section className="flex min-w-0 flex-col gap-2.5">
      <div className="flex min-w-0 items-baseline justify-between gap-3 px-0.5">
        <h2 className="text-[15px] font-bold">Tabungan</h2>
        <span className="shrink-0 text-xs text-[color:var(--cs-mut)]">
          ${goals.length} tujuan
        </span>
      </div>
      <div className="flex min-w-0 flex-col gap-2.5">
        ${goals.map(
          (goal) => html`
            <${GoalCard}
              key=${goal.id}
              goal=${goal}
              selected=${selectedGoalId === goal.id}
              onSelect=${() => onSelect(goal)}
              onManage=${() => onManage(goal)}
            />
          `,
        )}
      </div>
    </section>
  `;
}

/* Dua tombol terpisah menggantikan satu tile "Tambah Baru" yang dulu membuka
   sheet pemilih. Tujuannya memangkas satu langkah penuh: dulu tile -> sheet
   pemilih -> form, sekarang langsung ke formnya. */
function CreatePocketActions({ onAddWallet, onAddGoal }) {
  const tile = (label, Icon, onClick) => html`
    <button
      key=${label}
      type="button"
      onClick=${onClick}
      className="dc-tile dc-tile-action dc-press dc-press-96 flex min-h-14 items-center justify-center gap-2 px-3"
    >
      <${Icon}
        aria-hidden="true"
        className="h-[18px] w-[18px] shrink-0"
        style=${{ color: "var(--cs-body)" }}
        strokeWidth=${1.75}
      />
      <span className="text-[13px] font-medium">${label}</span>
    </button>
  `;

  return html`
    <div className="grid grid-cols-2 gap-2">
      ${tile("Tambah dompet", WalletCards, onAddWallet)}
      ${tile("Tambah tabungan", Target, onAddGoal)}
    </div>
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
            ${formatCurrency(
              Number(account.reservedBalance || 0) > 0.0001
                ? account.availableBalance
                : account.balanceAmount,
              account.currency,
            )}
          </p>
          ${Number(account.reservedBalance || 0) > 0.0001
            ? html`<p className="mt-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">Bisa dipakai • Saldo rekening ${formatCurrency(account.balanceAmount, account.currency)}</p>`
            : null}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-100/80 p-3 dark:bg-slate-900/70">
        <div className="min-w-0">
          <span className="block text-[8px] font-black uppercase text-slate-500 dark:text-slate-400">Saldo aktual</span>
          <strong className="mt-1 block truncate text-[11px] tabular-nums">${formatCurrency(account.balanceAmount, account.currency)}</strong>
        </div>
        <div className="min-w-0">
          <span className="block text-[8px] font-black uppercase text-slate-500 dark:text-slate-400">Dicadangkan</span>
          <strong className="mt-1 block truncate text-[11px] tabular-nums text-amber-500">${formatCurrency(account.reservedBalance || 0, account.currency)}</strong>
        </div>
        <div className="min-w-0">
          <span className="block text-[8px] font-black uppercase text-slate-500 dark:text-slate-400">Bisa dipakai</span>
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
          onClick=${() =>
            onSetPrimary(account, "expense", { clear: Boolean(account.isPrimary) })}
          title=${account.isPrimary
            ? `Lepas ${account.name} dari akun utama pengeluaran ${account.currency}`
            : `Jadikan ${account.name} akun utama pengeluaran ${account.currency}`}
          className=${`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-xs font-black ${account.isPrimary ? "bg-amber-500/15 text-amber-500" : "bg-emerald-500 text-white"}`}
        >
          <${Star} aria-hidden="true" className=${`h-4 w-4 ${account.isPrimary ? "fill-amber-500" : ""}`} />
          ${account.isPrimary ? "Lepas dari utama" : "Jadikan utama"}
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

function GoalDetail({
  goal,
  goals = [],
  accounts,
  loading,
  onContribute,
  onDelete,
  onUse,
  onEdit,
  onArchive,
  onMove,
}) {
  const [actionType, setActionType] = useState("assign");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [destinationGoalId, setDestinationGoalId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  // Pindah alokasi hanya masuk akal ke tabungan lain dengan mata uang sama.
  const otherGoals = goals.filter(
    (item) => item.id !== goal.id && item.currency === goal.currency,
  );
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
    setDestinationGoalId(otherGoals[0]?.id || "");
  }, [goal.id, actionType, formOpen]);

  async function submit(event) {
    event.preventDefault();
    const value = normalizeNumericInput(amount);
    const ok =
      actionType === "move"
        ? await onMove?.(
            goal,
            otherGoals.find((item) => item.id === destinationGoalId),
            value,
            accountId,
          )
        : await onContribute(
            goal,
            value,
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
              ${actionType === "move"
                ? html`
                    <label className="block">
                      <span className="mb-1.5 block text-[10px] font-bold uppercase text-[color:var(--cs-mut)]">
                        Pindahkan ke
                      </span>
                      <select
                        required
                        value=${destinationGoalId}
                        onChange=${(event) => setDestinationGoalId(event.target.value)}
                        className="cs-entry-input min-h-11 w-full rounded-xl px-3 text-sm"
                      >
                        <option value="">Pilih tabungan tujuan</option>
                        ${otherGoals.map(
                          (item) => html`
                            <option key=${item.id} value=${item.id}>${item.name}</option>
                          `,
                        )}
                      </select>
                    </label>
                  `
                : null}
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
                disabled=${loading ||
                !accountId ||
                !normalizeNumericInput(amount) ||
                (actionType === "move" && !destinationGoalId)}
                className="min-h-11 rounded-xl px-3 text-xs font-bold disabled:opacity-50"
                style=${{ background: "var(--cs-acc)", color: "var(--cs-on-acc)" }}
              >
                ${loading
                  ? "Menyimpan..."
                  : actionType === "move"
                    ? "Pindahkan alokasi"
                    : actionType === "release"
                      ? "Batalkan alokasi"
                      : "Tambah saldo tabungan"}
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
                className="min-h-11 rounded-xl px-3 text-xs font-bold"
                style=${{ background: "var(--cs-acc)", color: "var(--cs-on-acc)" }}
              >
                Tambah saldo
              </button>
              <button
                type="button"
                onClick=${() => onUse?.(goal)}
                disabled=${mappedAvailableAmount <= 0.0001}
                className="min-h-11 rounded-xl border px-3 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40"
                style=${{ borderColor: "var(--cs-line)", color: "var(--cs-body)" }}
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
                className="min-h-11 rounded-xl border px-3 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40"
                style=${{ borderColor: "var(--cs-line)", color: "var(--cs-body)" }}
              >
                Batalkan alokasi
              </button>
              ${onMove && otherGoals.length
                ? html`
                    <button
                      type="button"
                      onClick=${() => {
                        setActionType("move");
                        setFormOpen(true);
                      }}
                      disabled=${mappedAvailableAmount <= 0.0001}
                      className="min-h-11 rounded-xl border px-3 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40"
                      style=${{ borderColor: "var(--cs-line)", color: "var(--cs-body)" }}
                    >
                      Pindah ke tabungan lain
                    </button>
                  `
                : null}
              ${onEdit
                ? html`
                    <button
                      type="button"
                      onClick=${() => onEdit(goal)}
                      className="min-h-11 rounded-xl border px-3 text-xs font-bold"
                      style=${{ borderColor: "var(--cs-line)", color: "var(--cs-body)" }}
                    >
                      Ubah target
                    </button>
                  `
                : null}
              ${onArchive
                ? html`
                    <button
                      type="button"
                      onClick=${() => onArchive(goal)}
                      className="min-h-11 rounded-xl border px-3 text-xs font-bold"
                      style=${{ borderColor: "var(--cs-line)", color: "var(--cs-mut)" }}
                    >
                      Arsipkan
                    </button>
                  `
                : null}
              <button
                type="button"
                onClick=${() => onDelete(goal)}
                aria-label=${`Hapus ${goal.name}`}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-xs font-bold"
                style=${{ background: "rgba(244,63,94,0.10)", color: "#e11d48" }}
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
  baseCurrency = DEFAULT_BASE_CURRENCY,
  loading = false,
  onCreateWallet,
  onCreateGoal,
  onDeleteAccount,
  onSetPrimaryAccount,
  onDeleteGoal,
  onContributeGoal,
  onUseGoal,
  onEditGoal,
  onArchiveGoal,
  onMoveGoalAllocation,
  onSelectAccountCurrency,
}) {
  const accounts = metrics.assetAccountInsights || [];
  const goals = (metrics.goalInsights || []).filter(
    (goal) => goal.status !== "archived",
  );
  const normalizedBaseCurrency = normalizeCurrencyCode(baseCurrency);
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
  const detailAccount = detail?.type === "account"
    ? accounts.find((account) => account.id === detail.id)
    : null;
  const detailGoal = detail?.type === "goal"
    ? goals.find((goal) => goal.id === detail.id)
    : null;
  const allocatedBase = Number(
    metrics.goalAllocationSummaries?.[normalizedBaseCurrency]?.allocatedAmount || 0,
  );
  const totalActualBase = Number(metrics.assetAccountTotalValueIdr || 0);
  const spendableBase = Number(metrics.availableBalanceIdr ?? totalActualBase);
  const reservedBase = Math.max(totalActualBase - spendableBase, 0);
  // Desain menampilkan Dompet dan Tabungan sebagai dua seksi yang selalu
  // terlihat, jadi filter tab tidak lagi diperlukan. Tabungan tetap berdiri
  // sebagai seksi turunan di bawah Dompet, bukan kartu sejajar.

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

  // Panel mutasi di bawah daftar sudah dihapus, jadi menekan baris kini
  // langsung membuka sheet rinciannya. Pemilihan mata uang dompet tetap
  // dijalankan karena header dan ringkasan lain bergantung padanya.
  function selectAccount(account) {
    setSelectedAccountId(account.id);
    setSelectedGoalId(null);
    onSelectAccountCurrency?.(account.currency);
    setDetail({ type: "account", id: account.id });
  }

  function manageAccount(account) {
    setDetail({ type: "account", id: account.id });
  }

  function selectGoal(goal) {
    setSelectedGoalId(goal.id);
    setDetail({ type: "goal", id: goal.id });
  }

  function manageGoal(goal) {
    setDetail({ type: "goal", id: goal.id });
  }

  return html`
    <div className="cs-wallet-page grid w-full min-w-0 max-w-full gap-3">
      <section className="dc-panel flex flex-col gap-[18px] p-[22px]">
        <div className="flex flex-col gap-[7px]">
          <span className="text-[13px] text-[#9c968b]">Semua uang yang kamu catat</span>
          <div className="flex items-end gap-1.5">
            <span className="pb-1.5 text-[19px] font-medium text-[#9c968b]">
              ${normalizedBaseCurrency === "IDR" ? "Rp" : normalizedBaseCurrency}
            </span>
            <span className="dc-num text-[32px] leading-none tracking-[-1.4px]">
              ${formatCurrency(totalActualBase, normalizedBaseCurrency).replace(/^[^\d-]*/, "")}
            </span>
          </div>
        </div>
        <div className="flex gap-2.5">
          <div className="dc-panel-tile flex flex-1 flex-col gap-[3px] px-3.5 py-3">
            <span className="text-[11px] text-[#9c968b]">Bisa dipakai</span>
            <span className="text-[15px] font-bold">
              ${formatCurrency(spendableBase, normalizedBaseCurrency)}
            </span>
          </div>
          <div className="dc-panel-tile flex flex-1 flex-col gap-[3px] px-3.5 py-3">
            <span className="text-[11px] text-[#9c968b]">Disisihkan</span>
            <span className="text-[15px] font-bold text-[color:var(--cs-pos)]">
              ${formatCurrency(reservedBase || allocatedBase, normalizedBaseCurrency)}
            </span>
          </div>
        </div>
      </section>

      <section className="flex min-w-0 flex-col gap-2.5">
        <div className="flex items-baseline justify-between gap-3 px-0.5">
          <span className="text-[15px] font-bold">Dompetmu</span>
          <span className="shrink-0 text-xs text-[color:var(--cs-mut)]">
            ${accounts.length} dompet
          </span>
        </div>
        ${accounts.length
          ? html`
              <div className="dc-card overflow-hidden">
                ${accounts.map(
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
                )}
              </div>
            `
          : null}
        <${CreatePocketActions}
          onAddWallet=${onCreateWallet}
          onAddGoal=${onCreateGoal}
        />
      </section>

      ${goals.length
        ? html`
            <${GoalFundSection}
              goals=${goals}
              selectedGoalId=${selectedGoal?.id || null}
              onSelect=${selectGoal}
              onManage=${manageGoal}
            />
          `
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
              ${/* Dibungkus fragment: dua elemen akar dalam satu template membuat
                    htm mengembalikan array, dan React lalu memperingatkan setiap
                    anaknya butuh "key". */ null}
              <${React.Fragment}>
                <${GoalDetail}
                  key=${detailGoal.id}
                  goal=${detailGoal}
                  goals=${goals}
                  accounts=${accounts}
                  loading=${loading}
                  onContribute=${onContributeGoal}
                  onDelete=${onDeleteGoal}
                  onUse=${onUseGoal}
                  onEdit=${onEditGoal}
                  onArchive=${onArchiveGoal}
                  onMove=${onMoveGoalAllocation}
                />
                <div className="mt-4">
                  <${GoalActivity} goal=${detailGoal} />
                </div>
              <//>
            `
          : null}
      <//>
    </div>
  `;
}
