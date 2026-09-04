import assert from "node:assert/strict";
import test from "node:test";

test("preview publishes separate story/record-only posts and restores audiences and crews", async () => {
  const storage = new Map();
  const previous = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  };
  try {
    const { demoApi: api } = await import("../src/api/demo-client.ts?audience-create");
    const crew = await api.createSharingCrew("demo", {
      name: "테스트 친구",
      memberIds: ["demo-friend-1", "demo-friend-2"],
    });
    const story = await api.createPost("demo", {
      sport: "running",
      content: "기록만 올리는 스토리",
      contentType: "story",
      audience: { scope: "crews", crewIds: [crew.id] },
      commentAudience: { scope: "none" },
    });
    const text = await api.createPost("demo", {
      sport: "running",
      content: "사진 없이 본문만",
      audience: { scope: "private" },
    });
    assert.equal(story.contentType, "story");
    assert.equal(story.canComment, false);
    assert.equal(Date.parse(story.expiresAt) - Date.parse(story.createdAt), 86_400_000);
    assert.equal(text.mediaUrl, undefined);
    const { demoApi: restored } = await import("../src/api/demo-client.ts?audience-reload");
    assert.equal((await restored.sharingCrews("demo"))[0].id, crew.id);
    assert.deepEqual((await restored.post(story.id)).audience.userIds, [
      "demo-friend-1",
      "demo-friend-2",
    ]);
    assert.equal((await restored.post(text.id)).audience.scope, "private");
    await assert.rejects(
      restored.createComment("demo", story.id, { content: "허용되지 않는 댓글" }),
    );
    const saved = JSON.parse(storage.get("groov-demo-feed-v1"));
    saved.posts.find((post) => post.id === story.id).createdAt = new Date(
      Date.now() - 86_400_001,
    ).toISOString();
    storage.set("groov-demo-feed-v1", JSON.stringify(saved));
    const { demoApi: expired } = await import("../src/api/demo-client.ts?audience-expired");
    assert.equal(
      (await expired.feed()).some((post) => post.id === story.id),
      false,
    );
    await assert.rejects(expired.post(story.id));
    assert.ok(await expired.post(text.id));
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
});
