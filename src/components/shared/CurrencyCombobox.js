import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import htm from "htm";
import {
  DEFAULT_ACTIVE_CURRENCIES,
  getCurrencyMeta,
  groupCurrencyOptions,
  normalizeCurrencyCode,
  normalizeCurrencyList,
} from "../../lib/currency.js";

const html = htm.bind(React.createElement);
const BUTTON_STRUCTURE_CLASS =
  "flex min-h-11 w-full items-center justify-between gap-3 text-left";
const DEFAULT_BUTTON_CLASS =
  "cs-entry-input rounded-lg px-3 py-2.5 text-sm transition";
const DESKTOP_QUERY = "(min-width: 1024px)";

function matchesDesktop() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  try {
    return window.matchMedia(DESKTOP_QUERY).matches;
  } catch {
    return false;
  }
}

/* visualViewport melaporkan area yang tersisa setelah keyboard menutupi
   sebagian layar, lengkap dengan pergeserannya. Bila tidak tersedia, jatuh
   kembali ke ukuran jendela biasa. */
function readVisualViewport() {
  if (typeof window === "undefined") return { height: 0, offsetTop: 0 };
  const vv = window.visualViewport;
  if (!vv) return { height: window.innerHeight || 0, offsetTop: 0 };
  return { height: vv.height, offsetTop: vv.offsetTop };
}

export function CurrencyCombobox({
  value,
  onChange,
  currencies = DEFAULT_ACTIVE_CURRENCIES,
  disabled = false,
  ariaLabel = "Pilih mata uang",
  buttonClassName = DEFAULT_BUTTON_CLASS,
  placeholder = "Cari kode atau nama mata uang",
}) {
  const rootRef = useRef(null);
  const searchRef = useRef(null);
  /* Panel dirender lewat portal, jadi ia bukan lagi keturunan rootRef di DOM.
     Tanpa ref terpisah, klik di dalam panel akan dianggap klik di luar dan
     menutup daftarnya sebelum pilihan sempat terbaca. */
  const panelRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isDesktop, setIsDesktop] = useState(() => matchesDesktop());
  /* Ukuran dan posisi area yang benar benar terlihat. Saat keyboard ponsel
     naik, visualViewport menyusut dan bergeser, sedangkan innerHeight tidak
     berubah. Tanpa mengikutinya daftar mata uang tertutup keyboard. */
  const [viewport, setViewport] = useState(readVisualViewport);

  useEffect(() => {
    const media =
      typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia(DESKTOP_QUERY)
        : null;
    if (!media) return undefined;
    const sync = () => setIsDesktop(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!open || isDesktop) return undefined;
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return undefined;
    const sync = () => setViewport(readVisualViewport());
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, [open, isDesktop]);
  const selectedCode = normalizeCurrencyCode(value);
  const availableCurrencies = normalizeCurrencyList(
    [...currencies, selectedCode],
    { ensureBase: false },
  );
  const availableKey = availableCurrencies.join("|");
  const groups = useMemo(
    () => groupCurrencyOptions(availableCurrencies, query),
    [availableKey, query],
  );
  const selected = getCurrencyMeta(selectedCode);

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      const diDalam =
        rootRef.current?.contains(event.target) ||
        panelRef.current?.contains(event.target);
      if (!diDalam) closePicker();
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") closePicker();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    requestAnimationFrame(() => searchRef.current?.focus());

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function closePicker() {
    setOpen(false);
    setQuery("");
  }

  function selectCurrency(code) {
    onChange?.(normalizeCurrencyCode(code));
    closePicker();
  }

  /* Di ponsel daftar tampil sebagai sheet yang tingginya mengikuti
     visualViewport, jadi ia berhenti tepat di atas keyboard dan tetap bisa
     digulir. Sebelumnya ia menempel di bawah tombol sehingga tertutup begitu
     keyboard naik. Dirender lewat portal karena sheet induknya memakai
     backdrop-filter, dan itu membuat containing block bagi turunan
     position: fixed sekaligus memotong isinya. Di desktop bentuknya tetap
     dropdown biasa yang menempel di bawah tombol. */
  const picker = html`
    <${React.Fragment}>
      ${isDesktop
        ? null
        : html`
            <button
              type="button"
              aria-label="Tutup pilihan mata uang"
              onClick=${closePicker}
              className="cs-sheet-scrim dc-overlay-in fixed inset-0 z-[79]"
            ></button>
          `}
      <div
        ref=${panelRef}
        className=${isDesktop
          ? "absolute left-0 right-0 z-[80] mt-2 flex min-w-[18rem] flex-col overflow-hidden rounded-xl border"
          : "dc-sheet-up fixed inset-x-0 z-[80] flex flex-col overflow-hidden rounded-t-[26px] border-t"}
        style=${isDesktop
          ? {
              background: "var(--cs-card)",
              borderColor: "var(--cs-line)",
              boxShadow: "var(--cs-shadow)",
            }
          : {
              background: "var(--cs-bg)",
              borderColor: "var(--cs-line)",
              boxShadow: "0 -12px 40px rgba(0,0,0,0.18)",
              top: `${viewport.offsetTop + viewport.height * 0.32}px`,
              height: `${Math.max(viewport.height * 0.68, 220)}px`,
            }}
      >
              <div
                className="shrink-0 border-b p-2.5"
                style=${{ borderColor: "var(--cs-line)" }}
              >
                <input
                  ref=${searchRef}
                  type="search"
                  value=${query}
                  onChange=${(event) => setQuery(event.target.value)}
                  placeholder=${placeholder}
                  aria-label="Cari mata uang"
                  className="min-h-11 w-full rounded-[14px] border px-3.5 text-[14.5px] outline-none cs-edit-input"
                />
              </div>
              <div role="listbox" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 lg:max-h-72">
                ${groups.length
                  ? groups.map(
                      (group) => html`
                        <section key=${group.region} aria-label=${group.label}>
                          <p
                            className="px-2 pb-1 pt-2 text-xs"
                            style=${{ color: "var(--cs-mut)" }}
                          >
                            ${group.label}
                          </p>
                          <div className="grid gap-1">
                            ${group.options.map(
                              (option) => html`
                                <button
                                  key=${option.value}
                                  type="button"
                                  role="option"
                                  aria-selected=${option.value === selectedCode}
                                  onClick=${() => selectCurrency(option.value)}
                                  className="dc-row dc-press grid min-h-12 grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-2 rounded-[14px] px-3 text-left"
                                  style=${option.value === selectedCode
                                    ? {
                                        background: "var(--cs-sel-bg)",
                                        color: "var(--cs-sel-fg)",
                                      }
                                    : { color: "var(--cs-ink)" }}
                                >
                                  <strong className="dc-num text-[13px]">
                                    ${option.value}
                                  </strong>
                                  <span className="truncate text-[13.5px] font-medium">
                                    ${option.name}
                                  </span>
                                </button>
                              `,
                            )}
                          </div>
                        </section>
                      `,
                    )
                  : html`
                      <p
                        className="px-3 py-8 text-center text-[13px]"
                        style=${{ color: "var(--cs-mut)" }}
                      >
                        Mata uang tidak ditemukan.
                      </p>
                    `}
              </div>
            </div>
    <//>
  `;

  return html`
    <div ref=${rootRef} className="relative min-w-0">
      <button
        type="button"
        disabled=${disabled}
        aria-label=${ariaLabel}
        aria-haspopup="listbox"
        aria-expanded=${open}
        onClick=${() => setOpen((current) => !current)}
        className=${`${BUTTON_STRUCTURE_CLASS} ${buttonClassName} disabled:cursor-not-allowed disabled:opacity-60`}
      >
        <span className="min-w-0">
          <strong className="block text-sm font-bold">${selectedCode}</strong>
          <span
            className="block truncate text-[11px]"
            style=${{ color: "var(--cs-mut)" }}
          >
            ${selected.name}
          </span>
        </span>
        <span
          aria-hidden="true"
          className="shrink-0 text-xs"
          style=${{ color: "var(--cs-faint)" }}
        >
          ${open ? "▲" : "▼"}
        </span>
      </button>

      ${open ? (isDesktop ? picker : createPortal(picker, document.body)) : null}
    </div>
  `;
}
