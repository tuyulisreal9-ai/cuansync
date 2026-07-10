export const ONBOARDING_VERSION = 1;
export const ONBOARDING_STORAGE_PREFIX = "cuansync-onboarding-v1";

export const ONBOARDING_EVENTS = {
  onboardingStarted: "onboarding_started",
  onboardingStepViewed: "onboarding_step_viewed",
  onboardingStepCompleted: "onboarding_step_completed",
  onboardingSkipped: "onboarding_skipped",
  onboardingCompleted: "onboarding_completed",
  checklistViewed: "checklist_viewed",
  checklistItemClicked: "checklist_item_clicked",
  checklistItemCompleted: "checklist_item_completed",
  helpOpened: "help_opened",
  tutorialRestarted: "tutorial_restarted",
  walletAddStarted: "wallet_add_started",
  walletAddCompleted: "wallet_add_completed",
  transactionAddStarted: "transaction_add_started",
  transactionAddCompleted: "transaction_add_completed",
  budgetCreateStarted: "budget_create_started",
  budgetCreateCompleted: "budget_create_completed",
  exchangeStarted: "exchange_started",
  exchangeCompleted: "exchange_completed",
};

export const ONBOARDING_STEPS = [
  {
    id: "wallet-summary",
    target: "wallet-header",
    targetLabel: "Ringkasan saldo",
    title: "Selamat datang di CUANSYNC",
    body:
      "Di sini kamu bisa memantau aset dan transaksi harian dalam beberapa mata uang.",
    primaryLabel: "Lanjut",
    secondaryLabel: "Lewati",
  },
  {
    id: "currency-setup",
    target: "wallet-header",
    targetLabel: "Mata uang utama",
    title: "Tentukan mata uang utama",
    body:
      "Atur mata uang laporan agar total aset dan valuasi saldo tampil lebih konsisten.",
    primaryLabel: "Atur sekarang",
    secondaryLabel: "Nanti",
    action: "settings",
  },
  {
    id: "first-transaction",
    target: "quick-entry",
    targetLabel: "Pengeluaran Hari Ini",
    title: "Catat transaksi pertama",
    body:
      "Tambah pengeluaran atau pemasukan pertama agar ringkasan mulai terisi.",
    primaryLabel: "Coba catat cepat",
    secondaryLabel: "Lewati",
    action: "today",
  },
  {
    id: "first-wallet",
    target: "asset-area",
    targetLabel: "Aset dan wallet",
    title: "Tambah dompet atau akun",
    body:
      "Pisahkan saldo tunai, bank, e-wallet, atau investasi agar pencatatan lebih rapi.",
    primaryLabel: "Tambah dompet",
    secondaryLabel: "Nanti",
    action: "investment",
  },
  {
    id: "budget-exchange",
    target: "budget-exchange",
    targetLabel: "Anggaran dan exchange",
    title: "Lanjutkan dengan anggaran atau exchange",
    body:
      "Gunakan anggaran untuk batas aman, dan exchange untuk perpindahan antar mata uang.",
    primaryLabel: "Selesai",
    secondaryLabel: "Lihat checklist",
  },
];

export const ONBOARDING_CHECKLIST_ITEMS = [
  {
    id: "base_currency",
    label: "Atur mata uang utama",
    helper: "Biar total aset dan laporan punya patokan yang jelas.",
    action: "settings",
  },
  {
    id: "wallet",
    label: "Tambah dompet pertama",
    helper: "Pisahkan cash, bank, wallet, atau investasi.",
    action: "investment",
  },
  {
    id: "transaction",
    label: "Catat transaksi pertama",
    helper: "Mulai dari pengeluaran harian atau pemasukan.",
    action: "today",
  },
  {
    id: "budget",
    label: "Buat anggaran pertama",
    helper: "Aktifkan batas aman pengeluaran bulan ini.",
    action: "overview",
  },
  {
    id: "exchange",
    label: "Coba exchange",
    helper: "Pakai saat menukar atau memindahkan antar mata uang.",
    action: "add",
  },
];

export function getDefaultOnboardingState() {
  return {
    version: ONBOARDING_VERSION,
    status: "new",
    currentStep: 0,
    completed: false,
    skipped: false,
    dismissedForever: false,
    checklistDismissed: false,
    startedAt: null,
    completedAt: null,
    skippedAt: null,
    lastViewedStepId: null,
    completedChecklistItems: [],
    updatedAt: new Date().toISOString(),
  };
}

export function readOnboardingState(ownerId = "guest") {
  if (typeof window === "undefined") return getDefaultOnboardingState();

  try {
    const raw = window.localStorage.getItem(getOnboardingStorageKey(ownerId));
    if (!raw) return getDefaultOnboardingState();
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== ONBOARDING_VERSION) {
      return getDefaultOnboardingState();
    }
    return {
      ...getDefaultOnboardingState(),
      ...parsed,
      completedChecklistItems: Array.isArray(parsed.completedChecklistItems)
        ? parsed.completedChecklistItems
        : [],
    };
  } catch {
    return getDefaultOnboardingState();
  }
}

export function writeOnboardingState(ownerId = "guest", state) {
  if (typeof window === "undefined") return state;
  const next = {
    ...getDefaultOnboardingState(),
    ...state,
    version: ONBOARDING_VERSION,
    updatedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(getOnboardingStorageKey(ownerId), JSON.stringify(next));
  return next;
}

export function patchOnboardingState(current, patch) {
  return {
    ...getDefaultOnboardingState(),
    ...current,
    ...patch,
    version: ONBOARDING_VERSION,
    updatedAt: new Date().toISOString(),
  };
}

export function buildOnboardingChecklist({
  currencySetupDone = false,
  assetAccounts = [],
  transactions = [],
  budgets = [],
} = {}) {
  const hasExchange = transactions.some((transaction) => transaction?.type === "exchange");
  const completedMap = {
    base_currency: Boolean(currencySetupDone),
    wallet: assetAccounts.length > 0,
    transaction: transactions.length > 0,
    budget: budgets.length > 0,
    exchange: hasExchange,
  };

  return ONBOARDING_CHECKLIST_ITEMS.map((item) => ({
    ...item,
    completed: Boolean(completedMap[item.id]),
  }));
}

export function shouldAutoStartOnboarding(state, checklistItems) {
  if (!state || state.dismissedForever || state.completed || state.skipped) {
    return false;
  }
  if (state.status === "active") return true;
  return !state.startedAt;
}

export function isChecklistComplete(items) {
  return items.length > 0 && items.every((item) => item.completed);
}

export function getCompletedChecklistIds(items) {
  return items.filter((item) => item.completed).map((item) => item.id);
}

export function trackOnboardingEvent(eventName, payload = {}) {
  if (typeof window === "undefined") return;

  const detail = {
    event: eventName,
    payload,
    createdAt: new Date().toISOString(),
  };

  try {
    window.CUANSYNC_ANALYTICS?.track?.(eventName, payload);
  } catch {}

  try {
    window.dispatchEvent(new CustomEvent("cuansync:analytics", { detail }));
  } catch {}
}

function getOnboardingStorageKey(ownerId) {
  return `${ONBOARDING_STORAGE_PREFIX}:${ownerId || "guest"}`;
}
