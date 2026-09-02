import assert from "node:assert/strict";
import test from "node:test";
import { isOnboardingPending } from "../src/auth/onboarding-readiness.ts";

test("a restored session waits for onboarding before any redirect", () => {
  assert.equal(isOnboardingPending(false, null, "user:restored-token"), true);
  assert.equal(isOnboardingPending(true, "user:restored-token", "user:restored-token"), true);
  assert.equal(isOnboardingPending(false, "user:restored-token", "user:restored-token"), false);
});

test("account switches and refreshed sessions never use stale onboarding", () => {
  assert.equal(isOnboardingPending(false, "first:token", "second:token"), true);
  assert.equal(isOnboardingPending(false, "first:old", "first:new"), true);
  assert.equal(isOnboardingPending(false, null, null), false);
});
