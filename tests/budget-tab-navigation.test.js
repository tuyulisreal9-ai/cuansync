import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

const MAIN = "src/main.js";
const WORKSPACE = "src/components/budget/BudgetWorkspacePage.js";

/* Setelah menekan "Kelola target" atau "Buat target pertama" dari Kondisi
   keuanganmu, tab Jatah selalu membuka Dompet & tabungan sampai halaman
   dimuat ulang: permintaan sekali pakai "__goals__" tersimpan permanen dan
   halaman Jatah mengalihkan dirinya sendiri setiap kali dipasang. */
test("permintaan membuka Target tidak disimpan sebagai fokus Jatah", async () => {
  const main = await source(MAIN);
  const fungsi = main.slice(
    main.indexOf("function openBudgetWorkspace("),
    main.indexOf("function dismissTransactionFabHint("),
  );

  assert.match(fungsi, /categoryKey === "__goals__"/);
  assert.match(fungsi, /navigateAppTab\("investment"\)/);
  // Kunci fokus dikosongkan, bukan diisi "__goals__".
  assert.match(fungsi, /setBudgetFocusCategoryKey\(null\)/);
});

test("halaman Jatah tidak lagi mengalihkan dirinya sendiri", async () => {
  const workspace = await source(WORKSPACE);

  assert.doesNotMatch(workspace, /focusCategoryKey !== "__goals__"/);
  assert.doesNotMatch(workspace, /onNavigate\?\.\("investment"\)/);
  // Tidak ada lagi penanganan khusus "__goals__" di halaman ini.
  assert.doesNotMatch(workspace, /__goals__/);
});

test("kunci fokus kategori dibersihkan saat pindah tab", async () => {
  const main = await source(MAIN);
  const fungsi = main.slice(
    main.indexOf("function navigateAppTab("),
    main.indexOf("function openBudgetWorkspace("),
  );

  assert.match(fungsi, /tab !== "budget"[\s\S]{0,80}setBudgetFocusCategoryKey\(null\)/);
});
