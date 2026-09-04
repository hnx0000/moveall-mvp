import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import type { AppConfig } from "../src/config.js";
import { MemoryStore } from "../src/infrastructure/memory-store.js";

const config: AppConfig = {
  nodeEnv: "test",
  host: "127.0.0.1",
  port: 3000,
  dataStore: "memory",
  databaseMaxConnections: 5,
  databaseSsl: false,
  authSecret: "test-secret-that-is-at-least-32-characters",
  googleClientIds: ["test-google-client.apps.googleusercontent.com"],
  appleClientIds: ["com.longrun0000.groov"],
  adminEmails: ["admin@groov.test"],
  devAuthBypass: false,
  mediaStorage: "disabled",
  supabaseMediaBucket: "groov-media",
  corsOrigins: ["http://localhost:8081"],
};

describe("GROOV API", () => {
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore();
  });

  async function commentFixture() {
    const app = await createApp({ config, store });
    const accounts = await Promise.all(
      ["owner", "reader"].map(async (name) => {
        const response = await app.inject({
          method: "POST",
          url: "/v1/auth/register",
          payload: {
            email: `${name}@comments.test`,
            password: "very-secure-1234",
            displayName: name,
          },
        });
        const account = response.json().data as {
          accessToken: string;
          user: { id: string; displayName: string };
        };
        return { ...account, headers: { authorization: `Bearer ${account.accessToken}` } };
      }),
    );
    const owner = accounts[0]!;
    const reader = accounts[1]!;
    const post = (await store.createPost(owner.user.id, owner.user.displayName, {
      sport: "running",
      content: "오늘의 러닝",
    }))!;
    return { app, owner, reader, post, url: `/v1/posts/${post.id}/comments` };
  }

  it("ranks real shares and delivers persisted likes, comments, mentions and Tap Talk notifications", async () => {
    const { app, owner, reader, post } = await commentFixture();
    await store.followUser(reader.user.id, owner.user.id);
    const likeUrl = `/v1/posts/${post.id}/like`;
    const first = await app.inject({ method: "PUT", url: likeUrl, headers: reader.headers });
    expect(first.json().data).toMatchObject({ liked: true, changed: true, likeCount: 1 });
    const repeated = await app.inject({ method: "PUT", url: likeUrl, headers: reader.headers });
    expect(repeated.json().data).toMatchObject({ changed: false, likeCount: 1 });
    expect(
      (await store.listNotifications(owner.user.id)).filter((item) => item.kind === "like"),
    ).toHaveLength(1);
    expect((await store.listFeed(reader.user.id, post.id))[0]?.likedByMe).toBe(true);
    await app.inject({ method: "DELETE", url: likeUrl, headers: reader.headers });
    expect((await store.listFeed(reader.user.id, post.id))[0]?.likeCount).toBe(0);
    const tag = `@${owner.user.displayName}`;
    const comment = await app.inject({
      method: "POST",
      url: `/v1/posts/${post.id}/comments`,
      headers: reader.headers,
      payload: {
        content: `${tag} 멋져요`,
        mentions: [
          { userId: owner.user.id, displayName: owner.user.displayName, start: 0, end: tag.length },
        ],
      },
    });
    expect(comment.statusCode).toBe(201);
    expect(comment.json().data.mentions[0].userId).toBe(owner.user.id);
    expect((await store.listFeed(reader.user.id, post.id))[0]?.comments[0]?.mentions).toHaveLength(
      1,
    );
    expect(
      (await store.listNotifications(owner.user.id)).filter((item) => item.kind === "mention"),
    ).toHaveLength(1);
    const plain = await app.inject({
      method: "POST",
      url: `/v1/posts/${post.id}/comments`,
      headers: reader.headers,
      payload: { content: "좋은 운동이에요" },
    });
    expect(plain.statusCode).toBe(201);
    expect(
      (await store.listNotifications(owner.user.id)).some((item) => item.kind === "comment"),
    ).toBe(true);
    const shareUrl = `/v1/posts/${post.id}/share`;
    await app.inject({
      method: "POST",
      url: shareUrl,
      headers: reader.headers,
      payload: { recipientIds: [owner.user.id] },
    });
    await app.inject({
      method: "POST",
      url: shareUrl,
      headers: reader.headers,
      payload: { recipientIds: [owner.user.id] },
    });
    expect((await store.shareFrequency(reader.user.id))[0]?.count).toBe(1);
    const suggestions = await app.inject({
      method: "GET",
      url: "/v1/social/suggestions",
      headers: reader.headers,
    });
    expect(suggestions.json().data.frequentIds).toEqual([owner.user.id]);
    expect(
      (await store.listNotifications(owner.user.id)).filter((item) => item.kind === "share"),
    ).toHaveLength(1);
    const notification = (await store.listNotifications(owner.user.id))[0]!;
    const message = await app.inject({
      method: "POST",
      url: `/v1/messages/${owner.user.id}`,
      headers: reader.headers,
      payload: { content: "공유한 운동 같이 해봐요" },
    });
    expect(message.statusCode).toBe(201);
    expect(
      (await store.listNotifications(owner.user.id)).some(
        (item) => item.kind === "message" && item.resourceId === reader.user.id,
      ),
    ).toBe(true);
    await store.markNotificationRead(owner.user.id, notification.id);
    expect(
      (await store.listNotifications(owner.user.id)).find((item) => item.id === notification.id)
        ?.readAt,
    ).toBeTruthy();
    await store.unfollowUser(reader.user.id, owner.user.id);
    expect(
      (
        await app.inject({ method: "GET", url: "/v1/social/suggestions", headers: reader.headers })
      ).json().data.people,
    ).toEqual([]);
    const invalid = await app.inject({
      method: "POST",
      url: `/v1/posts/${post.id}/comments`,
      headers: reader.headers,
      payload: {
        content: tag,
        mentions: [
          { userId: owner.user.id, displayName: owner.user.displayName, start: 0, end: tag.length },
        ],
      },
    });
    expect(invalid.statusCode).toBe(400);
    await app.close();
  });

  it("keeps restrictions silent, preserves follows, and hides content and relationship lists", async () => {
    const { app, owner, reader, post } = await commentFixture();
    await store.followUser(reader.user.id, owner.user.id);
    await store.followUser(owner.user.id, reader.user.id);
    await store.createWorkoutSession(owner.user.id, {
      source: "manual",
      sport: "running",
      startedAt: "2026-09-03T00:00:00Z",
      endedAt: "2026-09-03T01:00:00Z",
      perceivedExertion: 5,
      metrics: { distanceKm: 5 },
    });
    const change = await app.inject({
      method: "PUT",
      url: `/v1/users/${reader.user.id}/restriction`,
      headers: owner.headers,
    });
    expect(change.statusCode).toBe(200);
    expect(await store.isFollowing(reader.user.id, owner.user.id)).toBe(true);
    expect(await store.isFollowing(owner.user.id, reader.user.id)).toBe(true);
    expect(await store.listNotifications(reader.user.id)).toEqual([]);
    const hidden = await app.inject({
      method: "GET",
      url: `/v1/users/${owner.user.id}/profile`,
      headers: reader.headers,
    });
    expect(hidden.json().data).toMatchObject({ posts: [], workouts: [], medals: [] });
    expect(hidden.json().data).not.toHaveProperty("restricted");
    const connections = await app.inject({
      method: "GET",
      url: `/v1/users/${owner.user.id}/connections`,
      headers: reader.headers,
    });
    expect(connections.json().data).toMatchObject({
      followersHidden: true,
      followingHidden: true,
      followers: [],
      following: [],
    });
    expect(await store.listFeed(reader.user.id, post.id)).toEqual([]);
    expect(await store.listFeed(undefined, post.id)).toEqual([]);
    expect(await store.createComment(reader.user.id, "reader", post.id, "hidden")).toBeNull();
    const safety = await app.inject({
      method: "GET",
      url: "/v1/social/safety",
      headers: owner.headers,
    });
    expect(safety.json().data.restricted.map((user: { id: string }) => user.id)).toEqual([
      reader.user.id,
    ]);
    await app.inject({
      method: "DELETE",
      url: `/v1/users/${reader.user.id}/restriction`,
      headers: owner.headers,
    });
    expect((await store.listFeed(reader.user.id, post.id)).length).toBe(1);
    const privateLists = await app.inject({
      method: "PUT",
      url: "/v1/social/privacy",
      headers: owner.headers,
      payload: { hideFollowers: true, hideFollowing: false },
    });
    expect(privateLists.statusCode).toBe(200);
    const lists = await app.inject({
      method: "GET",
      url: `/v1/users/${owner.user.id}/connections`,
      headers: reader.headers,
    });
    expect(lists.json().data).toMatchObject({
      followersHidden: true,
      followingHidden: false,
      followers: [],
    });
    expect(lists.json().data.following).toHaveLength(1);
    expect((await store.listFeed(reader.user.id, post.id)).length).toBe(1);
    await app.inject({
      method: "POST",
      url: `/v1/users/${reader.user.id}/block`,
      headers: owner.headers,
    });
    expect(await store.isFollowing(reader.user.id, owner.user.id)).toBe(false);
    expect(await store.listPostsByUser(owner.user.id, reader.user.id)).toEqual([]);
    expect((await store.safetySummary(owner.user.id)).blocked).toHaveLength(1);
    await app.inject({
      method: "DELETE",
      url: `/v1/users/${reader.user.id}/block`,
      headers: owner.headers,
    });
    expect((await store.safetySummary(owner.user.id)).blocked).toHaveLength(0);
    expect(await store.isFollowing(reader.user.id, owner.user.id)).toBe(false);
    await app.close();
  });

  it("keeps raw workout GPS private while preserving routes through saves and edits", async () => {
    const { app, owner, reader } = await commentFixture();
    const routePoints = [
      { latitude: 37.5, longitude: 127, timestamp: 1000, accuracy: 5, altitude: 10 },
      { latitude: 37.501, longitude: 127.001, timestamp: 5000, breakBefore: true },
    ];
    const created = await app.inject({
      method: "POST",
      url: "/v1/workout-sessions",
      headers: owner.headers,
      payload: {
        sport: "running",
        startedAt: "2026-09-03T00:00:00Z",
        endedAt: "2026-09-03T01:00:00Z",
        perceivedExertion: 5,
        metrics: { distanceKm: 2 },
        routePoints,
      },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().data.routePoints).toEqual(routePoints);
    const id = created.json().data.id;
    const own = await app.inject({
      method: "GET",
      url: "/v1/workout-sessions/me",
      headers: owner.headers,
    });
    expect(own.json().data[0].routePoints).toEqual(routePoints);
    const other = await app.inject({
      method: "GET",
      url: `/v1/users/${owner.user.id}/profile`,
      headers: reader.headers,
    });
    expect(other.statusCode).toBe(200);
    expect(other.json().data.workouts[0]).not.toHaveProperty("routePoints");
    const edited = await app.inject({
      method: "PATCH",
      url: `/v1/workout-sessions/${id}`,
      headers: owner.headers,
      payload: { notes: "경로 그대로" },
    });
    expect(edited.json().data.routePoints).toEqual(routePoints);
    const denied = await app.inject({
      method: "PATCH",
      url: `/v1/workout-sessions/${id}`,
      headers: reader.headers,
      payload: { notes: "다른 계정" },
    });
    expect(denied.statusCode).toBe(404);
    const malformed = await app.inject({
      method: "POST",
      url: "/v1/workout-sessions",
      headers: owner.headers,
      payload: {
        sport: "running",
        startedAt: "2026-09-03T00:00:00Z",
        endedAt: "2026-09-03T01:00:00Z",
        perceivedExertion: 5,
        routePoints: [{ latitude: 90, longitude: 127, timestamp: 0 }],
      },
    });
    expect(malformed.statusCode).toBe(400);
    await app.close();
  });

  it("stores threaded replies and idempotent viewer-specific comment likes", async () => {
    const { app, owner, reader, post, url } = await commentFixture();
    const root = await app.inject({
      method: "POST",
      url,
      headers: owner.headers,
      payload: { content: "함께 달려요" },
    });
    expect(root.statusCode).toBe(201);
    expect(root.json().data).toMatchObject({ likeCount: 0, likedByMe: false });
    const parentCommentId = root.json().data.id as string;
    const response = await app.inject({
      method: "POST",
      url,
      headers: reader.headers,
      payload: { content: "좋아요!", parentCommentId },
    });
    expect(response.statusCode).toBe(201);
    const replyId = response.json().data.id as string;
    expect(response.json().data.parentCommentId).toBe(parentCommentId);
    for (const id of [parentCommentId, replyId]) {
      for (let attempt = 0; attempt < 2; attempt++) {
        const like = await app.inject({
          method: "PUT",
          url: `${url}/${id}/like`,
          headers: reader.headers,
        });
        expect(like.json().data).toMatchObject({ id, likeCount: 1, likedByMe: true });
      }
      await app.inject({ method: "PUT", url: `${url}/${id}/like`, headers: owner.headers });
      const ownFeed = await store.listFeed(reader.user.id, post.id);
      expect(ownFeed[0]!.comments.find((comment) => comment.id === id)).toMatchObject({
        likeCount: 2,
        likedByMe: true,
      });
      expect(
        (await store.listFeed(undefined, post.id))[0]!.comments.find(
          (comment) => comment.id === id,
        ),
      ).toMatchObject({ likeCount: 2, likedByMe: false });
      for (let attempt = 0; attempt < 2; attempt++) {
        const unlike = await app.inject({
          method: "DELETE",
          url: `${url}/${id}/like`,
          headers: reader.headers,
        });
        expect(unlike.json().data).toMatchObject({ likeCount: 1, likedByMe: false });
      }
    }
    await app.close();
  });

  it("rejects unsigned actions, mismatched parents and deeper reply nesting", async () => {
    const { app, owner, reader, url } = await commentFixture();
    const root = (
      await app.inject({
        method: "POST",
        url,
        headers: owner.headers,
        payload: { content: "댓글" },
      })
    ).json().data;
    const reply = (
      await app.inject({
        method: "POST",
        url,
        headers: reader.headers,
        payload: { content: "답글", parentCommentId: root.id },
      })
    ).json().data;
    expect(
      (await app.inject({ method: "POST", url, payload: { content: "무단 댓글" } })).statusCode,
    ).toBe(401);
    expect((await app.inject({ method: "PUT", url: `${url}/${root.id}/like` })).statusCode).toBe(
      401,
    );
    const another = (await store.createPost(owner.user.id, "owner", {
      sport: "running",
      content: "다른 게시물",
    }))!;
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/v1/posts/${another.id}/comments`,
          headers: reader.headers,
          payload: { content: "잘못된 연결", parentCommentId: root.id },
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: "PUT",
          url: `/v1/posts/${another.id}/comments/${root.id}/like`,
          headers: reader.headers,
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: "POST",
          url,
          headers: reader.headers,
          payload: { content: "더 깊은 답글", parentCommentId: reply.id },
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: "POST",
          url,
          headers: reader.headers,
          payload: { content: "잘못된 ID", parentCommentId: "bad" },
        })
      ).statusCode,
    ).toBe(400);
    await app.close();
  });

  it("hides blocked threads and rejects likes/replies on archived or blocked content", async () => {
    const { app, owner, reader, post, url } = await commentFixture();
    const root = (await store.createComment(reader.user.id, "reader", post.id, "원 댓글"))!;
    const reply = (await store.createComment(owner.user.id, "owner", post.id, "답글", root.id))!;
    await store.blockUser(owner.user.id, reader.user.id);
    expect((await store.listFeed(owner.user.id, post.id))[0]!.comments).toEqual([]);
    expect(await store.setCommentLiked(owner.user.id, post.id, root.id, true)).toBeNull();
    expect(await store.setCommentLiked(owner.user.id, post.id, reply.id, true)).toBeNull();
    expect(
      (
        await app.inject({
          method: "POST",
          url,
          headers: reader.headers,
          payload: { content: "차단 우회" },
        })
      ).statusCode,
    ).toBe(404);
    expect(
      await store.createComment(owner.user.id, "owner", post.id, "차단 댓글 답글", root.id),
    ).toBeNull();
    const ownRoot = (await store.createComment(owner.user.id, "owner", post.id, "보관 전"))!;
    await store.setPostArchived(owner.user.id, post.id, true);
    expect(
      (
        await app.inject({
          method: "POST",
          url,
          headers: owner.headers,
          payload: { content: "보관 우회" },
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: "PUT",
          url: `${url}/${ownRoot.id}/like`,
          headers: owner.headers,
        })
      ).statusCode,
    ).toBe(404);
    await app.close();
  });

  it("deletes only the owner's post, removing threads/shares but keeping the workout", async () => {
    const { app, owner, reader } = await commentFixture();
    const workout = await store.createWorkoutSession(owner.user.id, {
      sport: "running",
      startedAt: "2026-09-03T01:00:00Z",
      endedAt: "2026-09-03T01:30:00Z",
      source: "manual",
      perceivedExertion: 5,
      metrics: { distanceKm: 5 },
    });
    const post = (await store.createPost(owner.user.id, "owner", {
      sport: "running",
      content: "삭제 테스트",
      workoutSessionId: workout.id,
    }))!;
    const comment = (await store.createComment(reader.user.id, "reader", post.id, "댓글"))!;
    await store.createComment(owner.user.id, "owner", post.id, "답글", comment.id);
    await store.setCommentLiked(owner.user.id, post.id, comment.id, true);
    await store.followUser(owner.user.id, reader.user.id);
    await store.sharePost(owner.user.id, post.id, [reader.user.id]);
    const url = `/v1/posts/${post.id}`;
    expect((await app.inject({ method: "DELETE", url })).statusCode).toBe(401);
    expect((await app.inject({ method: "DELETE", url, headers: reader.headers })).statusCode).toBe(
      404,
    );
    expect(await store.listFeed(owner.user.id, post.id)).toHaveLength(1);
    expect(
      (await app.inject({ method: "DELETE", url, headers: owner.headers })).json(),
    ).toMatchObject({ data: { deleted: true } });
    expect(await store.listFeed(owner.user.id, post.id)).toEqual([]);
    expect(await store.listMessages(owner.user.id, reader.user.id)).toEqual([]);
    expect(await store.setCommentLiked(reader.user.id, post.id, comment.id, true)).toBeNull();
    expect((await app.inject({ method: "GET", url, headers: reader.headers })).statusCode).toBe(
      404,
    );
    expect(await store.listWorkoutSessions(owner.user.id)).toContainEqual(
      expect.objectContaining({ id: workout.id }),
    );
    await app.close();
  });

  it("responds to the health smoke test", async () => {
    const app = await createApp({ config, store });
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ ok: true, data: { status: "ok" } });
    await app.close();
  });

  it("reports database readiness separately from process health", async () => {
    const app = await createApp({ config, store });
    const response = await app.inject({ method: "GET", url: "/ready" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      data: { status: "ready", database: "connected" },
    });
    await app.close();
  });

  it("persists a compact onboarding profile for the signed-in account", async () => {
    const app = await createApp({ config, store });
    const registration = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        email: "onboarding@example.com",
        password: "very-secure-1234",
        displayName: "온보딩러너",
      },
    });
    const token = registration.json().data.accessToken as string;

    const empty = await app.inject({
      method: "GET",
      url: "/v1/users/me/onboarding",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(empty.json().data).toBeNull();

    const saved = await app.inject({
      method: "PUT",
      url: "/v1/users/me/onboarding",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        primarySports: ["running", "strength"],
        activityLevel: "steady",
        goals: ["consistency", "performance"],
        neighborhood: {
          neighborhood: "쌍문동",
          latitude: 37.651234,
          longitude: 127.034567,
          verifiedAt: "2026-09-02T07:00:00.000Z",
        },
      },
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().data).toMatchObject({
      primarySports: ["running", "strength"],
      activityLevel: "steady",
      goals: ["consistency", "performance"],
      neighborhood: { neighborhood: "쌍문동", latitude: 37.65, longitude: 127.03 },
    });

    const restored = await app.inject({
      method: "GET",
      url: "/v1/users/me/onboarding",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(restored.json().data.completedAt).toEqual(expect.any(String));

    const weightManagement = await app.inject({
      method: "PUT",
      url: "/v1/users/me/onboarding",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        primarySports: ["running"],
        activityLevel: "steady",
        goals: ["consistency", "weight_management"],
      },
    });
    expect(weightManagement.statusCode).toBe(200);
    const updated = await app.inject({
      method: "GET",
      url: "/v1/users/me/onboarding",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(updated.json().data.goals).toEqual(["consistency", "weight_management"]);
    await app.close();
  });

  it("allows browser clients to call mutating API methods", async () => {
    const app = await createApp({ config, store });
    const response = await app.inject({
      method: "OPTIONS",
      url: "/v1/workout-sessions/test-session",
      headers: {
        origin: "http://localhost:8081",
        "access-control-request-method": "DELETE",
        "access-control-request-headers": "authorization,content-type",
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-methods"]).toContain("DELETE");
    expect(response.headers["access-control-allow-methods"]).toContain("PATCH");
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

  it("verifies an Apple identity and links it to a GROOV account", async () => {
    const app = await createApp({
      config,
      store,
      appleTokenVerifier: async (_identityToken, clientIds) => {
        expect(clientIds).toEqual(config.appleClientIds);
        return {
          subject: "apple-subject-123",
          email: "runner@privaterelay.appleid.com",
        };
      },
    });
    const login = await app.inject({
      method: "POST",
      url: "/v1/auth/apple",
      payload: {
        identityToken: "a".repeat(120),
        email: "runner@privaterelay.appleid.com",
        displayName: "애플 러너",
      },
    });
    expect(login.statusCode).toBe(200);
    expect(login.json()).toMatchObject({
      ok: true,
      data: { user: { email: "runner@privaterelay.appleid.com", displayName: "애플 러너" } },
    });
    await app.close();
  });

  it("exchanges Kakao and Naver authorization codes for GROOV sessions", async () => {
    const app = await createApp({
      config: {
        ...config,
        kakaoRestApiKey: "test-kakao-rest-api-key",
        naverClientId: "test-naver-client-id",
        naverClientSecret: "test-naver-client-secret",
      },
      store,
      kakaoCodeExchanger: async (input, clientId) => {
        expect(input.redirectUri).toBe("groov://oauthredirect");
        expect(clientId).toBe("test-kakao-rest-api-key");
        return {
          subject: "kakao-user-1",
          email: "kakao@groov.test",
          displayName: "카카오 러너",
        };
      },
      naverCodeExchanger: async (input, clientId, clientSecret) => {
        expect(input.state).toBe("naver-state-1234");
        expect(clientId).toBe("test-naver-client-id");
        expect(clientSecret).toBe("test-naver-client-secret");
        return {
          subject: "naver-user-1",
          email: "naver@groov.test",
          displayName: "네이버 러너",
        };
      },
    });

    const kakao = await app.inject({
      method: "POST",
      url: "/v1/auth/kakao",
      payload: {
        code: "kakao-authorization-code",
        redirectUri: "groov://oauthredirect",
      },
    });
    expect(kakao.statusCode).toBe(200);
    expect(kakao.json()).toMatchObject({
      ok: true,
      data: { user: { email: "kakao@groov.test", displayName: "카카오 러너" } },
    });

    const naver = await app.inject({
      method: "POST",
      url: "/v1/auth/naver",
      payload: {
        code: "naver-authorization-code",
        redirectUri: "groov://oauthredirect",
        state: "naver-state-1234",
      },
    });
    expect(naver.statusCode).toBe(200);
    expect(naver.json()).toMatchObject({
      ok: true,
      data: { user: { email: "naver@groov.test", displayName: "네이버 러너" } },
    });
    await app.close();
  });

  it("accepts reports, limits the moderation queue to admins, and delivers status notifications", async () => {
    const app = await createApp({ config, store });
    const reporter = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        email: "reporter@groov.test",
        password: "very-secure-1234",
        displayName: "신고테스터",
      },
    });
    const admin = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        email: "admin@groov.test",
        password: "very-secure-1234",
        displayName: "운영테스터",
      },
    });
    const reporterHeaders = {
      authorization: `Bearer ${reporter.json().data.accessToken as string}`,
    };
    const adminHeaders = { authorization: `Bearer ${admin.json().data.accessToken as string}` };
    const created = await app.inject({
      method: "POST",
      url: "/v1/reports",
      headers: reporterHeaders,
      payload: {
        targetType: "user",
        targetId: "demo-user",
        reason: "harassment",
        details: "반복적인 괴롭힘 메시지",
      },
    });
    expect(created.statusCode).toBe(201);
    expect(
      (await app.inject({ method: "GET", url: "/v1/admin/reports", headers: reporterHeaders }))
        .statusCode,
    ).toBe(403);
    const queue = await app.inject({
      method: "GET",
      url: "/v1/admin/reports",
      headers: adminHeaders,
    });
    expect(queue.json().data).toHaveLength(1);
    const updated = await app.inject({
      method: "PATCH",
      url: `/v1/admin/reports/${created.json().data.id as string}`,
      headers: adminHeaders,
      payload: { status: "resolved", resolutionNote: "계정 경고 완료" },
    });
    expect(updated.json()).toMatchObject({ ok: true, data: { status: "resolved" } });
    const notifications = await app.inject({
      method: "GET",
      url: "/v1/notifications",
      headers: reporterHeaders,
    });
    expect(notifications.json().data).toContainEqual(
      expect.objectContaining({ kind: "moderation", resourceType: "report" }),
    );
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
      data: { user: { email: "developer@groov.dev", displayName: "GROOV 개발자" } },
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
      payload: { displayName: "groov_official" },
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
    const secondToken = second.json().data.accessToken as string;

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
    const workoutId = workout.json().data.id as string;

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

    const post = await app.inject({
      method: "POST",
      url: "/v1/posts",
      headers: { authorization: `Bearer ${token}` },
      payload: { sport: "running", content: "#5K 오늘의 러닝 기록" },
    });
    const postId = post.json().data.id as string;
    const shared = await app.inject({
      method: "POST",
      url: `/v1/posts/${postId}/share`,
      headers: { authorization: `Bearer ${token}` },
      payload: { recipientIds: [secondId] },
    });
    expect(shared.statusCode).toBe(201);
    expect(shared.json()).toMatchObject({
      ok: true,
      data: { shareCount: 1, recipientCount: 1 },
    });
    const sharedMessages = await app.inject({
      method: "GET",
      url: `/v1/messages/${first.json().data.user.id as string}`,
      headers: { authorization: `Bearer ${secondToken}` },
    });
    expect(sharedMessages.json().data).toContainEqual(
      expect.objectContaining({
        senderId: first.json().data.user.id,
        recipientId: secondId,
        sharedPost: expect.objectContaining({ id: postId, content: "#5K 오늘의 러닝 기록" }),
      }),
    );
    const duplicateShare = await app.inject({
      method: "POST",
      url: `/v1/posts/${postId}/share`,
      headers: { authorization: `Bearer ${token}` },
      payload: { recipientIds: [secondId] },
    });
    expect(duplicateShare.json()).toMatchObject({ data: { shareCount: 1, recipientCount: 0 } });
    expect(
      (
        await app.inject({
          method: "GET",
          url: `/v1/messages/${first.json().data.user.id as string}`,
          headers: { authorization: `Bearer ${secondToken}` },
        })
      )
        .json()
        .data.filter((message: { sharedPost?: unknown }) => message.sharedPost !== undefined),
    ).toHaveLength(1);
    expect((await app.inject({ method: "GET", url: "/v1/feed" })).json().data).toContainEqual(
      expect.objectContaining({ id: postId, shareCount: 1 }),
    );

    const updatedWorkout = await app.inject({
      method: "PATCH",
      url: `/v1/workout-sessions/${workoutId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { notes: "기록 메모 수정 완료" },
    });
    expect(updatedWorkout.statusCode).toBe(200);
    expect(updatedWorkout.json()).toMatchObject({
      ok: true,
      data: { id: workoutId, notes: "기록 메모 수정 완료" },
    });

    const otherUserDelete = await app.inject({
      method: "DELETE",
      url: `/v1/workout-sessions/${workoutId}`,
      headers: { authorization: `Bearer ${secondToken}` },
    });
    expect(otherUserDelete.statusCode).toBe(404);

    const deletedWorkout = await app.inject({
      method: "DELETE",
      url: `/v1/workout-sessions/${workoutId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(deletedWorkout.statusCode).toBe(200);
    const remainingWorkouts = await app.inject({
      method: "GET",
      url: "/v1/workout-sessions/me",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(remainingWorkouts.json().data).toHaveLength(0);
    await app.close();
  });

  it("removes blocked users and their comments from the authenticated feed", async () => {
    const app = await createApp({ config, store });
    const author = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        email: "blocked-author@example.com",
        password: "very-secure-1234",
        displayName: "차단 대상",
      },
    });
    const viewer = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        email: "blocking-viewer@example.com",
        password: "very-secure-1234",
        displayName: "피드 사용자",
      },
    });
    const authorToken = author.json().data.accessToken as string;
    const authorId = author.json().data.user.id as string;
    const viewerToken = viewer.json().data.accessToken as string;
    const post = await app.inject({
      method: "POST",
      url: "/v1/posts",
      headers: { authorization: `Bearer ${authorToken}` },
      payload: { sport: "running", content: "차단 전 게시물" },
    });
    await app.inject({
      method: "POST",
      url: `/v1/users/${authorId}/block`,
      headers: { authorization: `Bearer ${viewerToken}` },
    });
    const feed = await app.inject({
      method: "GET",
      url: "/v1/feed",
      headers: { authorization: `Bearer ${viewerToken}` },
    });
    expect(feed.statusCode).toBe(200);
    expect(feed.json().data).not.toContainEqual(
      expect.objectContaining({ id: post.json().data.id }),
    );
    await app.close();
  });

  it("delivers shares only to selected following, rejects invalid recipients, and hides archived originals", async () => {
    const app = await createApp({ config, store });
    const accounts = await Promise.all(
      ["sender", "selected-a", "selected-b", "not-selected"].map(async (name) => {
        const response = await app.inject({
          method: "POST",
          url: "/v1/auth/register",
          payload: { email: `${name}@share.test`, password: "very-secure-1234", displayName: name },
        });
        expect(response.statusCode).toBe(201);
        return response.json().data as { user: { id: string }; accessToken: string };
      }),
    );
    const [sender, first, second, outsider] = accounts;
    const headers = { authorization: `Bearer ${sender!.accessToken}` };
    for (const peer of [first!, second!, outsider!])
      await store.followUser(sender!.user.id, peer.user.id);
    const post = await store.createPost(sender!.user.id, "sender", {
      sport: "cycling",
      content: "오늘의 라이딩을 공유합니다.",
    });
    if (!post) throw new Error("Expected shared post fixture");
    const endpoint = `/v1/posts/${post.id}/share`;
    expect(
      (
        await app.inject({
          method: "POST",
          url: endpoint,
          payload: { recipientIds: [first!.user.id] },
        })
      ).statusCode,
    ).toBe(401);
    for (const payload of [{}, { recipientIds: [] }]) {
      expect(
        (await app.inject({ method: "POST", url: endpoint, headers, payload })).statusCode,
      ).toBe(400);
    }
    const response = await app.inject({
      method: "POST",
      url: endpoint,
      headers,
      payload: { recipientIds: [first!.user.id, second!.user.id, first!.user.id] },
    });
    expect(response.json()).toMatchObject({ data: { recipientCount: 2, shareCount: 1 } });
    for (const peer of [first!, second!]) {
      const received = await app.inject({
        method: "GET",
        url: `/v1/messages/${sender!.user.id}`,
        headers: { authorization: `Bearer ${peer.accessToken}` },
      });
      expect(received.json().data).toEqual([
        expect.objectContaining({
          recipientId: peer.user.id,
          sharedPost: expect.objectContaining({ id: post.id }),
        }),
      ]);
      expect(await store.listNotifications(peer.user.id)).toContainEqual(
        expect.objectContaining({ kind: "share", actorId: sender!.user.id }),
      );
    }
    expect(await store.listMessages(outsider!.user.id, sender!.user.id)).toEqual([]);
    expect(await store.listNotifications(outsider!.user.id)).toEqual([]);
    expect(
      (await app.inject({ method: "GET", url: `/v1/posts/${post.id}`, headers })).json(),
    ).toMatchObject({ data: { id: post.id } });

    await store.unfollowUser(sender!.user.id, outsider!.user.id);
    const invalid = await app.inject({
      method: "POST",
      url: endpoint,
      headers,
      payload: { recipientIds: [first!.user.id, outsider!.user.id] },
    });
    expect(invalid.statusCode).toBe(400);
    expect(
      (
        await app.inject({
          method: "POST",
          url: endpoint,
          headers,
          payload: { recipientIds: [sender!.user.id] },
        })
      ).statusCode,
    ).toBe(400);

    await store.setPostArchived(sender!.user.id, post.id, true);
    expect(
      (await app.inject({ method: "GET", url: `/v1/posts/${post.id}`, headers })).statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: "POST",
          url: endpoint,
          headers,
          payload: { recipientIds: [second!.user.id] },
        })
      ).statusCode,
    ).toBe(404);
    expect(await store.listMessages(first!.user.id, sender!.user.id)).toEqual([
      expect.objectContaining({ sharedPost: null }),
    ]);
    await store.blockUser(first!.user.id, sender!.user.id);
    expect(await store.listMessages(first!.user.id, sender!.user.id)).toEqual([]);
    expect(
      (
        await app.inject({
          method: "POST",
          url: endpoint,
          headers,
          payload: { recipientIds: [first!.user.id] },
        })
      ).statusCode,
    ).toBe(400);
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

  it("reflects a changed profile photo on existing feed posts and comments", async () => {
    const app = await createApp({ config, store });
    const registration = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        email: "avatar@example.com",
        password: "very-secure-1234",
        displayName: "사진러너",
      },
    });
    const headers = {
      authorization: `Bearer ${registration.json().data.accessToken as string}`,
    };
    const post = await app.inject({
      method: "POST",
      url: "/v1/posts",
      headers,
      payload: { sport: "running", content: "프로필 사진 연동 테스트" },
    });
    const postId = post.json().data.id as string;
    await app.inject({
      method: "POST",
      url: `/v1/posts/${postId}/comments`,
      headers,
      payload: { content: "작성자 사진이 댓글에도 보여야 해요." },
    });
    const avatarDataUri = "data:image/png;base64,aGVsbG8=";
    await app.inject({
      method: "PATCH",
      url: "/v1/users/me/profile",
      headers,
      payload: { avatarDataUri },
    });

    const feed = await app.inject({ method: "GET", url: "/v1/feed" });
    expect(feed.json().data[0]).toMatchObject({
      authorAvatarDataUri: avatarDataUri,
      comments: [{ authorAvatarDataUri: avatarDataUri }],
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

  it("rotates refresh tokens and revokes the active session on logout", async () => {
    const app = await createApp({ config, store });
    const registration = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        email: "session@example.com",
        password: "very-secure-1234",
        displayName: "세션러너",
      },
    });
    const original = registration.json().data as {
      accessToken: string;
      refreshToken: string;
    };
    const refreshed = await app.inject({
      method: "POST",
      url: "/v1/auth/refresh",
      payload: { refreshToken: original.refreshToken },
    });
    expect(refreshed.statusCode).toBe(200);
    expect(refreshed.json().data.refreshToken).not.toBe(original.refreshToken);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/v1/auth/refresh",
          payload: { refreshToken: original.refreshToken },
        })
      ).statusCode,
    ).toBe(401);

    const accessToken = refreshed.json().data.accessToken as string;
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/v1/auth/logout",
          headers: { authorization: `Bearer ${accessToken}` },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/v1/auth/me",
          headers: { authorization: `Bearer ${accessToken}` },
        })
      ).statusCode,
    ).toBe(401);
    await app.close();
  });

  it("stores consent choices and permanently deletes the account", async () => {
    const app = await createApp({ config, store });
    const registration = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        email: "privacy@example.com",
        password: "very-secure-1234",
        displayName: "개인정보러너",
      },
    });
    const token = registration.json().data.accessToken as string;
    const headers = { authorization: `Bearer ${token}` };
    const consent = await app.inject({
      method: "PUT",
      url: "/v1/consents/me",
      headers,
      payload: {
        termsVersion: "2026-09-02",
        privacyVersion: "2026-09-02",
        termsAccepted: true,
        privacyAccepted: true,
        healthDataAccepted: true,
        locationAccepted: true,
        mediaAccepted: false,
        marketingAccepted: false,
      },
    });
    expect(consent.json()).toMatchObject({
      ok: true,
      data: { healthDataAccepted: true, mediaAccepted: false },
    });

    const deleted = await app.inject({
      method: "DELETE",
      url: "/v1/account",
      headers,
      payload: { confirmation: "GROOV 탈퇴", currentPassword: "very-secure-1234" },
    });
    expect(deleted.statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/v1/auth/me", headers })).statusCode).toBe(401);
    await app.close();
  });

  it("creates a server-scoped Supabase media upload ticket", async () => {
    const app = await createApp({
      config,
      store,
      mediaStorage: {
        provider: "supabase",
        bucket: "groov-media",
        createUploadTicket: async ({ userId, kind }) => ({
          objectPath: `${userId}/${kind}/photo.jpg`,
          signedUploadUrl: "https://storage.example/upload?token=signed",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        }),
        createDownloadUrl: async (objectPath) => `https://storage.example/${objectPath}`,
        inspectObject: async () => ({ contentType: "image/jpeg", byteSize: 2048 }),
        removeObject: async () => undefined,
      },
    });
    const registration = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        email: "media@example.com",
        password: "very-secure-1234",
        displayName: "미디어러너",
      },
    });
    const headers = {
      authorization: `Bearer ${registration.json().data.accessToken as string}`,
    };
    const ticket = await app.inject({
      method: "POST",
      url: "/v1/media/upload-ticket",
      headers,
      payload: { kind: "story-image", contentType: "image/jpeg", byteSize: 2048 },
    });
    expect(ticket.statusCode).toBe(201);
    expect(ticket.json()).toMatchObject({
      ok: true,
      data: {
        objectPath: expect.stringContaining("/story-image/"),
        signedUploadUrl: expect.stringContaining("token=signed"),
      },
    });
    const completed = await app.inject({
      method: "POST",
      url: `/v1/media/${ticket.json().data.mediaId as string}/complete`,
      headers,
    });
    expect(completed.json()).toMatchObject({ ok: true, data: { status: "available" } });
    const post = await app.inject({
      method: "POST",
      url: "/v1/posts",
      headers,
      payload: {
        sport: "running",
        content: "저장소 연결 테스트",
        mediaId: ticket.json().data.mediaId as string,
      },
    });
    expect(post.statusCode).toBe(201);
    expect(post.json()).toMatchObject({
      ok: true,
      data: {
        mediaId: ticket.json().data.mediaId,
        mediaUrl: expect.stringContaining("https://storage.example/"),
      },
    });
    const feed = await app.inject({ method: "GET", url: "/v1/feed" });
    expect(feed.json().data[0]).toMatchObject({
      mediaId: ticket.json().data.mediaId,
      mediaUrl: expect.stringContaining("https://storage.example/"),
    });
    await app.close();
  });

  it("registers a phone push token and delivers a social notification", async () => {
    const deliveries: Array<{ tokens: string[]; title: string }> = [];
    const app = await createApp({
      config,
      store,
      pushSender: {
        send: async (tokens, notification) => {
          deliveries.push({ tokens, title: notification.title });
        },
      },
    });
    const recipient = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        email: "push-recipient@example.com",
        password: "very-secure-1234",
        displayName: "푸시받는사람",
      },
    });
    const follower = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        email: "push-follower@example.com",
        password: "very-secure-1234",
        displayName: "푸시보내는사람",
      },
    });
    const recipientToken = recipient.json().data.accessToken as string;
    const recipientId = recipient.json().data.user.id as string;
    const pushToken = "ExponentPushToken[groov-test-device-123456789]";
    const registered = await app.inject({
      method: "PUT",
      url: "/v1/notifications/push-device",
      headers: { authorization: `Bearer ${recipientToken}` },
      payload: { token: pushToken, platform: "android", deviceName: "테스트폰" },
    });
    expect(registered.statusCode).toBe(200);

    const followed = await app.inject({
      method: "POST",
      url: `/v1/users/${recipientId}/follow`,
      headers: { authorization: `Bearer ${follower.json().data.accessToken as string}` },
    });
    expect(followed.statusCode).toBe(201);
    expect(deliveries).toEqual([{ tokens: [pushToken], title: "새 팔로워" }]);

    const unregistered = await app.inject({
      method: "DELETE",
      url: "/v1/notifications/push-device",
      headers: { authorization: `Bearer ${recipientToken}` },
      payload: { token: pushToken },
    });
    expect(unregistered.json()).toMatchObject({ ok: true, data: { unregistered: true } });
    expect(await store.listPushDeviceTokens(recipientId)).toEqual([]);
    await app.close();
  });
});
