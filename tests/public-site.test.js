import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AuthFrame } from "../src/components/auth/EmailAuth.js";
import { getPublicLegalLinks } from "../src/lib/publicLegalLinks.js";

const landing = readFileSync(new URL("../landing/index.html", import.meta.url), "utf8");
const linkScript = readFileSync(new URL("../landing/main.js", import.meta.url), "utf8")
  .split("/* Garis bawah navbar")[0];

function appLink({ hostname = "landing.example.com", meta = "https://cuansync.vercel.app/" } = {}) {
  let href = "https://cuansync.vercel.app/";
  runInNewContext(linkScript, {
    URL,
    console: { warn() {} },
    location: { hostname, protocol: hostname === "landing.example.com" ? "https:" : "http:" },
    document: {
      querySelector: () => ({ content: meta }),
      querySelectorAll: () => [{ setAttribute: (name, value) => { if (name === "href") href = value; } }],
    },
  });
  return href;
}

test("landing CTA menuju aplikasi walau JavaScript tidak berjalan", () => {
  const buttons = [...landing.matchAll(/data-app-link href="([^"]+)"/g)];
  assert.equal(buttons.length, 4);
  for (const [, href] of buttons) assert.equal(href, "https://cuansync.vercel.app/");
  assert.doesNotMatch(landing, /GANTI_DENGAN|mailto:\[ISI:/);
});

test("landing memakai alamat produksi atau port pengembangan yang benar", () => {
  assert.equal(appLink(), "https://cuansync.vercel.app/");
  assert.equal(appLink({ meta: "https://app.example.com/" }), "https://app.example.com/");
  assert.equal(appLink({ hostname: "127.0.0.1" }), "http://127.0.0.1:5173/");
  assert.equal(appLink({ hostname: "localhost" }), "http://localhost:5173/");
});

test("alamat landing yang tidak valid tidak membuat CTA berputar ke halaman sendiri", () => {
  for (const meta of ["", undefined, "/", "GANTI_ALAMAT", "javascript:alert(1)", "http://example.com", "https://user:pass@example.com"]) {
    assert.equal(appLink({ meta }), "https://cuansync.vercel.app/");
  }
});

test("tautan dokumen hanya menerima origin HTTPS final", () => {
  assert.deepEqual(getPublicLegalLinks(" https://cuansync.example "), {
    privacy: "https://cuansync.example/privasi.html",
    terms: "https://cuansync.example/ketentuan.html",
  });
  for (const input of [null, undefined, "", "/", "GANTI_ALAMAT", "http://example.com", "javascript:alert(1)", "https://user:pass@example.com", "https://example.com/login", "https://example.com/?token=test", "https://example.com/#hash"]) {
    assert.equal(getPublicLegalLinks(input), null);
  }
});

test("layar auth menyediakan link dokumen final tanpa mengarahkan ke draf saat belum diatur", () => {
  const render = (legalSiteUrl) => renderToStaticMarkup(React.createElement(AuthFrame, {
    title: "Masuk", helper: "Selamat datang", legalSiteUrl,
  }));
  const ready = render("https://cuansync.example");
  assert.match(ready, /aria-label="Informasi layanan"/);
  assert.match(ready, /href="https:\/\/cuansync.example\/privasi.html"/);
  assert.match(ready, /href="https:\/\/cuansync.example\/ketentuan.html"/);
  assert.match(ready, /rel="noopener noreferrer"/);
  assert.doesNotMatch(render(""), /Informasi layanan|Kebijakan Privasi|Ketentuan Layanan/);
  assert.doesNotMatch(render("javascript:alert(1)"), /Informasi layanan/);
});
