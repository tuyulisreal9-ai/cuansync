import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildAssetAccountBalancePlan,
  buildAssetAccountInsights,
} from "../src/domain/assets.js";
import {
  computeGoalAllocationState,
  evaluateAccountDebit,
  getDefaultGoalFundingAccountId,
  getGoalFundingAccountOptions,
  syncGoalActivityForTransaction,
  validateGoalActivity,
} from "../src/domain/goals.js";

const USER_ID = "user-test";
const GOAL_ID = "goal-darurat";
const BCA_ID = "bca-idr";
const MANDIRI_ID = "mandiri-idr";

test("migrasi alokasi target aman dan atomik", async () => {
  const migration = await readFile(
    new URL("../supabase/safe_goal_allocation_migration.sql", import.meta.url),
    "utf8",
  );

  assert.match(migration, /\bbegin\s*;/i);
  assert.match(migration, /\bcommit\s*;/i);
  assert.match(migration, /add column if not exists currency text/i);
  assert.match(migration, /create table if not exists public\.goal_allocations/i);
  assert.match(migration, /enable row level security/i);
  assert.equal(/\btruncate\b/i.test(migration), false);
  assert.equal(/delete\s+from\s+public\.goals/i.test(migration), false);
  assert.equal(/drop\s+table/i.test(migration), false);
});

function account(id, balance, currency = "IDR", name = id) {
  return {
    id,
    user_id: USER_ID,
    name,
    account_type: "bank",
    currency,
    balance_amount: balance,
    is_allocatable: true,
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

function goal(overrides = {}) {
  return {
    id: GOAL_ID,
    user_id: USER_ID,
    name: "Dana Darurat",
    currency: "IDR",
    target_amount: 50_000_000,
    target_amount_idr: 50_000_000,
    saved_amount_idr: 0,
    target_type: "hold_balance",
    status: "active",
    protection_mode: "flexible",
    funding_status: "funded",
    goal_funding_accounts: [
      {
        goal_id: GOAL_ID,
        account_id: BCA_ID,
        user_id: USER_ID,
        currency: "IDR",
        is_primary: true,
      },
    ],
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function assign(
  amount,
  currency = "IDR",
  goalId = GOAL_ID,
  accountId = BCA_ID,
) {
  return {
    id: `assign-${goalId}-${amount}`,
    user_id: USER_ID,
    goal_id: goalId,
    type: "assign",
    amount,
    currency,
    account_id: accountId,
    mapping_status: "mapped",
    created_at: "2026-01-02T00:00:00.000Z",
  };
}

test("alokasi tidak mengubah rekening atau menggandakan total aset", () => {
  const accounts = [account(BCA_ID, 50_000_000, "IDR", "BCA")];
  const state = computeGoalAllocationState({
    accounts,
    goals: [goal()],
    activities: [assign(30_000_000)],
    now: new Date("2026-07-28T00:00:00.000Z"),
  });
  const assetSummary = buildAssetAccountInsights(accounts, null, "IDR");

  assert.equal(accounts[0].balance_amount, 50_000_000);
  assert.equal(assetSummary.totalValueIdr, 50_000_000);
  assert.equal(state.goals[0].availableAmount, 30_000_000);
  assert.equal(state.summaries.IDR.unallocatedAmount, 20_000_000);
  assert.equal(state.goals[0].progress, 0.6);
});

test("transfer internal hanya mengubah lokasi uang", () => {
  const accounts = [
    account(BCA_ID, 50_000_000, "IDR", "BCA"),
    account(MANDIRI_ID, 0, "IDR", "Mandiri"),
  ];
  const plan = buildAssetAccountBalancePlan(accounts, [
    { accountId: BCA_ID, currency: "IDR", amount: -10_000_000 },
    { accountId: MANDIRI_ID, currency: "IDR", amount: 10_000_000 },
  ]);
  const state = computeGoalAllocationState({
    accounts: plan.nextAccounts,
    goals: [goal()],
    activities: [assign(30_000_000)],
  });

  assert.equal(
    plan.nextAccounts.reduce(
      (sum, item) => sum + Number(item.balance_amount),
      0,
    ),
    50_000_000,
  );
  assert.equal(state.goals[0].availableAmount, 30_000_000);
  assert.equal(state.summaries.IDR.unallocatedAmount, 20_000_000);
});

test("pengeluaran dengan target mengurangi rekening dan dana target", () => {
  const accounts = [account(BCA_ID, 50_000_000, "IDR", "BCA")];
  const plan = buildAssetAccountBalancePlan(accounts, [
    { accountId: BCA_ID, currency: "IDR", amount: -5_000_000 },
  ]);
  const transaction = {
    id: "expense-target",
    user_id: USER_ID,
    type: "expense",
    amount: 5_000_000,
    currency: "IDR",
    target_id: GOAL_ID,
    source_account_id: BCA_ID,
    occurred_at: "2026-07-28T00:00:00.000Z",
  };
  const activities = syncGoalActivityForTransaction(
    [assign(30_000_000)],
    transaction,
  );
  const state = computeGoalAllocationState({
    accounts: plan.nextAccounts,
    goals: [goal()],
    activities,
  });

  assert.equal(plan.nextAccounts[0].balance_amount, 45_000_000);
  assert.equal(state.goals[0].availableAmount, 25_000_000);
  assert.equal(state.summaries.IDR.unallocatedAmount, 20_000_000);
});

test("pengeluaran tanpa target hanya mengurangi dana belum dialokasikan", () => {
  const accounts = [account(BCA_ID, 50_000_000, "IDR", "BCA")];
  const plan = buildAssetAccountBalancePlan(accounts, [
    { accountId: BCA_ID, currency: "IDR", amount: -5_000_000 },
  ]);
  const state = computeGoalAllocationState({
    accounts: plan.nextAccounts,
    goals: [goal()],
    activities: [assign(30_000_000)],
  });

  assert.equal(plan.nextAccounts[0].balance_amount, 45_000_000);
  assert.equal(state.goals[0].availableAmount, 30_000_000);
  assert.equal(state.summaries.IDR.unallocatedAmount, 15_000_000);
});

test("alokasi melebihi dana belum dialokasikan ditolak", () => {
  const accounts = [account(BCA_ID, 50_000_000, "IDR", "BCA")];
  const state = computeGoalAllocationState({
    accounts,
    goals: [goal()],
    activities: [assign(30_000_000)],
  });
  const validation = validateGoalActivity({
    goal: state.goals[0],
    type: "assign",
    amount: 20_000_001,
    allocationState: state,
  });

  assert.equal(state.summaries.IDR.unallocatedAmount, 20_000_000);
  assert.equal(validation.valid, false);
});

test("pool IDR dan SGD tetap terpisah", () => {
  const accounts = [
    account(BCA_ID, 50_000_000, "IDR", "BCA"),
    account("dbs-sgd", 10_000, "SGD", "DBS"),
  ];
  const sgdGoal = goal({
    id: "goal-sgd",
    name: "Dana SGD",
    currency: "SGD",
    target_amount: 5_000,
    target_amount_idr: 5_000,
    goal_funding_accounts: [
      {
        goal_id: "goal-sgd",
        account_id: "dbs-sgd",
        user_id: USER_ID,
        currency: "SGD",
        is_primary: true,
      },
    ],
  });
  const state = computeGoalAllocationState({
    accounts,
    goals: [goal(), sgdGoal],
    activities: [
      assign(30_000_000),
      assign(2_000, "SGD", "goal-sgd", "dbs-sgd"),
    ],
  });

  assert.equal(state.summaries.IDR.liquidAmount, 50_000_000);
  assert.equal(state.summaries.IDR.unallocatedAmount, 20_000_000);
  assert.equal(state.summaries.SGD.liquidAmount, 10_000);
  assert.equal(state.summaries.SGD.unallocatedAmount, 8_000);
});

test("reservasi melekat pada rekening sumber, bukan pool mata uang global", () => {
  const accounts = [
    account(BCA_ID, 5_000_000, "IDR", "BCA"),
    account(MANDIRI_ID, 10_000_000, "IDR", "Mandiri"),
  ];
  const state = computeGoalAllocationState({
    accounts,
    goals: [goal({ target_amount: 8_000_000, target_amount_idr: 8_000_000 })],
    activities: [assign(4_000_000)],
  });

  assert.equal(state.accountAvailability[BCA_ID].reservedBalance, 4_000_000);
  assert.equal(state.accountAvailability[BCA_ID].availableBalance, 1_000_000);
  assert.equal(state.accountAvailability[MANDIRI_ID].reservedBalance, 0);
  assert.equal(state.accountAvailability[MANDIRI_ID].availableBalance, 10_000_000);
});

test("pengeluaran biasa yang menyeberangi dana target memerlukan pilihan eksplisit", () => {
  const state = computeGoalAllocationState({
    accounts: [account(BCA_ID, 5_000_000, "IDR", "BCA")],
    goals: [goal({ target_amount: 4_000_000, target_amount_idr: 4_000_000 })],
    activities: [assign(4_000_000)],
  });
  const ordinary = evaluateAccountDebit({
    allocationState: state,
    accountId: BCA_ID,
    amount: 2_000_000,
  });
  const intentional = evaluateAccountDebit({
    allocationState: state,
    accountId: BCA_ID,
    amount: 2_000_000,
    targetId: GOAL_ID,
  });

  assert.equal(ordinary.allowed, false);
  assert.equal(ordinary.requiresDecision, true);
  assert.equal(intentional.allowed, true);
});

test("alokasi legacy tanpa sumber tetap terlihat tetapi tidak mengunci saldo", () => {
  const legacyGoal = goal({
    funding_status: "unmapped_legacy",
    goal_funding_accounts: [],
  });
  const state = computeGoalAllocationState({
    accounts: [account(BCA_ID, 5_000_000, "IDR", "BCA")],
    goals: [legacyGoal],
    activities: [
      {
        ...assign(3_000_000),
        account_id: null,
        mapping_status: "unmapped_legacy",
      },
    ],
  });

  assert.equal(state.goals[0].availableAmount, 3_000_000);
  assert.equal(state.goals[0].unmappedAmount, 3_000_000);
  assert.equal(state.accountAvailability[BCA_ID].reservedBalance, 0);
  assert.equal(state.accountAvailability[BCA_ID].availableBalance, 5_000_000);
});

test("target legacy dapat memilih rekening sumber saat alokasi berikutnya", () => {
  const legacyGoal = goal({
    funding_status: "unmapped_legacy",
    goal_funding_accounts: [],
  });
  const accounts = [
    account(BCA_ID, 5_000_000, "IDR", "BCA"),
    {
      ...account(MANDIRI_ID, 10_000_000, "IDR", "Mandiri"),
      is_primary: true,
    },
    account("dbs-sgd", 20_000, "SGD", "DBS"),
  ];
  const state = computeGoalAllocationState({ accounts, goals: [legacyGoal] });
  const options = getGoalFundingAccountOptions({
    goal: state.goals[0],
    type: "assign",
    accounts: state.accountAvailability
      ? accounts.map((item) => ({
          ...item,
          availableBalance:
            state.accountAvailability[item.id]?.availableBalance ??
            item.balance_amount,
        }))
      : accounts,
  });
  const validation = validateGoalActivity({
    goal: state.goals[0],
    type: "assign",
    amount: 2_000_000,
    accountId: MANDIRI_ID,
    allocationState: state,
  });

  assert.deepEqual(options.map((item) => item.id), [MANDIRI_ID, BCA_ID]);
  assert.equal(
    getDefaultGoalFundingAccountId({
      goal: state.goals[0],
      type: "assign",
      accounts,
    }),
    MANDIRI_ID,
  );
  assert.equal(validation.valid, true);
});

test("pelepasan target hanya menawarkan rekening yang memiliki alokasi", () => {
  const accounts = [
    account(BCA_ID, 5_000_000, "IDR", "BCA"),
    account(MANDIRI_ID, 10_000_000, "IDR", "Mandiri"),
  ];
  const state = computeGoalAllocationState({
    accounts,
    goals: [goal()],
    activities: [assign(3_000_000)],
  });
  const options = getGoalFundingAccountOptions({
    goal: state.goals[0],
    type: "release",
    accounts,
  });

  assert.deepEqual(options.map((item) => item.id), [BCA_ID]);
  assert.equal(options[0].allocatedAmount, 3_000_000);
});

test("bridge klien lama menyimpan alokasi tanpa akun sebagai legacy milik pengguna", async () => {
  const migration = await readFile(
    new URL(
      "../supabase/migrations/20260821191352_bridge_legacy_goal_allocations.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(migration, /mapping_status set default 'unmapped_legacy'/i);
  assert.match(migration, /owned_goal\.id = goal_allocations\.goal_id/i);
  assert.match(migration, /owned_goal\.user_id = \(select auth\.uid\(\)\)/i);
  assert.match(migration, /funding\.account_id = goal_allocations\.account_id/i);
  assert.equal(/security\s+definer/i.test(migration), false);
  assert.equal(/create\s+trigger/i.test(migration), false);
  assert.equal(/delete\s+from/i.test(migration), false);
});

test("migration account-aware mempertahankan legacy dan menyediakan RPC atomik", async () => {
  const migration = await readFile(
    new URL(
      "../supabase/migrations/20260821090000_account_aware_goal_integrity.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(migration, /mapping_status\s*=\s*case/i);
  assert.match(migration, /unmapped_legacy/i);
  assert.match(migration, /create table if not exists public\.goal_funding_accounts/i);
  assert.match(migration, /create or replace function public\.record_transaction_atomic/i);
  assert.match(migration, /create or replace function public\.update_transaction_atomic/i);
  assert.match(migration, /create or replace function public\.delete_transaction_atomic/i);
  assert.match(migration, /security definer\s+set search_path = ''/i);
  assert.equal(/\btruncate\b/i.test(migration), false);
  assert.equal(/drop\s+table/i.test(migration), false);
});
