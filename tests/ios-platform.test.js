import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const baca = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const json = (path) => JSON.parse(baca(path));

const infoPlist = baca("ios/App/App/Info.plist");
const capConfig = json("capacitor.config.json");
const pkg = json("package.json");

test("platform iOS ada dengan berkas intinya", () => {
  for (const berkas of [
    "ios/App/App/Info.plist",
    "ios/App/App/AppDelegate.swift",
    "ios/App/App.xcodeproj/project.pbxproj",
    "ios/App/CapApp-SPM/Package.swift",
    "ios/README.md",
  ]) {
    assert.ok(existsSync(new URL(`../${berkas}`, import.meta.url)), `${berkas} harus ada`);
  }
  assert.ok(pkg.dependencies["@capacitor/ios"], "@capacitor/ios harus jadi dependency");
});

test("skema OAuth iOS sama persis dengan Android", () => {
  // Tanpa CFBundleURLTypes, callback com.cuansync.app://auth/callback tidak
  // pernah kembali ke aplikasi dan login Google berhenti di browser.
  const android = baca("android/app/src/main/AndroidManifest.xml");
  const skemaAndroid = android.match(/android:scheme="([^"]+)"/)?.[1];
  assert.equal(skemaAndroid, "com.cuansync.app");

  assert.match(infoPlist, /<key>CFBundleURLTypes<\/key>/);
  assert.match(infoPlist, /<key>CFBundleURLSchemes<\/key>/);
  const skemaIos = infoPlist
    .split("<key>CFBundleURLSchemes</key>")[1]
    ?.match(/<string>([^<]+)<\/string>/)?.[1];
  assert.equal(skemaIos, skemaAndroid, "skema iOS dan Android harus sama");

  // Dan sama dengan yang dipakai kode.
  const mobile = baca("src/lib/mobile.js");
  assert.match(mobile, new RegExp(`${skemaIos.replace(/\./g, "\.")}://auth/callback`));
});

test("Info.plist tetap XML yang berimbang", () => {
  // Plist yang rusak baru ketahuan saat dibuka di Xcode, dan itu tidak bisa
  // diuji dari Windows.
  const pasangan = [
    ["<dict>", "</dict>"],
    ["<array>", "</array>"],
    ["<plist", "</plist>"],
  ];
  for (const [buka, tutup] of pasangan) {
    const a = infoPlist.split(buka).length - 1;
    const b = infoPlist.split(tutup).length - 1;
    assert.equal(a, b, `${buka} dan ${tutup} harus berpasangan`);
  }
});

test("Package.swift memakai garis miring, bukan backslash", () => {
  // cap sync yang dijalankan di Windows menulis path bergaya Windows, dan
  // Swift Package Manager di macOS tidak bisa membacanya.
  const swift = baca("ios/App/CapApp-SPM/Package.swift");
  const jalurSalah = swift.match(/path: "[^"]*\[^"]*"/g) || [];
  assert.deepEqual(
    jalurSalah,
    [],
    `path berikut memakai backslash dan akan gagal di macOS:\n${jalurSalah.join("\n")}`,
  );
  assert.match(swift, /path: "\.\.\/\.\.\/\.\.\/node_modules/);
});

test("warna dan skema iOS sepadan dengan Android", () => {
  assert.equal(capConfig.ios.backgroundColor, capConfig.android.backgroundColor);
  assert.equal(capConfig.server.iosScheme, capConfig.server.androidScheme);

  // Aplikasi menghitung area aman sendiri lewat env(safe-area-inset-*), jadi
  // WebView tidak boleh menambah sisipannya sendiri di atas itu.
  assert.equal(capConfig.ios.contentInset, "never");
  const styles = baca("src/styles.css");
  assert.match(styles, /env\(safe-area-inset-top\)/);
  assert.match(baca("index.html"), /viewport-fit=cover/);
});

test("skrip iOS sepadan dengan yang sudah ada untuk Android", () => {
  for (const nama of ["mobile:sync:ios", "mobile:open:ios", "mobile:run:ios", "mobile:assets:ios"]) {
    assert.ok(pkg.scripts[nama], `skrip ${nama} harus ada`);
  }
  assert.match(pkg.scripts["mobile:sync:ios"], /cap sync ios/);
  // mobile:assets membuat aset untuk kedua platform sekaligus.
  assert.match(pkg.scripts["mobile:assets"], /mobile:assets:android/);
  assert.match(pkg.scripts["mobile:assets"], /mobile:assets:ios/);
});

test("hasil build web tidak ikut di-commit ke folder iOS", () => {
  // App/App/public diisi ulang tiap cap sync; ikut mengirimnya berarti dua
  // salinan aplikasi di dalam repo.
  const ignore = baca("ios/.gitignore");
  assert.match(ignore, /App\/App\/public/);
  assert.match(ignore, /App\/App\/capacitor\.config\.json/);
});
