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
          style=${{
            background: "var(--cs-card)",
            borderColor: "var(--cs-line)",
            boxShadow: "var(--cs-shadow)",
          }}
          className=${`cs-form-action-dock fixed inset-x-3 bottom-[calc(7.25rem+env(safe-area-inset-bottom))] z-50 rounded-[18px] border p-2 backdrop-blur-xl lg:static lg:rounded-none lg:border-x-0 lg:border-b-0 lg:px-1 lg:pb-[calc(.25rem+env(safe-area-inset-bottom))] lg:pt-3 lg:shadow-none ${className}`}
        >
          ${children}
        </div>
      </div>
    `;
  }

  return html`
    <div
      style=${{
        borderTopColor: "var(--cs-line)",
        background: "var(--cs-card)",
      }}
      className=${`cs-form-action-dock sticky z-30 -mx-1 mt-1 border-t px-1 pb-[calc(.25rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl ${
        aboveNavigation
          ? "bottom-[calc(4.25rem+env(safe-area-inset-bottom))] lg:bottom-0"
          : "bottom-0"
      } ${className}`}
    >
      ${children}
    </div>
  `;
}
