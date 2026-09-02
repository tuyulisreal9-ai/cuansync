/* Logika tombol angka pada Catat transaksi. Dipisah dari komponennya supaya
   perilakunya bisa diuji langsung, bukan lewat pencocokan teks sumber. */

export const BACKSPACE_KEY = "⌫";
export const DECIMAL_KEY = ".";
export const THOUSANDS_KEY = "000";

/* Batas 12 digit menjaga nominal tetap muat pada satu baris tampilan. */
const MAX_WHOLE_DIGITS = 12;

/* Susunan tiga kolom mengikuti desain, dengan hapus di sudut akhir. Tombol
   kiri bawah menyesuaikan mata uang: rupiah tidak punya pecahan sehingga
   "000" lebih berguna, sedangkan mata uang berpecahan seperti USD butuh
   pemisah desimal supaya belanja 3.50 bisa dicatat. */
export function buildKeypad(fractionDigits) {
  const extraKey = fractionDigits > 0 ? DECIMAL_KEY : THOUSANDS_KEY;
  return ["1", "2", "3", "4", "5", "6", "7", "8", "9", extraKey, "0", BACKSPACE_KEY];
}

export function pressAmountKey(current, key, fractionDigits) {
  const digits = String(current ?? "");

  if (key === BACKSPACE_KEY) return digits.slice(0, -1);

  if (key === DECIMAL_KEY) {
    // Mata uang tanpa pecahan tidak menerima pemisah desimal sama sekali.
    if (fractionDigits <= 0) return digits;
    // Hanya satu pemisah, dan mengetiknya lebih dulu berarti "0.".
    if (digits.includes(DECIMAL_KEY)) return digits;
    return digits ? `${digits}.` : "0.";
  }

  const [whole, decimals] = digits.split(DECIMAL_KEY);
  if (decimals !== undefined) {
    // Sudah di bagian pecahan: batasi sebanyak pecahan mata uangnya.
    const room = fractionDigits - decimals.length;
    if (room <= 0) return digits;
    return `${whole}.${decimals}${key.slice(0, room)}`;
  }

  const next = `${digits}${key}`.replace(/^0+(?=\d)/, "");
  return next.length > MAX_WHOLE_DIGITS ? digits : next;
}

/* Berpindah ke dompet dengan pecahan lebih sedikit harus memangkas angka di
   belakang titik. Tanpa ini "3.50" yang diketik di dompet dolar terbawa ke
   dompet rupiah sebagai nominal yang tidak bisa diketik ulang di sana. */
export function clampAmountFraction(current, fractionDigits) {
  const digits = String(current ?? "");
  if (!digits.includes(DECIMAL_KEY)) return digits;
  const [whole, decimals = ""] = digits.split(DECIMAL_KEY);
  if (fractionDigits <= 0) return whole;
  if (decimals.length <= fractionDigits) return digits;
  return `${whole}.${decimals.slice(0, fractionDigits)}`;
}
