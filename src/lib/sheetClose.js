import { useCallback, useEffect, useRef, useState } from "react";

/* Durasi ini harus sama dengan --dc-element di styles.css. Kalau berbeda,
   sheet akan dilepas sebelum animasinya selesai atau menggantung sesudahnya. */
export const SHEET_CLOSE_MS = 200;

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/* Menunda pemanggilan onClose supaya animasi keluar sempat berjalan.
   React melepas simpul sheet begitu open menjadi false, jadi tanpa jeda ini
   sheet hilang seketika dan hanya gerak membukanya yang terlihat.

   Mengembalikan { closing, requestClose }. Pakai closing untuk memilih kelas
   animasi, dan requestClose sebagai pengganti onClose pada tirai, tombol
   tutup, tombol Escape, serta setelah simpan berhasil. */
export function useSheetClose(onClose, open = true) {
  const [closing, setClosing] = useState(false);
  const timerRef = useRef(null);

  // Bersihkan timer bila komponen dilepas lebih dulu, misalnya karena induknya
  // berpindah halaman, supaya onClose tidak dipanggil pada simpul yang mati.
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  // Saat sheet dibuka lagi, pastikan sisa keadaan menutup tidak terbawa.
  useEffect(() => {
    if (!open) return;
    setClosing(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [open]);

  const requestClose = useCallback(() => {
    if (timerRef.current) return;
    if (prefersReducedMotion()) {
      onClose?.();
      return;
    }
    setClosing(true);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setClosing(false);
      onClose?.();
    }, SHEET_CLOSE_MS);
  }, [onClose]);

  return { closing, requestClose };
}
