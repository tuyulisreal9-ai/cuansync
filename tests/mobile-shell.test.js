import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function json(path) {
  return JSON.parse(source(path));
}

test("konfigurasi Capacitor memakai identitas dan output web CUANSYNC", () => {
  const config = json("capacitor.config.json");

  assert.equal(config.appId, "com.cuansync.app");
  assert.equal(config.appName, "CUANSYNC");
  assert.equal(config.webDir, "dist");
  assert.equal(config.loggingBehavior, "none");
  assert.equal(config.server.url, undefined);
  assert.equal(config.server.cleartext, false);
  assert.equal(config.android.allowMixedContent, false);
});

test("shell Android adalah Capacitor WebView, bukan TWA atau PWABuilder", () => {
  const activity = source(
    "android/app/src/main/java/com/cuansync/app/MainActivity.java",
  );
  const gradle = source("android/app/build.gradle");

  assert.match(activity, /extends BridgeActivity/);
  assert.match(gradle, /project\(':capacitor-android'\)/);
  assert.doesNotMatch(gradle, /android-browser-helper|trusted-web-activity|bubblewrap/i);
  assert.equal(existsSync(new URL("../twa-manifest.json", import.meta.url)), false);
  assert.equal(
    existsSync(new URL("../public/.well-known/assetlinks.json", import.meta.url)),
    false,
  );
});

test("Android menerima callback OAuth CUANSYNC dan tidak mengizinkan backup data", () => {
  const manifest = source("android/app/src/main/AndroidManifest.xml");

  assert.match(manifest, /android:allowBackup="false"/);
  assert.match(manifest, /android:enableOnBackInvokedCallback="true"/);
  assert.match(manifest, /android:launchMode="singleTask"/);
  assert.match(manifest, /android:scheme="com\.cuansync\.app"/);
  assert.match(manifest, /android:host="auth"/);
  assert.match(manifest, /android:pathPrefix="\/callback"/);
  assert.match(manifest, /android:windowSoftInputMode="adjustResize"/);
});

test("login native memakai browser sistem dan callback yang sama dengan manifest", () => {
  const mobile = source("src/lib/mobile.js");
  const main = source("src/main.js");

  assert.match(mobile, /com\.cuansync\.app:\/\/auth\/callback/);
  assert.match(mobile, /Preferences\.get/);
  assert.match(main, /const nativeLogin = isNativeMobileApp\(\)/);
  assert.match(main, /skipBrowserRedirect: nativeLogin/);
  assert.match(main, /flowType: "pkce"/);
  assert.match(main, /supabase\.auth\.exchangeCodeForSession/);
  assert.match(main, /addNativeUrlListener/);
  assert.match(main, /getNativeLaunchUrl/);
  assert.match(main, /supabaseSessionRecovery/);
});

test("PWA menyediakan manifest, ikon, dan service worker khusus web", () => {
  const manifest = json("public/manifest.webmanifest");
  const bootstrap = source("src/bootstrap.js");

  assert.equal(manifest.short_name, "CUANSYNC");
  assert.equal(manifest.display, "standalone");
  assert.ok(manifest.icons.some(({ sizes }) => sizes === "512x512"));
  assert.match(bootstrap, /import\.meta\.env\.PROD/);
  assert.match(bootstrap, /serviceWorker\.register\("\/sw\.js"\)/);
  assert.match(bootstrap, /is-native-app/);
});

test("shell native memiliki satu scroll container vertikal yang eksplisit", () => {
  const main = source("src/main.js");
  const styles = source("src/styles.css");

  // overflow-x: hidden memaksa overflow-y yang 'visible' menjadi 'auto', sehingga
  // app-shell berubah menjadi scroll container yang membungkus seluruh aplikasi.
  // Karena tingginya mengikuti konten, scrollHeight selalu sama dengan clientHeight
  // dan shell tidak pernah bisa di-scroll sendiri, sementara gestur sentuh sudah
  // terlanjur ditangkap olehnya. overflow-x: clip memotong tanpa membuat scroll
  // container, jadi dokumen tetap menjadi scroller di mode web.
  assert.match(main, /app-shell[^\n]*overflow-x-clip/);
  assert.doesNotMatch(main, /app-shell[^\n]*overflow-x-hidden/);
  assert.doesNotMatch(main, /app-shell[^\n]*overflow-hidden/);
  assert.match(styles, /html\.is-native-app \.app-shell\s*\{/);
  assert.match(styles, /overflow-y:\s*auto/);
  assert.match(styles, /touch-action:\s*pan-y/);

  // Shell native harus setinggi kotak WebView sebenarnya. Memakai 100dvh
  // membuatnya lebih tinggi daripada induk yang memotong luapan di Android,
  // sehingga sisa konten paling bawah tidak pernah bisa di-scroll.
  const nativeShell = styles.slice(
    styles.indexOf("html.is-native-app .app-shell"),
    styles.indexOf("}", styles.indexOf("html.is-native-app .app-shell")),
  );
  assert.match(nativeShell, /height:\s*100%/);
  assert.doesNotMatch(nativeShell, /height:\s*100dvh/);
  assert.doesNotMatch(styles, /html\.is-native-app[^{]*\{[^}]*min-height:\s*100dvh/);
});

test("safe area Android berada di shell, bukan di dalam kartu header", () => {
  const styles = source("src/styles.css");
  const header = source("src/components/wallet/WalletHeader.js");

  assert.match(
    styles,
    /html\.is-native-app \.app-shell\s*\{[\s\S]*padding-top:\s*calc\(0\.75rem \+ env\(safe-area-inset-top\)\)/,
  );
  assert.doesNotMatch(header, /safe-area-inset-top/);
});

test("halaman Pengaturan menahan semua baris di dalam viewport mobile", () => {
  const settings = source("src/components/settings/SettingsPage.js");

  assert.match(settings, /settings-page[^\n]*w-full[^\n]*min-w-0[^\n]*overflow-x-clip/);
  assert.match(settings, /stacked=\$\{true\}/);
  assert.match(settings, /w-full min-w-0 sm:w-\[11\.5rem\]/);
});

test("menu Aksi cepat berhenti di atas navigation bar dan dapat di-scroll", () => {
  const navigation = source("src/components/navigation/AppNavigation.js");
  const styles = source("src/styles.css");

  assert.match(navigation, /cs-quick-action-overlay/);
  assert.match(navigation, /cs-quick-action-list[^\n]*overflow-y-auto/);
  assert.match(
    styles,
    /\.cs-quick-action-overlay\s*\{[\s\S]*padding-bottom:\s*calc\(0\.75rem \+ env\(safe-area-inset-bottom\)\)/,
  );
  assert.match(styles, /\.cs-quick-action-menu\s*\{[\s\S]*max-height:\s*calc\(/);
  assert.match(styles, /body:has\(\.cs-quick-action-menu\) \.mobile-bottom-nav/);
});

test("navigation mobile menutup safe area bawah tanpa menindih konten", () => {
  const navigation = source("src/components/navigation/AppNavigation.js");
  const styles = source("src/styles.css");

  assert.match(navigation, /bottom-0/);
  assert.match(
    navigation,
    /pb-\[calc\(\.25rem\+env\(safe-area-inset-bottom\)\)\]/,
  );
  assert.doesNotMatch(
    navigation,
    /style=\$\{\{ bottom: "env\(safe-area-inset-bottom\)" \}\}/,
  );
  // Nav bawah memakai warna kertas semi transparan dengan blur seperti desain,
  // bukan permukaan kartu putih.
  assert.match(styles, /\.cs-mobile-nav\s*\{\s*background:\s*var\(--cs-navbg\)/);
  // Tab aktif ditandai warna tinta, bukan aksen hijau, agar mode terang bersih.
  assert.match(
    styles,
    /\.cs-mobile-nav-item\.is-active\s*\{[^}]*color:\s*var\(--cs-ink\)/,
  );
  assert.doesNotMatch(
    styles,
    /\.cs-mobile-nav-item\.is-active\s*\{[^}]*var\(--cs-accent-soft\)/,
  );
});

test("aset native memakai sumber logo CUANSYNC yang dapat dibuat ulang", () => {
  const packageJson = json("package.json");
  const adaptiveIcon = source(
    "android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml",
  );

  assert.equal(
    existsSync(new URL("../assets-native/logo.png", import.meta.url)),
    true,
  );
  assert.match(packageJson.scripts["mobile:assets:android"], /assets-native/);
  // Warna native memakai token desain --cs-bg gelap, bukan slate #020617
  // warisan sebelum redesign. Splash tetap gelap karena logo CUANSYNC berupa
  // neon bercahaya yang hilang kontrasnya di atas latar terang.
  assert.match(packageJson.scripts["mobile:assets:android"], /#080d0c/i);
  assert.doesNotMatch(packageJson.scripts["mobile:assets:android"], /#020617/i);
  assert.match(adaptiveIcon, /@mipmap\/ic_launcher_foreground/);
});

test("warna native mengikuti token desain dan berubah menurut mode sistem", () => {
  const colors = source("android/app/src/main/res/values/colors.xml");
  const light = source("android/app/src/main/res/values/styles.xml");
  const night = source("android/app/src/main/res/values-night/styles.xml");
  const capacitor = json("capacitor.config.json");

  // Token native sama dengan --cs-bg di styles.css.
  assert.match(colors, /name="cs_bg_light">#FAF7F1</i);
  assert.match(colors, /name="cs_bg_dark">#080D0C</i);
  assert.doesNotMatch(colors, /#020617/i);
  assert.doesNotMatch(colors, /#10B981|#22D3EE/i);

  // Navigation bar dan ikon status bar mengikuti mode sistem.
  assert.match(light, /navigationBarColor">@color\/cs_bg_light</);
  assert.match(light, /windowLightStatusBar">true</);
  assert.match(night, /navigationBarColor">@color\/cs_bg_dark</);
  assert.match(night, /windowLightStatusBar">false</);

  assert.equal(capacitor.plugins.SplashScreen.backgroundColor, "#080d0c");
  assert.equal(capacitor.android.backgroundColor, "#080d0c");
});

test("body tidak boleh menjadi scroll container yang menghadang wheel dan sentuh", () => {
  const styles = source("src/styles.css");

  // overflow-x: hidden pada body membuat overflow-y ikut menjadi auto, sehingga
  // body berubah jadi scroll container. Tinggi body mengikuti konten, jadi
  // scrollHeight selalu sama dengan clientHeight dan body tidak pernah bisa
  // menggulir dirinya sendiri, padahal yang menggulir adalah html. Roda mouse
  // dan gestur sentuh mendarat di body lalu mati, sementara menyeret scrollbar
  // tetap jalan karena itu menggulir html langsung.
  assert.doesNotMatch(styles, /^html,\s*\n\s*body\s*\{[^}]*overflow-x:\s*hidden/m);
  assert.match(styles, /^body\s*\{[^}]*overflow-x:\s*clip/m);
});

test("desktop memakai sidebar 264px, topbar menempel, dan grid beranda", () => {
  const nav = source("src/components/navigation/AppNavigation.js");
  const header = source("src/components/wallet/WalletHeader.js");
  const home = source("src/components/home/HomeDashboardPage.js");
  const shell = source("src/main.js");
  const styles = source("src/styles.css");

  // Sidebar berlabel menggantikan rail ikon 76px.
  assert.match(nav, /w-\[264px\]/);
  assert.match(nav, /cs-desktop-sidebar/);
  assert.doesNotMatch(nav, /cs-desktop-rail/);
  assert.doesNotMatch(nav, /w-\[76px\]/);

  // Sidebar hanya muncul dari lg ke atas supaya mobile tidak berubah.
  assert.match(nav, /hidden[^"]*lg:flex/);

  // Topbar menempel dengan judul 26px dan tiga aksi.
  assert.match(header, /lg:sticky[^"]*lg:top-0/);
  assert.match(header, /lg:text-\[26px\]/);
  assert.match(header, /cs-topbar-action/);

  // Beranda memakai grid auto-fit seperti artifact.
  assert.match(home, /grid-template-columns:repeat\(auto-fit,minmax\(380px,1fr\)\)/);

  // Kolom konten memakai lebar maksimum dan padding desktop.
  assert.match(shell, /lg:max-w-\[1400px\]/);
  assert.match(shell, /lg:px-8/);

  // Hover hanya untuk penunjuk presisi, bukan layar sentuh.
  assert.match(styles, /@media \(hover: hover\) and \(pointer: fine\)/);
  assert.match(styles, /--cs-sidebar-bg/);
});

test("pemilih mata uang tetap terlihat saat keyboard ponsel naik", () => {
  const combobox = source("src/components/shared/CurrencyCombobox.js");

  // Tinggi dan posisi panel mengikuti visualViewport. innerHeight tidak
  // berubah saat keyboard naik, jadi memakainya membuat daftar tertutup.
  assert.match(combobox, /window\.visualViewport/);
  assert.match(combobox, /vv\.addEventListener\("resize", sync\)/);
  assert.match(combobox, /viewport\.offsetTop/);
  assert.match(combobox, /viewport\.height/);

  // Panel dirender lewat portal. Sheet induknya memakai backdrop-filter, dan
  // itu membuat containing block bagi turunan position: fixed sekaligus
  // memotong isinya, sehingga panel salah posisi dan terpotong.
  assert.match(combobox, /import \{ createPortal \} from "react-dom"/);
  assert.match(combobox, /createPortal\(picker, document\.body\)/);

  // Karena panel keluar dari pohon rootRef, klik di dalamnya harus tetap
  // dianggap klik di dalam supaya daftar tidak menutup sendiri.
  assert.match(combobox, /panelRef\.current\?\.contains\(event\.target\)/);

  // Di desktop bentuknya tetap dropdown yang menempel pada tombol.
  assert.match(combobox, /isDesktop \? picker : createPortal/);
  assert.match(combobox, /\(min-width: 1024px\)/);

  // Palet lama tidak boleh kembali.
  assert.doesNotMatch(combobox, /slate-\d|emerald-\d/);
});
