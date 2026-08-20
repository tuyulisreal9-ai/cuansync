import React from "react";
import htm from "htm";
import {
  HIDDEN_BALANCE_TEXT,
  formatMoney,
  formatMoneyCompact,
} from "../../lib/currency.js";

const html = htm.bind(React.createElement);

export function AmountFormatter({
  amount,
  currency,
  visible = true,
  compact = false,
  className = "",
}) {
  const value = visible
    ? compact
      ? formatMoneyCompact(amount, currency)
      : formatMoney(amount, currency)
    : HIDDEN_BALANCE_TEXT;

  return html`
    <span
      className=${`inline-block min-w-[6ch] max-w-full tabular-nums [overflow-wrap:anywhere] ${className}`}
    >
      ${value}
    </span>
  `;
}
