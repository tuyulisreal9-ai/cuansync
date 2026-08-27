import React from "react";
import htm from "htm";

const html = htm.bind(React.createElement);
export function PremiumMeshBackground() {
  return html`
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[var(--cs-app-bg)]">
      <div className="cs-background-grid absolute inset-0"></div>
    </div>
  `;
}

export function AppLoadingScreen({ appName = "CUANSYNC" }) {
  return html`
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden px-6 py-10">
      <${PremiumMeshBackground} />
      <section className="relative z-10 flex w-full max-w-xs flex-col items-center text-center">
        <img
          src="/icons/icon-96.webp"
          alt=""
          className="h-16 w-16 rounded-2xl object-contain shadow-[0_18px_42px_rgba(16,185,129,0.18)]"
        />
        <h1 className="mt-4 font-display text-xl font-black tracking-tight text-slate-950 dark:text-white">
          ${appName}
        </h1>
        <p className="mt-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
          Membuka dompet Anda
        </p>
        <div
          role="status"
          aria-live="polite"
          aria-label="Memuat aplikasi"
          className="mt-5 h-1 w-24 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
        >
          <span className="block h-full w-2/3 animate-pulse rounded-full bg-emerald-500"></span>
        </div>
      </section>
    </main>
  `;
}
