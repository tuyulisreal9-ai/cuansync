import React from "react";
import htm from "htm";
import { FormActionDock } from "./FormActionDock.js";

const html = htm.bind(React.createElement);

export function SubmitActionBar({
  label,
  loadingLabel = "Menyimpan...",
  loading,
  disabled = false,
}) {
  const isDisabled = loading || disabled;

  return html`
    <${FormActionDock} fixedOnMobile=${true} className="mt-5 lg:mt-0">
      <button
        type="submit"
        disabled=${isDisabled}
        className="min-h-12 w-full rounded-xl border border-white/10 bg-brand-600 px-4 py-3.5 text-sm font-semibold text-white shadow-[0_16px_36px_rgba(16,185,129,0.2)] transition duration-300 ease-out hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:opacity-60 disabled:shadow-none dark:disabled:bg-slate-700"
      >
        ${loading ? loadingLabel : label}
      </button>
    <//>
  `;
}
