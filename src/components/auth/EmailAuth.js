import React, { useEffect, useId, useRef, useState } from "react";
import htm from "htm";
import { CONFIRMATION_SENT_MESSAGE, RECOVERY_SENT_MESSAGE, PASSWORD_MIN_LENGTH, getEmailAuthError, validateNewPassword } from "../../lib/emailAuth.js";

const html = htm.bind(React.createElement);
const INPUT_CLASS = "cs-auth-input min-h-12 w-full min-w-0 rounded-xl px-3.5 py-3 text-base";
const BUTTON_CLASS = "dc-press min-h-12 w-full rounded-xl px-4 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50";
const PRIMARY_STYLE = { background: "var(--cs-acc)", color: "var(--cs-on-acc)" };
const MUTED_STYLE = { color: "var(--cs-mut)" };

export function AuthFrame({ title, helper, appName = "CUANSYNC", children }) {
  return html`
    <main className="auth-shell px-4" style=${{ background: "var(--cs-bg)", color: "var(--cs-ink)" }}>
      <div className="mx-auto flex min-h-full w-full max-w-[400px] flex-col justify-center py-5 sm:py-10">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <img src="/branding/logo-mark-96.png" width="32" height="32" alt="" />
          <span className="text-[15px] font-bold tracking-[0.08em]">${appName}</span>
        </div>
        <section className="dc-card p-5 sm:p-7" aria-label=${title}>
          <h1 className="text-[25px] font-bold tracking-[-0.6px]">${title}</h1>
          <p className="mt-1.5 text-[13px] leading-relaxed" style=${MUTED_STYLE}>${helper}</p>
          <div className="mt-5">${children}</div>
        </section>
        <p className="mt-5 text-center text-[11px] tracking-[0.06em]" style=${MUTED_STYLE}>CATAT. PAHAMI. KENDALIKAN.</p>
      </div>
    </main>
  `;
}

export function AuthNotice({ text, error = false }) {
  if (!text) return null;
  return html`<p role=${error ? "alert" : "status"} className="rounded-xl border px-3 py-2.5 text-[12px] leading-relaxed"
    style=${{ borderColor: "var(--cs-line)", background: "var(--cs-soft)", color: error ? "var(--cs-danger)" : "var(--cs-body)" }}>${text}</p>`;
}

function PasswordField({ label = "Kata sandi", value, onChange, disabled, newPassword = false }) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  return html`
    <div className="text-[13px] font-medium">
      <label htmlFor=${id} className="mb-1.5 block">${label}</label>
      <span className="relative block">
        <input id=${id} name=${newPassword ? "new-password" : "password"} type=${visible ? "text" : "password"}
          autoComplete=${newPassword ? "new-password" : "current-password"} required
          minLength=${newPassword ? PASSWORD_MIN_LENGTH : undefined} disabled=${disabled}
          value=${value} onChange=${(event) => onChange(event.target.value)}
          className=${`${INPUT_CLASS} pr-[4.5rem]`} />
        <button type="button" aria-label=${`${visible ? "Sembunyikan" : "Tampilkan"} ${label.toLowerCase()}`}
          aria-pressed=${visible} disabled=${disabled} onClick=${() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-1 min-h-11 min-w-14 px-2 text-[11px] font-semibold" style=${MUTED_STYLE}>
          ${visible ? "Tutup" : "Lihat"}
        </button>
      </span>
    </div>
  `;
}

export function EmailAuthScreen({ onGoogleLogin, onDemoLogin, emailAuth, supabaseReady, appName }) {
  const [view, setView] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [showResend, setShowResend] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const pending = useRef(false);
  const emailId = useId();
  const signup = view === "signup";
  const forgot = view === "forgot";

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = window.setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  function changeView(next) {
    if (pending.current) return;
    setView(next); setPassword(""); setConfirmation(""); setNotice(null); setShowResend(false);
  }

  async function run(action) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setNotice(null);
    try { await action(); }
    catch (error) {
      setNotice({ text: getEmailAuthError(error), error: true });
      if (error?.code === "email_not_confirmed") setShowResend(true);
      if (error?.status === 429) setCooldown(60);
    } finally { pending.current = false; setBusy(false); }
  }

  async function submit(event) {
    event.preventDefault();
    if (!supabaseReady || (forgot && cooldown > 0)) return;
    if (signup) {
      const validation = validateNewPassword(password, confirmation);
      if (validation) { setNotice({ text: validation, error: true }); return; }
    }
    await run(async () => {
      if (forgot) {
        await emailAuth.requestReset(email);
        setCooldown(60); setNotice({ text: RECOVERY_SENT_MESSAGE });
      } else if (signup) {
        const result = await emailAuth.signUp({ email, password });
        setPassword(""); setConfirmation("");
        if (!result?.session) {
          setView("login"); setShowResend(true); setCooldown(60);
          setNotice({ text: CONFIRMATION_SENT_MESSAGE });
        }
      } else {
        await emailAuth.signIn({ email, password });
        setPassword("");
      }
    });
  }

  return html`
    <${AuthFrame} appName=${appName} title=${forgot ? "Lupa kata sandi?" : signup ? "Buat akun" : "Selamat datang"}
      helper=${forgot ? "Kami bantu pulihkan akses ke akun CUANSYNC Anda." : signup ? "Mulai catat keuangan dengan akun pribadi Anda." : "Masuk untuk melanjutkan catatan keuangan Anda."}>
      <form onSubmit=${submit} className="grid gap-3.5" aria-busy=${busy}>
        <label htmlFor=${emailId} className="block text-[13px] font-medium">
          <span className="mb-1.5 block">Email</span>
          <input id=${emailId} name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none"
            spellCheck=${false} required disabled=${busy} value=${email} placeholder="nama@email.com"
            onChange=${(event) => { setEmail(event.target.value); setShowResend(false); setNotice(null); }} className=${INPUT_CLASS} />
        </label>
        ${!forgot ? html`<${PasswordField} key=${view} value=${password} onChange=${setPassword} disabled=${busy} newPassword=${signup} />` : null}
        ${signup ? html`<${React.Fragment}>
          <${PasswordField} label="Ulangi kata sandi" value=${confirmation} onChange=${setConfirmation} disabled=${busy} newPassword=${true} />
          <p className="text-[11.5px] leading-relaxed" style=${MUTED_STYLE}>Minimal 8 karakter. Gunakan kata sandi khusus CUANSYNC, bukan kata sandi Google Anda.</p>
        <//>
        ` : null}
        ${view === "login" ? html`<button type="button" disabled=${busy} onClick=${() => changeView("forgot")}
          className="-my-1 min-h-11 justify-self-end text-[12px] font-semibold" style=${{ color: "var(--cs-link)" }}>Lupa kata sandi?</button>` : null}
        <${AuthNotice} ...${notice || {}} />
        ${!supabaseReady ? html`<${AuthNotice} text="Layanan akun belum terhubung. Demo lokal tetap bisa digunakan." />` : null}
        <button type="submit" disabled=${busy || !supabaseReady || (forgot && cooldown > 0)} className=${BUTTON_CLASS} style=${PRIMARY_STYLE}>
          ${busy ? "Memproses…" : forgot ? cooldown > 0 ? `Kirim lagi dalam ${cooldown} dtk` : "Kirim tautan pemulihan" : signup ? "Daftar dengan email" : "Masuk"}
        </button>
        ${showResend ? html`<button type="button" disabled=${busy || cooldown > 0 || !supabaseReady}
          onClick=${() => run(async () => { await emailAuth.resendConfirmation(email); setCooldown(60); setNotice({ text: CONFIRMATION_SENT_MESSAGE }); })}
          className="min-h-11 text-[12px] font-semibold disabled:opacity-50" style=${{ color: "var(--cs-link)" }}>
          ${cooldown > 0 ? `Kirim ulang verifikasi (${cooldown} dtk)` : "Kirim ulang verifikasi email"}
        </button>` : null}
      </form>
      ${!forgot ? html`<${React.Fragment}>
        <div className="my-4 flex items-center gap-3 text-[11px]" style=${MUTED_STYLE}>
          <span className="h-px flex-1" style=${{ background: "var(--cs-line)" }}></span>atau<span className="h-px flex-1" style=${{ background: "var(--cs-line)" }}></span>
        </div>
        <button type="button" disabled=${busy || !supabaseReady} onClick=${() => run(onGoogleLogin)}
          className=${`${BUTTON_CLASS} border`} style=${{ borderColor: "var(--cs-line)", color: "var(--cs-ink)" }}>Lanjut dengan Google</button>
      <//>
      ` : null}
      <div className="mt-3 text-center text-[12px]" style=${MUTED_STYLE}>
        ${view === "login" ? "Belum punya akun? " : signup ? "Sudah punya akun? " : ""}
        <button type="button" disabled=${busy} onClick=${() => changeView(view === "login" ? "signup" : "login")}
          className="min-h-11 px-1 font-bold" style=${{ color: "var(--cs-ink)" }}>${view === "login" ? "Daftar" : forgot ? "Kembali ke masuk" : "Masuk"}</button>
      </div>
      ${view === "login" ? html`<button type="button" disabled=${busy} onClick=${onDemoLogin}
        className="min-h-11 w-full text-[11.5px]" style=${MUTED_STYLE}>Coba demo tanpa akun</button>` : null}
    <//>
  `;
}

export function PasswordForm({ onSave, onDone, onCancel, email, googleConnected = false }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const pending = useRef(false);

  async function submit(event) {
    event.preventDefault();
    if (pending.current) return;
    const validation = validateNewPassword(password, confirmation);
    if (validation) { setError(validation); return; }
    pending.current = true; setBusy(true); setError("");
    try {
      await onSave({ password, confirmation });
      setPassword(""); setConfirmation(""); setSaved(true);
    } catch (failure) { setError(getEmailAuthError(failure)); }
    finally { pending.current = false; setBusy(false); }
  }

  if (saved) return html`<div className="grid gap-4">
    <${AuthNotice} text=${googleConnected
      ? `Kata sandi berhasil disimpan. Kini Anda bisa masuk dengan ${email} dan kata sandi CUANSYNC, atau tetap memakai Google. Dompet dan transaksi tetap di akun yang sama.`
      : "Kata sandi CUANSYNC berhasil disimpan. Kini Anda dapat masuk dengan email dan kata sandi ini. Login Google tetap tersedia jika sebelumnya terhubung."} />
    <button type="button" onClick=${onDone} className=${BUTTON_CLASS} style=${PRIMARY_STYLE}>Selesai</button>
  </div>`;

  return html`<form onSubmit=${submit} className="grid gap-3.5" aria-busy=${busy}>
    <div className="rounded-xl px-3 py-2.5 text-[12px]" style=${{ background: "var(--cs-soft)", color: "var(--cs-body)" }}>
      <span className="block text-[11px]" style=${MUTED_STYLE}>Email untuk masuk</span>
      <span className="mt-1 block break-words font-semibold" style=${{ color: "var(--cs-ink)" }}>${email}</span>
      ${googleConnected ? html`<span className="mt-1.5 block text-[11px]" style=${{ color: "var(--cs-pos)" }}>Google tetap terhubung · Data akun tetap sama</span>` : null}
    </div>
    <${PasswordField} label="Kata sandi baru" value=${password} onChange=${setPassword} disabled=${busy} newPassword=${true} />
    <${PasswordField} label="Ulangi kata sandi" value=${confirmation} onChange=${setConfirmation} disabled=${busy} newPassword=${true} />
    <p className="text-[11.5px] leading-relaxed" style=${MUTED_STYLE}>Minimal 8 karakter. Ini kata sandi khusus CUANSYNC, bukan kata sandi Google. Data akun Anda tetap sama.</p>
    <${AuthNotice} text=${error} error=${true} />
    <button type="submit" disabled=${busy} className=${BUTTON_CLASS} style=${PRIMARY_STYLE}>${busy ? "Menyimpan…" : "Simpan kata sandi"}</button>
    ${onCancel ? html`<button type="button" disabled=${busy} className="min-h-11 text-[12px]" style=${MUTED_STYLE}
      onClick=${async () => {
        if (pending.current) return;
        pending.current = true; setBusy(true);
        try { await onCancel(); }
        catch (failure) { setError(getEmailAuthError(failure)); }
        finally { pending.current = false; setBusy(false); }
      }}>Batal dan keluar</button>` : null}
  </form>`;
}

export function PasswordRecoveryScreen({ email, onSave, onDone, onCancel, appName }) {
  return html`<${AuthFrame} appName=${appName} title="Atur kata sandi" helper="Simpan kata sandi baru untuk akun yang sudah diverifikasi.">
    <${PasswordForm} email=${email} onSave=${onSave} onDone=${onDone} onCancel=${onCancel} />
  <//>`;
}

export function AuthLinkErrorScreen({ error, onContinue }) {
  return html`<${AuthFrame} title="Tautan belum berhasil" helper="Tidak ada kata sandi yang diubah.">
    <div className="grid gap-4"><${AuthNotice} text=${error} error=${true} />
    <button type="button" onClick=${onContinue} className=${BUTTON_CLASS} style=${PRIMARY_STYLE}>Kembali ke CUANSYNC</button></div>
  <//>`;
}
