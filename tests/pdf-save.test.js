import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { savePdfFile, getPdfSaveMessage } from "../src/lib/savePdfFile.js";

const filename = "CUANSYNC-2026-10.pdf";
const blob = new Blob(["%PDF-1.4"], { type: "application/pdf" });
const doc = { output: (type) => type === "blob" ? blob : "data:application/pdf;base64,JVBERi0xLjQ=" };

function browserHarness(click = () => {}) {
  const events = [];
  let release;
  const link = { click() { events.push("click"); click(); }, remove() { events.push("remove"); } };
  return {
    events, link, cleanup: () => release(),
    options: {
      platform: "web",
      dom: { createElement: (tag) => { assert.equal(tag, "a"); return link; }, body: { appendChild: () => events.push("append") } },
      urls: { createObjectURL: (value) => { assert.equal(value, blob); return "blob:test"; }, revokeObjectURL: (url) => events.push(`revoke:${url}`) },
      defer: (fn, delay) => { assert.equal(delay, 60_000); release = fn; },
      android: { savePdf() { assert.fail("web must not call native"); } },
      filesystem: { writeFile() { assert.fail("web must not write native storage"); } },
    },
  };
}

test("Simpan PDF di web selalu mengunduh walau navigator mendukung berbagi", async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: {
    canShare: () => true, share: () => assert.fail("must never open share sheet"),
  } });
  try {
    const harness = browserHarness();
    assert.deepEqual(await savePdfFile(doc, filename, harness.options), { filename, method: "download" });
    assert.equal(harness.link.download, filename);
    assert.equal(harness.link.href, "blob:test");
    assert.deepEqual(harness.events, ["append", "click", "remove"]);
    harness.cleanup();
    assert.equal(harness.events.at(-1), "revoke:blob:test");
  } finally {
    if (original) Object.defineProperty(globalThis, "navigator", original);
    else delete globalThis.navigator;
  }
});

test("gagal memulai unduhan tetap membersihkan tautan/blob dan tidak mengaku berhasil", async () => {
  const harness = browserHarness(() => { throw new Error("download blocked"); });
  await assert.rejects(savePdfFile(doc, filename, harness.options), /download blocked/);
  assert.equal(harness.events.at(-1), "remove");
  harness.cleanup();
  assert.equal(harness.events.at(-1), "revoke:blob:test");
});

test("Android menyimpan melalui pemilih dokumen dan membedakan batal dari sukses", async () => {
  for (const cancelled of [false, true]) {
    const result = await savePdfFile(doc, filename, {
      platform: "android",
      android: { async savePdf(args) {
        assert.deepEqual(args, { filename, data: "JVBERi0xLjQ=" });
        return { cancelled };
      } },
    });
    assert.equal(result.method, cancelled ? "cancelled" : "saved");
    assert.equal(getPdfSaveMessage(result).includes("berhasil"), !cancelled);
  }
});

test("Android gagal/versi lama tidak kembali ke berbagi atau mengaku tersimpan", async () => {
  await assert.rejects(savePdfFile(doc, filename, {
    platform: "android", android: { savePdf: async () => { throw new Error("storage full"); } },
  }), /storage full/);
  await assert.rejects(savePdfFile(doc, filename, {
    platform: "android", android: { savePdf: async () => { throw { code: "UNIMPLEMENTED" }; } },
  }), /Perbarui aplikasi/);
  await assert.rejects(savePdfFile(doc, filename, {
    platform: "android", android: { savePdf: async () => ({}) },
  }), /belum dapat dipastikan/);
});

test("iOS menyimpan PDF permanen di Documents dan tidak menimpa ekspor sebelumnya", async () => {
  const writes = [];
  const options = {
    platform: "ios", filesystem: { writeFile: async (args) => { writes.push(args); return {}; } },
  };
  const first = await savePdfFile(doc, filename, { ...options, now: () => 1000 });
  const second = await savePdfFile(doc, filename, { ...options, now: () => 2000 });
  assert.notEqual(first.filename, second.filename);
  assert.equal(first.method, "saved");
  assert.match(getPdfSaveMessage(first), /Files → CUANSYNC → Laporan/);
  assert.deepEqual(writes[0], {
    path: "Laporan/CUANSYNC-2026-10-1000.pdf", data: "JVBERi0xLjQ=", directory: "DOCUMENTS", recursive: true,
  });
  await assert.rejects(savePdfFile(doc, filename, {
    ...options, filesystem: { writeFile: async () => { throw new Error("storage full"); } },
  }), /storage full/);
});

test("UI dan integrasi native memakai Simpan PDF tanpa jalur share", () => {
  const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
  const sheet = read("../src/components/settings/MonthlyStatementExportSheet.js");
  const pdf = read("../src/lib/monthlyStatementPdf.js");
  const save = read("../src/lib/savePdfFile.js");
  assert.match(sheet, /"Simpan PDF"/);
  assert.match(sheet, /setMessage\(getPdfSaveMessage\(result\)\)/);
  assert.match(pdf, /return savePdfFile\(doc, filename\)/);
  assert.doesNotMatch(sheet + pdf + save, /navigator\.share|Share\.share|Buat & bagikan|web-share|Directory\.Cache/);
  assert.doesNotMatch(getPdfSaveMessage({ method: "download" }), /berhasil|tersimpan/);
  const plugin = read("../android/app/src/main/java/com/cuansync/app/CuansyncDocumentsPlugin.java");
  assert.match(plugin, /Intent\.ACTION_CREATE_DOCUMENT/);
  assert.match(plugin, /Activity\.RESULT_CANCELED/);
  assert.doesNotMatch(plugin, /ACTION_SEND|WRITE_EXTERNAL_STORAGE|MANAGE_EXTERNAL_STORAGE/);
  assert.ok(plugin.indexOf("output.write(pdf)") < plugin.indexOf("call.resolve(response)", plugin.indexOf("output.write(pdf)")));
  assert.match(read("../android/app/src/main/java/com/cuansync/app/MainActivity.java"), /registerPlugin\(CuansyncDocumentsPlugin.class\)/);
  const plist = read("../ios/App/App/Info.plist");
  for (const key of ["UIFileSharingEnabled", "LSSupportsOpeningDocumentsInPlace"]) {
    assert.match(plist, new RegExp(`<key>${key}</key>\\s*<true/>`));
  }
});
