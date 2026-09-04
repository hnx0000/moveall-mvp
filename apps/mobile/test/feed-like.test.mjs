import assert from "node:assert/strict";
import test from "node:test";
import {
  FeedLikeGesture,
  isAccessibleLikeActivation,
  likePulsePosition,
  setPostLiked,
} from "../src/components/feed-like-gesture.ts";

function tap(gesture, time, x = 100, y = 120) {
  gesture.start(x, y, time);
  return gesture.end(x, y, time + 30);
}

test("the first tap does nothing; the second and subsequent rapid taps react", () => {
  const gesture = new FeedLikeGesture();
  assert.equal(tap(gesture, 0), false);
  assert.equal(tap(gesture, 100), true);
  assert.equal(tap(gesture, 200), true);
  assert.equal(tap(gesture, 300), true);
  assert.equal(tap(gesture, 400), true);
});

test("after a pause the photo requires a fresh double tap even if already liked", () => {
  const gesture = new FeedLikeGesture();
  tap(gesture, 0);
  assert.equal(tap(gesture, 100), true);
  assert.equal(tap(gesture, 800), false);
  assert.equal(tap(gesture, 900), true);
});

test("scrolling or cancelling breaks an active reaction chain", () => {
  const gesture = new FeedLikeGesture();
  tap(gesture, 0);
  tap(gesture, 100);
  gesture.start(100, 120, 200);
  gesture.move(100, 150);
  assert.equal(gesture.end(100, 150, 230), false);
  assert.equal(tap(gesture, 300), false);
  assert.equal(tap(gesture, 400), true);
  gesture.cancel();
  assert.equal(tap(gesture, 500), false);
});

test("RN Web's always-true screen reader flag never turns a pointer tap into a like", () => {
  const gesture = new FeedLikeGesture();
  let reactions = 0;
  let likes = [];
  for (const time of [0, 100, 200, 300]) {
    gesture.start(100, 120, time);
    const accessible = isAccessibleLikeActivation({
      web: true,
      screenReader: true,
      pressing: gesture.pressing,
      detail: 1,
      pointerType: "mouse",
    });
    assert.equal(accessible, false);
    if (accessible || gesture.end(100, 120, time + 30)) {
      reactions++;
      likes = setPostLiked(likes, "post", true);
    }
    if (time === 0) {
      assert.equal(reactions, 0);
      assert.deepEqual(likes, []);
    }
  }
  assert.equal(reactions, 3);
  assert.deepEqual(likes, ["post"]);
});

test("only intentional accessibility actions bypass the photo double tap", () => {
  const base = { web: true, screenReader: true, pressing: false };
  assert.equal(isAccessibleLikeActivation({ ...base, detail: 1 }), false);
  assert.equal(isAccessibleLikeActivation({ ...base, key: "Escape" }), false);
  assert.equal(isAccessibleLikeActivation({ ...base, key: "Enter" }), true);
  assert.equal(isAccessibleLikeActivation({ ...base, detail: 0 }), true);
  assert.equal(isAccessibleLikeActivation({ ...base, detail: 0, pointerType: "touch" }), false);
  assert.equal(isAccessibleLikeActivation({ ...base, pressing: true, detail: 0 }), false);
  assert.equal(isAccessibleLikeActivation({ ...base, web: false }), true);
});

test("slow taps and taps far apart are not double taps", () => {
  const gesture = new FeedLikeGesture();
  assert.equal(tap(gesture, 0), false);
  assert.equal(tap(gesture, 301), false);
  assert.equal(tap(gesture, 401, 200, 200), false);
});

test("a scroll cancels the tap even if the finger returns before release", () => {
  const gesture = new FeedLikeGesture();
  tap(gesture, 0);
  gesture.start(100, 120, 100);
  gesture.move(100, 150);
  gesture.move(100, 120);
  assert.equal(gesture.end(100, 120, 180), false);
  assert.equal(tap(gesture, 200), false);
});

test("a long press, a cancelled gesture and invalid coordinates do not like", () => {
  const gesture = new FeedLikeGesture();
  tap(gesture, 0);
  gesture.start(100, 120, 100);
  assert.equal(gesture.end(100, 120, 600), false);
  tap(gesture, 700);
  gesture.start(100, 120, 800);
  gesture.cancel();
  assert.equal(gesture.end(100, 120, 830), false);
  assert.equal(tap(gesture, 900), false);
  gesture.start(NaN, 120, 1000);
  assert.equal(gesture.end(100, 120, 1030), false);
});

test("different photos cannot complete one another's double taps", () => {
  const first = new FeedLikeGesture();
  const second = new FeedLikeGesture();
  assert.equal(tap(first, 0), false);
  assert.equal(tap(second, 100), false);
  assert.equal(tap(second, 200), true);
});

test("pulse strength accumulates, caps at five and expires", () => {
  const gesture = new FeedLikeGesture();
  assert.deepEqual(
    [0, 300, 600, 900, 1200, 1500].map((time) => gesture.nextPulse(time)),
    [1, 2, 3, 4, 5, 5],
  );
  assert.equal(gesture.nextPulse(3200), 1);
  gesture.reset();
  assert.equal(gesture.nextPulse(3300), 1);
});

test("repeated photo reactions add one like without mutating or toggling it off", () => {
  const previous = ["other"];
  const liked = setPostLiked(previous, "post", true);
  assert.deepEqual(previous, ["other"]);
  assert.deepEqual(liked, ["other", "post"]);
  assert.equal(setPostLiked(liked, "post", true), liked);
  const removed = setPostLiked(liked, "post", false);
  assert.deepEqual(removed, ["other"]);
  assert.equal(setPostLiked(removed, "post", false), removed);
});

test("pulse centers stay inside narrow, short and edge-tapped photos", () => {
  for (const [width, height] of [
    [320, 400],
    [448, 250],
    [96, 30],
  ]) {
    for (const [x, y] of [
      [0, 0],
      [width, height],
      [-20, -50],
      [999, 999],
    ]) {
      const point = likePulsePosition(width, height, x, y);
      assert.ok(point.x > 0 && point.x < width);
      assert.ok(point.y > 0 && point.y < height);
      assert.ok(point.unit > 0 && point.unit <= 1.18);
    }
  }
});
