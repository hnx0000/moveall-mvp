import test from "node:test";
import assert from "node:assert/strict";
import {
  onboardingIdentity,
  canApplySessionResult,
  isTerminalAuthFailure,
} from "../src/auth/session-lifecycle.ts";
import { isOnboardingPending } from "../src/auth/onboarding-readiness.ts";
import { createSessionRefresher } from "../src/auth/session-refresh.ts";

test("effect replay and profile updates share the same token rotation", async () => {
  let count = 0;
  const refresher = createSessionRefresher(async () => {
    count++;
    return { token: "next" };
  });
  const [a, b] = await Promise.all([refresher.refresh("old"), refresher.refresh("old")]);
  assert.equal(a, b);
  assert.equal(await refresher.refresh("old"), a);
  assert.equal(count, 1);
  refresher.clear();
  await refresher.refresh("old");
  assert.equal(count, 2);
});
test("failed refresh can be retried instead of caching a network failure", async () => {
  let count = 0;
  const refresher = createSessionRefresher(async () => {
    if (++count === 1) throw Error("offline");
    return "next";
  });
  await assert.rejects(refresher.refresh("old"));
  assert.equal(await refresher.refresh("old"), "next");
});

test("rotation preserves the onboarding identity; account switch still gates", () => {
  const first = { user: { id: "A" }, accessToken: "old", refreshToken: "first" };
  const rotated = { ...first, accessToken: "new", refreshToken: "next" };
  assert.equal(
    isOnboardingPending(false, onboardingIdentity(first), onboardingIdentity(rotated)),
    false,
  );
  assert.equal(isOnboardingPending(false, "A", onboardingIdentity({ user: { id: "B" } })), true);
});
test("late refresh cannot resurrect logout or overwrite another login/rotation", () => {
  const first = { user: { id: "A" }, refreshToken: "first" };
  assert.equal(canApplySessionResult(first, first), true);
  for (const current of [
    null,
    { user: { id: "B" }, refreshToken: "first" },
    { ...first, refreshToken: "new" },
  ]) {
    assert.equal(canApplySessionResult(current, first), false);
  }
});
test("offline, timeout, rate limiting and server failures do not erase credentials", () => {
  for (const code of [
    "NETWORK_ERROR",
    "REQUEST_TIMEOUT",
    "INTERNAL_ERROR",
    "SERVICE_NOT_READY",
    "RATE_LIMITED",
  ]) {
    assert.equal(isTerminalAuthFailure({ code }), false);
  }
  assert.equal(isTerminalAuthFailure({ code: "REFRESH_TOKEN_INVALID" }), true);
});
