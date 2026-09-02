import React from "react";
import htm from "htm";
import {
  ArrowRight,
  House,
  Moon,
  Plus,
  ReceiptText,
  Repeat2,
  Sun,
  Target,
  WalletCards,
  X,
} from "lucide-react";

const html = htm.bind(React.createElement);

/* Label mengikuti desain: "Jatah" dan "Riwayat" menggantikan
   "Anggaran & Target" dan "Catatan". Kunci tab sengaja tidak diubah supaya
   seluruh rute, deep link, dan state yang sudah ada tetap bekerja. */
const PRIMARY_NAV_ITEMS = [
  { key: "overview", label: "Beranda", icon: House },
  { key: "investment", label: "Dompet", icon: WalletCards },
  { key: "budget", label: "Jatah", icon: Target },
  { key: "history", label: "Riwayat", icon: ReceiptText },
];

function getPrimaryActiveKey(activeTab) {
  if (activeTab === "report") return "investment";
  // Insight dibuka dari Jatah, jadi tab Jatah yang tetap ditandai aktif.
  if (activeTab === "control") return "budget";
  return activeTab;
}

function NavigationItem({
  item,
  active,
  onChange,
  desktop = false,
}) {
  const Icon = item.icon;

  return html`
    <button
      type="button"
      aria-current=${active ? "page" : undefined}
      aria-label=${item.label}
      title=${desktop ? item.label : undefined}
      onClick=${() => onChange(item.key)}
      className=${desktop
        ? `cs-desktop-nav-item group flex h-14 w-14 flex-col items-center justify-center gap-1 rounded-lg text-[9px] font-bold transition ${
            active ? "is-active" : ""
          }`
        : `cs-mobile-nav-item flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-0.5 text-[8px] font-bold transition min-[390px]:text-[9px] ${
            active ? "is-active" : ""
          }`}
    >
      <${Icon}
        aria-hidden="true"
        className=${desktop ? "h-[18px] w-[18px]" : "h-[19px] w-[19px]"}
        strokeWidth=${active ? 2.4 : 2}
      />
      <span
        className=${desktop
          ? "max-w-full text-center leading-tight"
          : "max-w-full text-center leading-[1.05]"}
      >
        ${item.label}
      </span>
    </button>
  `;
}

function AddButton({
  active = false,
  onClick,
  desktop = false,
}) {
  return html`
    <button
      type="button"
      aria-label="Tambah transaksi"
      title=${desktop ? "Tambah transaksi" : undefined}
      onClick=${onClick}
      className=${desktop
        ? `cs-desktop-add-button inline-flex h-12 min-h-12 w-12 items-center justify-center rounded-full transition ${
            active ? "is-active" : ""
          }`
        : `cs-mobile-add-button inline-flex h-[3.25rem] min-h-[3.25rem] w-[3.25rem] items-center justify-center rounded-full transition ${
            active ? "is-active" : ""
          }`}
    >
      <${Plus} aria-hidden="true" className="h-6 w-6" strokeWidth=${2.5} />
    </button>
  `;
}

/* Sidebar desktop mengikuti artifact 072730af: lebar tetap 264, menempel di
   kiri setinggi layar, berisi merek, navigasi berlabel, sakelar tema, lalu
   kartu profil di dasarnya. Rail ikon 76px yang lama diganti karena desain
   desktop memakai label, bukan ikon saja. */
export function DesktopNavigation({
  activeTab,
  onChange,
  onSettings,
  onToggleTheme,
  isDark = false,
  userName = "",
  userEmail = "",
  userInitials = "",
  avatarSrc = null,
}) {
  const activeKey = getPrimaryActiveKey(activeTab);
  const ThemeIcon = isDark ? Moon : Sun;

  return html`
    <aside
      aria-label="Navigasi utama"
      className="cs-desktop-sidebar sticky top-0 hidden h-screen w-[264px] flex-none flex-col gap-7 border-r px-5 pb-6 pt-7 lg:flex"
      style=${{ borderColor: "var(--cs-line)" }}
    >
      ${/* Logo aplikasi yang sebenarnya, bukan ikon dompet umum. Berkasnya
            sudah membawa kotak membulat gelapnya sendiri, jadi tidak diberi
            latar tambahan dan tampil sama di mode terang maupun gelap seperti
            ikon aplikasi pada umumnya. Dipotong dan diperkecil ke 96px dari
            logo-app.png yang 1254px, supaya tidak memuat 1,1MB untuk lencana
            selebar 38px. */ null}
      <div className="flex items-center gap-3 px-2">
        <img
          src="/branding/logo-mark-96.png"
          alt=""
          aria-hidden="true"
          width="38"
          height="38"
          className="h-[38px] w-[38px] shrink-0 rounded-[12px]"
        />
        <span className="text-[16.5px] font-bold tracking-[0.3px]">CUANSYNC</span>
      </div>

      <nav className="flex flex-col gap-1">
        ${PRIMARY_NAV_ITEMS.map((item) => {
          const active = activeKey === item.key;
          const Icon = item.icon;
          return html`
            <button
              key=${item.key}
              type="button"
              aria-current=${active ? "page" : undefined}
              onClick=${() => onChange(item.key)}
              className="cs-sidebar-item dc-press dc-press-96 flex min-h-[48px] items-center gap-3 rounded-[14px] px-3.5 text-left"
              style=${active
                ? { background: "var(--cs-sel-bg)", color: "var(--cs-sel-fg)" }
                : { background: "transparent", color: "var(--cs-body)" }}
            >
              <${Icon}
                aria-hidden="true"
                className="h-[20px] w-[20px] shrink-0"
                strokeWidth=${1.8}
              />
              <span
                className=${`flex-1 text-[15px] ${active ? "font-bold" : "font-medium"}`}
              >
                ${item.label}
              </span>
            </button>
          `;
        })}
      </nav>

      <div className="flex-1"></div>

      <button
        type="button"
        onClick=${onToggleTheme}
        className="cs-sidebar-item dc-press dc-press-96 flex min-h-[48px] items-center gap-3 rounded-[14px] px-3.5 text-left"
        style=${{ color: "var(--cs-body)" }}
      >
        <${ThemeIcon}
          aria-hidden="true"
          className="h-[20px] w-[20px] shrink-0"
          strokeWidth=${1.8}
        />
        <span className="flex-1 text-[15px] font-medium">
          ${isDark ? "Gelap" : "Terang"}
        </span>
      </button>

      <button
        type="button"
        onClick=${onSettings}
        className="dc-card cs-sidebar-card dc-press dc-press-96 flex items-center gap-[11px] p-3 text-left"
      >
        <span
          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center overflow-hidden rounded-full text-[12.5px] font-bold"
          style=${{ background: "var(--cs-chip)", color: "var(--cs-body)" }}
        >
          ${avatarSrc
            ? html`<img
                src=${avatarSrc}
                alt=""
                className="h-full w-full object-cover"
              />`
            : userInitials}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="truncate text-[14.5px] font-bold">${userName}</span>
          <span
            className="truncate text-[12px]"
            style=${{ color: "var(--cs-mut)" }}
          >
            ${userEmail}
          </span>
        </span>
      </button>
    </aside>
  `;
}

export function MobileNavigation({
  activeTab,
  onChange,
  onAdd,
  showHint = false,
  onDismissHint,
}) {
  const activeKey = getPrimaryActiveKey(activeTab);
  const leftItems = PRIMARY_NAV_ITEMS.slice(0, 2);
  const rightItems = PRIMARY_NAV_ITEMS.slice(2);

  return html`
    <nav
      aria-label="Navigasi utama"
      className="mobile-bottom-nav cs-mobile-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 items-stretch gap-1 rounded-t-xl px-1 pb-[calc(.25rem+env(safe-area-inset-bottom))] pt-0.5 transition duration-300 lg:hidden"
    >
      ${leftItems.map(
        (item) => html`
          <${NavigationItem}
            key=${item.key}
            item=${item}
            active=${activeKey === item.key}
            onChange=${onChange}
          />
        `,
      )}

      <div className="relative flex min-h-[3.5rem] items-center justify-center">
        ${showHint
          ? html`
              <div className="cs-fab-hint absolute bottom-[4.65rem] left-1/2 w-[min(16rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg p-3 text-left">
                <p className="text-xs font-extrabold text-slate-950 dark:text-white">
                  Tambah transaksi
                </p>
                <p className="mt-1 text-[11px] leading-4 text-slate-600 dark:text-slate-300">
                  Catat pemasukan, pengeluaran, atau tukar mata uang.
                </p>
                <button
                  type="button"
                  onClick=${onDismissHint}
                  className="mt-2 min-h-11 rounded-md bg-emerald-500 px-3 text-[11px] font-bold text-white transition hover:bg-emerald-400"
                >
                  Mengerti
                </button>
              </div>
            `
          : null}
        <div className="absolute bottom-6">
          <${AddButton}
            active=${activeTab === "add" || activeTab === "today"}
            onClick=${onAdd}
          />
        </div>
      </div>

      ${rightItems.map(
        (item) => html`
          <${NavigationItem}
            key=${item.key}
            item=${item}
            active=${activeKey === item.key}
            onChange=${onChange}
          />
        `,
      )}
    </nav>
  `;
}

function QuickActionItem({
  icon: Icon,
  title,
  helper,
  tone = "emerald",
  onClick,
}) {
  const toneClass =
    tone === "blue"
      ? "bg-blue-500/12 text-blue-500"
      : tone === "teal"
        ? "bg-teal-500/12 text-teal-500"
        : "bg-emerald-500/12 text-emerald-500";

  return html`
    <button
      type="button"
      onClick=${onClick}
      className="cs-quick-action flex min-h-[66px] w-full items-center gap-3 rounded-lg p-3 text-left transition hover:border-emerald-400/35"
    >
      <span className=${`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${toneClass}`}>
        <${Icon} aria-hidden="true" className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-extrabold text-slate-950 dark:text-white">
          ${title}
        </span>
        <span className="mt-0.5 block text-[11px] leading-4 text-slate-500 dark:text-slate-400">
          ${helper}
        </span>
      </span>
      <${ArrowRight} aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" />
    </button>
  `;
}

export function QuickActionMenu({
  open = false,
  canExchange = true,
  onClose,
  onAddTransaction,
  onExchange,
  onAddWallet,
}) {
  if (!open) return null;

  return html`
    <div className="cs-quick-action-overlay fixed inset-0 z-[70] flex items-end justify-center md:items-center">
      <button
        type="button"
        aria-label="Tutup menu aksi cepat"
        onClick=${onClose}
        className="absolute inset-0 min-h-0 w-full bg-slate-950/70 backdrop-blur-sm"
      ></button>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-action-title"
        className="cs-quick-action-menu relative flex w-full max-w-sm flex-col overflow-hidden rounded-lg p-4"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200/70 pb-3 dark:border-slate-800">
          <div>
            <h2 id="quick-action-title" className="text-base font-extrabold text-slate-950 dark:text-white">
              Aksi cepat
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Pilih aksi yang ingin kamu lakukan.
            </p>
          </div>
          <button
            type="button"
            aria-label="Tutup"
            onClick=${onClose}
            className="inline-flex h-11 min-h-11 w-11 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-200/70 hover:text-slate-950 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <${X} aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        <div className="cs-quick-action-list mt-3 grid min-h-0 gap-2 overflow-y-auto overscroll-contain">
          <${QuickActionItem}
            icon=${ReceiptText}
            title="Catat transaksi"
            helper="Tambah pemasukan atau pengeluaran."
            onClick=${onAddTransaction}
          />
          ${canExchange
            ? html`
                <${QuickActionItem}
                  icon=${Repeat2}
                  title="Transfer dan tukar valas"
                  helper="Pindahkan saldo antar-dompet dan mata uang."
                  tone="teal"
                  onClick=${onExchange}
                />
              `
            : null}
          <${QuickActionItem}
            icon=${WalletCards}
            title="Tambah dompet"
            helper="Buat akun bank, wallet, atau uang tunai."
            tone="blue"
            onClick=${onAddWallet}
          />
        </div>
      </section>
    </div>
  `;
}
