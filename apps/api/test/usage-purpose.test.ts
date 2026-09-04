import { afterEach, describe, expect, it, vi } from "vitest";
import { type OnboardingInput, usagePurposeValues } from "@moveall/contracts";
import { createApp } from "../src/app.js";
import { MemoryStore } from "../src/infrastructure/memory-store.js";

afterEach(() => vi.useRealTimers());
const settings: OnboardingInput = {
  primarySports: ["running"],
  activityLevel: "starter",
  goals: ["consistency"],
};
const createUser = (store: MemoryStore, name: string) =>
  store.createUser({
    email: `${name}@purpose.test`,
    displayName: name,
    passwordHash: "test-only",
  });

describe("stored signup intent", () => {
  it("stores each type once, preserving signup intent while other settings can change", async () => {
    const store = new MemoryStore();
    for (const usagePurpose of usagePurposeValues) {
      const user = await createUser(store, usagePurpose);
      const first = await store.saveOnboarding(user.id, { ...settings, usagePurpose });
      const later = await store.saveOnboarding(user.id, {
        ...settings,
        activityLevel: "advanced",
        usagePurpose: "social",
      });
      expect(later).toMatchObject({
        activityLevel: "advanced",
        usagePurpose,
        usagePurposeRecordedAt: first.usagePurposeRecordedAt,
        usagePurposeQuestionVersion: 1,
      });
      await store.saveOnboarding(user.id, settings);
      expect((await store.getOnboarding(user.id))?.usagePurpose).toBe(usagePurpose);
    }
    const summary = await store.usagePurposeSummary({}, []);
    expect(summary.respondents).toBe(4);
    expect(summary.distribution.map((row) => row.percent)).toEqual([25, 25, 25, 25]);
  });

  it("separates explicit skip, legacy onboarding and incomplete onboarding; deletes with account", async () => {
    const store = new MemoryStore();
    const skipped = await createUser(store, "skipped");
    const legacy = await createUser(store, "legacy");
    await createUser(store, "incomplete");
    await store.saveOnboarding(skipped.id, { ...settings, usagePurpose: null });
    await store.saveOnboarding(skipped.id, { ...settings, usagePurpose: "record" });
    await store.saveOnboarding(legacy.id, settings);
    expect((await store.getOnboarding(skipped.id))?.usagePurpose).toBeNull();
    expect(await store.getOnboarding(legacy.id)).not.toHaveProperty("usagePurposeRecordedAt");
    expect(await store.usagePurposeSummary({}, [])).toMatchObject({
      totalUsers: 3,
      respondents: 0,
      skipped: 1,
      uncollected: 2,
    });
    await store.deleteUserAccount(skipped.id);
    expect(await store.getOnboarding(skipped.id)).toBeNull();
    expect(await store.usagePurposeSummary({}, [])).toMatchObject({ totalUsers: 2, skipped: 0 });
  });

  it("uses registration time (inclusive start, exclusive end) and case-insensitive exclusions", async () => {
    vi.useFakeTimers();
    const store = new MemoryStore();
    vi.setSystemTime(new Date("2026-08-01T00:00:00Z"));
    const old = await createUser(store, "old");
    vi.setSystemTime(new Date("2026-09-01T00:00:00Z"));
    const start = await createUser(store, "start");
    await createUser(store, "operator");
    vi.setSystemTime(new Date("2026-10-01T00:00:00Z"));
    const end = await createUser(store, "end");
    // A late answer must not turn an old account into a new signup.
    for (const user of [old, start, end])
      await store.saveOnboarding(user.id, { ...settings, usagePurpose: "record" });
    const summary = await store.usagePurposeSummary(
      {
        registeredFrom: "2026-09-01T00:00:00Z",
        registeredBefore: "2026-10-01T00:00:00Z",
      },
      ["OPERATOR@PURPOSE.TEST"],
    );
    expect(summary).toMatchObject({ totalUsers: 1, respondents: 1, excludedUsers: 1 });
  });

  it("enforces administrator access and returns aggregates without account data over HTTP", async () => {
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
        adminEmails: ["admin@purpose.test"],
        devAuthBypass: false,
        mediaStorage: "disabled",
        supabaseMediaBucket: "groov-media",
        corsOrigins: [],
      },
    });
    try {
      const register = async (name: string) => {
        const response = await app.inject({
          method: "POST",
          url: "/v1/auth/register",
          payload: {
            email: `${name}@purpose.test`,
            password: "test-secure-1234",
            displayName: name,
          },
        });
        expect(response.statusCode).toBe(201);
        const data = response.json().data;
        return { headers: { authorization: `Bearer ${data.accessToken}` }, id: data.user.id };
      };
      const admin = await register("admin");
      const reader = await register("reader");
      const demo = await store.createUser({
        email: "minji@groov.demo",
        displayName: "데모",
        passwordHash: "test-only",
      });
      await store.saveOnboarding(admin.id, { ...settings, usagePurpose: "competition" });
      await store.saveOnboarding(demo.id, { ...settings, usagePurpose: "competition" });
      const url = "/v1/admin/usage-purposes";
      expect((await app.inject({ method: "GET", url })).statusCode).toBe(401);
      expect((await app.inject({ method: "GET", url, headers: reader.headers })).statusCode).toBe(
        403,
      );
      const saved = await app.inject({
        method: "PUT",
        url: "/v1/users/me/onboarding",
        headers: reader.headers,
        payload: { ...settings, usagePurpose: "achievement" },
      });
      expect(saved.statusCode).toBe(200);
      const restored = await app.inject({
        method: "GET",
        url: "/v1/users/me/onboarding",
        headers: reader.headers,
      });
      expect(restored.json().data.usagePurpose).toBe("achievement");
      const response = await app.inject({ method: "GET", url, headers: admin.headers });
      expect(response.statusCode).toBe(200);
      expect(response.headers["cache-control"]).toBe("private, no-store");
      expect(response.json().data).toMatchObject({
        totalUsers: 1,
        respondents: 1,
        excludedUsers: 2,
      });
      expect(response.body).not.toContain(reader.id);
      expect(response.body).not.toContain("@purpose.test");
      expect(
        (
          await app.inject({
            method: "GET",
            url: `${url}?registeredFrom=invalid`,
            headers: admin.headers,
          })
        ).statusCode,
      ).toBe(400);
      const forged = await app.inject({
        method: "PUT",
        url: "/v1/users/me/onboarding",
        headers: reader.headers,
        payload: {
          ...settings,
          usagePurpose: "record",
          usagePurposeRecordedAt: "2020-01-01T00:00:00Z",
        },
      });
      expect(forged.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });
});
