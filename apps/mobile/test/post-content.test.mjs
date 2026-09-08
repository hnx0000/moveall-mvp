import assert from "node:assert/strict";
import test from "node:test";
import { hasEditorFeedSource } from "../src/components/editor-content-policy.ts";
import { demoPostWorkout } from "./post-fixture.mjs";

test("editor requires an active photo or real saved workout, not an empty canvas or sample", () => {
  const base = { background: "solid", sampleWorkoutId: "sample" };
  assert.equal(hasEditorFeedSource(base), false);
  assert.equal(hasEditorFeedSource({ ...base, photo: "hidden-photo" }), false);
  assert.equal(hasEditorFeedSource({ ...base, background: "photo", photo: "  " }), false);
  assert.equal(hasEditorFeedSource({ ...base, background: "map", workoutId: "sample" }), false);
  assert.equal(
    hasEditorFeedSource({ ...base, background: "photo", photo: "data:image/png;base64,picture" }),
    true,
  );
  assert.equal(hasEditorFeedSource({ ...base, workoutId: "saved-workout" }), true);
  assert.equal(
    hasEditorFeedSource({ ...base, background: "map", workoutId: "saved-workout" }),
    true,
  );
});

test("preview rejects empty and invented attachments without losing posts; photos and records work", async () => {
  const previous = globalThis.localStorage;
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  try {
    const { demoApi } = await import("../src/api/demo-client.ts?post-content-policy");
    const input = { sport: "running", content: "오늘 운동" };
    const before = (await demoApi.feed()).length;
    for (const extra of [{}, { mediaId: "invented" }, { workoutSessionId: "invented" }]) {
      await assert.rejects(demoApi.createPost("demo", { ...input, ...extra }), {
        code: "POST_INPUT_NOT_CREATED",
      });
    }
    assert.equal((await demoApi.feed()).length, before);
    const photo =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN3sAAAAASUVORK5CYII=";
    const photoPost = await demoApi.createPost("demo", input, photo);
    assert.equal(photoPost.mediaUrl, photo);
    assert.equal(photoPost.workoutSessionId, undefined);
    const workout = await demoPostWorkout(demoApi);
    const recordPost = await demoApi.createPost("demo", { ...input, workoutSessionId: workout.id });
    assert.equal(recordPost.workoutSummary.metrics.durationMinutes, 30);
    assert.equal(recordPost.mediaUrl, undefined);
    const both = await demoApi.createPost(
      "demo",
      { ...input, workoutSessionId: workout.id },
      photo,
    );
    assert.equal(both.mediaUrl, photo);
    assert.ok(both.workoutSummary);
    assert.equal((await demoApi.feed()).length, before + 3);
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
});
