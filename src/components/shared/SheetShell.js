import React, { useEffect } from "react";
import { useSheetClose } from "../../lib/sheetClose.js";
import htm from "htm";

const html = htm.bind(React.createElement);

export function SheetShell({ open, title, helper, onClose, children, labelledBy }) {
  const { closing, requestClose } = useSheetClose(onClose, open);

  useEffect(() => {
    if (!open) return undefined;
    function handleKeyDown(event) {
      if (event.key === "Escape") requestClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, requestClose]);

  if (!open) return null;

  return html`
    <div
      className="fixed inset-0 flex items-end justify-center px-2 pb-[calc(.5rem+env(safe-area-inset-bottom))] pt-12 md:items-center md:p-6"
      style=${{ zIndex: 1000 }}
    >
      ${/* Warna dan gerak mengikuti sheet di artifact: tirai rgba(20,18,15,0.42)
            dengan overlayIn, panel naik lewat sheetUp, radius 26 di dua sudut
            atas, dan aksi tutup berupa teks, bukan tombol bundar. */ null}
      <button
        type="button"
        aria-label="Tutup panel"
        onClick=${requestClose}
        className=${`${closing ? "dc-overlay-out" : "dc-overlay-in"} absolute inset-0`}
        style=${{ background: "rgba(20,18,15,0.42)" }}
      ></button>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby=${labelledBy}
        className=${`settings-bottom-sheet ${closing ? "dc-sheet-down" : "dc-sheet-up"} relative z-10 flex max-h-[calc(100dvh-.75rem)] w-full max-w-md flex-col gap-4 overflow-hidden px-5 pb-6 pt-3 md:max-h-[88dvh]`}
        style=${{
          background: "var(--cs-bg)",
          color: "var(--cs-ink)",
          borderRadius: "26px 26px 0 0",
          boxShadow: "0 -12px 40px rgba(0,0,0,0.18)",
        }}
      >
        <span
          className="mx-auto block h-1 w-[42px] shrink-0 rounded-full"
          style=${{ background: "var(--cs-dim)" }}
        ></span>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2
              id=${labelledBy}
              className="text-[17px] font-bold tracking-[-0.2px]"
            >
              ${title}
            </h2>
            ${helper
              ? html`
                  <p
                    className="mt-0.5 text-[13px] leading-[1.45]"
                    style=${{ color: "var(--cs-mut)" }}
                  >
                    ${helper}
                  </p>
                `
              : null}
          </div>
          <button
            type="button"
            onClick=${requestClose}
            aria-label="Tutup"
            className="flex min-h-11 shrink-0 items-center pl-4 text-[13px]"
            style=${{ color: "var(--cs-mut)" }}
          >
            Tutup
          </button>
        </div>
        <div
          data-sheet-scroll="true"
          className="min-h-0 overflow-y-auto overscroll-contain pb-1"
        >
          ${children}
        </div>
      </section>
    </div>
  `;
}
