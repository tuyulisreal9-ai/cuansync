import React, { useEffect, useRef } from "https://esm.sh/react@18.3.1";
import htm from "https://esm.sh/htm@3.1.1";

const html = htm.bind(React.createElement);

export function GuidedOnboardingOverlay({
  open,
  step,
  stepIndex,
  totalSteps,
  onPrimary,
  onSecondary,
  onBack,
  onSkip,
  onDismissForever,
}) {
  const panelRef = useRef(null);
  const targetSelector = step?.target
    ? `[data-onboarding-target="${step.target}"]`
    : "";

  useEffect(() => {
    if (!open || !step) return undefined;
    function handleKeyDown(event) {
      if (event.key === "Escape") onSkip();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, step?.id, onSkip]);

  useEffect(() => {
    if (!open || !step || !targetSelector) return undefined;
    const target = document.querySelector(targetSelector);
    if (!target) return undefined;
    target.classList.add("onboarding-target-active");
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    target.scrollIntoView({
      block: "center",
      behavior: reduceMotion ? "auto" : "smooth",
    });
    return () => target.classList.remove("onboarding-target-active");
  }, [open, step?.id, targetSelector]);

  useEffect(() => {
    if (!open) return;
    const firstButton = panelRef.current?.querySelector("button");
    window.setTimeout(() => firstButton?.focus(), 0);
  }, [open, step?.id]);

  if (!open || !step) return null;

  const isFirstStep = stepIndex <= 0;
  const isLastStep = stepIndex >= totalSteps - 1;

  return html`
    <div className="pointer-events-none fixed inset-x-3 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-50 flex justify-center lg:bottom-6 lg:justify-end lg:px-6">
      <section
        ref=${panelRef}
        role="dialog"
        aria-live="polite"
        aria-labelledby="guided-onboarding-title"
        className="pointer-events-auto w-full max-w-md overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/96 p-4 text-slate-950 shadow-[0_28px_90px_rgba(15,23,42,0.26)] backdrop-blur-2xl dark:border-white/12 dark:bg-slate-950/96 dark:text-white dark:shadow-black/50"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-brand-600 px-3 py-1 text-[11px] font-black text-white dark:bg-emerald-500">
                Langkah ${stepIndex + 1}/${totalSteps}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600 dark:border-white/10 dark:bg-white/8 dark:text-slate-300">
                ${step.targetLabel}
              </span>
            </div>
            <h2 id="guided-onboarding-title" className="mt-3 font-display text-xl font-black text-slate-950 dark:text-white">
              ${step.title}
            </h2>
          </div>
          <button
            type="button"
            onClick=${onSkip}
            aria-label="Lewati panduan"
            className="inline-flex h-10 min-h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white/75 text-sm font-black text-slate-600 transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/70 dark:border-white/10 dark:bg-white/8 dark:text-slate-300"
          >
            X
          </button>
        </div>

        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
          ${step.body}
        </p>

        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-brand-600 transition-all duration-300 dark:bg-emerald-500"
            style=${{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }}
          ></div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-[auto_1fr_1fr]">
          <button
            type="button"
            onClick=${onBack}
            disabled=${isFirstStep}
            aria-label="Langkah sebelumnya"
            className="cuan-secondary min-h-11 rounded-2xl px-4 py-2.5 text-sm font-black disabled:cursor-not-allowed disabled:opacity-45"
          >
            Kembali
          </button>
          <button
            type="button"
            onClick=${onSecondary}
            aria-label=${isLastStep ? "Lihat checklist panduan" : "Lewati langkah ini"}
            className="cuan-secondary min-h-11 rounded-2xl px-4 py-2.5 text-sm font-black"
          >
            ${step.secondaryLabel}
          </button>
          <button
            type="button"
            onClick=${onPrimary}
            aria-label=${isLastStep ? "Selesaikan panduan" : "Lanjutkan panduan"}
            className="history-action-primary min-h-11 rounded-2xl px-4 py-2.5 text-sm font-black"
          >
            ${step.primaryLabel}
          </button>
        </div>

        <button
          type="button"
          onClick=${onDismissForever}
          className="mt-3 min-h-10 w-full rounded-2xl px-3 py-2 text-xs font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/70 dark:text-slate-400 dark:hover:bg-white/8 dark:hover:text-slate-200"
        >
          Jangan tampilkan lagi
        </button>
      </section>
    </div>
  `;
}

export function OnboardingChecklistCard({
  items,
  compact = false,
  onItemClick,
  onDismiss,
  onRestartTutorial,
}) {
  const completedCount = items.filter((item) => item.completed).length;
  const totalCount = items.length;
  const progress = totalCount ? (completedCount / totalCount) * 100 : 0;
  const panelClass = compact
    ? "rounded-[26px] p-4"
    : "relative overflow-hidden rounded-[26px] cuan-card-soft p-5";

  return html`
    <section className=${`${panelClass} onboarding-checklist-card`}>
      <div className=${compact ? "" : "relative"}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">
              Panduan
            </p>
            <h3 className="mt-1 font-display text-lg font-black text-slate-950 dark:text-white">
              Mulai dari sini
            </h3>
            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
              ${completedCount}/${totalCount} langkah dasar sudah selesai.
            </p>
          </div>
          <button
            type="button"
            onClick=${onDismiss}
            aria-label="Sembunyikan checklist"
            className="inline-flex h-10 min-h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200/70 bg-white/60 text-xs font-black text-slate-500 transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/70 dark:border-white/10 dark:bg-white/8 dark:text-slate-300"
          >
            X
          </button>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-brand-600 transition-all duration-300 dark:bg-emerald-500"
            style=${{ width: `${progress}%` }}
          ></div>
        </div>

        <div className="mt-4 grid gap-2">
          ${items.map((item) => html`
            <button
              key=${item.id}
              type="button"
              onClick=${() => onItemClick(item)}
              className=${`flex min-h-14 items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-emerald-500/70 ${
                item.completed
                  ? "border-emerald-300/35 bg-emerald-500/10"
                  : "border-slate-200/70 bg-white/52 hover:bg-white dark:border-white/10 dark:bg-white/6 dark:hover:bg-white/10"
              }`}
            >
              <span className="min-w-0">
                <span className="block text-sm font-black text-slate-950 dark:text-white">
                  ${item.label}
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-500 dark:text-slate-400">
                  ${item.helper}
                </span>
              </span>
              <span className=${`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black ${
                item.completed
                  ? "bg-emerald-500 text-white"
                  : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300"
              }`}>
                ${item.completed ? "OK" : "Buka"}
              </span>
            </button>
          `)}
        </div>

        <button
          type="button"
          onClick=${onRestartTutorial}
          className="mt-3 min-h-11 w-full rounded-2xl border border-brand-300/25 bg-brand-500/10 px-4 py-2.5 text-sm font-black text-brand-800 transition hover:-translate-y-0.5 hover:bg-brand-500/14 focus:outline-none focus:ring-2 focus:ring-emerald-500/70 dark:border-brand-300/20 dark:text-brand-100"
        >
          Panduan singkat
        </button>
      </div>
    </section>
  `;
}
