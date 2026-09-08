import { describe, expect, it, vi } from "vitest";
import { MemoryStore } from "../src/infrastructure/memory-store.js";
import { ExpoPushSender } from "../src/infrastructure/push-sender.js";
async function fixture() {
  const store = new MemoryStore();
  const user = await store.createUser({
    email: "push@example.test",
    passwordHash: "test",
    displayName: "푸시 테스트",
  });
  const session = () =>
    store.createAuthSession({
      userId: user.id,
      refreshTokenHash: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 60000).toISOString(),
    });
  return { store, user, session };
}
describe("push devices belong to active login sessions", () => {
  it("revokes only the requested session, preserving the other device", async () => {
    const { store, user, session } = await fixture();
    const a = await session(),
      b = await session();
    await store.registerPushDevice(user.id, a.id, {
      token: "ExponentPushToken[first]",
      platform: "ios",
    });
    await store.registerPushDevice(user.id, b.id, {
      token: "ExponentPushToken[second]",
      platform: "android",
    });
    await store.revokeAuthSession(a.id);
    expect(await store.listPushDeviceTokens(user.id)).toEqual(["ExponentPushToken[second]"]);
    await expect(
      store.registerPushDevice(user.id, a.id, {
        token: "ExponentPushToken[first]",
        platform: "ios",
      }),
    ).rejects.toMatchObject({ code: "AUTH_SESSION_EXPIRED" });
  });
  it("old-session cleanup cannot delete a token registered by a newer session", async () => {
    const { store, user, session } = await fixture();
    const a = await session(),
      b = await session(),
      input = { token: "ExponentPushToken[same]", platform: "ios" as const };
    await store.registerPushDevice(user.id, a.id, input);
    await store.registerPushDevice(user.id, b.id, input);
    await expect(store.registerPushDevice(user.id, a.id, input)).rejects.toMatchObject({
      code: "PUSH_DEVICE_NEWER_SESSION",
    });
    await store.unregisterPushDevice(user.id, a.id, input.token);
    await store.revokeAuthSession(a.id);
    expect(await store.listPushDeviceTokens(user.id)).toEqual([input.token]);
    await store.updatePassword(user.id, "changed");
    expect(await store.listPushDeviceTokens(user.id)).toEqual([]);
  });
  it("expired or foreign sessions cannot register or receive notifications", async () => {
    const { store, user, session } = await fixture();
    const a = await session();
    const input = { token: "ExponentPushToken[expired]", platform: "ios" as const };
    await expect(store.registerPushDevice("other-user", a.id, input)).rejects.toMatchObject({
      code: "AUTH_SESSION_EXPIRED",
    });
    await store.registerPushDevice(user.id, a.id, input);
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 120000);
    try {
      expect(await store.listPushDeviceTokens(user.id)).toEqual([]);
    } finally {
      vi.restoreAllMocks();
    }
  });
  it("external OS notifications never contain private message content", async () => {
    const send = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", send);
    try {
      await new ExpoPushSender().send(
        ["ExponentPushToken[x]"],
        {
          id: crypto.randomUUID(),
          kind: "message",
          title: "private sender",
          body: "private health detail",
          createdAt: new Date().toISOString(),
        },
        "recipient",
      );
      const payload = JSON.parse(send.mock.calls[0]![1].body)[0];
      expect(payload.body).not.toContain("private");
      expect(payload.title).toBe("GROOV");
      expect(payload.data).toEqual({
        notificationId: expect.any(String),
        recipientUserId: "recipient",
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
it("a disabled newest-device binding still rejects delayed older-session registration", async () => {
  const { store, user, session } = await fixture(),
    a = await session(),
    b = await session();
  const input = { token: "ExponentPushToken[fence]", platform: "ios" as const };
  await store.registerPushDevice(user.id, a.id, input);
  await store.registerPushDevice(user.id, b.id, input);
  await store.unregisterPushDevice(user.id, b.id, input.token);
  await expect(store.registerPushDevice(user.id, a.id, input)).rejects.toMatchObject({
    code: "PUSH_DEVICE_NEWER_SESSION",
  });
  expect(await store.listPushDeviceTokens(user.id)).toEqual([]);
});
