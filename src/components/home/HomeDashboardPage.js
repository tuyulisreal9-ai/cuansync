import React from "react";
import htm from "htm";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  BarChart3,
  Building2,
  ChevronRight,
  Eye,
  EyeOff,
  Repeat2,
  ReceiptText,
  Send,
  WalletCards,
} from "lucide-react";
import { getTransactionFlow } from "../../domain/transactions.js";
import {
  DEFAULT_BASE_CURRENCY,
  HIDDEN_BALANCE_TEXT,
  formatCurrency,
  normalizeCurrencyCode,
} from "../../lib/currency.js";
import {
  useMaskedCurrency,
  useMaskedText,
} from "../../lib/balanceVisibility.js";
import { formatRelativeTime, formatShortTime } from "../../lib/dates.js";
import {
  getTransactionCategoryLabel,
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

function ActivityRow({
  transaction,
  fallbackRate,
  accountNames = {},
  className = "",
}) {
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

  /* Kode mata uang saja tidak memberi tahu apa apa, jadi tidak ikut dibawa.
     Valuasi dan sisi lawan penukaran tetap dibawa karena itu angka yang
     memang dicari, dan karena itu nominal, ia ikut sakelar privasi. */
  const dompet =
    accountNames[transaction.source_account_id] ||
    accountNames[transaction.destination_account_id] ||
    "";
  const nominalTambahan = /^[A-Z]{3}$/.test(amount.secondary || "")
    ? ""
    : maskText(amount.secondary);
  /* Catat cepat memakai nama kategori sebagai judul kalau catatannya kosong,
     jadi kategori dilewati saat isinya sama persis dengan judul. Tanpa ini
     barisnya berbunyi "Makan Harian" dua kali. */
  const judul = getTransactionDisplayTitle(transaction);
  const kategori = getTransactionCategoryLabel(transaction);
  const konteks = [
    kategori === judul ? "" : kategori,
    dompet,
    formatRelativeTime(transaction.occurred_at),
    nominalTambahan,
  ]
    .filter(Boolean)
    .join(" · ");

  return html`
    <div className=${`dc-row flex min-h-[72px] items-center gap-4 p-4 ${className}`}>
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
          ${judul}
        </span>
        ${/* Ponsel memakai keterangan ringkas yang sudah ada; kolomnya
              sempit dan valuasi adalah info yang paling dicari di sana.
              Desktop punya ruang untuk konteks penuh: kategori, dompet, dan
              kapan. Dirender dua duanya lalu dipilih lewat lg supaya susunan
              ponsel benar benar tidak tersentuh. */ null}
        <span className="truncate text-xs text-[color:var(--cs-mut)]">
          <span className="lg:hidden">
            ${maskText(amount.secondary) || formatShortTime(transaction.occurred_at)}
          </span>
          <span className="hidden lg:inline">${konteks}</span>
        </span>
      </span>
      <span className="dc-num shrink-0 text-[13.5px]" style=${{ color: tone }}>
        ${maskText(amount.primary)}
      </span>
    </div>
  `;
}

function RecentActivity({ transactions = [], fallbackRate, accountNames, onOpen }) {
  /* Ponsel cukup empat baris; layar desktop jauh lebih tinggi dan empat baris
     menyisakan lubang di samping kolom kanan. Dua baris terakhir dirender
     tetapi disembunyikan di bawah lg, bukan dipotong lewat JavaScript, supaya
     jumlahnya ikut berubah saat jendela diubah ukurannya. */
  const MOBILE_ROWS = 4;
  const rows = transactions.slice(0, 6);

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
              (transaction, index) => html`
                <${ActivityRow}
                  key=${transaction.id}
                  transaction=${transaction}
                  fallbackRate=${fallbackRate}
                  accountNames=${accountNames}
                  className=${index >= MOBILE_ROWS ? "hidden lg:flex" : ""}
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

/* ---- Kolom kanan desktop -------------------------------------------------
   Tiga kartu ini hanya muncul dari lg ke atas. Di ponsel ruangnya tidak ada
   dan jalan pintasnya sudah diwakili baris tile, jadi menambahkannya di sana
   hanya memperpanjang halaman tanpa memberi apa apa. */

function QuickLinkRow({ icon: Icon, title, hint, onClick, disabled }) {
  return html`
    <button
      type="button"
      onClick=${onClick}
      disabled=${disabled}
      className="dc-press dc-press-96 flex min-h-[54px] items-center gap-3 rounded-[14px] border px-3 text-left disabled:cursor-not-allowed disabled:opacity-40"
      style=${{ background: "var(--cs-card)", borderColor: "var(--cs-line)" }}
    >
      <span className="dc-chip flex h-8 w-8 shrink-0 items-center justify-center">
        <${Icon}
          aria-hidden="true"
          className="h-4 w-4"
          style=${{ color: "var(--cs-body)" }}
          strokeWidth=${1.75}
        />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-[13.5px] font-medium">${title}</span>
        <span
          className="truncate text-[11.5px]"
          style=${{ color: "var(--cs-mut)" }}
        >
          ${hint}
        </span>
      </span>
    </button>
  `;
}

function QuickLinksCard({
  canTransfer,
  canExchange,
  onAddTransaction,
  onExchange,
}) {
  return html`
    <section className="dc-card flex flex-col gap-2.5 p-5">
      <span className="px-0.5 text-[15px] font-bold">Jalan cepat</span>
      <${QuickLinkRow}
        icon=${ReceiptText}
        title="Catat pengeluaran"
        hint="atau pemasukan"
        onClick=${() => onAddTransaction?.()}
      />
      <${QuickLinkRow}
        icon=${Send}
        title="Kirim antar dompet"
        hint="mata uang sama"
        disabled=${!canTransfer}
        onClick=${() => onExchange?.("transfer")}
      />
      <${QuickLinkRow}
        icon=${Repeat2}
        title="Tukar mata uang"
        hint="pakai kurs terakhir"
        disabled=${!canExchange}
        onClick=${() => onExchange?.("exchange")}
      />
    </section>
  `;
}

/* Kalimat ringkasannya dirakit dari angka yang benar benar ada: rasio menabung
   dari cashFlow dan jumlah kategori yang perlu ditinjau dari anggaran. Bagian
   yang datanya belum lengkap dihilangkan, bukan diisi perkiraan, karena angka
   karangan pada layar keuangan lebih berbahaya daripada kalimat yang pendek. */
function buildHealthSentence(summary) {
  const bagian = [];
  const ratio = summary?.cashFlow?.savingsRatio;
  if (summary?.cashFlow?.evaluable && Number.isFinite(ratio)) {
    bagian.push(
      `Bulan ini kamu menyisihkan ${Math.round(ratio * 100)}% pemasukan`,
    );
  }
  const attention = Number(summary?.budget?.attentionCount || 0);
  if (attention > 0) {
    bagian.push(`ada ${attention} hal yang bisa dirapikan`);
  }
  if (!bagian.length) {
    return (
      summary?.recommendation?.body ||
      "Catat beberapa transaksi dulu supaya kondisimu bisa dinilai."
    );
  }
  return `${bagian.join(", dan ")}.`;
}

function HealthChip({ children }) {
  return html`
    <span
      className="flex min-h-[26px] items-center rounded-full px-3 text-[11.5px] font-medium"
      style=${{ background: "var(--cs-chip)", color: "var(--cs-body)" }}
    >
      ${children}
    </span>
  `;
}

function FinancialHealthCard({ summary, onOpen }) {
  const score = summary?.scoring?.score;
  const attention = Number(summary?.budget?.attentionCount || 0);

  return html`
    <button
      type="button"
      onClick=${onOpen}
      className="dc-card dc-press dc-press-96 flex w-full flex-col gap-3.5 p-5 text-left"
    >
      <span className="flex items-center gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px]"
          style=${{ background: "var(--cs-acc)" }}
        >
          <${BarChart3}
            aria-hidden="true"
            className="h-[18px] w-[18px]"
            style=${{ color: "var(--cs-on-acc)" }}
            strokeWidth=${1.75}
          />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-[14.5px] font-bold">
            Kondisi keuanganmu
          </span>
          <span
            className="truncate text-[12px]"
            style=${{ color: "var(--cs-mut)" }}
          >
            Diperbarui tiap kamu mencatat
          </span>
        </span>
        <${ChevronRight}
          aria-hidden="true"
          className="h-4 w-4 shrink-0"
          style=${{ color: "var(--cs-faint)" }}
          strokeWidth=${1.75}
        />
      </span>

      <span
        className="text-[12.5px] leading-[1.55]"
        style=${{ color: "var(--cs-body)" }}
      >
        ${buildHealthSentence(summary)}
      </span>

      ${attention > 0 || Number.isFinite(score)
        ? html`
            <span className="flex flex-wrap gap-2">
              ${attention > 0
                ? html`<${HealthChip} key="tips">${attention} tips baru<//>`
                : null}
              ${Number.isFinite(score)
                ? html`<${HealthChip} key="skor">Skor ${score}<//>`
                : null}
            </span>
          `
        : null}
    </button>
  `;
}

function getWalletIcon(accountType) {
  if (accountType === "cash") return Banknote;
  if (accountType === "bank") return Building2;
  return WalletCards;
}

function WalletsCard({ accounts = [], onManage }) {
  const money = useMaskedCurrency();
  /* Lima teratas saja. Daftar lengkapnya ada di halaman Dompet, dan kartu ini
     bertugas memberi gambaran cepat, bukan menggantikannya. */
  const rows = accounts.slice(0, 5);

  return html`
    <section className="dc-card flex flex-col gap-3 p-5">
      <div className="flex items-baseline justify-between gap-3 px-0.5">
        <span className="text-[15px] font-bold">Dompetmu</span>
        <button
          type="button"
          onClick=${onManage}
          className="dc-press dc-press-94 shrink-0 text-[13px] font-medium"
          style=${{ color: "var(--cs-link)" }}
        >
          Kelola
        </button>
      </div>

      ${rows.length
        ? html`
            <div className="flex flex-col">
              ${rows.map((account) => {
                const Icon = getWalletIcon(account.account_type);
                /* Dirakit di sini, bukan di dalam template. Dipisah dua baris
                   di JSX, htm memakan pergantian barisnya dan hasilnya
                   menempel jadi "Bank ·IDR". */
                const jenis = `${account.typeLabel} · ${normalizeCurrencyCode(account.currency)}`;
                return html`
                  <button
                    key=${account.id}
                    type="button"
                    onClick=${onManage}
                    aria-label=${`Lihat ${account.name}`}
                    className="dc-row dc-press flex min-h-[52px] items-center gap-3 rounded-[14px] px-1 text-left"
                  >
                    <span className="dc-chip flex h-8 w-8 shrink-0 items-center justify-center">
                      <${Icon}
                        aria-hidden="true"
                        className="h-4 w-4"
                        style=${{ color: "var(--cs-body)" }}
                        strokeWidth=${1.75}
                      />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-[13.5px] font-medium">
                        ${account.name}
                      </span>
                      <span
                        className="truncate text-[11.5px]"
                        style=${{ color: "var(--cs-mut)" }}
                      >
                        ${jenis}
                      </span>
                    </span>
                    <span className="dc-num shrink-0 text-[13px]">
                      ${money(account.balanceAmount, account.currency)}
                    </span>
                  </button>
                `;
              })}
            </div>
          `
        : html`
            <p
              className="px-1 py-6 text-center text-xs"
              style=${{ color: "var(--cs-mut)" }}
            >
              Belum ada dompet.
            </p>
          `}
    </section>
  `;
}

export function HomeDashboardPage({
  metrics,
  controlSummary,
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
  const accounts = metrics.assetAccountInsights || [];
  /* Transaksi hanya menyimpan id dompet, jadi namanya dicari lewat peta ini
     supaya baris aktivitas bisa menyebut "Bank Jago", bukan sebuah uuid. */
  const accountNames = Object.fromEntries(
    accounts.map((account) => [account.id, account.name]),
  );

  return html`
    ${/* Di desktop beranda dibagi dua kolom: saldo dan jatah bertumpuk di
          kiri, aktivitas mengisi kanan. Sebelumnya kartu dialirkan auto-fit,
          dan baris pintasan yang cuma setinggi 88px menempati satu sel selebar
          setengah layar sehingga menyisakan lubang di sebelah panel saldo.

          Kolom kiri dibungkus satu wadah, bukan dua sel grid terpisah. Sebagai
          sel terpisah, baris grid ikut meregang mengikuti kolom kanan yang
          lebih tinggi, dan jarak antara saldo dan jatah melar dari 24px jadi
          68px. Di bawah lg wadah ini hanya kolom biasa dengan jarak yang sama
          seperti sebelumnya, jadi tampilan ponsel tidak bergeser. */ null}
    <div className="cs-home-dashboard flex w-full min-w-0 max-w-full flex-col gap-4 lg:grid lg:items-start lg:gap-6 lg:[grid-template-columns:minmax(0,1fr)_400px]">
      <div className="flex flex-col gap-4 lg:gap-6">
        <${BalancePanel}
          total=${total}
          income=${Number(metrics.monthlyIncomeIdr || 0)}
          expense=${Number(metrics.monthlyExpenseIdr || 0)}
          currency=${currency}
          visible=${visible}
          onToggleVisible=${onToggleVisible}
        />

        ${/* Topbar desktop sudah memuat Kirim, Tukar, dan Catat transaksi tepat
              103px di atas baris ini. Menampilkan keduanya membuat tombol yang
              sama muncul dua kali berdekatan, jadi di desktop baris ini
              disembunyikan. Di ponsel tidak ada topbar, jadi tetap tampil. */ null}
        <div className="grid grid-cols-3 gap-2 lg:hidden">
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
          accountNames=${accountNames}
          onOpen=${() => onNavigate?.("history")}
        />
      </div>

      ${/* Kolom kanan hanya untuk desktop. Di ponsel isinya sudah terwakili:
            jalan pintas oleh baris tile, dompet oleh tab Dompet. */ null}
      <aside className="hidden lg:flex lg:flex-col lg:gap-6">
        <${QuickLinksCard}
          canTransfer=${canTransfer}
          canExchange=${canExchange}
          onAddTransaction=${onAddTransaction}
          onExchange=${onExchange}
        />
        <${FinancialHealthCard}
          summary=${controlSummary}
          onOpen=${() => onNavigate?.("control")}
        />
        <${WalletsCard}
          accounts=${accounts}
          onManage=${() => onNavigate?.("investment")}
        />
      </aside>
    </div>
  `;
}
