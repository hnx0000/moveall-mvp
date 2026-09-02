import assert from "node:assert/strict";
import test from "node:test";
import { commentThreads } from "../src/components/comment-threads.ts";

test("replies follow their original comment regardless of feed order", () => {
  const root = { id: "a" };
  const other = { id: "b" };
  const reply1 = { id: "a1", parentCommentId: "a" };
  const reply2 = { id: "a2", parentCommentId: "a" };
  assert.deepEqual(commentThreads([reply1, root, other, reply2]), [
    { comment: root, replies: [reply1, reply2] },
    { comment: other, replies: [] },
  ]);
});

test("replies to unavailable original comments do not leak into another thread", () => {
  assert.deepEqual(commentThreads([{ id: "reply", parentCommentId: "hidden" }]), []);
  assert.deepEqual(commentThreads([]), []);
});

test("demo comments, replies, likes and own post deletion survive reload", async () => {
  const values = new Map();
  const previous = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  try {
    const { demoApi } = await import("../src/api/demo-client.ts?comment-test-1");
    const post = await demoApi.createPost("demo", { sport: "running", content: "새 게시물" });
    const root = await demoApi.createComment("demo", post.id, { content: "새 댓글" });
    await demoApi.createComment("demo", post.id, { content: "새 답글", parentCommentId: root.id });
    await demoApi.setCommentLiked("demo", post.id, root.id, true);
    await demoApi.setCommentLiked("demo", post.id, root.id, true);
    const { demoApi: restored } = await import("../src/api/demo-client.ts?comment-test-2");
    const saved = await restored.post(post.id);
    assert.equal(saved.comments.length, 2);
    assert.equal(saved.comments[1].parentCommentId, root.id);
    assert.equal(saved.comments[0].likeCount, 1);
    assert.equal(saved.comments[0].likedByMe, true);
    const strangerPost = (await restored.feed()).find((item) => item.userId !== post.userId);
    await assert.rejects(restored.deletePost("demo", strangerPost.id));
    assert.ok(await restored.post(strangerPost.id));
    await restored.setCommentLiked("demo", post.id, root.id, false);
    assert.equal((await restored.post(post.id)).comments[0].likeCount, 0);
    await restored.deletePost("demo", post.id);
    const { demoApi: afterDelete } = await import("../src/api/demo-client.ts?comment-test-3");
    await assert.rejects(afterDelete.post(post.id));
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
});
