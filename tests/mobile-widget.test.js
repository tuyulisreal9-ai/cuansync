import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const repoUrl = new URL("../", import.meta.url);

function fileUrl(path) {
  return new URL(path.replaceAll("\\", "/"), repoUrl);
}

function source(path) {
  return readFileSync(fileUrl(path), "utf8");
}

function assertFilesExist(paths) {
  for (const path of paths) {
    assert.ok(existsSync(fileUrl(path)), `${path} harus ada`);
  }
}

function xmlBlocks(xml, tag) {
  const expression = new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}>`, "g");
  return xml.match(expression) || [];
}

test("router native hanya menerima rute CUANSYNC yang dikenal", async () => {
  const {
    NATIVE_APP_SCHEME,
    NATIVE_AUTH_CALLBACK_URL,
    buildMovementUrl,
    buildQuickEntryUrl,
    parseNativeAppRoute,
  } = await import("../src/lib/nativeAppRoute.js");

  assert.equal(NATIVE_APP_SCHEME, "com.cuansync.app");
  assert.equal(NATIVE_AUTH_CALLBACK_URL, "com.cuansync.app://auth/callback");

  assert.deepEqual(parseNativeAppRoute(NATIVE_AUTH_CALLBACK_URL), {
    kind: "auth-callback",
    url: NATIVE_AUTH_CALLBACK_URL,
  });
  assert.deepEqual(parseNativeAppRoute(buildQuickEntryUrl("expense")), {
    kind: "quick-entry",
    entryType: "expense",
  });
  assert.deepEqual(parseNativeAppRoute(buildQuickEntryUrl("income")), {
    kind: "quick-entry",
    entryType: "income",
  });
  assert.deepEqual(parseNativeAppRoute(buildMovementUrl("transfer")), {
    kind: "movement",
    movementType: "transfer",
  });

  for (const invalidUrl of [
    "",
    "not-a-url",
    "https://quick-entry?type=expense",
    "cuansync://quick-entry?type=expense",
    "com.cuansync.app://unknown?type=expense",
    "com.cuansync.app://quick-entry?type=transfer",
    "com.cuansync.app://quick-entry?type=Expense",
    "com.cuansync.app://quick-entry/extra?type=expense",
    "com.cuansync.app://movement?mode=expense",
    "com.cuansync.app://auth/not-callback?code=abc",
  ]) {
    assert.equal(
      parseNativeAppRoute(invalidUrl),
      null,
      `rute tidak dikenal harus ditolak: ${invalidUrl}`,
    );
  }

  // Parameter tambahan ditolak seluruhnya; URL dari luar tidak boleh berubah
  // menjadi instruksi nominal atau penyimpanan otomatis.
  assert.equal(
    parseNativeAppRoute(
      "com.cuansync.app://quick-entry?type=expense&amount=999999&token=rahasia",
    ),
    null,
  );
  assert.throws(() => buildQuickEntryUrl("transfer"), TypeError);
  assert.throws(() => buildMovementUrl("expense"), TypeError);
});

test("Catat Cepat menerapkan preset widget dengan fallback yang aman", () => {
  const sheet = source("src/components/transactions/QuickEntrySheet.js");

  assert.match(sheet, /initialEntryType\s*=\s*["']expense["']/);
  assert.match(sheet, /initialAccountId\s*=\s*["']["']/);
  assert.match(sheet, /requestKey\s*=\s*0/);

  const effects = [...sheet.matchAll(
    /useEffect\s*\(\s*\(\)\s*=>\s*\{([\s\S]*?)\}\s*,\s*\[([^\]]*)\]\s*\)/g,
  )];
  const resetEffect = effects.find((match) =>
    match[1].includes("setEntryType") && match[1].includes("setAccountId"),
  );

  assert.ok(resetEffect, "effect reset Catat Cepat harus ada");
  const [, body, dependencies] = resetEffect;
  assert.match(body, /initialEntryType/);
  assert.match(body, /initialAccountId/);
  assert.match(dependencies, /\bopen\b/);
  assert.match(dependencies, /\brequestKey\b/);

  // Nilai URL tidak boleh langsung dipercaya tanpa whitelist tipe dan akun.
  assert.doesNotMatch(body, /setEntryType\s*\(\s*initialEntryType\s*\)/);
  assert.doesNotMatch(body, /setAccountId\s*\(\s*initialAccountId\s*\)/);
  assert.match(body, /accounts\.(?:find|some)\s*\(/);
  assert.match(body, /pickDefaultAccount\s*\(/);
});

test("aksi native ditahan sampai pengguna dan dompet selesai dipulihkan", () => {
  const main = source("src/main.js");

  for (const contract of [
    "parseNativeAppRoute",
    "pendingNativeAction",
    "setPendingNativeAction",
    "hydratedUserId",
    "quickEntryRequestKey",
    "quickEntryInitialAccountId",
    "addNativeUrlListener",
    "getNativeLaunchUrl",
  ]) {
    assert.match(main, new RegExp(`\\b${contract}\\b`), `${contract} belum terhubung`);
  }

  const pendingEffect = [...main.matchAll(
    /useEffect\s*\(\s*\(\)\s*=>\s*\{([\s\S]*?)\}\s*,\s*\[([^\]]*)\]\s*\)/g,
  )].find((match) =>
    match[1].includes("pendingNativeAction") &&
    match[1].includes("hydratedUserId"),
  );

  assert.ok(pendingEffect, "aksi widget harus diproses oleh effect setelah hidrasi");
  assert.match(pendingEffect[1], /spendableAssetAccounts|assetAccounts/);
  assert.match(pendingEffect[1], /quick-entry/);
  assert.match(pendingEffect[1], /setQuickEntryOpen|openQuickEntry/);
  assert.match(pendingEffect[1], /setPendingNativeAction\s*\(\s*null\s*\)/);

  const quickEntryMount = main.match(
    /<\$\{QuickEntrySheet\}[\s\S]*?(?=<\$\{|<\/)/,
  )?.[0] || "";
  assert.match(quickEntryMount, /initialEntryType=/);
  assert.match(quickEntryMount, /initialAccountId=/);
  assert.match(quickEntryMount, /requestKey=/);
});

test("manifest memisahkan callback login dari pintasan Catat Cepat", () => {
  const manifest = source("android/app/src/main/AndroidManifest.xml");
  const filters = xmlBlocks(manifest, "intent-filter");
  const authIndex = filters.findIndex((block) =>
    /android:host=["']auth["']/.test(block) &&
    /android:pathPrefix=["']\/callback["']/.test(block),
  );
  const quickIndex = filters.findIndex((block) =>
    /android:host=["']quick-entry["']/.test(block),
  );

  assert.ok(authIndex >= 0, "intent-filter callback OAuth harus tetap ada");
  assert.ok(quickIndex >= 0, "intent-filter quick-entry harus ada");
  assert.notEqual(authIndex, quickIndex, "OAuth dan widget tidak boleh satu filter");
  assert.match(filters[quickIndex], /android:scheme=["']com\.cuansync\.app["']/);
  assert.doesNotMatch(filters[quickIndex], /android:host=["']auth["']/);
});

test("Android mendaftarkan tepat dua provider widget yang privat", () => {
  const manifest = source("android/app/src/main/AndroidManifest.xml");
  const receivers = xmlBlocks(manifest, "receiver").filter((block) =>
    /Cuansync(?:Quick|Summary)WidgetProvider/.test(block),
  );

  assert.equal(receivers.length, 2, "harus ada widget cepat dan ringkasan");
  for (const [provider, metadata] of [
    ["CuansyncQuickWidgetProvider", "@xml/cuansync_quick_widget_info"],
    ["CuansyncSummaryWidgetProvider", "@xml/cuansync_summary_widget_info"],
  ]) {
    const receiver = receivers.find((block) => block.includes(provider));
    assert.ok(receiver, `${provider} belum didaftarkan`);
    assert.match(receiver, /android:exported=["']false["']/);
    assert.match(receiver, /android\.appwidget\.action\.APPWIDGET_UPDATE/);
    assert.ok(receiver.includes(metadata), `${provider} memakai metadata yang salah`);
  }
});

test("resource dan provider widget Android lengkap", () => {
  const javaRoot = "android/app/src/main/java/com/cuansync/app/widget";
  const paths = [
    `${javaRoot}/CuansyncQuickWidgetProvider.java`,
    `${javaRoot}/CuansyncSummaryWidgetProvider.java`,
    `${javaRoot}/CuansyncWidgetContract.java`,
    `${javaRoot}/CuansyncWidgetSnapshot.java`,
    `${javaRoot}/CuansyncWidgetIntents.java`,
    `${javaRoot}/CuansyncWidgetUpdater.java`,
    "android/app/src/main/res/layout/cuansync_widget_quick.xml",
    "android/app/src/main/res/layout/cuansync_widget_summary.xml",
    "android/app/src/main/res/layout/cuansync_widget_quick_preview.xml",
    "android/app/src/main/res/layout/cuansync_widget_summary_preview.xml",
    "android/app/src/main/res/xml/cuansync_quick_widget_info.xml",
    "android/app/src/main/res/xml/cuansync_summary_widget_info.xml",
  ];
  assertFilesExist(paths);

  assert.match(
    source(`${javaRoot}/CuansyncQuickWidgetProvider.java`),
    /extends\s+AppWidgetProvider/,
  );
  assert.match(
    source(`${javaRoot}/CuansyncSummaryWidgetProvider.java`),
    /extends\s+AppWidgetProvider/,
  );

  for (const [infoPath, layout, preview] of [
    [
      "android/app/src/main/res/xml/cuansync_quick_widget_info.xml",
      "@layout/cuansync_widget_quick",
      "@layout/cuansync_widget_quick_preview",
    ],
    [
      "android/app/src/main/res/xml/cuansync_summary_widget_info.xml",
      "@layout/cuansync_widget_summary",
      "@layout/cuansync_widget_summary_preview",
    ],
  ]) {
    const info = source(infoPath);
    assert.match(info, /<appwidget-provider\b/);
    assert.ok(info.includes(layout), `${infoPath} tidak menunjuk layout utamanya`);
    assert.ok(info.includes(preview), `${infoPath} tidak menunjuk preview-nya`);
    assert.match(info, /android:widgetCategory=["'][^"']*home_screen/);
  }

  const intents = source(`${javaRoot}/CuansyncWidgetIntents.java`);
  const contract = source(`${javaRoot}/CuansyncWidgetContract.java`);
  assert.match(contract, /URI_SCHEME\s*=\s*["']com\.cuansync\.app["']/);
  assert.match(contract, /HOST_QUICK_ENTRY\s*=\s*["']quick-entry["']/);
  assert.match(contract, /HOST_MOVEMENT\s*=\s*["']movement["']/);
  assert.match(intents, /appendQueryParameter\s*\(\s*["']type["']/);
  assert.match(intents, /["']expense["']/);
  assert.match(intents, /["']income["']/);
  assert.match(intents, /["']transfer["']/);
  assert.doesNotMatch(
    intents,
    /appendQueryParameter\s*\(\s*["'](?:amount|source|kind|widgetId|token)["']/,
  );
  assert.match(intents, /FLAG_IMMUTABLE/);
});

test("plugin widget terdaftar sebelum Activity Capacitor dibuat", () => {
  const javaRoot = "android/app/src/main/java/com/cuansync/app/widget";
  const pluginPath = `${javaRoot}/CuansyncWidgetPlugin.java`;
  assertFilesExist([pluginPath]);

  const plugin = source(pluginPath);
  assert.match(plugin, /@CapacitorPlugin\s*\(\s*name\s*=\s*["']CuansyncWidget["']/);
  for (const method of ["updateSnapshot", "clearSnapshot", "requestPin"]) {
    assert.match(plugin, new RegExp(`\\b${method}\\s*\\(`), `${method} belum ada`);
  }

  const activity = source("android/app/src/main/java/com/cuansync/app/MainActivity.java");
  const registerAt = activity.indexOf("registerPlugin(CuansyncWidgetPlugin.class)");
  const superAt = activity.indexOf("super.onCreate");
  assert.ok(registerAt >= 0, "CuansyncWidgetPlugin belum diregistrasikan");
  assert.ok(superAt >= 0, "super.onCreate tidak ditemukan");
  assert.ok(registerAt < superAt, "plugin harus diregistrasikan sebelum super.onCreate");
});

test("snapshot widget hanya menyimpan ringkasan aman", () => {
  const javaRoot = "android/app/src/main/java/com/cuansync/app/widget";
  const snapshotSources = [
    source(`${javaRoot}/CuansyncWidgetSnapshot.java`),
    source(`${javaRoot}/CuansyncWidgetPlugin.java`),
    source(`${javaRoot}/CuansyncWidgetContract.java`),
  ].join("\n");

  assert.doesNotMatch(
    snapshotSources,
    /access[_-]?token|refresh[_-]?token|authorization|supabase|rawTransactions/i,
  );
  assert.doesNotMatch(snapshotSources, /getArray\s*\(\s*["']transactions["']/i);
  assert.doesNotMatch(snapshotSources, /["']transactions["']\s*[,)]/i);

  // Daftar field yang memang dibutuhkan widget harus dibaca satu per satu;
  // meneruskan seluruh payload JS membuat data baru ikut tersimpan tanpa audit.
  const plugin = source(`${javaRoot}/CuansyncWidgetPlugin.java`);
  assert.doesNotMatch(plugin, /call\.getData\s*\(\)[\s\S]{0,80}(?:toString|put)/);

  const main = source("src/main.js");
  assert.match(main, /\bupdateNativeWidgetSnapshot\b/);
  const payloads = [...main.matchAll(
    /updateNativeWidgetSnapshot\s*\(\s*\{([\s\S]*?)\}\s*\)/g,
  )];
  assert.ok(payloads.length >= 2, "snapshot login dan logout harus sama-sama ditulis");
  for (const payload of payloads) {
    assert.match(payload[1], /\bisSignedIn\b/);
    assert.match(payload[1], /\bhideAmounts\b/);
    assert.doesNotMatch(
      payload[1],
      /access[_-]?token|refresh[_-]?token|authorization|email|\btransactions?\b\s*[:,]/i,
    );
  }

  const bridge = source("src/lib/nativeWidgets.js");
  assert.match(bridge, /export async function updateNativeWidgetSnapshot/);
  assert.match(bridge, /export async function requestPinNativeWidget/);
  assert.match(bridge, /Capacitor\.getPlatform\(\)\s*===\s*["']android["']/);
  assert.doesNotMatch(
    bridge,
    /access[_-]?token|refresh[_-]?token|authorization|supabase|rawTransactions/i,
  );
});

test("widget digambar ulang saat hari berganti", () => {
  const manifest = source("android/app/src/main/AndroidManifest.xml");
  const receivers = xmlBlocks(manifest, "receiver").filter((block) =>
    /Cuansync(?:Quick|Summary)WidgetProvider/.test(block),
  );

  assert.equal(receivers.length, 2);
  for (const receiver of receivers) {
    assert.match(
      receiver,
      /android\.intent\.action\.DATE_CHANGED/,
      "receiver harus mendengar pergantian tanggal",
    );
  }

  // AppWidgetProvider.onReceive hanya meneruskan aksi appwidget; mendaftarkan
  // aksi di manifest tanpa menangani onReceive membuat siarannya terbuang.
  const javaRoot = "android/app/src/main/java/com/cuansync/app/widget";
  for (const [providerFile, refresh] of [
    ["CuansyncQuickWidgetProvider.java", "refreshQuick"],
    ["CuansyncSummaryWidgetProvider.java", "refreshSummary"],
  ]) {
    const provider = source(`${javaRoot}/${providerFile}`);
    assert.match(provider, /public\s+void\s+onReceive\s*\(/, `${providerFile} harus menangani onReceive`);
    assert.match(provider, /isDayBoundaryAction\s*\(\s*intent\s*\)/, `${providerFile} harus memeriksa pergantian hari`);
    assert.ok(
      provider.includes(`CuansyncWidgetUpdater.${refresh}(`),
      `${providerFile} harus memanggil ${refresh}`,
    );
  }

  const updater = source(`${javaRoot}/CuansyncWidgetUpdater.java`);
  assert.match(updater, /static\s+boolean\s+isDayBoundaryAction\s*\(/);
  for (const action of [
    "ACTION_DATE_CHANGED",
    "ACTION_TIME_CHANGED",
    "ACTION_TIMEZONE_CHANGED",
  ]) {
    assert.ok(
      updater.includes(`Intent.${action}`),
      `${action} belum dipantau`,
    );
  }
});

test("tinggi widget mengikuti ukuran font pengguna", () => {
  const layouts = [
    "android/app/src/main/res/layout/cuansync_widget_quick.xml",
    "android/app/src/main/res/layout/cuansync_widget_summary.xml",
    "android/app/src/main/res/layout/cuansync_widget_quick_preview.xml",
    "android/app/src/main/res/layout/cuansync_widget_summary_preview.xml",
  ];

  for (const path of layouts) {
    const xml = source(path);
    const elements = [...xml.matchAll(/<([A-Za-z][\w.]*)\b([^>]*?)\/?>/g)];
    assert.ok(elements.length > 0, `${path} harus punya elemen`);

    for (const [, tag, attributes] of elements) {
      const fixedHeight = attributes.match(
        /android:layout_height\s*=\s*"(\d+(?:\.\d+)?)(?:dp|dip|sp|px)"/,
      );
      // Gambar boleh berukuran tetap karena tidak ikut skala font; teks tidak.
      // Tinggi dp mati membuat nominal terpotong saat ukuran font diperbesar.
      if (tag === "ImageView") continue;
      assert.equal(
        fixedHeight,
        null,
        `${path}: <${tag}> memakai tinggi tetap ${fixedHeight?.[0]}`,
      );
    }

    // Tombol tetap butuh lantai tinggi supaya area ketuknya tidak menciut.
    const actionButtons = elements.filter(([, , attributes]) =>
      /@drawable\/cuansync_widget_action_/.test(attributes),
    );
    assert.ok(actionButtons.length >= 2, `${path} harus punya tombol aksi`);
    for (const [, tag, attributes] of actionButtons) {
      assert.match(
        attributes,
        /android:minHeight\s*=\s*"\d+dp"/,
        `${path}: <${tag}> tombol aksi tanpa minHeight`,
      );
    }
  }
});
