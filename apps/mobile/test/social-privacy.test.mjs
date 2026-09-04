import assert from "node:assert/strict";
import test from "node:test";

test("saved preview posts keep timestamps and safety settings across reloads", async () => {
  const previous = globalThis.localStorage;
  const data = new Map();
  globalThis.localStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
  try {
    const { demoApi: first } = await import("../src/api/demo-client.ts?privacy-first");
    const original = (await first.feed())[0];
    await first.follow("demo", original.userId);
    await first.restrictUser("demo", original.userId, true);
    assert.equal((await first.followStatus("demo", original.userId)).following, true);
    await first.saveSocialPrivacy("demo", { hideFollowers: true, hideFollowing: false });
    const { demoApi: second } = await import("../src/api/demo-client.ts?privacy-second");
    const safety = await second.safetySummary("demo");
    assert.equal(safety.hideFollowers, true);
    assert.equal(safety.restricted[0].id, original.userId);
    assert.equal((await second.post(original.id)).createdAt, original.createdAt);
    const profile = await second.memberProfile("demo", original.userId);
    assert.ok(profile.posts.some((post) => post.id === original.id));
    const connections = await second.memberConnections("demo", original.userId);
    assert.equal(connections.followersCount, connections.followers.length);
    await second.blockUser("demo", original.userId);
    await assert.rejects(second.post(original.id));
    const { demoApi: third } = await import("../src/api/demo-client.ts?privacy-third");
    assert.equal((await third.safetySummary("demo")).blocked[0].id, original.userId);
    await third.unblockUser("demo", original.userId);
    assert.equal((await third.post(original.id)).createdAt, original.createdAt);
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
});
