import React from "react";
import htm from "htm";

const html = htm.bind(React.createElement);

/* Desain menempatkan avatar sebagai lingkaran 44px berlatar --track dengan
   inisial berwarna --body dan cincin 2px, bukan lingkaran penuh berwarna
   aksen. Ukuran md mengikuti angka desain: 44px dengan teks 13px. */
export function AvatarBadge({ src, initials, size = "md" }) {
  const sizeClass =
    size === "lg"
      ? "h-20 w-20 text-xl"
      : size === "md"
        ? "h-11 w-11 text-[13px]"
        : "h-10 w-10 text-xs";

  return html`
    <div
      style=${{
        background: "var(--cs-track)",
        color: "var(--cs-body)",
        borderColor: "var(--cs-line)",
      }}
      className=${`inline-flex items-center justify-center overflow-hidden rounded-full border-2 font-bold ${sizeClass}`}
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
