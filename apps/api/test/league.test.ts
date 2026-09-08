import type { AppConfig } from "../src/config.js";
import { describe, expect, it } from "vitest";
import {
  calculateLeaguePoints,
  currentLeagueSeason,
  type OnboardingInput,
  type OnboardingProfile,
} from "@moveall/contracts";
import { createApp } from "../src/app.js";
import { createLeagueEntry } from "../src/domain/league.js";
import { MemoryStore } from "../src/infrastructure/memory-store.js";

const config: AppConfig = {
  nodeEnv: "test",
  host: "127.0.0.1",
  port: 3000,
  dataStore: "memory",
  databaseMaxConnections: 5,
  databaseSsl: false,
  authSecret: "test-secret-that-is-at-least-32-characters",
  googleClientIds: [],
  appleClientIds: [],
  adminEmails: [],
  devAuthBypass: false,
  mediaStorage: "disabled",
  supabaseMediaBucket: "groov-media",
  corsOrigins: ["http://localhost:8081"],
};

const route = [
  { latitude: 37.6501, longitude: 127.0301, timestamp: 1 },
  { latitude: 37.68, longitude: 127.06, timestamp: 2 },
  { latitude: 37.6502, longitude: 127.0302, timestamp: 3 },
];

function workout(minutes: number, distanceKm: number, startOffsetMinutes = -60) {
  const startedAt = new Date(Date.now() + startOffsetMinutes * 60_000);
  return {
    sport: "running" as const,
    startedAt: startedAt.toISOString(),
    endedAt: new Date(startedAt.getTime() + minutes * 60_000).toISOString(),
    perceivedExertion: 7,
    metrics: { durationSeconds: minutes * 60, distanceKm, calories: minutes * 9 },
    routePoints: route,
    source: "manual" as const,
  };
}

function onboarding(
  verifiedAt = new Date(Date.now() - 24 * 60 * 60_000).toISOString(),
): OnboardingInput {
  return {
    primarySports: ["running"],
    activityLevel: "steady" as const,
    goals: ["performance"],
    neighborhood: {
      neighborhood: "쌍문동",
      district: "도봉구",
      province: "서울",
      regionCode: "kr:seoul:dobong",
      latitude: 37.65,
      longitude: 127.03,
      verifiedAt,
    },
  };
}

function onboardingProfile(): OnboardingProfile {
  const input = onboarding();
  return {
    primarySports: input.primarySports,
    activityLevel: input.activityLevel,
    goals: input.goals,
    neighborhood: input.neighborhood!,
    completedAt: new Date().toISOString(),
  };
}

describe("regional league", () => {
  it("uses a deterministic bounded score and KST quarterly seasons", () => {
    expect(calculateLeaguePoints(workout(30, 5))).toBeGreaterThan(0);
    expect(calculateLeaguePoints(workout(30, 5))).toBe(calculateLeaguePoints(workout(30, 5)));
    expect(
      calculateLeaguePoints({
        ...workout(30, 5),
        metrics: { durationSeconds: 999_999, distanceKm: 999_999, calories: 999_999 },
      }),
    ).toBeLessThanOrEqual(3_000);
    expect(currentLeagueSeason(new Date("2026-02-28T14:59:59.000Z")).name).toBe("2025 겨울 시즌");
    expect(currentLeagueSeason(new Date("2026-02-28T15:00:00.000Z")).name).toBe("2026 봄 시즌");
  });

  it("requires an outdoor round trip but accepts swimming by verified residence", () => {
    const profile = onboardingProfile();
    const missingRoute = createLeagueEntry(
      "user",
      {
        ...workout(30, 5),
        routePoints: [],
        id: "a",
        userId: "user",
        createdAt: new Date().toISOString(),
      },
      profile,
    );
    expect(missingRoute).toMatchObject({ eligibility: "route-missing", points: 0 });
    const roundTrip = createLeagueEntry(
      "user",
      { ...workout(30, 5), id: "b", userId: "user", createdAt: new Date().toISOString() },
      profile,
    );
    expect(roundTrip?.eligibility).toBe("eligible");
    expect(roundTrip?.points).toBeGreaterThan(0);
    const swim = createLeagueEntry(
      "user",
      {
        ...workout(30, 1.5),
        sport: "swimming",
        routePoints: [],
        id: "c",
        userId: "user",
        createdAt: new Date().toISOString(),
      },
      profile,
    );
    expect(swim?.eligibility).toBe("eligible");
  });

  it("recalculates member, participation, points and rank after create and delete", async () => {
    const store = new MemoryStore();
    const users = await Promise.all([
      store.createUser({ email: "a@league.test", displayName: "러너A", passwordHash: "x" }),
      store.createUser({ email: "b@league.test", displayName: "러너B", passwordHash: "x" }),
      store.createUser({ email: "c@league.test", displayName: "러너C", passwordHash: "x" }),
    ]);
    await Promise.all(users.map((user) => store.saveOnboarding(user.id, onboarding())));
    const first = await store.createWorkoutSession(users[0]!.id, workout(20, 3));
    await store.createWorkoutSession(users[1]!.id, workout(45, 8));
    let snapshot = await store.leagueSnapshot(users[0]!.id, { mode: "running", period: "season" });
    expect(snapshot.region).toMatchObject({
      memberCount: 3,
      participantCount: 2,
      participationRate: 66.7,
    });
    expect(snapshot.viewer.rank).toBe(2);
    const originalPoints = snapshot.viewer.points;
    await store.updateWorkoutSession(users[0]!.id, first.id, {
      metrics: { ...first.metrics, distanceKm: 40, calories: 1_500 },
    });
    snapshot = await store.leagueSnapshot(users[0]!.id, {
      mode: "running",
      period: "season",
    });
    expect(snapshot.viewer.rank).toBe(1);
    expect(snapshot.viewer.points).toBeGreaterThan(originalPoints);
    expect(snapshot.viewer.activityCount).toBe(1);
    await store.updateWorkoutSession(users[0]!.id, first.id, { metrics: first.metrics });
    snapshot = await store.leagueSnapshot(users[0]!.id, {
      mode: "running",
      period: "season",
    });
    expect(snapshot.viewer.rank).toBe(2);
    const winning = await store.createWorkoutSession(users[0]!.id, workout(180, 35, -240));
    snapshot = await store.leagueSnapshot(users[0]!.id, { mode: "running", period: "season" });
    expect(snapshot.viewer.rank).toBe(1);
    expect(snapshot.region?.points).toBe(
      snapshot.players.reduce((sum, player) => sum + player.points, 0),
    );
    await store.deleteWorkoutSession(users[0]!.id, winning.id);
    snapshot = await store.leagueSnapshot(users[0]!.id, { mode: "running", period: "season" });
    expect(snapshot.viewer.rank).toBe(2);
    expect(snapshot.viewer.activityCount).toBe(1);
    expect(await store.deleteWorkoutSession(users[0]!.id, first.id)).toBe(true);
  });

  it("exposes the live aggregate through the authenticated API", async () => {
    const store = new MemoryStore();
    const app = await createApp({ config, store });
    const registered = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: { email: "api@league.test", password: "very-secure-1234", displayName: "API 러너" },
    });
    const accessToken = registered.json().data.accessToken as string;
    const headers = { authorization: `Bearer ${accessToken}` };
    await app.inject({
      method: "PUT",
      url: "/v1/users/me/onboarding",
      headers,
      payload: onboarding(new Date().toISOString()),
    });
    const recorded = await app.inject({
      method: "POST",
      url: "/v1/workout-sessions",
      headers,
      payload: workout(30, 5, -1),
    });
    expect(recorded.statusCode).toBe(201);
    const response = await app.inject({
      method: "GET",
      url: "/v1/league?mode=running&period=season",
      headers,
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.json().data.viewer).toMatchObject({
      verification: "verified",
      rank: 1,
      activityCount: 1,
    });
    await app.close();
  });
});
