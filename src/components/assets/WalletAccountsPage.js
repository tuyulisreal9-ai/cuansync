import React, {
  useEffect,
  useMemo,
  useState,
} from "https://esm.sh/react@18.3.1";
import htm from "https://esm.sh/htm@3.1.1";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Building2,
  MoreHorizontal,
  Palette,
  Plus,
  Repeat2,
  Target,
  Trash2,
  WalletCards,
} from "https://esm.sh/lucide-react@0.468.0?deps=react@18.3.1";
import {
  getTransactionAccountActivity,
  getTransactionFlow,
  transactionBelongsToAccount,
} from "../../domain/transactions.js";
import {
  DEFAULT_BASE_CURRENCY,
  formatCurrency,
  normalizeCurrencyCode,
} from "../../lib/currency.js";
import { formatShortDateTime } from "../../lib/dates.js";
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

function AccountCard({
  account,
  baseCurrency,
  selected,
  onSelect,
  onDelete,
  accent,
  paletteOpen,
  onTogglePalette,
  onSetAccent,
}) {
  const Icon = getAccountIcon(account.account_type);
  const valuation = getWalletValuation(account, baseCurrency);

  return html`
    <article
      className=${`cs-wallet-account rounded-lg ${selected ? "is-selected" : ""}`}
      style=${{
        "--wallet-accent": accent.accent,
        "--wallet-accent-soft": accent.soft,
      }}
    >
      <button
        type="button"
        onClick=${onSelect}
        aria-pressed=${selected}
        className="w-full min-w-0 p-3 text-left"
      >
        <span className="grid min-w-0 grid-cols-[40px_minmax(0,1fr)_3.5rem] items-start gap-3">
          <span className="cs-wallet-account-icon flex h-10 w-10 items-center justify-center rounded-lg">
            <${Icon} aria-hidden="true" className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="flex min-w-0 items-center gap-2">
              <strong className="font-display truncate text-sm font-extrabold text-slate-950 dark:text-white">
                ${account.name}
              </strong>
              <span className="shrink-0 text-[9px] font-extrabold text-emerald-500">
                ${account.currency}
              </span>
            </span>
            <span className="mt-1 block truncate text-[10px] font-medium text-slate-500 dark:text-slate-400">
              ${account.note || account.typeLabel}
            </span>
          </span>
          <span aria-hidden="true"></span>
        </span>

        <span className="mt-3 block border-t border-slate-200/70 pt-3 dark:border-slate-800">
          <span className="block text-[9px] font-bold uppercase text-slate-500 dark:text-slate-400">
            Saldo akun
          </span>
          <strong className="font-display mt-1 block truncate text-base font-black tabular-nums text-slate-950 dark:text-white">
            ${formatCurrency(account.balanceAmount, account.currency)}
          </strong>
          ${valuation
            ? html`
                <span className="cs-wallet-valuation mt-1 block truncate text-[10px] font-bold">
                  ${valuation}
                </span>
              `
            : null}
        </span>
      </button>

      <div className="cs-wallet-account-actions absolute right-2.5 top-2.5 z-10 flex items-center gap-1">
        <button
          type="button"
          onClick=${onTogglePalette}
          aria-label=${`Ubah warna ${account.name}`}
          aria-expanded=${paletteOpen}
          title="Ubah warna dompet"
          className="cs-wallet-accent-button inline-flex h-8 min-h-8 w-8 items-center justify-center rounded-md transition hover:bg-white/10"
        >
          <${Palette} aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick=${() => onDelete(account)}
          aria-label=${`Hapus ${account.name}`}
          title="Hapus akun"
          className="cs-wallet-delete inline-flex h-8 min-h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-400"
        >
          <${Trash2} aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      </div>

      ${paletteOpen
        ? html`
            <div className="border-t border-slate-200/70 px-3 pb-3 pt-2.5 dark:border-slate-800">
              <div className="flex items-center gap-2" aria-label="Pilihan warna dompet">
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
          `
        : null}
    </article>
  `;
}

function ActivityRow({
  transaction,
  accountId,
}) {
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

function AccountActivity({
  account,
  transactions,
}) {
  return html`
    <section className="cs-wallet-activity min-w-0 rounded-lg p-3.5">
      <div className="flex min-w-0 items-start justify-between gap-3 border-b border-slate-200/70 pb-3 dark:border-slate-800">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-sm font-extrabold text-slate-950 dark:text-white">
              Aktivitas ${account.name}
            </h2>
            <span className="shrink-0 rounded-md bg-emerald-500/10 px-2 py-1 text-[9px] font-extrabold text-emerald-500">
              ${account.currency}
            </span>
          </div>
          <p className="mt-1 truncate text-[10px] text-slate-500 dark:text-slate-400">
            Transaksi terbaru dari akun ini
          </p>
        </div>
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
            <div className="flex min-h-28 flex-col items-center justify-center px-4 text-center">
              <${WalletCards} aria-hidden="true" className="h-5 w-5 text-slate-400" />
              <p className="mt-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                Belum ada aktivitas
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Transaksi akun ini akan muncul di sini.
              </p>
            </div>
          `}
    </section>
  `;
}

export function WalletAccountsPage({
  metrics,
  transactions = [],
  baseCurrency = DEFAULT_BASE_CURRENCY,
  onAddAccount,
  onDeleteAccount,
  onOpenGoals,
  onOpenReport,
  onSelectAccountCurrency,
}) {
  const accounts = metrics.assetAccountInsights || [];
  const normalizedBaseCurrency = normalizeCurrencyCode(baseCurrency);
  const [selectedAccountId, setSelectedAccountId] = useState(
    accounts[0]?.id || null,
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountColors, setAccountColors] = useState(readWalletColorPreferences);
  const [paletteAccountId, setPaletteAccountId] = useState(null);

  useEffect(() => {
    if (!accounts.length) {
      setSelectedAccountId(null);
      return;
    }
    if (!accounts.some((account) => account.id === selectedAccountId)) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts.map((account) => account.id).join("|"), selectedAccountId]);

  const selectedAccount =
    accounts.find((account) => account.id === selectedAccountId) ||
    accounts[0] ||
    null;
  const selectedTransactions = useMemo(() => {
    if (!selectedAccount?.id) return [];
    return transactions
      .filter((transaction) =>
        transactionBelongsToAccount(transaction, selectedAccount.id),
      )
      .sort(
        (left, right) =>
          new Date(right.occurred_at).getTime() -
          new Date(left.occurred_at).getTime(),
      )
      .slice(0, 7);
  }, [transactions, selectedAccount?.id]);

  const handleSetAccountColor = (accountId, colorId) => {
    setAccountColors((current) => {
      const next = { ...current, [accountId]: colorId };
      try {
        window.localStorage.setItem(WALLET_COLOR_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // The visual preference can remain for this session if storage is unavailable.
      }
      return next;
    });
    setPaletteAccountId(null);
  };

  function selectAccount(account) {
    setSelectedAccountId(account.id);
    onSelectAccountCurrency?.(account.currency);
  }

  return html`
    <div className="cs-wallet-page grid w-full min-w-0 max-w-full gap-4">
      <section className="cs-wallet-summary relative min-w-0 overflow-hidden rounded-lg p-4">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[9px] font-extrabold uppercase text-emerald-300">
              Total nilai aset (${normalizedBaseCurrency})
            </p>
            <h1 className="mt-2 truncate font-display text-2xl font-black tabular-nums text-white">
              ${formatCurrency(
                metrics.assetAccountTotalValueIdr || 0,
                normalizedBaseCurrency,
              )}
            </h1>
            <p className="mt-1 text-[10px] font-medium text-slate-300">
              ${accounts.length} akun dan dompet
            </p>
          </div>

          <div className="relative flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick=${onAddAccount}
              aria-label="Tambah dompet"
              title="Tambah dompet"
              className="inline-flex h-10 min-h-10 w-10 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-[0_10px_24px_rgba(16,185,129,0.25)] transition hover:bg-emerald-400"
            >
              <${Plus} aria-hidden="true" className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick=${() => setMenuOpen((current) => !current)}
              aria-label="Menu dompet"
              aria-expanded=${menuOpen}
              className="inline-flex h-10 min-h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.07] text-slate-300 transition hover:bg-white/[0.12] hover:text-white"
            >
              <${MoreHorizontal} aria-hidden="true" className="h-5 w-5" />
            </button>

            ${menuOpen
              ? html`
                  <div className="cs-wallet-menu absolute right-0 top-12 z-20 w-44 rounded-lg p-1.5">
                    <button
                      type="button"
                      onClick=${() => {
                        setMenuOpen(false);
                        onOpenGoals();
                      }}
                      className="flex min-h-10 w-full items-center gap-2 rounded-md px-3 text-left text-xs font-bold text-slate-700 transition hover:bg-emerald-500/10 dark:text-slate-200"
                    >
                      <${Target} aria-hidden="true" className="h-4 w-4 text-emerald-500" />
                      Target dana
                    </button>
                    <button
                      type="button"
                      onClick=${() => {
                        setMenuOpen(false);
                        onOpenReport();
                      }}
                      className="flex min-h-10 w-full items-center gap-2 rounded-md px-3 text-left text-xs font-bold text-slate-700 transition hover:bg-emerald-500/10 dark:text-slate-200"
                    >
                      <${WalletCards} aria-hidden="true" className="h-4 w-4 text-sky-500" />
                      Laporan bulanan
                    </button>
                  </div>
                `
              : null}
          </div>
        </div>
      </section>

      <section className="min-w-0">
        <div className="mb-2 flex items-center justify-between gap-3 px-1">
          <h2 className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400">
            Daftar akun (${accounts.length})
          </h2>
          ${selectedAccount
            ? html`
                <span className="text-[10px] font-bold text-emerald-500">
                  ${selectedAccount.name} dipilih
                </span>
              `
            : null}
        </div>

        ${accounts.length
          ? html`
              <div className="grid min-w-0 gap-2.5">
                ${accounts.map(
                  (account, index) => html`
                    <${AccountCard}
                      key=${account.id}
                      account=${account}
                      baseCurrency=${normalizedBaseCurrency}
                      selected=${account.id === selectedAccount?.id}
                      accent=${getWalletColor(accountColors, account, index)}
                      paletteOpen=${paletteAccountId === account.id}
                      onSelect=${() => selectAccount(account)}
                      onTogglePalette=${() =>
                        setPaletteAccountId((current) =>
                          current === account.id ? null : account.id,
                        )}
                      onSetAccent=${(colorId) =>
                        handleSetAccountColor(account.id, colorId)}
                      onDelete=${onDeleteAccount}
                    />
                  `,
                )}
              </div>
            `
          : html`
              <button
                type="button"
                onClick=${onAddAccount}
                className="cs-wallet-empty flex min-h-32 w-full flex-col items-center justify-center rounded-lg p-4 text-center"
              >
                <${WalletCards} aria-hidden="true" className="h-6 w-6 text-emerald-500" />
                <strong className="mt-2 text-sm text-slate-950 dark:text-white">
                  Tambah dompet pertama
                </strong>
                <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Bank, wallet, atau uang tunai.
                </span>
              </button>
            `}
      </section>

      ${selectedAccount
        ? html`
            <${AccountActivity}
              account=${selectedAccount}
              transactions=${selectedTransactions}
            />
          `
        : null}
    </div>
  `;
}
