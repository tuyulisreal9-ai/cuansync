import React from "react";
import htm from "htm";

const html = htm.bind(React.createElement);

export function AvatarBadge({ src, initials, size = "md" }) {
  const sizeClass =
    size === "lg"
      ? "h-20 w-20 text-xl"
      : size === "md"
        ? "h-12 w-12 text-sm"
        : "h-10 w-10 text-xs";

  return html`
    <div
      className=${`inline-flex items-center justify-center overflow-hidden rounded-full border border-brand-300/40 bg-brand-600 font-bold text-white shadow-[0_12px_30px_rgba(16,185,129,0.22)] ring-2 ring-brand-500/12 dark:border-white/10 dark:ring-brand-300/10 ${sizeClass}`}
    >
      ${src
        ? html`
            <img
              src=${src}
              alt="Foto profil"
              className="h-full w-full object-cover"
            />
          `
        : initials}
    </div>
  `;
}
