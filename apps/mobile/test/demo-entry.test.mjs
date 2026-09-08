import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { restoreAuthSession } from "../src/auth/session-bootstrap.ts";
import {
  assertCompiledAppMode,
  siteBuildEnvironment,
} from "../../../scripts/site-build-policy.mjs";

const session = {
  accessToken: "demo",
  refreshToken: "refresh",
  accessTokenExpiresAt: "2099-01-01T00:00:00Z",
  user: { id: "demo-user" },
};
function options(demoMode, read = async () => null) {
  return {
    demoMode,
    read,
    refresh: async () => session,
    me: async () => session.user,
    demoLogin: async () => session,
    isCurrent: () => true,
  };
}
test("fresh or storage-blocked demo enters without a real login; live never does", async () => {
  for (const read of [
    async () => null,
    async () => {
      throw Error("SecurityError");
    },
  ]) {
    assert.equal(await restoreAuthSession(options(true, read)), session);
    let called = false;
    assert.equal(
      await restoreAuthSession({
        ...options(false, read),
        demoLogin: async () => {
          called = true;
          return session;
        },
      }),
      null,
    );
    assert.equal(called, false);
  }
});
test("invalid old demo session can recover, but invalid live sessions return to real login", async () => {
  const invalid = {
    ...options(true, async () => session),
    me: async () => {
      throw Object.assign(Error(), { code: "AUTH_INVALID" });
    },
  };
  assert.equal(await restoreAuthSession(invalid), session);
  assert.equal(await restoreAuthSession({ ...invalid, demoMode: false }), null);
  const offline = {
    ...invalid,
    me: async () => {
      throw Object.assign(Error(), { code: "NETWORK_ERROR" });
    },
  };
  assert.equal(await restoreAuthSession({ ...offline, demoMode: false }), session);
});
test("logout/account changes during restoration cannot initiate demo login", async () => {
  let called = false;
  assert.equal(
    await restoreAuthSession({
      ...options(true),
      isCurrent: () => false,
      demoLogin: async () => {
        called = true;
        return session;
      },
    }),
    null,
  );
  assert.equal(called, false);
});
test("demo startup survives denied/full browser storage without getting real administrator access", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  try {
    for (const failure of ["denied", "quota"]) {
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        get() {
          if (failure === "denied") throw Error("SecurityError");
          return {
            getItem: () => null,
            setItem: () => {
              throw Error("QuotaExceededError");
            },
          };
        },
      });
      const { demoApi } = await import(`../src/api/demo-client.ts?storage-${failure}`);
      const result = await demoApi.devLogin();
      assert.equal(result.user.id, "demo-user");
      assert.equal((await demoApi.accountCapabilities()).admin, false);
      assert.equal(await demoApi.onboarding(result.accessToken), null);
      assert.ok((await demoApi.workouts(result.accessToken)).length > 0);
    }
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor);
    else delete globalThis.localStorage;
  }
});
test("publication fails on a stale live bundle or unknown mode", () => {
  assert.doesNotThrow(() => assertCompiledAppMode('x=(0,t.resolveAppMode)("demo")', "demo"));
  assert.throws(() => assertCompiledAppMode('x=(0,t.resolveAppMode)("live")', "demo"));
  assert.throws(() => assertCompiledAppMode("unknown bundle", "demo"));
  const env = siteBuildEnvironment("demo", {
    EXPO_PUBLIC_APP_MODE: "live",
    EXPO_PUBLIC_API_URL: "http://127.0.0.1:3011",
  });
  assert.equal(env.EXPO_PUBLIC_APP_MODE, "demo");
  assert.equal(env.EXPO_PUBLIC_API_URL, "");
  assert.equal(env.EXPO_NO_DOTENV, "1");
  assert.throws(() => siteBuildEnvironment("bad", {}));
});
test("preview entry is explicit, demo-only, and does not impersonate Google login or survey completion", () => {
  const auth = readFileSync(new URL("../src/auth/auth-context.tsx", import.meta.url), "utf8");
  const login = readFileSync(new URL("../app/login.tsx", import.meta.url), "utf8");
  const layout = readFileSync(new URL("../app/_layout.tsx", import.meta.url), "utf8");
  assert.match(auth, /if \(!isDemoMode\) throw new Error/);
  assert.match(login, /개발용 앱 들어가기/);
  assert.doesNotMatch(login, /demo-id-token/);
  assert.match(layout, /isDemoMode \|\| Boolean\(onboarding\?\.completedAt\)/);
  assert.doesNotMatch(layout, /saveOnboarding|saveNeighborhood/);
});
