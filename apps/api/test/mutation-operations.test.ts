import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { MemoryStore } from "../src/infrastructure/memory-store.js";
import { mutationOperation } from "../src/domain/mutation-operation.js";
import { claimOperation } from "../src/infrastructure/postgres-operation-ledger.js";
import type { PoolClient } from "pg";
import { postWorkoutId } from "./post-fixture.js";
const workout = {
  sport: "running" as const,
  startedAt: "2026-09-08T00:00:00.000Z",
  endedAt: "2026-09-08T00:30:00.000Z",
  perceivedExertion: 5,
  metrics: { durationMinutes: 30, distanceKm: 5 },
  source: "manual" as const,
};
async function fixture() {
  const store = new MemoryStore();
  const app = await createApp({
    store,
    config: loadConfig({
      NODE_ENV: "test",
      AUTH_SECRET: "operation-test-secret-at-least-thirty-two-characters",
    }),
  });
  const user = (
    await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        email: "operation@example.test",
        displayName: "저장 테스트",
        password: "test-pass-12345",
      },
    })
  ).json().data;
  const headers = {
    authorization: `Bearer ${user.accessToken}`,
    "idempotency-key": "same-request-id",
  };
  return { app, store, user, headers };
}
describe("idempotent publication and recording", () => {
  it("concurrent workout retries return one ID, reject changed payload and do not revive deletion", async () => {
    const f = await fixture();
    try {
      const create = () =>
        f.app.inject({
          method: "POST",
          url: "/v1/workout-sessions",
          headers: f.headers,
          payload: workout,
        });
      const responses = await Promise.all([create(), create(), create()]);
      expect(responses.map((r) => r.statusCode)).toEqual([201, 201, 201]);
      const id = responses[0]!.json().data.id;
      expect(new Set(responses.map((r) => r.json().data.id)).size).toBe(1);
      expect(await f.store.listWorkoutSessions(f.user.user.id)).toHaveLength(1);
      const changed = await f.app.inject({
        method: "POST",
        url: "/v1/workout-sessions",
        headers: f.headers,
        payload: { ...workout, metrics: { durationMinutes: 40 } },
      });
      expect(changed.statusCode).toBe(409);
      await f.store.deleteWorkoutSession(f.user.user.id, id);
      expect((await create()).statusCode).toBe(410);
      expect(await f.store.listWorkoutSessions(f.user.user.id)).toHaveLength(0);
    } finally {
      await f.app.close();
    }
  });
  it("post retries remain the same publication even when archived, and fail after deletion", async () => {
    const f = await fixture();
    try {
      const workoutSessionId = await postWorkoutId(f.store, f.user.user.id);
      const create = () =>
        f.app.inject({
          method: "POST",
          url: "/v1/posts",
          headers: f.headers,
          payload: { sport: "running", content: "한 번만 게시", workoutSessionId },
        });
      const [a, b] = await Promise.all([create(), create()]);
      expect(a.statusCode).toBe(201);
      expect(b.json().data.id).toBe(a.json().data.id);
      const id = a.json().data.id;
      await f.store.setPostArchived(f.user.user.id, id, true);
      expect((await create()).json().data.id).toBe(id);
      await f.store.deletePost(f.user.user.id, id);
      expect((await create()).statusCode).toBe(410);
    } finally {
      await f.app.close();
    }
  });
  it("health imports require consent and preserve deletion across renewed aggregate values", async () => {
    const f = await fixture();
    try {
      const input = { ...workout, source: "wearable" };
      const headers = { ...f.headers, "x-health-provider": "apple-health" };
      const create = (payload = input) =>
        f.app.inject({ method: "POST", url: "/v1/workout-sessions", headers, payload });
      expect((await create()).statusCode).toBe(403);
      await f.store.saveConsent(f.user.user.id, {
        termsVersion: "test",
        privacyVersion: "test",
        termsAccepted: true,
        privacyAccepted: true,
        healthDataAccepted: true,
        locationAccepted: false,
        mediaAccepted: false,
        marketingAccepted: false,
      });
      const first = await create();
      expect(first.statusCode).toBe(201);
      expect(
        (await create({ ...input, metrics: { ...input.metrics, distanceKm: 5.1 } })).json().data.id,
      ).toBe(first.json().data.id);
      await f.store.deleteWorkoutSession(f.user.user.id, first.json().data.id);
      expect((await create()).json().error.code).toBe("HEALTH_IMPORT_DELETED");
    } finally {
      await f.app.close();
    }
  });
  it("operation identity is scoped to the owner and canonicalizes property order", async () => {
    const f = await fixture();
    try {
      const b = await f.store.createUser({
        email: "b@example.test",
        displayName: "B",
        passwordHash: "test",
      });
      const operation = mutationOperation({ "idempotency-key": "key" }, "workout.create", workout)!;
      const [aWorkout, bWorkout] = await Promise.all([
        f.store.createWorkoutSession(f.user.user.id, workout, operation),
        f.store.createWorkoutSession(b.id, workout, operation),
      ]);
      expect(aWorkout.id).not.toBe(bWorkout.id);
      expect(
        mutationOperation({ "idempotency-key": "key" }, "post.create", { a: 1, b: 2 })?.requestHash,
      ).toBe(
        mutationOperation({ "idempotency-key": "key" }, "post.create", { b: 2, a: 1 })?.requestHash,
      );
    } finally {
      await f.app.close();
    }
  });
  it("PostgreSQL claim uses a separate locked read after a unique-key collision", async () => {
    const operation = mutationOperation({ "idempotency-key": "key" }, "workout.create", workout)!;
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({
        rows: [{ request_hash: operation.requestHash, resource_id: "existing" }],
      });
    expect(await claimOperation({ query } as unknown as PoolClient, "owner", operation)).toBe(
      "existing",
    );
    expect(query.mock.calls[0]![0]).toContain("ON CONFLICT DO NOTHING");
    expect(query.mock.calls[1]![0]).toContain("FOR UPDATE");
  });
});
it("account deletion invalidates an in-flight post and its ledger", async () => {
  const f = await fixture();
  const workoutSessionId = await postWorkoutId(f.store, f.user.user.id);
  let release!: () => void, started!: () => void;
  const reached = new Promise<void>((r) => {
    started = r;
  });
  vi.spyOn(f.store, "listSharingCrews").mockImplementation(async () => {
    started();
    await new Promise<void>((r) => {
      release = r;
    });
    return [];
  });
  const operation = mutationOperation({ "idempotency-key": "delete-race" }, "post.create", {
    sport: "running",
    content: "race",
    workoutSessionId,
  });
  const pending = f.store.createPost(
    f.user.user.id,
    "owner",
    { sport: "running", content: "race", workoutSessionId },
    operation,
  );
  const rejected = expect(pending).rejects.toMatchObject({ code: "AUTH_INVALID" });
  await reached;
  await f.store.deleteUserAccount(f.user.user.id);
  release();
  await rejected;
  expect(await f.store.listFeed()).toEqual([]);
  await f.app.close();
});
