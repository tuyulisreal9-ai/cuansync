import React from "react";
import htm from "htm";
import { ArrowLeft } from "lucide-react";
import { CONTROL_MUTED } from "./ControlPrimitives.js";
import { ControlPillars } from "./ControlPillars.js";
import {
  BudgetOverview,
  ConcernList,
  Exposure,
  SafeToSpendCard,
} from "./ControlSummarySections.js";
import { buildSavingsAdvice } from "../../domain/savingsAdvice.js";
import {
  buildControlCoach,
  getControlReadiness,
} from "../../domain/controlGuidance.js";

const html = htm.bind(React.createElement);

/* Daftar saran, bukan satu saran. buildControlCoach hanya mengembalikan satu
   dari rantai if berurutan, jadi begitu satu kondisi terpenuhi sisanya tidak
   pernah terlihat. Di sini semuanya ditampilkan berurut kepentingan. */
const ADVICE_TONES = {
  danger: "var(--cs-danger)",
  warn: "var(--cs-warn)",
  info: "var(--cs-link)",
};

function AdviceRow({ item, index, onAct, why }) {
  const warna = ADVICE_TONES[item.tone] || "var(--cs-mut)";

  return html`
    <div
      className="flex gap-2.5 rounded-[14px] border p-3"
      style=${{ background: "var(--cs-card)", borderColor: "var(--cs-line)" }}
    >
      <span
        className="dc-num mt-px flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[10.5px] font-bold"
        style=${{ background: "var(--cs-chip)", color: warna }}
      >
        ${index + 1}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[13px] font-bold" style=${{ color: warna }}>
          ${item.title}
        </span>
        <span
          className="text-[12px] leading-[1.5]"
          style=${{ color: "var(--cs-body)" }}
        >
          ${item.detail}
        </span>
        ${/* Alasan hanya dibawa saran teratas, dan hanya di desktop. Diulang
              di tiap baris ia jadi kebisingan; di lebar ponsel ia memakan
              empat baris tepat sebelum saran berikutnya. */ null}
        ${why
          ? html`<span
              className="hidden text-[11.5px] leading-[1.5] lg:block"
              style=${{ color: "var(--cs-mut)" }}
              >${why}</span
            >`
          : null}
        ${/* Tautan teks, bukan tombol pil. Di lebar ponsel tombol pil memakan
              satu baris penuh untuk tiap saran. */ null}
        <button
          type="button"
          onClick=${() => onAct(item)}
          className="dc-press dc-press-94 self-start pt-0.5 text-[12px] font-bold"
          style=${{ color: "var(--cs-link)" }}
        >
          ${item.actionLabel} ›
        </button>
      </span>
    </div>
  `;
}

/* Kartu ini menggantikan ControlCoachCard sepenuhnya. Coach hanya
   menampilkan satu saran, dan saran itu hampir selalu sama dengan urutan
   pertama di sini, jadi dua kartu berdampingan mengatakan hal yang sama
   dengan kata berbeda. Yang benar benar hanya dimiliki coach adalah chip
   kesiapan dan alasannya, dan keduanya diserap ke sini. */
function SavingsAdviceCard({ summary, onNavigate, onOpenBudget, onAddIncome }) {
  const advice = buildSavingsAdvice(summary);
  const readiness = getControlReadiness(summary);
  const why = buildControlCoach(summary)?.why || "";

  /* Rute aksi mengikuti pola yang sama dengan coach supaya tombol yang
     mengarah ke tempat yang sama tidak berperilaku berbeda. */
  function handleAction(item) {
    if (item.actionTarget === "budget") {
      onOpenBudget?.(item.categoryKey);
      return;
    }
    if (item.actionTarget === "goal") {
      onOpenBudget?.("__goals__");
      return;
    }
    if (item.actionTarget === "income") {
      onAddIncome?.();
      return;
    }
    onNavigate?.(item.actionTarget || "history");
  }

  return html`
    <section className="dc-card flex flex-col gap-3 p-[18px]">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[15px] font-bold">Saran untukmu</span>
        <span
          className="shrink-0 text-[11.5px]"
          style=${{ color: "var(--cs-mut)" }}
        >
          ${readiness.readyCount}/${readiness.totalCount} fondasi siap
        </span>
      </div>

      ${/* Chip kesiapan diambil dari coach yang dihapus. Bentuknya ringkas
            supaya tidak menambah tinggi berarti di ponsel. */ null}
      <div className="flex flex-wrap gap-1.5">
        ${readiness.items.map(
          (item) => html`
            <span
              key=${item.key}
              className="rounded-full px-2.5 py-1 text-[11px] font-medium"
              style=${item.ready
                ? { background: "var(--cs-chip)", color: "var(--cs-body)" }
                : { background: "transparent", color: "var(--cs-faint)", boxShadow: "inset 0 0 0 1px var(--cs-line)" }}
            >
              ${item.ready ? "✓" : "○"} ${item.label}
            </span>
          `,
        )}
      </div>

      ${advice.hasAdvice
        ? html`
            <div className="flex flex-col gap-2">
              ${advice.items.map(
                (item, index) => html`
                  <${AdviceRow}
                    key=${item.key}
                    item=${item}
                    index=${index}
                    onAct=${handleAction}
                    why=${index === 0 ? why : ""}
                  />
                `,
              )}
            </div>
            ${/* Batas yang dipegang: tiap angka di atas berasal dari data
                  pengguna sendiri, bukan rekomendasi finansial. */ null}
            <span
              className="text-[11px] leading-[1.5]"
              style=${{ color: "var(--cs-faint)" }}
            >
              Semua angka di atas dihitung dari catatanmu bulan ini, bukan saran
              investasi.
            </span>
          `
        : html`
            <span
              className="text-[12.5px] leading-[1.55]"
              style=${{ color: "var(--cs-mut)" }}
            >
              Jatah, arus kas, dan targetmu semuanya sedang di jalur yang baik
              bulan ini.
            </span>
          `}
    </section>
  `;
}

/* Skor dan statusnya sudah dihitung buildScoring() di domain/control.js —
   panel ini hanya menampilkannya, tidak menghitung ulang apa pun. Ketika ada
   pilar yang datanya belum lengkap, buildScoring mengembalikan score null dan
   panel jujur menyatakan skor belum bisa dinilai. */
function ScorePanel({ scoring }) {
  const score = scoring?.score;
  const hasScore = Number.isFinite(score);
  const ratio = hasScore ? Math.min(Math.max(score / 100, 0), 1) : 0;
  const pending = (scoring?.pillars || []).filter((pillar) => !pillar.evaluable);

  return html`
    <section className="dc-panel flex flex-col gap-[18px] p-[22px]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-[7px]">
          <span className="text-[13px] text-[#9c968b]">Skor keuanganmu</span>
          <div className="flex items-end gap-[7px]">
            <span className="dc-num text-[36px] leading-none tracking-[-1.6px]">
              ${hasScore ? score : "—"}
            </span>
            <span className="pb-[5px] text-[13px] text-[#9c968b]">dari 100</span>
          </div>
        </div>
        <span
          className="shrink-0 whitespace-nowrap rounded-full px-[11px] py-[7px] text-[11.5px] font-bold"
          style=${{
            background: "rgba(250,247,241,0.1)",
            color: hasScore ? "var(--cs-pos)" : "#9c968b",
          }}
        >
          ${scoring?.status || "Belum cukup data"}
        </span>
      </div>
      <div
        className="h-2.5 overflow-hidden rounded-full"
        style=${{ background: "rgba(250,247,241,0.14)" }}
      >
        <div
          className="h-full rounded-full"
          style=${{ width: `${ratio * 100}%`, background: "var(--cs-acc)" }}
        ></div>
      </div>
      <span className="text-[12.5px] leading-[1.5] text-[#9c968b]">
        ${hasScore
          ? `Kelengkapan data ${scoring.completeness}%. Skor dihitung dari anggaran, arus kas, daya tahan dana, dan tagihan rutin.`
          : `Skor belum bisa dinilai karena ${pending
              .map((pillar) => pillar.label)
              .join(", ") || "sebagian data"} belum lengkap.`}
      </span>
    </section>
  `;
}

export function ControlCenterPage({
  summary,
  visible = true,
  onNavigate,
  onOpenBudget,
  onAddIncome,
}) {
  return html`
    ${/* max-w-md adalah lebar ponsel. Tanpa penyesuaian lg, halaman ini
          terkunci 448px di layar 1748px dan isinya yang sudah banyak terpaksa
          jadi gulungan setinggi 1596px. Di desktop lebarnya dilepas dan dibagi
          dua kolom, masing masing dibungkus satu sel supaya penempatan
          otomatis tidak melempar kartu kembali ke kolom sebelah. */ null}
    <div className="mx-auto grid w-full max-w-md gap-3 pb-[calc(7rem+env(safe-area-inset-bottom))] lg:max-w-none lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-6 lg:pb-6">
      <div className="flex flex-col gap-3 lg:gap-6">
        ${/* Halaman ini membuka dengan skor yang sering berbunyi "—" beserta
              istilah teknis seperti "Komitmen Rutin & Remittance". Tanpa satu
              kalimat yang menyebut halaman ini untuk apa, pembaca sampai di
              angka kosong lebih dulu dan bertanya sedang melihat apa. */ null}
        <p
          className="px-0.5 text-[12.5px] leading-[1.5]"
          style=${{ color: "var(--cs-mut)" }}
        >
          Ringkasan keuanganmu bulan ini, beserta hal-hal yang paling berguna
          untuk dirapikan lebih dulu.
        </p>

        <${ScorePanel} scoring=${summary.scoring} />

        <${SavingsAdviceCard}
          summary=${summary}
          onNavigate=${onNavigate}
          onOpenBudget=${onOpenBudget}
          onAddIncome=${onAddIncome}
        />


        ${/* Tetap di kolom kiri, tepat setelah coach, supaya urutan di ponsel
              sama persis dengan sebelumnya. Dipindah ke kolom kanan, kartu ini
              turun dari posisi tiga ke posisi lima saat wadahnya menumpuk. */ null}
        ${summary.safeToSpend.available
          ? html`
              <${SafeToSpendCard}
                summary=${summary}
                visible=${visible}
              />
            `
          : null}

      </div>

      ${/* Pilar dipindah ke kolom kanan supaya kedua kolom berakhir di
            ketinggian yang mirip. Urutannya di ponsel tidak berubah: wadah
            kanan menumpuk tepat di bawah wadah kiri, jadi pilar tetap berada
            setelah Sisa aman seperti sebelumnya. */ null}
      <div className="flex flex-col gap-3 lg:gap-6">
        <${ControlPillars}
          summary=${summary}
          visible=${visible}
          onOpenBudget=${onOpenBudget}
          onNavigate=${onNavigate}
          onAddIncome=${onAddIncome}
        />
        <${BudgetOverview}
          summary=${summary}
          visible=${visible}
          onOpenBudget=${onOpenBudget}
        />
        <${ConcernList}
          summary=${summary}
          visible=${visible}
          onOpenBudget=${onOpenBudget}
          onNavigate=${onNavigate}
        />
        <${Exposure} summary=${summary} />
      </div>
    </div>
  `;
}
