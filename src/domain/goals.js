import { isAllocatableAssetAccount, normalizeAssetAccounts } from "./assets.js";
import {
  DEFAULT_BASE_CURRENCY,
  normalizeCurrencyCode,
} from "../lib/currency.js";

export const GOAL_TYPE_HOLD_BALANCE = "hold_balance";
export const GOAL_TYPE_COLLECT_BY_DATE = "collect_by_date";

export const GOAL_TYPES = [
  {
    value: GOAL_TYPE_HOLD_BALANCE,
    label: "Jaga Saldo",
    description: "Cocok untuk dana darurat dan dana cadangan yang perlu dijaga.",
  },
  {
    value: GOAL_TYPE_COLLECT_BY_DATE,
    label: "Kumpulkan Sampai Tanggal",
    description: "Cocok untuk rencana sekali pakai seperti mudik atau liburan.",
  },
];

export const GOAL_ACTIVITY_TYPES = new Set([
  "assign",
  "release",
  "spend",
  "adjustment",
]);

const GOAL_STATUSES = new Set([
  "active",
  "completed",
  "overdue",
  "used",
  "paused",
  "archived",
]);

function createStableId(prefix, parts) {
  const seed = parts.map((part) => String(part ?? "")).join("|");
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return `${prefix}-${hash.toString(36)}`;
}

export function createLegacyGoalId(row, index = 0) {
  return createStableId("legacy-goal", [
    row?.created_at,
    row?.name,
    row?.target_amount,
    row?.target_amount_idr,
    row?.saved_amount_idr,
    row?.deadline,
    index,
  ]);
}

export function normalizeGoal(row, index = 0) {
  const currency = normalizeCurrencyCode(
    row?.currency || (row?.target_amount_idr != null ? "IDR" : DEFAULT_BASE_CURRENCY),
  );
  const targetAmount = Number(
    row?.target_amount ??
      row?.targetAmount ??
      row?.target_amount_idr ??
      0,
  );
  const legacyAllocatedAmount = Number(
    row?.legacy_allocated_amount ??
      row?.legacyAllocatedAmount ??
      row?.saved_amount_idr ??
      0,
  );
  const targetType =
    row?.target_type === GOAL_TYPE_HOLD_BALANCE ||
    row?.target_type === GOAL_TYPE_COLLECT_BY_DATE
      ? row.target_type
      : row?.deadline
        ? GOAL_TYPE_COLLECT_BY_DATE
        : GOAL_TYPE_HOLD_BALANCE;
  const storedStatus = GOAL_STATUSES.has(row?.status) ? row.status : "active";

  return {
    ...row,
    id: row?.id || createLegacyGoalId(row, index),
    name: String(row?.name || "Target tanpa nama").trim() || "Target tanpa nama",
    currency,
    target_type: targetType,
    targetType,
    target_amount: Number.isFinite(targetAmount) ? targetAmount : 0,
    targetAmount: Number.isFinite(targetAmount) ? targetAmount : 0,
    target_amount_idr:
      currency === "IDR" && Number.isFinite(targetAmount) ? targetAmount : 0,
    legacyAllocatedAmount:
      Number.isFinite(legacyAllocatedAmount) && legacyAllocatedAmount > 0
        ? legacyAllocatedAmount
        : 0,
    deadline: row?.deadline || null,
    note: String(row?.note || "").trim(),
    status: storedStatus,
    created_at: row?.created_at || row?.createdAt || new Date().toISOString(),
    completed_at: row?.completed_at || row?.completedAt || null,
    archived_at: row?.archived_at || row?.archivedAt || null,
    updated_at: row?.updated_at || row?.updatedAt || row?.created_at || null,
  };
}

export function normalizeGoalActivity(row, index = 0) {
  const type = GOAL_ACTIVITY_TYPES.has(row?.type) ? row.type : "adjustment";
  const rawAmount = Number(row?.amount || 0);
  const amount =
    type === "adjustment" ? rawAmount : Math.abs(Number.isFinite(rawAmount) ? rawAmount : 0);
  return {
    ...row,
    id:
      row?.id ||
      createStableId("legacy-goal-activity", [
        row?.goal_id,
        row?.transaction_id,
        row?.type,
        row?.amount,
        row?.created_at,
        index,
      ]),
    goal_id: row?.goal_id || row?.goalId || null,
    type,
    amount: Number.isFinite(amount) ? amount : 0,
    currency: normalizeCurrencyCode(row?.currency),
    transaction_id: row?.transaction_id || row?.transactionId || null,
    note: String(row?.note || "").trim(),
    created_at: row?.created_at || row?.createdAt || new Date().toISOString(),
  };
}

export function normalizeGoalActivities(rows = []) {
  return rows
    .map(normalizeGoalActivity)
    .filter((activity) => activity.goal_id && activity.amount !== 0)
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
}

export function getGoalActivityEffect(activity) {
  const normalized = normalizeGoalActivity(activity);
  if (normalized.type === "assign") return Math.abs(normalized.amount);
  if (normalized.type === "release" || normalized.type === "spend") {
    return -Math.abs(normalized.amount);
  }
  return normalized.amount;
}

export function computeLiquidPools(accounts = []) {
  return normalizeAssetAccounts(accounts).reduce((totals, account) => {
    if (!isAllocatableAssetAccount(account)) return totals;
    const currency = normalizeCurrencyCode(account.currency);
    totals[currency] =
      Number(totals[currency] || 0) + Number(account.balance_amount || 0);
    return totals;
  }, {});
}

function getDeadlineMeta(goal, now) {
  if (!goal.deadline) {
    return {
      daysLeft: null,
      periodsLeft: null,
      deadlinePassed: false,
    };
  }
  const deadline = new Date(`${goal.deadline}T23:59:59`);
  if (Number.isNaN(deadline.getTime())) {
    return {
      daysLeft: null,
      periodsLeft: null,
      deadlinePassed: false,
    };
  }
  const dayMs = 86400000;
  const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / dayMs);
  return {
    daysLeft,
    periodsLeft: Math.max(Math.ceil(Math.max(daysLeft, 1) / 30), 1),
    deadlinePassed: daysLeft < 0,
  };
}

function getGoalStatus(goal, availableAmount, deadlineMeta) {
  if (goal.status === "archived" || goal.archived_at) return "archived";
  if (goal.status === "used") return "used";
  if (goal.status === "paused") return "paused";
  if (goal.targetAmount > 0 && availableAmount >= goal.targetAmount) {
    return "completed";
  }
  if (deadlineMeta.deadlinePassed) return "overdue";
  return "active";
}

function getGoalStatusLabel(status, allocationCovered) {
  if (!allocationCovered) return "Alokasi berlebih";
  const labels = {
    active: "Aktif",
    completed: "Tercapai",
    overdue: "Terlambat",
    used: "Sudah digunakan",
    paused: "Dijeda",
    archived: "Diarsipkan",
  };
  return labels[status] || "Aktif";
}

export function computeGoalAllocationState({
  goals = [],
  activities = [],
  accounts = [],
  now = new Date(),
} = {}) {
  const normalizedGoals = goals.map(normalizeGoal);
  const normalizedActivities = normalizeGoalActivities(activities);
  const liquidByCurrency = computeLiquidPools(accounts);
  const activitiesByGoal = normalizedActivities.reduce((groups, activity) => {
    const current = groups.get(activity.goal_id) || [];
    current.push(activity);
    groups.set(activity.goal_id, current);
    return groups;
  }, new Map());

  const baseInsights = normalizedGoals.map((goal) => {
    const goalActivities = activitiesByGoal.get(goal.id) || [];
    const activityTotal = goalActivities.reduce(
      (sum, activity) => sum + getGoalActivityEffect(activity),
      0,
    );
    const rawAvailableAmount = goal.legacyAllocatedAmount + activityTotal;
    const availableAmount = Math.max(rawAvailableAmount, 0);
    const shortageAmount = Math.max(goal.targetAmount - availableAmount, 0);
    const progressRaw =
      goal.targetAmount > 0 ? availableAmount / goal.targetAmount : 0;
    const deadlineMeta = getDeadlineMeta(goal, now);
    const derivedStatus = getGoalStatus(goal, availableAmount, deadlineMeta);
    const displayProgress = derivedStatus === "used" ? 1 : Math.min(progressRaw, 1);
    const recommendationAmount =
      shortageAmount > 0 && deadlineMeta.periodsLeft
        ? shortageAmount / deadlineMeta.periodsLeft
        : 0;

    return {
      ...goal,
      activities: goalActivities,
      rawAvailableAmount,
      availableAmount,
      savedAmount: availableAmount,
      shortageAmount,
      remainingIdr: goal.currency === "IDR" ? shortageAmount : 0,
      progress: displayProgress,
      progressRaw,
      daysLeft: deadlineMeta.daysLeft,
      periodsLeft: deadlineMeta.periodsLeft,
      recommendationAmount,
      derivedStatus,
      status: derivedStatus,
      completedAt:
        goal.completed_at ||
        (derivedStatus === "completed" ? now.toISOString() : null),
    };
  });

  const allocatedByCurrency = baseInsights.reduce((totals, goal) => {
    const currency = normalizeCurrencyCode(goal.currency);
    totals[currency] =
      Number(totals[currency] || 0) + Number(goal.availableAmount || 0);
    return totals;
  }, {});
  const currencyCodes = new Set([
    ...Object.keys(liquidByCurrency),
    ...Object.keys(allocatedByCurrency),
    ...normalizedGoals.map((goal) => goal.currency),
  ]);
  const summaries = Object.fromEntries(
    [...currencyCodes].map((currency) => {
      const liquidAmount = Number(liquidByCurrency[currency] || 0);
      const allocatedAmount = Number(allocatedByCurrency[currency] || 0);
      const unallocatedAmount = liquidAmount - allocatedAmount;
      return [
        currency,
        {
          currency,
          liquidAmount,
          allocatedAmount,
          unallocatedAmount,
          overallocatedAmount: Math.max(-unallocatedAmount, 0),
          isCovered: unallocatedAmount >= -0.0001,
        },
      ];
    }),
  );
  const insights = baseInsights
    .map((goal) => {
      const summary = summaries[goal.currency] || {
        isCovered: true,
        overallocatedAmount: 0,
      };
      return {
        ...goal,
        allocationCovered: summary.isCovered,
        statusLabel: getGoalStatusLabel(goal.derivedStatus, summary.isCovered),
      };
    })
    .sort((a, b) => {
      const statusOrder = {
        overdue: 0,
        active: 1,
        paused: 2,
        completed: 3,
        used: 4,
        archived: 5,
      };
      const statusDifference =
        (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
      if (statusDifference !== 0) return statusDifference;
      if (a.daysLeft != null && b.daysLeft != null) return a.daysLeft - b.daysLeft;
      if (a.daysLeft != null) return -1;
      if (b.daysLeft != null) return 1;
      return a.created_at.localeCompare(b.created_at);
    });

  return {
    goals: insights,
    activities: normalizedActivities,
    liquidByCurrency,
    allocatedByCurrency,
    summaries,
  };
}

export function validateGoalActivity({
  goal,
  type,
  amount,
  allocationState,
}) {
  const normalizedGoal = normalizeGoal(goal);
  const numericAmount = Number(amount);
  if (!GOAL_ACTIVITY_TYPES.has(type)) {
    return { valid: false, message: "Jenis aktivitas alokasi tidak valid." };
  }
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return { valid: false, message: "Nominal harus lebih besar dari 0." };
  }
  const insight = allocationState.goals.find(
    (item) => item.id === normalizedGoal.id,
  );
  const summary = allocationState.summaries[normalizedGoal.currency] || {
    unallocatedAmount: 0,
  };
  if (type === "assign" && numericAmount > summary.unallocatedAmount + 0.0001) {
    return {
      valid: false,
      message: `Dana belum dialokasikan ${normalizedGoal.currency} tidak mencukupi.`,
    };
  }
  if (
    (type === "release" || type === "spend") &&
    numericAmount > Number(insight?.availableAmount || 0) + 0.0001
  ) {
    return {
      valid: false,
      message: `Dana tersedia pada ${normalizedGoal.name} tidak mencukupi.`,
    };
  }
  return { valid: true, message: "" };
}

export function buildTransactionGoalActivity(transaction) {
  if (
    transaction?.type !== "expense" ||
    !transaction?.target_id ||
    Number(transaction?.amount || 0) <= 0
  ) {
    return null;
  }
  return normalizeGoalActivity({
    id: `transaction-goal-${transaction.id}`,
    goal_id: transaction.target_id,
    type: "spend",
    amount: Number(transaction.amount),
    currency: transaction.currency,
    transaction_id: transaction.id,
    created_at: transaction.occurred_at || transaction.created_at,
    note: transaction.description || "Pengeluaran menggunakan target",
  });
}

export function syncGoalActivityForTransaction(
  activities,
  transaction,
) {
  const transactionId = transaction?.id;
  const next = normalizeGoalActivities(activities).filter(
    (activity) => !transactionId || activity.transaction_id !== transactionId,
  );
  const spendActivity = buildTransactionGoalActivity(transaction);
  return spendActivity ? normalizeGoalActivities([...next, spendActivity]) : next;
}
