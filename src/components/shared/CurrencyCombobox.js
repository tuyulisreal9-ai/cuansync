import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
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
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
        setQuery("");
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    requestAnimationFrame(() => searchRef.current?.focus());

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function selectCurrency(code) {
    onChange?.(normalizeCurrencyCode(code));
    setOpen(false);
    setQuery("");
  }

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
          <strong className="block text-sm font-black">${selectedCode}</strong>
          <span className="block truncate text-[10px] font-semibold text-slate-500 dark:text-slate-400">
            ${selected.name}
          </span>
        </span>
        <span aria-hidden="true" className="shrink-0 text-xs text-slate-400">
          ${open ? "▲" : "▼"}
        </span>
      </button>

      ${open
        ? html`
            <div
              className="absolute left-0 right-0 z-[80] mt-2 min-w-[18rem] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950"
            >
              <div className="border-b border-slate-200 p-2 dark:border-slate-800">
                <input
                  ref=${searchRef}
                  type="search"
                  value=${query}
                  onChange=${(event) => setQuery(event.target.value)}
                  placeholder=${placeholder}
                  aria-label="Cari mata uang"
                  className="min-h-10 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm text-slate-950 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>
              <div role="listbox" className="max-h-72 overflow-y-auto p-2">
                ${groups.length
                  ? groups.map(
                      (group) => html`
                        <section key=${group.region} aria-label=${group.label}>
                          <p className="px-2 pb-1 pt-2 text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">
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
                                  className=${`grid min-h-11 grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-2 rounded-lg px-2 text-left transition ${
                                    option.value === selectedCode
                                      ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
                                      : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
                                  }`}
                                >
                                  <strong className="text-xs font-black">${option.value}</strong>
                                  <span className="truncate text-xs font-semibold">${option.name}</span>
                                </button>
                              `,
                            )}
                          </div>
                        </section>
                      `,
                    )
                  : html`
                      <p className="px-3 py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                        Mata uang tidak ditemukan.
                      </p>
                    `}
              </div>
            </div>
          `
        : null}
    </div>
  `;
}
