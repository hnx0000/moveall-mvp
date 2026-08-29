import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import type { AppConfig } from "../src/config.js";
import { MemoryStore } from "../src/infrastructure/memory-store.js";

const config: AppConfig = {
  nodeEnv: "test",
  host: "127.0.0.1",
  port: 3000,
  dataStore: "memory",
  authSecret: "test-secret-that-is-at-least-32-characters",
  googleClientIds: ["test-google-client.apps.googleusercontent.com"],
  devAuthBypass: false,
  corsOrigins: ["http://localhost:8081"],
};

describe("MoveAll API", () => {
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore();
  });

  it("responds to the health smoke test", async () => {
    const app = await createApp({ config, store });
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ ok: true, data: { status: "ok" } });
    await app.close();
  });

  it("registers, logs in, and creates a routine", async () => {
    const app = await createApp({ config, store });
    const registration = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        email: "runner@example.com",
        password: "very-secure-1234",
        displayName: "서울러너",
      },
    });

    expect(registration.statusCode).toBe(201);
    const token = registration.json().data.accessToken as string;

    const login = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email: "runner@example.com", password: "very-secure-1234" },
    });
    expect(login.statusCode).toBe(200);

    const routine = await app.inject({
      method: "POST",
      url: "/v1/routines",
      headers: { authorization: "Bearer " + token },
      payload: {
        title: "첫 5K 준비",
        sport: "running",
        daysOfWeek: [2, 4, 6],
        items: [{ name: "이지 런", target: "30분 대화 가능한 강도", order: 0 }],
      },
    });

    expect(routine.statusCode).toBe(201);
    expect(routine.json()).toMatchObject({
      ok: true,
      data: { title: "첫 5K 준비", sport: "running" },
    });
    await app.close();
  });

  it("updates, reorders, and deletes only the current user's routines", async () => {
    const app = await createApp({ config, store });
    const registration = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        email: "routine-manager@example.com",
        password: "very-secure-1234",
        displayName: "루틴관리자",
      },
    });
    const headers = {
      authorization: "Bearer " + (registration.json().data.accessToken as string),
    };
    const base = {
      sport: "strength",
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      items: [{ name: "스쿼트", target: "10회", order: 0 }],
    };
    const first = await app.inject({
      method: "POST",
      url: "/v1/routines",
      headers,
      payload: { ...base, title: "첫 루틴" },
    });
    const second = await app.inject({
      method: "POST",
      url: "/v1/routines",
      headers,
      payload: { ...base, title: "둘째 루틴", sport: "swimming" },
    });
    const firstId = first.json().data.id as string;
    const secondId = second.json().data.id as string;

    const updated = await app.inject({
      method: "PATCH",
      url: `/v1/routines/${firstId}`,
      headers,
      payload: { ...base, title: "수정한 첫 루틴", sport: "diving" },
    });
    expect(updated.json()).toMatchObject({
      ok: true,
      data: { title: "수정한 첫 루틴", sport: "diving" },
    });

    const reordered = await app.inject({
      method: "PUT",
      url: "/v1/routines/order",
      headers,
      payload: { routineIds: [firstId, secondId] },
    });
    expect(reordered.json().data.map((routine: { id: string }) => routine.id)).toEqual([
      firstId,
      secondId,
    ]);

    expect(
      (
        await app.inject({
          method: "DELETE",
          url: `/v1/routines/${firstId}`,
          headers,
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: "PATCH",
          url: `/v1/routines/${firstId}`,
          headers,
          payload: { ...base, title: "없는 루틴" },
        })
      ).statusCode,
    ).toBe(404);
    await app.close();
  });

  it("verifies a Google identity, persists the account, and validates the session", async () => {
    const app = await createApp({
      config,
      store,
      googleTokenVerifier: async (_idToken, clientIds) => {
        expect(clientIds).toEqual(config.googleClientIds);
        return {
          subject: "google-subject-123",
          email: "runner@gmail.com",
          displayName: "구글 러너",
        };
      },
    });
    const login = await app.inject({
      method: "POST",
      url: "/v1/auth/google",
      payload: { idToken: "x".repeat(120) },
    });
    expect(login.statusCode).toBe(200);
    const token = login.json().data.accessToken as string;

    const me = await app.inject({
      method: "GET",
      url: "/v1/auth/me",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({
      ok: true,
      data: { email: "runner@gmail.com", displayName: "구글 러너" },
    });
    await app.close();
  });

  it("issues a server-verified session only when the development bypass is enabled", async () => {
    const app = await createApp({
      config: { ...config, nodeEnv: "development", devAuthBypass: true },
      store,
    });
    const login = await app.inject({ method: "POST", url: "/v1/auth/development" });
    expect(login.statusCode).toBe(200);
    expect(login.json()).toMatchObject({
      ok: true,
      data: { user: { email: "developer@moveall.dev", displayName: "MOVE 개발자" } },
    });

    const me = await app.inject({
      method: "GET",
      url: "/v1/auth/me",
      headers: { authorization: `Bearer ${login.json().data.accessToken as string}` },
    });
    expect(me.statusCode).toBe(200);

    const headers = { authorization: `Bearer ${login.json().data.accessToken as string}` };
    const [workouts, routines, posts, social] = await Promise.all([
      app.inject({ method: "GET", url: "/v1/workout-sessions/me", headers }),
      app.inject({ method: "GET", url: "/v1/routines/me", headers }),
      app.inject({ method: "GET", url: "/v1/posts/me", headers }),
      app.inject({ method: "GET", url: "/v1/social/me", headers }),
    ]);
    expect(workouts.json().data).toHaveLength(3);
    expect(routines.json().data).toHaveLength(3);
    expect(posts.json().data).toHaveLength(3);
    expect(social.json().data).toMatchObject({ followersCount: 3, followingCount: 3 });

    const invalidNickname = await app.inject({
      method: "PATCH",
      url: "/v1/users/me/profile",
      headers,
      payload: { displayName: "moveall_official" },
    });
    expect(invalidNickname.statusCode).toBe(400);
    const updatedProfile = await app.inject({
      method: "PATCH",
      url: "/v1/users/me/profile",
      headers,
      payload: { displayName: "move.runner_01" },
    });
    expect(updatedProfile.json()).toMatchObject({
      ok: true,
      data: { displayName: "move.runner_01" },
    });

    const postId = posts.json().data[0].id as string;
    const archived = await app.inject({
      method: "POST",
      url: `/v1/posts/${postId}/archive`,
      headers,
    });
    expect(archived.statusCode).toBe(200);
    expect(
      (await app.inject({ method: "GET", url: "/v1/posts/me/archive", headers })).json().data,
    ).toHaveLength(1);

    const restored = await app.inject({
      method: "DELETE",
      url: `/v1/posts/${postId}/archive`,
      headers,
    });
    expect(restored.statusCode).toBe(200);
    const edited = await app.inject({
      method: "PATCH",
      url: `/v1/posts/${postId}`,
      headers,
      payload: { content: "수정한 운동 인증 기록" },
    });
    expect(edited.json()).toMatchObject({
      ok: true,
      data: { content: "수정한 운동 인증 기록" },
    });

    const friendId = social.json().data.followers[0].id as string;
    const message = await app.inject({
      method: "POST",
      url: `/v1/messages/${friendId}`,
      headers,
      payload: { content: "다음 운동도 같이 해요." },
    });
    expect(message.statusCode).toBe(201);
    expect(
      (await app.inject({ method: "GET", url: `/v1/messages/${friendId}`, headers })).json().data,
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ content: "다음 운동도 같이 해요." })]),
    );

    const blocked = await app.inject({
      method: "POST",
      url: `/v1/users/${friendId}/block`,
      headers,
    });
    expect(blocked.statusCode).toBe(200);
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/v1/messages/${friendId}`,
          headers,
          payload: { content: "차단 이후에는 전송되지 않아야 합니다." },
        })
      ).statusCode,
    ).toBe(400);
    await app.close();
  });

  it("stores workouts, earns sport medals, and follows another user", async () => {
    const app = await createApp({ config, store });
    const first = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: { email: "first@example.com", password: "very-secure-1234", displayName: "첫 러너" },
    });
    const second = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        email: "second@example.com",
        password: "very-secure-1234",
        displayName: "둘째 러너",
      },
    });
    const token = first.json().data.accessToken as string;
    const secondId = second.json().data.user.id as string;

    const workout = await app.inject({
      method: "POST",
      url: "/v1/workout-sessions",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        sport: "running",
        startedAt: "2026-08-25T01:00:00.000Z",
        endedAt: "2026-08-25T01:30:00.000Z",
        perceivedExertion: 5,
        metrics: { distanceKm: 5.24 },
        source: "manual",
      },
    });
    expect(workout.statusCode).toBe(201);

    const medals = await app.inject({
      method: "GET",
      url: "/v1/medals/me",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(medals.json().data).toContainEqual(
      expect.objectContaining({ id: "running-1", earned: true, progress: 1 }),
    );

    const follow = await app.inject({
      method: "POST",
      url: `/v1/users/${secondId}/follow`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(follow.statusCode).toBe(201);
    const social = await app.inject({
      method: "GET",
      url: "/v1/social/me",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(social.json()).toMatchObject({
      ok: true,
      data: { followingCount: 1, following: [{ id: secondId, displayName: "둘째 러너" }] },
    });
    await app.close();
  });

  it("rejects protected routes without authentication", async () => {
    const app = await createApp({ config, store });
    const response = await app.inject({
      method: "POST",
      url: "/v1/routines",
      payload: {},
    });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      ok: false,
      error: { code: "AUTH_REQUIRED" },
    });
    await app.close();
  });

  it("rejects a post linked to an unknown workout session", async () => {
    const app = await createApp({ config, store });
    const registration = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        email: "owner@example.com",
        password: "very-secure-1234",
        displayName: "기록주인",
      },
    });
    const token = registration.json().data.accessToken as string;

    const response = await app.inject({
      method: "POST",
      url: "/v1/posts",
      headers: { authorization: "Bearer " + token },
      payload: {
        sport: "running",
        content: "내 기록과 연결되지 않은 게시물",
        workoutSessionId: "f928f020-3a90-4f99-892d-422cac210478",
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({
      ok: false,
      error: { code: "WORKOUT_NOT_FOUND" },
    });
    await app.close();
  });

  it("lists knowledge and stores situational feedback", async () => {
    const app = await createApp({ config, store });
    const registration = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        email: "feedback@example.com",
        password: "very-secure-1234",
        displayName: "상황공유자",
      },
    });
    const token = registration.json().data.accessToken as string;

    const knowledge = await app.inject({ method: "GET", url: "/v1/knowledge/running" });
    expect(knowledge.statusCode).toBe(200);
    expect(knowledge.json().data).toHaveLength(2);

    const feedback = await app.inject({
      method: "POST",
      url: "/v1/knowledge/running-easy-start/feedback",
      headers: { authorization: "Bearer " + token },
      payload: {
        content: "걷기와 달리기를 번갈아 시작하니 부담을 조절하기 쉬웠어요.",
        context: "러닝 입문 · 주 2회",
      },
    });
    expect(feedback.statusCode).toBe(201);

    const updated = await app.inject({ method: "GET", url: "/v1/knowledge/running" });
    expect(updated.json().data[0].feedback).toMatchObject([
      { authorDisplayName: "상황공유자", context: "러닝 입문 · 주 2회" },
    ]);
    await app.close();
  });

  it("rejects feedback for an unknown knowledge article", async () => {
    const app = await createApp({ config, store });
    const registration = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        email: "unknown-article@example.com",
        password: "very-secure-1234",
        displayName: "검증사용자",
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/knowledge/not-an-article/feedback",
      headers: { authorization: "Bearer " + (registration.json().data.accessToken as string) },
      payload: { content: "존재하지 않는 글에 대한 피드백" },
    });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({
      ok: false,
      error: { code: "ARTICLE_NOT_FOUND" },
    });
    await app.close();
  });
});
