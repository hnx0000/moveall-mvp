import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { MemoryStore } from "../src/infrastructure/memory-store.js";
import { mutationOperation } from "../src/domain/mutation-operation.js";
import * as policy from "../src/domain/post-content.js";
import { postWorkoutId } from "./post-fixture.js";

const text = { sport: "running" as const, content: "오늘의 운동" };
async function fixture() {
  const store = new MemoryStore();
  const app = await createApp({
    store,
    config: loadConfig({
      NODE_ENV: "test",
      AUTH_SECRET: "post-content-test-secret-at-least-thirty-two-characters",
    }),
  });
  const registration = await app.inject({
    method: "POST",
    url: "/v1/auth/register",
    payload: {
      email: "content@example.test",
      displayName: "게시 테스트",
      password: "test-password-12345",
    },
  });
  const session = registration.json().data;
  const headers = {
    authorization: `Bearer ${session.accessToken}`,
    "idempotency-key": "content-attempt",
  };
  return { store, app, session, headers };
}

describe("new feed publication needs a usable source", () => {
  it("HTTP rejects body-only posts before saving, and adding a record can reuse a rejected key", async () => {
    const { store, app, session, headers } = await fixture();
    try {
      const rejected = await app.inject({
        method: "POST",
        url: "/v1/posts",
        headers,
        payload: text,
      });
      expect(rejected.statusCode).toBe(400);
      expect(rejected.json().error.code).toBe("POST_INPUT_NOT_CREATED");
      expect(await store.listPostsByUser(session.user.id)).toHaveLength(0);
      const workoutSessionId = await postWorkoutId(store, session.user.id);
      const saved = await app.inject({
        method: "POST",
        url: "/v1/posts",
        headers,
        payload: { ...text, workoutSessionId },
      });
      expect(saved.statusCode).toBe(201);
      expect(saved.json().data.workoutSummary.metrics.durationMinutes).toBe(30);
      expect(await store.listPostsByUser(session.user.id)).toHaveLength(1);
    } finally {
      await app.close();
    }
  });

  it("accepts owned available media without a workout, but rejects pending, missing and foreign sources", async () => {
    const { store, app, session, headers } = await fixture();
    try {
      const owner = session.user;
      const stranger = await store.createUser({
        email: "stranger@example.test",
        displayName: "다른 사용자",
        passwordHash: "test",
      });
      const media = await store.createMediaObject({
        userId: owner.id,
        provider: "supabase",
        bucket: "test",
        objectPath: "test/photo.jpg",
        kind: "post-image",
        contentType: "image/jpeg",
        byteSize: 100,
      });
      expect(
        await store.createPost(owner.id, owner.displayName, { ...text, mediaId: media.id }),
      ).toBeNull();
      await store.markMediaObjectAvailable(owner.id, media.id);
      expect(
        await store.createPost(stranger.id, stranger.displayName, { ...text, mediaId: media.id }),
      ).toBeNull();
      expect(
        await store.createPost(owner.id, owner.displayName, { ...text, mediaId: randomUUID() }),
      ).toBeNull();
      const foreignRecord = await postWorkoutId(store, stranger.id);
      expect(
        await store.createPost(owner.id, owner.displayName, {
          ...text,
          workoutSessionId: foreignRecord,
        }),
      ).toBeNull();
      // A valid photo must not make an invalid workout reference pass.
      expect(
        await store.createPost(owner.id, owner.displayName, {
          ...text,
          mediaId: media.id,
          workoutSessionId: foreignRecord,
        }),
      ).toBeNull();
      const saved = await app.inject({
        method: "POST",
        url: "/v1/posts",
        headers,
        payload: { ...text, mediaId: media.id },
      });
      expect(saved.statusCode).toBe(201);
      expect(saved.json().data.mediaId).toBe(media.id);
      expect(saved.json().data.workoutSessionId).toBeUndefined();
    } finally {
      await app.close();
    }
  });

  it("replays an already-committed legacy text post without allowing a new one", async () => {
    const store = new MemoryStore();
    const user = await store.createUser({
      email: "legacy@example.test",
      displayName: "기존 사용자",
      passwordHash: "test",
    });
    const operation = mutationOperation(
      { "idempotency-key": "legacy-success" },
      "post.create",
      text,
    )!;
    // Model an operation committed before this policy existed, not a new production bypass.
    const oldPolicy = vi.spyOn(policy, "requireNewFeedContent").mockImplementationOnce(() => {});
    let saved;
    try {
      saved = await store.createPost(user.id, user.displayName, text, operation);
    } finally {
      oldPolicy.mockRestore();
    }
    expect(saved).not.toBeNull();
    expect((await store.createPost(user.id, user.displayName, text, operation))?.id).toBe(
      saved!.id,
    );
    await expect(store.createPost(user.id, user.displayName, text)).rejects.toMatchObject({
      code: "POST_INPUT_NOT_CREATED",
    });
    expect(await store.listPostsByUser(user.id)).toHaveLength(1);
  });
});
