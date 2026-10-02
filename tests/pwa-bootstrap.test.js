import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../src/bootstrap.js", import.meta.url), "utf8");
const flush = () => new Promise((resolve) => setImmediate(resolve));

function boot({ readyState = "complete", production = true, native = false,
  supported = true, registerError, synchronousError = false } = {}) {
  const listeners = new Map();
  const registrations = [], warnings = [], errors = [];
  const root = { innerHTML: "working app" };
  let finishMain;
  const context = vm.createContext({
    mainBundle: new Promise((resolve) => { finishMain = resolve; }),
    document: {
      readyState, getElementById: () => root,
      documentElement: { classList: { contains: (name) => native && name === "is-native-app" } },
    },
    window: { addEventListener(name, callback, options) { listeners.set(name, { callback, options }); } },
    navigator: supported ? { serviceWorker: { register(path) {
      registrations.push(path);
      if (registerError) {
        if (synchronousError) throw registerError;
        return Promise.reject(registerError);
      }
      return Promise.resolve({ scope: "/" });
    } } } : {},
    console: { warn: (...args) => warnings.push(args), error: (...args) => errors.push(args) },
  });
  vm.runInContext(source
    .replace('import "./lib/installApp.js";', "")
    .replace('import("./main.js")', "mainBundle")
    .replaceAll("import.meta.env.PROD", String(production)), context);
  return { registrations, warnings, errors, root, finishMain, listeners, context,
    load() {
      context.document.readyState = "complete";
      const event = listeners.get("load");
      if (event?.options?.once) listeners.delete("load");
      event?.callback();
    },
  };
}

test("service worker registers when load happened before the main bundle finished", async () => {
  const app = boot({ readyState: "loading" });
  app.load(); // Original regression: the later load listener would never run.
  app.finishMain();
  await flush();
  assert.deepEqual(app.registrations, ["/sw.js"]);
  assert.equal(app.listeners.has("load"), false);
});

for (const readyState of ["loading", "interactive"]) {
  test(`service worker waits for load from ${readyState} and registers once`, async () => {
    const app = boot({ readyState });
    app.finishMain();
    await flush();
    assert.equal(app.registrations.length, 0);
    assert.equal(app.listeners.get("load").options.once, true);
    app.load();
    app.load();
    await flush();
    assert.deepEqual(app.registrations, ["/sw.js"]);
  });
}

test("an already complete document does not wait for another load event", async () => {
  const app = boot();
  app.finishMain();
  await flush();
  assert.deepEqual(app.registrations, ["/sw.js"]);
});

for (const options of [{ production: false }, { native: true }, { supported: false }]) {
  test(`service worker is skipped for ${JSON.stringify(options)}`, async () => {
    const app = boot(options);
    app.finishMain();
    await flush();
    app.load();
    await flush();
    assert.equal(app.registrations.length, 0);
    assert.equal(app.listeners.has("load"), false);
    assert.equal(app.errors.length, 0);
  });
}

for (const synchronousError of [true, false]) {
  test(`registration failure (${synchronousError ? "throw" : "reject"}) does not hide the working app`, async () => {
    const app = boot({ registerError: new Error("Unavailable"), synchronousError });
    app.finishMain();
    await flush();
    assert.equal(app.warnings.length, 1);
    assert.equal(app.errors.length, 0);
    assert.equal(app.root.innerHTML, "working app");
  });
}
