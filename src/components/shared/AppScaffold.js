import React from "https://esm.sh/react@18.3.1";
import htm from "https://esm.sh/htm@3.1.1";

const html = htm.bind(React.createElement);
const PANEL_CLASS = "relative overflow-hidden rounded-[30px] cuan-card";

export function PremiumMeshBackground() {
  return html`
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[var(--cs-app-bg)]">
      <div className="cs-background-grid absolute inset-0"></div>
    </div>
  `;
}

export function AppLoadingScreen({ appName = "CUANSYNC" }) {
  return html`
    <main className="relative isolate min-h-screen overflow-hidden px-4 py-7 md:px-6 lg:px-8">
      <${PremiumMeshBackground} />
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-xl items-center justify-center">
        <section className=${`${PANEL_CLASS} w-full p-6 text-center md:p-8`}>
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.14),transparent_42%)] opacity-80"></div>
          <div className="relative">
            <div className="mx-auto inline-flex rounded-full border border-brand-300/30 bg-brand-600 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-white shadow-[0_12px_30px_rgba(16,185,129,0.20)]">
              ${appName}
            </div>
            <div
              role="status"
              aria-live="polite"
              className="mx-auto mt-6 flex h-12 w-12 items-center justify-center rounded-full border border-brand-300/25 bg-brand-500/10 text-sm font-black text-brand-700 dark:text-brand-200"
            >
              ...
            </div>
            <h1 className="mt-5 font-display text-2xl font-black text-slate-950 dark:text-white">
              Menyiapkan akun
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-600 dark:text-slate-300/80">
              Sebentar, CUANSYNC sedang mengambil data dan pilihan mata uangmu.
            </p>
          </div>
        </section>
      </div>
    </main>
  `;
}
