import React, { useMemo, useState } from "react";
import htm from "htm";
import {
  MoreHorizontal,
  Target,
} from "lucide-react";
import {
  GOAL_TYPE_COLLECT_BY_DATE,
  GOAL_TYPE_HOLD_BALANCE,
  GOAL_PROTECTION_MODES,
  getDefaultGoalFundingAccountId,
  getGoalFundingAccountOptions,
} from "../../domain/goals.js";
import {
  DEFAULT_BASE_CURRENCY,
  formatCurrency,
  formatNumericInput,
  formatPercent,
  normalizeCurrencyCode,
  normalizeCurrencyList,
  normalizeNumericInput,
} from "../../lib/currency.js";
import { formatDateTime } from "../../lib/dates.js";
import { CurrencyCombobox } from "../shared/CurrencyCombobox.js";
import { FormActionDock } from "../shared/FormActionDock.js";
import { SheetShell } from "../shared/SheetShell.js";

const html = htm.bind(React.createElement);
const INPUT_CLASS =
  "cs-entry-input min-h-11 w-full rounded-lg px-3 py-2.5 text-sm";

function getStatusTone(goal) {
  if (!goal.allocationCovered || goal.status === "overdue") {
    return "border-rose-400/25 bg-rose-500/10 text-rose-700 dark:text-rose-300";
  }
  if (goal.status === "completed" || goal.status === "used") {
    return "border-emerald-400/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  if (goal.daysLeft != null && goal.daysLeft <= 30) {
    return "border-amber-400/25 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }
  return "border-sky-400/20 bg-sky-500/10 text-sky-700 dark:text-sky-300";
}

function getProgressTone(goal) {
  if (!goal.allocationCovered || goal.status === "overdue") return "bg-rose-500";
  if (goal.status === "completed" || goal.status === "used") {
    return "bg-emerald-400";
  }
  if (goal.daysLeft != null && goal.daysLeft <= 30) return "bg-amber-400";
  return "bg-cyan-400";
}

function getGoalTypeLabel(goal) {
  return goal.targetType === GOAL_TYPE_COLLECT_BY_DATE
    ? "Kumpulkan sampai tanggal"
    : "Jaga saldo";
}

function getActivityLabel(activity) {
  const labels = {
    assign: "Alokasi",
    release: "Alokasi dilepas",
    spend: "Digunakan",
    adjustment: "Penyesuaian",
  };
  return labels[activity.type] || "Aktivitas";
}

function getActivitySign(activity) {
  return activity.type === "assign" ||
    (activity.type === "adjustment" && Number(activity.amount) > 0)
    ? "+"
    : "-";
}

export function TargetForm({
  goal = null,
  summaries,
  currencies,
  loading,
  onSubmit,
  onCancel,
  accounts = [],
  createLabel = "Buat tabungan",
}) {
  const editing = Boolean(goal);
  const [form, setForm] = useState(() => ({
    name: goal?.name || "",
    target_type: goal?.targetType || GOAL_TYPE_HOLD_BALANCE,
    currency: goal?.currency || currencies[0] || DEFAULT_BASE_CURRENCY,
    target_amount: goal?.targetAmount ? String(goal.targetAmount) : "",
    deadline: goal?.deadline || "",
    initial_allocation: "",
    account_id: goal?.primaryFundingAccountId || "",
    protection_mode: goal?.protectionMode || "flexible",
    spending_reduces_progress: goal?.spendingReducesProgress ?? true,
    note: goal?.note || "",
  }));
  /* Batas waktu dan catatan disembunyikan sampai diminta, supaya form baru
     hanya tiga baris. Saat mengedit tabungan yang sudah punya salah satunya,
     bagian ini langsung terbuka agar isinya tidak tersembunyi. */
  const [detailsOpen, setDetailsOpen] = useState(
    Boolean(goal?.deadline || goal?.note),
  );
  const currency = normalizeCurrencyCode(form.currency);
  const compatibleAccounts = accounts.filter(
    (account) =>
      account.currency === currency &&
      account.is_allocatable !== false &&
      !account.is_archived,
  );

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    const hasDeadline = String(form.deadline || "").trim().length > 0;
    const ok = await onSubmit({
      ...form,
      /* Jenis diturunkan dari batas waktu untuk tabungan baru. Saat mengedit,
         nilai tersimpan dipertahankan supaya tipe tabungan lama tidak berubah
         hanya karena batas waktunya disunting. */
      target_type: editing
        ? form.target_type
        : hasDeadline
          ? GOAL_TYPE_COLLECT_BY_DATE
          : GOAL_TYPE_HOLD_BALANCE,
      target_amount: normalizeNumericInput(form.target_amount),
      target_amount_idr: normalizeNumericInput(form.target_amount),
      /* Alokasi awal selalu nol: pengisian dana dilakukan lewat aksi
         "Sisihkan" setelah tabungan dibuat. */
      initial_allocation: 0,
      account_id: form.account_id || null,
    });
    if (ok) onCancel();
  }

  return html`
    <form className="grid gap-3" onSubmit=${submit}>
      <label className="block">
        <span className="cs-entry-label">Nama tabungan</span>
        <input
          required
          value=${form.name}
          onChange=${(event) => updateField("name", event.target.value)}
          placeholder="Contoh: Dana Darurat"
          className=${INPUT_CLASS}
        />
      </label>

      ${/* "Jenis tabungan" dihapus karena redundan: nilainya hanya
            hold_balance atau collect_by_date, dan itu sudah tersirat dari ada
            tidaknya batas waktu. Menurunkannya otomatis juga menutup celah
            input yang bertentangan, misalnya jenis "Kumpulkan Sampai Tanggal"
            tetapi batas waktunya kosong. Lihat penurunan nilainya di submit. */ null}
      <div className="grid grid-cols-[0.75fr_1.25fr] gap-2">
        <div className="block">
          <span className="cs-entry-label">Mata uang</span>
          <${CurrencyCombobox}
            disabled=${editing}
            value=${form.currency}
            onChange=${(value) => updateField("currency", value)}
            currencies=${currencies}
            ariaLabel="Mata uang tabungan"
            buttonClassName=${INPUT_CLASS}
          />
        </div>
        <label className="block">
          <span className="cs-entry-label">Nominal target</span>
          <input
            required
            inputMode="decimal"
            value=${form.target_amount}
            onChange=${(event) =>
              updateField("target_amount", formatNumericInput(event.target.value))}
            placeholder="0"
            className=${INPUT_CLASS}
          />
        </label>
      </div>

      ${!editing
        ? html`
            <div key="goal-funding" className="grid gap-3">
            <label className="block">
              <span className="cs-entry-label">Dompet sumber tabungan</span>
              <select
                value=${form.account_id}
                onChange=${(event) => updateField("account_id", event.target.value)}
                className=${INPUT_CLASS}
              >
                <option value="">Rencana saja — belum mengikat saldo</option>
                ${compatibleAccounts.map(
                  (account) => html`
                    <option key=${account.id} value=${account.id}>
                      ${account.name} — tersedia ${formatCurrency(
                        account.availableBalance ?? account.balance_amount,
                        account.currency,
                      )}
                    </option>
                  `,
                )}
              </select>
            </label>

            ${/* "Perlindungan saldo" dihapus dari form. Nilainya tetap
                  ditulis: tabungan baru memakai "flexible", dan saat mengedit
                  nilai tersimpan dipertahankan lewat initial state form, supaya
                  tabungan lama bermode "strict" tidak diturunkan diam-diam.
                  protectionMode masih menggerakkan logika di domain/goals.js. */ null}
            </div>
          `
        : null}

      ${/* "Alokasi awal" dihapus. Tabungan dibuat kosong lalu diisi lewat aksi
            "Sisihkan" dari dompet sumber, sesuai prinsip bahwa tabungan adalah
            alokasi dari dompet, bukan saldo tambahan. */ null}
      ${detailsOpen
        ? html`
            <div key="goal-details" className="grid gap-3">
              <label className="block">
                <span className="cs-entry-label">Batas waktu opsional</span>
                <input
                  type="date"
                  value=${form.deadline}
                  onChange=${(event) => updateField("deadline", event.target.value)}
                  className=${INPUT_CLASS}
                />
              </label>

              <label className="block">
                <span className="cs-entry-label">Catatan opsional</span>
                <textarea
                  value=${form.note}
                  onChange=${(event) => updateField("note", event.target.value)}
                  placeholder="Keterangan singkat"
                  className=${`${INPUT_CLASS} min-h-20 resize-none`}
                ></textarea>
              </label>
            </div>
          `
        : html`
            <button
              type="button"
              onClick=${() => setDetailsOpen(true)}
              className="dc-press dc-press-94 flex min-h-11 items-center justify-center text-[13px] font-medium"
              style=${{ color: "var(--cs-link)" }}
            >
              + Batas waktu atau catatan
            </button>
          `}

      <p
        className="px-0.5 text-xs leading-[1.45]"
        style=${{ color: "var(--cs-mut)" }}
      >
        Menyisihkan dana tidak mengubah saldo aktual dompet. Isi dananya lewat
        "Sisihkan" setelah tabungan ini dibuat.
      </p>

      <${FormActionDock}>
        <div className="grid grid-cols-[0.78fr_1.22fr] gap-2">
          <button
            type="button"
            onClick=${onCancel}
            className="dc-press dc-press-96 min-h-12 rounded-[16px] border text-sm font-bold"
            style=${{ borderColor: "var(--cs-line)", color: "var(--cs-body)" }}
          >
            Batal
          </button>
          <button
            type="submit"
            disabled=${loading}
            className="dc-press dc-press-96 min-h-[52px] rounded-[17px] px-3 text-[15px] font-bold disabled:opacity-50"
            style=${{ background: "var(--cs-acc)", color: "var(--cs-on-acc)" }}
          >
            ${editing ? "Simpan perubahan" : createLabel}
          </button>
        </div>
      <//>
    </form>
  `;
}

export function TargetPlanningSection({
  goals = [],
  summaries = {},
  activeCurrencies = [],
  baseCurrency = DEFAULT_BASE_CURRENCY,
  transactions = [],
  loading = false,
  onCreateGoal,
  onUpdateGoal,
  onDeleteGoal,
  onArchiveGoal,
  onGoalActivity,
  onMoveAllocation,
  onUseGoal,
  accounts = [],
}) {
  const currencies = normalizeCurrencyList(
    [
      baseCurrency,
      ...activeCurrencies,
      ...Object.keys(summaries),
      ...goals.map((goal) => goal.currency),
    ],
    { baseCurrency },
  );
  const [selectedCurrency, setSelectedCurrency] = useState(
    normalizeCurrencyCode(baseCurrency),
  );
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState(null);
  const [detailGoalId, setDetailGoalId] = useState(null);
  const [menuGoalId, setMenuGoalId] = useState(null);
  const [action, setAction] = useState(null);
  const [actionAmount, setActionAmount] = useState("");
  const [actionAccountId, setActionAccountId] = useState("");
  const [destinationGoalId, setDestinationGoalId] = useState("");
  const summary = summaries[selectedCurrency] || {
    currency: selectedCurrency,
    liquidAmount: 0,
    allocatedAmount: 0,
    unallocatedAmount: 0,
    overallocatedAmount: 0,
    isCovered: true,
  };
  const visibleGoals = goals.filter(
    (goal) =>
      goal.currency === selectedCurrency && goal.status !== "archived",
  );
  const selectedDetailGoal =
    goals.find((goal) => goal.id === detailGoalId) || null;
  const editingGoal = goals.find((goal) => goal.id === editingGoalId) || null;
  const actionGoal = goals.find((goal) => goal.id === action?.goalId) || null;
  const actionAccountOptions = actionGoal
    ? getGoalFundingAccountOptions({
        goal: actionGoal,
        type: action?.type,
        accounts,
      })
    : [];
  const selectedActionAccount = actionAccountOptions.find(
    (account) => account.id === actionAccountId,
  );
  const numericActionAmount = Number(normalizeNumericInput(actionAmount));
  const selectedAccountLimit = Number(
    action?.type === "assign"
      ? selectedActionAccount?.availableBalance || 0
      : selectedActionAccount?.allocatedAmount || 0,
  );
  const actionInvalid =
    !selectedActionAccount ||
    !Number.isFinite(numericActionAmount) ||
    numericActionAmount <= 0 ||
    numericActionAmount > selectedAccountLimit + 0.0001;
  const moveTargets = actionGoal
    ? goals.filter(
        (goal) =>
          goal.id !== actionGoal.id &&
          goal.currency === actionGoal.currency &&
          !["archived", "used"].includes(goal.status),
      )
    : [];
  const detailMoveTargets = selectedDetailGoal
    ? goals.filter(
        (goal) =>
          goal.id !== selectedDetailGoal.id &&
          goal.currency === selectedDetailGoal.currency &&
          !["archived", "used"].includes(goal.status),
      )
    : [];
  const selectedGoalTransactions = useMemo(
    () =>
      selectedDetailGoal
        ? transactions
            .filter(
              (transaction) =>
                transaction.target_id === selectedDetailGoal.id &&
                transaction.type === "expense",
            )
            .sort(
              (a, b) =>
                new Date(b.occurred_at).getTime() -
                new Date(a.occurred_at).getTime(),
            )
        : [],
    [selectedDetailGoal, transactions],
  );

  function openAction(goal, type) {
    setDetailGoalId(null);
    setAction({ goalId: goal.id, type });
    setActionAmount("");
    setActionAccountId(
      getDefaultGoalFundingAccountId({ goal, type, accounts }),
    );
    setDestinationGoalId("");
  }

  async function submitAction(event) {
    event.preventDefault();
    if (!actionGoal) return;
    const amount = normalizeNumericInput(actionAmount);
    const ok =
      action.type === "move"
        ? await onMoveAllocation(
            actionGoal,
            goals.find((goal) => goal.id === destinationGoalId),
            amount,
            actionAccountId,
          )
        : await onGoalActivity(
            actionGoal,
            amount,
            action.type,
            "",
            actionAccountId,
          );
    if (ok) {
      setAction(null);
      setActionAmount("");
      setActionAccountId("");
      setDestinationGoalId("");
    }
  }

  return html`
    <section className="border-t border-slate-200 pt-4 dark:border-slate-800">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <${Target} aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-400" />
          <h2 className="text-[11px] font-black leading-4 text-slate-950 dark:text-white sm:text-sm">
            Tabungan & Rencana Finansial
          </h2>
        </div>
        <button
          type="button"
          onClick=${() => setShowCreateForm(true)}
          className="min-h-11 shrink-0 rounded-lg bg-emerald-500/12 px-3 text-[11px] font-black text-emerald-700 dark:text-emerald-300"
        >
          + Tambah Tabungan
        </button>
      </div>

      <div className="mt-3 rounded-xl border border-slate-200 bg-white/80 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/75 dark:shadow-none">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-400">
              Dana ${selectedCurrency}
            </p>
            <p className="mt-1 text-[10px] text-slate-600 dark:text-slate-400">
              Ringkasan dana likuid dan tujuan alokasinya.
            </p>
          </div>
          ${currencies.length > 1
            ? html`
                <select
                  value=${selectedCurrency}
                  onChange=${(event) => setSelectedCurrency(event.target.value)}
                  className="h-11 min-h-11 rounded-lg border border-slate-300 bg-white px-2 text-xs font-bold text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                >
                  ${currencies.map(
                    (currency) =>
                      html`<option key=${currency} value=${currency}>${currency}</option>`,
                  )}
                </select>
              `
            : null}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          ${[
            ["Dana likuid", summary.liquidAmount],
            ["Dialokasikan", summary.allocatedAmount],
            [
              summary.isCovered ? "Belum dialokasikan" : "Kekurangan",
              summary.isCovered
                ? summary.unallocatedAmount
                : summary.overallocatedAmount,
            ],
          ].map(
            ([label, value], index) => html`
              <div key=${label} className="min-w-0">
                <p className="text-[8px] font-black uppercase leading-3 text-slate-600 dark:text-slate-500">
                  ${label}
                </p>
                <p
                  className=${`mt-1 truncate text-xs font-black ${
                    index === 2 && !summary.isCovered
                      ? "text-rose-700 dark:text-rose-300"
                      : index === 2
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-slate-950 dark:text-white"
                  }`}
                >
                  ${formatCurrency(value, selectedCurrency)}
                </p>
              </div>
            `,
          )}
        </div>
        ${!summary.isCovered
          ? html`
              <p className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-[10px] leading-4 text-rose-700 dark:text-rose-200">
                Alokasi melebihi saldo tersedia sebesar
                ${formatCurrency(summary.overallocatedAmount, selectedCurrency)}.
                Lepaskan atau pindahkan sebagian alokasi, atau koreksi saldo dompet.
              </p>
            `
          : null}
      </div>

      <div className="mt-3 grid gap-2.5">
        ${visibleGoals.length
          ? visibleGoals.map(
              (goal) => html`
                <article
                  key=${goal.id}
                  className="relative rounded-xl border border-slate-200 bg-white/80 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/75 dark:shadow-none"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-xs font-black text-slate-950 dark:text-white">
                        ${goal.name}
                      </h3>
                      <p className="mt-1 text-[9px] text-slate-600 dark:text-slate-400">
                        ${getGoalTypeLabel(goal)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className=${`rounded-full border px-2 py-1 text-[8px] font-black ${getStatusTone(goal)}`}
                      >
                        ${goal.statusLabel}
                      </span>
                      <button
                        type="button"
                        onClick=${() =>
                          setMenuGoalId((current) =>
                            current === goal.id ? null : goal.id)}
                        aria-label=${`Menu ${goal.name}`}
                        className="grid h-11 min-h-11 w-11 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                      >
                        <${MoreHorizontal} aria-hidden="true" className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  ${menuGoalId === goal.id
                    ? html`
                        <div className="absolute right-3 top-11 z-10 grid min-w-28 gap-1 rounded-lg border border-slate-200 bg-white p-1.5 text-slate-950 shadow-xl dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                          <button
                            type="button"
                            onClick=${() => {
                              setEditingGoalId(goal.id);
                              setMenuGoalId(null);
                            }}
                            className="min-h-11 rounded-md px-2 py-2 text-left text-[10px] font-bold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            Ubah
                          </button>
                          <button
                            type="button"
                            onClick=${async () => {
                              await onArchiveGoal(goal);
                              setMenuGoalId(null);
                            }}
                            className="min-h-11 rounded-md px-2 py-2 text-left text-[10px] font-bold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            Arsipkan
                          </button>
                          <button
                            type="button"
                            onClick=${() => {
                              onDeleteGoal(goal);
                              setMenuGoalId(null);
                            }}
                            className="min-h-11 rounded-md px-2 py-2 text-left text-[10px] font-bold text-rose-700 hover:bg-rose-500/10 dark:text-rose-300"
                          >
                            Hapus
                          </button>
                        </div>
                      `
                    : null}

                  <div className="mt-3 flex items-end justify-between gap-3">
                    <p className="text-xs font-black text-slate-950 dark:text-white">
                      ${formatCurrency(goal.availableAmount, goal.currency)}
                      <span className="font-medium text-slate-600 dark:text-slate-400">
                        dari ${formatCurrency(goal.targetAmount, goal.currency)}
                      </span>
                    </p>
                    <span className="text-[10px] font-black text-slate-700 dark:text-slate-300">
                      ${formatPercent(goal.progress)}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div
                      className=${`h-full rounded-full ${getProgressTone(goal)}`}
                      style=${{ width: `${Math.max(goal.progress * 100, 1)}%` }}
                    ></div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5 text-[8px] font-black">
                    <span className="rounded-full bg-slate-500/10 px-2 py-1 text-slate-600 dark:text-slate-300">
                      ${GOAL_PROTECTION_MODES.find((mode) => mode.value === goal.protectionMode)?.label || "Fleksibel"}
                    </span>
                    ${goal.accountBreakdown?.map(
                      (funding) => html`
                        <span key=${funding.accountId} className="rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-700 dark:text-emerald-300">
                          ${funding.accountName}: ${formatCurrency(funding.amount, goal.currency)}
                        </span>
                      `,
                    )}
                  </div>
                  ${goal.hasUnmappedFunding
                    ? html`
                        <p className="mt-2 rounded-lg border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-[9px] leading-4 text-amber-700 dark:text-amber-200">
                          ${formatCurrency(goal.unmappedAmount, goal.currency)} adalah progres legacy
                          tanpa sumber akun. Nilai ini tidak mengurangi dana tersedia sampai dipetakan.
                        </p>
                      `
                    : null}

                  <div className="mt-2 grid grid-cols-2 gap-2 text-[9px]">
                    <p className="text-slate-600 dark:text-slate-400">
                      Kurang
                      <strong className="ml-1 text-slate-800 dark:text-slate-200">
                        ${formatCurrency(goal.shortageAmount, goal.currency)}
                      </strong>
                    </p>
                    <p className="text-right text-slate-600 dark:text-slate-400">
                      ${goal.deadline
                        ? `Target ${formatDateTime(`${goal.deadline}T00:00:00`).replace(
                            ", 00:00",
                            "",
                          )}`
                        : "Tanpa deadline"}
                    </p>
                  </div>
                  ${goal.recommendationAmount > 0
                    ? html`
                        <p className="mt-1 text-[9px] text-cyan-700 dark:text-cyan-300">
                          Rekomendasi
                          ${formatCurrency(
                            goal.recommendationAmount,
                            goal.currency,
                          )}/bulan
                        </p>
                      `
                    : null}

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick=${() => openAction(goal, "assign")}
                      className="min-h-11 rounded-lg bg-emerald-500 px-2 text-[10px] font-black text-white"
                    >
                      Tambah Saldo
                    </button>
                    <button
                      type="button"
                      onClick=${() => setDetailGoalId(goal.id)}
                      className="min-h-11 rounded-lg border border-slate-300 px-2 text-[10px] font-black text-slate-700 dark:border-slate-700 dark:text-slate-200"
                    >
                      Detail
                    </button>
                  </div>
                </article>
              `,
            )
          : html`
              <div className="rounded-xl border border-dashed border-slate-300 bg-white/35 px-4 py-6 text-center dark:border-slate-800 dark:bg-transparent">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Belum ada tabungan ${selectedCurrency}.
                </p>
                <p className="mt-1 text-[10px] text-slate-600 dark:text-slate-500">
                  Buat tabungan untuk memberi tujuan pada dana yang sudah kamu miliki.
                </p>
              </div>
            `}
      </div>

      <${SheetShell}
        open=${showCreateForm}
        title="Tambah Tabungan"
        helper="Tentukan tujuan dana tanpa membuat rekening baru."
        onClose=${() => setShowCreateForm(false)}
        labelledBy="create-goal-title"
      >
        <${TargetForm}
          summaries=${summaries}
          currencies=${currencies}
          loading=${loading}
          accounts=${accounts}
          onSubmit=${onCreateGoal}
          onCancel=${() => setShowCreateForm(false)}
        />
      <//>

      <${SheetShell}
        open=${Boolean(editingGoal)}
        title="Ubah Tabungan"
        helper="Perbarui rencana tanpa mengubah riwayat alokasi."
        onClose=${() => setEditingGoalId(null)}
        labelledBy="edit-goal-title"
      >
        ${editingGoal
          ? html`
              <${TargetForm}
                key=${editingGoal.id}
                goal=${editingGoal}
                summaries=${summaries}
                currencies=${currencies}
                loading=${loading}
                accounts=${accounts}
                onSubmit=${(payload) => onUpdateGoal(editingGoal, payload)}
                onCancel=${() => setEditingGoalId(null)}
              />
            `
          : null}
      <//>

      <${SheetShell}
        open=${Boolean(actionGoal)}
        title=${action?.type === "release"
          ? "Batalkan Alokasi"
          : action?.type === "move"
            ? "Pindahkan Tabungan"
            : "Tambah Saldo Tabungan"}
        helper=${actionGoal
          ? `${actionGoal.name} - ${actionGoal.currency}`
          : ""}
        onClose=${() => setAction(null)}
        labelledBy="goal-allocation-title"
      >
        ${actionGoal
          ? html`
              <form className="grid gap-3" onSubmit=${submitAction}>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-[10px] leading-4 text-slate-700 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
                  ${action?.type === "assign"
                    ? html`
                        <span key="assign-account-summary">
                        Dana belum dialokasikan:
                        <strong className="text-emerald-700 dark:text-emerald-300">
                          ${formatCurrency(
                            summaries[actionGoal.currency]?.unallocatedAmount || 0,
                            actionGoal.currency,
                          )}
                        </strong>
                        </span>
                      `
                    : html`
                        <span key="release-account-summary">
                        Dana tersedia:
                        <strong className="text-slate-950 dark:text-white">
                          ${formatCurrency(
                            actionGoal.availableAmount,
                            actionGoal.currency,
                          )}
                        </strong>
                        </span>
                      `}
                </div>

                <label>
                  <span className="cs-entry-label">
                    ${action?.type === "assign"
                      ? "Rekening sumber"
                      : "Rekening alokasi"}
                  </span>
                  <select
                    required
                    value=${actionAccountId}
                    onChange=${(event) => setActionAccountId(event.target.value)}
                    className=${INPUT_CLASS}
                  >
                    <option value="">Pilih rekening</option>
                    ${actionAccountOptions.map(
                      (account) => html`
                        <option key=${account.id} value=${account.id}>
                          ${account.name} — ${action?.type === "assign"
                            ? `tersedia ${formatCurrency(
                                account.availableBalance,
                                account.currency,
                              )}`
                            : `dialokasikan ${formatCurrency(
                                account.allocatedAmount,
                                account.currency,
                              )}`}
                        </option>
                      `,
                    )}
                  </select>
                </label>

                ${actionAccountOptions.length === 0
                  ? html`
                      <p className="rounded-lg border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-[10px] leading-4 text-amber-700 dark:text-amber-200">
                        ${action?.type === "assign"
                          ? `Belum ada rekening ${actionGoal.currency} yang dapat dipakai. Tambahkan atau aktifkan rekening terlebih dahulu.`
                          : "Target ini belum memiliki alokasi berbasis rekening yang dapat dipilih."}
                      </p>
                    `
                  : null}

                ${action?.type === "move"
                  ? html`
                      <label>
                        <span className="cs-entry-label">Tabungan tujuan</span>
                        <select
                          required
                          value=${destinationGoalId}
                          onChange=${(event) =>
                            setDestinationGoalId(event.target.value)}
                          className=${INPUT_CLASS}
                        >
                          <option value="">Pilih tabungan</option>
                          ${moveTargets.map(
                            (goal) =>
                              html`<option key=${goal.id} value=${goal.id}>${goal.name}</option>`,
                          )}
                        </select>
                      </label>
                    `
                  : null}

                <label>
                  <span className="cs-entry-label">Nominal</span>
                  <input
                    required
                    inputMode="decimal"
                    value=${actionAmount}
                    onChange=${(event) =>
                      setActionAmount(formatNumericInput(event.target.value))}
                    placeholder="0"
                    className=${INPUT_CLASS}
                  />
                </label>
                <p className="text-[10px] leading-4 text-slate-600 dark:text-slate-400">
                  ${action?.type === "assign"
                    ? "Dana akan ditandai sebagai tabungan pada dompet pilihan. Saldo aktual dompet tidak berubah."
                    : "Pembatalan atau pemindahan hanya dapat memakai saldo tabungan pada dompet pilihan."}
                </p>
                <${FormActionDock}>
                  <button
                    type="submit"
                    disabled=${loading || actionInvalid ||
                    (action?.type === "move" && !destinationGoalId)}
                    className="min-h-12 w-full rounded-xl bg-emerald-500 text-xs font-black text-white disabled:opacity-50"
                  >
                    Simpan
                  </button>
                <//>
              </form>
            `
          : null}
      <//>

      <${SheetShell}
        open=${Boolean(selectedDetailGoal)}
        title=${selectedDetailGoal?.name || "Detail Tabungan"}
        helper=${selectedDetailGoal
          ? `${selectedDetailGoal.currency} - ${selectedDetailGoal.statusLabel}`
          : ""}
        onClose=${() => setDetailGoalId(null)}
        labelledBy="goal-detail-title"
      >
        ${selectedDetailGoal
          ? html`
              <div className="grid gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/70">
                  <div className="grid grid-cols-2 gap-3">
                    ${[
                      ["Target", selectedDetailGoal.targetAmount],
                      ["Dana tersedia", selectedDetailGoal.availableAmount],
                      ["Kekurangan", selectedDetailGoal.shortageAmount],
                      ["Progres", null],
                    ].map(
                      ([label, value]) => html`
                        <div key=${label}>
                          <p className="text-[9px] font-black uppercase text-slate-600 dark:text-slate-500">
                            ${label}
                          </p>
                          <p className="mt-1 text-xs font-black text-slate-950 dark:text-white">
                            ${value == null
                              ? formatPercent(selectedDetailGoal.progress)
                              : formatCurrency(
                                  value,
                                  selectedDetailGoal.currency,
                                )}
                          </p>
                        </div>
                      `,
                    )}
                  </div>
                  <p className="mt-3 text-[10px] leading-4 text-slate-600 dark:text-slate-400">
                    ${selectedDetailGoal.deadline
                      ? `Batas waktu ${formatDateTime(
                          `${selectedDetailGoal.deadline}T00:00:00`,
                        ).replace(", 00:00", "")}.`
                      : "Target ini tidak memiliki deadline."}
                    ${selectedDetailGoal.recommendationAmount > 0
                      ? ` Rekomendasi ${formatCurrency(
                          selectedDetailGoal.recommendationAmount,
                          selectedDetailGoal.currency,
                        )} per bulan.`
                      : ""}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick=${() => openAction(selectedDetailGoal, "assign")}
                    className="min-h-11 rounded-lg bg-emerald-500 text-[10px] font-black text-white"
                  >
                    Tambah Saldo
                  </button>
                  <button
                    type="button"
                    onClick=${() => openAction(selectedDetailGoal, "release")}
                    disabled=${selectedDetailGoal.availableAmount <= 0}
                    className="min-h-11 rounded-lg border border-slate-300 text-[10px] font-black text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"
                  >
                    Batalkan Alokasi
                  </button>
                  <button
                    type="button"
                    onClick=${() => openAction(selectedDetailGoal, "move")}
                    disabled=${selectedDetailGoal.availableAmount <= 0 ||
                    !detailMoveTargets.length}
                    className="min-h-11 rounded-lg border border-slate-300 text-[10px] font-black text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"
                  >
                    Pindahkan Tabungan
                  </button>
                  <button
                    type="button"
                    onClick=${() => {
                      setDetailGoalId(null);
                      onUseGoal(selectedDetailGoal);
                    }}
                    disabled=${selectedDetailGoal.availableAmount <= 0}
                    className="min-h-11 rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-[10px] font-black text-cyan-700 disabled:opacity-40 dark:text-cyan-200"
                  >
                    Gunakan Tabungan
                  </button>
                </div>

                <div>
                  <h3 className="text-xs font-black text-slate-950 dark:text-white">Riwayat alokasi</h3>
                  <div className="mt-2 grid gap-2">
                    ${selectedDetailGoal.activities.length
                      ? [...selectedDetailGoal.activities]
                          .reverse()
                          .map(
                            (activity) => html`
                              <div
                                key=${activity.id}
                                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-[10px] font-bold text-slate-800 dark:text-slate-200">
                                    ${getActivityLabel(activity)}
                                  </p>
                                  <p className="mt-0.5 text-[9px] text-slate-500">
                                    ${formatDateTime(activity.created_at)}
                                  </p>
                                </div>
                                <p
                                  className=${`text-[10px] font-black ${
                                    getActivitySign(activity) === "+"
                                      ? "text-emerald-700 dark:text-emerald-300"
                                      : "text-rose-700 dark:text-rose-300"
                                  }`}
                                >
                                  ${getActivitySign(activity)}${formatCurrency(
                                    Math.abs(activity.amount),
                                    activity.currency,
                                  )}
                                </p>
                              </div>
                            `,
                          )
                      : html`
                          <p className="rounded-lg border border-dashed border-slate-300 p-3 text-[10px] text-slate-600 dark:border-slate-800 dark:text-slate-500">
                            Belum ada aktivitas baru. Nilai lama tetap dihitung sebagai alokasi awal.
                          </p>
                        `}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-black text-slate-950 dark:text-white">
                    Transaksi yang menggunakan tabungan
                  </h3>
                  <div className="mt-2 grid gap-2">
                    ${selectedGoalTransactions.length
                      ? selectedGoalTransactions.map(
                          (transaction) => html`
                            <div
                              key=${transaction.id}
                              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-[10px] font-bold text-slate-800 dark:text-slate-200">
                                  ${transaction.description}
                                </p>
                                <p className="mt-0.5 text-[9px] text-slate-500">
                                  ${formatDateTime(transaction.occurred_at)}
                                </p>
                              </div>
                              <p className="text-[10px] font-black text-rose-700 dark:text-rose-300">
                                -${formatCurrency(
                                  transaction.amount,
                                  transaction.currency,
                                )}
                              </p>
                            </div>
                          `,
                        )
                      : html`
                          <p className="rounded-lg border border-dashed border-slate-300 p-3 text-[10px] text-slate-600 dark:border-slate-800 dark:text-slate-500">
                            Belum ada transaksi yang memakai tabungan ini.
                          </p>
                        `}
                  </div>
                </div>
              </div>
            `
          : null}
      <//>
    </section>
  `;
}
