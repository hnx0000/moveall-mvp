import assert from "node:assert/strict";
import test from "node:test";
import { demoLeagueParticipants, demoLeagueWorkouts } from "../src/api/demo-league-fixtures.ts";
import { calculateLeaguePoints } from "@moveall/contracts";

test("sample participants cover Seoul and other cities without changing the viewer region", () => {
  const now = new Date("2026-09-10T14:00:00Z");
  const members = demoLeagueParticipants(now, { regionKey: "custom-dobong", regionName: "도봉구", province: "서울특별시" });
  assert.equal(new Set(members.map(m => m.regionKey)).size, 33);
  assert.ok(members.length > 600);
  assert.ok(members.some(m => m.workouts.length === 0));
  assert.ok(members.filter(m => m.regionName === "도봉구").every(m => m.regionKey === "custom-dobong"));
  const records = demoLeagueWorkouts(7, now);
  assert.equal(new Set(records.map(w => w.sport)).size, 6);
  assert.ok(records.every(w => Date.parse(w.endedAt) <= now.getTime() && calculateLeaguePoints(w) > 0));
});

test("demo league ranks and participant totals are computed from records without adding workout history", async () => {
  const { demoApi } = await import("../src/api/demo-client.ts?league-samples");
  const workoutHistory = JSON.stringify(await demoApi.workouts("demo"));
  const snapshot = await demoApi.league("demo", { mode: "activity", period: "season" });
  assert.ok(snapshot.players.length > 10);
  assert.ok(snapshot.viewer.points > 0 && snapshot.viewer.rank > 0);
  assert.ok(snapshot.regions.length >= 33);
  assert.equal(snapshot.region.points, snapshot.players.reduce((n, p) => n + p.points, 0));
  assert.equal(snapshot.region.participantCount, snapshot.players.length);
  assert.equal(snapshot.region.participationRate, Math.round(snapshot.players.length / snapshot.region.memberCount * 1000) / 10);
  assert.ok(snapshot.players.every((p, i, all) => p.rank === i + 1 && (!i || all[i - 1].points >= p.points)));
  const other = snapshot.regions.find(r => r.regionKey !== snapshot.viewer.regionKey);
  const selected = await demoApi.league("demo", { mode: "swimming", period: "season", regionKey: other.regionKey });
  assert.equal(selected.region.regionKey, other.regionKey);
  assert.ok(selected.players.length > 0);
  assert.ok(selected.region.points < other.points);
  assert.equal(JSON.stringify(await demoApi.workouts("demo")), workoutHistory);
});
