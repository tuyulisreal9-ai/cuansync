import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EmailAuthScreen, PasswordForm, PasswordRecoveryScreen } from "../src/components/auth/EmailAuth.js";
import { SettingsPage } from "../src/components/settings/SettingsPage.js";
import {
  CONFIRMATION_SENT_MESSAGE, RECOVERY_SENT_MESSAGE, RECOVERY_STORAGE_KEY,
  cleanAuthCallbackUrl, createAuthCallbackHandler, createEmailAuth,
  getAccountLoginInfo, getAuthCallbackFromUrl, getAuthSessionFromCallback, getEmailAuthError,
  getEmailAuthRedirect, hasAuthCallback, normalizeAuthEmail,
  readPasswordRecovery, savePasswordRecovery, validateNewPassword,
} from "../src/lib/emailAuth.js";

function mockAuth(overrides = {}) {
  const calls = [];
  const user = { id: "existing-google-user", email: "user@example.com" };
  const auth = Object.fromEntries(["signInWithPassword", "signUp", "resetPasswordForEmail", "resend", "updateUser", "getUser"].map((method) => [method, async (...args) => {
    calls.push([method, ...args]);
    return { data: { user }, error: null };
  }]));
  Object.assign(auth, overrides);
  return { calls, user, api: createEmailAuth({ getClient: () => ({ auth }), getRedirect: (recovery) => getEmailAuthRedirect({ origin: "https://app.example.com", recovery }) }) };
}

test("metode masuk mengenali akun Google tanpa menebak keberadaan password", () => {
  assert.deepEqual(getAccountLoginInfo({ email: " User@Example.com ", identities: [{ provider: "google" }] }), { email: "user@example.com", googleConnected: true });
  assert.equal(getAccountLoginInfo({ app_metadata: { providers: ["google"] } }).googleConnected, true);
  assert.equal(getAccountLoginInfo({ app_metadata: { provider: "google" } }).googleConnected, true);
  assert.equal(getAccountLoginInfo({ user_metadata: { provider: "google", providers: ["google"] } }).googleConnected, false);
  assert.deepEqual(getAccountLoginInfo({ email: "magic@example.com", identities: [{ provider: "email" }] }), { email: "magic@example.com", googleConnected: false });
  assert.deepEqual(getAccountLoginInfo(null), { email: "", googleConnected: false });
});

test("pengaturan menyediakan Metode masuk untuk akun nyata, bukan demo", () => {
  const user = { email: "google@example.com", app_metadata: { provider: "google" } };
  const settings = renderToStaticMarkup(React.createElement(SettingsPage, { user, onSavePassword() {} }));
  assert.match(settings, /Metode masuk/);
  assert.match(settings, /Terhubung/);
  assert.match(settings, /Email &amp; kata sandi/);
  assert.match(settings, /tanpa daftar ulang/);
  const demo = renderToStaticMarkup(React.createElement(SettingsPage, { user }));
  assert.doesNotMatch(demo, /Metode masuk/);
  const emailOnly = renderToStaticMarkup(React.createElement(SettingsPage, { user: { email: "mail@example.com" }, onSavePassword() {} }));
  assert.match(emailOnly, /Email &amp; kata sandi/);
  assert.doesNotMatch(emailOnly, /Terhubung/);
});

test("form akun Google memakai email akun yang sama, bukan form pendaftaran baru", () => {
  const markup = renderToStaticMarkup(React.createElement(PasswordForm, { email: "google@example.com", googleConnected: true }));
  assert.match(markup, /Email untuk masuk/);
  assert.match(markup, /google@example.com/);
  assert.match(markup, /Google tetap terhubung/);
  assert.match(markup, /Data akun tetap sama/);
  assert.doesNotMatch(markup, /type="email"|current-password|berhasil disimpan/);
});

test("password ditolak server tidak dilaporkan sebagai berhasil", async () => {
  const { api } = mockAuth({ updateUser: async () => ({ data: { user: null }, error: { code: "weak_password" } }) });
  await assert.rejects(api.updatePassword({ password: "RejectedPassword!", confirmation: "RejectedPassword!", expectedUserId: "existing-google-user" }), { code: "weak_password" });
});

test("email dirapikan; kata sandi tidak diubah atau dipangkas", async () => {
  assert.equal(normalizeAuthEmail(" User@Example.com "), "user@example.com");
  const { api, calls } = mockAuth();
  await api.signIn({ email: " User@Example.com ", password: " Keep spaces! " });
  assert.deepEqual(calls, [["signInWithPassword", { email: "user@example.com", password: " Keep spaces! " }]]);
});

test("daftar memakai Supabase Auth dan URL aplikasi, tanpa menulis data finansial", async () => {
  const { api, calls } = mockAuth();
  await api.signUp({ email: " NEW@example.com ", password: "Private123!" });
  assert.deepEqual(calls, [["signUp", { email: "new@example.com", password: "Private123!", options: { emailRedirectTo: "https://app.example.com/" } }]]);
});

test("recovery dan kirim ulang memakai API dan jenis email yang tepat", async () => {
  const { api, calls } = mockAuth();
  await api.requestReset(" User@Example.com ");
  await api.resendConfirmation(" User@Example.com ");
  assert.deepEqual(calls, [
    ["resetPasswordForEmail", "user@example.com", { redirectTo: "https://app.example.com/?auth=reset-password" }],
    ["resend", { type: "signup", email: "user@example.com", options: { emailRedirectTo: "https://app.example.com/" } }],
  ]);
});

test("Google lama menambah password pada ID akun yang sama, tidak signUp ulang", async () => {
  const { api, calls, user } = mockAuth();
  const data = await api.updatePassword({ password: "New secret123!", confirmation: "New secret123!", expectedUserId: user.id });
  assert.equal(data.user.id, user.id);
  assert.deepEqual(calls, [["getUser"], ["updateUser", { password: "New secret123!" }]]);
});

test("pengubahan password ditolak bila sesi berganti akun atau validasi server gagal", async () => {
  const { api, calls } = mockAuth();
  await assert.rejects(api.updatePassword({ password: "Password123!", confirmation: "Password123!", expectedUserId: "different-user" }), { code: "session_not_found" });
  assert.deepEqual(calls, [["getUser"]]);
  const expired = mockAuth({ getUser: async () => ({ data: { user: null }, error: { code: "session_expired" } }) });
  await assert.rejects(expired.api.updatePassword({ password: "Password123!", confirmation: "Password123!", expectedUserId: "existing-google-user" }), { code: "session_expired" });
  assert.equal(expired.calls.length, 0);
});

test("validasi kata sandi baru dan konfirmasi, tidak menerapkan minimum pada login lama", async () => {
  assert.match(validateNewPassword("short", "short"), /minimal 8/);
  assert.match(validateNewPassword("        ", "        "), /spasi/);
  assert.match(validateNewPassword("long enough", "different"), /belum sama/);
  assert.equal(validateNewPassword("long enough", "long enough"), "");
  const { api, calls } = mockAuth();
  await assert.rejects(api.updatePassword({ password: "short", confirmation: "short", expectedUserId: "existing-google-user" }));
  assert.equal(calls.length, 0);
  await api.signIn({ email: "user@example.com", password: "legacy" });
  assert.equal(calls.length, 1);
});

test("URL recovery web/native dibedakan tanpa redirect terbuka dari input pengguna", () => {
  assert.equal(getEmailAuthRedirect({ origin: "https://app.example.com/ignored?next=evil" }), "https://app.example.com/");
  assert.equal(getEmailAuthRedirect({ native: true, recovery: true }), "com.cuansync.app://auth/callback?auth=reset-password");
});

test("callback menangani PKCE, token native, error dan fragmen yang rusak", () => {
  assert.equal(hasAuthCallback("https://app.example.com/"), false);
  assert.equal(hasAuthCallback("not a url"), false);
  assert.equal(hasAuthCallback("https://app.example.com/?code=once"), true);
  assert.deepEqual(getAuthCallbackFromUrl("com.cuansync.app://auth/callback?auth=reset-password&code=once"), { type: "pkce", code: "once", recovery: true });
  assert.deepEqual(getAuthSessionFromCallback("com.cuansync.app://auth/callback#access_token=a&refresh_token=b&type=recovery"), { access_token: "a", refresh_token: "b" });
  assert.equal(getAuthCallbackFromUrl("https://app.example.com/?auth=reset-password"), null);
  assert.throws(() => getAuthCallbackFromUrl("https://app.example.com/#access_token=incomplete"));
  assert.throws(() => getAuthCallbackFromUrl("https://app.example.com/?error_description=%25broken&error_code=otp_expired"), { code: "otp_expired" });
});

test("callback sekali-pakai hanya ditukar satu kali dan menjaga redirectType recovery SDK", async () => {
  let exchanges = 0;
  const session = { user: { id: "owner" } };
  const handle = createAuthCallbackHandler({ exchangeCode: async (code) => {
    assert.equal(code, "once"); exchanges++;
    return { data: { session, redirectType: "recovery" }, error: null };
  }, setSession: () => { throw new Error("wrong API"); } });
  const url = "https://app.example.com/?code=once";
  const [first, second] = await Promise.all([handle(url), handle(url)]);
  assert.equal(exchanges, 1);
  assert.deepEqual(first, { session, recovery: true });
  assert.equal(first, second);
  await handle(url);
  assert.equal(exchanges, 1);
});

test("URL bertanda recovery saja tidak mengotorisasi perubahan password", async () => {
  let called = false;
  const handle = createAuthCallbackHandler({ exchangeCode: async () => { called = true; }, setSession: async () => { called = true; } });
  assert.equal(await handle("https://app.example.com/?auth=reset-password"), null);
  assert.equal(called, false);
});

test("callback gagal tidak memakai sesi lama sebagai keberhasilan", async () => {
  for (const response of [{ error: { code: "bad_code_verifier" } }, { data: { session: null }, error: null }]) {
    const handle = createAuthCallbackHandler({ exchangeCode: async () => response });
    await assert.rejects(handle("https://app.example.com/?code=bad&auth=reset-password"));
  }
});

test("callback Google normal bukan recovery; callback token recovery divalidasi lewat SDK", async () => {
  const session = { user: { id: "owner" } };
  const handle = createAuthCallbackHandler({
    exchangeCode: async () => ({ data: { session }, error: null }),
    setSession: async (tokens) => { assert.deepEqual(tokens, { access_token: "a", refresh_token: "b" }); return { data: { session }, error: null }; },
  });
  assert.equal((await handle("https://app.example.com/?code=google")).recovery, false);
  assert.equal((await handle("com.cuansync.app://auth/callback#access_token=a&refresh_token=b&type=recovery")).recovery, true);
});

test("kode dan token dihapus dari URL tanpa menghapus query/anchor lain", () => {
  assert.equal(cleanAuthCallbackUrl("https://app.example.com/?code=secret&auth=reset-password&keep=yes#history"), "https://app.example.com/?keep=yes#history");
  assert.equal(cleanAuthCallbackUrl("https://app.example.com/#access_token=secret&refresh_token=secret&type=recovery&provider_token=secret"), "https://app.example.com/");
});

test("penanda pemulihan hanya berlaku untuk pemilik sesi yang sama dan aman di mode privat", () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  savePasswordRecovery(storage, "owner");
  assert.equal(values.get(RECOVERY_STORAGE_KEY), "owner");
  assert.equal(readPasswordRecovery(storage, "owner"), true);
  assert.equal(readPasswordRecovery(storage, "other"), false);
  savePasswordRecovery(storage, "");
  assert.equal(readPasswordRecovery(storage, "owner"), false);
  const denied = { getItem() { throw new Error(); }, setItem() { throw new Error(); } };
  assert.doesNotThrow(() => savePasswordRecovery(denied, "owner"));
  assert.equal(readPasswordRecovery(denied, "owner"), false);
});

test("pesan kegagalan terlokalisasi dan tidak membocorkan respons server", () => {
  assert.match(getEmailAuthError({ code: "invalid_credentials" }), /Email atau kata sandi/);
  assert.match(getEmailAuthError({ code: "email_not_confirmed" }), /belum diverifikasi/);
  assert.match(getEmailAuthError({ status: 429 }), /Tunggu/);
  assert.match(getEmailAuthError({ code: "email_address_not_authorized" }), /Layanan email belum tersedia/);
  assert.match(getEmailAuthError({}, "callback"), /peramban yang sama/);
  assert.doesNotMatch(getEmailAuthError({ message: "secret-server-data" }), /secret-server-data/);
  assert.match(RECOVERY_SENT_MESSAGE, /Jika email ini terdaftar/);
  assert.match(CONFIRMATION_SENT_MESSAGE, /Akun Google lama/);
});

test("UI menyediakan email/password, Google, demo, label aksesibel dan autocomplete", () => {
  const login = renderToStaticMarkup(React.createElement(EmailAuthScreen, { supabaseReady: true }));
  assert.match(login, /type="email"/);
  assert.match(login, /type="password"/);
  assert.match(login, /autoComplete="current-password"/);
  assert.match(login, /Lupa kata sandi/);
  assert.match(login, /Lanjut dengan Google/);
  assert.match(login, /Coba demo tanpa akun/);
  assert.doesNotMatch(login, /minLength="8"/);
  const recovery = renderToStaticMarkup(React.createElement(PasswordRecoveryScreen, { email: "owner@example.com", onCancel() {} }));
  assert.equal((recovery.match(/autoComplete="new-password"/g) || []).length, 2);
  assert.match(recovery, /Batal dan keluar/);
  assert.match(recovery, /bukan kata sandi Google/);
});

test("wiring pemulihan mendahului dashboard dan listener demo dipulihkan", () => {
  const main = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
  assert.match(main, /detectSessionInUrl: false/);
  assert.match(main, /demoAuth && !pendingWebAuthUrl/);
  assert.match(main, /user\?\.id === passwordRecoveryUserId/);
  assert.ok(main.indexOf("if (authLinkError)") < main.indexOf("if (mode === \"supabase\" && user?.id === passwordRecoveryUserId)"));
  const signOut = main.slice(main.indexOf("async function handleSignOut"), main.indexOf("async function persistDemoTransactions"));
  assert.match(signOut, /setAuthRecoveryAttempt/);
  const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  assert.match(styles, /html\.is-native-app \.auth-shell\s*\{\s*height: 100%;\s*min-height: 0;\s*overflow-y: auto/);
});
