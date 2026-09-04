import assert from "node:assert/strict";
import test from "node:test";

test("following is saved once and remains removed after unfollow and reload", async () => {
  const values = new Map();
  const previous = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  try {
    const { demoApi } = await import("../src/api/demo-client.ts?follow-test-1");
    const userId = (await demoApi.feed())[0].userId;
    await demoApi.follow("demo", userId);
    await demoApi.follow("demo", userId);
    const { demoApi: restored } = await import("../src/api/demo-client.ts?follow-test-2");
    assert.equal((await restored.followStatus("demo", userId)).following, true);
    const summary = await restored.socialSummary("demo");
    assert.equal(summary.following.filter((person) => person.id === userId).length, 1);
    await restored.unfollow("demo", userId);
    const { demoApi: afterUnfollow } = await import("../src/api/demo-client.ts?follow-test-3");
    assert.equal((await afterUnfollow.followStatus("demo", userId)).following, false);
    assert.equal((await afterUnfollow.socialSummary("demo")).followingCount, 0);
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
});
