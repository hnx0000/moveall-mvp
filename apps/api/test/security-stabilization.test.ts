import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { MemoryStore } from "../src/infrastructure/memory-store.js";

const testConfig = () =>
  loadConfig({
    NODE_ENV: "test",
    AUTH_SECRET: "isolated-security-test-secret-at-least-32",
    ADMIN_EMAILS: "operator@example.test",
  });
const registration = {
  email: "operator@example.test",
  displayName: "테스트 운영자",
  password: "only-for-tests-1234",
};

describe("stabilization: explicit administrator identity", () => {
  it("never grants permissions or report notifications from an unverified email", async () => {
    const store = new MemoryStore();
    const app = await createApp({ config: testConfig(), store });
    try {
      const result = await app.inject({
        method: "POST",
        url: "/v1/auth/register",
        payload: registration,
      });
      expect(result.statusCode).toBe(201);
      const account = result.json().data;
      const response = await app.inject({
        method: "GET",
        url: "/v1/admin/reports",
        headers: { authorization: `Bearer ${account.accessToken}` },
      });
      expect(response.statusCode).toBe(403);
    } finally {
      await app.close();
    }
  });

  it("keeps password signup available for development but prevents new unverified production signup", async () => {
    const store = new MemoryStore();
    const app = await createApp({ config: { ...testConfig(), nodeEnv: "production" }, store });
    try {
      const result = await app.inject({
        method: "POST",
        url: "/v1/auth/register",
        payload: registration,
      });
      expect(result.statusCode).toBe(403);
      expect(await store.findUserByEmail(registration.email)).toBeNull();
    } finally {
      await app.close();
    }
  });
});

describe("stabilization: OAuth account ownership", () => {
  it("rejects email-only linking without changing the password account", async () => {
    const store = new MemoryStore();
    const original = await store.createUser({ ...registration, passwordHash: "original-hash" });
    await expect(
      store.findOrCreateOAuthUser({
        provider: "google",
        subject: "verified-provider-user",
        email: registration.email,
        displayName: "실제 소유자",
      }),
    ).rejects.toMatchObject({ statusCode: 409, code: "OAUTH_ACCOUNT_LINK_REQUIRED" });
    expect((await store.findUserById(original.id))?.passwordHash).toBe("original-hash");
  });
  it("serializes concurrent first logins for one provider identity", async () => {
    const store = new MemoryStore();
    const identity = {
      provider: "google" as const,
      subject: "same-provider-user",
      email: "new@example.test",
      displayName: "새 사용자",
    };
    const [first, second] = await Promise.all([
      store.findOrCreateOAuthUser(identity),
      store.findOrCreateOAuthUser(identity),
    ]);
    expect(first.id).toBe(second.id);
    expect(first.passwordHash).toBeNull();
  });
});

it("allows only one concurrent refresh and keeps the winning token usable", async () => {
  const store = new MemoryStore();
  const app = await createApp({ config: testConfig(), store });
  try {
    const account = (
      await app.inject({ method: "POST", url: "/v1/auth/register", payload: registration })
    ).json().data;
    const original = store.findAuthSessionByRefreshTokenHash.bind(store);
    let arrivals = 0;
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const spy = vi
      .spyOn(store, "findAuthSessionByRefreshTokenHash")
      .mockImplementation(async (hash) => {
        const value = await original(hash);
        if (++arrivals === 2) release();
        await barrier;
        return value;
      });
    const requests = await Promise.all(
      [1, 2].map(() =>
        app.inject({
          method: "POST",
          url: "/v1/auth/refresh",
          payload: { refreshToken: account.refreshToken },
        }),
      ),
    );
    spy.mockRestore();
    expect(requests.map((result) => result.statusCode).sort()).toEqual([200, 401]);
    const winner = requests.find((result) => result.statusCode === 200)!;
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/v1/auth/refresh",
          payload: { refreshToken: winner.json().data.refreshToken },
        })
      ).statusCode,
    ).toBe(200);
  } finally {
    await app.close();
  }
});
