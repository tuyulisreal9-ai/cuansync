import React from "react";
import htm from "htm";

const html = htm.bind(React.createElement);

export function FormActionDock({
  children,
  className = "",
  aboveNavigation = false,
  fixedOnMobile = false,
}) {
  if (fixedOnMobile) {
    return html`
      <div className="h-20 lg:h-auto">
        <div
          className=${`cs-form-action-dock fixed inset-x-3 bottom-[calc(7.25rem+env(safe-area-inset-bottom))] z-50 rounded-2xl border border-slate-200/80 bg-white/94 p-2 shadow-[0_18px_48px_rgba(15,23,42,0.2)] backdrop-blur-xl lg:static lg:rounded-none lg:border-x-0 lg:border-b-0 lg:bg-white/92 lg:px-1 lg:pb-[calc(.25rem+env(safe-area-inset-bottom))] lg:pt-3 lg:shadow-none dark:border-slate-800 dark:bg-slate-950/94 dark:lg:bg-slate-950/92 ${className}`}
        >
          ${children}
        </div>
      </div>
    `;
  }

  return html`
    <div
      className=${`cs-form-action-dock sticky z-30 -mx-1 mt-1 border-t border-slate-200/80 bg-white/92 px-1 pb-[calc(.25rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/92 ${
        aboveNavigation
          ? "bottom-[calc(4.25rem+env(safe-area-inset-bottom))] lg:bottom-0"
          : "bottom-0"
      } ${className}`}
    >
      ${children}
    </div>
  `;
}
