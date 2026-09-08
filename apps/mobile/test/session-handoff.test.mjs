import test from "node:test";
import assert from "node:assert/strict";
import { createSessionRefresher } from "../src/auth/session-refresh.ts";
import { retireSession } from "../src/auth/session-handoff.ts";
test("expired access token is refreshed before retiring the server login", async () => {
  const calls = [];
  await retireSession(
    { accessToken: "old", refreshToken: "refresh" },
    {
      logout: async (token) => {
        calls.push(token);
        if (token === "old") throw Object.assign(Error(), { code: "AUTH_INVALID" });
      },
      refresh: async () => ({ accessToken: "new", refreshToken: "rotated" }),
    },
  );
  assert.deepEqual(calls, ["old", "new"]);
});
test("network failure cannot be mistaken for successful handoff", async () => {
  await assert.rejects(
    retireSession(
      { accessToken: "old", refreshToken: "refresh" },
      {
        logout: async () => {
          throw Object.assign(Error("offline"), { code: "NETWORK_ERROR" });
        },
        refresh: async () => {
          throw Error("should not run");
        },
      },
    ),
    /offline/,
  );
});
test("logout joins the ongoing refresh instead of rotating the old token twice", async () => {
  let release,
    calls = 0,
    revoked = false;
  const refresher = createSessionRefresher(async () => {
    calls++;
    return new Promise((resolve) => {
      release = resolve;
    });
  });
  const existing = refresher.refresh("old-refresh");
  await Promise.resolve();
  const retirement = retireSession(
    { accessToken: "old", refreshToken: "old-refresh" },
    {
      refresh: refresher.refresh,
      logout: async (token) => {
        if (token === "old") throw Object.assign(Error(), { code: "AUTH_INVALID" });
        revoked = true;
      },
    },
  );
  await Promise.resolve();
  release({ accessToken: "new", refreshToken: "new-refresh" });
  await Promise.all([existing, retirement]);
  refresher.clear();
  assert.equal(calls, 1);
  assert.equal(revoked, true);
});
