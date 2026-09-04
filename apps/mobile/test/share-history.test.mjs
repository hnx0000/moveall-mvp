import assert from "node:assert/strict";
import test from "node:test";

test("successful shares, suggestions, messages and likes survive preview reload", async () => {
  const previous = globalThis.localStorage;
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  try {
    const { demoApi } = await import("../src/api/demo-client.ts?share-history-first");
    const people = [...new Set((await demoApi.feed()).map((post) => post.userId))].slice(0, 5);
    for (const person of people) await demoApi.follow("demo", person);
    const first = await demoApi.createPost("demo", { sport: "running", content: "공유 테스트" });
    const result = await demoApi.sharePost("demo", first.id, people);
    assert.equal(result.recipientCount, 5);
    assert.equal((await demoApi.sharePost("demo", first.id, people)).recipientCount, 0);
    const second = await demoApi.createPost("demo", { sport: "running", content: "다음 공유" });
    await demoApi.sharePost("demo", second.id, [people[4]]);
    const otherPost = (await demoApi.feed()).find((post) => people.includes(post.userId));
    const count = otherPost.likeCount;
    assert.equal((await demoApi.setPostLiked("demo", otherPost.id, true)).likeCount, count + 1);
    assert.equal((await demoApi.setPostLiked("demo", otherPost.id, true)).changed, false);
    const { demoApi: restored } = await import("../src/api/demo-client.ts?share-history-restored");
    const suggestions = await restored.socialSuggestions("demo");
    assert.equal(suggestions.frequentIds.length, 4);
    assert.equal(suggestions.people[0].id, people[4]);
    assert.equal((await restored.messages("demo", people[4])).length, 2);
    assert.equal((await restored.post(otherPost.id)).likedByMe, true);
    assert.equal((await restored.post(first.id)).shareCount, 1);
    assert.equal((await restored.sharePost("demo", first.id, people)).recipientCount, 0);
    await restored.unfollow("demo", people[4]);
    assert.equal(
      (await restored.socialSuggestions("demo")).people.some((person) => person.id === people[4]),
      false,
    );
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
});
