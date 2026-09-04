import { afterEach, describe, expect, it, vi } from "vitest";
import { PostCreateInputSchema, storyIsActive, type PostAudience } from "@moveall/contracts";
import { MemoryStore } from "../src/infrastructure/memory-store.js";
import { createApp } from "../src/app.js";

afterEach(() => vi.useRealTimers());

async function fixture() {
  const store = new MemoryStore();
  const users = await Promise.all(
    ["owner", "follower", "mutual", "outsider"].map((name) =>
      store.createUser({
        email: `${name}@audiences.test`,
        displayName: name,
        passwordHash: "test-only",
      }),
    ),
  );
  const [owner, follower, mutual, outsider] = users as [
    (typeof users)[number],
    (typeof users)[number],
    (typeof users)[number],
    (typeof users)[number],
  ];
  await store.followUser(follower.id, owner.id);
  await store.followUser(mutual.id, owner.id);
  await store.followUser(owner.id, mutual.id);
  const publish = (
    audience: PostAudience,
    commentAudience: PostAudience = { scope: "public" },
    contentType: "post" | "story" = "post",
  ) =>
    store.createPost(owner.id, owner.displayName, {
      sport: "running",
      content: "나의 기록",
      audience,
      commentAudience,
      contentType,
    });
  return { store, owner, follower, mutual, outsider, publish };
}

describe("post audience enforcement", () => {
  it("protects HTTP detail endpoints and returns a validation error for unowned crews", async () => {
    const store = new MemoryStore();
    const app = await createApp({
      store,
      config: {
        nodeEnv: "test",
        host: "127.0.0.1",
        port: 3000,
        dataStore: "memory",
        databaseMaxConnections: 5,
        databaseSsl: false,
        authSecret: "test-only-secret-at-least-thirty-two-characters",
        googleClientIds: [],
        appleClientIds: [],
        adminEmails: [],
        devAuthBypass: false,
        mediaStorage: "disabled",
        supabaseMediaBucket: "groov-media",
        corsOrigins: [],
      },
    });
    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/auth/register",
        payload: {
          email: "api@audiences.test",
          password: "test-secure-1234",
          displayName: "작성자",
        },
      });
      expect(response.statusCode).toBe(201);
      const account = response.json().data;
      const headers = { authorization: `Bearer ${account.accessToken}` };
      const created = await app.inject({
        method: "POST",
        url: "/v1/posts",
        headers,
        payload: {
          content: "나만 보는 기록",
          sport: "running",
          audience: { scope: "private" },
          commentAudience: { scope: "none" },
        },
      });
      expect(created.statusCode).toBe(201);
      const post = created.json().data;
      expect((await app.inject({ method: "GET", url: `/v1/posts/${post.id}` })).statusCode).toBe(
        404,
      );
      expect(
        (await app.inject({ method: "GET", url: `/v1/posts/${post.id}`, headers })).json().data
          .canComment,
      ).toBe(false);
      const invalid = await app.inject({
        method: "POST",
        url: "/v1/posts",
        headers,
        payload: {
          content: "크루 기록",
          sport: "running",
          audience: { scope: "crews", crewIds: ["e94be392-bcbf-44dc-93bb-1e7edeea56cb"] },
        },
      });
      expect(invalid.statusCode).toBe(400);
      expect(invalid.json().error.code).toBe("CREW_NOT_FOUND");
    } finally {
      await app.close();
    }
  });
  it.each([
    ["public", [true, true, true, true]],
    ["followers", [true, true, true, false]],
    ["mutuals", [true, false, true, false]],
    ["private", [true, false, false, false]],
  ] as const)("enforces %s on feed, direct lookup and member posts", async (scope, allowed) => {
    const { store, owner, follower, mutual, outsider, publish } = await fixture();
    const post = (await publish({ scope }))!;
    for (const [index, viewer] of [owner, follower, mutual, outsider].entries()) {
      expect((await store.listFeed(viewer.id, post.id)).length > 0).toBe(allowed[index]);
      expect((await store.listPostsByUser(owner.id, viewer.id)).length > 0).toBe(allowed[index]);
      expect(Boolean(await store.setPostLiked(viewer.id, post.id, true))).toBe(allowed[index]);
    }
    expect((await store.listFeed(undefined, post.id)).length).toBe(scope === "public" ? 1 : 0);
  });

  it("supports multiple selected users while keeping recipient lists private", async () => {
    const { store, owner, follower, mutual, outsider, publish } = await fixture();
    const post = (await publish({ scope: "users", userIds: [follower.id, mutual.id] }))!;
    expect(post.audience?.userIds).toEqual([follower.id, mutual.id]);
    for (const viewer of [follower, mutual]) {
      const view = (await store.listFeed(viewer.id, post.id))[0]!;
      expect(view.audience).toEqual({ scope: "users" });
    }
    expect(await store.listFeed(outsider.id, post.id)).toHaveLength(0);
    expect(
      (await store.updatePost(owner.id, post.id, { content: "고친 기록" }))?.audience?.userIds,
    ).toHaveLength(2);
  });

  it("separates visibility from comments, including comment OFF for the author", async () => {
    const { store, owner, follower, outsider, publish } = await fixture();
    const post = (await publish({ scope: "public" }, { scope: "followers" }))!;
    expect((await store.listFeed(outsider.id, post.id))[0]?.canComment).toBe(false);
    expect((await store.listFeed(follower.id, post.id))[0]?.canComment).toBe(true);
    expect(
      await store.createComment(outsider.id, outsider.displayName, post.id, "댓글"),
    ).toBeNull();
    expect(
      await store.createComment(follower.id, follower.displayName, post.id, "댓글"),
    ).not.toBeNull();
    const closed = (await publish({ scope: "public" }, { scope: "none" }))!;
    expect((await store.listFeed(owner.id, closed.id))[0]?.canComment).toBe(false);
    expect(await store.createComment(owner.id, owner.displayName, closed.id, "댓글")).toBeNull();
  });

  it("resolves multiple owned crews on the server and rejects another owner's crew", async () => {
    const { store, owner, follower, mutual, outsider, publish } = await fixture();
    const a = (await store.createSharingCrew(owner.id, {
      name: "러닝 친구",
      memberIds: [follower.id],
    }))!;
    const b = (await store.createSharingCrew(owner.id, {
      name: "운동 친구",
      memberIds: [mutual.id],
    }))!;
    const post = (await publish({
      scope: "crews",
      crewIds: [a.id, b.id],
      userIds: [outsider.id],
    }))!;
    expect(post.audience?.userIds).toEqual([follower.id, mutual.id]);
    expect(await store.listFeed(outsider.id, post.id)).toHaveLength(0);
    expect(await store.listSharingCrews(follower.id)).toHaveLength(0);
    await expect(
      store.createPost(follower.id, follower.displayName, {
        content: "글",
        sport: "running",
        audience: { scope: "crews", crewIds: [a.id] },
      }),
    ).rejects.toThrow();
    await store.deleteUserAccount(follower.id);
    expect((await store.listSharingCrews(owner.id))[0]?.memberIds).toEqual([]);
  });

  it("never bypasses post audiences through Tap shares or message previews", async () => {
    const { store, owner, follower, outsider, publish } = await fixture();
    const post = (await publish({ scope: "followers" }))!;
    await store.followUser(owner.id, follower.id);
    await store.followUser(owner.id, outsider.id);
    expect(await store.sharePost(owner.id, post.id, [outsider.id])).toBeNull();
    expect(await store.sharePost(owner.id, post.id, [follower.id])).not.toBeNull();
    expect(
      (await store.listMessages(follower.id, owner.id)).some(
        (message) => message.sharedPost?.id === post.id,
      ),
    ).toBe(true);
    await store.unfollowUser(follower.id, owner.id);
    expect(
      (await store.listMessages(follower.id, owner.id)).every((message) => !message.sharedPost),
    ).toBe(true);
  });

  it("expires stories at exactly 24 hours without deleting the underlying record", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-03T00:00:00Z"));
    const { store, owner, follower, publish } = await fixture();
    const post = (await publish({ scope: "public" }, { scope: "public" }, "story"))!;
    expect(post.expiresAt).toBe("2026-09-04T00:00:00.000Z");
    vi.advanceTimersByTime(86_400_000 - 1);
    expect(await store.listFeed(follower.id, post.id)).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(await store.listFeed(follower.id, post.id)).toHaveLength(0);
    expect(
      await store.createComment(follower.id, follower.displayName, post.id, "댓글"),
    ).toBeNull();
    expect(await store.setPostLiked(follower.id, post.id, true)).toBeNull();
    expect(await store.updatePost(owner.id, post.id, { content: "보관된 스토리" })).not.toBeNull();
    expect(storyIsActive({ contentType: "post", createdAt: post.createdAt })).toBe(true);
  });

  it("rejects empty targeted audiences and none as post visibility", () => {
    const input = { content: "운동 기록", sport: "running" };
    for (const scope of ["users", "crews", "none"])
      expect(PostCreateInputSchema.safeParse({ ...input, audience: { scope } }).success).toBe(
        false,
      );
    expect(
      PostCreateInputSchema.safeParse({ ...input, commentAudience: { scope: "none" } }).success,
    ).toBe(true);
  });
});
