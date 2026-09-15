type Standing = { rank: number; points: number };
type Viewer = { rank: number | null; points: number };

/** Scores are integer points. Aim one point above the next competitor, not a tie. */
export function leagueRankProgress(players: readonly Standing[], viewer: Viewer) {
  const points = Math.max(0, Number.isFinite(viewer.points) ? viewer.points : 0);
  if (viewer.rank === null) return { kind: "unranked" as const };
  if (viewer.rank === 1) {
    const runnerUp = players.find((player) => player.rank > 1);
    return { kind: "leader" as const, gap: runnerUp ? Math.max(0, points - runnerUp.points) : null };
  }
  const target = players.filter((player) => player.rank < viewer.rank! && Number.isFinite(player.points))
    .sort((a, b) => b.rank - a.rank)[0];
  if (!target) return { kind: "unavailable" as const };
  const targetPoints = Math.max(1, Math.floor(target.points) + 1);
  const remainingPoints = Math.max(0, targetPoints - points);
  const remainingPercent = Math.min(100, Math.ceil(remainingPoints / targetPoints * 1000) / 10);
  return { kind: "chasing" as const, rank: target.rank, targetPoints, remainingPoints, remainingPercent, reachedPercent: 100 - remainingPercent };
}
