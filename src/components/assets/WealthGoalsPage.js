import React, { useEffect, useState } from "react";
import htm from "htm";
import { Target, WalletCards } from "lucide-react";
import { CurrencyCombobox } from "../shared/CurrencyCombobox.js";
import { FormActionDock } from "../shared/FormActionDock.js";
import { SheetShell } from "../shared/SheetShell.js";
import { WalletAccountsPage } from "./WalletAccountsPage.js";
import {
  TargetForm,
} from "../budget/TargetPlanningSection.js";
import {
  ASSET_ACCOUNT_TYPES,
  getAssetAccountValuationLabel,
  getDefaultAssetAccountName,
} from "../../domain/assets.js";
import {
  getDefaultGoalFundingAccountId,
  getGoalFundingAccountOptions,
} from "../../domain/goals.js";
import {
  DEFAULT_ACTIVE_CURRENCIES,
  DEFAULT_BASE_CURRENCY,
  formatNumericInput,
  formatPercent,
  getCurrencyOptions,
  normalizeCurrencyList,
  normalizeNumericInput,
} from "../../lib/currency.js";
import { useMaskedCurrency } from "../../lib/balanceVisibility.js";
import { formatDateTime, getDateInputValue } from "../../lib/dates.js";

const html = htm.bind(React.createElement);
const PANEL_CLASS = "relative overflow-hidden rounded-[30px] cuan-card";
/* Input dan label mengikuti spec form di artifact: tinggi 48, radius 14,
   garis tepi --cs-line, latar --cs-card, teks 14.5px; label 12px --cs-mut. */
const INPUT_CLASS =
  "w-full min-h-12 rounded-[14px] border px-3.5 text-[14.5px] cs-edit-input";
const FIELD_LABEL_CLASS = "block px-0.5 text-xs cs-edit-label";
function GoalTracker({ goals, accounts = [], onDelete, onContribute }) {
  const money = useMaskedCurrency();
  const [openGoalId, setOpenGoalId] = useState(null);
  const [openAction, setOpenAction] = useState("deposit");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");

  function openContribution(goal, action) {
    const isClosing = openGoalId === goal.id && openAction === action;
    setOpenGoalId(isClosing ? null : goal.id);
    setOpenAction(action);
    setAmount("");
    setAccountId(
      isClosing
        ? ""
        : getDefaultGoalFundingAccountId({
            goal,
            type: action === "withdraw" ? "release" : "assign",
            accounts,
          }),
    );
  }

  function submitContribution(event, goal) {
    event.preventDefault();
    onContribute(
      goal,
      normalizeNumericInput(amount),
      openAction,
      accountId,
    ).then((ok) => {
      if (ok) {
        setAmount("");
        setAccountId("");
        setOpenGoalId(null);
        setOpenAction("deposit");
      }
    });
  }

  return html`
    <div className=${`${PANEL_CLASS} p-5 md:p-6`}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.14),transparent_50%)] opacity-80"></div>
      <div className="relative">
        <h3 className="font-display text-xl font-bold">Target Keuangan</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300/80">
          Daftar target yang sedang kamu kejar, dibuat ringkas agar nyaman dipantau di mobile.
        </p>
      </div>

      ${goals.length
        ? html`
            <div className="relative mt-5 grid gap-3">
              ${goals.map(
                (goal) => html`
                  <div
                    key=${goal.id}
                    className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 dark:bg-slate-900/40"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                          ${goal.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          ${goal.deadline
                            ? `Tenggat ${formatDateTime(`${goal.deadline}T00:00:00`)}`.replace(
                                ", 00:00",
                                "",
                              )
                            : "Tanpa tenggat tetap"}
                        </p>
                      </div>
                      <div className=${`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${goal.tone}`}>
                        ${goal.statusLabel}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        ${money(goal.savedAmount, "idr")}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Target ${money(goal.targetAmount, "idr")}
                      </p>
                    </div>

                    <div className="mt-3 h-2 rounded-full bg-slate-200/70 dark:bg-slate-800">
                      <div
                        className=${`h-full rounded-full bg-gradient-to-r ${goal.barClass}`}
                        style=${{ width: `${Math.max(goal.progress * 100, goal.savedAmount > 0 ? 8 : 0)}%` }}
                      ></div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                      <span>${formatPercent(goal.progress)} tercapai</span>
                      <span>Sisa ${money(goal.remainingIdr, "idr")}</span>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick=${() => openContribution(goal, "deposit")}
                        className="min-h-11 rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-black text-slate-700 backdrop-blur-xl transition hover:-translate-y-0.5 dark:bg-slate-900/40 dark:text-slate-200"
                      >
                        Setor
                      </button>
                      <button
                        type="button"
                        onClick=${() => openContribution(goal, "withdraw")}
                        className="min-h-11 rounded-2xl border border-sky-300/25 bg-sky-400/10 px-3 py-2 text-xs font-black text-sky-700 transition hover:-translate-y-0.5 dark:border-sky-400/20 dark:bg-sky-500/10 dark:text-sky-200"
                      >
                        Tarik
                      </button>
                      <button
                        type="button"
                        onClick=${() => onDelete(goal)}
                        className="min-h-11 rounded-2xl border border-rose-300/25 bg-rose-400/10 px-3 py-2 text-xs font-black text-rose-700 transition hover:-translate-y-0.5 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200"
                      >
                        Hapus
                      </button>
                    </div>

                    ${openGoalId === goal.id
                      ? (() => {
                          const accountOptions = getGoalFundingAccountOptions({
                            goal,
                            type: openAction === "withdraw" ? "release" : "assign",
                            accounts,
                          });
                          return html`
                          <form
                            className="mt-4 grid gap-3"
                            onSubmit=${(event) => submitContribution(event, goal)}
                          >
                            <select
                              required
                              value=${accountId}
                              onChange=${(event) => setAccountId(event.target.value)}
                              className=${INPUT_CLASS}
                            >
                              <option value="">Pilih rekening ${goal.currency}</option>
                              ${accountOptions.map(
                                (account) => html`
                                  <option key=${account.id} value=${account.id}>
                                    ${account.name} — ${openAction === "withdraw"
                                      ? `dialokasikan ${money(
                                          account.allocatedAmount,
                                          account.currency,
                                        )}`
                                      : `tersedia ${money(
                                          account.availableBalance,
                                          account.currency,
                                        )}`}
                                  </option>
                                `,
                              )}
                            </select>
                            <input
                              type="text"
                              inputMode="decimal"
                              autoComplete="off"
                              placeholder=${openAction === "withdraw"
                                ? "Jumlah tarik (IDR)"
                                : "Jumlah setor (IDR)"}
                              value=${amount}
                              onChange=${(event) =>
                                setAmount(formatNumericInput(event.target.value))}
                              className=${INPUT_CLASS}
                            />
                            <button
                              type="submit"
                              disabled=${!accountId || !amount}
                              className="rounded-2xl border border-white/10 bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-brand-700"
                            >
                              ${openAction === "withdraw" ? "Tarik" : "Setor"}
                            </button>
                          </form>
                        `;
                        })()
                      : null}
                  </div>
                `,
              )}
            </div>
          `
        : html`
            <div className="relative mt-5 rounded-2xl border border-dashed border-white/15 bg-white/5 p-5 text-sm text-slate-600 backdrop-blur-xl dark:bg-slate-900/25 dark:text-slate-300/80">
              Belum ada target keuangan. Tambahkan target pertama agar CUANSYNC bisa menghitung kemajuan dan sisa yang perlu dikejar.
            </div>
          `}
    </div>
  `;
}

function InvestmentSnapshot({
  metrics,
  activeSection = "accounts",
  onSelectSection,
  onAddAccount,
  onAddGoal,
}) {
  const accountCount = Number(metrics.assetAccountCount || 0);
  const activeGoalCount = metrics.goalInsights.filter(
    (goal) => goal.status !== "done",
  ).length;
  const currencyCount = Object.entries(metrics.assetAccountTotalsByCurrency || {})
    .filter(([, amount]) => Number(amount || 0) !== 0).length;
  const quickActions = [
    {
      label: "Tambah aset",
      helper: "Bank / cash",
      onClick: onAddAccount,
      primary: true,
    },
    {
      label: "Tambah target",
      helper: "Dana target",
      onClick: onAddGoal,
      primary: false,
    },
  ];
  const summaryItems = [
    {
      label: "Akun",
      value: String(accountCount),
    },
    {
      label: "Target",
      value: String(activeGoalCount),
    },
    {
      label: "Mata uang",
      value: String(currencyCount),
    },
  ];
  const sectionTabs = [
    { key: "accounts", label: "Akun" },
    { key: "goals", label: "Target" },
    { key: "report", label: "Laporan" },
  ];

  return html`
    <section className=${`${PANEL_CLASS} p-4 md:p-6`}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(16,185,129,0.14),transparent_46%)] opacity-80"></div>
      <div className="relative flex flex-col gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-brand-700 dark:text-brand-200">
            Keuangan
          </p>
          <h3 className="mt-2 font-display text-3xl font-black text-slate-950 dark:text-white">
            Akun, target, laporan
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300/80">
            Kelola tempat uang, target dana, dan ringkasan bulanan tanpa membuka semuanya sekaligus.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          ${quickActions.map(
            (action) => html`
              <button
                key=${action.label}
                type="button"
                onClick=${action.onClick}
                className=${`${action.primary ? "history-action-primary" : "history-action-secondary"} flex min-h-[4.75rem] min-w-0 flex-col items-center justify-center rounded-2xl px-2 py-3 text-center transition hover:-translate-y-0.5`}
              >
                <span className="text-xs font-black leading-4">${action.label}</span>
                <span className="mt-1 text-[10px] font-bold opacity-75">${action.helper}</span>
              </button>
            `,
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          ${summaryItems.map(
            (item) => html`
              <div
                key=${item.label}
                className="rounded-2xl border border-white/10 bg-white/10 px-3 py-3 backdrop-blur-xl dark:bg-slate-900/40"
              >
                <p className="truncate text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                  ${item.label}
                </p>
                <p className="mt-1 truncate text-sm font-black text-slate-950 dark:text-white md:text-base">
                  ${item.value}
                </p>
              </div>
            `,
          )}
        </div>

        <div className="cuan-segment grid grid-cols-3 gap-1 rounded-2xl p-1">
          ${sectionTabs.map(
          (item) => html`
            <button
              key=${item.key}
              type="button"
              onClick=${() => onSelectSection(item.key)}
              className=${`min-h-11 rounded-xl px-3 py-2 text-sm font-black transition ${
                activeSection === item.key
                  ? "bg-brand-600 text-white shadow-[0_14px_34px_rgba(16,185,129,0.20)] dark:bg-emerald-500"
                  : "text-slate-600 hover:bg-white/70 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-white"
              }`}
            >
              ${item.label}
            </button>
          `,
        )}
        </div>
      </div>
    </section>
  `;
}

function AssetAccountForm({
  onSubmit,
  loading,
  activeCurrencies = DEFAULT_ACTIVE_CURRENCIES,
  onCancel = null,
  onSuccess = null,
  embedded = false,
}) {
  const currencyOptions = getCurrencyOptions(
    normalizeCurrencyList([...activeCurrencies, ...DEFAULT_ACTIVE_CURRENCIES]),
  );
  const [form, setForm] = useState({
    name: "",
    account_type: "bank",
    account_purpose: "general",
    currency: currencyOptions[0]?.value || DEFAULT_BASE_CURRENCY,
    balance_amount: "",
    note: "",
  });
  const isCashAccount = form.account_type === "cash";
  const defaultAccountName = getDefaultAssetAccountName(form.account_type, form.currency);

  useEffect(() => {
    const availableCurrencies = currencyOptions.map((option) => option.value);
    if (!availableCurrencies.includes(form.currency)) {
      setForm((current) => ({
        ...current,
        currency: availableCurrencies[0] || DEFAULT_BASE_CURRENCY,
      }));
    }
  }, [currencyOptions.map((option) => option.value).join("|"), form.currency]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const ok = await onSubmit({
      ...form,
      balance_amount: normalizeNumericInput(form.balance_amount),
    });
    if (ok) {
      setForm({
        name: "",
        account_type: "bank",
        account_purpose: "general",
        currency: currencyOptions[0]?.value || DEFAULT_BASE_CURRENCY,
        balance_amount: "",
        note: "",
      });
      if (onSuccess) onSuccess();
    }
  }

  return html`
    <div
      id="asset-account-form"
      className=${embedded ? "grid gap-4" : `${PANEL_CLASS} scroll-mt-6 p-5 md:p-6`}
    >
      ${embedded
        ? null
        : html`
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(59,130,246,0.12),transparent_50%)] opacity-80"></div>
            <div className="relative">
              <h3 className="font-display text-xl font-bold">Tambah Aset</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300/80">
                Catat tempat dana disimpan, seperti cash, rekening, wallet, atau akun investasi.
              </p>
            </div>
          `}

      <form className=${embedded ? "grid gap-4" : "relative mt-5 grid gap-4"} onSubmit=${handleSubmit}>
        ${/* Jenis memakai chip, bukan <select>, supaya kelima pilihan terlihat
              sekaligus dan daftarnya tidak digambar oleh sistem operasi. */ null}
        <div className="block">
          <span className=${FIELD_LABEL_CLASS}>Jenis</span>
          <div className="flex flex-wrap gap-2">
            ${ASSET_ACCOUNT_TYPES.map((type) => {
              const active = form.account_type === type.value;
              return html`
                <button
                  key=${type.value}
                  type="button"
                  aria-pressed=${active}
                  onClick=${() => updateField("account_type", type.value)}
                  className="dc-press dc-press-96 flex min-h-[38px] items-center rounded-full border px-[15px] text-[12.5px] font-medium"
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
                  ${type.label}
                </button>
              `;
            })}
          </div>
        </div>

        <label className="block">
          <span className=${FIELD_LABEL_CLASS}>
            ${isCashAccount ? "Nama akun (opsional)" : "Nama akun"}
          </span>
          <input
            type="text"
            required=${!isCashAccount}
            value=${form.name}
            onChange=${(event) => updateField("name", event.target.value)}
            placeholder=${defaultAccountName}
            className=${INPUT_CLASS}
          />
        </label>

        ${/* "Peran akun" dan "Catatan" dihapus dari form tambah. Peran akun
              hanya dipakai menebak akun default, sedangkan pemilih dompet kini
              tampil eksplisit saat mencatat transaksi, jadi tebakannya tidak
              terpakai lagi. Nilainya tetap ditulis "general" di initialForm.
              Catatan tetap bisa diisi lewat pengaturan dompet. */ null}
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(7.5rem,0.6fr)] gap-2">
          <label className="block">
            <span className=${FIELD_LABEL_CLASS}>Saldo saat ini</span>
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value=${form.balance_amount}
              onChange=${(event) =>
                updateField("balance_amount", formatNumericInput(event.target.value))}
              placeholder="0"
              className=${INPUT_CLASS}
            />
          </label>

          <div className="block">
            <span className=${FIELD_LABEL_CLASS}>Mata uang</span>
            <${CurrencyCombobox}
              value=${form.currency}
              onChange=${(value) => updateField("currency", value)}
              currencies=${currencyOptions.map((option) => option.value)}
              ariaLabel="Mata uang dompet"
              buttonClassName=${INPUT_CLASS}
            />
          </div>
        </div>

        <${FormActionDock}>
          <div className=${onCancel ? "grid grid-cols-[0.78fr_1.22fr] gap-2" : ""}>
            ${onCancel
              ? html`
                  <button
                    type="button"
                    onClick=${onCancel}
                    className="history-action-secondary min-h-12 rounded-xl px-4 py-3 text-sm font-black transition hover:-translate-y-0.5"
                  >
                    Batal
                  </button>
                `
              : null}
            <button
              type="submit"
              disabled=${loading}
              className="history-action-primary min-h-12 w-full rounded-xl px-4 py-3 text-sm font-black transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Simpan akun
            </button>
          </div>
        <//>
      </form>
    </div>
  `;
}

function FinancialMonthlyPreview({ metrics, onOpenReport }) {
  const money = useMaskedCurrency();
  const netCashflow = Number(metrics.monthlyNetChangeIdr || 0);
  const netPositive = netCashflow >= 0;
  const income = Number(metrics.monthlyIncomeIdr || 0);
  const expense = Number(metrics.monthlyExpenseIdr || 0);
  const savedGoals = Number(metrics.totalGoalSaved || 0);
  const balance = Number(metrics.balanceIdr || 0);
  const previewItems = [
    {
      label: "Uang masuk",
      value: money(income, "idr"),
    },
    {
      label: "Uang keluar",
      value: money(expense, "idr"),
    },
    {
      label: "Dana target",
      value: money(savedGoals, "idr"),
    },
    {
      label: "Saldo tersedia",
      value: money(balance, "idr"),
    },
  ];

  return html`
    <section className=${`${PANEL_CLASS} p-5 md:p-6`}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(14,165,233,0.12),transparent_48%)] opacity-80"></div>
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-sky-700 dark:text-sky-200">
            Ringkasan Bulan Ini
          </p>
          <h3 className="mt-2 font-display text-2xl font-black text-slate-950 dark:text-white">
            ${netPositive ? "+" : "-"}${money(Math.abs(netCashflow), "idr")}
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300/80">
            ${netPositive
              ? "Arus kas bulan ini masih bertumbuh."
              : "Arus kas bulan ini sedang turun, cek detailnya pelan-pelan."}
          </p>
        </div>
        <button
          type="button"
          onClick=${onOpenReport}
          className="history-action-secondary inline-flex min-h-11 shrink-0 items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-black transition hover:-translate-y-0.5"
        >
          Selengkapnya
        </button>
      </div>

      <div className="relative mt-5 grid gap-3 sm:grid-cols-2">
        ${previewItems.map(
          (item) => html`
            <div
              key=${item.label}
              className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-xl dark:bg-slate-900/40"
            >
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                ${item.label}
              </p>
              <p className="mt-2 text-lg font-black text-slate-950 dark:text-white">
                ${item.value}
              </p>
            </div>
          `,
        )}
      </div>
    </section>
  `;
}

function AssetAccountsPanel({ metrics, onAddAccount, onDeleteAccount, baseCurrency }) {
  const money = useMaskedCurrency();
  const accounts = metrics.assetAccountInsights || [];
  const totals = Object.entries(metrics.assetAccountTotalsByCurrency || {}).filter(
    ([, amount]) => Number(amount || 0) !== 0,
  );
  const hasAccounts = accounts.length > 0;

  return html`
    <div className=${`${PANEL_CLASS} p-5 md:p-6`}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(14,165,233,0.12),transparent_46%)] opacity-80"></div>
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-sky-700 dark:text-sky-200">
            Akun Aset
          </p>
          <h3 className="mt-2 font-display text-2xl font-black text-slate-950 dark:text-white">
            Tempat Dana
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300/80">
            Kelola saldo per mata uang dari cash, rekening, wallet, dan akun lain.
          </p>
        </div>
        <button
          type="button"
          onClick=${onAddAccount}
          className="history-action-primary inline-flex min-h-11 shrink-0 items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-black transition hover:-translate-y-0.5"
        >
          Tambah Aset
        </button>
      </div>

      <div className="relative mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-xl dark:bg-slate-900/40">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Total akun
          </p>
          <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">
            ${accounts.length}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            Cash, rekening, wallet, dan investasi.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-xl dark:bg-slate-900/40 sm:col-span-1 lg:col-span-2">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Estimasi nilai
          </p>
          <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">
            ${money(metrics.assetAccountTotalValueIdr || 0, "idr")}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            Kurs global harian dari Exchange Rate API.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-xl dark:bg-slate-900/40">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Mata uang
          </p>
          <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">
            ${totals.length || 0}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            ${totals.length ? totals.map(([currency]) => currency).join(" + ") : "Belum ada saldo"}
          </p>
        </div>
      </div>

      <div className="relative mt-5 grid gap-3">
        ${hasAccounts
          ? accounts.map(
              (account) => html`
                <div
                  key=${account.id}
                  className="cuan-item rounded-[24px] p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-lg font-black text-slate-950 dark:text-white">
                          ${account.name}
                        </p>
                        <span className="rounded-full bg-brand-600 px-3 py-1 text-[11px] font-black text-white shadow-[0_10px_24px_rgba(16,185,129,0.20)] dark:bg-emerald-500">
                          ${account.currency}
                        </span>
                        <span className="rounded-full border border-sky-300/25 bg-sky-400/10 px-3 py-1 text-[11px] font-black text-sky-800 dark:border-sky-400/20 dark:bg-sky-500/10 dark:text-sky-100">
                          ${account.typeLabel}
                        </span>
                      </div>
                      ${account.note
                        ? html`
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                              ${account.note}
                            </p>
                          `
                        : null}
                    </div>
                    <div className="flex shrink-0 items-end justify-between gap-3 sm:flex-col sm:text-right">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                          Saldo ${account.currency}
                        </p>
                        <p className="mt-1 text-xl font-black text-slate-950 dark:text-white">
                          ${money(account.balanceAmount, account.currency)}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                          ${getAssetAccountValuationLabel(account, baseCurrency)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick=${() => onDeleteAccount(account)}
                        className="history-action-danger min-h-10 rounded-2xl px-3 py-2 text-xs font-black transition hover:-translate-y-0.5"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                </div>
              `,
            )
          : html`
              <div className="rounded-[24px] border border-dashed border-slate-300/80 bg-white/40 p-5 text-center dark:border-white/15 dark:bg-slate-900/30">
                <p className="text-lg font-black text-slate-950 dark:text-white">
                  Belum ada dompet
                </p>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Tambahkan cash, rekening, wallet, atau investasi pertama agar saldo mulai terlacak.
                </p>
                <button
                  type="button"
                  onClick=${onAddAccount}
                  className="history-action-primary mt-4 inline-flex min-h-11 items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-black transition hover:-translate-y-0.5"
                >
                  Tambah dompet pertama
                </button>
              </div>
            `}
      </div>
    </div>
  `;
}

/* GoalForm lama dihapus karena tidak pernah dirender. Sheet "Buat
   Tabungan" memakai TargetForm bersama dari TargetPlanningSection. */

export function WealthGoalsPage({
  metrics,
  transactions = [],
  accountReconciliations = [],
  loading,
  activeCurrencies,
  baseCurrency = DEFAULT_BASE_CURRENCY,
  onCreateAssetAccount,
  onDeleteAssetAccount,
  onSetPrimaryAccount,
  onCreateAccountReconciliation,
  onRecordMissingTransaction,
  onCreateGoal,
  onUpdateGoal,
  onDeleteGoal,
  onArchiveGoal,
  onMoveAllocation,
  onContribute,
  onUseGoal,
  onOpenGoals,
  onOpenReport,
  onSelectAccountCurrency,
  openAssetFormRequest = 0,
  onAssetFormRequestHandled,
}) {
  const [activeSection, setActiveSection] = useState("accounts");
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState(null);
  const editingGoal =
    (metrics.goalInsights || []).find((goal) => goal.id === editingGoalId) || null;
  const [showAssetForm, setShowAssetForm] = useState(false);

  useEffect(() => {
    if (openAssetFormRequest > 0) {
      setActiveSection("accounts");
      setShowAssetForm(true);
      onAssetFormRequestHandled?.();
    }
  }, [openAssetFormRequest]);

  async function handleCreateGoal(payload) {
    const ok = await onCreateGoal(payload);
    if (ok) {
      setShowGoalForm(false);
    }
    return ok;
  }

  function openAssetForm() {
    setActiveSection("accounts");
    setShowAssetForm(true);
  }

  function openGoalForm() {
    setActiveSection("accounts");
    setShowGoalForm(true);
  }

  function openGoalPlanning() {
    if (onOpenGoals) {
      onOpenGoals();
      return;
    }
    setActiveSection("goals");
  }

  return html`
    <div className="grid gap-4">
      ${activeSection === "accounts"
        ? html`
            <div className="grid gap-4">
            <${WalletAccountsPage}
              metrics=${metrics}
              transactions=${transactions}
              accountReconciliations=${accountReconciliations}
              loading=${loading}
              onCreateWallet=${openAssetForm}
              onCreateGoal=${openGoalForm}
              onDeleteAccount=${onDeleteAssetAccount}
              onSetPrimaryAccount=${onSetPrimaryAccount}
              onCreateAccountReconciliation=${onCreateAccountReconciliation}
              onRecordMissingTransaction=${onRecordMissingTransaction}
              onDeleteGoal=${onDeleteGoal}
              onContributeGoal=${onContribute}
              onUseGoal=${onUseGoal}
              baseCurrency=${baseCurrency}
              onSelectAccountCurrency=${onSelectAccountCurrency}
              onEditGoal=${(goal) => setEditingGoalId(goal.id)}
              onArchiveGoal=${onArchiveGoal}
              onMoveGoalAllocation=${onMoveAllocation}
            />
            </div>
          `
        : null}

      ${activeSection === "goals"
        ? html`
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick=${() => setActiveSection("accounts")}
                className="history-action-secondary min-h-10 rounded-lg px-3 text-xs font-bold"
              >
                Kembali ke dompet
              </button>
              <button
                type="button"
                onClick=${openGoalForm}
                className="history-action-primary min-h-10 rounded-lg px-3 text-xs font-bold"
              >
                Tambah target
              </button>
            </div>
            <${GoalTracker}
              goals=${metrics.goalInsights}
              accounts=${metrics.assetAccountInsights}
              onDelete=${onDeleteGoal}
              onContribute=${onContribute}
            />
          `
        : null}

      ${activeSection === "report"
        ? html`
            <button
              type="button"
              onClick=${() => setActiveSection("accounts")}
              className="history-action-secondary min-h-10 justify-self-start rounded-lg px-3 text-xs font-bold"
            >
              Kembali ke dompet
            </button>
            <${FinancialMonthlyPreview}
              metrics=${metrics}
              onOpenReport=${onOpenReport}
            />
          `
        : null}

      ${/* Sheet pemilih Dompet/Tabungan dihapus. Halaman Dompet kini memberi
            dua tombol terpisah yang langsung membuka formnya masing-masing. */ null}
      <${SheetShell}
        open=${showAssetForm}
        title="Buat Dompet"
        helper="Tambahkan bank, wallet, atau uang tunai beserta mata uangnya."
        onClose=${() => setShowAssetForm(false)}
        labelledBy="asset-account-sheet-title"
      >
        <${AssetAccountForm}
          onSubmit=${onCreateAssetAccount}
          loading=${loading}
          activeCurrencies=${activeCurrencies}
          onCancel=${() => setShowAssetForm(false)}
          onSuccess=${() => setShowAssetForm(false)}
          embedded=${true}
        />
      <//>

      <${SheetShell}
        open=${showGoalForm}
        title="Buat Tabungan"
        helper="Tentukan target dan rekening atau cash yang menjadi sumber dananya."
        onClose=${() => setShowGoalForm(false)}
        labelledBy="goal-sheet-title"
      >
        <${TargetForm}
          goal=${null}
          summaries=${metrics.goalAllocationSummaries}
          currencies=${normalizeCurrencyList([
            ...activeCurrencies,
            ...metrics.assetAccountInsights.map((account) => account.currency),
          ])}
          loading=${loading}
          onSubmit=${handleCreateGoal}
          onCancel=${() => setShowGoalForm(false)}
          accounts=${metrics.assetAccountInsights}
          createLabel="Buat Tabungan"
        />
      <//>

      <${SheetShell}
        open=${Boolean(editingGoal)}
        title=${editingGoal ? `Ubah ${editingGoal.name}` : "Ubah tabungan"}
        helper="Perbarui nama, target, atau sumber dananya."
        onClose=${() => setEditingGoalId(null)}
        labelledBy="goal-edit-sheet-title"
      >
        ${editingGoal
          ? html`
              <${TargetForm}
                key=${editingGoal.id}
                goal=${editingGoal}
                summaries=${metrics.goalAllocationSummaries}
                currencies=${normalizeCurrencyList([
                  ...activeCurrencies,
                  ...metrics.assetAccountInsights.map((account) => account.currency),
                ])}
                loading=${loading}
                onSubmit=${async (payload) => {
                  const ok = await onUpdateGoal?.(editingGoal, payload);
                  if (ok !== false) setEditingGoalId(null);
                  return ok;
                }}
                onCancel=${() => setEditingGoalId(null)}
                accounts=${metrics.assetAccountInsights}
              />
            `
          : null}
      <//>
    </div>
  `;
}
