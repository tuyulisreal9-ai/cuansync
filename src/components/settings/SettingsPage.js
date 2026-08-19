import React, { useEffect, useState } from "react";
import htm from "htm";
import { AvatarBadge } from "../shared/AvatarBadge.js";
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
      className=${`relative inline-flex h-8 min-h-8 w-14 shrink-0 items-center rounded-full border p-1 transition focus:outline-none focus:ring-2 focus:ring-emerald-500/60 ${
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
}) {
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
      <span className="ml-3 flex shrink-0 items-center gap-2">
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
        className="flex min-h-14 w-full items-center justify-between gap-3 px-3 py-2 text-left transition hover:bg-slate-950/[0.035] disabled:cursor-not-allowed disabled:opacity-55 dark:hover:bg-white/[0.045]"
      >
        ${content}
      </button>
    `;
  }

  return html`
    <div className="flex min-h-14 items-center justify-between gap-3 px-3 py-2">
      ${content}
    </div>
  `;
}

function SettingsSection({ title, children }) {
  return html`
    <section>
      <h3 className="px-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
        ${title}
      </h3>
      <div className="cuan-card-soft mt-2 divide-y divide-slate-200/70 overflow-hidden rounded-[24px] dark:divide-white/10">
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

function ProfileDetailSheet({ open, profile, user, avatarSrc, onClose, onSave }) {
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const email = getProfileEmail(profile, user);
  const initials = getUserInitials({
    ...user,
    user_metadata: { full_name: displayName || getProfileDisplayName(profile, user) },
  });

  useEffect(() => {
    if (!open) return;
    setDisplayName(getProfileDisplayName(profile, user));
    setAvatarUrl(profile?.avatar_url || avatarSrc || "");
    setSaving(false);
  }, [open, profile, user, avatarSrc]);

  async function handleAvatarUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const nextPhoto = await resizeProfileImage(file);
    setAvatarUrl(nextPhoto);
  }

  async function handleSave() {
    setSaving(true);
    const succeeded = await onSave({
      display_name: displayName.trim() || getProfileDisplayName(profile, user),
      avatar_url: avatarUrl,
    });
    setSaving(false);
    if (succeeded) onClose();
  }

  return html`
    <${SheetShell}
      open=${open}
      onClose=${onClose}
      title="Detail profil"
      helper="Kelola identitas akun tanpa memenuhi halaman utama Pengaturan."
      labelledBy="profile-detail-sheet-title"
    >
      <div className="grid gap-4">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/62 p-3 dark:border-white/10 dark:bg-white/5">
          <${AvatarBadge} src=${avatarUrl} initials=${initials} size="lg" />
          <div className="grid min-w-0 flex-1 gap-2">
            <label className="cuan-secondary flex min-h-11 cursor-pointer items-center justify-center rounded-2xl px-3 text-sm font-black transition hover:-translate-y-0.5">
              Unggah / ganti foto
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange=${handleAvatarUpload}
              />
            </label>
            <button
              type="button"
              onClick=${() => setAvatarUrl("")}
              disabled=${!avatarUrl}
              className="rounded-2xl border border-rose-300/25 bg-rose-500/8 px-3 py-2 text-sm font-black text-rose-600 transition hover:bg-rose-500/12 disabled:cursor-not-allowed disabled:opacity-50 dark:text-rose-300"
            >
              Hapus foto
            </button>
          </div>
        </div>

        <label className="block">
          <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
            Nama tampilan
          </span>
          <input
            type="text"
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

        <button
          type="button"
          onClick=${handleSave}
          disabled=${saving}
          className="history-action-primary min-h-12 rounded-2xl px-4 py-3 text-sm font-black transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          ${saving ? "Menyimpan..." : "Simpan perubahan"}
        </button>
      </div>
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
          className=${`min-h-10 rounded-[14px] px-2 text-xs font-black transition ${
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
    <div className="settings-page mx-auto grid max-w-2xl gap-4 pb-[calc(110px+env(safe-area-inset-bottom))] md:pb-6">
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
          right=${html`
            <div className="w-[11.5rem] max-w-[48vw]">
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

