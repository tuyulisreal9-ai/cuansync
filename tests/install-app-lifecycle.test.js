import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Run the actual module in a fresh browser-like realm per case. No production
// reset API or shared global window is needed for lifecycle/race tests.
const source = readFileSync(new URL("../src/lib/installApp.js", import.meta.url), "utf8");
function browserSession() {
  const listeners = new Map();
  const context = vm.createContext({
    window: { addEventListener: (name, listener) => listeners.set(name, listener) },
  });
  vm.runInContext(source.replaceAll("export ", "") + `
    globalThis.api = { INSTALL_STATE, canPromptInstall, getInstallState,
      promptInstall, subscribeInstallPrompt };`, context);
  return { ...context.api, emit: (name, event = {}) => listeners.get(name)?.(event) };
}
function offer(session, { outcome = "dismissed", prompt, choice } = {}) {
  const calls = { prevented: 0, prompted: 0 };
  session.emit("beforeinstallprompt", {
    preventDefault() { calls.prevented++; },
    prompt() { calls.prompted++; return prompt?.(); },
    get userChoice() { return choice ?? Promise.resolve({ outcome }); },
  });
  return calls;
}

test("late Settings subscribers see an offer captured earlier; no automatic prompt", () => {
  const session = browserSession();
  assert.equal(session.getInstallState(), session.INSTALL_STATE.PANDUAN);
  const calls = offer(session);
  assert.equal(calls.prevented, 1);
  assert.equal(calls.prompted, 0);
  assert.equal(session.getInstallState(), session.INSTALL_STATE.SIAP);
  assert.equal(session.canPromptInstall(), true);
});

test("appinstalled remembers success in the current browser tab without standalone", () => {
  const session = browserSession();
  const states = [];
  session.subscribeInstallPrompt(() => states.push(session.getInstallState()));
  offer(session);
  session.emit("appinstalled");
  assert.equal(session.getInstallState({ standalone: false }), session.INSTALL_STATE.TERPASANG);
  assert.equal(session.canPromptInstall(), false);
  assert.deepEqual(states, [session.INSTALL_STATE.SIAP, session.INSTALL_STATE.TERPASANG]);
  // No persistent 'installed' flag that can outlive an uninstall.
  assert.equal(browserSession().getInstallState(), session.INSTALL_STATE.PANDUAN);
});

test("install via browser menu also updates the page without an earlier offer", () => {
  const session = browserSession();
  session.emit("appinstalled");
  assert.equal(session.getInstallState(), session.INSTALL_STATE.TERPASANG);
});

test("accepted waits for appinstalled; it is not proof of completed installation", async () => {
  const session = browserSession();
  offer(session, { outcome: "accepted" });
  assert.equal(await session.promptInstall(), "accepted");
  assert.equal(session.getInstallState(), session.INSTALL_STATE.DISETUJUI);
  session.emit("appinstalled");
  assert.equal(session.getInstallState(), session.INSTALL_STATE.TERPASANG);
});

test("double tap consumes an offer once and reports cancellation, not unsupported", async () => {
  const session = browserSession();
  let choose;
  const calls = offer(session, { choice: new Promise((resolve) => { choose = resolve; }) });
  const pending = session.promptInstall();
  assert.equal(session.getInstallState(), session.INSTALL_STATE.KONFIRMASI);
  assert.equal(session.canPromptInstall(), false);
  assert.equal(await session.promptInstall(), null);
  choose({ outcome: "dismissed" });
  assert.equal(await pending, "dismissed");
  assert.equal(calls.prompted, 1);
  assert.equal(session.getInstallState(), session.INSTALL_STATE.DIBATALKAN);
  assert.equal(await session.promptInstall(), null);
  assert.equal(session.getInstallState(), session.INSTALL_STATE.DIBATALKAN);
  offer(session);
  assert.equal(session.getInstallState(), session.INSTALL_STATE.SIAP);
});

for (const failure of ["sync", "async", "choice"]) {
  test(`${failure} prompt failure is visible and a new browser offer permits retry`, async () => {
    const session = browserSession();
    const error = new Error("Browser denied prompt");
    offer(session, {
      prompt: () => {
        if (failure === "sync") throw error;
        if (failure === "async") return Promise.reject(error);
      },
      // Reject only when requested, avoiding an unrelated unhandled rejection.
      choice: failure === "choice" ? { then: (_, reject) => reject(error) } : undefined,
    });
    assert.equal(await session.promptInstall(), null);
    assert.equal(session.getInstallState(), session.INSTALL_STATE.GAGAL);
    offer(session, { outcome: "accepted" });
    assert.equal(session.getInstallState(), session.INSTALL_STATE.SIAP);
    assert.equal(await session.promptInstall(), "accepted");
  });
}

for (const outcome of ["accepted", "dismissed", "error"]) {
  test(`appinstalled wins over a late ${outcome} prompt result`, async () => {
    const session = browserSession();
    let choose, reject;
    offer(session, { choice: new Promise((resolve, fail) => { choose = resolve; reject = fail; }) });
    const pending = session.promptInstall();
    session.emit("appinstalled");
    if (outcome === "error") reject(new Error("late failure"));
    else choose({ outcome });
    await pending;
    assert.equal(session.getInstallState(), session.INSTALL_STATE.TERPASANG);
    assert.equal(session.canPromptInstall(), false);
  });
}

test("a fresh offer arriving during a prompt survives its eventual dismissal", async () => {
  const session = browserSession();
  let choose;
  offer(session, { choice: new Promise((resolve) => { choose = resolve; }) });
  const pending = session.promptInstall();
  const fresh = offer(session, { outcome: "accepted" });
  assert.equal(session.getInstallState(), session.INSTALL_STATE.KONFIRMASI);
  choose({ outcome: "dismissed" });
  await pending;
  assert.equal(session.getInstallState(), session.INSTALL_STATE.SIAP);
  assert.equal(await session.promptInstall(), "accepted");
  assert.equal(fresh.prompted, 1);
});

test("subscribers receive final states, isolate errors, and unsubscribe cleanly", async () => {
  const session = browserSession();
  const states = [];
  session.subscribeInstallPrompt(() => { throw new Error("unmounted view"); });
  const unsubscribe = session.subscribeInstallPrompt(() => states.push(session.getInstallState()));
  offer(session);
  await session.promptInstall();
  assert.deepEqual(states, ["siap", "konfirmasi", "dibatalkan"]);
  unsubscribe();
  session.emit("appinstalled");
  assert.equal(states.length, 3);
});

test("native/standalone sessions remain installed even when a prompt is absent", () => {
  const session = browserSession();
  assert.equal(session.getInstallState({ standalone: true }), session.INSTALL_STATE.TERPASANG);
  assert.equal(session.getInstallState({ nativeApp: true }), session.INSTALL_STATE.TERPASANG);
});
