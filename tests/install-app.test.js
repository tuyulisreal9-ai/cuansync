import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  INSTALL_STATE,
  detectInstallPlatform,
  getInstallGuide,
  getInstallPresentation,
  getInstallState,
} from "../src/lib/installApp.js";

const UA = {
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
  iphoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/120.0 Mobile/15E148 Safari/604.1",
  iphoneFirefox:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 FxiOS/121.0 Mobile/15E148 Safari/605.1.15",
  mac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15",
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36",
  windowsChrome:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36",
};

test("iPad modern dibedakan dari Mac sungguhan", () => {
  // iPadOS 13 ke atas melaporkan dirinya sebagai Macintosh. Tanpa memeriksa
  // titik sentuh, pengguna iPad akan diberi panduan bilah alamat desktop yang
  // tidak ada di perangkatnya.
  const ipad = detectInstallPlatform({
    userAgent: UA.mac,
    platform: "MacIntel",
    maxTouchPoints: 5,
  });
  assert.equal(ipad.ios, true);
  assert.equal(ipad.iosBrowser, "safari");

  const mac = detectInstallPlatform({
    userAgent: UA.mac,
    platform: "MacIntel",
    maxTouchPoints: 0,
  });
  assert.equal(mac.ios, false);
  assert.equal(mac.desktop, true);
});

test("peramban selain Safari di iPhone dikenali", () => {
  for (const [ua, harap] of [
    [UA.iphoneSafari, "safari"],
    [UA.iphoneChrome, "chrome"],
    [UA.iphoneFirefox, "firefox"],
  ]) {
    assert.equal(detectInstallPlatform({ userAgent: ua }).iosBrowser, harap);
  }
});

test("Chrome iOS mendapat langkah Bagikan sendiri dengan cadangan Safari", () => {
  const panduan = getInstallGuide(
    detectInstallPlatform({ userAgent: UA.iphoneChrome }),
  );
  assert.match(panduan.judul, /Chrome/);
  assert.match(panduan.catatan, /Chrome/);
  assert.ok(
    panduan.langkah.some((l) => /Bagikan/.test(l)),
    "pemasangan Chrome iOS melalui Bagikan",
  );
  assert.match(panduan.bantuan, /Safari/);
  assert.doesNotMatch(panduan.catatan, /hanya ada di Safari|tidak punya menu/);
});

test("panduan iOS menyebut alasan kenapa tidak bisa otomatis", () => {
  const panduan = getInstallGuide(
    detectInstallPlatform({ userAgent: UA.iphoneSafari }),
  );
  assert.match(panduan.catatan, /tidak mengizinkan aplikasi memasang dirinya/);
  assert.ok(panduan.langkah.some((l) => /Tambahkan ke Layar Utama/.test(l)));
});

test("Android dan desktop punya panduannya sendiri", () => {
  const android = getInstallGuide(
    detectInstallPlatform({ userAgent: UA.androidChrome }),
  );
  assert.match(android.judul, /menu peramban/);
  assert.doesNotMatch(JSON.stringify(android), /Safari|iPhone/);
  assert.match(android.bantuan, /Jika tetap tidak tersedia/);
  assert.doesNotMatch(android.catatan, /tetap tersedia secara manual/);

  const desktop = getInstallGuide(
    detectInstallPlatform({ userAgent: UA.windowsChrome }),
  );
  assert.match(desktop.judul, /bilah alamat/);
});

test("Android tetap Android meski UA memuat Safari atau metadata mirip iPad", () => {
  const platform = detectInstallPlatform({
    userAgent: UA.androidChrome, platform: "MacIntel", maxTouchPoints: 5,
  });
  assert.equal(platform.android, true);
  assert.equal(platform.ios, false);
  assert.equal(platform.iosBrowser, null);
  assert.doesNotMatch(JSON.stringify(getInstallGuide(platform)), /Safari|iPhone/);
});

test("setiap panduan punya judul, catatan, dan langkah yang terisi", () => {
  for (const ua of Object.values(UA)) {
    const panduan = getInstallGuide(detectInstallPlatform({ userAgent: ua }));
    assert.ok(panduan.judul.length > 0, ua);
    assert.ok(panduan.catatan.length > 0, ua);
    assert.ok(panduan.langkah.length >= 2, ua);
    panduan.langkah.forEach((l) => assert.ok(l.trim().length > 0, ua));
  }
  // Dipanggil tanpa platform sekalipun tetap memberi sesuatu yang berguna.
  const cadangan = getInstallGuide(undefined);
  assert.ok(cadangan.langkah.length >= 1);
});

test("aplikasi yang sudah terpasang tidak menawarkan pemasangan lagi", () => {
  assert.equal(getInstallState({ standalone: true }), INSTALL_STATE.TERPASANG);
  assert.equal(getInstallState({ nativeApp: true }), INSTALL_STATE.TERPASANG);
  // Tanpa tawaran dari peramban, yang tersisa hanyalah panduan.
  assert.equal(getInstallState({}), INSTALL_STATE.PANDUAN);
  assert.equal(getInstallState(), INSTALL_STATE.PANDUAN);
});

test("tawaran pemasangan Chrome dicegat sedini mungkin", () => {
  const sumber = readFileSync(
    new URL("../src/lib/installApp.js", import.meta.url),
    "utf8",
  );
  // beforeinstallprompt ditembakkan sekali. Kalau pendengarnya baru dipasang
  // saat halaman Pengaturan dibuka, kesempatan memanggil prompt() sudah lewat.
  assert.match(sumber, /window\.addEventListener\("beforeinstallprompt"/);
  assert.match(sumber, /event\.preventDefault\(\)/);
  assert.match(sumber, /window\.addEventListener\("appinstalled"/);
  // Pendaftarannya di tingkat modul, bukan di dalam fungsi komponen.
  const posisi = sumber.indexOf('addEventListener("beforeinstallprompt"');
  const dalamFungsi = sumber.slice(0, posisi).lastIndexOf("export function");
  const tutupTerakhir = sumber.slice(0, posisi).lastIndexOf("\n}");
  assert.ok(tutupTerakhir > dalamFungsi, "pendengar harus di tingkat modul");
  const bootstrap = readFileSync(new URL("../src/bootstrap.js", import.meta.url), "utf8");
  assert.ok(bootstrap.indexOf('import "./lib/installApp.js"') < bootstrap.indexOf('import("./main.js")'));
  assert.match(bootstrap, /import "\.\/lib\/installApp\.js"/);
});

test("Pengaturan dan panel panduan mengikuti status hidup pemasangan", () => {
  const settings = readFileSync(
    new URL("../src/components/settings/SettingsPage.js", import.meta.url),
    "utf8",
  );
  assert.match(settings, /INSTALL_STATE\.TERPASANG/);
  assert.match(settings, /INSTALL_STATE\.SIAP/);
  assert.match(settings, /subscribeInstallPrompt\(perbarui\)/);
  // prompt() harus dipanggil dari sentuhan pengguna.
  assert.match(settings, /async function handleInstall/);
  assert.match(settings, /await promptInstall\(\)/);
  assert.match(settings, /getInstallPresentation\(installState, installPlatform\)/);
  assert.match(settings, /wrapHelper=\$\{true\}/);
  assert.match(settings, /installState=\$\{installState\}/);
  assert.match(settings, /onInstall=\$\{handleInstall\}/);
});

test("status belum ditawarkan, dibatalkan, gagal, dan disetujui tidak disamakan", () => {
  const platform = detectInstallPlatform({ userAgent: UA.androidChrome });
  const messages = Object.values(INSTALL_STATE).map((state) => {
    const view = getInstallPresentation(state, platform);
    assert.ok(view.label && view.helper && view.value && view.detail);
    assert.equal(view.disabled, [INSTALL_STATE.TERPASANG, INSTALL_STATE.KONFIRMASI].includes(state));
    return view.helper;
  });
  assert.equal(new Set(messages).size, Object.keys(INSTALL_STATE).length);
  assert.match(getInstallPresentation(INSTALL_STATE.PANDUAN, platform).helper, /Belum ditawarkan/);
  assert.match(getInstallPresentation(INSTALL_STATE.DIBATALKAN).helper, /Dibatalkan/);
  assert.match(getInstallPresentation(INSTALL_STATE.GAGAL).helper, /gagal/);
  assert.match(getInstallPresentation(INSTALL_STATE.DISETUJUI).helper, /Disetujui/);
  assert.equal(getInstallPresentation(INSTALL_STATE.DISETUJUI).disabled, false);
  assert.doesNotMatch(getInstallPresentation(INSTALL_STATE.TERPASANG).helper, /Berjalan layar penuh/);
});
