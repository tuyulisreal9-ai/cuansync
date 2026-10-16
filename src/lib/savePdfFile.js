import { Capacitor, registerPlugin } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";

const Documents = registerPlugin("CuansyncDocuments");

export async function savePdfFile(doc, filename, {
  platform = Capacitor.getPlatform(),
  android = Documents,
  filesystem = Filesystem,
  dom = globalThis.document,
  urls = globalThis.URL,
  defer = globalThis.setTimeout,
  now = () => Date.now(),
} = {}) {
  if (platform === "web") {
    const url = urls.createObjectURL(doc.output("blob"));
    const link = dom.createElement("a");
    try {
      link.href = url;
      link.download = filename;
      link.rel = "noopener";
      dom.body.appendChild(link);
      link.click();
    } finally {
      link.remove();
      // Some mobile browsers consume the blob after the click handler returns.
      defer(() => urls.revokeObjectURL(url), 60_000);
    }
    return { filename, method: "download" };
  }

  const dataUri = doc.output("datauristring");
  const data = dataUri.slice(dataUri.indexOf(",") + 1);
  if (platform === "android") {
    try {
      const result = await android.savePdf({ filename, data });
      if (typeof result?.cancelled !== "boolean") {
        throw new Error("Status penyimpanan PDF belum dapat dipastikan. Periksa lokasi yang kamu pilih.");
      }
      return { filename, method: result.cancelled ? "cancelled" : "saved" };
    } catch (error) {
      if (error?.code === "UNIMPLEMENTED") {
        throw new Error("Perbarui aplikasi CUANSYNC untuk menggunakan Simpan PDF.");
      }
      throw error;
    }
  }
  if (platform === "ios") {
    // Keep each export; do not silently replace an earlier report.
    const savedName = `${filename.replace(/[\\/]/g, "-").replace(/\.pdf$/i, "")}-${now()}.pdf`;
    await filesystem.writeFile({
      path: `Laporan/${savedName}`,
      data,
      directory: Directory.Documents,
      recursive: true,
    });
    return { filename: savedName, method: "saved", location: "Files → CUANSYNC → Laporan" };
  }
  throw new Error("Penyimpanan PDF belum tersedia pada perangkat ini.");
}

export function getPdfSaveMessage(result) {
  if (result.method === "cancelled") return "Penyimpanan dibatalkan.";
  if (result.method === "download") return "Unduhan PDF dimulai. Jika muncul pratinjau, pilih Simpan di browser.";
  return result.location
    ? `PDF tersimpan di ${result.location}.`
    : "PDF berhasil disimpan di lokasi yang kamu pilih.";
}
