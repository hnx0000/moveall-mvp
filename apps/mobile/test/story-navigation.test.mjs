import assert from "node:assert/strict";
import test from "node:test";
import { moveStory, storyGesture, isStoryDoubleTap, storyReplyContent } from "../src/components/story-navigation.ts";

const owners = [
  { id: "empty", stories: [] },
  { id: "a", stories: [1, 2, 3] },
  { id: "empty-middle", stories: [] },
  { id: "b", stories: [1, 2] },
];
test("taps advance one story while swipes advance one owner, skipping empty owners", () => {
  const current = { ownerId: "a", index: 0 };
  assert.deepEqual(moveStory(owners, current, 1, "slide"), { ownerId: "a", index: 1 });
  assert.deepEqual(moveStory(owners, current, 1, "owner"), { ownerId: "b", index: 0 });
  assert.deepEqual(moveStory(owners, { ownerId: "b", index: 1 }, -1, "owner"), current);
  assert.deepEqual(moveStory(owners, { ownerId: "b", index: 0 }, -1, "slide"), { ownerId: "a", index: 2 });
});
test("first boundary stays put and final story or owner exits", () => {
  assert.deepEqual(moveStory(owners, { ownerId: "a", index: 0 }, -1, "slide"), { ownerId: "a", index: 0 });
  assert.equal(moveStory(owners, { ownerId: "b", index: 1 }, 1, "slide"), null);
  assert.equal(moveStory(owners, { ownerId: "b", index: 0 }, 1, "owner"), null);
});
test("horizontal swipes select owners, vertical drags, holds and small drags do not navigate", () => {
  assert.equal(storyGesture(-70, 5, 180), "next-owner");
  assert.equal(storyGesture(70, 5, 180), "previous-owner");
  assert.equal(storyGesture(20, 2, 180), "none");
  assert.equal(storyGesture(50, 70, 180), "none");
  assert.equal(storyGesture(0, 0, 500), "none");
  assert.equal(storyGesture(2, 3, 120), "tap");
});
test("only close, quick taps form a double tap", () => {
  const first = { time: 100, x: 120, y: 140 };
  assert.equal(isStoryDoubleTap(first, { time: 250, x: 125, y: 145 }), true);
  assert.equal(isStoryDoubleTap(first, { time: 400, x: 125, y: 145 }), false);
  assert.equal(isStoryDoubleTap(first, { time: 250, x: 225, y: 145 }), false);
  assert.equal(isStoryDoubleTap(null, first), false);
});
test("a reply carries story context within the existing Tap Talk content limit", () => {
  assert.equal(storyReplyContent("러닝 · 한강 5K", "  같이 뛰어요!  "), "스토리 답장 · 러닝 · 한강 5K\n\n같이 뛰어요!");
  assert.ok(storyReplyContent("가".repeat(2000), "나".repeat(800)).length <= 1000);
  assert.throws(() => storyReplyContent("러닝", "  "));
  assert.throws(() => storyReplyContent("러닝", "나".repeat(801)));
});
