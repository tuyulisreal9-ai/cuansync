import { NATIVE_AUTH_CALLBACK_URL } from "./nativeAppRoute.js";

export const PASSWORD_MIN_LENGTH = 8;
export const RECOVERY_STORAGE_KEY = "cuansync-password-recovery-user";
export const RECOVERY_SENT_MESSAGE =
  "Jika email ini terdaftar, tautan pemulihan akan dikirim. Periksa kotak masuk dan spam. Buka tautan pada aplikasi atau peramban yang dipakai untuk meminta pemulihan.";
export const CONFIRMATION_SENT_MESSAGE =
  "Periksa kotak masuk dan spam untuk verifikasi email. Jika sudah punya akun, silakan masuk atau gunakan Lupa kata sandi. Akun Google lama dapat mengatur Email & kata sandi lewat Pengaturan setelah masuk dengan Google.";

export function normalizeAuthEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function getAccountLoginInfo(user) {
  // Identitas / app_metadata berasal dari Auth, bukan user_metadata yang bisa
  // diedit pengguna. Provider "email" tidak membuktikan ada kata sandi: akun
  // magic-link juga memilikinya, jadi jangan menebak status aktif/belum aktif.
  const identities = Array.isArray(user?.identities) ? user.identities : [];
  const providers = Array.isArray(user?.app_metadata?.providers) ? user.app_metadata.providers : [];
  return {
    email: normalizeAuthEmail(user?.email),
    googleConnected: identities.some((identity) => identity?.provider === "google")
      || providers.includes("google") || user?.app_metadata?.provider === "google",
  };
}

export function validateNewPassword(password, confirmation) {
  if (typeof password !== "string" || password.length < PASSWORD_MIN_LENGTH) {
    return `Gunakan minimal ${PASSWORD_MIN_LENGTH} karakter untuk kata sandi.`;
  }
  if (!password.trim()) return "Kata sandi tidak boleh hanya berisi spasi.";
  if (password !== confirmation) return "Konfirmasi kata sandi belum sama.";
  return "";
}

export function getEmailAuthError(error, context = "default") {
  const code = error?.code || "";
  if (error?.status === 429 || ["over_email_send_rate_limit", "over_request_rate_limit"].includes(code)) {
    return "Terlalu banyak percobaan. Tunggu beberapa saat sebelum mencoba lagi.";
  }
  if (code === "email_not_confirmed") return "Email belum diverifikasi. Periksa email verifikasi atau kirim ulang di bawah.";
  if (code === "invalid_credentials") return "Email atau kata sandi tidak cocok. Jika sebelumnya memakai Google, masuk dengan Google lalu buka Pengaturan → Metode masuk → Email & kata sandi.";
  if (code === "weak_password") return "Kata sandi belum memenuhi keamanan akun. Gunakan kata sandi lebih panjang dengan huruf besar, huruf kecil, angka, dan simbol; hindari kata sandi yang pernah bocor.";
  if (code === "same_password") return "Gunakan kata sandi baru yang berbeda dari kata sandi sebelumnya.";
  if (["reauthentication_needed", "reauthentication_not_valid", "session_not_found", "session_expired"].includes(code)) {
    return "Silakan masuk kembali, lalu coba ubah kata sandi. Anda juga dapat menggunakan Lupa kata sandi di halaman masuk.";
  }
  if (["email_address_invalid", "validation_failed"].includes(code)) return "Periksa kembali email dan kolom yang diisi.";
  if (["email_provider_disabled", "signup_disabled", "email_address_not_authorized"].includes(code)) {
    return "Layanan email belum tersedia untuk akun ini. Coba masuk dengan Google atau hubungi pengelola CUANSYNC.";
  }
  if (["user_already_exists", "email_exists"].includes(code)) return "Jika sudah mempunyai akun, silakan masuk atau gunakan Lupa kata sandi.";
  if (context === "callback" || ["otp_expired", "flow_state_not_found", "flow_state_expired", "bad_code_verifier"].includes(code)) {
    return "Tautan tidak dapat digunakan. Tautan mungkin kedaluwarsa, sudah digunakan, atau dibuka di peramban lain. Minta tautan baru dan buka di aplikasi atau peramban yang sama.";
  }
  if (error?.name === "TypeError" || error?.name === "AuthRetryableFetchError") return "Belum dapat terhubung. Periksa koneksi internet dan coba lagi.";
  // Jangan tampilkan respons mentah server atau membocorkan apakah email terdaftar.
  return "Permintaan belum berhasil. Coba lagi; jika tetap gagal, hubungi pengelola CUANSYNC.";
}

export function getEmailAuthRedirect({ native = false, origin, recovery = false }) {
  const url = new URL(native ? NATIVE_AUTH_CALLBACK_URL : `${new URL(origin).origin}/`);
  if (recovery) url.searchParams.set("auth", "reset-password");
  return url.href;
}

export function createEmailAuth({ getClient, getRedirect }) {
  const auth = () => {
    const client = getClient();
    if (!client) throw new Error("Layanan akun belum tersedia.");
    return client.auth;
  };
  const unwrap = async (request) => {
    const { data, error } = await request;
    if (error) throw error;
    return data;
  };
  return {
    signIn: ({ email, password }) => unwrap(auth().signInWithPassword({ email: normalizeAuthEmail(email), password })),
    signUp: ({ email, password }) => unwrap(auth().signUp({
      email: normalizeAuthEmail(email), password,
      options: { emailRedirectTo: getRedirect(false) },
    })),
    requestReset: (email) => unwrap(auth().resetPasswordForEmail(normalizeAuthEmail(email), { redirectTo: getRedirect(true) })),
    resendConfirmation: (email) => unwrap(auth().resend({
      type: "signup", email: normalizeAuthEmail(email),
      options: { emailRedirectTo: getRedirect(false) },
    })),
    async updatePassword({ password, confirmation, expectedUserId }) {
      const validation = validateNewPassword(password, confirmation);
      if (validation) throw Object.assign(new Error(validation), { code: "weak_password" });
      // Gunakan sesi terverifikasi dan identitas yang sama; jangan mendaftar ulang
      // atau menulis kata sandi ke tabel profil / penyimpanan lokal.
      const { user } = await unwrap(auth().getUser());
      if (!expectedUserId || !user || user.id !== expectedUserId) {
        throw Object.assign(new Error("Sesi akun berubah."), { code: "session_not_found" });
      }
      return unwrap(auth().updateUser({ password }));
    },
  };
}

function callbackParams(value) {
  const url = new URL(value);
  const params = new URLSearchParams(url.search);
  for (const [key, value] of new URLSearchParams(url.hash.slice(1))) {
    if (!params.has(key)) params.set(key, value);
  }
  return params;
}

export function hasAuthCallback(value) {
  try {
    const params = callbackParams(value);
    return ["code", "access_token", "error", "error_description"].some((key) => params.has(key));
  } catch { return false; }
}

export function getAuthCallbackFromUrl(value) {
  const params = callbackParams(value);
  if (params.has("error") || params.has("error_description")) {
    throw Object.assign(new Error("Tautan autentikasi tidak valid."), { code: params.get("error_code") || "otp_expired" });
  }
  const recovery = params.get("type") === "recovery" || params.get("auth") === "reset-password";
  if (params.get("code")) return { type: "pkce", code: params.get("code"), recovery };
  if (params.get("access_token") && params.get("refresh_token")) {
    return { type: "tokens", recovery, session: {
      access_token: params.get("access_token"), refresh_token: params.get("refresh_token"),
    } };
  }
  if (hasAuthCallback(value)) throw new Error("Tautan autentikasi tidak lengkap.");
  return null;
}

export function getAuthSessionFromCallback(value) {
  const callback = getAuthCallbackFromUrl(value);
  return callback?.type === "tokens" ? callback.session : null;
}

export function cleanAuthCallbackUrl(value) {
  const url = new URL(value);
  const keys = ["code", "auth", "type", "access_token", "refresh_token", "expires_in", "expires_at", "token_type", "provider_token", "provider_refresh_token", "error", "error_code", "error_description"];
  const hash = new URLSearchParams(url.hash.slice(1));
  for (const key of keys) { url.searchParams.delete(key); hash.delete(key); }
  if (keys.some((key) => new URLSearchParams(url.hash.slice(1)).has(key))) url.hash = hash.toString();
  return url.href;
}

// Pertukaran eksplisit diperlukan: auth-js 2.70 menghilangkan redirectType
// recovery pada deteksi URL PKCE otomatis. Duplikat cold/warm launch memakai
// promise yang sama, bukan menukar kode sekali-pakai dua kali.
export function createAuthCallbackHandler({ exchangeCode, setSession }) {
  let lastUrl = null;
  let lastRequest = null;
  return (url) => {
    if (url === lastUrl) return lastRequest;
    lastUrl = url;
    lastRequest = (async () => {
      const callback = getAuthCallbackFromUrl(url);
      if (!callback) return null;
      const { data, error } = await (callback.type === "pkce" ? exchangeCode(callback.code) : setSession(callback.session));
      if (error) throw error;
      if (!data?.session?.user?.id) throw new Error("Sesi autentikasi tidak tersedia.");
      return { session: data.session, recovery: callback.recovery || data.redirectType === "recovery" };
    })();
    return lastRequest;
  };
}

// Hanya penanda UI (ID akun), bukan token/password atau bukti otorisasi.
// Sesi Supabase tetap wajib, dan penanda tidak berlaku untuk akun berbeda.
export function readPasswordRecovery(storage, userId) {
  try { return Boolean(userId && storage?.getItem(RECOVERY_STORAGE_KEY) === userId); }
  catch { return false; }
}

export function savePasswordRecovery(storage, userId) {
  try {
    if (userId) storage?.setItem(RECOVERY_STORAGE_KEY, userId);
    else storage?.removeItem(RECOVERY_STORAGE_KEY);
  } catch { /* Mode privat tetap dapat menyelesaikan formulir tanpa persistensi. */ }
}
