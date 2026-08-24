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
