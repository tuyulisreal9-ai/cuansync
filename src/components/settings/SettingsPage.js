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
      className=${`relative inline-flex h-11 min-h-11 w-16 shrink-0 items-center rounded-full border p-2 transition focus:outline-none focus:ring-2 focus:ring-emerald-500/60 ${
        checked
          ? "border-emerald-400/50 bg-emerald-500 shadow-[0_12px_28px_rgba(16,185,129,0.22)]"
          : "border-slate-300/80 bg-slate-200/80 dark:border-white/10 dark:bg-slate-800"
      }`}
    >
      <span
        className=${`h-6 w-6 rounded-full bg-white shadow-sm transition ${
          checked ? "translate-x-6" : "translate-x-0"
        }`}
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
        <span className=${`block truncate text-sm font-black ${danger ? "text-rose-600 dark:text-rose-300" : "text-slate-950 dark:text-white"}`}>
          ${label}
        </span>
        ${helper
          ? html`
              <span className="mt-0.5 block truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
                ${helper}
              </span>
            `
          : null}
      </span>
      <span className=${rightClass}>
        ${value
          ? html`
              <span className="max-w-[9rem] truncate text-right text-sm font-bold text-slate-500 dark:text-slate-300">
                ${value}
              </span>
            `
          : null}
        ${right}
        ${onClick
          ? html`
              <span className=${`text-lg font-black ${danger ? "text-rose-400" : "text-slate-400 dark:text-slate-500"}`}>
                >
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
        className=${`${rowClass} text-left transition hover:bg-slate-950/[0.035] disabled:cursor-not-allowed disabled:opacity-55 dark:hover:bg-white/[0.045]`}
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

function SettingsSection({ title, children }) {
  return html`
    <section className="w-full min-w-0 max-w-full">
      <h3 className="px-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
        ${title}
      </h3>
      <div className="cuan-card-soft mt-2 w-full min-w-0 max-w-full divide-y divide-slate-200/70 overflow-hidden rounded-[24px] dark:divide-white/10">
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
      className="cuan-card-soft flex min-h-[68px] w-full items-center gap-3 rounded-[24px] px-3 py-3 text-left transition hover:-translate-y-0.5 hover:border-emerald-400/30"
    >
      <${AvatarBadge} src=${avatarSrc} initials=${initials} size="md" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-black text-slate-950 dark:text-white">
          ${displayName}
        </span>
        <span className="mt-0.5 block truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
          ${email}
        </span>
      </span>
      <span className="shrink-0 text-lg font-black text-slate-400 dark:text-slate-500">></span>
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
          className=${`min-h-11 rounded-[14px] px-2 text-xs font-black transition ${
            normalizedValue === option.key
              ? "bg-brand-600 text-white shadow-[0_12px_28px_rgba(16,185,129,0.22)] dark:bg-emerald-500"
              : "text-slate-600 hover:bg-white/70 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
          }`}
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
  theme,
  onThemeChange,
  balanceVisible,
  onToggleBalanceVisibility,
  onSaveProfile,
  onSignOut,
}) {
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [logoutSheetOpen, setLogoutSheetOpen] = useState(false);

  return html`
    <div className="settings-page mx-auto grid w-full min-w-0 max-w-2xl gap-4 overflow-x-clip pb-[calc(110px+env(safe-area-inset-bottom))] md:pb-6">
      <div className="px-1">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-300">
          CUANSYNC
        </p>
        <h2 className="mt-1 font-display text-2xl font-black text-slate-950 dark:text-white">
          Pengaturan
        </h2>
      </div>

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

      <${SettingsSection} title="Keamanan & privasi">
        <${SettingsRow}
          label="Kunci aplikasi"
          helper="Kunci biometrik segera hadir"
          value="Segera"
          disabled=${true}
        />
        <${SettingsRow}
          label="Ekspor / cadangkan data"
          helper="Cadangan transaksi dan anggaran"
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

      <${ProfileDetailSheet}
        open=${profileSheetOpen}
        profile=${profile}
        user=${user}
        avatarSrc=${profilePhoto}
        onClose=${() => setProfileSheetOpen(false)}
        onSave=${onSaveProfile}
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

