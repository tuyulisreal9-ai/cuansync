import React from "react";
import htm from "htm";

const html = htm.bind(React.createElement);

export function SubmitActionBar({
  label,
  loadingLabel = "Menyimpan...",
  loading,
  disabled = false,
}) {
  const isDisabled = loading || disabled;

  return html`
    <div className="cuan-card-soft mt-5 rounded-[24px] p-2 md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none">
      <button
        type="submit"
        disabled=${isDisabled}
        className="min-h-12 w-full rounded-2xl border border-white/10 bg-brand-600 px-4 py-3.5 text-sm font-semibold text-white shadow-[0_20px_50px_rgba(16,185,129,0.22)] transition duration-300 ease-out hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-[0_28px_70px_rgba(16,185,129,0.28)] disabled:cursor-not-allowed disabled:bg-slate-400 disabled:opacity-60 disabled:shadow-none dark:disabled:bg-slate-700"
      >
        ${loading ? loadingLabel : label}
      </button>
    </div>
  `;
}
