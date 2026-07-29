import React from "https://esm.sh/react@18.3.1";
import htm from "https://esm.sh/htm@3.1.1";
import { formatControlMoney } from "../../domain/control.js";

const html = htm.bind(React.createElement);

export const CONTROL_PANEL =
  "rounded-xl border border-slate-200/90 bg-white/80 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 dark:shadow-none";
export const CONTROL_MUTED = "text-slate-600 dark:text-slate-400";

export function ControlMoney({
  value,
  currency,
  visible,
  className = "",
}) {
  return html`
    <span className=${`tabular-nums ${className}`}>
      ${formatControlMoney(value, currency, visible)}
    </span>
  `;
}

export function ControlStatusDot({ tone = "muted" }) {
  const tones = {
    safe: "bg-emerald-400",
    warning: "bg-amber-400",
    danger: "bg-rose-400",
    muted: "bg-slate-400",
  };
  return html`
    <span
      className=${`h-2 w-2 shrink-0 rounded-full ${tones[tone] || tones.muted}`}
    ></span>
  `;
}

export function ControlSummaryLine({ label, value, tone = "" }) {
  return html`
    <div className="flex items-center justify-between gap-4 py-1.5 text-xs">
      <span className=${CONTROL_MUTED}>${label}</span>
      <strong
        className=${`text-right font-extrabold tabular-nums text-slate-950 dark:text-white ${tone}`}
      >
        ${value}
      </strong>
    </div>
  `;
}
