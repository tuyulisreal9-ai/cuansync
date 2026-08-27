import assert from "node:assert/strict";
import test from "node:test";
import {
  JWT_CLOCK_ERROR_CODE,
  JWT_CLOCK_ERROR_MESSAGE,
  createSupabaseSessionRecovery,
  decodeJwtTiming,
  isJwtIssuedAtFutureError,
} from "../src/lib/authSession.js";

function makeJwt(payload) {
  const encode = (value) =>
    Buffer.from(JSON.stringify(value))
      .toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode(payload)}.signature`;
}

function jwtErrorResponse() {
  return new Response(
    JSON.stringify({
      code: JWT_CLOCK_ERROR_CODE,
      message: "JWT issued at future",
    }),
    {
      status: 401,
      headers: {
        "content-type": "application/json",
        date: "Wed, 26 Aug 2026 09:47:59 GMT",
      },
    },
  );
}

test("diagnosis JWT hanya mengambil waktu iat dan exp", () => {
  const token = makeJwt({
    sub: "user-secret",
    email: "secret@example.com",
    iat: 1_787_737_600,
    exp: 1_787_741_200,
  });

  assert.deepEqual(decodeJwtTiming(token), {
    issuedAt: 1_787_737_600,
    expiresAt: 1_787_741_200,
  });
  assert.equal(
    isJwtIssuedAtFutureError(
      { code: JWT_CLOCK_ERROR_CODE, message: "JWT issued at future" },
      { status: 401 },
    ),
    true,
  );
});

test("request bersamaan memakai satu refresh dan masing-masing maksimal satu retry", async () => {
  const oldToken = makeJwt({ iat: 1_787_737_600, exp: 1_787_741_200 });
  const freshToken = makeJwt({ iat: 1_787_737_601, exp: 1_787_741_201 });
  let refreshCalls = 0;
  let fetchCalls = 0;
  const diagnostics = [];
  const client = {
    auth: {
      async refreshSession() {
        refreshCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return {
          data: {
            session: { access_token: freshToken, user: { id: "user-1" } },
          },
          error: null,
        };
      },
    },
  };
  const recovery = createSupabaseSessionRecovery({
    getClient: () => client,
    onClockDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    fetchImpl: async (_input, init) => {
      fetchCalls += 1;
      const authorization = new Headers(init?.headers).get("Authorization");
      return authorization === `Bearer ${freshToken}`
        ? new Response(JSON.stringify({ ok: true }), { status: 200 })
        : jwtErrorResponse();
    },
  });

  const init = { headers: { Authorization: `Bearer ${oldToken}` } };
  const [first, second] = await Promise.all([
    recovery.fetch("https://project.supabase.co/rest/v1/transactions", init),
    recovery.fetch("https://project.supabase.co/rest/v1/budgets", init),
  ]);

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(refreshCalls, 1);
  assert.equal(fetchCalls, 4);
  assert.equal(diagnostics.length, 2);
  assert.ok(diagnostics.every((item) => !JSON.stringify(item).includes(oldToken)));
});

test("PGRST303 yang tetap gagal berhenti setelah satu retry dan tidak logout", async () => {
  const oldToken = makeJwt({ iat: 1_787_737_600, exp: 1_787_741_200 });
  const freshToken = makeJwt({ iat: 1_787_737_601, exp: 1_787_741_201 });
  let refreshCalls = 0;
  let fetchCalls = 0;
  let signOutCalls = 0;
  const client = {
    auth: {
      async refreshSession() {
        refreshCalls += 1;
        return {
          data: { session: { access_token: freshToken } },
          error: null,
        };
      },
      async signOut() {
        signOutCalls += 1;
      },
    },
  };
  const recovery = createSupabaseSessionRecovery({
    getClient: () => client,
    onClockDiagnostic: () => {},
    fetchImpl: async () => {
      fetchCalls += 1;
      return jwtErrorResponse();
    },
  });

  const response = await recovery.fetch(
    "https://project.supabase.co/rest/v1/transactions",
    { headers: { Authorization: `Bearer ${oldToken}` } },
  );
  const payload = await response.json();

  assert.equal(response.status, 401);
  assert.equal(payload.code, JWT_CLOCK_ERROR_CODE);
  assert.equal(payload.message, JWT_CLOCK_ERROR_MESSAGE);
  assert.equal(refreshCalls, 1);
  assert.equal(fetchCalls, 2);
  assert.equal(signOutCalls, 0);
});

test("pemulihan sesi lokal dan validasi jaringan berjalan single-flight secara terpisah", async () => {
  let getSessionCalls = 0;
  let getUserCalls = 0;
  const client = {
    auth: {
      async getSession() {
        getSessionCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return {
          data: {
            session: {
              access_token: "access-token",
              refresh_token: "refresh-token",
              user: { id: "cached-user" },
            },
          },
          error: null,
        };
      },
      async getUser() {
        getUserCalls += 1;
        return { data: { user: { id: "validated-user" } }, error: null };
      },
    },
  };
  const recovery = createSupabaseSessionRecovery({ getClient: () => client });

  const [first, second] = await Promise.all([
    recovery.restoreSession(),
    recovery.restoreSession(),
  ]);

  assert.equal(first.data.session.user.id, "cached-user");
  assert.equal(second.data.session.user.id, "cached-user");
  assert.equal(getSessionCalls, 1);
  assert.equal(getUserCalls, 0);

  const [firstValidation, secondValidation] = await Promise.all([
    recovery.validateSessionUser(),
    recovery.validateSessionUser(),
  ]);

  assert.equal(firstValidation.data.user.id, "validated-user");
  assert.equal(secondValidation.data.user.id, "validated-user");
  assert.equal(getUserCalls, 1);
});
