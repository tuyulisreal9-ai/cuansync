import React from "react";
import htm from "htm";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Eye,
  EyeOff,
  Repeat2,
  ReceiptText,
  Send,
} from "lucide-react";
import { getTransactionFlow } from "../../domain/transactions.js";
import {
  DEFAULT_BASE_CURRENCY,
  HIDDEN_BALANCE_TEXT,
  formatCurrency,
  normalizeCurrencyCode,
} from "../../lib/currency.js";
import { useMaskedText } from "../../lib/balanceVisibility.js";
import { formatShortTime } from "../../lib/dates.js";
import {
  getTransactionCompactAmount,
  getTransactionDisplayTitle,
} from "../transactions/presentation.js";

const html = htm.bind(React.createElement);

/* Nominal dipisah dari simbol mata uang: desain menempatkan "Rp" kecil dan
   rata bawah di samping angka besar, bukan menyatu dengan angkanya. */
function splitCurrency(amount, currency) {
  const text = formatCurrency(amount, currency);
  const match = text.match(/^([^\d-]*)\s*(.*)$/);
  return match
    ? { symbol: match[1].trim(), value: match[2] }
    : { symbol: "", value: text };
}

function daysLeftInMonth(now = new Date()) {
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return Math.max(last - now.getDate(), 0);
}

/* Tile ringkas di dalam panel gelap: ikon 14px, label 11px, lalu nominal
   DM Mono 14px. Warna ikon dan nominal memakai token panel, bukan token
   halaman, supaya kontrasnya benar di atas latar panel. */
function PanelSlot({ icon: Icon, label, amount, tone }) {
  return html`
    <div className="dc-panel-slot flex flex-1 flex-col gap-2 p-4">
      <div className="flex items-center gap-1.5">
        <${Icon}
          aria-hidden="true"
          className="h-[14px] w-[14px]"
          style=${{ color: tone }}
          strokeWidth=${1.75}
        />
        <span className="text-[11px] text-[color:var(--cs-panel-mut)]">${label}</span>
      </div>
      <span className="dc-num text-sm" style=${{ color: tone }}>${amount}</span>
    </div>
  `;
}

function BalancePanel({
  total,
  income,
  expense,
  currency,
  visible,
  onToggleVisible,
}) {
  const { symbol, value } = splitCurrency(total, currency);

  return html`
    ${/* Desktop memberi panel ruang lebih: padding 28 dan dua blok berdampingan
          rata bawah, seperti di artifact. */ null}
    <section className="dc-panel flex flex-col gap-6 p-6 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between lg:gap-8 lg:p-7">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] text-[color:var(--cs-panel-mut)]">
            Total semua dompet
          </span>
          ${/* Sakelar privasi diletakkan di kartu uang supaya mode sembunyi
                bisa dinyalakan tanpa masuk Pengaturan. Margin negatif menahan
                tinggi baris agar tombol 44px tidak menggelembungkan header. */ null}
          ${onToggleVisible
            ? html`
                <button
                  type="button"
                  onClick=${onToggleVisible}
                  aria-pressed=${!visible}
                  aria-label=${visible ? "Sembunyikan saldo" : "Tampilkan saldo"}
                  title=${visible ? "Sembunyikan saldo" : "Tampilkan saldo"}
                  className="dc-press dc-press-96 -my-2.5 -mr-2.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                >
                  <${visible ? Eye : EyeOff}
                    aria-hidden="true"
                    className="h-[18px] w-[18px]"
                    style=${{ color: "var(--cs-panel-mut)" }}
                    strokeWidth=${1.75}
                  />
                </button>
              `
            : null}
        </div>
        <div className="flex items-end gap-2">
          ${visible
            ? html`<span
                className="pb-1.5 text-[19px] font-medium text-[color:var(--cs-panel-mut)]"
                >${symbol}</span
              >`
            : null}
          <span className="dc-num text-[36px] leading-none tracking-[-1.6px]">
            ${visible ? value : HIDDEN_BALANCE_TEXT}
          </span>
        </div>
      </div>
      <div className="flex gap-2">
        <${PanelSlot}
          icon=${ArrowDownLeft}
          label="Masuk"
          tone="var(--cs-panel-pos)"
          amount=${visible ? formatCurrency(income, currency) : HIDDEN_BALANCE_TEXT}
        />
        <${PanelSlot}
          icon=${ArrowUpRight}
          label="Keluar"
          tone="var(--cs-panel-neg)"
          amount=${visible ? formatCurrency(expense, currency) : HIDDEN_BALANCE_TEXT}
        />
      </div>
    </section>
  `;
}

function QuickAction({ icon: Icon, label, onClick, disabled }) {
  return html`
    <button
      type="button"
      onClick=${onClick}
      disabled=${disabled}
      className="dc-tile dc-tile-action dc-press dc-press-96 flex min-h-[88px] flex-col items-center justify-center gap-2 px-2 py-4 disabled:opacity-40"
    >
      <${Icon}
        aria-hidden="true"
        className="h-6 w-6"
        style=${{ color: "var(--cs-body)" }}
        strokeWidth=${1.75}
      />
      <span className="text-xs font-medium">${label}</span>
    </button>
  `;
}

function BudgetCard({ spent, limit, currency, visible, onOpen }) {
  const hasBudget = Number(limit) > 0;
  const ratio = hasBudget ? Math.min(Math.max(spent / limit, 0), 1) : 0;
  const remaining = Math.max(limit - spent, 0);
  const days = daysLeftInMonth();
  const perDay = days > 0 ? remaining / days : remaining;

  return html`
    <button
      type="button"
      onClick=${onOpen}
      className="dc-card dc-press dc-press-96 flex w-full flex-col gap-4 p-6 text-left"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[15px] font-bold">Jatah bulan ini</span>
        <span className="shrink-0 text-xs text-[color:var(--cs-mut)]">
          sisa ${days} hari
        </span>
      </div>

      ${hasBudget
        ? html`
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="text-[color:var(--cs-body)]">
                  Terpakai ${visible ? formatCurrency(spent, currency) : HIDDEN_BALANCE_TEXT}
                </span>
                <span className="shrink-0 font-bold">
                  dari ${visible ? formatCurrency(limit, currency) : HIDDEN_BALANCE_TEXT}
                </span>
              </div>
              <div className="dc-track h-2">
                <span style=${{ width: `${ratio * 100}%` }}></span>
              </div>
              <span className="text-xs leading-[1.45] text-[color:var(--cs-mut)]">
                ${visible
                  ? `Sisa ${formatCurrency(remaining, currency)}, kira-kira ${formatCurrency(perDay, currency)} per hari.`
                  : "Rincian jatah disembunyikan."}
              </span>
            </div>
          `
        : html`
            <span className="text-xs leading-[1.45] text-[color:var(--cs-mut)]">
              Belum ada jatah bulan ini. Atur batas belanja supaya sisa harian bisa dihitung.
            </span>
          `}
    </button>
  `;
}

function ActivityRow({ transaction, fallbackRate }) {
  /* Baris aktivitas ikut privasi juga. Menutup total saldo tapi membiarkan
     nominal tiap transaksi terbaca sama saja tidak menutup apa apa. */
  const maskText = useMaskedText();
  const flow = getTransactionFlow(transaction);
  // getTransactionCompactAmount mengembalikan { primary, secondary } dan
  // primary sudah membawa tandanya sendiri, jadi jangan diberi awalan lagi.
  const amount = getTransactionCompactAmount(transaction, fallbackRate);
  const incoming = transaction.type === "income";
  const Icon = flow === "exchange" ? Repeat2 : incoming ? ArrowDownLeft : ArrowUpRight;
  const tone = flow === "exchange"
    ? "var(--cs-mut)"
    : incoming
      ? "var(--cs-pos)"
      : "var(--cs-ink)";

  return html`
    <div className="dc-row flex min-h-[72px] items-center gap-4 p-4">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style=${{ background: "var(--cs-chip)" }}
      >
        <${Icon}
          aria-hidden="true"
          className="h-[18px] w-[18px]"
          style=${{ color: "var(--cs-body)" }}
          strokeWidth=${1.75}
        />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-medium">
          ${getTransactionDisplayTitle(transaction)}
        </span>
        <span className="truncate text-xs text-[color:var(--cs-mut)]">
          ${maskText(amount.secondary) || formatShortTime(transaction.occurred_at)}
        </span>
      </span>
      <span className="dc-num shrink-0 text-[13.5px]" style=${{ color: tone }}>
        ${maskText(amount.primary)}
      </span>
    </div>
  `;
}

function RecentActivity({ transactions = [], fallbackRate, onOpen }) {
  const rows = transactions.slice(0, 4);

  return html`
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 px-0.5">
        <span className="text-[15px] font-bold">Aktivitas terakhir</span>
        <button
          type="button"
          onClick=${onOpen}
          className="dc-press dc-press-94 flex min-h-[44px] shrink-0 items-center pl-4 text-[13px] font-medium text-[color:var(--cs-link)]"
        >
          Lihat semua
        </button>
      </div>
      <div className="dc-card dc-stagger overflow-hidden">
        ${rows.length
          ? rows.map(
              (transaction) => html`
                <${ActivityRow}
                  key=${transaction.id}
                  transaction=${transaction}
                  fallbackRate=${fallbackRate}
                />
              `,
            )
          : html`
              <p className="px-4 py-8 text-center text-xs text-[color:var(--cs-mut)]">
                Belum ada transaksi.
              </p>
            `}
      </div>
    </section>
  `;
}

export function HomeDashboardPage({
  metrics,
  baseCurrency = DEFAULT_BASE_CURRENCY,
  totalValueBase = 0,
  visible = true,
  fallbackRate = 0,
  onNavigate,
  canTransfer = false,
  canExchange = false,
  onAddTransaction,
  onExchange,
  onToggleVisible,
}) {
  const currency = normalizeCurrencyCode(baseCurrency);
  const total = Number(metrics.assetAccountTotalValueIdr ?? totalValueBase ?? 0);

  return html`
    ${/* Di desktop beranda memakai grid auto-fit minmax(380px,1fr) seperti
          artifact, jadi kartu mengalir jadi dua kolom saat ruang cukup dan
          kembali satu kolom di layar sempit tanpa breakpoint tambahan. */ null}
    <div className="cs-home-dashboard flex w-full min-w-0 max-w-full flex-col gap-4 lg:grid lg:items-start lg:gap-6 lg:[grid-template-columns:repeat(auto-fit,minmax(380px,1fr))]">
      <${BalancePanel}
        total=${total}
        income=${Number(metrics.monthlyIncomeIdr || 0)}
        expense=${Number(metrics.monthlyExpenseIdr || 0)}
        currency=${currency}
        visible=${visible}
        onToggleVisible=${onToggleVisible}
      />

      <div className="grid grid-cols-3 gap-2">
        <${QuickAction}
          icon=${ReceiptText}
          label="Catat"
          onClick=${() => onAddTransaction?.()}
        />
        <${QuickAction}
          icon=${Send}
          label="Kirim"
          disabled=${!canTransfer}
          onClick=${() => onExchange?.("transfer")}
        />
        <${QuickAction}
          icon=${Repeat2}
          label="Tukar"
          disabled=${!canExchange}
          onClick=${() => onExchange?.("exchange")}
        />
      </div>

      <${BudgetCard}
        spent=${Number(metrics.budgetSpentTotal || 0)}
        limit=${Number(metrics.budgetLimitTotal || 0)}
        currency=${currency}
        visible=${visible}
        onOpen=${() => onNavigate?.("budget")}
      />

      <${RecentActivity}
        transactions=${metrics.recent}
        fallbackRate=${fallbackRate}
        onOpen=${() => onNavigate?.("history")}
      />
    </div>
  `;
}
