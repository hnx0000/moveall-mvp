import assert from "node:assert/strict";
import test from "node:test";
import {
  characters,
  characterUserId,
  createCharacterFeedPosts,
  isCharacterPost,
} from "@moveall/contracts";
import { rankHomeFeed } from "../src/components/feed-ranking.ts";

test("character drafts only enter the feed once an actual photo is available", () => {
  const posts = createCharacterFeedPosts(Date.now());
  assert.equal(rankHomeFeed(posts, { followingIds: [] }).length, 0);
  const localImagePostIds = new Set([posts[0].id]);
  assert.deepEqual(
    rankHomeFeed(posts, { followingIds: [], localImagePostIds }).map(({ post }) => post.id),
    [posts[0].id],
  );
});

test("demo profiles and feeds use the catalog and survive reload without restoring removed seeds", async () => {
  const previous = globalThis.localStorage;
  const storage = new Map();
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  };
  try {
    const { demoApi } = await import("../src/api/demo-client.ts?characters-first");
    const posts = (await demoApi.feed()).filter(isCharacterPost);
    assert.equal(posts.length, 18);
    for (const character of characters) {
      const profile = await demoApi.memberProfile("demo", characterUserId(character.id));
      assert.equal(profile.user.displayName, character.name);
      assert.equal(profile.posts.length, 3);
      assert.ok(profile.posts.every((p) => p.sport === character.sport));
    }
    const saved = JSON.parse(storage.get("groov-demo-feed-v1"));
    const removed = posts[0];
    saved.posts = saved.posts.filter((p) => p.id !== removed.id);
    const edited = saved.posts.find(isCharacterPost);
    edited.content = "사용자가 보존한 본문";
    edited.likeCount = 9;
    storage.set("groov-demo-feed-v1", JSON.stringify(saved));
    const { demoApi: reloaded } = await import("../src/api/demo-client.ts?characters-reloaded");
    const next = (await reloaded.feed()).filter(isCharacterPost);
    assert.equal(next.length, 17);
    assert.ok(!next.some((p) => p.id === removed.id));
    assert.equal(next.find((p) => p.id === edited.id).content, edited.content);
    assert.equal(next.find((p) => p.id === edited.id).createdAt, edited.createdAt);
    await reloaded.blockUser("demo", edited.userId);
    assert.ok(!(await reloaded.feed()).some((p) => p.userId === edited.userId));
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
});
