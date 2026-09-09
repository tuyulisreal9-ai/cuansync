import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

const ANDROID = "android/app/src/main";
const QUICK = `${ANDROID}/java/com/cuansync/app/quick`;

test("kredensial Supabase di Android tidak melenceng dari config web", async () => {
  const [config, androidConfig] = await Promise.all([
    source("src/config.js"),
    source(`${ANDROID}/res/values/cuansync_config.xml`),
  ]);

  const url = config.match(/SUPABASE_URL\s*=\s*"([^"]+)"/)?.[1];
  const key = config.match(/SUPABASE_ANON_KEY\s*=\s*"([^"]+)"/)?.[1];
  assert.ok(url && key, "nilai di src/config.js tidak terbaca");

  /* Catat kilat berjalan di luar WebView dan tidak bisa membaca config.js,
     jadi nilainya disalin. Salinan berarti bisa melenceng, dan melencengnya
     baru ketahuan sebagai kegagalan simpan di perangkat pengguna. */
  assert.ok(
    androidConfig.includes(`>${url}<`),
    "cuansync_supabase_url berbeda dari src/config.js",
  );
  assert.ok(
    androidConfig.includes(`>${key}<`),
    "cuansync_supabase_anon_key berbeda dari src/config.js",
  );

  // Kunci sesi harus mengikuti ref project pada URL-nya.
  const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
  assert.ok(ref, "ref project tidak terbaca dari URL");
  assert.ok(
    androidConfig.includes(`>sb-${ref}-auth-token<`),
    "kunci sesi tidak cocok dengan ref project",
  );
});

test("kategori bawaan catat kilat ada di daftar kategori aplikasi", async () => {
  const [expense, categories, budgets] = await Promise.all([
    source(`${QUICK}/QuickExpense.java`),
    source("src/domain/categories.js"),
    source("src/domain/budgets.js"),
  ]);

  const kategori = expense.match(/KATEGORI\s*=\s*"([^"]+)"/)?.[1];
  const grup = expense.match(/GRUP_KATEGORI\s*=\s*"([^"]+)"/)?.[1];
  assert.equal(kategori, "Makan");

  // Nilai yang tidak ada di CATEGORY_OPTIONS akan tercatat sebagai kategori
  // hantu: transaksinya masuk, tapi tidak pernah cocok dengan jatah mana pun.
  assert.ok(
    categories.includes(`value: "${kategori}"`),
    `kategori ${kategori} tidak ada di CATEGORY_OPTIONS`,
  );
  const { getDefaultGroupForCategory } = await import(
    "../src/domain/budgets.js"
  );
  assert.equal(getDefaultGroupForCategory(kategori), grup);
  assert.ok(budgets.includes("getDefaultGroupForCategory"));
});

test("catat kilat menyimpan sendiri, tidak membuka aplikasi", async () => {
  const [intents, updater] = await Promise.all([
    source(`${ANDROID}/java/com/cuansync/app/widget/CuansyncWidgetIntents.java`),
    source(`${ANDROID}/java/com/cuansync/app/widget/CuansyncWidgetUpdater.java`),
  ]);

  /* Inti keluhan yang memicu perubahan ini: tombol pengeluaran dulu membuka
     MainActivity, yang berarti menyalakan Capacitor dan memuat bundel web
     sebelum apa pun terlihat. */
  assert.match(intents, /QuickExpenseActivity\.class/);
  assert.match(updater, /CuansyncWidgetIntents\.quickExpense\(/);
  assert.doesNotMatch(
    updater,
    /quickEntry\([^)]*"expense"/s,
    "tombol pengeluaran tidak boleh lagi membuka aplikasi",
  );
});

test("layar catat kilat tertutup dari aplikasi lain", async () => {
  const manifest = await source(`${ANDROID}/AndroidManifest.xml`);
  const activity = manifest.match(
    /<activity[^>]*QuickExpenseActivity[\s\S]*?\/>/,
  );
  assert.ok(activity, "QuickExpenseActivity belum terdaftar di manifest");

  // Diekspor berarti aplikasi mana pun bisa memunculkan layar pencatatan atas
  // nama pengguna. Hanya widget milik aplikasi ini yang boleh membukanya.
  assert.match(activity[0], /android:exported="false"/);
  assert.match(activity[0], /android:theme="@style\/CuansyncQuickTheme"/);
});

test("pengeluaran yang gagal terkirim tidak hilang", async () => {
  const [queue, sender, activity] = await Promise.all([
    source(`${QUICK}/QuickExpenseQueue.java`),
    source(`${QUICK}/QuickExpenseSender.java`),
    source(`${QUICK}/QuickExpenseActivity.java`),
  ]);

  /* Catat kilat dipakai di tempat sinyal buruk. Pengeluaran yang dianggap
     tercatat tapi diam diam hilang tidak akan disadari sampai saldonya tidak
     cocok, dan itu jauh lebih merugikan daripada widget yang lambat. */
  assert.match(activity, /QuickExpenseQueue\.tambah\(/);
  assert.match(sender, /kirimAntrean/);

  // Idempotensi yang membuat pengiriman ulang aman.
  assert.match(queue, /client_request_id/);
  assert.match(
    await source(`${QUICK}/QuickExpense.java`),
    /clientRequestId/,
  );

  // Penolakan server bersifat tetap; mengantrekannya hanya mengulang gagal.
  assert.match(sender, /DITOLAK/);
});

test("snapshot tetap tanpa token meski kini membawa id dompet", async () => {
  const contract = await source(
    `${ANDROID}/java/com/cuansync/app/widget/CuansyncWidgetContract.java`,
  );
  const plugin = await source(
    `${ANDROID}/java/com/cuansync/app/widget/CuansyncWidgetPlugin.java`,
  );

  assert.match(contract, /KEY_PRIMARY_WALLET_ID/);
  assert.match(contract, /KEY_PRIMARY_WALLET_CURRENCY/);

  // Token sesi dibaca dari penyimpanan milik Capacitor, tidak pernah disalin
  // ke snapshot widget.
  for (const terlarang of ["access_token", "refresh_token", "password", "email"]) {
    assert.ok(
      !contract.includes(terlarang) && !plugin.includes(terlarang),
      `snapshot tidak boleh menyentuh ${terlarang}`,
    );
  }
  assert.match(
    await source(`${QUICK}/CuansyncSession.java`),
    /CapacitorStorage/,
    "sesi harus dibaca dari penyimpanan Capacitor, bukan disalin",
  );
});
