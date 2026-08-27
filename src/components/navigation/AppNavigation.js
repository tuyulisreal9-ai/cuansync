import React from "react";
import htm from "htm";
import {
  ArrowRight,
  House,
  Plus,
  ReceiptText,
  Repeat2,
  Target,
  WalletCards,
  X,
} from "lucide-react";

const html = htm.bind(React.createElement);

const PRIMARY_NAV_ITEMS = [
  { key: "overview", label: "Beranda", icon: House },
  { key: "investment", label: "Dompet", icon: WalletCards },
  { key: "budget", label: "Anggaran & Target", icon: Target },
  { key: "history", label: "Catatan", icon: ReceiptText },
];

function getPrimaryActiveKey(activeTab) {
  if (activeTab === "report") return "investment";
  if (activeTab === "control") return "overview";
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

export function DesktopNavigation({
  activeTab,
  onChange,
  onAdd,
}) {
  const activeKey = getPrimaryActiveKey(activeTab);

  return html`
    <aside className="hidden lg:block">
      <nav
        aria-label="Navigasi utama"
        className="cs-desktop-rail sticky top-6 flex h-[calc(100vh-3rem)] min-h-[30rem] w-[76px] flex-col items-center justify-center gap-2 rounded-lg px-2 py-3"
      >
        <${NavigationItem}
          item=${PRIMARY_NAV_ITEMS[0]}
          active=${activeKey === PRIMARY_NAV_ITEMS[0].key}
          onChange=${onChange}
          desktop=${true}
        />
        <${NavigationItem}
          item=${PRIMARY_NAV_ITEMS[1]}
          active=${activeKey === PRIMARY_NAV_ITEMS[1].key}
          onChange=${onChange}
          desktop=${true}
        />
        <div className="my-1">
          <${AddButton}
            active=${activeTab === "add" || activeTab === "today"}
            onClick=${onAdd}
            desktop=${true}
          />
        </div>
        <${NavigationItem}
          item=${PRIMARY_NAV_ITEMS[2]}
          active=${activeKey === PRIMARY_NAV_ITEMS[2].key}
          onChange=${onChange}
          desktop=${true}
        />
        <${NavigationItem}
          item=${PRIMARY_NAV_ITEMS[3]}
          active=${activeKey === PRIMARY_NAV_ITEMS[3].key}
          onChange=${onChange}
          desktop=${true}
        />
      </nav>
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
