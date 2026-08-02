import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildAssetAccountBalancePlan,
  buildAssetAccountInsights,
} from "../src/domain/assets.js";
import {
  computeGoalAllocationState,
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
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function assign(amount, currency = "IDR", goalId = GOAL_ID) {
  return {
    id: `assign-${goalId}-${amount}`,
    user_id: USER_ID,
    goal_id: goalId,
    type: "assign",
    amount,
    currency,
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
  });
  const state = computeGoalAllocationState({
    accounts,
    goals: [goal(), sgdGoal],
    activities: [
      assign(30_000_000),
      assign(2_000, "SGD", "goal-sgd"),
    ],
  });

  assert.equal(state.summaries.IDR.liquidAmount, 50_000_000);
  assert.equal(state.summaries.IDR.unallocatedAmount, 20_000_000);
  assert.equal(state.summaries.SGD.liquidAmount, 10_000);
  assert.equal(state.summaries.SGD.unallocatedAmount, 8_000);
});
