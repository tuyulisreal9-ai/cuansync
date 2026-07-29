import React, { useEffect } from "https://esm.sh/react@18.3.1";
import htm from "https://esm.sh/htm@3.1.1";

const html = htm.bind(React.createElement);

export function SheetShell({ open, title, helper, onClose, children, labelledBy }) {
  useEffect(() => {
    if (!open) return undefined;
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return html`
    <div
      className="fixed inset-0 flex items-end justify-center px-3 pb-3 pt-16 md:items-center md:p-6"
      style=${{ zIndex: 1000 }}
    >
      <button
        type="button"
        aria-label="Tutup panel"
        onClick=${onClose}
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
      ></button>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby=${labelledBy}
        className="settings-bottom-sheet relative z-10 w-full max-w-md overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/95 p-4 text-slate-950 shadow-[0_-24px_80px_rgba(15,23,42,0.24)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/95 dark:text-white dark:shadow-black/50"
      >
        <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-slate-300 dark:bg-slate-700"></div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id=${labelledBy} className="font-display text-lg font-black">
              ${title}
            </h2>
            ${helper
              ? html`
                  <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300">
                    ${helper}
                  </p>
                `
              : null}
          </div>
          <button
            type="button"
            onClick=${onClose}
            aria-label="Tutup"
            className="inline-flex h-11 min-h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-300/70 bg-white/70 text-sm font-black text-slate-700 transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/70 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
          >
            x
          </button>
        </div>
        <div className="mt-4 max-h-[70svh] overflow-y-auto pr-1">
          ${children}
        </div>
      </section>
    </div>
  `;
}
