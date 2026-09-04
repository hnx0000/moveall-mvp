import assert from "node:assert/strict";
import test from "node:test";

test("preview response survives reload without pretending to be registered-user statistics", async () => {
  const values = new Map();
  const previous = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const settings = { primarySports: ["running"], activityLevel: "starter", goals: ["consistency"] };
  try {
    const { demoApi } = await import("../src/api/demo-client.ts?purpose-first");
    const first = await demoApi.saveOnboarding("demo", {
      ...settings,
      usagePurpose: "achievement",
    });
    const { demoApi: restored } = await import("../src/api/demo-client.ts?purpose-restored");
    const profile = await restored.onboarding("demo");
    assert.equal(profile.usagePurpose, "achievement");
    assert.equal(profile.usagePurposeRecordedAt, first.usagePurposeRecordedAt);
    assert.equal(profile.usagePurposeQuestionVersion, 1);
    const updated = await restored.saveOnboarding("demo", settings);
    assert.equal(updated.usagePurpose, "achievement");
    const summary = await restored.usagePurposeSummary("demo");
    assert.equal(summary.source, "preview");
    assert.equal(summary.respondents, 0);
    assert.ok(summary.distribution.every((item) => item.percent === null));

    // New preview signup resets its answer, then explicit skip remains explicit on reload.
    await restored.register({
      email: "test@example.test",
      displayName: "테스트",
      password: "test-only-1234",
    });
    await restored.saveOnboarding("demo", { ...settings, usagePurpose: null });
    const { demoApi: skipped } = await import("../src/api/demo-client.ts?purpose-skipped");
    const skippedProfile = await skipped.onboarding("demo");
    assert.equal(skippedProfile.usagePurpose, null);
    assert.ok(skippedProfile.usagePurposeRecordedAt);
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
});
