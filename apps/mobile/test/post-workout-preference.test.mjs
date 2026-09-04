import assert from "node:assert/strict";
import test from "node:test";
import { createPostWorkoutPreference, workoutPostRoute } from "../src/post-workout-preference.ts";

function setup() {
  const data = new Map();
  const storage = {
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => {
      data.set(key, value);
    },
  };
  return { storage, settings: createPostWorkoutPreference(storage) };
}
test("new accounts default to a post invitation", async () => {
  assert.equal(await setup().settings.read("alice"), true);
});
test("off survives reloading and remains account-specific", async () => {
  const { storage, settings } = setup();
  await settings.write("alice", false);
  const reloaded = createPostWorkoutPreference(storage);
  assert.equal(await reloaded.read("alice"), false);
  assert.equal(await reloaded.read("bob"), true);
  await reloaded.write("alice", true);
  assert.equal(await settings.read("alice"), true);
});
test("unavailable storage does not block the completed workout", async () => {
  const settings = createPostWorkoutPreference({
    getItem: async () => {
      throw Error("offline");
    },
    setItem: async () => {
      throw Error("full");
    },
  });
  assert.equal(await settings.read("alice"), true);
  await assert.rejects(settings.write("alice", false), /full/);
});
test("post invitation opens the editor with the exact saved workout, not an automatic publish", () => {
  assert.deepEqual(workoutPostRoute("saved-workout-42"), {
    pathname: "/compose",
    params: { kind: "post", workoutSessionId: "saved-workout-42" },
  });
});
