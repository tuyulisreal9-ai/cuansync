import React from "react";
import htm from "htm";
import { PremiumMeshBackground } from "../shared/AppScaffold.js";

const html = htm.bind(React.createElement);
const PANEL_CLASS = "relative overflow-hidden rounded-[30px] cuan-card";

export { EmailAuthScreen as AuthScreen } from "./EmailAuth.js";

export function AuthRecoveryScreen({
  onRetry,
  error,
  appName = "CUANSYNC",
}) {
  return html`
    <main className="relative isolate min-h-screen overflow-x-clip px-4 py-8 md:px-6 lg:px-8">
      <${PremiumMeshBackground} />
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center justify-center">
        <section className=${`${PANEL_CLASS} w-full p-7 md:p-8`}>
          <div className="inline-flex rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
            Pemulihan sesi
          </div>
          <h1 className="mt-5 font-display text-2xl font-bold text-slate-950 dark:text-white">
            ${appName} belum dapat memeriksa sesi Anda
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300/80">
            Sesi yang tersimpan tidak dihapus. Periksa koneksi dan waktu otomatis perangkat,
            lalu coba pulihkan kembali.
          </p>
          ${error
            ? html`
                <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-xs leading-5 text-amber-800 dark:text-amber-200">
                  ${error}
                </div>
              `
            : null}
          <button
            type="button"
            onClick=${onRetry}
            className="mt-6 w-full rounded-2xl bg-brand-600 px-4 py-3.5 text-sm font-semibold text-white shadow-[0_20px_50px_rgba(16,185,129,0.2)] transition hover:-translate-y-0.5"
          >
            Coba pulihkan sesi
          </button>
        </section>
      </div>
    </main>
  `;
}
