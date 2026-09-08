import { describe, expect, it } from "vitest";
import { calculateLeaguePoints } from "../src/league";

const score = (wallMinutes: number, metrics: Record<string, number>) =>
  calculateLeaguePoints({
    sport: "running",
    perceivedExertion: 5,
    startedAt: "2026-09-08T00:00:00Z",
    endedAt: new Date(Date.parse("2026-09-08T00:00:00Z") + wallMinutes * 60000).toISOString(),
    metrics: { distanceKm: 1, ...metrics },
  });
describe("league active duration", () => {
  it("does not award points for a long pause or recovered downtime", () => {
    for (const wall of [10, 360, 1440]) {
      expect(score(wall, { durationMinutes: 10 })).toBe(30);
      expect(score(wall, { durationMilliseconds: 600000 })).toBe(30);
      expect(score(wall, { durationSeconds: 600 })).toBe(30);
    }
  });
  it("honors explicit zero and retains bounded legacy wall-time scoring", () => {
    expect(score(360, { durationMinutes: 0 })).toBe(10);
    expect(score(10, {})).toBe(30);
    expect(score(1440, {})).toBe(730);
    expect(score(10, { durationMinutes: 1000 })).toBe(30);
  });
});
