import test from "node:test";
import assert from "node:assert/strict";
import { authenticatedRequest } from "../src/api/authenticated-request.ts";
import { ApiError } from "../src/api/transport.ts";
import { createSessionRefresher } from "../src/auth/session-refresh.ts";
const expired = () => new ApiError("expired", "AUTH_INVALID", 401);
function setup() {
  let token = "old",
    active = true,
    rotations = 0;
  const refresher = createSessionRefresher(async () => {
    rotations++;
    await Promise.resolve();
    token = "new";
    return token;
  });
  return {
    auth: {
      capture: () => ({
        ownerId: "A",
        isCurrent: () => active,
        accessToken: () => token,
        refresh: () => refresher.refresh("refresh"),
      }),
    },
    cancel: () => {
      active = false;
    },
    rotations: () => rotations,
  };
}
test("ten expired requests share one refresh and keep the same POST body/key", async () => {
  const ctx = setup(),
    calls = [];
  const result = await Promise.all(
    Array.from({ length: 10 }, () =>
      authenticatedRequest(
        "/v1/posts",
        { token: "old", method: "POST", body: '{"x":1}', headers: { "Idempotency-Key": "key" } },
        async (opt) => {
          calls.push(opt);
          if (opt.token === "old") throw expired();
          return 1;
        },
        ctx.auth,
      ),
    ),
  );
  assert.equal(ctx.rotations(), 1);
  assert.equal(result.length, 10);
  assert.equal(calls.length, 20);
  assert.ok(calls.every((x) => x.body === '{"x":1}' && x.headers["Idempotency-Key"] === "key"));
});
test("a changed login cannot replay A's request under B", async () => {
  const ctx = setup();
  let calls = 0;
  await assert.rejects(
    authenticatedRequest(
      "/v1/posts",
      { token: "old" },
      async () => {
        calls++;
        ctx.cancel();
        throw expired();
      },
      ctx.auth,
    ),
    { code: "REQUEST_CANCELLED" },
  );
  assert.equal(calls, 1);
  assert.equal(ctx.rotations(), 0);
});
test("second 401 terminates and non-auth failures never retry", async () => {
  for (const error of [
    expired(),
    new ApiError("forbidden", "DENIED", 403),
    new ApiError("offline", "NETWORK_ERROR"),
  ]) {
    const ctx = setup();
    let calls = 0;
    await assert.rejects(
      authenticatedRequest(
        "/v1/posts",
        { token: "old" },
        async () => {
          calls++;
          throw error;
        },
        ctx.auth,
      ),
    );
    assert.equal(calls, error.status === 401 ? 2 : 1);
  }
});
test("raw auth endpoints avoid recursion; pre-aborted requests never send", async () => {
  assert.equal(await authenticatedRequest("/v1/auth/refresh", {}, async () => 1, null), 1);
  const ctrl = new AbortController();
  ctrl.abort();
  let calls = 0;
  await assert.rejects(
    authenticatedRequest(
      "/v1/posts",
      { token: "old", signal: ctrl.signal },
      async () => ++calls,
      setup().auth,
    ),
  );
  assert.equal(calls, 0);
});
