import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { PostgresStore } from "../src/infrastructure/postgres-store.js";
import { mutationOperation } from "../src/domain/mutation-operation.js";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { postWorkoutId } from "./post-fixture.js";
const testUrl = process.env.GROOV_TEST_PG_URL;
const suite = testUrl ? describe : describe.skip;
suite("actual isolated PostgreSQL regression", () => {
  let admin: Pool, pool: Pool, store: PostgresStore;
  const database = "groov_regression_" + randomUUID().replaceAll("-", "");
  const userInput = () => ({
    email: `${randomUUID()}@example.test`,
    displayName: "검증",
    passwordHash: "local-test-not-a-password",
  });
  const workout = {
    sport: "running" as const,
    startedAt: "2026-09-08T00:00:00Z",
    endedAt: "2026-09-08T00:30:00Z",
    perceivedExertion: 5,
    metrics: { durationMinutes: 30, distanceKm: 5 },
    source: "manual" as const,
  };
  beforeAll(async () => {
    const url = new URL(testUrl!);
    if (
      url.hostname !== "127.0.0.1" ||
      url.port !== "55439" ||
      url.pathname !== "/postgres" ||
      url.username !== "groov_regression"
    )
      throw Error("Not the isolated regression server");
    admin = new Pool({ connectionString: testUrl, ssl: false });
    const check = (
      await admin.query(
        "SELECT current_setting('data_directory') AS path,inet_server_port() AS port,inet_server_addr()::text AS address",
      )
    ).rows[0];
    expect(check.path.replaceAll("\\", "/").toLowerCase()).toBe(
      process.env.GROOV_TEST_PG_DATA!.toLowerCase(),
    );
    expect(check.port).toBe(55439);
    expect(check.address).toBe("127.0.0.1/32");
    await admin.query(`CREATE DATABASE ${database}`);
    for (const role of ["anon", "authenticated"])
      if (!(await admin.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [role])).rowCount)
        await admin.query(`CREATE ROLE ${role} NOLOGIN NOSUPERUSER NOBYPASSRLS`);
    url.pathname = "/" + database;
    pool = new Pool({ connectionString: url.href, ssl: false });
    const directory = resolve(import.meta.dirname, "../db/migrations");
    await pool.query(
      "CREATE TABLE schema_migrations(name text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())",
    );
    const files = (await readdir(directory)).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(await readFile(resolve(directory, file), "utf8"));
        await client.query("INSERT INTO schema_migrations(name) VALUES($1)", [file]);
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    }
    expect(
      (await pool.query("SELECT count(*)::int AS count FROM schema_migrations")).rows[0].count,
    ).toBe(files.length);
    await pool.query(
      "INSERT INTO sports(id,label,safety_level) VALUES ('running','러닝','standard'),('cycling','사이클','standard'),('hiking','등산','heightened'),('swimming','수영','heightened'),('strength','근력 운동','standard'),('diving','다이빙','heightened')",
    );
    store = new PostgresStore(url.href, { ssl: false, maxConnections: 10 });
  }, 30000);
  afterAll(async () => {
    await store?.close();
    await pool?.end();
    if (admin) {
      await admin.query(`DROP DATABASE IF EXISTS ${database}`);
      await admin.end();
    }
  });
  it("denies public client roles on server-only state", async () => {
    for (const table of [
      "sharing_crews",
      "push_devices",
      "mutation_operations",
      "user_restrictions",
      "social_privacy",
      "post_likes",
    ]) {
      const row = (
        await pool.query(
          "SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid=$1::regclass",
          [table],
        )
      ).rows[0];
      expect(row).toEqual({ relrowsecurity: true, relforcerowsecurity: true });
      for (const role of ["anon", "authenticated"])
        for (const permission of ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES"])
          expect(
            (
              await pool.query("SELECT has_table_privilege($1,$2,$3) AS allowed", [
                role,
                table,
                permission,
              ])
            ).rows[0].allowed,
          ).toBe(false);
    }
  });
  it("ten concurrent workout retries create one record and one ledger; deletion remains deleted", async () => {
    const user = await store.createUser(userInput());
    await store.saveOnboarding(user.id, {
      primarySports: ["running"],
      activityLevel: "steady",
      goals: ["performance"],
      neighborhood: {
        neighborhood: "쌍문동",
        district: "도봉구",
        province: "서울",
        regionCode: "kr:seoul:dobong",
        latitude: 37.65,
        longitude: 127.03,
        verifiedAt: "2026-09-07T00:00:00.000Z",
      },
    });
    const operation = mutationOperation(
      { "idempotency-key": "workout-1" },
      "workout.create",
      workout,
    )!;
    const rows = await Promise.all(
      Array.from({ length: 10 }, () => store.createWorkoutSession(user.id, workout, operation)),
    );
    expect(new Set(rows.map((r) => r.id)).size).toBe(1);
    expect(await store.listWorkoutSessions(user.id)).toHaveLength(1);
    expect(
      (
        await pool.query(
          "SELECT count(*)::int AS count FROM league_workout_points WHERE user_id=$1",
          [user.id],
        )
      ).rows[0].count,
    ).toBe(1);
    expect(
      (
        await pool.query(
          "SELECT count(*)::int AS count FROM mutation_operations WHERE user_id=$1",
          [user.id],
        )
      ).rows[0].count,
    ).toBe(1);
    await expect(
      store.createWorkoutSession(
        user.id,
        { ...workout, notes: "changed" },
        mutationOperation({ "idempotency-key": "workout-1" }, "workout.create", {
          ...workout,
          notes: "changed",
        }),
      ),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_KEY_REUSED" });
    await store.deleteWorkoutSession(user.id, rows[0]!.id);
    await expect(store.createWorkoutSession(user.id, workout, operation)).rejects.toMatchObject({
      code: "SAVED_RESOURCE_DELETED",
    });
  });
  it("post retries are atomic; failed references roll back ledger", async () => {
    const user = await store.createUser(userInput()),
      input = {
        sport: "running" as const,
        content: "one publication",
        workoutSessionId: await postWorkoutId(store, user.id),
      };
    const op = mutationOperation({ "idempotency-key": "post-1" }, "post.create", input)!;
    const posts = await Promise.all(
      Array.from({ length: 8 }, () => store.createPost(user.id, user.displayName, input, op)),
    );
    expect(new Set(posts.map((p) => p!.id)).size).toBe(1);
    await store.setPostArchived(user.id, posts[0]!.id, true);
    expect((await store.createPost(user.id, user.displayName, input, op))!.id).toBe(posts[0]!.id);
    const bad = { ...input, workoutSessionId: randomUUID() };
    expect(
      await store.createPost(
        user.id,
        user.displayName,
        bad,
        mutationOperation({ "idempotency-key": "bad-reference" }, "post.create", bad),
      ),
    ).toBeNull();
    expect(
      (
        await pool.query(
          "SELECT 1 FROM mutation_operations WHERE user_id=$1 AND operation_key='bad-reference'",
          [user.id],
        )
      ).rowCount,
    ).toBe(0);
    await store.deletePost(user.id, posts[0]!.id);
    await expect(store.createPost(user.id, user.displayName, input, op)).rejects.toMatchObject({
      code: "SAVED_RESOURCE_DELETED",
    });
  });
  it("refresh rotation has exactly one winner and revocation blocks all later rotation", async () => {
    const user = await store.createUser(userInput()),
      expiresAt = new Date(Date.now() + 3600000).toISOString();
    const session = await store.createAuthSession({
      userId: user.id,
      refreshTokenHash: randomUUID(),
      expiresAt,
    });
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        store.rotateAuthSession({
          sessionId: session.id,
          previousRefreshTokenHash: session.refreshTokenHash,
          refreshTokenHash: randomUUID(),
          expiresAt,
        }),
      ),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
    const winner = results.find(Boolean)!;
    await store.revokeAuthSession(session.id);
    expect(
      await store.rotateAuthSession({
        sessionId: session.id,
        previousRefreshTokenHash: winner.refreshTokenHash,
        refreshTokenHash: randomUUID(),
        expiresAt,
      }),
    ).toBeNull();
  });
  it("SQL visibility filters before pagination and respects followers/blocks/story expiry", async () => {
    const author = await store.createUser(userInput()),
      viewer = await store.createUser(userInput());
    const publicPost = await store.createPost(author.id, author.displayName, {
      sport: "running",
      content: "older visible",
      workoutSessionId: await postWorkoutId(store, author.id),
    });
    await pool.query(
      "INSERT INTO posts(user_id,sport,content,audience) SELECT $1,'running','hidden', '{\"scope\":\"private\"}'::jsonb FROM generate_series(1,120)",
      [author.id],
    );
    expect((await store.listFeed(viewer.id)).some((p) => p.id === publicPost!.id)).toBe(true);
    const followers = await store.createPost(author.id, author.displayName, {
      sport: "running",
      content: "followers",
      workoutSessionId: publicPost!.workoutSessionId!,
      audience: { scope: "followers", userIds: [], crewIds: [] },
    });
    expect(await store.listFeed(viewer.id, followers!.id)).toHaveLength(0);
    await pool.query("INSERT INTO follows(follower_id,following_id) VALUES($1,$2)", [
      viewer.id,
      author.id,
    ]);
    expect(await store.listFeed(viewer.id, followers!.id)).toHaveLength(1);
    await pool.query("INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)", [
      author.id,
      viewer.id,
    ]);
    expect(await store.listFeed(viewer.id, publicPost!.id)).toHaveLength(0);
    const story = await store.createPost(viewer.id, viewer.displayName, {
      sport: "running",
      content: "expired",
      contentType: "story",
    });
    await pool.query("UPDATE posts SET created_at=now()-interval '25 hours' WHERE id=$1", [
      story!.id,
    ]);
    expect(await store.listFeed(viewer.id, story!.id)).toHaveLength(0);
  });
  it("API login, follow, comments, likes and stored workouts survive a new store connection", async () => {
    const app = await createApp({
      store,
      config: loadConfig({
        NODE_ENV: "test",
        AUTH_SECRET: "isolated-postgres-test-secret-not-production",
      }),
    });
    const registration = {
      email: randomUUID() + "@example.test",
      displayName: "UI 검증",
      password: "test-password-only-12345",
    };
    const response = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: registration,
    });
    expect(response.statusCode).toBe(201);
    const session = response.json().data,
      headers = { authorization: `Bearer ${session.accessToken}` };
    const workoutSessionId = await postWorkoutId(store, session.user.id);
    const post = await app.inject({
      method: "POST",
      url: "/v1/posts",
      headers: { ...headers, "idempotency-key": "api-post" },
      payload: { sport: "running", content: "persistent post", workoutSessionId },
    });
    expect(post.statusCode).toBe(201);
    const comment = await app.inject({
      method: "POST",
      url: `/v1/posts/${post.json().data.id}/comments`,
      headers,
      payload: { content: "persisted comment" },
    });
    expect(comment.statusCode).toBe(201);
    const login = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email: registration.email, password: registration.password },
    });
    expect(login.statusCode).toBe(200);
    const feed = await store.listFeed(session.user.id, post.json().data.id);
    expect(feed[0]!.comments).toHaveLength(1);
    const peer = await store.createUser(userInput());
    await store.followUser(session.user.id, peer.id);
    await store.setPostLiked(peer.id, post.json().data.id, true);
    const connection = new URL(testUrl!);
    connection.pathname = "/" + database;
    const reconnected = new PostgresStore(connection.href, { ssl: false, maxConnections: 2 });
    try {
      expect(await reconnected.isFollowing(session.user.id, peer.id)).toBe(true);
      expect((await reconnected.listFeed(peer.id, post.json().data.id))[0]!.likedByMe).toBe(true);
      expect(await reconnected.listWorkoutSessions(session.user.id)).toHaveLength(1);
    } finally {
      await reconnected.close();
    }
    // createApp.close owns store.close; leave this shared test store to afterAll.
  });
  it("a removed crew never prevents replay of an already committed publication", async () => {
    const author = await store.createUser(userInput()),
      member = await store.createUser(userInput());
    const crew = await store.createSharingCrew(author.id, {
      name: "test crew",
      memberIds: [member.id],
    });
    const input = {
      sport: "running" as const,
      content: "crew post",
      workoutSessionId: await postWorkoutId(store, author.id),
      audience: { scope: "crews" as const, crewIds: [crew!.id] },
    };
    const operation = mutationOperation(
      { "idempotency-key": "crew-replay" },
      "post.create",
      input,
    )!;
    const post = await store.createPost(author.id, author.displayName, input, operation);
    await pool.query("DELETE FROM sharing_crews WHERE id=$1", [crew!.id]);
    expect((await store.createPost(author.id, author.displayName, input, operation))!.id).toBe(
      post!.id,
    );
    await expect(
      store.createPost(
        author.id,
        author.displayName,
        input,
        mutationOperation({ "idempotency-key": "new-bad-crew" }, "post.create", input),
      ),
    ).rejects.toMatchObject({ code: "POST_INPUT_NOT_CREATED" });
  });
  it("push cleanup and revocation cannot move a device back to an older session", async () => {
    const a = await store.createUser(userInput()),
      b = await store.createUser(userInput());
    const expiresAt = new Date(Date.now() + 3600000).toISOString();
    const older = await store.createAuthSession({
      userId: a.id,
      refreshTokenHash: randomUUID(),
      expiresAt,
    });
    const newer = await store.createAuthSession({
      userId: b.id,
      refreshTokenHash: randomUUID(),
      expiresAt,
    });
    await pool.query("UPDATE auth_sessions SET created_at=now()-interval '1 hour' WHERE id=$1", [
      older.id,
    ]);
    const device = {
      token: "ExponentPushToken[" + randomUUID() + "]",
      platform: "android" as const,
    };
    await store.registerPushDevice(a.id, older.id, device);
    await store.registerPushDevice(b.id, newer.id, device);
    await store.unregisterPushDevice(a.id, older.id, device.token);
    expect(await store.listPushDeviceTokens(b.id)).toEqual([device.token]);
    await store.revokeAuthSession(newer.id);
    expect(await store.listPushDeviceTokens(b.id)).toEqual([]);
    await expect(store.registerPushDevice(a.id, older.id, device)).rejects.toMatchObject({
      code: "PUSH_DEVICE_NEWER_SESSION",
    });
    await store.deleteUserAccount(a.id);
    await store.deleteUserAccount(b.id);
  });
  it("shared cards are batch-filtered with the exact feed visibility policy", async () => {
    const a = await store.createUser(userInput()),
      b = await store.createUser(userInput());
    await store.followUser(a.id, b.id);
    const publicPost = await store.createPost(a.id, a.displayName, {
      sport: "running",
      content: "shared public",
      workoutSessionId: await postWorkoutId(store, a.id),
    });
    await store.sharePost(a.id, publicPost!.id, [b.id]);
    expect(
      (await store.listMessages(b.id, a.id)).some((m) => m.sharedPost?.id === publicPost!.id),
    ).toBe(true);
    await pool.query('UPDATE posts SET audience=\'{"scope":"private"}\'::jsonb WHERE id=$1', [
      publicPost!.id,
    ]);
    expect((await store.listMessages(b.id, a.id)).every((m) => !m.sharedPost)).toBe(true);
  });
});
