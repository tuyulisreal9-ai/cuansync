import React, { createContext, useContext, useMemo } from "react";
import { formatCurrency, HIDDEN_BALANCE_TEXT } from "./currency.js";

/* Sakelar privasi dibagikan lewat context, bukan prop yang dioper berlapis.
   Halaman Dompet menumpuk komponen sampai empat tingkat: halaman > kartu
   dompet > sheet detail > baris sumber dana tabungan. Satu prop yang lupa
   dioper di tengah rantai itu berarti ada nominal yang tetap terbaca padahal
   privasi sedang menyala, dan itu justru kebocoran yang paling sulit
   disadari. Dengan context, komponen sedalam apa pun membaca nilai yang sama
   dan kebocoran seperti itu tidak mungkin terjadi. */
const BalanceVisibilityContext = createContext(true);
/* Sakelarnya ikut dibagikan supaya halaman mana pun bisa memasang tombol
   mata tanpa perlu menarik callback dari App lewat dua lapis prop. */
const BalanceToggleContext = createContext(null);

export function BalanceVisibilityProvider({ visible = true, onToggle, children }) {
  return React.createElement(
    BalanceVisibilityContext.Provider,
    { value: visible !== false },
    React.createElement(
      BalanceToggleContext.Provider,
      { value: onToggle || null },
      children,
    ),
  );
}

/* Mengembalikan null bila tidak ada penyedia sakelar, sehingga pemanggil bisa
   memilih untuk tidak menampilkan tombolnya sama sekali. */
export function useToggleBalanceVisible() {
  return useContext(BalanceToggleContext);
}

export function useBalanceVisible() {
  return useContext(BalanceVisibilityContext);
}

/* Pengganti formatCurrency untuk nominal yang ikut privasi. Nominal yang
   sengaja tidak ikut privasi, misalnya angka di dalam form yang sedang
   diketik, tetap memanggil formatCurrency langsung. */
export function useMaskedCurrency() {
  const visible = useBalanceVisible();
  return useMemo(
    () => (value, currency) =>
      visible ? formatCurrency(value, currency) : HIDDEN_BALANCE_TEXT,
    [visible],
  );
}

/* Untuk teks yang nominalnya sudah dirakit di tempat lain, misalnya
   "≈ Rp 8.928.571" atau hasil getTransactionCompactAmount. Teks kosong
   dikembalikan apa adanya supaya pemanggil yang memakai "||" masih bisa
   jatuh ke teks cadangannya, seperti jam transaksi. */
export function useMaskedText() {
  const visible = useBalanceVisible();
  return useMemo(
    () => (text) => (visible || !text ? text : HIDDEN_BALANCE_TEXT),
    [visible],
  );
}
