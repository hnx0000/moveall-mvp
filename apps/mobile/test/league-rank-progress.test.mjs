import test from "node:test";
import assert from "node:assert/strict";
import { leagueRankProgress } from "../src/components/league-rank-progress.ts";

test("next rank percentage uses the score needed to overtake the immediately higher rank", () => {
  const result = leagueRankProgress([{ rank: 1, points: 2000 }, { rank: 2, points: 1200 }, { rank: 3, points: 1000 }], { rank: 3, points: 1000 });
  assert.deepEqual(result, { kind: "chasing", rank: 2, targetPoints: 1201, remainingPoints: 201, remainingPercent: 16.8, reachedPercent: 83.2 });
});
test("ties still require one point, and the missing fraction never rounds to zero", () => {
  const result = leagueRankProgress([{ rank: 1, points: 50000 }], { rank: 2, points: 50000 });
  assert.equal(result.remainingPoints, 1);
  assert.equal(result.remainingPercent, 0.1);
});
test("the leader has no fabricated higher rank or percentage", () => {
  assert.deepEqual(leagueRankProgress([{ rank: 1, points: 2528 }, { rank: 2, points: 1907 }], { rank: 1, points: 2528 }), { kind: "leader", gap: 621 });
  assert.deepEqual(leagueRankProgress([{ rank: 1, points: 100 }], { rank: 1, points: 100 }), { kind: "leader", gap: null });
});
test("unranked and unavailable rivals do not show misleading progress", () => {
  assert.equal(leagueRankProgress([], { rank: null, points: 0 }).kind, "unranked");
  assert.equal(leagueRankProgress([], { rank: 2, points: 0 }).kind, "unavailable");
  assert.equal(leagueRankProgress([{ rank: 1, points: 0 }], { rank: 2, points: 0 }).remainingPercent, 100);
});
