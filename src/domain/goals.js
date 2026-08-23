import { isAllocatableAssetAccount, normalizeAssetAccounts } from "./assets.js";
import {
  DEFAULT_BASE_CURRENCY,
  normalizeCurrencyCode,
} from "../lib/currency.js";

export const GOAL_TYPE_HOLD_BALANCE = "hold_balance";
export const GOAL_TYPE_COLLECT_BY_DATE = "collect_by_date";

export const GOAL_PROTECTION_MODES = [
  {
    value: "flexible",
    label: "Fleksibel",
    description: "Peringatkan dan minta pilihan target saat dana akan terpakai.",
  },
  {
    value: "strict",
    label: "Ketat",
    description: "Dana hanya dapat dipakai melalui target yang terhubung.",
  },
  {
    value: "informational",
    label: "Informasi saja",
    description: "Pantau progres tanpa mengurangi saldo tersedia akun.",
  },
];

const GOAL_PROTECTION_VALUES = new Set(
  GOAL_PROTECTION_MODES.map((mode) => mode.value),
);

const GOAL_FUNDING_STATUSES = new Set([
  "funded",
  "plan_only",
  "unmapped_legacy",
]);

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
  "transfer_in",
  "transfer_out",
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
  const protectionMode = GOAL_PROTECTION_VALUES.has(
    row?.protection_mode ?? row?.protectionMode,
  )
    ? row?.protection_mode ?? row?.protectionMode
    : "flexible";
  const rawFundingAccounts = Array.isArray(
    row?.goal_funding_accounts ?? row?.fundingAccounts,
  )
    ? row?.goal_funding_accounts ?? row?.fundingAccounts
    : [];
  const fundingAccounts = rawFundingAccounts
    .map((funding) => ({
      ...funding,
      goal_id: funding.goal_id || row?.id || null,
      account_id: funding.account_id || funding.accountId || null,
      currency: normalizeCurrencyCode(funding.currency || currency),
      is_primary: Boolean(funding.is_primary ?? funding.isPrimary),
    }))
    .filter((funding) => funding.account_id);
  const inferredFundingStatus = fundingAccounts.length
    ? "funded"
    : legacyAllocatedAmount > 0
      ? "unmapped_legacy"
      : "plan_only";
  const fundingStatus = GOAL_FUNDING_STATUSES.has(
    row?.funding_status ?? row?.fundingStatus,
  )
    ? row?.funding_status ?? row?.fundingStatus
    : inferredFundingStatus;

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
    protection_mode: protectionMode,
    protectionMode,
    funding_status: fundingStatus,
    fundingStatus,
    spending_reduces_progress:
      typeof (row?.spending_reduces_progress ?? row?.spendingReducesProgress) ===
      "boolean"
        ? row?.spending_reduces_progress ?? row?.spendingReducesProgress
        : true,
    spendingReducesProgress:
      typeof (row?.spending_reduces_progress ?? row?.spendingReducesProgress) ===
      "boolean"
        ? row?.spending_reduces_progress ?? row?.spendingReducesProgress
        : true,
    fundingAccounts,
    primaryFundingAccountId:
      fundingAccounts.find((funding) => funding.is_primary)?.account_id ||
      fundingAccounts[0]?.account_id ||
      row?.account_id ||
      row?.accountId ||
      null,
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
    account_id: row?.account_id || row?.accountId || null,
    mapping_status:
      row?.mapping_status || row?.mappingStatus ||
      (row?.account_id || row?.accountId ? "mapped" : "unmapped_legacy"),
    mappingStatus:
      row?.mapping_status || row?.mappingStatus ||
      (row?.account_id || row?.accountId ? "mapped" : "unmapped_legacy"),
    event_group_id: row?.event_group_id || row?.eventGroupId || null,
    client_request_id: row?.client_request_id || row?.clientRequestId || null,
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
  if (normalized.type === "transfer_in") return Math.abs(normalized.amount);
  if (
    normalized.type === "release" ||
    normalized.type === "spend" ||
    normalized.type === "transfer_out"
  ) {
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

export function computeAccountAvailability(accounts = [], goals = [], activities = []) {
  const normalizedAccounts = normalizeAssetAccounts(accounts);
  const normalizedGoals = goals.map(normalizeGoal);
  const normalizedActivities = normalizeGoalActivities(activities);
  const goalMap = new Map(normalizedGoals.map((goal) => [goal.id, goal]));
  const reservationByAccount = normalizedActivities.reduce((totals, activity) => {
    if (activity.mapping_status !== "mapped" || !activity.account_id) return totals;
    const goal = goalMap.get(activity.goal_id);
    if (
      !goal ||
      !["strict", "flexible"].includes(goal.protectionMode) ||
      ["archived", "used"].includes(goal.status)
    ) {
      return totals;
    }
    const effect = getGoalActivityEffect(activity);
    totals[activity.account_id] = Number(totals[activity.account_id] || 0) + effect;
    return totals;
  }, {});

  return Object.fromEntries(
    normalizedAccounts.map((account) => {
      const actualBalance = Number(account.balance_amount || 0);
      const reservedBalance = Math.max(
        Number(reservationByAccount[account.id] || 0),
        0,
      );
      return [
        account.id,
        {
          accountId: account.id,
          currency: account.currency,
          actualBalance,
          reservedBalance,
          availableBalance: actualBalance - reservedBalance,
          isCovered: actualBalance - reservedBalance >= -0.0001,
        },
      ];
    }),
  );
}

export function getGoalFundingAccountOptions({
  goal,
  type = "assign",
  accounts = [],
} = {}) {
  const normalizedGoal = normalizeGoal(goal);
  const linkedAccountIds = new Set(
    normalizedGoal.fundingAccounts.map((funding) => funding.account_id),
  );
  const allocationByAccount = new Map(
    (normalizedGoal.accountBreakdown || []).map((item) => [
      item.accountId,
      Math.max(Number(item.amount || 0), 0),
    ]),
  );
  const needsExistingAllocation = type === "release" || type === "move";

  return normalizeAssetAccounts(accounts)
    .filter(
      (account) =>
        account.currency === normalizedGoal.currency &&
        !account.is_archived &&
        isAllocatableAssetAccount(account),
    )
    .map((account) => ({
      id: account.id,
      name: account.name,
      currency: account.currency,
      availableBalance: Math.max(Number(account.availableBalance || 0), 0),
      allocatedAmount: Number(allocationByAccount.get(account.id) || 0),
      isGoalFunding:
        linkedAccountIds.has(account.id) || allocationByAccount.has(account.id),
      isGoalPrimary: normalizedGoal.primaryFundingAccountId === account.id,
      isPrimary: Boolean(account.isPrimary || account.is_primary),
    }))
    .filter(
      (account) =>
        !needsExistingAllocation || account.allocatedAmount > 0.0001,
    )
    .sort((a, b) => {
      if (a.isGoalPrimary !== b.isGoalPrimary) return a.isGoalPrimary ? -1 : 1;
      if (a.isGoalFunding !== b.isGoalFunding) return a.isGoalFunding ? -1 : 1;
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      const amountDifference = needsExistingAllocation
        ? b.allocatedAmount - a.allocatedAmount
        : b.availableBalance - a.availableBalance;
      if (Math.abs(amountDifference) > 0.0001) return amountDifference;
      return a.name.localeCompare(b.name);
    });
}

export function getDefaultGoalFundingAccountId(options = {}) {
  return getGoalFundingAccountOptions(options)[0]?.id || "";
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
  const normalizedAccounts = normalizeAssetAccounts(accounts);
  const liquidByCurrency = computeLiquidPools(normalizedAccounts);
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
    const mappedActivities = goalActivities.filter(
      (activity) => activity.mapping_status === "mapped" && activity.account_id,
    );
    const mappedAvailableAmount = mappedActivities.reduce(
      (sum, activity) => sum + getGoalActivityEffect(activity),
      0,
    );
    const unmappedActivityAmount = goalActivities
      .filter((activity) => activity.mapping_status !== "mapped" || !activity.account_id)
      .reduce((sum, activity) => sum + getGoalActivityEffect(activity), 0);
    const unmappedAmount = Math.max(
      Number(goal.legacyAllocatedAmount || 0) + unmappedActivityAmount,
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
      mappedActivities,
      mappedAvailableAmount: Math.max(mappedAvailableAmount, 0),
      unmappedAmount,
      hasUnmappedFunding: unmappedAmount > 0.0001 || goal.fundingStatus === "unmapped_legacy",
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

  const accountAvailability = computeAccountAvailability(
    normalizedAccounts,
    baseInsights,
    normalizedActivities,
  );

  const goalAccountAmounts = normalizedActivities.reduce((groups, activity) => {
    if (activity.mapping_status !== "mapped" || !activity.account_id) return groups;
    const key = `${activity.goal_id}|${activity.account_id}`;
    groups[key] = Number(groups[key] || 0) + getGoalActivityEffect(activity);
    return groups;
  }, {});

  const allocatedByCurrency = baseInsights.reduce((totals, goal) => {
    const currency = normalizeCurrencyCode(goal.currency);
    if (
      !["strict", "flexible"].includes(goal.protectionMode) ||
      ["archived", "used"].includes(goal.status)
    ) {
      return totals;
    }
    totals[currency] =
      Number(totals[currency] || 0) + Number(goal.mappedAvailableAmount || 0);
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
        accountBreakdown: Object.entries(goalAccountAmounts)
          .filter(([key]) => key.startsWith(`${goal.id}|`))
          .map(([key, amount]) => {
            const accountId = key.slice(goal.id.length + 1);
            const account = normalizedAccounts.find((item) => item.id === accountId);
            return {
              accountId,
              accountName: account?.name || "Akun tidak ditemukan",
              amount: Math.max(Number(amount || 0), 0),
              currency: goal.currency,
            };
          })
          .filter((item) => item.amount > 0.0001),
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
    accountAvailability,
    liquidByCurrency,
    allocatedByCurrency,
    summaries,
  };
}

export function validateGoalActivity({
  goal,
  type,
  amount,
  accountId,
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
  const resolvedAccountId = accountId || normalizedGoal.primaryFundingAccountId;
  const accountSummary = allocationState.accountAvailability?.[resolvedAccountId];
  if (!resolvedAccountId || !accountSummary) {
    return {
      valid: false,
      message: "Pilih akun sumber target terlebih dahulu.",
    };
  }
  if (
    type === "assign" &&
    numericAmount > Number(accountSummary.availableBalance || 0) + 0.0001
  ) {
    return {
      valid: false,
      message: `Dana tersedia pada akun sumber ${normalizedGoal.currency} tidak mencukupi.`,
    };
  }
  if (
    (type === "release" || type === "spend") &&
    numericAmount >
      Number(
        insight?.accountBreakdown?.find((item) => item.accountId === resolvedAccountId)
          ?.amount || 0,
      ) + 0.0001
  ) {
    return {
      valid: false,
      message: `Dana tersedia pada ${normalizedGoal.name} tidak mencukupi.`,
    };
  }
  return { valid: true, message: "" };
}

export function evaluateAccountDebit({
  allocationState,
  accountId,
  amount,
  targetId = null,
} = {}) {
  const numericAmount = Number(amount || 0);
  const account = allocationState?.accountAvailability?.[accountId];
  if (!account || numericAmount <= 0) {
    return {
      allowed: false,
      requiresDecision: false,
      message: "Akun sumber atau nominal transaksi tidak valid.",
      compatibleGoals: [],
    };
  }
  if (numericAmount > Number(account.actualBalance || 0) + 0.0001) {
    return {
      allowed: false,
      requiresDecision: false,
      message: "Saldo aktual akun sumber tidak mencukupi.",
      compatibleGoals: [],
    };
  }

  const compatibleGoals = (allocationState?.goals || [])
    .filter((goal) =>
      !["archived", "used"].includes(goal.status) &&
      goal.accountBreakdown?.some(
        (item) => item.accountId === accountId && Number(item.amount || 0) > 0,
      ),
    )
    .map((goal) => ({
      id: goal.id,
      name: goal.name,
      protectionMode: goal.protectionMode,
      amount: Number(
        goal.accountBreakdown.find((item) => item.accountId === accountId)?.amount || 0,
      ),
    }));

  if (targetId) {
    const target = (allocationState?.goals || []).find((goal) => goal.id === targetId);
    const targetAmount = Number(
      target?.accountBreakdown?.find((item) => item.accountId === accountId)?.amount ||
        0,
    );
    if (!target || targetAmount + 0.0001 < numericAmount) {
      return {
        allowed: false,
        requiresDecision: false,
        message: "Dana target pada akun sumber tidak mencukupi.",
        compatibleGoals,
      };
    }
    const protectedTargetAmount = ["strict", "flexible"].includes(
      target.protectionMode,
    )
      ? targetAmount
      : 0;
    const otherReserved = Math.max(
      Number(account.reservedBalance || 0) - protectedTargetAmount,
      0,
    );
    if (
      numericAmount > Number(account.actualBalance || 0) - otherReserved + 0.0001
    ) {
      return {
        allowed: false,
        requiresDecision: false,
        message: "Transaksi akan memakai dana target lain yang dilindungi.",
        compatibleGoals,
      };
    }
    return { allowed: true, requiresDecision: false, message: "", compatibleGoals };
  }

  if (numericAmount <= Number(account.availableBalance || 0) + 0.0001) {
    return { allowed: true, requiresDecision: false, message: "", compatibleGoals };
  }

  return {
    allowed: false,
    requiresDecision: true,
    message:
      "Nominal melewati dana tersedia akun. Pilih target yang memang ingin digunakan atau kurangi nominal.",
    compatibleGoals: compatibleGoals.filter(
      (goal) => goal.amount + Number(account.availableBalance || 0) + 0.0001 >= numericAmount,
    ),
  };
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
    account_id: transaction.source_account_id,
    mapping_status: transaction.source_account_id ? "mapped" : "unmapped_legacy",
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
