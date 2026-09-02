import assert from "node:assert/strict";
import test from "node:test";
import { PullToRefreshGesture } from "../src/components/pull-to-refresh-gesture.ts";

test("downward drag at the top refreshes only once on release", () => {
  const pull = new PullToRefreshGesture();
  pull.start(20, 100, 0);
  pull.move(22, 244, 0);
  assert.equal(pull.ready, true);
  assert.equal(pull.end(), true);
  assert.equal(pull.end(), false);
  assert.equal(pull.distance, 0);
});

test("small pulls do not refresh", () => {
  const pull = new PullToRefreshGesture();
  pull.start(0, 0, 0);
  pull.move(0, 70, 0);
  assert.equal(pull.active, true);
  assert.equal(pull.end(), false);
});

test("scrolling up from the middle does not turn into refresh", () => {
  const pull = new PullToRefreshGesture();
  pull.start(0, 0, 200);
  pull.move(0, 300, 0);
  assert.equal(pull.active, false);
  assert.equal(pull.end(), false);
});

test("horizontal story swipes remain horizontal even if later dragged down", () => {
  const pull = new PullToRefreshGesture();
  pull.start(0, 0, 0);
  pull.move(45, 10, 0);
  pull.move(45, 300, 0);
  assert.equal(pull.active, false);
  assert.equal(pull.end(), false);
});

test("an upward gesture never refreshes", () => {
  const pull = new PullToRefreshGesture();
  pull.start(0, 100, 0);
  pull.move(0, 70, 0);
  pull.move(0, 300, 0);
  assert.equal(pull.end(), false);
});

test("pulling back before release disarms refresh", () => {
  const pull = new PullToRefreshGesture();
  pull.start(0, 0, 0);
  pull.move(0, 150, 0);
  assert.equal(pull.ready, true);
  pull.move(0, 35, 0);
  assert.equal(pull.end(), false);
});

test("cancelled touches and lost focus never refresh", () => {
  const pull = new PullToRefreshGesture();
  pull.start(0, 0, 0);
  pull.move(0, 300, 0);
  assert.equal(pull.distance, 92);
  assert.equal(pull.end(true), false);
});

test("content scrolling during a candidate pull cancels it", () => {
  const pull = new PullToRefreshGesture();
  pull.start(0, 0, 0);
  pull.move(0, 150, 20);
  assert.equal(pull.end(), false);
});
