import React, { useEffect, useRef, useState } from "react";
import htm from "htm";
import { AvatarBadge } from "../shared/AvatarBadge.js";
import { FormActionDock } from "../shared/FormActionDock.js";
import { SheetShell } from "../shared/SheetShell.js";
import {
  getProfileDisplayName,
  getProfileEmail,
  getUserInitials,
} from "../../lib/profile.js";
import {
  THEME_MODE_OPTIONS,
  normalizeThemeMode,
} from "../../lib/theme.js";
import {
  clampProfileCropOffset,
  cropProfileImage,
  readProfileImage,
} from "../../lib/profileImage.js";
import {
  INSTALL_STATE,
  detectInstallPlatform,
  getInstallGuide,
  getInstallState,
  promptInstall,
  subscribeInstallPrompt,
} from "../../lib/installApp.js";
import { isNativeMobileApp, isStandaloneWebApp } from "../../lib/mobile.js";
import { MonthlyStatementExportSheet } from "./MonthlyStatementExportSheet.js";

const html = htm.bind(React.createElement);
const INPUT_CLASS =
  "w-full min-h-12 rounded-2xl px-4 py-3.5 text-sm transition cuan-input";
function SettingsSwitch({ checked, onChange, label }) {
  return html`
    <button
      type="button"
      role="switch"
      aria-checked=${checked}
      aria-label=${label}
      onClick=${() => onChange(!checked)}
      className="dc-press relative inline-flex h-11 min-h-11 w-16 shrink-0 items-center rounded-full border p-2 focus:outline-none"
      style=${
        checked
          ? { background: "var(--cs-acc)", borderColor: "transparent" }
          : { background: "var(--cs-track)", borderColor: "var(--cs-line)" }
      }
    >
      <span
        className=${`h-6 w-6 rounded-full transition ${
          checked ? "translate-x-6" : "translate-x-0"
        }`}
        style=${{ background: checked ? "var(--cs-on-acc)" : "var(--cs-card)" }}
      ></span>
    </button>
  `;
}

function SettingsRow({
  label,
  value = null,
  helper = "",
  onClick = null,
  right = null,
  danger = false,
  disabled = false,
  stacked = false,
}) {
  const rowClass = stacked
    ? "flex min-h-14 w-full min-w-0 flex-col items-stretch gap-2 overflow-hidden px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
    : "flex min-h-14 w-full min-w-0 items-center justify-between gap-3 overflow-hidden px-3 py-2";
  const rightClass = stacked
    ? "flex w-full min-w-0 items-center gap-2 sm:ml-3 sm:w-auto sm:shrink-0"
    : "ml-3 flex min-w-0 shrink-0 items-center gap-2";
  const content = html`
    <${React.Fragment}>
      <span className="min-w-0 flex-1">
        <span
          className="block truncate text-sm font-medium"
          style=${{ color: danger ? "var(--cs-danger)" : "var(--cs-ink)" }}
        >
          ${label}
        </span>
        ${helper
          ? html`
              <span
                className="mt-0.5 block truncate text-xs"
                style=${{ color: "var(--cs-mut)" }}
              >
                ${helper}
              </span>
            `
          : null}
      </span>
      <span className=${rightClass}>
        ${value
          ? html`
              <span
                className="max-w-[9rem] truncate text-right text-[13.5px]"
                style=${{ color: "var(--cs-body)" }}
              >
                ${value}
              </span>
            `
          : null}
        ${right}
        ${onClick
          ? html`
              <span
                className="text-base"
                style=${{
                  color: danger ? "var(--cs-danger)" : "var(--cs-faint)",
                }}
              >
                ›
              </span>
            `
          : null}
      </span>
    <//>
  `;

  if (onClick) {
    return html`
      <button
        type="button"
        onClick=${onClick}
        disabled=${disabled}
        className=${`${rowClass} dc-press text-left disabled:cursor-not-allowed disabled:opacity-55`}
      >
        ${content}
      </button>
    `;
  }

  return html`
    <div className=${rowClass}>
      ${content}
    </div>
  `;
}

/* Desain memakai judul seksi 15px/700 dengan padding 0 2px, lalu kartu
   radius 24. Gaya lama memakai kapital kecil 11px bertracking lebar yang
   tidak ada di artifact. */
/* Pemasangan aplikasi dari Pengaturan.

   Tombolnya satu, tetapi perilakunya berbeda karena iOS tidak punya API
   pemasangan sama sekali. Di Android tombol ini benar benar memanggil dialog
   pemasangan peramban; di iPhone yang bisa dilakukan hanyalah menunjukkan
   langkahnya, karena menu Tambahkan ke Layar Utama hanya ada di Safari dan
   tidak dapat dipicu dari halaman. */
function InstallAppSheet({ open, onClose, platform }) {
  const panduan = getInstallGuide(platform);

  return html`
    <${SheetShell}
      open=${open}
      onClose=${onClose}
      title=${panduan.judul}
      helper=${panduan.catatan}
      labelledBy="install-app-title"
    >
      <ol className="flex flex-col gap-2.5">
        ${panduan.langkah.map(
          (langkah, index) => html`
            <li
              key=${langkah}
              className="flex gap-3 rounded-[14px] border p-3"
              style=${{
                background: "var(--cs-card)",
                borderColor: "var(--cs-line)",
              }}
            >
              <span
                className="dc-num flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[10.5px] font-bold"
                style=${{ background: "var(--cs-chip)", color: "var(--cs-body)" }}
              >
                ${index + 1}
              </span>
              <span
                className="min-w-0 flex-1 text-[13px] leading-[1.5]"
                style=${{ color: "var(--cs-body)" }}
              >
                ${langkah}
              </span>
            </li>
          `,
        )}
      </ol>

      <p
        className="mt-3.5 px-0.5 text-[11.5px] leading-[1.5]"
        style=${{ color: "var(--cs-faint)" }}
      >
        Setelah terpasang, CUANSYNC terbuka layar penuh tanpa bilah peramban dan
        muncul di daftar aplikasi seperti aplikasi lain.
      </p>
    <//>
  `;
}

function SettingsSection({ title, children }) {
  return html`
    <section className="flex w-full min-w-0 max-w-full flex-col gap-2.5">
      <h3
        className="px-0.5 text-[15px] font-bold"
        style=${{ color: "var(--cs-ink)" }}
      >
        ${title}
      </h3>
      <div
        className="dc-card w-full min-w-0 max-w-full divide-y overflow-hidden"
        style=${{ borderColor: "var(--cs-line)" }}
      >
        ${children}
      </div>
    </section>
  `;
}

function ProfileSummaryRow({ profile, user, avatarSrc, onClick }) {
  const displayName = getProfileDisplayName(profile, user);
  const email = getProfileEmail(profile, user);
  const initials = getUserInitials({ ...user, user_metadata: { full_name: displayName } });

  return html`
    <button
      type="button"
      onClick=${onClick}
      className="dc-card dc-press dc-press-96 flex w-full items-center gap-3.5 p-[18px] text-left"
    >
      <${AvatarBadge} src=${avatarSrc} initials=${initials} size="md" />
      <span className="min-w-0 flex-1">
        <span
          className="block truncate text-base font-bold"
          style=${{ color: "var(--cs-ink)" }}
        >
          ${displayName}
        </span>
        <span
          className="mt-0.5 block truncate text-[12.5px]"
          style=${{ color: "var(--cs-mut)" }}
        >
          ${email}
        </span>
      </span>
      <span
        className="shrink-0 text-[12.5px] font-bold"
        style=${{ color: "var(--cs-link)" }}
      >
        Ubah
      </span>
    </button>
  `;
}

function getPointerDistance(first, second) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function getPointerCenter(first, second) {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  };
}

function ProfilePhotoEditor({ open, photo, onClose, onApply }) {
  const viewportRef = useRef(null);
  const pointersRef = useRef(new Map());
  const gestureRef = useRef(null);
  const [viewportSize, setViewportSize] = useState(280);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [applying, setApplying] = useState(false);
  const [editorError, setEditorError] = useState("");

  function clampOffset(nextOffset, nextZoom = zoom) {
    return clampProfileCropOffset({
      imageWidth: photo?.width,
      imageHeight: photo?.height,
      viewportSize,
      zoom: nextZoom,
      offsetX: nextOffset.x,
      offsetY: nextOffset.y,
    });
  }

  function beginGesture() {
    const pointers = [...pointersRef.current.values()];
    if (pointers.length >= 2) {
      gestureRef.current = {
        mode: "pinch",
        distance: Math.max(1, getPointerDistance(pointers[0], pointers[1])),
        center: getPointerCenter(pointers[0], pointers[1]),
        zoom,
        offset,
      };
    } else if (pointers.length === 1) {
      gestureRef.current = {
        mode: "drag",
        pointer: pointers[0],
        offset,
      };
    } else {
      gestureRef.current = null;
    }
  }

  useEffect(() => {
    if (!open) return undefined;
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setApplying(false);
    setEditorError("");
    pointersRef.current.clear();
    gestureRef.current = null;

    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    const updateSize = () => {
      const nextSize = viewport.getBoundingClientRect().width;
      if (nextSize > 0) setViewportSize(nextSize);
    };
    updateSize();
    const observer =
      typeof ResizeObserver === "function" ? new ResizeObserver(updateSize) : null;
    observer?.observe(viewport);
    return () => observer?.disconnect();
  }, [open, photo?.src]);

  useEffect(() => {
    if (!open) return;
    setOffset((current) => clampOffset(current, zoom));
  }, [open, viewportSize, zoom, photo?.width, photo?.height]);

  function handlePointerDown(event) {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    beginGesture();
  }

  function handlePointerMove(event) {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    const pointers = [...pointersRef.current.values()];
    const gesture = gestureRef.current;

    if (pointers.length >= 2) {
      if (gesture?.mode !== "pinch") {
        beginGesture();
        return;
      }
      const distance = Math.max(1, getPointerDistance(pointers[0], pointers[1]));
      const center = getPointerCenter(pointers[0], pointers[1]);
      const nextZoom = Math.min(3, Math.max(1, gesture.zoom * (distance / gesture.distance)));
      const nextOffset = clampOffset(
        {
          x: gesture.offset.x + center.x - gesture.center.x,
          y: gesture.offset.y + center.y - gesture.center.y,
        },
        nextZoom,
      );
      setZoom(nextZoom);
      setOffset(nextOffset);
      return;
    }

    if (pointers.length === 1 && gesture?.mode === "drag") {
      setOffset(
        clampOffset({
          x: gesture.offset.x + pointers[0].x - gesture.pointer.x,
          y: gesture.offset.y + pointers[0].y - gesture.pointer.y,
        }),
      );
    }
  }

  function handlePointerEnd(event) {
    pointersRef.current.delete(event.pointerId);
    beginGesture();
  }

  function handleZoomChange(event) {
    const nextZoom = Number(event.target.value);
    setZoom(nextZoom);
    setOffset((current) => clampOffset(current, nextZoom));
  }

  function handleReset() {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }

  async function handleApply() {
    if (!photo || applying) return;
    setApplying(true);
    setEditorError("");
    try {
      const result = await cropProfileImage(photo, {
        viewportSize,
        zoom,
        offsetX: offset.x,
        offsetY: offset.y,
      });
      onApply(result);
    } catch (error) {
      setEditorError(error.message || "Gagal memotong foto.");
    } finally {
      setApplying(false);
    }
  }

  const baseScale = photo
    ? Math.max(viewportSize / photo.width, viewportSize / photo.height)
    : 1;
  const displayWidth = (photo?.width || viewportSize) * baseScale * zoom;
  const displayHeight = (photo?.height || viewportSize) * baseScale * zoom;

  return html`
    <${SheetShell}
      open=${open}
      onClose=${onClose}
      title="Atur foto profil"
      helper="Geser untuk menentukan posisi. Cubit dua jari atau gunakan slider untuk memperbesar."
      labelledBy="profile-photo-editor-title"
    >
      <div className="grid gap-4">
        <div
          ref=${viewportRef}
          className="relative mx-auto aspect-square w-[min(72vw,18rem)] touch-none select-none overflow-hidden rounded-full border-2 border-emerald-400 bg-slate-950 shadow-[0_18px_54px_rgba(2,6,23,.32)]"
          onPointerDown=${handlePointerDown}
          onPointerMove=${handlePointerMove}
          onPointerUp=${handlePointerEnd}
          onPointerCancel=${handlePointerEnd}
        >
          ${photo
            ? html`
                <img
                  src=${photo.src}
                  alt="Pratinjau foto profil"
                  draggable=${false}
                  className="pointer-events-none absolute max-w-none select-none"
                  style=${{
                    width: `${displayWidth}px`,
                    height: `${displayHeight}px`,
                    left: `calc(50% + ${offset.x}px)`,
                    top: `calc(50% + ${offset.y}px)`,
                    transform: "translate(-50%, -50%)",
                  }}
                />
              `
            : null}
          <div className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/40"></div>
          <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-white/20"></div>
          <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-white/20"></div>
        </div>

        <label className="block">
          <span className="mb-2 flex items-center justify-between text-xs font-black text-slate-600 dark:text-slate-300">
            <span>Zoom</span>
            <span>${Math.round(zoom * 100)}%</span>
          </span>
          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value=${zoom}
            onChange=${handleZoomChange}
            aria-label="Zoom foto"
            className="w-full accent-emerald-500"
          />
        </label>

        ${editorError
          ? html`
              <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-300">
                ${editorError}
              </p>
            `
          : null}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick=${handleReset}
            className="history-action-secondary min-h-12 rounded-xl px-4 py-3 text-sm font-black"
          >
            Reset
          </button>
          <button
            type="button"
            onClick=${handleApply}
            disabled=${applying}
            className="history-action-primary min-h-12 rounded-xl px-4 py-3 text-sm font-black disabled:cursor-wait disabled:opacity-60"
          >
            ${applying ? "Memproses..." : "Gunakan foto"}
          </button>
        </div>
      </div>
    <//>
  `;
}

function ProfileDetailSheet({ open, profile, user, avatarSrc, onClose, onSave }) {
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [photoMessage, setPhotoMessage] = useState("");
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [cropPhoto, setCropPhoto] = useState(null);
  const [saving, setSaving] = useState(false);
  const photoInputRef = useRef(null);
  const email = getProfileEmail(profile, user);
  const initials = getUserInitials({
    ...user,
    user_metadata: { full_name: displayName || getProfileDisplayName(profile, user) },
  });

  useEffect(() => {
    if (!open) return;
    setDisplayName(getProfileDisplayName(profile, user));
    setAvatarUrl(profile?.avatar_url || avatarSrc || "");
    setPhotoMessage("");
    setProcessingPhoto(false);
    setCropPhoto(null);
    setSaving(false);
  }, [open, profile, user, avatarSrc]);

  async function handleAvatarUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setProcessingPhoto(true);
    setPhotoMessage("");
    try {
      const nextPhoto = await readProfileImage(file);
      setCropPhoto(nextPhoto);
    } catch (error) {
      setPhotoMessage(error.message || "Gagal memproses foto.");
    } finally {
      setProcessingPhoto(false);
    }
  }

  async function handleSave(event) {
    event?.preventDefault();
    setSaving(true);
    const succeeded = await onSave({
      display_name: displayName.trim() || getProfileDisplayName(profile, user),
      avatar_url: avatarUrl,
    });
    setSaving(false);
    if (succeeded) onClose();
  }

  return html`
    <${React.Fragment}>
    <${SheetShell}
      open=${open && !cropPhoto}
      onClose=${onClose}
      title="Detail profil"
      helper="Kelola identitas akun tanpa memenuhi halaman utama Pengaturan."
      labelledBy="profile-detail-sheet-title"
    >
      <form className="grid gap-4" onSubmit=${handleSave}>
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/62 p-3 dark:border-white/10 dark:bg-white/5">
          <${AvatarBadge} src=${avatarUrl} initials=${initials} size="lg" />
          <div className="grid min-w-0 flex-1 gap-2">
            <button
              type="button"
              onClick=${() => photoInputRef.current?.click()}
              disabled=${processingPhoto}
              className="cuan-secondary flex min-h-11 items-center justify-center rounded-2xl px-3 text-sm font-black transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"
            >
              ${processingPhoto ? "Memproses foto..." : "Unggah / ganti foto"}
            </button>
            <input
              ref=${photoInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange=${handleAvatarUpload}
            />
            <button
              type="button"
              onClick=${() => {
                setAvatarUrl("");
                setPhotoMessage("Foto akan dihapus setelah disimpan.");
              }}
              disabled=${!avatarUrl}
              className="rounded-2xl border border-rose-300/25 bg-rose-500/8 px-3 py-2 text-sm font-black text-rose-600 transition hover:bg-rose-500/12 disabled:cursor-not-allowed disabled:opacity-50 dark:text-rose-300"
            >
              Hapus foto
            </button>
          </div>
        </div>

        ${photoMessage
          ? html`
              <p
                role="status"
                className=${`-mt-2 text-xs font-semibold ${
                  photoMessage === "Foto siap disimpan."
                    ? "text-emerald-600 dark:text-emerald-300"
                    : photoMessage.startsWith("Foto akan")
                      ? "text-slate-500 dark:text-slate-400"
                      : "text-rose-600 dark:text-rose-300"
                }`}
              >
                ${photoMessage}
              </p>
            `
          : null}

        <label className="block">
          <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
            Nama tampilan
          </span>
          <input
            type="text"
            enterKeyHint="done"
            value=${displayName}
            onChange=${(event) => setDisplayName(event.target.value)}
            className=${INPUT_CLASS}
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
            Email
          </span>
          <input
            type="email"
            value=${email}
            readOnly=${true}
            className=${`${INPUT_CLASS} cursor-not-allowed opacity-75`}
          />
        </label>

        <${FormActionDock}>
          <button
            type="submit"
            disabled=${saving}
            className="history-action-primary min-h-12 w-full rounded-xl px-4 py-3 text-sm font-black transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            ${saving ? "Menyimpan..." : "Simpan perubahan"}
          </button>
        <//>
      </form>
    <//>
    <${ProfilePhotoEditor}
      open=${Boolean(open && cropPhoto)}
      photo=${cropPhoto}
      onClose=${() => setCropPhoto(null)}
      onApply=${(nextPhoto) => {
        setAvatarUrl(nextPhoto);
        setPhotoMessage("Foto siap disimpan.");
        setCropPhoto(null);
      }}
    />
    <//>
  `;
}

function ThemeSegmentedControl({ value, onChange }) {
  const normalizedValue = normalizeThemeMode(value);

  return html`
    <div className="cuan-segment grid w-full grid-cols-3 gap-1 rounded-2xl p-1">
      ${THEME_MODE_OPTIONS.map((option) => html`
        <button
          key=${option.key}
          type="button"
          onClick=${() => onChange(option.key)}
          className="dc-press dc-press-96 min-h-10 rounded-[11px] px-2 text-[13px] font-bold"
          style=${
            normalizedValue === option.key
              ? { background: "var(--cs-sel-bg)", color: "var(--cs-sel-fg)" }
              : { background: "transparent", color: "var(--cs-body)" }
          }
        >
          ${option.label}
        </button>
      `)}
    </div>
  `;
}

function ConfirmLogoutSheet({ open, onClose, onConfirm }) {
  return html`
    <${SheetShell}
      open=${open}
      onClose=${onClose}
      title="Keluar akun?"
      helper="Sesi di perangkat ini akan ditutup. Data tersimpan tetap aman di akun kamu."
      labelledBy="confirm-logout-sheet-title"
    >
      <div className="grid gap-3">
        <button
          type="button"
          onClick=${onConfirm}
          className="min-h-12 rounded-2xl bg-rose-500 px-4 py-3 text-sm font-black text-white shadow-[0_16px_38px_rgba(244,63,94,0.22)] transition hover:-translate-y-0.5 hover:bg-rose-600"
        >
          Ya, keluar
        </button>
        <button
          type="button"
          onClick=${onClose}
          className="history-action-secondary min-h-12 rounded-2xl px-4 py-3 text-sm font-black transition hover:-translate-y-0.5"
        >
          Batal
        </button>
      </div>
    <//>
  `;
}

export function SettingsPage({
  user,
  profile,
  profilePhoto,
  transactions = [],
  assetAccounts = [],
  baseCurrency,
  onLoadStatementTransactions,
  theme,
  onThemeChange,
  balanceVisible,
  onToggleBalanceVisibility,
  onSaveProfile,
  onSignOut,
}) {
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [statementSheetOpen, setStatementSheetOpen] = useState(false);
  const [logoutSheetOpen, setLogoutSheetOpen] = useState(false);
  const [installSheetOpen, setInstallSheetOpen] = useState(false);

  /* beforeinstallprompt ditembakkan sekali dan bisa datang sebelum halaman ini
     dibuka, jadi installApp.js mencegatnya saat modul dimuat. Di sini kita
     hanya ikut mendengar perubahannya supaya barisnya berganti sendiri ketika
     tawaran pemasangan muncul atau habis dipakai. */
  const [installState, setInstallState] = useState(() =>
    getInstallState({
      standalone: isStandaloneWebApp(),
      nativeApp: isNativeMobileApp(),
    }),
  );

  useEffect(() => {
    const perbarui = () =>
      setInstallState(
        getInstallState({
          standalone: isStandaloneWebApp(),
          nativeApp: isNativeMobileApp(),
        }),
      );
    perbarui();
    return subscribeInstallPrompt(perbarui);
  }, []);

  const installPlatform = detectInstallPlatform({
    userAgent: typeof navigator === "undefined" ? "" : navigator.userAgent,
    platform: typeof navigator === "undefined" ? "" : navigator.platform,
    maxTouchPoints:
      typeof navigator === "undefined" ? 0 : navigator.maxTouchPoints,
  });

  async function handleInstall() {
    /* Di iOS tidak ada yang bisa dipanggil, jadi langsung ke panduan. Di
       Android prompt() harus dipanggil dari sentuhan pengguna, dan itulah
       yang terjadi di sini. */
    if (installState === INSTALL_STATE.SIAP) {
      const hasil = await promptInstall();
      if (hasil === "accepted") return;
      if (hasil === "dismissed") return;
    }
    setInstallSheetOpen(true);
  }

  return html`
    <div className="settings-page mx-auto grid w-full min-w-0 max-w-2xl gap-4 overflow-x-clip pb-[calc(110px+env(safe-area-inset-bottom))] md:pb-6">
      ${/* Judul halaman sudah ditampilkan header shell, jadi judul kedua di
            dalam halaman hanya mengulang. Desain memulai layar ini langsung
            dari kartu profil. */ null}
      <${ProfileSummaryRow}
        profile=${profile}
        user=${user}
        avatarSrc=${profilePhoto}
        onClick=${() => setProfileSheetOpen(true)}
      />

      <${SettingsSection} title="Tampilan">
        <${SettingsRow}
          label="Sembunyikan saldo"
          helper="Sembunyikan nominal sensitif"
          right=${html`
            <${SettingsSwitch}
              checked=${!balanceVisible}
              label="Sembunyikan saldo"
              onChange=${(checked) => onToggleBalanceVisibility(checked)}
            />
          `}
        />
        <${SettingsRow}
          label="Mode tema"
          helper="Simpan otomatis saat berubah"
          stacked=${true}
          right=${html`
            <div className="w-full min-w-0 sm:w-[11.5rem] sm:max-w-[48vw]">
              <${ThemeSegmentedControl} value=${theme} onChange=${onThemeChange} />
            </div>
          `}
        />
      <//>

      ${/* Satu baris, tiga keadaan. Di iOS tidak ada API pemasangan sama
            sekali, jadi barisnya membuka panduan; di Android ia benar benar
            memanggil dialog pemasangan peramban. Kalau sudah terpasang, tidak
            ada lagi yang perlu ditawarkan. */ null}
      <${SettingsSection} title="Aplikasi">
        <${SettingsRow}
          label=${installState === INSTALL_STATE.TERPASANG
            ? "Aplikasi sudah terpasang"
            : "Pasang aplikasi"}
          helper=${installState === INSTALL_STATE.TERPASANG
            ? "Berjalan layar penuh"
            : installState === INSTALL_STATE.SIAP
              ? "Tanpa lewat toko aplikasi"
              : installPlatform.ios
                ? "Lihat caranya lewat Safari"
                : "Lihat caranya di peramban ini"}
          value=${installState === INSTALL_STATE.TERPASANG
            ? "Terpasang"
            : installState === INSTALL_STATE.SIAP
              ? "Pasang"
              : "Caranya"}
          disabled=${installState === INSTALL_STATE.TERPASANG}
          onClick=${installState === INSTALL_STATE.TERPASANG
            ? null
            : handleInstall}
        />
      <//>

      <${SettingsSection} title="Data & laporan">
        <${SettingsRow}
          label="Laporan transaksi bulanan"
          helper="Pilih bulan dan ekspor riwayat sebagai PDF"
          value="PDF"
          onClick=${() => setStatementSheetOpen(true)}
        />
      <//>

      <${SettingsSection} title="Keamanan & privasi">
        <${SettingsRow}
          label="Kunci aplikasi"
          helper="Kunci biometrik segera hadir"
          value="Segera"
          disabled=${true}
        />
      <//>

      <section className="pt-1">
        <button
          type="button"
          onClick=${() => setLogoutSheetOpen(true)}
          className="flex min-h-14 w-full items-center justify-between rounded-[22px] border border-rose-300/25 bg-rose-500/8 px-3 py-2 text-left text-sm font-black text-rose-600 transition hover:bg-rose-500/12 dark:border-rose-400/20 dark:text-rose-300"
        >
          <span>Keluar</span>
          <span>></span>
        </button>
      </section>

      <${InstallAppSheet}
        open=${installSheetOpen}
        onClose=${() => setInstallSheetOpen(false)}
        platform=${installPlatform}
      />

      <${ProfileDetailSheet}
        open=${profileSheetOpen}
        profile=${profile}
        user=${user}
        avatarSrc=${profilePhoto}
        onClose=${() => setProfileSheetOpen(false)}
        onSave=${onSaveProfile}
      />
      <${MonthlyStatementExportSheet}
        open=${statementSheetOpen}
        onClose=${() => setStatementSheetOpen(false)}
        user=${user}
        profile=${profile}
        transactions=${transactions}
        assetAccounts=${assetAccounts}
        baseCurrency=${baseCurrency}
        onLoadTransactions=${onLoadStatementTransactions}
      />
      <${ConfirmLogoutSheet}
        open=${logoutSheetOpen}
        onClose=${() => setLogoutSheetOpen(false)}
        onConfirm=${() => {
          setLogoutSheetOpen(false);
          onSignOut();
        }}
      />
    </div>
  `;
}

export function SettingsPanel(props) {
  return html`<${SettingsPage} ...${props} />`;
}

