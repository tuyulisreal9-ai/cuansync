import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("sheet formulir mengikuti tinggi viewport dinamis dan memiliki area scroll", () => {
  const sheetShell = source("src/components/shared/SheetShell.js");

  assert.match(sheetShell, /100dvh/);
  assert.match(sheetShell, /data-sheet-scroll="true"/);
  assert.match(sheetShell, /overscroll-contain/);
  assert.doesNotMatch(sheetShell, /max-h-\[70svh\]/);
});

test("action dock menyediakan mode sheet dan mode formulir di atas navigasi", () => {
  const actionDock = source("src/components/shared/FormActionDock.js");

  assert.match(actionDock, /sticky/);
  assert.match(actionDock, /fixedOnMobile/);
  assert.match(actionDock, /safe-area-inset-bottom/);
  assert.match(actionDock, /7\.25rem/);
});

test("semua sheet formulir berisiko memakai action dock bersama", () => {
  const auditedFiles = [
    "src/components/assets/WealthGoalsPage.js",
    "src/components/budget/TargetPlanningSection.js",
    "src/components/settings/SettingsPage.js",
    "src/components/transactions/TransactionForm.js",
    "src/components/transactions/HistoryListParts.js",
    "src/components/transactions/HistoryToolSheets.js",
  ];

  for (const path of auditedFiles) {
    assert.match(source(path), /FormActionDock/, `${path} belum memakai action dock`);
  }
});

test("form halaman anggaran dan catatan memakai tray aksi mobile", () => {
  assert.match(
    source("src/components/budget/BudgetWorkspacePage.js"),
    /fixedOnMobile=\$\{true\}/,
  );
  assert.match(
    source("src/components/shared/SubmitActionBar.js"),
    /fixedOnMobile=\$\{true\}/,
  );
});
