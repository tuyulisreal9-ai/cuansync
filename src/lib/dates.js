const dateTimeFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

const dayFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
});

const monthFormatter = new Intl.DateTimeFormat("id-ID", {
  month: "long",
  year: "numeric",
});

const longDateFormatter = new Intl.DateTimeFormat("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const shortDateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
});

const shortTimeFormatter = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDateTime(value) {
  return dateTimeFormatter.format(new Date(value));
}

export function formatDay(value) {
  return dayFormatter.format(new Date(value));
}

export function formatMonthKey(value) {
  const [year, month] = String(value).split("-");
  return monthFormatter.format(new Date(Number(year), Number(month) - 1, 1));
}

export function formatLongDate(value) {
  return longDateFormatter.format(new Date(value));
}

export function formatShortTime(value) {
  return shortTimeFormatter.format(new Date(value));
}

export function formatShortDateTime(value) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

/* Waktu relatif untuk baris aktivitas: "2 jam lalu" jauh lebih cepat dibaca
   daripada jam persisnya saat yang dicari adalah "tadi atau kemarin".

   Hari kalender diperiksa lebih dulu daripada selisih jam. Transaksi kemarin
   malam yang dilihat sore ini berjarak 21 jam, dan "21 jam lalu" menuntut
   pembaca menghitung sendiri bahwa itu kemarin. */
export function formatRelativeTime(value, now = new Date()) {
  // new Date(null) menghasilkan epoch 1970 yang valid, bukan Invalid Date,
  // jadi nilai kosong harus ditolak lebih dulu supaya tidak tampil "1 Jan".
  if (!value) return "";
  const waktu = new Date(value);
  if (Number.isNaN(waktu.getTime())) return "";

  const selisihDetik = Math.floor((now.getTime() - waktu.getTime()) / 1000);
  // Jam perangkat bisa tertinggal dari stempel server, jadi selisih negatif
  // yang kecil diperlakukan sebagai baru saja, bukan "dalam -3 menit".
  if (selisihDetik < 60) return "baru saja";

  const menit = Math.floor(selisihDetik / 60);
  if (menit < 60) return `${menit} menit lalu`;

  const hariIni = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const hariTransaksi = new Date(
    waktu.getFullYear(),
    waktu.getMonth(),
    waktu.getDate(),
  );
  const selisihHari = Math.round(
    (hariIni.getTime() - hariTransaksi.getTime()) / 86400000,
  );

  if (selisihHari <= 0) return `${Math.floor(menit / 60)} jam lalu`;
  if (selisihHari === 1) return "kemarin";
  return shortDateFormatter.format(waktu);
}

export function getLocalDayKey(value) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getMonthKey(value = new Date()) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function getMonthParts(monthKey = getMonthKey()) {
  const [yearRaw, monthRaw] = String(monthKey).split("-");
  const year = Number(yearRaw) || new Date().getFullYear();
  const month = Number(monthRaw) || new Date().getMonth() + 1;
  return { year, month };
}

export function getMonthMeta(monthKey = getMonthKey()) {
  const { year, month } = getMonthParts(monthKey);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  const daysInMonth = end.getDate();
  const isCurrentMonth = monthKey === getMonthKey();
  const elapsedDays = isCurrentMonth ? new Date().getDate() : daysInMonth;

  return {
    year,
    month,
    start,
    end,
    daysInMonth,
    elapsedDays: Math.max(Math.min(elapsedDays, daysInMonth), 1),
    isCurrentMonth,
    label: formatMonthKey(monthKey),
  };
}

export function shiftMonthKey(monthKey, offset) {
  const { year, month } = getMonthParts(monthKey);
  return getMonthKey(new Date(year, month - 1 + offset, 1));
}

export function getDateInputValue(value = new Date()) {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function toInputDateTime(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}
