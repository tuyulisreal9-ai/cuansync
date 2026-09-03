import { getCurrencyMeta, normalizeCurrencyCode } from "./currency.js";
import { isNativeMobileApp } from "./mobile.js";

const COLORS = {
  paper: [250, 247, 241],
  surface: [255, 255, 255],
  ink: [33, 31, 27],
  body: [95, 89, 78],
  muted: [111, 106, 96],
  faint: [141, 134, 122],
  line: [231, 224, 211],
  soft: [245, 240, 230],
  forest: [15, 51, 41],
  forestDeep: [10, 22, 19],
  positive: [27, 128, 83],
  expense: [190, 73, 70],
  movement: [53, 111, 144],
  white: [250, 247, 241],
};

function pdfText(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/\u2192/g, "->")
    .replace(/\u2022/g, "|")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x0a\x20-\x7e\xa1-\xff]/g, "?");
}

function formatPdfMoney(value, currency) {
  const code = normalizeCurrencyCode(currency);
  const meta = getCurrencyMeta(code);
  const amount = Number(value || 0);
  const formatted = new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: meta.fractionDigits,
    maximumFractionDigits: meta.fractionDigits,
  }).format(amount);
  return `${code === "IDR" ? "Rp" : code} ${formatted}`;
}

function formatGeneratedAt(value) {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "-";
  }
}

function toneColor(tone) {
  if (tone === "income") return COLORS.positive;
  if (tone === "expense") return COLORS.expense;
  return COLORS.movement;
}

function setText(doc, color, size, style = "normal") {
  doc.setTextColor(...color);
  doc.setFont("helvetica", style);
  doc.setFontSize(size);
}

function drawFittedText(doc, text, x, y, maxWidth, options = {}) {
  const originalSize = Number(options.fontSize || doc.getFontSize());
  const minimumSize = Number(options.minimumSize || 6.5);
  let fontSize = originalSize;
  doc.setFontSize(fontSize);
  while (fontSize > minimumSize && doc.getTextWidth(pdfText(text)) > maxWidth) {
    fontSize -= 0.35;
    doc.setFontSize(fontSize);
  }
  doc.text(pdfText(text), x, y, options.textOptions || {});
  doc.setFontSize(originalSize);
}

function drawBrandIcon(doc, dataUrl, x, y, size, dark = true) {
  if (dataUrl) {
    try {
      const format = dataUrl.startsWith("data:image/webp") ? "WEBP" : "PNG";
      doc.addImage(dataUrl, format, x, y, size, size, undefined, "FAST");
      return;
    } catch {
      // Jika decoder gambar tidak tersedia, tanda vektor di bawah tetap aman.
    }
  }

  doc.setFillColor(...(dark ? COLORS.white : COLORS.forest));
  doc.roundedRect(x, y, size, size, 2, 2, "F");
  setText(doc, dark ? COLORS.forest : COLORS.white, size * 1.35, "bold");
  doc.text("C", x + size / 2, y + size * 0.69, { align: "center" });
}

function drawFirstPageHeader(doc, statement, brandIconDataUrl) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFillColor(...COLORS.paper);
  doc.rect(0, 0, pageWidth, pageHeight, "F");
  doc.setFillColor(...COLORS.forestDeep);
  doc.rect(0, 0, pageWidth, 47, "F");
  doc.setFillColor(...COLORS.forest);
  doc.roundedRect(pageWidth - 72, -22, 86, 61, 22, 22, "F");

  drawBrandIcon(doc, brandIconDataUrl, 14, 9, 10, true);
  setText(doc, COLORS.white, 10.5, "bold");
  doc.text("CUANSYNC", 27, 15.6);
  setText(doc, [180, 202, 194], 6.8, "normal");
  doc.text("CATAT. PAHAMI. KENDALIKAN.", 27, 20.2);

  setText(doc, [180, 202, 194], 6.8, "bold");
  doc.text("LAPORAN RIWAYAT TRANSAKSI", 14, 31);
  setText(doc, COLORS.white, 17, "bold");
  doc.text(pdfText(statement.monthLabel), 14, 40);

  setText(doc, COLORS.white, 8.2, "bold");
  drawFittedText(
    doc,
    statement.ownerName,
    pageWidth - 14,
    30.5,
    62,
    {
      fontSize: 8.2,
      minimumSize: 6.5,
      textOptions: { align: "right" },
    },
  );
  setText(doc, [180, 202, 194], 6.7, "normal");
  doc.text(
    pdfText(`Dibuat ${formatGeneratedAt(statement.generatedAt)}`),
    pageWidth - 14,
    35.6,
    { align: "right" },
  );
  doc.text(
    pdfText(`${statement.baseCurrency} | ${statement.timeZone}`),
    pageWidth - 14,
    40.2,
    { align: "right" },
  );
}

function drawSummary(doc, statement) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const gap = 3;
  const width = (pageWidth - margin * 2 - gap * 3) / 4;
  const top = 53;
  const incomplete = !statement.summary.isValuationComplete;
  const items = [
    {
      label: "TRANSAKSI",
      value: String(statement.summary.transactionCount),
      color: COLORS.ink,
    },
    {
      label: incomplete ? "MASUK TERVALUASI" : "UANG MASUK",
      value: formatPdfMoney(statement.summary.income, statement.baseCurrency),
      color: COLORS.positive,
    },
    {
      label: incomplete ? "KELUAR TERVALUASI" : "UANG KELUAR",
      value: formatPdfMoney(statement.summary.expense, statement.baseCurrency),
      color: COLORS.expense,
    },
    {
      label: incomplete ? "BERSIH TERVALUASI" : "ARUS BERSIH",
      value: `${statement.summary.net >= 0 ? "+" : "-"}${formatPdfMoney(
        Math.abs(statement.summary.net),
        statement.baseCurrency,
      )}`,
      color: statement.summary.net >= 0 ? COLORS.positive : COLORS.expense,
    },
  ];

  items.forEach((item, index) => {
    const x = margin + index * (width + gap);
    doc.setFillColor(...COLORS.surface);
    doc.setDrawColor(...COLORS.line);
    doc.setLineWidth(0.25);
    doc.roundedRect(x, top, width, 18, 3, 3, "FD");
    setText(doc, COLORS.muted, 6.2, "bold");
    doc.text(item.label, x + 3.2, top + 5.7);
    setText(doc, item.color, 9.2, "bold");
    drawFittedText(doc, item.value, x + 3.2, top + 13.3, width - 6.4, {
      fontSize: 9.2,
      minimumSize: 6.5,
    });
  });
}

function drawRunningHeader(doc, statement, brandIconDataUrl) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFillColor(...COLORS.paper);
  doc.rect(0, 0, pageWidth, pageHeight, "F");
  doc.setFillColor(...COLORS.forestDeep);
  doc.rect(0, 0, pageWidth, 19, "F");
  drawBrandIcon(doc, brandIconDataUrl, 14, 5.2, 8, true);
  setText(doc, COLORS.white, 8.5, "bold");
  doc.text("CUANSYNC", 25, 10.2);
  setText(doc, [180, 202, 194], 6.7, "normal");
  doc.text("LAPORAN RIWAYAT TRANSAKSI", 25, 14.1);
  setText(doc, COLORS.white, 8.5, "bold");
  doc.text(pdfText(statement.monthLabel), pageWidth - 14, 10.5, {
    align: "right",
  });
}

function buildTableBody(statement) {
  return statement.rows.map((row) => {
    const metaParts = [row.typeLabel];
    if (row.categoryLabel && row.categoryLabel !== row.typeLabel) {
      metaParts.push(row.categoryLabel);
    }
    if (row.usesSavings) metaParts.push("Menggunakan tabungan");
    const amountLines = row.amounts.map(
      (item) =>
        `${item.direction === "in" ? "+" : "-"}${formatPdfMoney(
          item.amount,
          item.currency,
        )}`,
    );
    if (row.feeAmount > 0) {
      amountLines.push(
        `Biaya ${formatPdfMoney(row.feeAmount, row.feeCurrency)}`,
      );
    }
    const originalCurrency = row.amounts[0]?.currency;
    const valuationLabel =
      row.historicalValue != null &&
      originalCurrency &&
      originalCurrency !== statement.baseCurrency
        ? `Setara ${formatPdfMoney(
            row.historicalValue,
            statement.baseCurrency,
          )}`
        : null;
    if (valuationLabel) amountLines.push(valuationLabel);
    if (
      row.flow !== "exchange" &&
      row.historicalValue == null &&
      originalCurrency &&
      originalCurrency !== statement.baseCurrency
    ) {
      amountLines.push(`Valuasi ${statement.baseCurrency} tidak tersedia`);
    }
    if (
      row.flow === "exchange" &&
      row.feeAmount > 0 &&
      row.feeBaseValue == null &&
      row.feeCurrency !== statement.baseCurrency
    ) {
      amountLines.push(`Valuasi biaya ${statement.baseCurrency} tidak tersedia`);
    }

    return [
      {
        content: pdfText(`${row.shortDateLabel}\n${row.timeLabel}`),
        styles: {
          textColor: COLORS.muted,
          fontStyle: "bold",
        },
      },
      {
        content: pdfText(`${row.title}\n${metaParts.join(" | ")}`),
        styles: { textColor: COLORS.ink },
      },
      {
        content: pdfText(row.accountLabel),
        styles: { textColor: COLORS.body },
      },
      {
        content: pdfText(amountLines.join("\n")),
        styles: {
          textColor: toneColor(row.tone),
          fontStyle: "bold",
          halign: "right",
        },
      },
    ];
  });
}

function drawFooter(doc, statement) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const totalPages = doc.getNumberOfPages();
  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    doc.setPage(pageNumber);
    doc.setDrawColor(...COLORS.line);
    doc.setLineWidth(0.25);
    doc.line(14, pageHeight - 14.5, pageWidth - 14, pageHeight - 14.5);
    setText(doc, COLORS.faint, 6.4, "normal");
    doc.text(
      pdfText(
        `CUANSYNC | ${statement.monthLabel} | Aplikasi pemantau keuangan, bukan bank.`,
      ),
      14,
      pageHeight - 9.6,
    );
    doc.text(`Halaman ${pageNumber} dari ${totalPages}`, pageWidth - 14, pageHeight - 9.6, {
      align: "right",
    });
  }
}

export async function loadCuansyncBrandIcon() {
  if (typeof document === "undefined" || typeof fetch !== "function") {
    return null;
  }
  try {
    const source = new URL("icons/icon-192.webp", document.baseURI).toString();
    const response = await fetch(source);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export function getMonthlyStatementFilename(statement) {
  return `CUANSYNC-Laporan-Transaksi-${statement.monthKey}.pdf`;
}

export async function createMonthlyStatementPdf(
  statement,
  { brandIconDataUrl = null } = {},
) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
    putOnlyUsedFonts: true,
  });
  doc.setProperties({
    title: `Laporan Riwayat Transaksi - ${statement.monthLabel}`,
    subject: "Riwayat transaksi bulanan CUANSYNC",
    author: statement.ownerName,
    creator: "CUANSYNC",
  });
  doc.setLanguage?.("id-ID");

  drawFirstPageHeader(doc, statement, brandIconDataUrl);
  drawSummary(doc, statement);
  const incomplete = !statement.summary.isValuationComplete;
  if (incomplete) {
    setText(doc, COLORS.expense, 6.7, "bold");
    doc.text(
      pdfText(
        `* Ringkasan hanya mencakup transaksi dengan valuasi historis ${statement.baseCurrency}; nominal asli lainnya tetap tercantum.`,
      ),
      14,
      77,
      { maxWidth: 182 },
    );
  }
  const historyTitleY = incomplete ? 85.5 : 80.5;
  setText(doc, COLORS.ink, 10.5, "bold");
  doc.text("Riwayat transaksi", 14, historyTitleY);
  setText(doc, COLORS.muted, 7, "normal");
  doc.text(
    pdfText(
      `${statement.summary.transactionCount} aktivitas | Transfer dan pokok tukar uang tidak dihitung sebagai arus kas.`,
    ),
    14,
    historyTitleY + 4.8,
  );

  autoTable(doc, {
    startY: historyTitleY + 9.5,
    margin: { top: 27, right: 14, bottom: 20, left: 14 },
    tableWidth: 182,
    head: [["WAKTU", "TRANSAKSI", "DOMPET", "NOMINAL"]],
    body: buildTableBody(statement),
    theme: "plain",
    showHead: "everyPage",
    pageBreak: "auto",
    rowPageBreak: "avoid",
    styles: {
      font: "helvetica",
      fontSize: 7.8,
      textColor: COLORS.body,
      fillColor: COLORS.surface,
      lineColor: COLORS.line,
      lineWidth: { bottom: 0.18 },
      cellPadding: { top: 2.2, right: 2.5, bottom: 2.2, left: 2.5 },
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fillColor: COLORS.forest,
      textColor: COLORS.white,
      fontStyle: "bold",
      fontSize: 6.7,
      minCellHeight: 8,
      cellPadding: { top: 2.5, right: 2.5, bottom: 2.5, left: 2.5 },
      lineWidth: 0,
    },
    columnStyles: {
      0: { cellWidth: 23 },
      1: { cellWidth: 76 },
      2: { cellWidth: 43 },
      3: { cellWidth: 40, halign: "right" },
    },
    willDrawPage: (data) => {
      if (data.pageNumber > 1) {
        drawRunningHeader(doc, statement, brandIconDataUrl);
      }
    },
  });

  drawFooter(doc, statement);
  return doc;
}

function downloadPdfInBrowser(doc, filename) {
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* iOS Safari mengabaikan atribut download pada tautan, jadi jalur unduhan di
   atas tidak menghasilkan berkas di iPhone. Di PWA yang dipasang ke Layar
   Utama, membuka blob malah bisa melempar pengguna keluar dari aplikasi.
   Web Share dengan berkas didukung Safari iOS dan membuka lembar berbagi
   sistem, sehingga laporan bisa disimpan ke Files atau dikirim.

   Mengembalikan false berarti pemanggil harus jatuh ke unduhan biasa. */
async function sharePdfViaWebShare(doc, filename) {
  if (typeof navigator === "undefined") return false;
  if (typeof navigator.share !== "function") return false;
  if (typeof navigator.canShare !== "function") return false;
  if (typeof File !== "function") return false;

  const berkas = new File([doc.output("blob")], filename, {
    type: "application/pdf",
  });
  if (!navigator.canShare({ files: [berkas] })) return false;

  try {
    await navigator.share({
      files: [berkas],
      title: filename.replace(/.pdf$/i, ""),
      text: "Laporan riwayat transaksi bulanan dari CUANSYNC.",
    });
    return true;
  } catch (error) {
    /* Pengguna menutup lembar berbagi. Itu keputusan pengguna, bukan
       kegagalan, jadi jangan diulang lagi sebagai unduhan. */
    if (error?.name === "AbortError") return true;
    /* Safari menolak share yang dipanggil terlalu jauh dari sentuhan
       pengguna. Dalam hal itu unduhan biasa masih lebih berguna daripada
       tidak terjadi apa apa. */
    return false;
  }
}

async function sharePdfInNativeApp(doc, filename) {
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([
    import("@capacitor/filesystem"),
    import("@capacitor/share"),
  ]);
  const dataUri = doc.output("datauristring");
  const base64 = dataUri.slice(dataUri.indexOf(",") + 1);
  const result = await Filesystem.writeFile({
    path: filename,
    data: base64,
    directory: Directory.Cache,
    recursive: true,
  });
  try {
    await Share.share({
      title: filename.replace(/\.pdf$/i, ""),
      text: "Laporan riwayat transaksi bulanan dari CUANSYNC.",
      url: result.uri,
      dialogTitle: "Simpan atau bagikan laporan PDF",
    });
  } finally {
    await Filesystem.deleteFile({
      path: filename,
      directory: Directory.Cache,
    }).catch(() => {});
  }
}

export async function exportMonthlyStatementPdf(statement) {
  const brandIconDataUrl = await loadCuansyncBrandIcon();
  const doc = await createMonthlyStatementPdf(statement, {
    brandIconDataUrl,
  });
  const filename = getMonthlyStatementFilename(statement);
  if (isNativeMobileApp()) {
    await sharePdfInNativeApp(doc, filename);
    return { filename, method: "share" };
  }
  if (await sharePdfViaWebShare(doc, filename)) {
    return { filename, method: "web-share" };
  }
  downloadPdfInBrowser(doc, filename);
  return { filename, method: "download" };
}
