import React from "https://esm.sh/react@18.3.1";
import htm from "https://esm.sh/htm@3.1.1";

const html = htm.bind(React.createElement);
const PANEL_CLASS = "relative overflow-hidden rounded-[30px] cuan-card";

const MESH_ORBS = [
  {
    id: "emerald-a",
    className:
      "-left-24 top-0 h-[28rem] w-[28rem] bg-emerald-300/28 dark:bg-emerald-400/20",
    animation: "premium-float-a 26s ease-in-out infinite alternate",
  },
  {
    id: "indigo-a",
    className:
      "right-[-6rem] top-16 h-[30rem] w-[30rem] bg-sky-300/24 dark:bg-indigo-400/18",
    animation: "premium-float-b 32s ease-in-out infinite alternate",
  },
  {
    id: "blue-a",
    className:
      "left-1/3 top-1/2 h-[24rem] w-[24rem] bg-cyan-300/18 dark:bg-blue-500/16",
    animation: "premium-float-c 28s ease-in-out infinite alternate",
  },
  {
    id: "emerald-b",
    className:
      "bottom-[-8rem] right-1/4 h-[26rem] w-[26rem] bg-emerald-200/24 dark:bg-emerald-300/14",
    animation: "premium-float-d 34s ease-in-out infinite alternate",
  },
];

export function PremiumMeshBackground() {
  return html`
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <style>
        ${`
          @keyframes premium-float-a {
            0% { transform: translate3d(0, 0, 0) scale(1); opacity: 0.28; }
            33% { transform: translate3d(4rem, -2rem, 0) scale(1.06); opacity: 0.18; }
            66% { transform: translate3d(-2rem, 3rem, 0) scale(0.96); opacity: 0.24; }
            100% { transform: translate3d(3rem, 1rem, 0) scale(1.08); opacity: 0.2; }
          }
          @keyframes premium-float-b {
            0% { transform: translate3d(0, 0, 0) scale(1.02); opacity: 0.22; }
            30% { transform: translate3d(-3rem, 2rem, 0) scale(1.08); opacity: 0.18; }
            70% { transform: translate3d(2rem, -3rem, 0) scale(0.95); opacity: 0.25; }
            100% { transform: translate3d(-2rem, 3rem, 0) scale(1.04); opacity: 0.17; }
          }
          @keyframes premium-float-c {
            0% { transform: translate3d(0, 0, 0) scale(1); opacity: 0.18; }
            35% { transform: translate3d(3rem, 2rem, 0) scale(1.1); opacity: 0.14; }
            65% { transform: translate3d(-3rem, -2rem, 0) scale(0.92); opacity: 0.22; }
            100% { transform: translate3d(1rem, -1rem, 0) scale(1.06); opacity: 0.16; }
          }
          @keyframes premium-float-d {
            0% { transform: translate3d(0, 0, 0) scale(0.98); opacity: 0.18; }
            50% { transform: translate3d(-2rem, -3rem, 0) scale(1.08); opacity: 0.12; }
            100% { transform: translate3d(3rem, 1rem, 0) scale(1.02); opacity: 0.2; }
          }
        `}
      </style>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#f8fbff_0%,#eefbf6_44%,#edf6ff_100%)] dark:bg-[linear-gradient(180deg,#030712_0%,#071221_38%,#0f172a_100%)]"></div>
      <div className="absolute inset-x-0 top-0 h-[32rem] bg-[radial-gradient(circle_at_18%_10%,rgba(16,185,129,0.18),transparent_34%),radial-gradient(circle_at_84%_12%,rgba(56,189,248,0.14),transparent_30%),radial-gradient(circle_at_top,rgba(255,255,255,0.58),transparent_42%)] dark:bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.14),transparent_34%)]"></div>
      ${MESH_ORBS.map(
        (orb) => html`
          <div
            key=${orb.id}
            className=${`absolute rounded-full blur-[120px] motion-reduce:animate-none ${orb.className}`}
            style=${{ animation: orb.animation }}
          ></div>
        `,
      )}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.035)_1px,transparent_1px)] bg-[size:140px_140px] opacity-35 dark:bg-[linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] dark:opacity-[0.10]"></div>
      <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-white/60 to-transparent dark:from-slate-950/40"></div>
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
