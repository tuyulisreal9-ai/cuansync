export const JWT_CLOCK_ERROR_CODE = "PGRST303";
export const JWT_CLOCK_ERROR_MESSAGE =
  "Sesi belum dapat dipakai karena waktu token dan server belum selaras. " +
  "Aktifkan tanggal, waktu, dan zona waktu otomatis, lalu coba lagi sebentar lagi.";

function readResponsePayload(response) {
  return response
    .clone()
    .json()
    .catch(() => null);
}

export function isJwtIssuedAtFutureError(payload, response = null) {
  const code = String(payload?.code || "").toUpperCase();
  const message = String(payload?.message || payload?.error || "");
  return (
    code === JWT_CLOCK_ERROR_CODE ||
    /jwt\s+issued\s+at\s+future/i.test(message) ||
    /jwt.*issued.*future/i.test(message)
  ) && (!response || response.status === 401 || response.status === 403);
}

function decodeBase64Url(value) {
  if (typeof globalThis.atob !== "function") return null;
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  try {
    return globalThis.atob(padded);
  } catch {
    return null;
  }
}

export function decodeJwtTiming(accessToken) {
  if (!accessToken || typeof accessToken !== "string") return null;
  const payloadPart = accessToken.split(".")[1];
  if (!payloadPart) return null;
  const decoded = decodeBase64Url(payloadPart);
  if (!decoded) return null;

  try {
    const payload = JSON.parse(decoded);
    const issuedAt = Number(payload.iat);
    const expiresAt = Number(payload.exp);
    return {
      issuedAt: Number.isFinite(issuedAt) ? issuedAt : null,
      expiresAt: Number.isFinite(expiresAt) ? expiresAt : null,
    };
  } catch {
    return null;
  }
}

function getBearerToken(headersInit) {
  try {
    const headers = new Headers(headersInit);
    const authorization = headers.get("Authorization") || "";
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

function toUtc(seconds) {
  return Number.isFinite(seconds)
    ? new Date(seconds * 1000).toISOString()
    : null;
}

function getRequestPath(input) {
  try {
    const rawUrl = typeof input === "string" ? input : input?.url;
    if (!rawUrl) return "unknown";
    const parsed = new URL(rawUrl, globalThis.location?.origin || "https://localhost");
    return parsed.pathname;
  } catch {
    return "unknown";
  }
}

function buildClockDiagnostic({ input, init, response, phase }) {
  const token = getBearerToken(init?.headers || input?.headers);
  const timing = decodeJwtTiming(token);
  const clientSeconds = Math.floor(Date.now() / 1000);
  const serverDate = response.headers.get("date");
  const serverMilliseconds = serverDate ? Date.parse(serverDate) : Number.NaN;

  return {
    code: JWT_CLOCK_ERROR_CODE,
    phase,
    requestPath: getRequestPath(input),
    responseStatus: response.status,
    clientUtc: new Date(clientSeconds * 1000).toISOString(),
    serverUtc: Number.isFinite(serverMilliseconds)
      ? new Date(serverMilliseconds).toISOString()
      : null,
    tokenIssuedAtUtc: toUtc(timing?.issuedAt),
    tokenExpiresAtUtc: toUtc(timing?.expiresAt),
    tokenAheadOfClientSeconds: Number.isFinite(timing?.issuedAt)
      ? timing.issuedAt - clientSeconds
      : null,
  };
}

function createFriendlyJwtResponse(response, payload) {
  if (typeof Response !== "function") return response;
  const headers = new Headers(response.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.delete("content-length");
  return new Response(
    JSON.stringify({
      ...(payload && typeof payload === "object" ? payload : {}),
      code: JWT_CLOCK_ERROR_CODE,
      message: JWT_CLOCK_ERROR_MESSAGE,
    }),
    {
      status: response.status,
      statusText: response.statusText,
      headers,
    },
  );
}

function cloneRetryInput(input) {
  if (typeof Request === "function" && input instanceof Request) {
    try {
      return input.clone();
    } catch {
      return input;
    }
  }
  return input;
}

export function createSupabaseSessionRecovery({
  getClient,
  fetchImpl = (...args) => globalThis.fetch(...args),
  onClockDiagnostic = (diagnostic) =>
    console.warn("CUANSYNC JWT clock diagnostic", diagnostic),
} = {}) {
  let refreshInFlight = null;
  let restoreInFlight = null;
  let validationInFlight = null;

  async function refreshSession() {
    if (refreshInFlight) return refreshInFlight;
    const client = getClient?.();
    if (!client) {
      return {
        data: { session: null, user: null },
        error: new Error("Supabase client belum siap."),
      };
    }

    refreshInFlight = client.auth.refreshSession().finally(() => {
      refreshInFlight = null;
    });
    return refreshInFlight;
  }

  async function restoreSession() {
    if (restoreInFlight) return restoreInFlight;
    const client = getClient?.();
    if (!client) {
      return {
        data: { session: null },
        error: new Error("Supabase client belum siap."),
      };
    }

    restoreInFlight = client.auth.getSession().finally(() => {
      restoreInFlight = null;
    });
    return restoreInFlight;
  }

  async function validateSessionUser() {
    if (validationInFlight) return validationInFlight;
    const client = getClient?.();
    if (!client) {
      return {
        data: { user: null },
        error: new Error("Supabase client belum siap."),
      };
    }

    validationInFlight = client.auth.getUser().finally(() => {
      validationInFlight = null;
    });
    return validationInFlight;
  }

  async function recoveryFetch(input, init) {
    const retryInput = cloneRetryInput(input);
    const response = await fetchImpl(input, init);
    const payload = await readResponsePayload(response);
    if (!isJwtIssuedAtFutureError(payload, response)) return response;

    onClockDiagnostic?.(
      buildClockDiagnostic({ input, init, response, phase: "initial" }),
    );

    const { data, error } = await refreshSession();
    const accessToken = data?.session?.access_token;
    if (error || !accessToken) {
      return createFriendlyJwtResponse(response, payload);
    }

    const retryHeaders = new Headers(init?.headers || input?.headers);
    retryHeaders.set("Authorization", `Bearer ${accessToken}`);
    const retryResponse = await fetchImpl(retryInput, {
      ...init,
      headers: retryHeaders,
    });
    const retryPayload = await readResponsePayload(retryResponse);
    if (!isJwtIssuedAtFutureError(retryPayload, retryResponse)) {
      return retryResponse;
    }

    onClockDiagnostic?.(
      buildClockDiagnostic({
        input: retryInput,
        init: { ...init, headers: retryHeaders },
        response: retryResponse,
        phase: "retry",
      }),
    );
    return createFriendlyJwtResponse(retryResponse, retryPayload);
  }

  return {
    fetch: recoveryFetch,
    refreshSession,
    restoreSession,
    validateSessionUser,
  };
}
