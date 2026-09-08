import test from "node:test";
import assert from "node:assert/strict";
import { initialState, loadState, progress, completeSession, toggle, sports } from "./model.mjs";
test("six sports have distinct goals, metrics and people", () => {
  assert.equal(Object.keys(sports).length, 6);
  assert.equal(sports.swimming.unit, "m");
  assert.equal(sports.strength.unit, "회");
  assert.notEqual(sports.running.metric, sports.cycling.metric);
});
test("a completed session updates only its sport across all concept views", () => {
  const s = completeSession(initialState(), { id: "a", sport: "running", amount: 5 });
  assert.equal(progress(s, "running").total, 37);
  assert.equal(progress(s, "swimming").total, 2500);
  assert.equal(s.sessions.length, 1);
});
test("completion is idempotent and rejects invalid amounts", () => {
  const x = { id: "a", sport: "running", amount: 5 };
  const s = completeSession(initialState(), x);
  assert.equal(completeSession(s, x).sessions.length, 1);
  assert.equal(completeSession(s, { ...x, id: "b", amount: -2 }).sessions.length, 1);
});
test("goals and evaluations survive reload, invalid saved content falls back", () => {
  const s = initialState();
  s.goals.running = 75;
  s.reviews.today = { record: 4, note: "다시 올 이유" };
  assert.equal(progress(loadState(JSON.stringify(s)), "running").target, 75);
  assert.equal(loadState(JSON.stringify(s)).reviews.today.note, "다시 올 이유");
  assert.deepEqual(loadState("{broken"), initialState());
});
test("mission and follow toggles are reversible", () => {
  assert.deepEqual(toggle(toggle([], "crew"), "crew"), []);
});
